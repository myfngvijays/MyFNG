import { getSpendSummary, listAds, listCampaigns, listKeywords, listSearchTerms } from './tools';

export type GoogleAdsReportPeriod = 'today' | 'last_7d' | 'last_30d' | 'briefing';

function duringFor(period: string) {
  if (period === 'today') return 'TODAY';
  if (period === 'last_30d' || period === 'briefing') return 'LAST_30_DAYS';
  return 'LAST_7_DAYS';
}

function inr(n: number, currency = 'INR') {
  return `${currency} ${Math.round(Number(n) || 0).toLocaleString('en-IN')}`;
}

export function guessGoogleAdsReportPeriod(message: string): GoogleAdsReportPeriod | null {
  const q = String(message || '').toLowerCase();
  const wants = /report|briefing|\bpdf\b|excel|csv|report nikal|report banao|poori report|ads report|summary bhej/.test(q);
  if (!wants) return null;
  if (/\b(aaj|today|aj)\b/.test(q)) return 'today';
  if (/\b30\b|mahina|month/.test(q)) return 'last_30d';
  if (/\b7\b|hafta|week/.test(q)) return 'last_7d';
  return 'briefing';
}

export async function generateGoogleAdsReport(
  period: string = 'last_7d',
  dateOpts?: { during?: string; since?: string; until?: string },
) {
  const range = dateOpts?.during || duringFor(period);
  const opts = { during: range, since: dateOpts?.since, until: dateOpts?.until };
  const [summary, campaigns, ads, keywords, terms] = await Promise.all([
    getSpendSummary(undefined, opts),
    listCampaigns({ ...opts, limit: 15, status: period === 'briefing' ? 'ALL' : 'ENABLED' }),
    listAds({ ...opts, limit: 10, status: 'ENABLED' }),
    listKeywords({ ...opts, limit: 10 }),
    listSearchTerms({ ...opts, limit: 10 }),
  ]);
  const currency = summary.currency || 'INR';
  const p = period === 'today' ? summary.periods.today : period === 'last_30d' || period === 'briefing' ? summary.periods.last_30d : summary.periods.last_7d;
  const lines = [
    `MyFNG Google Ads — ${period}`,
    `${summary.account?.name || 'Account'} · ${summary.account?.id || ''}`,
    '',
    `Spend: ${inr(p.spend, currency)}`,
    `Clicks: ${p.clicks} · Impr: ${p.impressions} · CTR: ${p.ctr || 0}%`,
    `Conv: ${p.conversions} · CPL: ${p.cpl != null ? inr(p.cpl, currency) : '—'}`,
    '',
    'Top campaigns:',
    ...campaigns.map((c) => `  ${c.name} · ${inr(c.spend, currency)} · ${c.conversions} conv · ${c.status}`),
    '',
    'Top ads:',
    ...ads.map((a) => `  ${a.name} · ${inr(a.spend, currency)} · ${a.conversions} conv`),
    '',
    'Top keywords:',
    ...keywords.map((k) => `  ${k.text} (${k.match}) · ${inr(k.spend, currency)}`),
    '',
    'Top search terms:',
    ...terms.map((t) => `  ${t.text} · ${t.clicks} clicks · ${inr(t.spend, currency)}`),
  ];
  return {
    period,
    during: range,
    title: `Google Ads ${period}`,
    currency,
    summary,
    campaigns,
    ads,
    keywords,
    search_terms: terms,
    markdown: lines.join('\n'),
  };
}
