import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { normalizePhoneNumber } from '@/lib/services/whatsappService';
import { createRsaLeadFromWhatsApp } from './rsaLeadFromWhatsApp';
import { isRsaRelatedMessage } from './rsaIntent';

export async function performWhatsAppHandoff(input: {
  phone: string;
  note: string;
  message?: string;
  profileName?: string | null;
  createRsaLead?: boolean;
}): Promise<{ rsaLeadId: string | null }> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { rsaLeadId: null };

  const phone = normalizePhoneNumber(input.phone);
  const now = new Date().toISOString();

  let rsaLeadId: string | null = null;
  const shouldCreateLead =
    input.createRsaLead !== false &&
    isRsaRelatedMessage(input.message || input.note);

  if (shouldCreateLead) {
    const created = await createRsaLeadFromWhatsApp({
      phone,
      message: input.message || input.note,
      profileName: input.profileName,
      source: 'whatsapp_brain',
    });
    rsaLeadId = created.leadId;
  }

  const assignedNote = rsaLeadId
    ? `${input.note} | RSA lead: ${rsaLeadId}`
    : input.note;
  const noteWithMarker = assignedNote.includes('[CUSTOMER_HUMAN_REQUEST]')
    ? assignedNote
    : `[CUSTOMER_HUMAN_REQUEST] ${assignedNote}`.trim();

  await supabaseAdmin.from('whatsapp_chat_assignments').upsert(
    {
      phone,
      assigned_to_ids: [],
      assigned_note: noteWithMarker,
      assigned_at: now,
      updated_at: now,
    },
    { onConflict: 'phone' },
  );

  return { rsaLeadId };
}
