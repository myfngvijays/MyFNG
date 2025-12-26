/**
 * Persist Invoice Document API
 * Purpose: Generate invoice HTML (printable) and store it to Supabase Storage, then save URL on invoice.
 * NOTE: This is a stepping stone towards true PDF generation (puppeteer/pdfkit) later.
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = params.id;

    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select('id, invoice_number, lead_id, workshop_id, document_url, document_type, invoice_type, series_year, series_month, series_seq')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const invoiceType = (invoice as any).invoice_type || 'TAX_INVOICE';

    // Determine doc_type folder name
    const folderByType: Record<string, string> = {
      ORDER_SUMMARY: 'OrderSummary',
      CUSTOMER_INVOICE: 'CustomerInvoice',
      TAX_INVOICE: 'TaxInvoice',
      RECEIPT: 'Receipt',
    };
    const docFolder = folderByType[invoiceType] || 'TaxInvoice';

    // Versioning: next version is (max + 1)
    const { data: latestDoc } = await supabase
      .from('invoice_documents')
      .select('version, public_url, document_type')
      .eq('invoice_id', invoiceId)
      .eq('doc_type', invoiceType)
      .order('version', { ascending: false })
      .limit(1)
      .maybeSingle();

    // If latest exists and invoice has document_url, return stable latest (no regen)
    if (latestDoc?.public_url) {
      return NextResponse.json({
        success: true,
        document_url: latestDoc.public_url,
        document_type: latestDoc.document_type || 'HTML',
        already_exists: true,
        version: latestDoc.version,
      });
    }

    const nextVersion = (latestDoc?.version || 0) + 1;

    // Generate HTML by calling existing generator endpoint (single source of truth)
    const htmlUrl = `${request.nextUrl.origin}/api/billing/invoices/${invoiceId}/generate-pdf`;
    const htmlRes = await fetch(htmlUrl, { method: 'GET' });
    if (!htmlRes.ok) {
      const text = await htmlRes.text();
      return NextResponse.json(
        { error: 'Failed to generate invoice document', details: text.slice(0, 500) },
        { status: 500 }
      );
    }

    const htmlContent = await htmlRes.text();
    const now = new Date().toISOString();

    // Upload to Supabase Storage
    // Bucket expected: "invoices" (create it once in Supabase dashboard)
    const year = (invoice as any).series_year || new Date().getFullYear();
    const month = (invoice as any).series_month || (new Date().getMonth() + 1);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthName = monthNames[Math.max(1, Math.min(12, month)) - 1];

    const safeDocNo = (invoice.invoice_number || invoiceId).replace(/[^A-Za-z0-9_-]/g, '_');
    const filePath = `invoices/${year}/${monthName}/${docFolder}/${safeDocNo}_v${nextVersion}.html`;
    const uploadRes = await supabase.storage
      .from('invoices')
      .upload(filePath, Buffer.from(htmlContent, 'utf-8'), {
        contentType: 'text/html; charset=utf-8',
        upsert: true,
      });

    if (uploadRes.error) {
      return NextResponse.json(
        {
          error: 'Failed to upload invoice document to storage',
          details: uploadRes.error.message,
          hint: 'Create a Supabase Storage bucket named "invoices" and allow server uploads',
        },
        { status: 500 }
      );
    }

    const { data: publicUrlData } = supabase.storage.from('invoices').getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      return NextResponse.json(
        { error: 'Failed to generate public URL for invoice document' },
        { status: 500 }
      );
    }

    await supabase
      .from('invoices')
      .update({
        document_url: publicUrl,
        document_type: 'HTML',
        document_generated_at: now,
        updated_at: now,
      })
      .eq('id', invoiceId);

    // Insert versioned doc row (best-effort; do not fail API if insert fails due to missing migration)
    try {
      await supabase
        .from('invoice_documents')
        .insert({
          invoice_id: invoiceId,
          doc_type: invoiceType,
          doc_number: invoice.invoice_number || null,
          version: nextVersion,
          storage_path: filePath,
          public_url: publicUrl,
          document_type: 'HTML',
          snapshot: {
            invoice_id: invoiceId,
            invoice_type: invoiceType,
            generated_at: now,
          },
          generated_at: now,
        });
    } catch {
      // ignore (migration may not be applied yet)
    }

    return NextResponse.json({
      success: true,
      document_url: publicUrl,
      document_type: 'HTML',
      stored_path: filePath,
      version: nextVersion,
    });
  } catch (error: any) {
    console.error('Error persisting invoice document:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}


