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
      .select('id, invoice_number, lead_id, workshop_id, document_url, document_type')
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // If already persisted, just return it
    if (invoice.document_url && invoice.document_type === 'HTML') {
      return NextResponse.json({
        success: true,
        document_url: invoice.document_url,
        document_type: invoice.document_type,
        already_exists: true,
      });
    }

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
    const filePath = `invoice-documents/${invoice.workshop_id || 'unknown'}/${invoice.invoice_number || invoiceId}.html`;
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

    return NextResponse.json({
      success: true,
      document_url: publicUrl,
      document_type: 'HTML',
      stored_path: filePath,
    });
  } catch (error: any) {
    console.error('Error persisting invoice document:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 }
    );
  }
}


