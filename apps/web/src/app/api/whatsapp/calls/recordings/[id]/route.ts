import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_ROLE_CODES = [
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'RSA_MANAGER',
  'TELECALLER',
  'CUSTOMER_SERVICE_EXECUTIVE',
  'WORKSHOP_ADMIN',
  'WORKSHOP_SUPERVISOR',
  'BILLING_SPECIALIST',
];

async function resolveUserProfile(db: any, user: any) {
  const email = (user.email || '').trim();
  const phone = (user.phone || '').trim();
  const selectProfile = 'id, email, phone, full_name, roles!inner(role_code)';

  const { data: byEmail } = email
    ? await db.from('users_login').select(selectProfile).ilike('email', email).maybeSingle()
    : { data: null };
  const { data: byPhone } = !byEmail && phone
    ? await db.from('users_login').select(selectProfile).eq('phone', phone).maybeSingle()
    : { data: null };
  const { data: byId } = !byEmail && !byPhone
    ? await db.from('users_login').select(selectProfile).eq('id', user.id).maybeSingle()
    : { data: null };
  return byEmail || byPhone || byId;
}

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> | { id: string } }
) {
  try {
    const supabase = await createClient();
    const db: any = supabase;
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(db, user);
    const roleCode = profile?.roles?.role_code;
    if (!profile || !ALLOWED_ROLE_CODES.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const params = await Promise.resolve(context.params as any);
    const id = String(params?.id || '').trim();
    if (!id) return NextResponse.json({ error: 'id is required' }, { status: 400 });

    const { data: recording, error } = await db
      .from('whatsapp_call_recordings')
      .select('id, recording_url, expires_at')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      return NextResponse.json({ error: error.message || 'Failed to load recording' }, { status: 500 });
    }
    if (!recording?.recording_url) {
      return NextResponse.json({ error: 'Recording not available' }, { status: 404 });
    }

    return NextResponse.redirect(String(recording.recording_url), { status: 302 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
