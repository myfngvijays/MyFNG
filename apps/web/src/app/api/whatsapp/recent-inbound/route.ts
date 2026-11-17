import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

function last10(phone: string) {
  return String(phone || '').replace(/\D/g, '').slice(-10);
}

async function profileOf(supabase: any, user: { id: string; email?: string | null; phone?: string | null }) {
  const email = String(user.email || '').trim();
  const select = 'id, roles!inner(role_code)';
  const { data: byId } = await supabase.from('users_login').select(select).eq('id', user.id).maybeSingle();
  if (byId?.id) return byId;
  if (email) {
    const { data } = await supabase.from('users_login').select(select).ilike('email', email).maybeSingle();
    if (data?.id) return data;
  }
  return null;
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const profile = await profileOf(supabase, user);
    if (!profile?.id) return NextResponse.json({ error: 'Profile not found' }, { status: 404 });

    const role = String((profile as any)?.roles?.role_code || '').toUpperCase();
    const { supabaseAdmin } = getSupabaseAdmin();
    const db: any = supabaseAdmin || supabase;

    let allowed: Set<string> | null = null;
    if (role === 'TELECALLER') {
      const { data: leads } = await db
        .from('service_leads')
        .select('customer_name, customer_phone')
        .eq('assigned_telecaller_id', profile.id)
        .is('deleted_at', null)
        .order('updated_at', { ascending: false })
        .limit(400);
      allowed = new Set((leads || []).map((row: any) => last10(row.customer_phone)).filter((p: string) => p.length === 10));
    }

    const { data, error } = await db
      .from('whatsapp_messages')
      .select('id, sender_phone, text_body, media_caption, message_type, created_at, meta')
      .eq('direction', 'INBOUND')
      .order('created_at', { ascending: false })
      .limit(80);
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });

    const rows = (data || []).filter((row: any) => {
      if (row?.meta?.seeded_from_lead) return false;
      const phone = last10(row.sender_phone);
      if (phone.length !== 10) return false;
      if (allowed && !allowed.has(phone)) return false;
      return true;
    });

    const phones = [...new Set(rows.map((row: any) => last10(row.sender_phone)))].slice(0, 40);
    const nameByPhone = new Map<string, string>();
    if (phones.length) {
      const or = phones.map((p) => `customer_phone.ilike.%${p}`).join(',');
      const { data: leads } = await db
        .from('service_leads')
        .select('customer_name, customer_phone')
        .or(or)
        .limit(80);
      for (const lead of leads || []) {
        const key = last10(lead.customer_phone);
        if (key && !nameByPhone.has(key)) nameByPhone.set(key, String(lead.customer_name || '').trim());
      }
    }

    const messages = rows.slice(0, 40).map((row: any) => {
      const phone = last10(row.sender_phone);
      const type = String(row.message_type || 'TEXT').toUpperCase();
      const text =
        String(row.text_body || '').trim() ||
        String(row.media_caption || '').trim() ||
        (type === 'IMAGE' ? 'Photo' : type === 'VIDEO' ? 'Video' : type === 'AUDIO' ? 'Audio' : type === 'DOCUMENT' ? 'Document' : 'Message');
      return {
        id: row.id,
        phone,
        name: nameByPhone.get(phone) || phone,
        text,
        message_type: type,
        created_at: row.created_at,
      };
    });

    return NextResponse.json({ messages });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
