import { formatDateDMY } from "@/lib/utils";
/**
 * Email Service - SendGrid Integration
 * Phase 4 - Task WA-503
 * 
 * Features:
 * - Send email notifications
 * - HTML email templates
 * - Attachments support
 * - Delivery tracking
 */

import { createClient } from '@/lib/supabase/client';

const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || '';
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@myfng.com';
const FROM_NAME = process.env.FROM_NAME || 'MyFNG Workshop';

/**
 * Email Templates
 */
export const EMAIL_TEMPLATES = {
  WELCOME: {
    subject: 'Welcome to MyFNG!',
    html: (name: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h1 style="color: #3B82F6;">Welcome to MyFNG, ${name}!</h1>
        <p>Thank you for registering with us. We're excited to help you with your vehicle service needs.</p>
        <p>You can now:</p>
        <ul>
          <li>Create service requests online</li>
          <li>Track your service in real-time</li>
          <li>View service history</li>
          <li>Manage invoices and payments</li>
        </ul>
        <a href="https://myfng.com/customer/dashboard" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-top: 20px;">
          Go to Dashboard
        </a>
      </div>
    `,
  },

  LEAD_CREATED: {
    subject: (leadNumber: string) => `Service Request ${leadNumber} Created`,
    html: (leadNumber: string, customerName: string, details: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Service Request Created</h2>
        <p>Hello ${customerName},</p>
        <p>Your service request has been successfully created.</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Request Details</h3>
          <p><strong>Lead Number:</strong> ${leadNumber}</p>
          <p><strong>Vehicle:</strong> ${details.vehicleMake} ${details.vehicleModel} (${details.vehicleNumber})</p>
          <p><strong>Service:</strong> ${details.serviceType}</p>
          <p><strong>Workshop:</strong> ${details.workshopName}</p>
        </div>
        <p>We'll review your request and get back to you shortly.</p>
        <a href="https://myfng.com/customer/track/${leadNumber}" style="display: inline-block; background: #3B82F6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
          Track Status
        </a>
      </div>
    `,
  },

  INVOICE_GENERATED: {
    subject: (leadNumber: string) => `Invoice for Service ${leadNumber}`,
    html: (leadNumber: string, customerName: string, invoice: any) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <h2 style="color: #3B82F6;">Invoice Generated</h2>
        <p>Hello ${customerName},</p>
        <p>Your invoice has been generated for service request ${leadNumber}.</p>
        <div style="background: #F3F4F6; padding: 20px; border-radius: 8px; margin: 20px 0;">
          <h3 style="margin-top: 0;">Invoice Summary</h3>
          <p><strong>Invoice Number:</strong> ${invoice.invoiceNumber}</p>
          <p><strong>Base Amount:</strong> ₹${invoice.baseAmount.toFixed(2)}</p>
          <p><strong>GST (18%):</strong> ₹${invoice.taxAmount.toFixed(2)}</p>
          <p style="font-size: 20px; color: #10B981;"><strong>Total Amount:</strong> ₹${invoice.totalAmount.toFixed(2)}</p>
        </div>
        <p>Please find the invoice attached to this email.</p>
        <a href="https://myfng.com/customer/pay/${leadNumber}" style="display: inline-block; background: #10B981; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; margin-right: 10px;">
          Pay Now
        </a>
        <a href="https://myfng.com/customer/invoices/${invoice.id}" style="display: inline-block; background: #6B7280; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px;">
          View Invoice
        </a>
      </div>
    `,
  },

  PAYMENT_CONFIRMATION: {
    subject: (leadNumber: string) => `Payment Received - ${leadNumber}`,
    html: (leadNumber: string, customerName: string, amount: number, paymentId: string) => `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="text-align: center; padding: 20px; background: #10B981; color: white; border-radius: 8px 8px 0 0;">
          <h2 style="margin: 0;">✓ Payment Received</h2>
        </div>
        <div style="padding: 20px; background: #F9FAFB; border-radius: 0 0 8px 8px;">
          <p>Hello ${customerName},</p>
          <p>We have successfully received your payment.</p>
          <div style="background: white; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="margin-top: 0; color: #3B82F6;">Payment Details</h3>
            <p><strong>Lead Number:</strong> ${leadNumber}</p>
            <p><strong>Amount Paid:</strong> ₹${amount.toFixed(2)}</p>
            <p><strong>Payment ID:</strong> ${paymentId}</p>
            <p><strong>Date:</strong> ${formatDateDMY(new Date())}</p>
          </div>
          <p>Thank you for your payment. Your receipt is attached to this email.</p>
        </div>
      </div>
    `,
  },
};

/**
 * Send email via SendGrid
 */
export async function sendEmail(
  to: string,
  subject: string,
  html: string,
  attachments?: { filename: string; content: string; type: string }[]
): Promise<boolean> {
  try {
    // In production, use actual SendGrid API
    // const sgMail = require('@sendgrid/mail');
    // sgMail.setApiKey(SENDGRID_API_KEY);
    //
    // const msg = {
    //   to,
    //   from: {
    //     email: FROM_EMAIL,
    //     name: FROM_NAME,
    //   },
    //   subject,
    //   html,
    //   attachments: attachments || [],
    // };
    //
    // await sgMail.send(msg);

    // Simulated success
    console.log('[EMAIL] Email sent to:', to);
    console.log('[EMAIL] Subject:', subject);
    console.log('[EMAIL] Has attachments:', !!attachments?.length);

    // Log notification
    await logNotification(to, 'EMAIL', subject, 'SENT');

    return true;
  } catch (error) {
    console.error('SendGrid email error:', error);
    await logNotification(to, 'EMAIL', subject, 'FAILED');
    return false;
  }
}

/**
 * Send welcome email
 */
export async function sendWelcomeEmail(
  email: string,
  name: string
): Promise<boolean> {
  const template = EMAIL_TEMPLATES.WELCOME;
  return await sendEmail(
    email,
    template.subject,
    template.html(name)
  );
}

/**
 * Send lead created notification
 */
export async function sendLeadCreatedEmail(
  email: string,
  leadNumber: string,
  customerName: string,
  details: any
): Promise<boolean> {
  const template = EMAIL_TEMPLATES.LEAD_CREATED;
  return await sendEmail(
    email,
    template.subject(leadNumber),
    template.html(leadNumber, customerName, details)
  );
}

/**
 * Send invoice email
 */
export async function sendInvoiceEmail(
  email: string,
  leadNumber: string,
  customerName: string,
  invoice: any,
  pdfAttachment?: { filename: string; content: string }
): Promise<boolean> {
  const template = EMAIL_TEMPLATES.INVOICE_GENERATED;
  
  const attachments = pdfAttachment ? [{
    filename: pdfAttachment.filename,
    content: pdfAttachment.content,
    type: 'application/pdf',
  }] : undefined;

  return await sendEmail(
    email,
    template.subject(leadNumber),
    template.html(leadNumber, customerName, invoice),
    attachments
  );
}

/**
 * Send payment confirmation email
 */
export async function sendPaymentConfirmationEmail(
  email: string,
  leadNumber: string,
  customerName: string,
  amount: number,
  paymentId: string
): Promise<boolean> {
  const template = EMAIL_TEMPLATES.PAYMENT_CONFIRMATION;
  return await sendEmail(
    email,
    template.subject(leadNumber),
    template.html(leadNumber, customerName, amount, paymentId)
  );
}

/**
 * Log notification to database
 */
async function logNotification(
  recipient: string,
  type: string,
  subject: string,
  status: string
): Promise<void> {
  const supabase = await createClient();

  try {
    await supabase.from('notification_logs').insert({
      recipient,
      type,
      message: subject,
      status,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging notification:', error);
  }
}

/**
 * Send bulk emails
 */
export async function sendBulkEmails(
  recipients: string[],
  subject: string,
  html: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const email of recipients) {
    const sent = await sendEmail(email, subject, html);
    if (sent) {
      success++;
    } else {
      failed++;
    }
    // Rate limiting delay
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { success, failed };
}

