import { createClient } from '@/lib/supabase/server';
import { requireSuperAdmin } from '@/lib/super-admin-auth';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const body = await request.json();
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };

    if (body.title !== undefined) updates.title = body.title;
    if (body.description !== undefined) updates.description = body.description;
    if (body.icon !== undefined) updates.icon = body.icon;
    if (body.icon_url !== undefined) updates.icon_url = body.icon_url;
    if (body.benefit_code !== undefined) updates.benefit_code = body.benefit_code;
    if (body.display_order !== undefined) updates.display_order = Number(body.display_order) || 0;
    if (body.active !== undefined) updates.active = !!body.active;

    const { data, error } = await supabase.from('membership_benefits').update(updates).eq('id', id).select().single();
    if (error) {
      return NextResponse.json({ error: 'Failed to update benefit', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ data, message: 'Benefit updated successfully' });
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

    const { error } = await supabase.from('membership_benefits').delete().eq('id', id);
    if (error) {
      return NextResponse.json({ error: 'Failed to delete benefit', details: error.message }, { status: 500 });
    }
    return NextResponse.json({ message: 'Benefit deleted successfully' });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
