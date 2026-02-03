import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { createFinanceEvent } from '@/lib/services/financeEventService';
import { sendInvoiceEmail } from '@/lib/services/emailService';
import { sendLeadNotification } from '@/lib/services/smsService';

export const dynamic = 'force-dynamic';

/**
 * POST /api/invoices/[id]/send
 * Send invoice to customer via multiple channels
 * Supports: WhatsApp, Email, SMS, In-app notification
 */
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

    // Get user profile with role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, full_name, roles!inner(role_code, role_name)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;

    // Verify permissions
    const allowedRoles = ['SUPER_ADMIN', 'SUB_ADMIN', 'BILLING_SPECIALIST', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'];
    if (!allowedRoles.includes(roleCode)) {
      return NextResponse.json({ 
        error: 'Forbidden: Insufficient permissions',
        current_role: roleCode
      }, { status: 403 });
    }

    const invoiceId = params.id;
    const body = await request.json();
    
    const {
      channels = ['email', 'sms'], // Default channels
      include_payment_link = true,
      custom_message = null,
      recipient_email = null,
      recipient_phone = null
    } = body;

    // Validate channels
    const validChannels = ['whatsapp', 'email', 'sms', 'in_app'];
    const requestedChannels = channels.filter((ch: string) => validChannels.includes(ch));
    
    if (requestedChannels.length === 0) {
      return NextResponse.json({ 
        error: 'At least one valid channel required',
        valid_channels: validChannels
      }, { status: 400 });
    }

    // Get invoice details
    const { data: invoice, error: invoiceError } = await supabase
      .from('invoices')
      .select(`
        *,
        lead:service_leads!inner(
          id, lead_number, customer_name, customer_phone, 
          customer_email, workshop_id, status
        ),
        workshop:workshops(
          id, name, phone, email, address, city, state
        )
      `)
      .eq('id', invoiceId)
      .single();

    if (invoiceError || !invoice) {
      return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });
    }

    // Check if invoice is approved (if required)
    if (invoice.status === 'DRAFT') {
      return NextResponse.json({ 
        error: 'Cannot send draft invoice. Please approve first.',
        invoice_status: invoice.status
      }, { status: 400 });
    }

    const lead = invoice.lead as any;
    const workshop = invoice.workshop as any;
    
    // Use provided recipient or default to lead's contact
    const email = recipient_email || lead.customer_email;
    const phone = recipient_phone || lead.customer_phone;

    // Generate short URL for invoice (for payment link)
    let shortUrl = null;
    let paymentLink = null;
    
    if (include_payment_link) {
      // Create short URL
      const shortCode = `INV-${invoice.invoice_number.replace(/[^A-Z0-9]/g, '')}`;
      
      const { data: existingUrl } = await supabase
        .from('short_urls')
        .select('*')
        .eq('short_code', shortCode)
        .maybeSingle();

      if (!existingUrl) {
        const { data: newUrl } = await supabase
          .from('short_urls')
          .insert({
            short_code: shortCode,
            long_url: `${process.env.NEXT_PUBLIC_APP_URL}/invoices/${invoiceId}`,
            entity_type: 'invoice',
            entity_id: invoiceId
          })
          .select()
          .single();
        
        shortUrl = newUrl?.short_code;
      } else {
        shortUrl = existingUrl.short_code;
      }
      
      paymentLink = `${process.env.NEXT_PUBLIC_APP_URL}/pay/${shortUrl}`;
    }

    const now = new Date().toISOString();
    const results: any = {
      whatsapp: { sent: false, error: null },
      email: { sent: false, error: null },
      sms: { sent: false, error: null },
      in_app: { sent: false, error: null }
    };

    // Send via each requested channel
    
    // 1. EMAIL
    if (requestedChannels.includes('email') && email) {
      try {
        const emailSent = await sendInvoiceEmail(
          email,
          lead.lead_number,
          lead.customer_name,
          {
            invoice_number: invoice.invoice_number,
            amount: invoice.total_amount,
            due_date: invoice.due_date,
            payment_link: paymentLink,
            workshop_name: workshop?.name
          }
        );
        
        results.email.sent = emailSent;
        
        if (emailSent) {
          await supabase
            .from('invoice_sharing_logs')
            .insert({
              invoice_id: invoiceId,
              shared_by: user.id,
              sharing_method: 'EMAIL',
              recipient_email: email,
              sharing_status: 'SENT',
              sharing_link: paymentLink,
              shared_at: now
            });
        }
      } catch (error: any) {
        console.error('Email send error:', error);
        results.email.error = error.message;
      }
    }

    // 2. SMS
    if (requestedChannels.includes('sms') && phone) {
      try {
        const smsSent = await sendLeadNotification(
          phone,
          'INVOICE_GENERATED',
          lead.lead_number,
          {
            amount: invoice.total_amount,
            payment_link: paymentLink
          }
        );
        
        results.sms.sent = smsSent;
        
        if (smsSent) {
          await supabase
            .from('invoice_sharing_logs')
            .insert({
              invoice_id: invoiceId,
              shared_by: user.id,
              sharing_method: 'SMS',
              recipient_phone: phone,
              sharing_status: 'SENT',
              sharing_link: paymentLink,
              shared_at: now
            });
        }
      } catch (error: any) {
        console.error('SMS send error:', error);
        results.sms.error = error.message;
      }
    }

    // 3. WHATSAPP (placeholder - implement with WhatsApp Business API)
    if (requestedChannels.includes('whatsapp') && phone) {
      try {
        // TODO: Implement WhatsApp Business API integration
        // For now, log it
        results.whatsapp.sent = false;
        results.whatsapp.error = 'WhatsApp integration not yet implemented';
        
        await supabase
          .from('invoice_sharing_logs')
          .insert({
            invoice_id: invoiceId,
            shared_by: user.id,
            sharing_method: 'WHATSAPP',
            recipient_phone: phone,
            sharing_status: 'FAILED',
            error_message: 'WhatsApp API not configured',
            sharing_link: paymentLink,
            shared_at: now
          });
      } catch (error: any) {
        console.error('WhatsApp send error:', error);
        results.whatsapp.error = error.message;
      }
    }

    // 4. IN-APP NOTIFICATION
    if (requestedChannels.includes('in_app')) {
      try {
        // Create in-app notification
        const { error: notifError } = await supabase
          .from('notifications')
          .insert({
            user_id: lead.created_by_id || user.id, // Send to customer if user_id available
            title: `Invoice ${invoice.invoice_number} Generated`,
            message: `Your invoice for ${lead.lead_number} is ready. Total: ₹${invoice.total_amount}`,
            type: 'INFO',
            priority: 'HIGH',
            action_url: `/invoices/${invoiceId}`,
            lead_id: lead.id,
            metadata: {
              invoice_id: invoiceId,
              invoice_number: invoice.invoice_number,
              amount: invoice.total_amount,
              payment_link: paymentLink
            }
          });
        
        results.in_app.sent = !notifError;
        if (notifError) {
          results.in_app.error = notifError.message;
        } else {
          await supabase
            .from('invoice_sharing_logs')
            .insert({
              invoice_id: invoiceId,
              shared_by: user.id,
              sharing_method: 'IN_APP',
              sharing_status: 'SENT',
              sharing_link: `/invoices/${invoiceId}`,
              shared_at: now
            });
        }
      } catch (error: any) {
        console.error('In-app notification error:', error);
        results.in_app.error = error.message;
      }
    }

    // Update invoice with sent flags
    const updateData: any = {
      sent_to_customer_at: now,
      status: invoice.status === 'APPROVED' ? 'SENT' : invoice.status
    };

    if (results.email.sent) {
      updateData.sent_via_email = true;
      updateData.email_sent_at = now;
    }
    if (results.sms.sent) {
      updateData.sent_via_sms = true;
      updateData.sms_sent_at = now;
    }
    if (results.whatsapp.sent) {
      updateData.sent_via_whatsapp = true;
      updateData.whatsapp_sent_at = now;
    }

    // Track failures
    const failures = [];
    if (requestedChannels.includes('email') && !results.email.sent) failures.push({ channel: 'email', error: results.email.error });
    if (requestedChannels.includes('sms') && !results.sms.sent) failures.push({ channel: 'sms', error: results.sms.error });
    if (requestedChannels.includes('whatsapp') && !results.whatsapp.sent) failures.push({ channel: 'whatsapp', error: results.whatsapp.error });
    if (requestedChannels.includes('in_app') && !results.in_app.sent) failures.push({ channel: 'in_app', error: results.in_app.error });

    if (failures.length > 0) {
      updateData.send_failures = failures;
    }

    const { data: updatedInvoice } = await supabase
      .from('invoices')
      .update(updateData)
      .eq('id', invoiceId)
      .select()
      .single();

    // Create finance event
    await createFinanceEvent({
      eventType: 'invoice_sent',
      entityType: 'invoice',
      entityId: invoiceId,
      actorId: user.id,
      actorRole: roleCode,
      eventData: {
        invoice_id: invoiceId,
        invoice_number: invoice.invoice_number,
        lead_id: lead.id,
        lead_number: lead.lead_number,
        channels: requestedChannels,
        results,
        payment_link: paymentLink,
        recipient_email: email,
        recipient_phone: phone
      }
    });

    // Create lead event
    await supabase
      .from('lead_events')
      .insert({
        lead_id: lead.id,
        event_type: 'invoice_sent',
        event_description: `Invoice ${invoice.invoice_number} sent via ${requestedChannels.join(', ')}`,
        event_data: {
          invoice_id: invoiceId,
          channels: requestedChannels,
          results
        },
        actor_id: user.id,
        actor_role: roleCode
      });

    const successCount = Object.values(results).filter((r: any) => r.sent).length;
    const totalRequested = requestedChannels.length;

    return NextResponse.json({
      success: successCount > 0,
      message: successCount === totalRequested 
        ? `Invoice sent successfully via all ${totalRequested} channel(s)`
        : successCount > 0
        ? `Invoice sent via ${successCount}/${totalRequested} channel(s). Some failures occurred.`
        : 'Failed to send invoice via any channel',
      invoice: updatedInvoice,
      results,
      payment_link: paymentLink,
      sent_channels: requestedChannels.filter((ch: string) => results[ch]?.sent),
      failed_channels: failures.map(f => f.channel)
    });

  } catch (error: any) {
    console.error('Error sending invoice:', error);
    return NextResponse.json({ 
      error: 'Internal server error',
      details: error.message
    }, { status: 500 });
  }
}

