import { getMetaAdsSettings, normalizeAdAccountId } from './settings';

export const META_ADS_GRAPH_VERSION = process.env.META_ADS_GRAPH_VERSION || 'v21.0';
export const META_ADS_GRAPH_BASE = `https://graph.facebook.com/${META_ADS_GRAPH_VERSION}`;

const INSIGHT_FIELDS =
  'spend,impressions,clicks,ctr,cpc,cpm,reach,frequency,actions,cost_per_action_type,inline_link_clicks';

export type GraphError = { message: string; code?: number; type?: string };

export type InsightRow = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  ctr?: string;
  cpc?: string;
  cpm?: string;
  reach?: string;
  frequency?: string;
  inline_link_clicks?: string;
  actions?: Array<{ action_type: string; value: string }>;
  cost_per_action_type?: Array<{ action_type: string; value: string }>;
  campaign_id?: string;
  campaign_name?: string;
  adset_id?: string;
  ad_id?: string;
  date_start?: string;
  date_stop?: string;
};

function graphErrorMessage(json: any, status: number): string {
  const err = json?.error;
  const code = Number(err?.code);
  const msg = String(err?.message || '');
  if (code === 4 || code === 17 || code === 613 || /request limit|too many calls|user request limit/i.test(msg)) {
    return 'Meta rate limit — wait 10–15 minutes, then Reload once. Do not keep clicking Test / Reload.';
  }
  if (err?.message) {
    const extra = err.error_user_msg || err.error_user_title;
    return extra ? `${err.message} — ${extra}` : String(err.message);
  }
  return `Meta Graph API HTTP ${status}`;
}

export async function graphGet<T = any>(
  path: string,
  params: Record<string, string | number | undefined> = {},
  tokenOverride?: string,
): Promise<T> {
  const settings = tokenOverride ? null : await getMetaAdsSettings();
  const token = (tokenOverride || settings?.accessToken || '').trim();
  if (!token) throw new Error('Meta Ads access token is not configured.');

  const cleanPath = path.replace(/^\//, '');
  const url = new URL(`${META_ADS_GRAPH_BASE}/${cleanPath}`);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === '') continue;
    url.searchParams.set(key, String(value));
  }
  url.searchParams.set('access_token', token);

  const res = await fetch(url.toString(), { cache: 'no-store' });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || (json as any)?.error) {
    throw new Error(graphErrorMessage(json, res.status));
  }
  return json as T;
}

const LEAD_ACTION_TYPES = [
  'lead',
  'onsite_conversion.lead_grouped',
  'onsite_web_lead',
  'offsite_conversion.fb_pixel_lead',
];

const MESSAGE_ACTION_TYPES = [
  'onsite_conversion.messaging_conversation_started_7d',
  'onsite_conversion.total_messaging_connection',
  'onsite_conversion.messaging_first_reply',
  'onsite_conversion.messaging_conversation_started_7d',
  'conversations_started',
  'messaging_conversation_started_7d',
];

function actionValue(actions: InsightRow['actions'], types: string[]): number {
  if (!Array.isArray(actions)) return 0;
  for (const type of types) {
    const hit = actions.find((a) => a.action_type === type);
    if (hit) return Number(hit.value || 0);
  }
  return 0;
}

export function extractLeadCount(actions?: Array<{ action_type: string; value: string }>): number {
  return actionValue(actions, LEAD_ACTION_TYPES);
}

export function summarizeInsights(row?: InsightRow | null) {
  const spend = Number(row?.spend || 0);
  const impressions = Number(row?.impressions || 0);
  const clicks = Number(row?.clicks || 0);
  const leads = extractLeadCount(row?.actions);
  const messaging = actionValue(row?.actions, MESSAGE_ACTION_TYPES);
  const results = leads + messaging;
  return {
    spend,
    impressions,
    clicks,
    ctr: Number(row?.ctr || 0),
    cpc: Number(row?.cpc || 0),
    cpm: Number(row?.cpm || 0),
    reach: Number(row?.reach || 0),
    leads,
    messaging,
    results,
    cpl: leads > 0 ? spend / leads : 0,
    cpr: results > 0 ? spend / results : 0,
    date_start: row?.date_start || null,
    date_stop: row?.date_stop || null,
  };
}

export async function resolveAccountId(override?: string): Promise<string> {
  if (override) return normalizeAdAccountId(override);
  const settings = await getMetaAdsSettings();
  if (!settings.accountId) throw new Error('Meta Ad Account ID is not configured.');
  return settings.accountId;
}

export const DEFAULT_INSIGHT_FIELDS = INSIGHT_FIELDS;
