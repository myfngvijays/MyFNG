import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const META_ADS_PLAYBOOK_KEY = 'meta_ads_playbook';

export type MetaAdsPlaybook = {
  goal: string;
  audience: string;
  offers: string;
  copy_rules: string;
  decision_rules: string;
};

export const DEFAULT_META_ADS_PLAYBOOK: MetaAdsPlaybook = {
  goal:
    'Primary KPI: WhatsApp chats (messaging conversations), then booked services. Optimise for chats per rupee (CPR), not vanity CTR. Mumbai / Thane / Navi Mumbai car service.',
  audience:
    'Car owners 3+ years old cars in Thane, Navi Mumbai, Panvel, Mumbai. Want trusted workshop vs dealer price. Language: Hindi + English mix. Offer doorstep pickup.',
  offers:
    'USPs: free pickup & drop, photo/video proof, OEM/OES parts, transparent price, 3 month / 1000 km warranty, same-day where possible. CTA: WhatsApp / Book now — not generic Learn more.',
  copy_rules:
    'Headline ≤ 40 chars, one promise. Primary text: problem → MyFNG proof → CTA. Localise city (Thane / Panvel) when the ad set is geo-specific. Avoid all-caps spam. Trust lines beat jokes. Always a clear Book / WhatsApp verb.',
  decision_rules:
    'Last 7 days, among ACTIVE ads: KEEP/scale the ad with best chats and lowest CPR if spend is meaningful. TEST ads with ok CTR but weak chats — rewrite CTA/headline. PAUSE ads that spend with ~0 chats vs siblings. Never invent a winner without numbers. Read-only: user must change Ads Manager themselves.',
};

function asPlaybook(raw: unknown): MetaAdsPlaybook {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pick = (key: keyof MetaAdsPlaybook) => {
    const v = String(o[key] || '').trim();
    return v || DEFAULT_META_ADS_PLAYBOOK[key];
  };
  return {
    goal: pick('goal'),
    audience: pick('audience'),
    offers: pick('offers'),
    copy_rules: pick('copy_rules'),
    decision_rules: pick('decision_rules'),
  };
}

export async function getMetaAdsPlaybook(): Promise<MetaAdsPlaybook> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ...DEFAULT_META_ADS_PLAYBOOK };
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', META_ADS_PLAYBOOK_KEY)
    .maybeSingle();
  const raw = String((data as { setting_value?: string } | null)?.setting_value || '').trim();
  if (!raw) return { ...DEFAULT_META_ADS_PLAYBOOK };
  try {
    return asPlaybook(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_META_ADS_PLAYBOOK };
  }
}

export async function saveMetaAdsPlaybook(
  input: Partial<MetaAdsPlaybook>,
  userId?: string | null,
): Promise<MetaAdsPlaybook> {
  const next = asPlaybook({ ...DEFAULT_META_ADS_PLAYBOOK, ...input });
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Admin client unavailable');
  const { error: upErr } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: META_ADS_PLAYBOOK_KEY,
      setting_value: JSON.stringify(next),
      setting_type: 'STRING',
      category: 'INTEGRATIONS',
      description: 'MyFNG Meta Ads advisor playbook (goal, copy rules, keep/test/pause)',
      is_editable: true,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (upErr) throw new Error(upErr.message);
  return next;
}

export function playbookToPrompt(book: MetaAdsPlaybook): string {
  return [
    `Goal: ${book.goal}`,
    `Audience: ${book.audience}`,
    `Offers / USPs: ${book.offers}`,
    `Copy rules: ${book.copy_rules}`,
    `Decision rules: ${book.decision_rules}`,
  ].join('\n');
}
