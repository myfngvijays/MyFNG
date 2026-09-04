/**
 * Persist Invoice Document API
 * Purpose: Generate invoice HTML (printable) and store it to Supabase Storage, then save URL on invoice.
 * NOTE: This is a stepping stone towards true PDF generation (puppeteer/pdfkit) later.
 */

import { createClientFromRequest } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
// Keep this route portable (Node/Edge). Avoid Node-only APIs (e.g. Buffer).

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClientFromRequest(request);

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: invoiceId } = await params;
    if (!invoiceId || !isUuid(String(invoiceId))) {
      return NextResponse.json({ error: 'Invalid invoice id' }, { status: 400 });
    }

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

    // Generate PDF by calling existing generator endpoint (single source of truth)
    // Use internal HTTP origin to avoid HTTPS->HTTP TLS mismatch behind reverse proxies.
    const internalOrigin =
      process.env.INTERNAL_APP_ORIGIN ||
      `http://127.0.0.1:${process.env.PORT || 3000}`;
    const baseOrigin = request.nextUrl.origin.startsWith('https://')
      ? internalOrigin
      : request.nextUrl.origin;
    const pdfUrl = `${baseOrigin}/api/billing/invoices/${invoiceId}/generate-pdf`;
    // IMPORTANT: forward cookies so generate-pdf can auth as the same user.
    // Without this, generate-pdf returns 401 and persist-document fails with 500.
    const cookie = request.headers.get('cookie') || '';
    const authorization = request.headers.get('authorization') || '';
    const fallbackUrl = `/api/billing/invoices/${invoiceId}/generate-pdf`;

    const pdfRes = await fetch(pdfUrl, {
      method: 'GET',
      headers: {
        ...(cookie ? { cookie } : {}),
        ...(authorization ? { authorization } : {}),
      },
      cache: 'no-store',
    });
    if (!pdfRes.ok) {
      const text = await pdfRes.text();
      // Non-fatal: printing can still proceed using generator URL.
      return NextResponse.json({
        success: false,
        reason: 'generate_failed',
        status: pdfRes.status,
        details: text.slice(0, 500),
        fallback_url: fallbackUrl,
      });
    }

    const generatedType = String(pdfRes.headers.get('content-type') || '').toLowerCase();
    if (!generatedType.includes('application/pdf')) {
      return NextResponse.json({
        success: false,
        reason: 'not_pdf',
        details: 'Generator returned HTML (Chrome PDF engine unavailable). Use generate-pdf URL to print.',
        fallback_url: fallbackUrl,
      });
    }

    const pdfBytes = await pdfRes.arrayBuffer();
    const now = new Date().toISOString();

    // Upload to Supabase Storage
    // Bucket expected: "invoices" (create it once in Supabase dashboard)
    const year = (invoice as any).series_year || new Date().getFullYear();
    const month = (invoice as any).series_month || (new Date().getMonth() + 1);
    const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const monthName = monthNames[Math.max(1, Math.min(12, month)) - 1];

    const safeDocNo = (invoice.invoice_number || invoiceId).replace(/[^A-Za-z0-9_-]/g, '_');
    const filePath = `invoices/${year}/${monthName}/${docFolder}/${safeDocNo}_v${nextVersion}.pdf`;
    const fileBytes = new Uint8Array(pdfBytes);
    const uploadRes = await supabase.storage
      .from('invoices')
      .upload(filePath, fileBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadRes.error) {
      // Non-fatal: allow printing via generator URL even if storage isn't configured.
      return NextResponse.json({
        success: false,
        reason: 'storage_upload_failed',
        details: uploadRes.error.message,
        hint: 'Create a Supabase Storage bucket named "invoices" and allow uploads',
        fallback_url: fallbackUrl,
      });
    }

    const { data: publicUrlData } = supabase.storage.from('invoices').getPublicUrl(filePath);
    const publicUrl = publicUrlData?.publicUrl;

    if (!publicUrl) {
      return NextResponse.json({
        success: false,
        reason: 'public_url_failed',
        fallback_url: fallbackUrl,
      });
    }

    await supabase
      .from('invoices')
      .update({
        document_url: publicUrl,
        document_type: 'PDF',
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
          document_type: 'PDF',
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
      document_type: 'PDF',
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


