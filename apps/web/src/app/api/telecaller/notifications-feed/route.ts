import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { visibleWhatsAppText } from '@/lib/whatsapp/visibleMessageText';

export const dynamic = 'force-dynamic';

function last10(phone: string) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { supabaseAdmin } = getSupabaseAdmin();
    const db: any = supabaseAdmin || supabase;
    const profile = await resolveUserProfile(supabase, user, supabaseAdmin);
    const profileId = String(profile?.id || user.id);
    const role = String((profile as { roles?: { role_code?: string } })?.roles?.role_code || '').toUpperCase();
    const telecallerIds = [...new Set([profileId, user.id].filter(Boolean))];

    const nowIso = new Date().toISOString();

    const { data: noteRows } = await db
      .from('notifications')
      .select('id, user_id, title, message, type, priority, is_read, read_at, action_url, lead_number, lead_id, created_at, metadata')
      .in('user_id', telecallerIds)
      .order('created_at', { ascending: false })
      .limit(40);

    const { data: callRows } = await db
      .from('telecaller_call_logs')
      .select('id, phone_number, call_status, created_at, lead:service_leads(customer_name, customer_phone)')
      .in('telecaller_id', telecallerIds)
      .neq('call_status', 'ANSWERED')
      .order('created_at', { ascending: false })
      .limit(40);

    const { data: reminderRows } = await db
      .from('telecaller_follow_ups')
      .select('id, reason, scheduled_time, lead_id, lead:service_leads(customer_name, customer_phone, lead_number)')
      .in('telecaller_id', telecallerIds)
      .eq('status', 'PENDING')
      .lt('scheduled_time', nowIso)
      .order('scheduled_time', { ascending: false })
      .limit(40);

    let whatsapp: Array<{ id: string; phone: string; name: string; text: string; created_at: string }> = [];
    if (role === 'TELECALLER' || role === 'LEAD_MANAGER' || role === 'SUPER_ADMIN' || role === 'SUB_ADMIN') {
      let allowed: Set<string> | null = null;
      if (role === 'TELECALLER') {
        const { data: leads } = await db
          .from('service_leads')
          .select('customer_phone')
          .eq('assigned_telecaller_id', profileId)
          .is('deleted_at', null)
          .order('updated_at', { ascending: false })
          .limit(400);
        allowed = new Set(
          (leads || []).map((row: { customer_phone?: string }) => last10(String(row.customer_phone || ''))).filter((p: string) => p.length === 10),
        );
      }
      const { data: waRows } = await db
        .from('whatsapp_messages')
        .select('id, sender_phone, text_body, media_caption, template_name, message_type, payload, meta, created_at')
        .eq('direction', 'INBOUND')
        .order('created_at', { ascending: false })
        .limit(80);
      const rows = (waRows || []).filter((row: { sender_phone?: string; meta?: { seeded_from_lead?: boolean } }) => {
        if (row?.meta?.seeded_from_lead) return false;
        const phone = last10(String(row.sender_phone || ''));
        if (phone.length !== 10) return false;
        if (allowed && !allowed.has(phone)) return false;
        return true;
      });
      const phones = [...new Set(rows.map((row: { sender_phone?: string }) => last10(String(row.sender_phone || ''))))].slice(0, 40);
      const nameByPhone = new Map<string, string>();
      if (phones.length) {
        const { data: leads } = await db
          .from('service_leads')
          .select('customer_name, customer_phone')
          .or(phones.map((p) => `customer_phone.ilike.%${p}`).join(','))
          .limit(80);
        for (const lead of leads || []) {
          const key = last10(String(lead.customer_phone || ''));
          if (key && !nameByPhone.has(key)) nameByPhone.set(key, String(lead.customer_name || '').trim());
        }
      }
      whatsapp = rows.slice(0, 40).map((row: any) => {
        const phone = last10(String(row.sender_phone || ''));
        return {
          id: String(row.id),
          phone,
          name: nameByPhone.get(phone) || phone,
          text: visibleWhatsAppText(row) || 'Message',
          created_at: row.created_at,
        };
      });
    }

    return NextResponse.json({
      notifications: noteRows || [],
      calls: (callRows || []).map((row: any) => ({
        id: row.id,
        phone: row.lead?.customer_phone || row.phone_number || '',
        name: row.lead?.customer_name || row.phone_number || 'Missed call',
        status: row.call_status || 'MISSED',
        created_at: row.created_at,
      })),
      reminders: (reminderRows || []).map((row: any) => ({
        id: row.id,
        lead_id: row.lead_id,
        name: row.lead?.customer_name || 'Missed reminder',
        reason: row.reason || 'Follow-up overdue',
        phone: row.lead?.customer_phone || '',
        scheduled_time: row.scheduled_time,
      })),
      whatsapp,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Failed' }, { status: 500 });
  }
}
