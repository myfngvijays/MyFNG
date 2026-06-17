import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const PLANS = 'membership_plans';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    const fields = [
      'code', 'name', 'description', 'tagline', 'badge', 'period_label', 'footer_note',
      'second_car_addon_title', 'second_car_addon_description', 'second_car_addon_icon',
    ] as const;
    for (const f of fields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    if (body.code !== undefined) updates.code = String(body.code).trim().toUpperCase().replace(/[^A-Z0-9_]/g, '_');
    if (body.price !== undefined) updates.price = Number(body.price) || 0;
    if (body.original_price !== undefined) updates.original_price = body.original_price == null ? null : Number(body.original_price);
    if (body.duration_days !== undefined) updates.duration_days = Number(body.duration_days) || 365;
    if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0;
    if (body.second_car_addon_price !== undefined) updates.second_car_addon_price = Number(body.second_car_addon_price) || 0;
    if (body.active !== undefined) updates.active = !!body.active;

    const { data, error } = await supabase.from(PLANS).update(updates).eq('id', id).select().single();
    if (error) {
      return NextResponse.json({ error: 'Failed to update plan', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data, message: 'Plan updated successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const { error } = await supabase.from(PLANS).delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: 'Failed to delete plan', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Plan deleted successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
