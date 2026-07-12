import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';
import { isRsaRelatedMessage } from './rsaIntent';

function contactFromPhone(phone: string): string {
  const digits = normalizePhoneNumber(phone).replace(/\D/g, '');
  return digits.slice(-10);
}

function extractPincode(message: string): string | null {
  const match = String(message || '').match(/\b(\d{6})\b/);
  return match?.[1] || null;
}

function inferServiceType(message: string): string {
  const text = String(message || '').toLowerCase();
  if (/\b(tow|towing|towting)\b/.test(text) || /\bcar\s+tow/.test(text)) return 'towing';
  if (/\b(battery|jump)\b/.test(text)) return 'battery jump-start';
  if (/\b(flat|tyre|tire)\b/.test(text)) return 'flat tyre';
  if (/\b(fuel)\b/.test(text)) return 'fuel delivery';
  if (/\b(lockout|key)\b/.test(text)) return 'key lockout';
  return 'roadside assistance';
}

export async function createRsaLeadFromWhatsApp(input: {
  phone: string;
  message: string;
  profileName?: string | null;
  source?: string;
}): Promise<{ leadId: string | null; skippedReason?: string }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { leadId: null, skippedReason: 'admin_unavailable' };

  const phone = normalizePhoneNumber(input.phone);
  const contactNumber = contactFromPhone(phone);
  if (contactNumber.length !== 10) {
    return { leadId: null, skippedReason: 'invalid_phone' };
  }

  if (!isRsaRelatedMessage(input.message)) {
    return { leadId: null, skippedReason: 'not_rsa_message' };
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const { data: recent } = await supabaseAdmin
    .from('rsa_leads')
    .select('id')
    .eq('contact_number', contactNumber)
    .eq('source', input.source || 'whatsapp_brain')
    .gte('lead_registered_at', oneHourAgo)
    .order('lead_registered_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (recent?.id) {
    return { leadId: String(recent.id), skippedReason: 'duplicate_recent_lead' };
  }

  const now = new Date().toISOString();
  const customerName = String(input.profileName || 'WhatsApp Customer').trim().slice(0, 120);
  const problem = String(input.message || '').trim().slice(0, 2000);

  const { data: lead, error } = await supabaseAdmin
    .from('rsa_leads')
    .insert({
      customer_name: customerName,
      contact_number: contactNumber,
      service_type: inferServiceType(input.message),
      source: input.source || 'whatsapp_brain',
      problem,
      description: problem,
      pincode: extractPincode(input.message),
      lead_status: 'pending',
      complaint_status: 'registered',
      registered_by_name: 'MISA WhatsApp Brain',
      lead_registered_at: now,
      register_datetime: now,
      requested_at: now,
      updated_at: now,
      delete_status: false,
      remark: 'Auto-created from WhatsApp RSA / handoff',
    })
    .select('id')
    .single();

  if (error || !lead?.id) {
    return { leadId: null, skippedReason: error?.message || 'insert_failed' };
  }

  try {
    await supabaseAdmin.from('rsa_lead_timeline').insert({
      lead_id: lead.id,
      status: 'registered',
      status_description: 'RSA lead auto-created from WhatsApp',
      created_at: now,
    });
  } catch {
    // timeline table optional
  }

  return { leadId: String(lead.id) };
}
