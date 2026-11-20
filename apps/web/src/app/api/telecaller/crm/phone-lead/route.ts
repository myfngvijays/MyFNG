import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { inspectPhoneForNewLead } from '@/lib/telecaller/phoneLeadGuard';

export const dynamic = 'force-dynamic';

/** Look up a phone before a telecaller adds a lead. */
export async function GET(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const profile = await resolveUserProfile(supabase, user);
  const roleCode = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '');
  if (!['TELECALLER', 'LEAD_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const phone = new URL(request.url).searchParams.get('phone') || '';
  const { supabaseAdmin } = getSupabaseAdmin();
  const db = supabaseAdmin ?? supabase;
  const check = await inspectPhoneForNewLead(db, phone, (profile as { id?: string } | null)?.id);

  return NextResponse.json({
    blocked: check.blocked,
    error: check.message,
    lead_number: check.leadNumber,
    owner_name: check.ownerName,
    fill: {
      customer_name: check.fill.customer_name || null,
      customer_email: check.fill.customer_email || null,
      customer_address: check.fill.customer_address || null,
      pickup_address: check.fill.pickup_address || null,
      city: check.fill.city || null,
      pincode: check.fill.pincode || null,
      vehicle_number: check.fill.vehicle_number || null,
      vehicle_make: check.fill.vehicle_make || null,
      vehicle_model: check.fill.vehicle_model || null,
      vehicle_fuel_type: check.fill.vehicle_fuel_type || null,
    },
  });
}
