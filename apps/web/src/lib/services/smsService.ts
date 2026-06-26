/**
 * SMS Service - Twilio Integration
 * Phase 4 - Task WA-502
 *
 * Features:
 * - Send SMS notifications
 * - Template-based messaging
 * - Delivery tracking
 * - Error handling
 *
 * Login OTP uses Firebase Phone Auth on mobile — not server SMS.
 */

import { createClient } from '@/lib/supabase/client';

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID || '';
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN || '';
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER || '';

/**
 * SMS Templates
 */
export const SMS_TEMPLATES = {
  LEAD_CREATED: (leadNumber: string, workshopName: string) =>
    `Your service request ${leadNumber} has been created. ${workshopName} will review it shortly. Track: myfng.com/track/${leadNumber}`,

  LEAD_ACCEPTED: (leadNumber: string, workshopName: string) =>
    `Great news! ${workshopName} has accepted your service request ${leadNumber}. We'll assign a mechanic soon.`,

  MECHANIC_ASSIGNED: (leadNumber: string, mechanicName: string) =>
    `Mechanic ${mechanicName} has been assigned to your service ${leadNumber}. They will contact you soon.`,

  WORK_STARTED: (leadNumber: string) =>
    `Work has started on your vehicle ${leadNumber}. You'll receive updates as we progress.`,

  EXTRA_CHARGES: (leadNumber: string, amount: number) =>
    `Additional work required for ${leadNumber}. Amount: ₹${amount}. Please approve to proceed.`,

  READY_FOR_DELIVERY: (leadNumber: string) =>
    `Your vehicle ${leadNumber} is ready for delivery! Contact workshop to arrange pickup.`,

  INVOICE_GENERATED: (leadNumber: string, amount: number) =>
    `Invoice generated for ${leadNumber}. Total: ₹${amount}. Pay online: myfng.com/pay/${leadNumber}`,

  PAYMENT_RECEIVED: (leadNumber: string, amount: number) =>
    `Payment of ₹${amount} received for ${leadNumber}. Thank you!`,

  OTP_VERIFICATION: (otp: string) =>
    `Your MyFNG verification code is: ${otp}. Valid for 10 minutes. Do not share with anyone.`,
};

/**
 * Send SMS via Twilio
 */
async function sendViaTwilio(phone: string, message: string): Promise<boolean> {
  if (!TWILIO_ACCOUNT_SID || !TWILIO_AUTH_TOKEN || !TWILIO_PHONE_NUMBER) {
    console.error('[SMS] Twilio credentials are not configured');
    return false;
  }

  try {
    const params = new URLSearchParams({
      To: phone.startsWith('+') ? phone : `+${phone.replace(/\D/g, '')}`,
      From: TWILIO_PHONE_NUMBER,
      Body: message,
    });
    const authHeader = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString('base64');
    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );
    if (!response.ok) {
      const errorText = await response.text().catch(() => '');
      console.error('[SMS] Twilio send failed:', errorText);
      return false;
    }
    return true;
  } catch (error) {
    console.error('Twilio SMS error:', error);
    return false;
  }
}

/**
 * Send SMS via Twilio
 */
export async function sendSMS(
  phone: string,
  message: string,
  templateId?: string
): Promise<boolean> {
  try {
    const cleanPhone = phone.replace(/\D/g, '');
    if (cleanPhone.length !== 10 || !/^[6-9]/.test(cleanPhone)) {
      console.error('Invalid phone number:', phone);
      return false;
    }

    const fullPhone = `+91${cleanPhone}`;
    const success = await sendViaTwilio(fullPhone, message);

    await logNotification(fullPhone, 'SMS', message, success ? 'SENT' : 'FAILED');

    return success;
  } catch (error) {
    console.error('Error sending SMS:', error);
    return false;
  }
}

/**
 * Send lead notification
 */
export async function sendLeadNotification(
  phone: string,
  eventType: string,
  leadNumber: string,
  additionalData?: any
): Promise<boolean> {
  let message = '';

  switch (eventType) {
    case 'LEAD_CREATED':
      message = SMS_TEMPLATES.LEAD_CREATED(leadNumber, additionalData?.workshopName || 'Workshop');
      break;
    case 'LEAD_ACCEPTED':
      message = SMS_TEMPLATES.LEAD_ACCEPTED(leadNumber, additionalData?.workshopName || 'Workshop');
      break;
    case 'MECHANIC_ASSIGNED':
      message = SMS_TEMPLATES.MECHANIC_ASSIGNED(leadNumber, additionalData?.mechanicName || 'Mechanic');
      break;
    case 'WORK_STARTED':
      message = SMS_TEMPLATES.WORK_STARTED(leadNumber);
      break;
    case 'EXTRA_CHARGES':
      message = SMS_TEMPLATES.EXTRA_CHARGES(leadNumber, additionalData?.amount || 0);
      break;
    case 'READY_FOR_DELIVERY':
      message = SMS_TEMPLATES.READY_FOR_DELIVERY(leadNumber);
      break;
    case 'INVOICE_GENERATED':
      message = SMS_TEMPLATES.INVOICE_GENERATED(leadNumber, additionalData?.amount || 0);
      break;
    case 'PAYMENT_RECEIVED':
      message = SMS_TEMPLATES.PAYMENT_RECEIVED(leadNumber, additionalData?.amount || 0);
      break;
    default:
      console.error('Unknown event type:', eventType);
      return false;
  }

  return await sendSMS(phone, message, eventType);
}

/**
 * Log notification to database
 */
async function logNotification(
  recipient: string,
  type: string,
  message: string,
  status: string
): Promise<void> {
  const supabase = await createClient();

  try {
    await supabase.from('notification_logs').insert({
      recipient,
      type,
      message,
      status,
      sent_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error logging notification:', error);
  }
}

/**
 * Send bulk SMS
 */
export async function sendBulkSMS(
  recipients: string[],
  message: string
): Promise<{ success: number; failed: number }> {
  let success = 0;
  let failed = 0;

  for (const phone of recipients) {
    const sent = await sendSMS(phone, message);
    if (sent) {
      success++;
    } else {
      failed++;
    }
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  return { success, failed };
}
