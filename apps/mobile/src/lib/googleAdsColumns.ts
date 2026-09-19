export type AdsColumn = {
  key: string;
  label: string;
  category: 'Recommended' | 'Performance' | 'Results' | 'Conversions' | 'Attributes';
  fmt: 'text' | 'money' | 'num' | 'pct' | 'status' | 'score';
  always?: boolean;
};

export const ADS_COLUMNS: AdsColumn[] = [
  { key: 'name', label: 'Campaign', category: 'Recommended', fmt: 'text', always: true },
  { key: 'status', label: 'Status', category: 'Attributes', fmt: 'status' },
  { key: 'channel', label: 'Campaign type', category: 'Attributes', fmt: 'text' },
  { key: 'budget', label: 'Budget', category: 'Attributes', fmt: 'money' },
  { key: 'bidding', label: 'Bid strategy', category: 'Attributes', fmt: 'text' },
  { key: 'spend', label: 'Cost', category: 'Performance', fmt: 'money' },
  { key: 'impressions', label: 'Impr.', category: 'Performance', fmt: 'num' },
  { key: 'clicks', label: 'Clicks', category: 'Performance', fmt: 'num' },
  { key: 'ctr', label: 'CTR', category: 'Performance', fmt: 'pct' },
  { key: 'cpc', label: 'Avg. CPC', category: 'Performance', fmt: 'money' },
  { key: 'cpm', label: 'Avg. CPM', category: 'Performance', fmt: 'money' },
  { key: 'interactions', label: 'Interactions', category: 'Performance', fmt: 'num' },
  { key: 'video_views', label: 'Video views', category: 'Performance', fmt: 'num' },
  { key: 'conversions', label: 'Results', category: 'Results', fmt: 'num' },
  { key: 'all_conversions', label: 'All conv.', category: 'Conversions', fmt: 'num' },
  { key: 'view_through', label: 'View-through conv.', category: 'Conversions', fmt: 'num' },
  { key: 'conversion_value', label: 'Conv. value', category: 'Results', fmt: 'money' },
  { key: 'cpl', label: 'Cost / conv.', category: 'Results', fmt: 'money' },
  { key: 'cpi', label: 'Cost / install', category: 'Results', fmt: 'money' },
  { key: 'cpia', label: 'Cost / in-app action', category: 'Results', fmt: 'money' },
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

export const UNAVAILABLE_COLUMN_GROUPS = [
  'Budget simulator — Ads UI forecast only, API nahi deta',
  'Google Analytics columns — GA link report API alag hai',
  'YouTube earned actions — limited; sirf Video views API se aata hai',
];

export const COLUMNS_STORAGE_KEY = 'gads_campaign_columns_v1';

export function sanitizeCampaignColumns(keys: string[]): string[] {
  const allowed = new Set(ADS_COLUMNS.map((c) => c.key));
  const next = keys.filter((k) => allowed.has(k));
  if (!next.includes('name')) next.unshift('name');
  return next.length ? next : DEFAULT_CAMPAIGN_COLUMNS;
}
