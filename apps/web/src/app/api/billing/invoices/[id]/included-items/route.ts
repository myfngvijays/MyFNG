import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

function normalizeName(s: string) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const invoiceId = params.id;
    const body = await request.json().catch(() => ({}));
    const serviceDescription = String(body?.service_description || '').trim();
    const itemsRaw = Array.isArray(body?.items) ? body.items : [];

    if (!serviceDescription) {
      return NextResponse.json({ error: 'service_description is required' }, { status: 400 });
    }

    const items = itemsRaw
      .map((x: any) => {
        const product_id = String(x?.product_id || '').trim();
        const unit_price = Number(x?.unit_price ?? 0);
        if (!product_id) return null;
        if (!Number.isFinite(unit_price) || unit_price < 0) return null;
        return { product_id, unit_price };
      })
      .filter(Boolean);

    // AuthZ: only privileged roles
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, workshop_id, roles!inner(role_code)')
      .eq('id', user.id)
      .maybeSingle();

    const roleCode = String((userProfile as any)?.roles?.role_code || '');
    const allowed = [
      'SUPER_ADMIN',
      'SUB_ADMIN',
      'WORKSHOP_ADMIN',
      'WORKSHOP_SUPERVISOR',
      'WORKSHOP_ADVISOR',
    ];
    if (!allowed.includes(roleCode)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { data: invoice, error: invErr } = await supabase
      .from('invoices')
      .select('id, workshop_id, line_items')
      .eq('id', invoiceId)
      .maybeSingle();
    if (invErr || !invoice) return NextResponse.json({ error: 'Invoice not found' }, { status: 404 });

    // Workshop scoping for workshop roles
    if (roleCode.startsWith('WORKSHOP_')) {
      const myWid = String((userProfile as any)?.workshop_id || '');
      const invWid = String((invoice as any)?.workshop_id || '');
      if (myWid && invWid && myWid !== invWid) {
        return NextResponse.json({ error: 'Forbidden: invoice not in your workshop' }, { status: 403 });
      }
    }

    const li = Array.isArray((invoice as any)?.line_items) ? (invoice as any).line_items : [];
    const targetKey = normalizeName(serviceDescription);
    let updated = false;

    const nextLineItems = li.map((row: any) => {
      const cat = String(row?.category || '').toUpperCase();
      if (cat !== 'SERVICE') return row;
      const descKey = normalizeName(String(row?.description || ''));
      if (!descKey || descKey !== targetKey) return row;
      updated = true;
      return {
        ...row,
        included_items: items,
      };
    });

    if (!updated) {
      return NextResponse.json(
        { error: 'Service line not found in invoice line_items (try regenerating OS once)' },
        { status: 400 }
      );
    }

    const { error: updErr } = await supabase
      .from('invoices')
      .update({ line_items: nextLineItems })
      .eq('id', invoiceId);

    if (updErr) {
      return NextResponse.json({ error: 'Failed to update invoice', details: updErr.message }, { status: 500 });
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message || String(e) }, { status: 500 });
  }
}

