import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return { admin: null as any, error: 'Missing SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_URL' };
  }
  const admin = createSupabaseAdminClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return { admin, error: null };
}

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  if (profileError || !userProfile) return { ok: false as const, status: 403, error: 'Forbidden' };
  const roleCode = (userProfile.role as any)?.role_code;
  if (roleCode !== 'SUPER_ADMIN') return { ok: false as const, status: 403, error: 'Forbidden' };

  return { ok: true as const, userId: user.id };
}

function normalizePhone(raw: string) {
  return String(raw || '')
    .replace(/\s+/g, '')
    .trim();
}

/** PATCH: edit user profile (name/email/phone) and optional password. SUPER_ADMIN only. */
export async function PATCH(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const params = await paramsPromise;
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { admin, error: adminErr } = getAdminClient();
    if (!admin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const targetUserId = String(params?.id || '').trim();
    if (!targetUserId) return NextResponse.json({ error: 'Missing user id' }, { status: 400 });

    const body = (await request.json().catch(() => null)) as any;
    const full_name = String(body?.full_name || '').trim();
    const email = String(body?.email || '')
      .trim()
      .toLowerCase();
    const phone = normalizePhone(String(body?.phone || ''));
    const password = body?.password != null ? String(body.password) : '';

    if (!full_name) return NextResponse.json({ error: 'Name is required' }, { status: 400 });
    if (!email || !email.includes('@')) {
      return NextResponse.json({ error: 'Valid email (login ID) is required' }, { status: 400 });
    }
    if (!phone || phone.length < 8) {
      return NextResponse.json({ error: 'Valid phone is required' }, { status: 400 });
    }
    if (password && password.length < 6) {
      return NextResponse.json({ error: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const { data: existing, error: existingErr } = await admin
      .from('users_login')
      .select('id, email, phone, full_name')
      .eq('id', targetUserId)
      .maybeSingle();

    if (existingErr || !existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const emailChanged = email !== String(existing.email || '').trim().toLowerCase();
    if (emailChanged) {
      const { data: emailTaken } = await admin
        .from('users_login')
        .select('id')
        .eq('email', email)
        .neq('id', targetUserId)
        .maybeSingle();
      if (emailTaken?.id) {
        return NextResponse.json({ error: 'Email already used by another user' }, { status: 409 });
      }
    }

    const authUpdate: { email?: string; password?: string; email_confirm?: boolean } = {};
    if (emailChanged) {
      authUpdate.email = email;
      authUpdate.email_confirm = true;
    }
    if (password) authUpdate.password = password;

    if (Object.keys(authUpdate).length > 0) {
      const { error: authError } = await admin.auth.admin.updateUserById(targetUserId, authUpdate);
      if (authError) {
        return NextResponse.json({ error: authError.message || 'Failed to update login credentials' }, { status: 400 });
      }
    }

    const { data: updated, error: profileError } = await admin
      .from('users_login')
      .update({
        full_name,
        email,
        phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', targetUserId)
      .select('id, full_name, email, phone, is_active, role_id, created_at')
      .single();

    if (profileError) {
      return NextResponse.json({ error: profileError.message || 'Failed to update profile' }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      user: updated,
      passwordUpdated: Boolean(password),
      emailUpdated: emailChanged,
    });
  } catch (error: any) {
    console.error('[admin/users][PATCH]', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
