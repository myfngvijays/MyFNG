import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function toE164In(raw: unknown): string | null {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length >= 12 && digits.startsWith('91')) digits = digits.slice(-10);
  if (digits.length !== 10) return null;
  return `91${digits}`;
}

function labelFor(row: {
  customer_name?: string | null;
  lead_number?: string | null;
}): string {
  const name = String(row.customer_name || '').trim() || 'MyFNG customer';
  const lead = String(row.lead_number || '').trim();
  const text = lead ? `${name} · ${lead}` : `${name} · MyFNG`;
  return text.slice(0, 50);
}

/**
 * GET /api/telecaller/crm/caller-id-directory
 * Phone book for iOS Call Directory (and Android overlay lookup cache).
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile?.roles as any)?.role_code || '')
      .trim()
      .toUpperCase();
    const allowed = new Set(['TELECALLER', 'LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = supabaseAdmin || supabase;
    const profileId = String((profile as any)?.id || user.id || '');

    let q = db
      .from('service_leads')
      .select('id, lead_number, customer_name, customer_phone, updated_at')
      .not('customer_phone', 'is', null)
      .order('updated_at', { ascending: false })
      .limit(5000);

    if (roleCode === 'TELECALLER' && profileId) {
      q = q.eq('assigned_telecaller_id', profileId);
    }

    const { data, error } = await q;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const seen = new Set<string>();
    const entries: Array<{ phone: string; label: string; leadId: string }> = [];
    for (const row of data || []) {
      const phone = toE164In((row as any).customer_phone);
      if (!phone || seen.has(phone)) continue;
      seen.add(phone);
      entries.push({
        phone,
        label: labelFor(row as any),
        leadId: String((row as any).id || ''),
      });
    }
    entries.sort((a, b) => a.phone.localeCompare(b.phone));

    return NextResponse.json({ success: true, count: entries.length, entries });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Directory failed' }, { status: 500 });
  }
}
