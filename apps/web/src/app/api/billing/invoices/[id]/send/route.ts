/**
 * Send Invoice to Customer API
 * Step 5: Share Invoice with Customer - WhatsApp/SMS/Email
 */

import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { sendInvoiceEmail } from '@/lib/services/emailService';
import { sendSMS } from '@/lib/services/smsService';
import { sendInvoiceViaWhatsApp } from '@/lib/services/whatsappService';
import { createShortUrl } from '@/lib/services/urlShortener';
import { createFinanceEvent } from '@/lib/services/financeEventService';
import { createNotification, notifyWorkshopAdmin } from '@/lib/notifications';

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

    // Robust profile lookup (email/phone/id) + role_code (no dedicated billing role required)
    const email = (user.email || '').trim();
    const phone = (user.phone || '').trim();
    const selectProfile = 'id, email, phone, workshop_id, full_name, roles!inner(role_code)';

    const { data: byEmail } = email
      ? await supabase.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
      : { data: null };
    const { data: byPhone } = !byEmail && phone
      ? await supabase.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
      : { data: null };
    const { data: byId } = !byEmail && !byPhone
      ? await supabase.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
      : { data: null };

    const userProfile: any = byEmail || byPhone || byId;
    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const allowedRoleCodes = ['SUPER_ADMIN', 'SUB_ADMIN', 'WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR'];
    if (!allowedRoleCodes.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions', role: roleCode }, { status: 403 });
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
          lead_number,
          workshop_id,
          assigned_supervisor_id,
          status,
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

    // NEW FLOW: Never send Tax Invoice publicly before/without explicit request
    if ((invoice as any).invoice_type === 'TAX_INVOICE') {
      return NextResponse.json(
        {
          error: 'Tax Invoice cannot be sent publicly from this endpoint',
          hint: 'Tax Invoice is generated after payment and is only downloadable in customer app unless requested.',
        },
        { status: 400 }
      );
    }

    // Prevent sending invoices after lead closure/archival
    if ((invoice.lead as any)?.read_only) {
      return NextResponse.json({ error: 'Lead is archived/read-only' }, { status: 400 });
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
    const sendFailures: any[] = [];

    // Generate short URL first
    const invoiceLink = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/invoice/${invoice.invoice_number}`;
    const { shortUrl } = await createShortUrl(invoiceLink, 'invoice', invoiceId);
    
    // Persist a printable invoice document and use it for sharing/attachments when possible
    let documentUrl = (invoice as any).document_url as string | undefined;
    if (!documentUrl) {
      try {
        const persistRes = await fetch(
          `${request.nextUrl.origin}/api/billing/invoices/${invoiceId}/persist-document`,
          { method: 'POST' }
        );
        if (persistRes.ok) {
          const persisted = await persistRes.json();
          documentUrl = persisted.document_url;
        }
      } catch (e) {
        // Non-fatal: fallback to generator endpoint
      }
    }

    // Fallback generator (HTML)
    const pdfUrl = documentUrl || `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/billing/invoices/${invoiceId}/generate-pdf`;

    // Helper function to record send failure
    const recordFailure = (method: string, error: string) => {
      sendFailures.push({
        method,
        error,
        attempted_at: new Date().toISOString(),
      });
    };

    // Helper function to retry sending
    const retrySend = async (
      sendFn: () => Promise<{ success: boolean; error?: string }>,
      method: string,
      maxRetries: number = 3
    ): Promise<{ success: boolean; error?: string }> => {
      let lastError: string | undefined;
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          const result = await sendFn();
          if (result.success) {
            return result;
          }
          lastError = result.error;
          if (attempt < maxRetries) {
            // Wait before retry (exponential backoff)
            await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
          }
        } catch (error: any) {
          lastError = error.message;
        }
      }
      recordFailure(method, lastError || 'Failed after retries');
      return { success: false, error: lastError };
    };

    // Send via Email
    if (methods.includes('EMAIL') && invoice.lead?.customer_email) {
      try {
        // Fetch invoice document for attachment (currently HTML)
        const pdfResponse = await fetch(pdfUrl);
        let pdfAttachment: { filename: string; content: string } | undefined;
        
        if (pdfResponse.ok) {
          const pdfBlob = await pdfResponse.blob();
          const pdfBase64 = Buffer.from(await pdfBlob.arrayBuffer()).toString('base64');
          pdfAttachment = {
            filename: `Invoice-${invoice.invoice_number}.html`,
            content: pdfBase64,
          };
        }

        const emailResult = await retrySend(
          async () => {
            const sent = await sendInvoiceEmail(
              invoice.lead.customer_email,
              invoice.lead.id,
              invoice.lead.customer_name,
              invoice,
              pdfAttachment
            );
            return { success: sent, error: sent ? undefined : 'Failed to send email' };
          },
          'EMAIL'
        );

        if (emailResult.success) {
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
              sharing_link: shortUrl,
              shared_at: now,
            });

          results.email = { success: true, message: 'Email sent successfully' };
        } else {
          results.email = { success: false, message: emailResult.error || 'Failed to send email' };
        }
      } catch (error: any) {
        recordFailure('EMAIL', error.message);
        results.email = { success: false, message: error.message };
      }
    }

    // Send via SMS
    if (methods.includes('SMS') && invoice.lead?.customer_phone) {
      try {
        const smsMessage = `Invoice ${invoice.invoice_number} generated. Amount: ₹${invoice.final_amount.toFixed(2)}. View & Pay: ${shortUrl}`;
        
        const smsResult = await retrySend(
          async () => {
            const sent = await sendSMS(invoice.lead.customer_phone, smsMessage);
            return { success: sent, error: sent ? undefined : 'Failed to send SMS' };
          },
          'SMS'
        );

        if (smsResult.success) {
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
              sharing_link: shortUrl,
              shared_at: now,
            });

          results.sms = { success: true, message: 'SMS sent successfully' };
        } else {
          results.sms = { success: false, message: smsResult.error || 'Failed to send SMS' };
        }
      } catch (error: any) {
        recordFailure('SMS', error.message);
        results.sms = { success: false, message: error.message };
      }
    }

    // Send via WhatsApp
    if (methods.includes('WHATSAPP') && invoice.lead?.customer_phone) {
      try {
        const whatsappResult = await retrySend(
          async () => {
            const result = await sendInvoiceViaWhatsApp(
              invoice.lead.customer_phone,
              invoice.invoice_number,
              invoice.final_amount,
              shortUrl,
              pdfUrl
            );
            return result;
          },
          'WHATSAPP'
        );

        if (whatsappResult.success) {
          await supabase
            .from('invoices')
            .update({
              sent_via_whatsapp: true,
              whatsapp_sent_at: now,
              status: invoice.status === 'GENERATED' ? 'SENT' : invoice.status,
              updated_at: now,
            })
            .eq('id', invoiceId);

          await supabase
            .from('invoice_sharing_logs')
            .insert({
              invoice_id: invoiceId,
              shared_by: userProfile.id,
              sharing_method: 'WHATSAPP',
              recipient_phone: invoice.lead.customer_phone,
              sharing_status: 'SENT',
              sharing_link: shortUrl,
              shared_at: now,
            });

          const whatsappResponse: { success: boolean; message: string; messageId?: string } = { 
            success: true, 
            message: 'WhatsApp message sent successfully',
          };
          if ('messageId' in whatsappResult) {
            whatsappResponse.messageId = (whatsappResult as any).messageId;
          }
          results.whatsapp = whatsappResponse;
        } else {
          results.whatsapp = { 
            success: false, 
            message: whatsappResult.error || 'Failed to send WhatsApp message' 
          };
        }
      } catch (error: any) {
        recordFailure('WHATSAPP', error.message);
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

    // Update invoice with send_failures if any
    if (sendFailures.length > 0) {
      const currentFailures = invoice.send_failures || [];
      await supabase
        .from('invoices')
        .update({
          send_failures: [...currentFailures, ...sendFailures],
          updated_at: now,
        })
        .eq('id', invoiceId);
    }

    // Update lead status if invoice sent successfully
    const hasSuccess = Object.values(results).some((r: any) => r.success);
    if (invoice.lead_id && hasSuccess) {
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
            short_url: shortUrl,
          },
        });

      // Create finance event
      await createFinanceEvent({
        eventType: 'invoice_sent',
        entityType: 'invoice',
        entityId: invoiceId,
        actorId: userProfile.id,
        actorRole: userProfile.role,
        actorName: userProfile.name,
        eventData: {
          invoice_number: invoice.invoice_number,
          sharing_methods: methods,
          results: results,
          short_url: shortUrl,
        },
        ipAddress: request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip') || undefined,
        userAgent: request.headers.get('user-agent') || undefined,
      });

      // In-app notifications (no WhatsApp dependency)
      try {
        const lead = invoice.lead as any;
        if (lead?.workshop_id) {
          await notifyWorkshopAdmin(
            lead.workshop_id,
            invoice.lead_id,
            lead.lead_number || invoice.lead_id,
            userProfile.name || 'Billing'
          );
        }
        if (lead?.assigned_supervisor_id) {
          await createNotification({
            userId: lead.assigned_supervisor_id,
            type: 'INVOICE_SENT',
            title: 'Invoice Sent to Customer',
            message: `Invoice ${invoice.invoice_number} sent to customer. Status: AWAITING_PAYMENT.`,
            priority: 'MEDIUM',
            leadId: invoice.lead_id,
            leadNumber: lead?.lead_number,
            actionUrl: `/dashboard/workshop_supervisor/jobs/${invoice.lead_id}`,
            metadata: { invoice_id: invoiceId, methods },
          });
        }
      } catch (e) {
        console.warn('Notification dispatch failed (non-blocking):', e);
      }
    }

    // Create lead_event entries
    if (invoice.lead_id) {
      for (const method of methods) {
        const result = results[method.toLowerCase()];
        if (result?.success) {
          await supabase
            .from('lead_events')
            .insert({
              lead_id: invoice.lead_id,
              event_type: `invoice_sent_${method.toLowerCase()}`,
              event_data: {
                invoice_id: invoiceId,
                invoice_number: invoice.invoice_number,
                method: method,
                short_url: shortUrl,
                timestamp: now,
              },
              created_at: now,
            });
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: hasSuccess ? 'Invoice sharing completed' : 'Invoice sharing completed with some failures',
      results: results,
      short_url: shortUrl,
      send_failures: sendFailures.length > 0 ? sendFailures : undefined,
      next_step: hasSuccess ? 'Awaiting customer payment' : 'Some sharing methods failed. Please retry.',
    }, { status: 200 });

  } catch (error) {
    console.error('Error in send invoice API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

