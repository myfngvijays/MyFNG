import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { DPDP_NOTICE_VERSION, type ConsentPurposeId } from '@/lib/dpdp/constants';

export type ConsentRecordInput = {
  purpose: ConsentPurposeId | string;
  granted: boolean;
  source: string;
  subject_name?: string | null;
  subject_email?: string | null;
  subject_phone?: string | null;
  user_id?: string | null;
  ip_address?: string | null;
  user_agent?: string | null;
};

export async function recordDpdpConsents(rows: ConsentRecordInput[]): Promise<{ stored: boolean; error?: string }> {
  if (!rows.length) return { stored: true };
  try {
    const admin = getSupabaseAdmin();
    const payload = rows.map((row) => ({
      purpose: String(row.purpose).slice(0, 40),
      granted: Boolean(row.granted),
      source: String(row.source || 'unknown').slice(0, 80),
      subject_name: row.subject_name ? String(row.subject_name).slice(0, 200) : null,
      subject_email: row.subject_email ? String(row.subject_email).slice(0, 200) : null,
      subject_phone: row.subject_phone ? String(row.subject_phone).slice(0, 20) : null,
      user_id: row.user_id || null,
      ip_address: row.ip_address ? String(row.ip_address).slice(0, 80) : null,
      user_agent: row.user_agent ? String(row.user_agent).slice(0, 400) : null,
      notice_version: DPDP_NOTICE_VERSION,
    }));
    const { error } = await admin.from('dpdp_consent_records').insert(payload);
    if (error) return { stored: false, error: error.message };
    return { stored: true };
  } catch (err: any) {
    return { stored: false, error: err?.message || 'consent_store_failed' };
  }
}

export function clientIpFromRequest(request: Request): string | null {
  const forwarded = request.headers.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0]?.trim() || null;
  return request.headers.get('x-real-ip');
}
