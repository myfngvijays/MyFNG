import {
  getFundsTracker,
  getInsightsBreakdown,
  getSpendSummary,
  listCampaignInsights,
  listEntityInsights,
} from './tools';
import { money, num, pct, reportToPrintHtml } from './reportView';

export type ReportPeriod = 'today' | 'last_7d' | 'last_30d' | 'briefing';

export type ReportQuery = {
  period?: ReportPeriod | string;
  date_preset?: string;
  since?: string;
  until?: string;
};

const PERIOD_LABEL: Record<string, string> = {
  today: 'Today',
  yesterday: 'Yesterday',
  last_7d: 'Last 7 days',
  last_14d: 'Last 14 days',
  last_28d: 'Last 28 days',
  last_30d: 'Last 30 days',
  this_week_mon_today: 'This week',
  last_week_mon_sun: 'Last week',
  this_month: 'This month',
  last_month: 'Last month',
  maximum: 'Maximum',
  briefing: 'Full briefing',
};

function periodBlock(label: string, row: any, currency: string) {
  if (!row) return `${label}: data nahi mili`;
  const wa = Number(row.messaging || 0);
  const leads = Number(row.leads || 0);
  const results = Number(row.results || leads + wa);
  const cpr = row.cpr || row.cpl || 0;
  return [
    `${label}`,
    `  Spend: ${money(row.spend, currency)}`,
    `  Results: ${num(results)}${wa ? ` (${num(wa)} WA chats)` : leads ? ` (${num(leads)} leads)` : ''}`,
    `  CPR: ${money(cpr, currency)} · CPL: ${money(row.cpl, currency)}`,
    `  Clicks: ${num(row.clicks)} · Impr: ${num(row.impressions)} · CTR: ${pct(row.ctr)} · CPC: ${money(row.cpc, currency)} · CPM: ${money(row.cpm, currency)} · Reach: ${num(row.reach)}`,
  ].join('\n');
}

export function guessReportPeriod(message: string): ReportPeriod | null {
  const q = String(message || '').toLowerCase();
  const wantsReport = /report|briefing|\bpdf\b|excel|csv|report nikal|report banao|poori report|ads report|summary bhej|summary nikal/.test(
    q,
  );
  if (!wantsReport) return null;
  if (/\b(aaj|today|aj)\b/.test(q)) return 'today';
  if (/\b30\b|mahina|month/.test(q)) return 'last_30d';
  if (/\b7\b|hafta|week/.test(q)) return 'last_7d';
  return 'briefing';
}

export function normalizeReportQuery(input: ReportPeriod | ReportQuery | string = 'last_7d'): ReportQuery {
  if (typeof input === 'string') {
    if (input === 'briefing') return { period: 'briefing', date_preset: 'last_30d' };
    return { period: input, date_preset: input === 'last_7d' || input === 'today' || input === 'last_30d' ? input : input };
  }
  const since = String(input.since || '').slice(0, 10);
  const until = String(input.until || '').slice(0, 10);
  if (since && until) return { period: input.period || 'custom', since, until };
  const datePreset = String(input.date_preset || input.period || 'last_7d');
  if (datePreset === 'briefing') return { period: 'briefing', date_preset: 'last_30d' };
  return { period: input.period || datePreset, date_preset: datePreset };
}

function dateLabel(q: ReportQuery) {
  if (q.since && q.until) return `${q.since} – ${q.until}`;
  return PERIOD_LABEL[String(q.date_preset || q.period)] || String(q.date_preset || q.period);
}

async function safeBreakdown(label: string, params: Parameters<typeof getInsightsBreakdown>[0]) {
  const pack = await getInsightsBreakdown(params);
  if (pack && pack.ok === false && pack.error) {
    return { rows: [] as any[], error: `${label}: ${pack.error}` };
  }
  return { rows: Array.isArray(pack?.rows) ? pack.rows : [], error: '' };
}

