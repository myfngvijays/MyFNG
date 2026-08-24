import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { mirrorTelecrmWacaInboundToBookings } from '@/lib/telecrm/wacaBookingsMirror';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ALLOWED = new Set(['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER', 'APP_OPERATIONS']);

/**
 * POST /api/super_admin/bookings/telecrm-waca-sync
 * Manual test / backfill one WACA lead into Bookings admin (same path as TeleCRM Call API).
 */
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

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile as any)?.roles?.role_code || '').toUpperCase();
    if (!ALLOWED.has(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const mirror = await mirrorTelecrmWacaInboundToBookings(body);
    if (!mirror.ok) {
      return NextResponse.json(
        { success: false, error: mirror.bookingsLead.error || mirror.bookingsLead.skipped || 'sync_failed', ...mirror },
        { status: 400 },
      );
    }

    return NextResponse.json({ success: true, ...mirror });
  } catch (error: unknown) {
    return NextResponse.json(
      { error: String((error as { message?: string })?.message || 'Sync failed') },
      { status: 500 },
    );
  }
}
