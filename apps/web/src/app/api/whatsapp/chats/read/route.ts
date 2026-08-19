import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const ALLOWED_ROLE_CODES = [
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'RSA_MANAGER',
  'TELECALLER',
  'LEAD_MANAGER',
];

function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const last10 = digits.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return digits.startsWith('91') ? digits : `91${digits}`;
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const userProfile = await resolveUserProfile(supabase as any, user);
    if (!userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }
    const roleCode = String((userProfile as any)?.roles?.role_code || '').toUpperCase();
    if (!ALLOWED_ROLE_CODES.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const phone = normalizePhone(String(body?.phone || ''));
    if (!phone) {
      return NextResponse.json({ error: 'phone is required' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    const db: any = supabaseAdmin || supabase;
    if (!supabaseAdmin && adminError) {
      console.warn('[whatsapp/chats/read] admin unavailable:', adminError);
    }

    const now = new Date().toISOString();
    const { error } = await db.from('whatsapp_chat_reads').upsert(
      {
        phone,
        user_id: userProfile.id,
        last_read_at: now,
        updated_at: now,
      },
      { onConflict: 'phone,user_id' },
    );

    if (error) {
      // Table may not be migrated yet — don't break chat open.
      console.warn('[whatsapp/chats/read] upsert failed:', error.message);
      return NextResponse.json({
        success: false,
        error: error.message,
        phone,
        last_read_at: now,
      });
    }

    return NextResponse.json({ success: true, phone, last_read_at: now });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 },
    );
  }
}
