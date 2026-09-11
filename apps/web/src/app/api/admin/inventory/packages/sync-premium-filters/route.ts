import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';
import {
  isPremiumOrPlatinumPeriodic,
  rewriteStoredFilterNamesToReplace,
  storedFilterNamesNeedReplace,
} from '@/lib/periodicFilterWording';

export const dynamic = 'force-dynamic';

export async function POST() {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: templates, error } = await supabase
      .from('service_type_checklist_templates')
      .select('id, service_type_id, points, checklist_items');

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const typeIds = Array.from(
      new Set((templates || []).map((row) => String(row.service_type_id || '')).filter(Boolean)),
    );
    const nameById: Record<string, string> = {};
    if (typeIds.length) {
      const { data: types } = await supabase.from('service_types').select('id, name').in('id', typeIds);
      (types || []).forEach((st: any) => {
        nameById[String(st.id)] = String(st.name || '');
      });
    }

    let updated = 0;
    for (const row of templates || []) {
      const serviceName = nameById[String(row.service_type_id)] || '';
      const items = Array.isArray(row.checklist_items) ? row.checklist_items : [];
      if (
        !isPremiumOrPlatinumPeriodic({
          serviceName,
          points: row.points,
          category: 'PERIODIC',
        })
      ) {
        continue;
      }
      if (!storedFilterNamesNeedReplace(items)) continue;

      const next = rewriteStoredFilterNamesToReplace(items);
      const { error: upErr } = await supabase
        .from('service_type_checklist_templates')
        .update({ checklist_items: next, updated_at: new Date().toISOString() })
        .eq('id', row.id);
      if (upErr) {
        return NextResponse.json({ error: upErr.message }, { status: 500 });
      }
      updated += 1;
    }

    return NextResponse.json({ success: true, updated });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
