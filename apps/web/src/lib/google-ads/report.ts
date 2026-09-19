import {
  getCampaignDetail,
  getSpendSummary,
  listAdGroups,
  listAds,
  listCampaigns,
  listConversionActions,
  listKeywords,
  listSearchTerms,
} from './tools';

export type GoogleAdsReportPeriod = 'today' | 'last_7d' | 'last_30d' | 'briefing' | 'custom';

function duringFor(period: string) {
  if (period === 'today') return 'TODAY';
  if (period === 'last_30d' || period === 'briefing') return 'LAST_30_DAYS';
  if (period === 'custom') return '';
  return 'LAST_7_DAYS';
}

function inr(n: number | null | undefined, currency = 'INR') {
  if (n == null || Number.isNaN(Number(n))) return '—';
  return `${currency} ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}

function periodLabel(period: string) {
  if (period === 'today') return 'Today';
  if (period === 'last_30d') return 'Last 30 days';
  if (period === 'briefing') return 'Full briefing · last 30 days';
  if (period === 'custom') return 'Selected dates';
  return 'Last 7 days';
}

export function guessGoogleAdsReportPeriod(message: string): GoogleAdsReportPeriod | null {
  const q = String(message || '').toLowerCase();
  if (/headline|suggest|ad copy|keyword.*hisaab|ke hisaab se/.test(q)) return null;
  const wants =
    /briefing|\bpdf\b|\bexcel\b|\bcsv\b|report nikal|report banao|poori report|ads report|spend report|summary bhej|(^|\s)(report de|ka report)\b/.test(
      q,
    );
  if (!wants) return null;
  if (/\b(aaj|today|aj)\b/.test(q)) return 'today';
  if (/\b30\b|mahina|month/.test(q)) return 'last_30d';
  if (/\b7\b|hafta|week/.test(q)) return 'last_7d';
  return 'briefing';
}

function pickPeriod(summary: any, period: string) {
  if (period === 'today') return summary.periods?.today;
  if (period === 'last_30d' || period === 'briefing') return summary.periods?.last_30d;
  if (period === 'custom') return summary.periods?.selected || summary.periods?.last_7d;
  return summary.periods?.last_7d;
}

function campaignIdOf(value?: string) {
  return String(value || '').replace(/\D/g, '');
}

function isOff(status?: string) {
  return /PAUSED|REMOVED|HIDDEN|ENDED|UNKNOWN/.test(String(status || '').toUpperCase());
}

function hasActivity(row: any) {
  return Number(row?.spend || 0) > 0 || Number(row?.clicks || 0) > 0 || Number(row?.conversions || 0) > 0;
}

function liveRows<T extends { status?: string }>(rows: T[], keepZero = true): T[] {
  return (rows || []).filter((row) => {
    if (isOff(row.status)) return false;
    return keepZero || hasActivity(row);
  });
}

function belongsToCampaign(row: any, campaigns: any[]) {
  if (!campaigns.length) return false;
  const ids = new Set(campaigns.map((c) => String(c.id || '')));
  const names = new Set(campaigns.map((c) => String(c.name || '')));
  const cid = String(row?.campaign_id || '');
  const name = String(row?.campaign || '');
  if (cid && ids.has(cid)) return true;
  if (name && names.has(name)) return true;
  return !cid && !name;
}

function metricsFromCampaign(campaign: any) {
  return {
    spend: Number(campaign?.spend || 0),
    clicks: Number(campaign?.clicks || 0),
    impressions: Number(campaign?.impressions || 0),
    conversions: Number(campaign?.conversions || 0),
    conversionValue: Number(campaign?.conversionValue || campaign?.conversion_value || 0),
    ctr: campaign?.ctr ?? null,
    cpc: campaign?.cpc ?? null,
    cpl: campaign?.cpl ?? null,
    roas: campaign?.roas ?? null,
  };
}

function buildInsights(campaigns: any[], ads: any[], terms: any[], metrics: any) {
  const spenders = [...campaigns].filter((c) => Number(c.spend || 0) > 0);
  const winners = [...spenders].filter((c) => Number(c.conversions || 0) > 0).sort((a, b) => b.conversions - a.conversions);
  const wasteCampaigns = spenders.filter((c) => Number(c.conversions || 0) === 0 && Number(c.spend || 0) >= 50);
  const wasteAds = ads.filter((a) => Number(a.spend || 0) >= 50 && Number(a.conversions || 0) === 0);
  const wasteTerms = terms.filter((t) => Number(t.clicks || 0) >= 8 && Number(t.conversions || 0) === 0);
  const avgCpl = Number(metrics?.cpl || 0);
  const costly = spenders.filter((c) => avgCpl > 0 && c.cpl != null && Number(c.cpl) > avgCpl * 1.6);
  const lines: string[] = [];
  if (winners[0]) {
    lines.push(`Scale: ${winners[0].name} — ${winners[0].conversions} results, ${inr(winners[0].spend)} spend.`);
  }
  if (wasteCampaigns[0]) {
    lines.push(`Review: ${wasteCampaigns[0].name} ne ${inr(wasteCampaigns[0].spend)} spend kiya, 0 results.`);
  }
  if (wasteAds[0]) {
    lines.push(`Test/pause ad: ${wasteAds[0].name} — ${inr(wasteAds[0].spend)} with 0 results.`);
  }
  if (wasteTerms[0]) {
    lines.push(`Search term waste: “${wasteTerms[0].text}” — ${wasteTerms[0].clicks} clicks, 0 results.`);
  }
  if (costly[0]) {
    lines.push(`High CPL: ${costly[0].name} at ${inr(costly[0].cpl)} vs account ${inr(avgCpl)}.`);
  }
  if (!lines.length) lines.push('Is range me clear Keep / Pause signal nahi — spend aur results dono low hain.');
  return {
    lines,
    winners: winners.slice(0, 3),
    waste_campaigns: wasteCampaigns.slice(0, 5),
    waste_ads: wasteAds.slice(0, 5),
    waste_terms: wasteTerms.slice(0, 8),
    costly: costly.slice(0, 3),
  };
}

function packReport(input: {
  period: string;
  range: { during?: string; since?: string; until?: string };
  title: string;
  label: string;
  currency: string;
  account: any;
  metrics: any;
  daily: any[];
  campaignId: string;
  campaign: any;
  campaigns: any[];
  adGroups: any[];
  ads: any[];
  keywords: any[];
  terms: any[];
  conversions: any[];
  conversionTotals: any;
  insights: any;
}) {
  const {
    period,
    range,
    title,
    label,
    currency,
    account,
    metrics,
    daily,
    campaignId,
    campaign,
    campaigns,
    adGroups,
    ads,
    keywords,
    terms,
    conversions,
    conversionTotals,
    insights,
  } = input;
  const scope = campaign?.name || 'All enabled campaigns';
  const lines = [
    title,
    `${account?.name || 'Account'} · ${account?.id || ''} · ${currency}`,
    `Scope: ${scope}`,
    `Generated ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST`,
    '',
    campaign ? 'CAMPAIGN' : 'ACCOUNT',
    `Spend: ${inr(metrics.spend, currency)}`,
    `Clicks: ${metrics.clicks || 0} · Impr: ${metrics.impressions || 0} · CTR: ${metrics.ctr || 0}%`,
    `Results: ${metrics.conversions || 0} · CPL: ${metrics.cpl != null ? inr(metrics.cpl, currency) : '—'} · CPC: ${metrics.cpc != null ? inr(metrics.cpc, currency) : '—'}`,
    '',
    'INSIGHTS',
    ...insights.lines.map((line: string) => `• ${line}`),
    '',
    campaign ? 'THIS CAMPAIGN' : 'LIVE CAMPAIGNS',
    ...(campaign
      ? [`  ${campaign.name} · ${inr(campaign.spend, currency)} · ${campaign.conversions || 0} results · ${campaign.status}`]
      : campaigns.map((c) => `  ${c.name} · ${inr(c.spend, currency)} · ${c.conversions} results · CPL ${c.cpl != null ? inr(c.cpl, currency) : '—'} · ${c.status}`)),
    '',
    'AD GROUPS',
    ...(adGroups.length
      ? adGroups.map((g: any) => `  ${g.name} · ${inr(g.spend, currency)} · ${g.conversions || 0} results · ${g.campaign || ''}`)
      : ['  —']),
    '',
    'ADS',
    ...(ads.length ? ads.map((a: any) => `  ${a.name} · ${inr(a.spend, currency)} · ${a.conversions} results · ${a.status}`) : ['  —']),
    '',
    'CONVERSIONS FIRED',
    ...(conversions.length
      ? conversions.map((c: any) => `  ${c.name} · Results ${c.conversions || 0} · All ${c.all_conversions || 0} · ${c.in_results ? 'In Results' : 'Secondary'}`)
      : ['  —']),
    '',
    'KEYWORDS',
    ...(keywords.length ? keywords.map((k: any) => `  ${k.text} (${k.match}) · ${inr(k.spend, currency)} · ${k.clicks || 0} clicks`) : ['  —']),
    '',
    'SEARCH TERMS',
    ...(terms.length ? terms.map((t: any) => `  ${t.text} · ${t.clicks} clicks · ${inr(t.spend, currency)} · ${t.conversions || 0} results`) : ['  —']),
  ];
  return {
    period,
    during: range.during || 'CUSTOM',
    since: range.since,
    until: range.until,
    title,
    label,
    generated_at: new Date().toISOString(),
    currency,
    account,
    metrics,
    daily,
    campaign_id: campaignId || '',
    campaign: campaign || null,
    campaigns,
    ad_groups: adGroups,
    ads,
    keywords,
    search_terms: terms,
    conversions,
    conversion_totals: conversionTotals || {},
    insights,
    markdown: lines.join('\n'),
  };
}

export async function generateGoogleAdsReport(
  period: string = 'last_7d',
  dateOpts?: { during?: string; since?: string; until?: string; campaign_id?: string },
) {
  const campaignId = campaignIdOf(dateOpts?.campaign_id);
  const range =
    period === 'custom'
      ? { during: dateOpts?.during, since: dateOpts?.since, until: dateOpts?.until }
      : { during: duringFor(period) };
  const listBase = { ...range, status: 'ENABLED', limit: campaignId ? 80 : 40 };

  const [summary, liveCampaigns] = await Promise.all([
    getSpendSummary(undefined, range),
    listCampaigns({ ...listBase, limit: 80, status: 'ENABLED' }),
  ]);

  const campaigns = liveRows(liveCampaigns).sort((a, b) => Number(b.spend || 0) - Number(a.spend || 0));
  const currency = summary.currency || 'INR';
  const title = `MyFNG Google Ads — ${periodLabel(period)}`;
  const label = periodLabel(period);

  if (campaignId) {
    const detail = await getCampaignDetail(campaignId, { ...range, status: 'ENABLED', limit: 80 });
    const campaign = detail.campaign;
    const adGroups = liveRows(detail.ad_groups || [], true);
    const ads = liveRows(detail.ads || [], true);
    const keywords = liveRows(detail.keywords || [], true);
    const terms = (detail.search_terms || []).filter((t: any) => !isOff(t.status));
    const conversions = (detail.conversions || []).filter((c: any) => Number(c.conversions || 0) + Number(c.all_conversions || 0) > 0);
    const metrics = metricsFromCampaign(campaign);
    const insights = buildInsights([campaign], ads, terms, metrics);
    return packReport({
      period,
      range,
      title: `${title} · ${campaign?.name || campaignId}`,
      label: `${campaign?.name || 'Campaign'} · ${label}`,
      currency,
      account: summary.account,
      metrics,
      daily: detail.daily || [],
      campaignId,
      campaign,
      campaigns,
      adGroups,
      ads,
      keywords,
      terms,
      conversions,
      conversionTotals: conversions.reduce(
        (acc: any, row: any) => ({
          conversions: acc.conversions + Number(row.conversions || 0),
          all_conversions: acc.all_conversions + Number(row.all_conversions || 0),
        }),
        { conversions: 0, all_conversions: 0 },
      ),
      insights,
    });
  }

  const [adGroupsRaw, adsRaw, keywordsRaw, termsRaw, conversions] = await Promise.all([
    listAdGroups({ ...listBase, status: 'ENABLED' }).catch(() => []),
    listAds({ ...listBase, status: 'ENABLED' }),
    listKeywords({ ...listBase, status: 'ENABLED' }),
    listSearchTerms({ ...listBase }),
    listConversionActions(range).catch(() => ({ fired: [], actions: [], totals: {} })),
  ]);

  const adGroups = liveRows(adGroupsRaw, false).filter((row) => belongsToCampaign(row, campaigns));
  const ads = liveRows(adsRaw, false).filter((row) => belongsToCampaign(row, campaigns));
  const keywords = liveRows(keywordsRaw, false).filter((row) => belongsToCampaign(row, campaigns));
  const terms = (termsRaw || []).filter((row: any) => belongsToCampaign(row, campaigns) && hasActivity(row));
  const metrics = pickPeriod(summary, period) || summary.periods?.selected || {};
  const insights = buildInsights(campaigns, ads, terms, metrics);

  return packReport({
    period,
    range,
    title,
    label,
    currency,
    account: summary.account,
    metrics,
    daily: summary.daily || [],
    campaignId: '',
    campaign: null,
    campaigns,
    adGroups,
    ads,
    keywords,
    terms,
    conversions: conversions.fired || [],
    conversionTotals: conversions.totals || {},
    insights,
  });
}
