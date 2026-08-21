import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

const TAG_COLORS = [
  '#DDD6FE',
  '#BFDBFE',
  '#FECACA',
  '#BBF7D0',
  '#FED7AA',
  '#FBCFE8',
  '#A5F3FC',
  '#FEF08A',
  '#C7D2FE',
  '#99F6E4',
  '#FDE68A',
  '#E9D5FF',
] as const;

/** Resolve tag ids including parent (common) tags. Creates missing tags by name. */
export async function ensureTagIdsByNames(
  names: string[],
  options?: { parentName?: string | null; color?: string },
): Promise<string[]> {
  const clean = Array.from(
    new Set(
      names
        .map((n) => String(n || '').trim())
        .filter(Boolean),
    ),
  );
  if (!clean.length) return [];

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return [];

  let parentId: string | null = null;
  const parentName = String(options?.parentName || '').trim();
  if (parentName) {
    const { data: parentRow } = await supabaseAdmin
      .from('crm_lead_tags')
      .select('id, name')
      .ilike('name', parentName)
      .maybeSingle();
    if (parentRow?.id) {
      parentId = String(parentRow.id);
    } else {
      const { data: created } = await supabaseAdmin
        .from('crm_lead_tags')
        .insert({ name: parentName, color: options?.color || TAG_COLORS[0] })
        .select('id')
        .single();
      parentId = created?.id ? String(created.id) : null;
    }
  }

  const ids: string[] = [];
  if (parentId) ids.push(parentId);

  for (const name of clean) {
    if (parentName && name.toLowerCase() === parentName.toLowerCase()) continue;

    const { data: existing } = await supabaseAdmin
      .from('crm_lead_tags')
      .select('id, parent_tag_id')
      .ilike('name', name)
      .maybeSingle();

    if (existing?.id) {
      ids.push(String(existing.id));
      if (existing.parent_tag_id) ids.push(String(existing.parent_tag_id));
      else if (parentId && !existing.parent_tag_id) {
        await supabaseAdmin
          .from('crm_lead_tags')
          .update({ parent_tag_id: parentId })
          .eq('id', existing.id);
      }
      continue;
    }

    const { data: created } = await supabaseAdmin
      .from('crm_lead_tags')
      .insert({
        name,
        color: options?.color || TAG_COLORS[ids.length % TAG_COLORS.length],
        parent_tag_id: parentId,
      })
      .select('id')
      .single();
    if (created?.id) ids.push(String(created.id));
  }

  return Array.from(new Set(ids));
}

/** Merge-add tags onto a lead (does not remove existing). Also adds parent tags. */
export async function addLeadTags(
  leadId: string,
  tagIds: string[],
  taggedBy?: string | null,
): Promise<{ ok: boolean; tag_ids: string[]; error?: string }> {
  const lead = String(leadId || '').trim();
  const incoming = Array.from(new Set(tagIds.map((x) => String(x || '').trim()).filter(Boolean)));
  if (!lead || !incoming.length) return { ok: true, tag_ids: [] };

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ok: false, tag_ids: [], error: 'Admin unavailable' };

  // Expand parents
  const { data: rows } = await supabaseAdmin
    .from('crm_lead_tags')
    .select('id, parent_tag_id')
    .in('id', incoming);
  const expanded = new Set(incoming);
  for (const r of rows || []) {
    if (r.parent_tag_id) expanded.add(String(r.parent_tag_id));
  }

  const { data: existingMap } = await supabaseAdmin
    .from('crm_lead_tag_map')
    .select('tag_id')
    .eq('lead_id', lead);
  const have = new Set((existingMap || []).map((m: any) => String(m.tag_id)));
  const toInsert = Array.from(expanded).filter((id) => !have.has(id));
  if (!toInsert.length) return { ok: true, tag_ids: Array.from(expanded) };

  const { error } = await supabaseAdmin.from('crm_lead_tag_map').insert(
    toInsert.map((tag_id) => ({
      lead_id: lead,
      tag_id,
      tagged_by: taggedBy || null,
    })),
  );
  if (error) return { ok: false, tag_ids: [], error: error.message };
  return { ok: true, tag_ids: Array.from(expanded) };
}

/** Move / merge tags from soft-deleted duplicate leads onto the surviving lead. */
export async function mergeLeadTagsFromLosers(
  winnerLeadId: string,
  loserLeadIds: string[],
): Promise<void> {
  const winner = String(winnerLeadId || '').trim();
  const losers = Array.from(new Set(loserLeadIds.map((x) => String(x || '').trim()).filter(Boolean)));
  if (!winner || !losers.length) return;

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return;

  const { data: maps } = await supabaseAdmin
    .from('crm_lead_tag_map')
    .select('tag_id')
    .in('lead_id', losers);
  const tagIds = Array.from(
    new Set((maps || []).map((m: any) => String(m.tag_id || '').trim()).filter(Boolean)),
  );
  if (!tagIds.length) return;
  await addLeadTags(winner, tagIds);
}

/**
 * TeleCRM-style Meta Ads tags from lead_source / trigger label / referral.
 * Always includes common "Meta Ads" when Meta channel; plus specific child when known.
 */
export function resolveMetaAdTagNames(input: {
  leadSource?: string | null;
  triggerLabel?: string | null;
  referralHeadline?: string | null;
  markAsMeta?: boolean;
}): { parent: string | null; specific: string | null; names: string[] } {
  const source = String(input.leadSource || '').trim();
  const trigger = String(input.triggerLabel || '').trim();
  const headline = String(input.referralHeadline || '').trim();
  const isMeta =
    Boolean(input.markAsMeta) ||
    /meta\s*ads|facebook\s*ads|instagram\s*ads|ctwa/i.test(source) ||
    Boolean(trigger);

  if (!isMeta && !/meta|facebook|instagram/i.test(source)) {
    return { parent: null, specific: null, names: [] };
  }

  const parent = /instagram/i.test(source)
    ? 'Instagram Ads'
    : /facebook/i.test(source) && !/meta ads/i.test(source)
      ? 'Facebook Ads'
      : 'Meta Ads';

  let specific: string | null = null;
  const afterDot = source.match(/meta\s*ads\s*[·\-–—:]\s*(.+)$/i);
  if (afterDot?.[1]) {
    specific = `Meta Ads ${afterDot[1].trim()}`;
  } else if (trigger) {
    // Avoid "Meta Ads Meta Ads A"
    const label = trigger.replace(/^meta\s*ads\s*/i, '').trim() || trigger;
    specific = /^meta\s*ads/i.test(trigger) ? trigger : `Meta Ads ${label}`;
  } else if (headline) {
    specific = `Meta Ads ${headline.slice(0, 48).trim()}`;
  }

  const names = [parent];
  if (specific && specific.toLowerCase() !== parent.toLowerCase()) names.push(specific);
  return { parent, specific, names };
}

/** Stamp CRM disposition Fresh on coupon_meta (TeleCRM reopen). */
export function stampFreshOnMeta(meta: Record<string, unknown>): Record<string, unknown> {
  return {
    ...meta,
    last_call_result: 'FRESH',
    last_call_label: 'Fresh',
    refreshed_at: new Date().toISOString(),
    refreshed_reason: 'whatsapp_inbound',
  };
}
