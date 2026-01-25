import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

type UpdateBody = {
  customer_name?: string | null;
  customer_email?: string | null;
  customer_alternate_phone?: string | null;
  address?: string | null;
  customer_address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  customer_gstin?: string | null;
  customer_legal_name?: string | null;
  customer_billing_address?: string | null;
  customer_billing_state_code?: string | null;
  vehicle_year?: number | null;
  vehicle_variant?: string | null;
  vehicle_fuel_type?: string | null;
  vehicle_vin?: string | null;
  vehicle_odometer?: number | null;
  odometer_km?: number | null;
  engine_no?: string | null;
  chassis_no?: string | null;
  daily_running_km?: number | null;
  next_service_km?: number | null;
  next_service_date?: string | null; // YYYY-MM-DD (DATE)
};

const pickAllowed = (body: UpdateBody) => {
  const out: Record<string, any> = {};

  const assignStr = (k: keyof UpdateBody) => {
    if (!(k in body)) return;
    const v = body[k];
    out[k as string] = v === null ? null : String(v ?? '').trim() || null;
  };

  const assignNum = (k: keyof UpdateBody) => {
    if (!(k in body)) return;
    const v = body[k];
    if (v === null || v === undefined || v === ('' as any)) {
      out[k as string] = null;
      return;
    }
    const n = typeof v === 'number' ? v : Number(v);
    out[k as string] = Number.isFinite(n) ? n : null;
  };

  const assignDate = (k: keyof UpdateBody) => {
    if (!(k in body)) return;
    const v = body[k] as any;
    if (v === null || v === undefined || v === ('' as any)) {
      out[k as string] = null;
      return;
    }
    const s = String(v || '').trim();
    // Expect YYYY-MM-DD; keep as string for Postgres DATE column.
    out[k as string] = s || null;
  };

  assignStr('customer_name');
  assignStr('customer_email');
  assignStr('customer_alternate_phone');
  assignStr('address');
  assignStr('customer_address');
  assignStr('city');
  assignStr('state');
  assignStr('pincode');
  assignStr('customer_gstin');
  assignStr('customer_legal_name');
  assignStr('customer_billing_address');
  assignStr('customer_billing_state_code');
  assignStr('vehicle_variant');
  assignStr('vehicle_fuel_type');
  assignStr('vehicle_vin');
  assignStr('engine_no');
  assignStr('chassis_no');

  assignNum('vehicle_year');
  assignNum('vehicle_odometer');
  assignNum('odometer_km');
  assignNum('daily_running_km');
  assignNum('next_service_km');
  assignDate('next_service_date');

  // If one of address/customer_address is provided, mirror into the other for compatibility.
  if ('address' in out && !('customer_address' in out)) out.customer_address = out.address;
  if ('customer_address' in out && !('address' in out)) out.address = out.customer_address;

  // If odometer_km is provided but vehicle_odometer isn't (or vice versa), mirror best-effort.
  if ('odometer_km' in out && !('vehicle_odometer' in out)) out.vehicle_odometer = out.odometer_km;
  if ('vehicle_odometer' in out && !('odometer_km' in out)) out.odometer_km = out.vehicle_odometer;

  return out;
};

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    const leadId = params.id;
    const body = (await request.json().catch(() => ({}))) as UpdateBody;
    const updates = pickAllowed(body);

    if (!Object.keys(updates).length) {
      return NextResponse.json({ success: false, error: 'No editable fields provided' }, { status: 400 });
    }

    // Get user profile + role
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, role_id, workshop_id')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ success: false, error: 'User profile not found' }, { status: 404 });
    }

    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('role_code')
      .eq('id', userProfile.role_id)
      .single();

    if (roleError || !roleData) {
      return NextResponse.json({ success: false, error: 'Role not found' }, { status: 404 });
    }

    const roleCode = roleData.role_code;
    const isAllowed = roleCode === 'WORKSHOP_ADMIN' || roleCode === 'WORKSHOP_SUPERVISOR';
    if (!isAllowed) {
      return NextResponse.json({ success: false, error: 'Forbidden', roleCode }, { status: 403 });
    }

    // Fetch lead and ensure it belongs to user's workshop
    const { data: lead, error: leadError } = await supabase
      .from('service_leads')
      .select('id, workshop_id, customer_phone, vehicle_number, vehicle_model, model_id')
      .eq('id', leadId)
      .single();

    if (leadError || !lead) {
      return NextResponse.json({ success: false, error: 'Lead not found' }, { status: 404 });
    }

    if (!userProfile.workshop_id || lead.workshop_id !== userProfile.workshop_id) {
      return NextResponse.json({ success: false, error: 'Lead does not belong to your workshop' }, { status: 403 });
    }

    // Server-side safety: reject attempts to change locked fields (even if UI disables them).
    const forbiddenKeys = ['customer_phone', 'vehicle_number', 'vehicle_model', 'model_id'];
    for (const k of forbiddenKeys) {
      if ((body as any)?.[k] !== undefined) {
        return NextResponse.json(
          { success: false, error: `Field is not editable: ${k}` },
          { status: 400 }
        );
      }
    }

    const now = new Date().toISOString();
    const { data: updatedLead, error: updateError } = await supabase
      .from('service_leads')
      .update({
        ...updates,
        updated_by_id: user.id,
        updated_at: now,
      })
      .eq('id', leadId)
      .select('*')
      .single();

    if (updateError) {
      return NextResponse.json(
        { success: false, error: 'Failed to update lead details', details: updateError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, lead: updatedLead }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: 'Internal server error', details: error?.message || 'Unknown error' },
      { status: 500 }
    );
  }
}

