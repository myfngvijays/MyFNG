import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const GOOGLE_ADS_PLAYBOOK_KEY = 'google_ads_playbook';

export type GoogleAdsPlaybook = {
  goal: string;
  audience: string;
  offers: string;
  copy_rules: string;
  decision_rules: string;
};

export const DEFAULT_GOOGLE_ADS_PLAYBOOK: GoogleAdsPlaybook = {
  goal:
    'Primary KPI: booked service conversions, then conversion value. Optimise for CPL / ROAS, not vanity CTR. Mumbai / Thane / Navi Mumbai car service.',
  audience:
    'Car owners with 3+ year old cars in Thane, Navi Mumbai, Panvel, Mumbai. Want trusted workshop vs dealer price. Hindi + English mix. Doorstep pickup.',
  offers:
    'USPs: free pickup & drop, photo/video proof, OEM/OES parts, transparent price, 3 month / 1000 km warranty, same-day where possible. CTA: Book now / Call — not generic Learn more.',
  copy_rules:
    'RSA headlines: one promise per line, city when geo-specific (Thane / Panvel). Avoid all-caps spam. Trust lines beat jokes. Always a clear Book / Call verb.',
  decision_rules:
    'Last 7 days, ENABLED campaigns/ads: KEEP/scale the one with best conversions and lowest CPL if spend is meaningful. TEST ads with ok CTR but weak conversions — rewrite headline. PAUSE ads that spend with ~0 conversions vs siblings. Never invent a winner. Read-only: change Google Ads UI yourself.',
};

function asPlaybook(raw: unknown): GoogleAdsPlaybook {
  const o = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const pick = (key: keyof GoogleAdsPlaybook) => {
    const v = String(o[key] || '').trim();
    return v || DEFAULT_GOOGLE_ADS_PLAYBOOK[key];
  };
  return {
    goal: pick('goal'),
    audience: pick('audience'),
    offers: pick('offers'),
    copy_rules: pick('copy_rules'),
    decision_rules: pick('decision_rules'),
  };
}

export async function getGoogleAdsPlaybook(): Promise<GoogleAdsPlaybook> {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) return { ...DEFAULT_GOOGLE_ADS_PLAYBOOK };
  const { data } = await supabaseAdmin
    .from('system_settings')
    .select('setting_value')
    .eq('setting_key', GOOGLE_ADS_PLAYBOOK_KEY)
    .maybeSingle();
  const raw = String((data as { setting_value?: string } | null)?.setting_value || '').trim();
  if (!raw) return { ...DEFAULT_GOOGLE_ADS_PLAYBOOK };
  try {
    return asPlaybook(JSON.parse(raw));
  } catch {
    return { ...DEFAULT_GOOGLE_ADS_PLAYBOOK };
  }
}

export async function saveGoogleAdsPlaybook(
  input: Partial<GoogleAdsPlaybook>,
  userId?: string | null,
): Promise<GoogleAdsPlaybook> {
  const next = asPlaybook({ ...DEFAULT_GOOGLE_ADS_PLAYBOOK, ...input });
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Admin client unavailable');
  const { error: upErr } = await supabaseAdmin.from('system_settings').upsert(
    {
      setting_key: GOOGLE_ADS_PLAYBOOK_KEY,
      setting_value: JSON.stringify(next),
      setting_type: 'STRING',
      category: 'INTEGRATIONS',
      description: 'MyFNG Google Ads advisor playbook (goal, copy rules, keep/test/pause)',
      is_editable: true,
      updated_by: userId || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'setting_key' },
  );
  if (upErr) throw new Error(upErr.message);
  return next;
}

export function playbookToPrompt(book: GoogleAdsPlaybook): string {
  return [
    `Goal: ${book.goal}`,
    `Audience: ${book.audience}`,
    `Offers / USPs: ${book.offers}`,
    `Copy rules: ${book.copy_rules}`,
    `Decision rules: ${book.decision_rules}`,
  ].join('\n');
}
