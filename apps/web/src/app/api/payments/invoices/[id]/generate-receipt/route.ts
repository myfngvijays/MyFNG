import { formatDateDMY, formatDateTime } from "@/lib/utils";
/**
 * Generate Receipt API
 * Phase 1.5 - Receipt Generation
 * Purpose: Generate receipt PDF and send to customer
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendPaymentConfirmationEmail } from '@/lib/services/emailService';
import { createFinanceEvent } from '@/lib/services/financeEventService';

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = params.id;

    // Get invoice with payment details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!lead_id(
          id,
          customer_name,
          customer_email,
          customer_phone,
          vehicle_number
        ),
        workshop:workshops!workshop_id(
          name,
          address,
          phone,
          email,
          gst_number
        ),
        payment_transactions(
          id,
          transaction_id,
          amount,
          payment_method,
          payment_gateway,
          completed_at,
          payment_received_by,
          staff_name
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Verify payment has been received
    if (invoice.payment_status !== 'PAID' && invoice.payment_status !== 'PARTIAL') {
      return NextResponse.json({
        error: 'Receipt can only be generated for paid invoices',
        payment_status: invoice.payment_status,
      }, { status: 400 });
    }

    // Get payment transactions
    const payments = invoice.payment_transactions || [];
    const totalPaid = payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0);

    // Generate receipt HTML
    const receiptHtml = generateReceiptHTML(invoice, payments);

    // Store receipt URL (for now, we'll use the HTML endpoint)
    const receiptUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/payments/invoices/${invoiceId}/receipt`;

    const now = new Date().toISOString();

    // Update invoice with receipt URL
    await supabase
      .from('invoices')
      .update({
        receipt_url: receiptUrl,
        receipt_generated_at: now,
        updated_at: now,
      })
      .eq('id', invoiceId);

    // Send receipt to customer via email
    if (invoice.lead?.customer_email) {
      try {
        await sendPaymentConfirmationEmail(
          invoice.lead.customer_email,
          invoice.lead.id,
          invoice.lead.customer_name,
          totalPaid,
          invoice.payment_transactions?.[0]?.transaction_id || invoice.payment_txn_id || 'N/A'
        );
      } catch (emailError) {
        console.error('Error sending receipt email:', emailError);
      }
    }

    // Create finance event
    await createFinanceEvent({
      eventType: 'receipt_generated',
      entityType: 'receipt',
      entityId: invoiceId,
      eventData: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        receipt_url: receiptUrl,
        total_paid: totalPaid,
        payment_count: payments.length,
      },
      ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
      userAgent: request.headers.get('user-agent') || undefined,
    });

    // Create lead event
    if (invoice.lead_id) {
      await supabase
        .from('lead_events')
        .insert({
          lead_id: invoice.lead_id,
          event_type: 'receipt_sent',
          event_data: {
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            receipt_url: receiptUrl,
            sent_at: now,
          },
          created_at: now,
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Receipt generated successfully',
      receipt_url: receiptUrl,
      invoice_id: invoiceId,
      total_paid: totalPaid,
      payment_count: payments.length,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in generate receipt API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

function generateReceiptHTML(invoice: any, payments: any[]): string {
  const receiptDate = formatDateDMY(new Date());

  const workshop = invoice.workshop || {};
  const lead = invoice.lead || {};

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Receipt - ${invoice.invoice_number}</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Arial', sans-serif;
      color: #333;
      line-height: 1.6;
      padding: 40px;
      background: #fff;
    }
    .receipt-container {
      max-width: 600px;
      margin: 0 auto;
      background: white;
      padding: 30px;
      border: 2px solid #10b981;
    }
    .header {
      text-align: center;
      border-bottom: 3px solid #10b981;
      padding-bottom: 20px;
      margin-bottom: 30px;
    }
    .header h1 {
      color: #10b981;
      font-size: 32px;
      margin-bottom: 10px;
    }
    .success-badge {
      display: inline-block;
      background: #10b981;
      color: white;
      padding: 8px 16px;
      border-radius: 20px;
      font-size: 14px;
      font-weight: bold;
      margin-top: 10px;
    }
    .info-section {
      margin-bottom: 20px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-label {
      font-weight: bold;
      color: #6b7280;
    }
    .amount-section {
      background: #f0fdf4;
      padding: 20px;
      border-radius: 8px;
      margin: 20px 0;
      border-left: 4px solid #10b981;
    }
    .amount-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      font-size: 16px;
    }
    .total-amount {
      font-size: 24px;
      font-weight: bold;
      color: #10b981;
      border-top: 2px solid #10b981;
      padding-top: 10px;
      margin-top: 10px;
    }
    .payment-details {
      margin-top: 20px;
      padding: 15px;
      background: #f9fafb;
      border-radius: 5px;
    }
    .footer {
      margin-top: 40px;
      padding-top: 20px;
      border-top: 1px solid #ddd;
      text-align: center;
      color: #666;
      font-size: 12px;
    }
    @media print {
      body { padding: 0; }
      .receipt-container { border: none; }
    }
  </style>
</head>
<body>
  <div class="receipt-container">
    <div class="header">
      <h1>PAYMENT RECEIPT</h1>
      <div class="success-badge">✓ Payment Received</div>
    </div>

    <div class="info-section">
      <div class="info-row">
        <span class="info-label">Receipt Date:</span>
        <span>${receiptDate}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Invoice Number:</span>
        <span>${invoice.invoice_number}</span>
      </div>
      <div class="info-row">
        <span class="info-label">Customer Name:</span>
        <span>${lead.customer_name || 'N/A'}</span>
      </div>
      ${lead.vehicle_number ? `
      <div class="info-row">
        <span class="info-label">Vehicle Number:</span>
        <span>${lead.vehicle_number}</span>
      </div>
      ` : ''}
    </div>

    <div class="amount-section">
      <div class="amount-row">
        <span>Invoice Amount:</span>
        <span>₹${parseFloat(invoice.final_amount || '0').toFixed(2)}</span>
      </div>
      <div class="amount-row">
        <span>Amount Paid:</span>
        <span>₹${payments.reduce((sum: number, p: any) => sum + parseFloat(p.amount || '0'), 0).toFixed(2)}</span>
      </div>
      ${invoice.balance_due > 0 ? `
      <div class="amount-row">
        <span>Balance Due:</span>
        <span>₹${parseFloat(invoice.balance_due || '0').toFixed(2)}</span>
      </div>
      ` : ''}
      <div class="total-amount amount-row">
        <span>Payment Status:</span>
        <span>${invoice.payment_status === 'PAID' ? 'FULLY PAID' : 'PARTIAL'}</span>
      </div>
    </div>

    <div class="payment-details">
      <h3 style="margin-bottom: 15px; color: #10b981;">Payment Details</h3>
      ${payments.map((payment: any, idx: number) => `
        <div style="margin-bottom: 15px; padding: 10px; background: white; border-radius: 5px;">
          <div class="info-row">
            <span class="info-label">Payment ${idx + 1}:</span>
            <span>₹${parseFloat(payment.amount || '0').toFixed(2)}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Method:</span>
            <span>${payment.payment_method || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Transaction ID:</span>
            <span>${payment.transaction_id || 'N/A'}</span>
          </div>
          <div class="info-row">
            <span class="info-label">Date:</span>
            <span>${formatDateTime(payment.completed_at || payment.created_at)}</span>
          </div>
          ${payment.staff_name ? `
          <div class="info-row">
            <span class="info-label">Received By:</span>
            <span>${payment.staff_name}</span>
          </div>
          ` : ''}
        </div>
      `).join('')}
    </div>

    <div class="footer">
      <p><strong>${workshop.name || 'MyFNG Autocare Pvt. Ltd.'}</strong></p>
      <p>${workshop.address || ''}</p>
      <p>Phone: ${workshop.phone || ''} | Email: ${workshop.email || ''}</p>
      <p style="margin-top: 20px;">This is a computer-generated receipt. No signature required.</p>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * GET Receipt (for viewing/downloading)
 */
export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    
    const invoiceId = params.id;

    // Get invoice with payment details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!lead_id(
          id,
          customer_name,
          customer_email,
          customer_phone,
          vehicle_number
        ),
        workshop:workshops!workshop_id(
          name,
          address,
          phone,
          email,
          gst_number
        ),
        payment_transactions(
          id,
          transaction_id,
          amount,
          payment_method,
          payment_gateway,
          completed_at,
          payment_received_by,
          staff_name
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const payments = invoice.payment_transactions || [];
    const receiptHtml = generateReceiptHTML(invoice, payments);

    return new NextResponse(receiptHtml, {
      headers: {
        'Content-Type': 'text/html',
        'Content-Disposition': `inline; filename="receipt-${invoice.invoice_number}.html"`,
      },
    });

  } catch (error) {
    console.error('Error in get receipt API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

