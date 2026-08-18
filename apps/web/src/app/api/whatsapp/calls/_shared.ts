import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const ALLOWED_ROLE_CODES = [
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'RSA_MANAGER',
  'TELECALLER',
  'LEAD_MANAGER',
  'CUSTOMER_SERVICE_EXECUTIVE',
  'WORKSHOP_ADMIN',
  'WORKSHOP_SUPERVISOR',
  'BILLING_SPECIALIST',
];

export function isSuperAdminRole(roleCode: unknown): boolean {
  return String(roleCode || '').trim().toUpperCase() === 'SUPER_ADMIN';
}

export function isInboundDirection(direction: unknown): boolean {
  const normalized = String(direction || '').trim().toUpperCase();
  return ['INBOUND', 'USER_INITIATED', 'CUSTOMER_INITIATED'].includes(normalized);
}

export function normalizePhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (!digits) return '';
  const last10 = digits.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return digits.startsWith('91') ? digits : `91${digits}`;
}

export function callErrorResponse(message: string, status = 400) {
  return NextResponse.json({ success: false, error: message }, { status });
}

export async function resolveUserProfile(db: any, user: any) {
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

export async function requireOperationalUser() {
  const supabase = await createClient();
  const db: any = supabase;
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false as const, response: callErrorResponse('Unauthorized', 401) };
  }

  const userProfile = await resolveUserProfile(db, user);
  if (!userProfile) {
    return { ok: false as const, response: callErrorResponse('User profile not found', 404) };
  }
  const roleCode = userProfile?.roles?.role_code;
  if (!ALLOWED_ROLE_CODES.includes(roleCode)) {
    return { ok: false as const, response: callErrorResponse('Forbidden: Insufficient permissions', 403) };
  }
  return { ok: true as const, supabase, db, user, userProfile, roleCode };
}

export async function fetchCallContext(db: any, id: string) {
  const { data: callLog, error } = await db
    .from('whatsapp_call_logs')
    .select('*')
    .eq('id', id)
    .maybeSingle();
  if (error) return { error: error.message || 'Failed to fetch call', callLog: null };
  if (!callLog) return { error: 'Call not found', callLog: null };
  return { error: null, callLog };
}