export async function generateMetaAdsReport(input: ReportPeriod | ReportQuery | string = 'briefing') {
  const query = normalizeReportQuery(input);
  const isBriefing = query.period === 'briefing';
  const spend = await getSpendSummary();
  const currency = spend?.currency || spend?.account?.currency || 'INR';
  const time = { date_preset: query.date_preset, since: query.since, until: query.until };
  const breakdownErrors: string[] = [];

  const [campaignPack, adsetPack, adPack, accountPack, placementPack, platformPack, agePack, genderPack, countryPack, devicePack, hourPack, devicePlatPack, funds] =
    await Promise.all([
      listCampaignInsights({ status: 'ALL', limit: 100, ...time }).catch((e: any) => {
        breakdownErrors.push(e?.message || 'Campaigns failed');
        return { campaigns: [] as any[] };
      }),
      listEntityInsights({ level: 'adset', ...time }).catch((e: any) => {
        breakdownErrors.push(e?.message || 'Ad sets failed');
        return { rows: [] as any[] };
      }),
      listEntityInsights({ level: 'ad', ...time }).catch((e: any) => {
        breakdownErrors.push(e?.message || 'Ads failed');
        return { rows: [] as any[] };
      }),
      getInsightsBreakdown({ ...time, level: 'account' }).catch(() => ({ rows: [] as any[] })),
      safeBreakdown('Placement', { ...time, level: 'campaign', breakdowns: 'publisher_platform,platform_position' }),
      safeBreakdown('Platform', { ...time, level: 'campaign', breakdowns: 'publisher_platform' }),
      safeBreakdown('Age', { ...time, level: 'campaign', breakdowns: 'age' }),
      safeBreakdown('Gender', { ...time, level: 'campaign', breakdowns: 'gender' }),
      safeBreakdown('Country', { ...time, level: 'campaign', breakdowns: 'country' }),
      safeBreakdown('Device', { ...time, level: 'campaign', breakdowns: 'impression_device' }),
      safeBreakdown('Time of day', { ...time, level: 'campaign', breakdowns: 'hourly_stats_aggregated_by_advertiser_time_zone' }),
      safeBreakdown('Platform + device', { ...time, level: 'campaign', breakdowns: 'device_platform' }),
      isBriefing ? getFundsTracker(spend?.account?.id) : Promise.resolve(null),
    ]);

  for (const pack of [placementPack, platformPack, agePack, genderPack, countryPack, devicePack, hourPack, devicePlatPack]) {
    if (pack.error) breakdownErrors.push(pack.error);
  }

  const accountName = spend?.account?.name || 'My FNG Car Service';
  const accountId = spend?.account?.id || '';
  const stamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const rangeLabel = dateLabel(query);
  const title = isBriefing ? `${accountName} — Ads briefing` : `${accountName} — ${rangeLabel} report`;

  const rangeInsight = Array.isArray((accountPack as any)?.rows) ? (accountPack as any).rows[0] : null;
  const selectedInsight =
    rangeInsight || spend?.periods?.[String(query.date_preset)] || spend?.periods?.last_7d;

  const summary = isBriefing
    ? [
        { period: 'Today', ...(spend?.periods?.today || {}) },
        { period: 'Last 7 days', ...(spend?.periods?.last_7d || {}) },
        { period: 'Last 30 days', ...(spend?.periods?.last_30d || {}) },
      ]
    : [{ period: rangeLabel, ...(selectedInsight || {}) }];

  const campaigns = (Array.isArray(campaignPack?.campaigns) ? campaignPack.campaigns : []).map((c: any) => ({
    ...c,
    last_7d: c.metrics || c.last_7d,
  }));
  const adsets = Array.isArray(adsetPack?.rows) ? adsetPack.rows : [];
  const ads = Array.isArray(adPack?.rows) ? adPack.rows : [];

  const lines: string[] = [
    title,
    `Generated ${stamp} IST`,
    accountId ? `Account ${accountId}` : '',
    `Range: ${rangeLabel}`,
    '',
    'SPEND',
    ...summary.map((row) => periodBlock(String(row.period), row, currency)),
    '',
    `CAMPAIGNS (${campaigns.length}) · AD SETS (${adsets.length}) · ADS (${ads.length})`,
  ];

  for (const c of campaigns.filter((row: any) => String(row.effective_status || row.status) === 'ACTIVE').slice(0, 20)) {
    const p = c.metrics || {};
    lines.push(
      `• ${c.name} — ACTIVE — ${money(p.spend, currency)} — ${num(p.results)} results — CTR ${pct(p.ctr)}`,
    );
  }

  lines.push('', 'MyFNG Meta Ads — read-only live numbers.');
  const slug = (query.since && query.until ? `${query.since}_${query.until}` : String(query.date_preset || query.period || 'report')).replace(
    /[^a-z0-9_-]+/gi,
    '-',
  );
  const filename = `myfng-ads-${slug}-${new Date().toISOString().slice(0, 10)}.xlsx`;

  return {
    ok: true,
    period: query.period || query.date_preset || 'last_7d',
    date_preset: query.date_preset || null,
    since: query.since || null,
    until: query.until || null,
    range_label: rangeLabel,
    title,
    markdown: lines.join('\n'),
    filename,
    generated_at: new Date().toISOString(),
    account: { name: accountName, id: accountId, currency },
    periods: spend?.periods || {},
    summary,
    campaigns,
    adsets,
    ads,
    placements: placementPack.rows,
    platforms: platformPack.rows,
    ages: agePack.rows,
    genders: genderPack.rows,
    demographics: [...agePack.rows, ...genderPack.rows],
    countries: countryPack.rows,
    devices: devicePack.rows,
    hours: hourPack.rows,
    device_platforms: devicePlatPack.rows,
    funds: funds || null,
    rate_limited: Boolean(spend?.rate_limited),
    breakdown_errors: breakdownErrors.filter(Boolean),
  };
}

export function reportToHtml(report: { title: string; markdown: string; generated_at?: string }) {
  return reportToPrintHtml(report);
}
