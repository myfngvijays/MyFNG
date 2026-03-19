import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

type ChecklistItem = {
  id?: string;
  name?: string;
  category?: string;
};

function normalizeChecklistItems(input: unknown): Array<{ id: string; name: string; category?: string }> {
  const rows = Array.isArray(input) ? input : [];
  const normalized = rows
    .map((row: ChecklistItem, idx: number) => {
      const name = String(row?.name || '').trim();
      if (!name) return null;
      const category = String(row?.category || '').trim();
      const id = String(row?.id || idx + 1).trim() || String(idx + 1);
      return {
        id,
        name,
        category: category || undefined,
      };
    })
    .filter(Boolean) as Array<{ id: string; name: string; category?: string }>;

  return normalized;
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: pkg, error: pkgError } = await supabase
      .from('service_types')
      .select('id, name')
      .eq('id', id)
      .single();

    if (pkgError || !pkg) {
      return NextResponse.json({ error: 'Service package not found' }, { status: 404 });
    }

    const { data: template, error } = await supabase
      .from('service_type_checklist_templates')
      .select('id, service_type_id, title, points, checklist_items, created_at, updated_at')
      .eq('service_type_id', id)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      package: pkg,
      template: template || null,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { id } = await params;

    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json().catch(() => ({}));
    const title = String(body?.title || '').trim();
    const pointsNum = Number(body?.points);
    const checklistItems = normalizeChecklistItems(body?.checklist_items);

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }
    if (!Number.isFinite(pointsNum) || pointsNum <= 0) {
      return NextResponse.json({ error: 'Valid points value is required' }, { status: 400 });
    }

    const payload = {
      service_type_id: id,
      title,
      points: pointsNum,
      checklist_items: checklistItems,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('service_type_checklist_templates')
      .upsert(payload, { onConflict: 'service_type_id' })
      .select('id, service_type_id, title, points, checklist_items, created_at, updated_at')
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ template: data });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

