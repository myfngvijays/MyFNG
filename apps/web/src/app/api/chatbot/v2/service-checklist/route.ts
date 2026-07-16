import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

function normalizeChecklistItem(raw: unknown): { name: string; category: string } | null {
  if (!raw) return null;
  if (typeof raw === 'string') {
    const name = raw.trim();
    return name ? { name, category: 'General' } : null;
  }
  const name = String((raw as any)?.name || (raw as any)?.title || (raw as any)?.label || '').trim();
  if (!name) return null;
  const category = String((raw as any)?.category || 'General').trim() || 'General';
  return { name, category };
}

function matchesOilType(name: string, oil: string): boolean {
  const text = name.toLowerCase();
  const wantsFull = oil === 'full';
  const hasFull =
    text.includes('fully synthetic') ||
    text.includes('full synthetic') ||
    text.includes('(fully)') ||
    text.includes('(full)');
  const hasSemi =
    text.includes('semi synthetic') ||
    text.includes('semi-synthetic') ||
    text.includes('(semi)') ||
    /\bsemi\b/.test(text);

  if (wantsFull) return hasFull || (!hasSemi && !hasFull);
  return hasSemi || (!hasSemi && !hasFull);
}

function tierRank(name: string, tier: string): number {
  const n = name.toLowerCase();
  const t = tier.toLowerCase();
  if (n === t) return 0;
  if (n.includes(t)) return 1;
  if (t.includes(n)) return 2;
  if (t === 'general' && n.includes('standard')) return 3;
  return 4;
}

export async function GET(req: NextRequest) {
  const tier = String(req.nextUrl.searchParams.get('tier') || '').trim();
  const oil = String(req.nextUrl.searchParams.get('oil') || 'semi').trim().toLowerCase();
  const serviceTypeId = String(req.nextUrl.searchParams.get('service_type_id') || '').trim();

  if (!tier && !serviceTypeId) {
    return NextResponse.json({ success: false, error: 'tier or service_type_id is required' }, { status: 400 });
  }

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ success: false, error: 'Server configuration error' }, { status: 500 });
  }

  const { data: serviceTypes, error: serviceError } = serviceTypeId
    ? await supabaseAdmin.from('service_types').select('id, name').eq('id', serviceTypeId).limit(1)
    : await supabaseAdmin
        .from('service_types')
        .select('id, name')
        .ilike('name', `%${tier}%`)
        .limit(20);

  if (serviceError) {
    return NextResponse.json({ success: false, error: 'Failed to load service' }, { status: 500 });
  }

  const matched = serviceTypeId
    ? (serviceTypes || [])[0]
    : (serviceTypes || [])
        .filter((row) => matchesOilType(String(row.name || ''), oil))
        .sort((a, b) => tierRank(String(a.name || ''), tier) - tierRank(String(b.name || ''), tier))[0] ||
      (serviceTypes || [])[0];

  if (!matched?.id) {
    return NextResponse.json({ success: true, items: [], points: null, serviceName: null });
  }

  const { data: template } = await supabaseAdmin
    .from('service_type_checklist_templates')
    .select('title, points, checklist_items')
    .eq('service_type_id', matched.id)
    .maybeSingle();

  const items = (Array.isArray(template?.checklist_items) ? template.checklist_items : [])
    .map(normalizeChecklistItem)
    .filter(Boolean) as Array<{ name: string; category: string }>;

  return NextResponse.json({
    success: true,
    serviceName: matched.name,
    title: template?.title || matched.name,
    points: typeof template?.points === 'number' ? template.points : items.length || null,
    items,
  });
}
