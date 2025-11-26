/**
 * WhatsApp Business API Service
 * Phase 1.2 - Invoice Sharing
 * Purpose: Send invoices via WhatsApp Business API
 */

import { createClient } from '@/lib/supabase/client';

// WhatsApp Configuration
const WHATSAPP_API_URL = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v18.0';
const WHATSAPP_PHONE_NUMBER_ID = process.env.WHATSAPP_PHONE_NUMBER_ID || '';
const WHATSAPP_ACCESS_TOKEN = process.env.WHATSAPP_ACCESS_TOKEN || '';
const WHATSAPP_BUSINESS_ACCOUNT_ID = process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '';

/**
 * Send WhatsApp message
 */
export async function sendWhatsAppMessage(
  phoneNumber: string,
  message: string,
  templateName?: string,
  templateParams?: string[]
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    // Clean phone number (remove +, spaces, etc.)
    const cleanPhone = phoneNumber.replace(/\D/g, '');
    
    // Add country code if not present
    const fullPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

    // If template is provided, use template message
    if (templateName && templateParams) {
      const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: fullPhone,
          type: 'template',
          template: {
            name: templateName,
            language: { code: 'en' },
            components: templateParams.map((param, index) => ({
              type: 'body',
              parameters: [{ type: 'text', text: param }],
            })),
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('WhatsApp API Error:', errorData);
        return { success: false, error: errorData.error?.message || 'Failed to send WhatsApp message' };
      }

      const data = await response.json();
      return { success: true, messageId: data.messages?.[0]?.id };
    } else {
      // Send text message
      const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: fullPhone,
          type: 'text',
          text: { body: message },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('WhatsApp API Error:', errorData);
        return { success: false, error: errorData.error?.message || 'Failed to send WhatsApp message' };
      }

      const data = await response.json();
      return { success: true, messageId: data.messages?.[0]?.id };
    }
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Send invoice via WhatsApp with media
 */
export async function sendInvoiceViaWhatsApp(
  phoneNumber: string,
  invoiceNumber: string,
  amount: number,
  invoiceLink: string,
  pdfUrl?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  try {
    const message = `📄 *Invoice ${invoiceNumber}*\n\n` +
      `Amount: ₹${amount.toFixed(2)}\n\n` +
      `View & Pay: ${invoiceLink}\n\n` +
      `Thank you for your business!`;

    // If PDF URL is provided, send as document
    if (pdfUrl) {
      const cleanPhone = phoneNumber.replace(/\D/g, '');
      const fullPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

      const response = await fetch(`${WHATSAPP_API_URL}/${WHATSAPP_PHONE_NUMBER_ID}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to: fullPhone,
          type: 'document',
          document: {
            link: pdfUrl,
            filename: `Invoice-${invoiceNumber}.pdf`,
            caption: message,
          },
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        return { success: false, error: errorData.error?.message || 'Failed to send WhatsApp document' };
      }

      const data = await response.json();
      return { success: true, messageId: data.messages?.[0]?.id };
    } else {
      // Send text message with link
      return await sendWhatsAppMessage(phoneNumber, message);
    }
  } catch (error: any) {
    console.error('Error sending invoice via WhatsApp:', error);
    return { success: false, error: error.message };
  }
}

/**
 * Check WhatsApp message status
 */
export async function checkWhatsAppMessageStatus(messageId: string): Promise<{
  status: string;
  delivered_at?: string;
  read_at?: string;
}> {
  try {
    const response = await fetch(`${WHATSAPP_API_URL}/${messageId}`, {
      headers: {
        'Authorization': `Bearer ${WHATSAPP_ACCESS_TOKEN}`,
      },
    });

    if (!response.ok) {
      throw new Error('Failed to check message status');
    }

    const data = await response.json();
    return {
      status: data.status || 'unknown',
      delivered_at: data.delivered_at,
      read_at: data.read_at,
    };
  } catch (error: any) {
    console.error('Error checking WhatsApp message status:', error);
    return { status: 'error' };
  }
}

