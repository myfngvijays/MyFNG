import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { renderManualInvoiceHtml } from '@/lib/manualInvoices/renderManualInvoiceHtml';

export async function GET(request: Request, context: any) {
  try {
    const supabase = await createClient();
    const resolvedParams = await Promise.resolve(context?.params);
    const invoiceId = String(resolvedParams?.id || '').trim();
    if (!invoiceId) return NextResponse.json({ error: 'Missing invoice id' }, { status: 400 });

    const { data, error } = await supabase
      .from('manual_create_invoice')
      .select('*')
      .eq('id', invoiceId)
      .single();

    const invoice = data as any;
    if (error || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const url = new URL(request.url);
    const autoPrint = url.searchParams.get('print') === '1';
    // Prefer NEXT_PUBLIC_APP_URL so logo loads on production (e.g. https://myfng.in)
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || url.origin).replace(/\/$/, '');
    const htmlContent = renderManualInvoiceHtml(invoice, { autoPrint, appUrl });
    return new NextResponse(htmlContent, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="invoice-${invoice.invoice_number}.html"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

