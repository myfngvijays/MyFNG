export type ColumnFmt = 'text' | 'money' | 'num' | 'pct' | 'status' | 'score';

export type AdsColumn = {
  key: string;
  label: string;
  category: 'Recommended' | 'Performance' | 'Results' | 'Conversions' | 'Attributes';
  fmt: ColumnFmt;
  sort?: string;
  sticky?: boolean;
  always?: boolean;
};

export const ADS_COLUMNS: AdsColumn[] = [
  { key: 'name', label: 'Campaign', category: 'Recommended', fmt: 'text', sticky: true, always: true },
  { key: 'status', label: 'Status', category: 'Attributes', fmt: 'status' },
  { key: 'channel', label: 'Campaign type', category: 'Attributes', fmt: 'text' },
  { key: 'budget', label: 'Budget', category: 'Attributes', fmt: 'money', sort: 'budget' },
  { key: 'bidding', label: 'Bid strategy', category: 'Attributes', fmt: 'text' },
  { key: 'spend', label: 'Cost', category: 'Performance', fmt: 'money', sort: 'spend' },
  { key: 'impressions', label: 'Impr.', category: 'Performance', fmt: 'num', sort: 'impressions' },
  { key: 'clicks', label: 'Clicks', category: 'Performance', fmt: 'num', sort: 'clicks' },
  { key: 'ctr', label: 'CTR', category: 'Performance', fmt: 'pct' },
  { key: 'cpc', label: 'Avg. CPC', category: 'Performance', fmt: 'money' },
  { key: 'cpm', label: 'Avg. CPM', category: 'Performance', fmt: 'money' },
  { key: 'interactions', label: 'Interactions', category: 'Performance', fmt: 'num', sort: 'interactions' },
  { key: 'video_views', label: 'Video views', category: 'Performance', fmt: 'num' },
  { key: 'conversions', label: 'Results', category: 'Results', fmt: 'num', sort: 'conversions' },
  { key: 'all_conversions', label: 'All conv.', category: 'Conversions', fmt: 'num', sort: 'all_conversions' },
  { key: 'view_through', label: 'View-through conv.', category: 'Conversions', fmt: 'num', sort: 'view_through' },
  { key: 'conversion_value', label: 'Conv. value', category: 'Results', fmt: 'money' },
  { key: 'cpl', label: 'Cost / conv.', category: 'Results', fmt: 'money', sort: 'cpl' },
  { key: 'cpi', label: 'Cost / install', category: 'Results', fmt: 'money', sort: 'cpi' },
  { key: 'cpia', label: 'Cost / in-app action', category: 'Results', fmt: 'money', sort: 'cpia' },
  { key: 'roas', label: 'Conv. value / cost', category: 'Results', fmt: 'num' },
  { key: 'opt_score', label: 'Optimization score', category: 'Recommended', fmt: 'score' },
];

export const DEFAULT_CAMPAIGN_COLUMNS = [
  'name',
  'budget',
  'status',
  'channel',
  'spend',
  'cpi',
  'cpia',
  'view_through',
  'conversions',
  'opt_score',
];

export const DEFAULT_LIST_COLUMNS = [
  'name',
  'status',
  'spend',
  'impressions',
  'clicks',
  'ctr',
  'cpc',
  'conversions',
  'cpl',
];

export function resolveAdsColumns(keys: string[]): AdsColumn[] {
  return keys.map((key) => ADS_COLUMNS.find((c) => c.key === key)).filter((c): c is AdsColumn => Boolean(c));
}

const STORAGE_KEY = 'gads_campaign_columns_v1';

export function loadCampaignColumns(): string[] {
  if (typeof window === 'undefined') return DEFAULT_CAMPAIGN_COLUMNS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? (JSON.parse(raw) as string[]) : [];
    const keys = ADS_COLUMNS.map((c) => c.key);
    const next = parsed.filter((k) => keys.includes(k));
    if (!next.includes('name')) next.unshift('name');
    return next.length ? next : DEFAULT_CAMPAIGN_COLUMNS;
  } catch {
    return DEFAULT_CAMPAIGN_COLUMNS;
  }
}

export function saveCampaignColumns(keys: string[]) {
  if (typeof window === 'undefined') return;
  const next = keys.includes('name') ? keys : ['name', ...keys];
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
}

export const UNAVAILABLE_COLUMN_GROUPS = [
  'Budget simulator — Ads UI forecast only, API nahi deta',
  'Google Analytics columns — GA link report API alag hai',
  'YouTube earned actions — limited; sirf Video views API se aata hai',
];
