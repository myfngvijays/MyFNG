import { NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { DATA_RIGHTS_TYPES } from '@/lib/dpdp/constants';
import { clientIpFromRequest, recordDpdpConsents } from '@/lib/dpdp/recordConsent';

const ALLOWED = new Set(DATA_RIGHTS_TYPES.map((t) => t.id));

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const request_type = String(body.request_type || '').toLowerCase();
    const full_name = String(body.full_name || '').trim();
    const email = String(body.email || '').trim();
    const phone = body.phone ? String(body.phone).replace(/\D/g, '').slice(0, 15) : null;
    const details = body.details ? String(body.details).slice(0, 4000) : null;

    if (!ALLOWED.has(request_type)) {
      return NextResponse.json({ error: 'Invalid request type' }, { status: 400 });
    }
    if (full_name.length < 2 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'Name and a valid email are required' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { ok: false, error: adminError || 'Supabase admin unavailable', hint: 'Run database/353_dpdp_consent_and_rights.sql' },
        { status: 503 },
      );
    }
    const { data, error } = await supabaseAdmin
      .from('data_rights_requests')
      .insert({
        request_type,
        full_name: full_name.slice(0, 200),
        email: email.slice(0, 200),
        phone,
        details,
        status: 'PENDING',
      })
      .select('id')
      .single();

    if (error) {
      return NextResponse.json(
        { ok: false, error: error.message, hint: 'Run database/353_dpdp_consent_and_rights.sql' },
        { status: 503 },
      );
    }

    if (request_type === 'withdraw') {
      await recordDpdpConsents([
        {
          purpose: 'marketing',
          granted: false,
          source: 'data-rights',
          subject_name: full_name,
          subject_email: email,
          subject_phone: phone,
          ip_address: clientIpFromRequest(request),
          user_agent: request.headers.get('user-agent'),
        },
      ]);
    }

    return NextResponse.json({ ok: true, id: data?.id });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'rights_failed' }, { status: 500 });
  }
}
