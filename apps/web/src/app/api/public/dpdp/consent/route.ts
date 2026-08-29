import { NextResponse } from 'next/server';
import { CONSENT_PURPOSES } from '@/lib/dpdp/constants';
import { clientIpFromRequest, recordDpdpConsents } from '@/lib/dpdp/recordConsent';

const ALLOWED = new Set(CONSENT_PURPOSES.map((p) => p.id));

export async function POST(request: Request) {
  try {
    const body = await request.json().catch(() => ({}));
    const source = String(body.source || 'unknown').slice(0, 80);
    const subject_name = body.subject_name ? String(body.subject_name).slice(0, 200) : null;
    const subject_email = body.subject_email ? String(body.subject_email).slice(0, 200) : null;
    const subject_phone = body.subject_phone ? String(body.subject_phone).slice(0, 20) : null;
    const raw = Array.isArray(body.consents) ? body.consents : [];
    const consents = raw
      .filter((row: any) => row && ALLOWED.has(String(row.purpose)))
      .map((row: any) => ({
        purpose: String(row.purpose),
        granted: Boolean(row.granted),
        source,
        subject_name,
        subject_email,
        subject_phone,
        ip_address: clientIpFromRequest(request),
        user_agent: request.headers.get('user-agent'),
      }));

    if (!consents.length) {
      return NextResponse.json({ error: 'No valid consent purposes' }, { status: 400 });
    }

    const result = await recordDpdpConsents(consents);
    if (!result.stored) {
      return NextResponse.json(
        { ok: false, stored: false, error: result.error, hint: 'Run database/353_dpdp_consent_and_rights.sql' },
        { status: 503 },
      );
    }
    return NextResponse.json({ ok: true, stored: true, count: consents.length });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'consent_failed' }, { status: 500 });
  }
}
