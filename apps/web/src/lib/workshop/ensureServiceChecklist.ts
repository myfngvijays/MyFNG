import type { SupabaseClient } from '@supabase/supabase-js';

async function resolveServiceTypeName(
  supabaseAdmin: SupabaseClient,
  lead: { service_type?: string | null; service_type_ids?: unknown },
) {
  let serviceTypeName = String(lead.service_type || '').trim();

  let serviceTypeIds = lead.service_type_ids;
  if (typeof serviceTypeIds === 'string') {
    try {
      serviceTypeIds = JSON.parse(serviceTypeIds);
    } catch {
      serviceTypeIds = null;
    }
  }

  if (Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
    const firstId = String(serviceTypeIds[0]);
    const { data: st } = await supabaseAdmin
      .from('service_types')
      .select('name')
      .eq('id', firstId)
      .maybeSingle();
    if (st?.name) serviceTypeName = st.name;
  }

  return serviceTypeName || 'General Service';
}

/** Create service_checklists row via DB function when mechanic is assigned. Idempotent. */
export async function ensureLeadServiceChecklist(
  supabaseAdmin: SupabaseClient,
  leadId: string,
  mechanicId: string,
) {
  const { data: existing } = await supabaseAdmin
    .from('service_checklists')
    .select('id, checklist_items')
    .eq('lead_id', leadId)
    .eq('mechanic_id', mechanicId)
    .maybeSingle();

  const existingItems = existing?.checklist_items;
  const hasItems =
    Array.isArray(existingItems) ? existingItems.length > 0 : Boolean(existingItems);
  if (existing && hasItems) return { created: false, checklistId: existing.id };

  const { data: lead, error: leadError } = await supabaseAdmin
    .from('service_leads')
    .select('service_type, service_type_ids')
    .eq('id', leadId)
    .single();

  if (leadError || !lead) {
    return { created: false, error: leadError?.message || 'Lead not found' };
  }

  const serviceTypeName = await resolveServiceTypeName(supabaseAdmin, lead);

  const { data: checklistId, error: rpcError } = await supabaseAdmin.rpc('generate_service_checklist', {
    p_lead_id: leadId,
    p_mechanic_id: mechanicId,
    p_service_type: serviceTypeName,
  });

  if (rpcError) {
    console.warn('ensureLeadServiceChecklist rpc failed:', rpcError.message);
    return { created: false, error: rpcError.message };
  }

  return { created: true, checklistId };
}

export function parseServiceChecklistItems(raw: unknown) {
  let items: unknown = raw;
  if (typeof items === 'string') {
    try {
      items = JSON.parse(items);
    } catch {
      return [];
    }
  }
  if (!Array.isArray(items)) return [];

  return items.map((item: any, index: number) => {
    const status = String(item?.status || '').toUpperCase();
    return {
      id: String(item?.id ?? index + 1),
      item_name: String(item?.name || item?.item_name || `Task ${index + 1}`),
      is_completed: status === 'COMPLETED' || status === 'DONE' || item?.is_completed === true,
      category: item?.category ? String(item.category) : undefined,
    };
  });
}
