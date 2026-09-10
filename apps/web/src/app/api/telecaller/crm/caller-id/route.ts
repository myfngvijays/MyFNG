import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { lookupLeadByPhone } from '@/lib/telecaller/smartfloDialSessions';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/telecaller/crm/caller-id?phone=98xxxxxxxx
 * Native Android overlay uses this when the phone rings and we only have a number.
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

    const phone = String(request.nextUrl.searchParams.get('phone') || '').trim();
    const profileId = String((profile as any)?.id || user.id || '');
    const lead = await lookupLeadByPhone({
      phone,
      telecallerId: roleCode === 'TELECALLER' ? profileId : null,
    });
    if (!lead) {
      return NextResponse.json({ success: true, lead: null });
    }

    return NextResponse.json({ success: true, lead });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Lookup failed' }, { status: 500 });
  }
}
