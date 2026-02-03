import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';
import { sendEmail } from '@/lib/services/emailService';
import { sendSMS } from '@/lib/services/smsService';
import { formatDateDMY } from "@/lib/utils";

export const dynamic = 'force-dynamic';

/**
 * POST /api/invoices/[id]/share
 * Share invoice with customer via Email/SMS/WhatsApp
 */
export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const invoiceId = params.id;
    const body = await request.json();
    const { channels = ['email'], custom_message } = body;

    // Get invoice with lead details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!inner(
          id, lead_number, customer_name, customer_phone, customer_email
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    const lead = invoice.lead as any;
    const invoiceUrl = `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}`;
    
    const sendResults: any = {};

    // Send via Email
    if (channels.includes('email') && lead.customer_email) {
      try {
        const emailSent = await sendEmail(
          lead.customer_email,
          `Invoice ${invoice.invoice_number} - ${lead.customer_name}`,
          `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <div style="background: #3B82F6; color: white; padding: 20px; text-align: center;">
                <h2>Your Invoice is Ready</h2>
              </div>
              <div style="padding: 20px;">
                <p>Dear ${lead.customer_name},</p>
                ${custom_message ? `<p>${custom_message}</p>` : ''}
                <p>Your invoice for service request <strong>${lead.lead_number}</strong> is now ready.</p>
                <div style="background: #F3F4F6; padding: 15px; border-radius: 8px; margin: 20px 0;">
                  <p><strong>Invoice Number:</strong> ${invoice.invoice_number}</p>
                  <p><strong>Total Amount:</strong> ₹${parseFloat(invoice.total_amount).toLocaleString()}</p>
                  <p><strong>Due Date:</strong> ${formatDateDMY(invoice.due_date)}</p>
                </div>
                <p style="text-align: center;">
                  <a href="${invoiceUrl}" style="background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block; margin: 10px 0;">
                    View Invoice
                  </a>
                </p>
                <p>To make payment, please click the button above.</p>
                <p>Thank you for choosing our service!</p>
              </div>
            </div>
          `
        );
        sendResults.email = emailSent;
      } catch (err) {
        console.error('Email send error:', err);
        sendResults.email = false;
      }
    }

    // Send via SMS
    if (channels.includes('sms') && lead.customer_phone) {
      try {
        const smsSent = await sendSMS(
          lead.customer_phone,
          `Dear ${lead.customer_name}, your invoice ${invoice.invoice_number} of Rs.${parseFloat(invoice.total_amount).toLocaleString()} is ready. View & pay: ${invoiceUrl}`
        );
        sendResults.sms = smsSent;
      } catch (err) {
        console.error('SMS send error:', err);
        sendResults.sms = false;
      }
    }

    // Send via WhatsApp (placeholder - integrate with WhatsApp Business API)
    if (channels.includes('whatsapp') && lead.customer_phone) {
      // TODO: Integrate with WhatsApp Business API
      sendResults.whatsapp = false;
    }

    // Log invoice sharing
    const now = new Date().toISOString();
    await supabase
      .from('invoice_sharing_logs')
      .insert({
        invoice_id: invoiceId,
        shared_by: user.id,
        sharing_method: channels.join(',').toUpperCase(),
        recipient_email: lead.customer_email,
        recipient_phone: lead.customer_phone,
        sharing_status: Object.values(sendResults).some(v => v) ? 'SENT' : 'FAILED',
        sharing_link: invoiceUrl,
        shared_at: now
      });

    // Update invoice
    await supabase
      .from('invoices')
      .update({
        sent_to_customer: true,
        sent_at: now
      })
      .eq('id', invoiceId);

    // Create finance event
    await createFinanceEvent({
      eventType: 'invoice_sent',
      entityType: 'invoice',
      entityId: invoiceId,
      actorId: user.id,
      eventData: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        lead_id: lead.id,
        channels,
        results: sendResults
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Invoice shared successfully',
      results: sendResults,
      invoice_url: invoiceUrl
    });

  } catch (error: any) {
    console.error('Error sharing invoice:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

