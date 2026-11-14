import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { DEFAULT_WHATSAPP_PHONE } from '@/lib/whatsapp/accountSelection';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();
  const role = String((profile as any)?.roles?.role_code || '').toUpperCase();
  if (!profile || !ALLOWED_ROLES.includes(role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const settings = {
    id: 'settings',
    label: 'My FNG Autocare',
    display_phone: DEFAULT_WHATSAPP_PHONE,
    verified_name: 'My FNG Autocare',
    source: 'settings',
    quality_rating: '',
    is_active: false,
    phone_number_id: String(process.env.WHATSAPP_PHONE_NUMBER_ID || '').replace(/\D/g, ''),
    waba_id: String(process.env.WHATSAPP_BUSINESS_ACCOUNT_ID || '').replace(/\D/g, ''),
  };

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return NextResponse.json({ accounts: [settings] });

  const saved = await supabaseAdmin
    .from('wa_bulk_accounts')
    .select('id, label, display_phone, verified_name, phone_number_id, waba_id, quality_rating, is_active')
    .order('created_at', { ascending: true });
  if (saved.error) return NextResponse.json({ accounts: [settings] });

  const connected = (saved.data || []).map((row) => ({
    id: String(row.id),
    label: String(row.label || row.verified_name || 'WhatsApp'),
    display_phone: String(row.display_phone || ''),
    verified_name: String(row.verified_name || ''),
    source: 'connected',
    quality_rating: String(row.quality_rating || ''),
    is_active: Boolean(row.is_active),
    phone_number_id: String(row.phone_number_id || '').replace(/\D/g, ''),
    waba_id: String(row.waba_id || '').replace(/\D/g, ''),
  }));

  return NextResponse.json({ accounts: [settings, ...connected] });
}
