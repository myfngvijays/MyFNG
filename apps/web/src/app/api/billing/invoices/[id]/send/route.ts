/**
 * Send Invoice to Customer API
 * Step 5: Share Invoice with Customer - WhatsApp/SMS/Email
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendInvoiceEmail } from '@/lib/services/emailService';
import { sendSMS } from '@/lib/services/smsService';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role, name, email')
      .eq('email', user.email)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Verify user has billing permissions
    const allowedRoles = ['super_admin', 'sub_admin', 'workshop_admin', 'billing'];
    if (!allowedRoles.includes(userProfile.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const invoiceId = params.id;
    const body = await request.json();
    const { methods } = body; // ['EMAIL', 'SMS', 'WHATSAPP', 'IN_APP']

    if (!methods || !Array.isArray(methods) || methods.length === 0) {
      return NextResponse.json({ 
        error: 'At least one sharing method is required' 
      }, { status: 400 });
    }

    // Get invoice details
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
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Verify invoice is approved
    if (invoice.status !== 'APPROVED' && invoice.status !== 'GENERATED') {
      return NextResponse.json({ 
        error: 'Invoice must be approved before sending',
        current_status: invoice.status
      }, { status: 400 });
    }

    const now = new Date().toISOString();
    const results: any = {};

    // Send via Email
    if (methods.includes('EMAIL') && invoice.lead?.customer_email) {
      try {
        const emailSent = await sendInvoiceEmail(
          invoice.lead.customer_email,
          invoice.lead.id,
          invoice.lead.customer_name,
          invoice
        );

        if (emailSent) {
          await supabase
            .from('invoices')
            .update({
              sent_via_email: true,
              email_sent_at: now,
              status: invoice.status === 'GENERATED' ? 'SENT' : invoice.status,
              updated_at: now,
            })
            .eq('id', invoiceId);

          await supabase
            .from('invoice_sharing_logs')
            .insert({
              invoice_id: invoiceId,
              shared_by: userProfile.id,
              sharing_method: 'EMAIL',
              recipient_email: invoice.lead.customer_email,
              sharing_status: 'SENT',
              shared_at: now,
            });

          results.email = { success: true, message: 'Email sent successfully' };
        } else {
          results.email = { success: false, message: 'Failed to send email' };
        }
      } catch (error: any) {
        results.email = { success: false, message: error.message };
      }
    }

    // Send via SMS
    if (methods.includes('SMS') && invoice.lead?.customer_phone) {
      try {
        const invoiceLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invoice/${invoice.invoice_number}`;
        const { sendLeadNotification } = await import('@/lib/services/smsService');
        const smsMessage = `Invoice ${invoice.invoice_number} generated. Amount: ₹${invoice.final_amount.toFixed(2)}. View & Pay: ${invoiceLink}`;
        const { sendSMS } = await import('@/lib/services/smsService');
        const smsSent = await sendSMS(
          invoice.lead.customer_phone,
          smsMessage
        );

        if (smsSent) {
          await supabase
            .from('invoices')
            .update({
              sent_via_sms: true,
              sms_sent_at: now,
              status: invoice.status === 'GENERATED' ? 'SENT' : invoice.status,
              updated_at: now,
            })
            .eq('id', invoiceId);

          await supabase
            .from('invoice_sharing_logs')
            .insert({
              invoice_id: invoiceId,
              shared_by: userProfile.id,
              sharing_method: 'SMS',
              recipient_phone: invoice.lead.customer_phone,
              sharing_status: 'SENT',
              sharing_link: invoiceLink,
              shared_at: now,
            });

          results.sms = { success: true, message: 'SMS sent successfully' };
        } else {
          results.sms = { success: false, message: 'Failed to send SMS' };
        }
      } catch (error: any) {
        results.sms = { success: false, message: error.message };
      }
    }

    // Send via WhatsApp (placeholder - needs WhatsApp Business API)
    if (methods.includes('WHATSAPP') && invoice.lead?.customer_phone) {
      try {
        // TODO: Implement WhatsApp Business API integration
        // For now, just log it
        await supabase
          .from('invoice_sharing_logs')
          .insert({
            invoice_id: invoiceId,
            shared_by: userProfile.id,
            sharing_method: 'WHATSAPP',
            recipient_phone: invoice.lead.customer_phone,
            sharing_status: 'PENDING',
            error_message: 'WhatsApp integration pending',
            shared_at: now,
          });

        results.whatsapp = { 
          success: false, 
          message: 'WhatsApp integration pending. Please use Email or SMS.' 
        };
      } catch (error: any) {
        results.whatsapp = { success: false, message: error.message };
      }
    }

    // In-App sharing (just update status)
    if (methods.includes('IN_APP')) {
      await supabase
        .from('invoices')
        .update({
          status: 'SENT',
          sent_to_customer_at: now,
          updated_at: now,
        })
        .eq('id', invoiceId);

      results.in_app = { success: true, message: 'Invoice marked as sent' };
    }

    // Update lead status if invoice sent
    if (invoice.lead_id && Object.values(results).some((r: any) => r.success)) {
      await supabase
        .from('service_leads')
        .update({
          status: 'AWAITING_PAYMENT',
          updated_at: now,
        })
        .eq('id', invoice.lead_id);

      // Log activity
      await supabase
        .from('lead_activities')
        .insert({
          lead_id: invoice.lead_id,
          user_id: userProfile.id,
          activity_type: 'INVOICE_SENT',
          description: `Invoice ${invoice.invoice_number} sent to customer via ${methods.join(', ')}`,
          old_status: invoice.lead?.status || 'INVOICE_GENERATED',
          new_status: 'AWAITING_PAYMENT',
          metadata: {
            invoice_id: invoiceId,
            invoice_number: invoice.invoice_number,
            sharing_methods: methods,
            results: results,
          },
        });
    }

    return NextResponse.json({
      success: true,
      message: 'Invoice sharing completed',
      results: results,
      next_step: 'Awaiting customer payment',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in send invoice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

