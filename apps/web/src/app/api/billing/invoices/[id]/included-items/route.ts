import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

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
    let step = 'start';
    const supabase = await createClient();
    // Optional service-role client to bypass RLS on invoices/service_type_items (best-effort).
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ADMIN_KEY;
    const supabaseAdmin =
      supabaseUrl && serviceRoleKey
        ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, {
            auth: { persistSession: false, autoRefreshToken: false },
          })
        : null;
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const invoiceId = params.id;
    const body = await request.json().catch(() => ({}));
    const serviceDescription = String(body?.service_description || '').trim();
    const serviceTypeIdInput = String(body?.service_type_id || '').trim();
    const itemsRaw = Array.isArray(body?.items) ? body.items : [];

    if (!serviceDescription) {
      return NextResponse.json({ error: 'service_description is required' }, { status: 400 });
    }

    const items = itemsRaw
      .map((x: any) => {
        const product_id = String(x?.product_id || '').trim();
        const unit_price = Number(x?.unit_price ?? 0);
        const base_unit_price = Number(x?.base_unit_price ?? unit_price);
        const quantity = Number(x?.quantity ?? 1);
        if (!product_id) return null;
        if (!Number.isFinite(unit_price) || unit_price < 0) return null;
        return {
          product_id,
          unit_price,
          base_unit_price: Number.isFinite(base_unit_price) ? base_unit_price : unit_price,
          quantity: Number.isFinite(quantity) && quantity > 0 ? quantity : 1,
        };
      })
      .filter(Boolean) as Array<{ product_id: string; unit_price: number; base_unit_price: number; quantity: number }>;

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

    const isRlsError = (e: any) => {
      const msg = String(e?.message || e || '');
      const code = String(e?.code || '');
      return (
        code === '42501' ||
        /row-level security|violates row level security|permission denied/i.test(msg)
      );
    };

    step = 'fetch_invoice';
    const fetchInvoice = async (client: any) =>
      client
        .from('invoices')
        .select('id, lead_id, workshop_id, invoice_type, discount_amount, line_items, base_amount')
        .eq('id', invoiceId)
        .maybeSingle();

    let invRes = await fetchInvoice(supabase);
    if (invRes.error && isRlsError(invRes.error) && supabaseAdmin) {
      invRes = await fetchInvoice(supabaseAdmin);
    }
    const invoice = invRes.data;
    const invErr = invRes.error;
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
    // Persisted overrides (used for display). Delta is computed from the baseline shown in UI.
    const itemsForSave = (items || []).map((it) => ({ product_id: it.product_id, unit_price: it.unit_price }));

    step = 'match_and_patch_service_line';
    const nextLineItems = li.map((row: any) => {
      const cat = String(row?.category || '').toUpperCase();
      const rowServiceTypeId = String(row?.service_type_id || '').trim();
      const descKey = normalizeName(String(row?.description || ''));

      // Prefer robust matching by service_type_id when provided.
      const matchesByType = serviceTypeIdInput && rowServiceTypeId && rowServiceTypeId === serviceTypeIdInput;
      const matchesByDesc = descKey && descKey === targetKey;

      // Some older OS rows may not have category set; allow updating if service_type_id matches.
      if (!(matchesByType || (cat === 'SERVICE' && matchesByDesc))) return row;

      updated = true;

      // Best-effort: if service_type_id exists, recalc SERVICE amount from package items using overrides
      return {
        ...row,
        category: cat || 'SERVICE',
        description: row?.description || serviceDescription,
        service_type_id: rowServiceTypeId || (serviceTypeIdInput || undefined),
        included_items: itemsForSave,
        // amount/rate updated below (after async calc) when possible
      };
    });

    if (!updated) {
      step = 'seed_missing_service_line';
      // If OS invoice line_items are stale/missing, auto-create a minimal SERVICE line (safe only when lead has 1 service_type).
      try {
        const isOS = String((invoice as any)?.invoice_type || '').toUpperCase() === 'ORDER_SUMMARY';
        const leadId = String((invoice as any)?.lead_id || '').trim();
        if (isOS && leadId && serviceTypeIdInput) {
          const { data: lead } = await supabase.from('service_leads').select('service_type_ids').eq('id', leadId).maybeSingle();
          const raw = (lead as any)?.service_type_ids;
          let ids: string[] = [];
          if (Array.isArray(raw)) ids = raw.map(String).map((s) => s.trim()).filter(Boolean);
          else if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) ids = parsed.map(String).map((s) => s.trim()).filter(Boolean);
            } catch {
              ids = raw.split(',').map((s) => s.trim()).filter(Boolean);
            }
          }
          if (ids.length === 1 && ids[0] === serviceTypeIdInput) {
            const baseAmount = Number((invoice as any)?.base_amount || 0) || 0;
            const seeded = {
              category: 'SERVICE',
              description: serviceDescription,
              service_type_id: serviceTypeIdInput,
              qty: 1,
              rate: baseAmount,
              amount: baseAmount,
              included_items: itemsForSave,
            };
            nextLineItems.push(seeded);
            updated = true;
          }
        }
      } catch {
        // ignore
      }

      if (!updated) {
        return NextResponse.json(
          {
            error:
              'Service line not found in invoice line_items. Please open Order Summary once and retry, or regenerate OS if this lead has multiple services.',
            step,
          },
          { status: 400 }
        );
      }
    }

    // IMPORTANT:
    // Included-items are informational for OS packages. Editing included item rates should NOT
    // change the main SERVICE line price. So we only persist `included_items` overrides here.

    // Schema-tolerant update:
    // Some installs don't have all invoice columns (e.g. updated_at/subtotal).
    // We try progressively smaller payloads, but ALWAYS ensure line_items is persisted.
    const sumBy = (cats: string[]) =>
      nextLineItems
        .filter((x: any) => cats.includes(String(x?.category || '').toUpperCase()))
        .reduce((s: number, x: any) => s + (Number(x?.amount || 0) || 0), 0);

    const base_amount = sumBy(['SERVICE', 'ADDON', 'LABOUR']);
    const parts_cost = sumBy(['PART', 'PARTS']);
    const extra_charges = sumBy(['EXTRA']);
    const sub_total = Math.max(0, base_amount + parts_cost + extra_charges);
    const discount_amount = Number((invoice as any)?.discount_amount || 0) || 0;
    const final_amount = Math.max(0, sub_total - discount_amount);

    const tryUpdate = async (payload: any) => {
      const res = await supabase.from('invoices').update(payload).eq('id', invoiceId).select('id').maybeSingle();
      if (res.error && isRlsError(res.error) && supabaseAdmin) {
        return supabaseAdmin.from('invoices').update(payload).eq('id', invoiceId).select('id').maybeSingle();
      }
      return res;
    };

    step = 'update_invoice';
    const isMissingCol = (e: any) => {
      const msg = String(e?.message || e || '');
      const code = String(e?.code || '');
      // 42703: postgres "column does not exist"
      // PGRST204: postgrest "Could not find the 'col' column in the schema cache"
      return (
        code === '42703' ||
        code === 'PGRST204' ||
        /column .* does not exist/i.test(msg) ||
        /could not find the '.*' column of '.*' in the schema cache/i.test(msg)
      );
    };

    // 1) Full payload (best UX; keeps totals in sync)
    let upd = await tryUpdate({
      line_items: nextLineItems,
      base_amount,
      parts_cost,
      extra_charges,
      sub_total,
      total_amount: final_amount,
      final_amount,
      updated_at: new Date().toISOString(),
    });

    // 2) Drop optional cols if schema complains
    if (upd.error && isMissingCol(upd.error)) {
      upd = await tryUpdate({
        line_items: nextLineItems,
        base_amount,
        parts_cost,
        extra_charges,
        sub_total,
        total_amount: final_amount,
        final_amount,
      });
    }

    // 3) Absolute fallback: just persist included_items
    if (upd.error && isMissingCol(upd.error)) {
      upd = await tryUpdate({ line_items: nextLineItems });
    }

    if (upd.error) {
      return NextResponse.json(
        { error: 'Failed to update invoice', details: upd.error.message, code: upd.error.code, step },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    console.error('[included-items] error:', e);
    return NextResponse.json(
      { error: 'Internal server error', details: e?.message || String(e), code: e?.code },
      { status: 500 }
    );
  }
}

