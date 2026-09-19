import { googleAdsSearch, listAccessibleCustomerIds, microsToAmount } from './client';
import { dateWhere, type DateRangeInput } from './dateRange';
import { formatAdsCustomerId, getGoogleAdsSettings, normalizeAdsCustomerId } from './settings';

export const GOOGLE_ADS_MCP_META = {
  name: 'myfng-google-ads',
  version: '1.0.0',
  mode: 'read-only',
};

export const GOOGLE_ADS_TOOLS = [
  { name: 'list_accessible_customers', area: 'account', description: 'Customer IDs this Google user can access.', params: [] as { key: string; label: string; required?: boolean }[] },
  { name: 'get_account', area: 'account', description: 'MyFNG Google Ads account name, currency, timezone.', params: [{ key: 'customer_id', label: 'Customer ID' }] },
  { name: 'get_spend_summary', area: 'insights', description: 'Spend, clicks, conversions + daily series.', params: [{ key: 'customer_id', label: 'Customer ID' }] },
  {
    name: 'list_campaigns',
    area: 'campaigns',
    description: 'Campaigns with spend and CPL. Pass q for name search, status ENABLED/PAUSED.',
    params: [
      { key: 'during', label: 'Date range', placeholder: 'LAST_7_DAYS' },
      { key: 'q', label: 'Name search' },
      { key: 'status', label: 'Status', placeholder: 'ENABLED / PAUSED / ALL' },
      { key: 'channel', label: 'Channel', placeholder: 'SEARCH / PERFORMANCE_MAX' },
    ],
  },
  {
    name: 'list_ad_groups',
    area: 'ad_groups',
    description: 'Ad groups with spend and CPL.',
    params: [
      { key: 'during', label: 'Date range' },
      { key: 'q', label: 'Name search' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    name: 'list_ads',
    area: 'ads',
    description: 'Ads / RSA headlines with spend. Use when user asks which copy to run.',
    params: [
      { key: 'during', label: 'Date range' },
      { key: 'q', label: 'Name / headline search' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    name: 'list_keywords',
    area: 'keywords',
    description: 'Keywords with match type and spend.',
    params: [
      { key: 'during', label: 'Date range' },
      { key: 'q', label: 'Keyword search' },
      { key: 'status', label: 'Status' },
    ],
  },
  {
    name: 'list_search_terms',
    area: 'search_terms',
    description: 'Search terms that triggered ads.',
    params: [
      { key: 'during', label: 'Date range' },
      { key: 'q', label: 'Term search' },
    ],
  },
  { name: 'search', area: 'search', description: 'Read-only GAQL SELECT query.', params: [{ key: 'query', label: 'GAQL', required: true }] },
  {
    name: 'get_campaign',
    area: 'campaigns',
    description: 'One campaign: settings, budget, daily metrics, ad groups, ads, keywords. Use when user names a campaign.',
    params: [
      { key: 'campaign_id', label: 'Campaign ID', required: true },
      { key: 'during', label: 'Date range', placeholder: 'LAST_7_DAYS' },
    ],
  },
  {
    name: 'generate_report',
    area: 'insights',
    description: 'Deep report for a period. Pass campaign_id when user asks for one campaign.',
    params: [
      { key: 'period', label: 'today | last_7d | last_30d | briefing' },
      { key: 'campaign_id', label: 'Campaign ID' },
    ],
  },
  {
    name: 'list_conversions',
    area: 'conversions',
    description: 'Conversion actions being tracked + counts in the date range.',
    params: [
      { key: 'during', label: 'Date range' },
      { key: 'campaign_id', label: 'Campaign ID' },
    ],
  },
];

export type GoogleAdsListOpts = {
  limit?: number;
  customerId?: string;
  during?: string;
  since?: string;
  until?: string;
  q?: string;
  status?: string;
  channel?: string;
  campaign_id?: string;
  min_spend?: number;
  sort?: string;
};

export function applyListFilters<T extends {
  name?: string;
  text?: string;
  status?: string;
  channel?: string;
  campaign?: string;
  ad_group?: string;
  headlines?: string[];
  match?: string;
  spend: number;
  conversions: number;
  clicks: number;
  impressions?: number;
  cpl: number | null;
}>(rows: T[], opts: GoogleAdsListOpts = {}): T[] {
  const q = String(opts.q || '').trim().toLowerCase();
  const status = String(opts.status || '').trim().toUpperCase();
  const channel = String(opts.channel || '').trim().toUpperCase().replace(/\s+/g, '_');
  const minSpend = Number(opts.min_spend || 0);
  let next = rows;
  if (q) {
    next = next.filter((row) =>
      [row.name, row.text, row.campaign, row.ad_group, row.match, ...(row.headlines || [])]
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }
  if (status && status !== 'ALL') next = next.filter((row) => String(row.status || '').toUpperCase() === status);
  if (channel) next = next.filter((row) => String(row.channel || '').toUpperCase().includes(channel));
  if (minSpend > 0) next = next.filter((row) => row.spend >= minSpend);
  const sort = String(opts.sort || 'spend');
  const lowerBetter = new Set(['cpl', 'cpc', 'cpi', 'cpia', 'cpm']);
  next = [...next].sort((a, b) => {
    const av =
      sort === 'conversions'
        ? Number((a as any).conversions || 0) || Number((a as any).all_conversions || 0)
        : Number((a as any)[sort]);
    const bv =
      sort === 'conversions'
        ? Number((b as any).conversions || 0) || Number((b as any).all_conversions || 0)
        : Number((b as any)[sort]);
    const aMissing = Number.isNaN(av);
    const bMissing = Number.isNaN(bv);
    if (aMissing && bMissing) return 0;
    if (aMissing) return 1;
    if (bMissing) return -1;
    return lowerBetter.has(sort) ? av - bv : bv - av;
  });
  return next.slice(0, Math.max(1, Math.min(80, Number(opts.limit) || 40)));
}

function listOpts(limitOrOpts: number | GoogleAdsListOpts = 40, customerId?: string, range?: string): GoogleAdsListOpts {
  if (typeof limitOrOpts === 'object' && limitOrOpts) {
    return { ...limitOrOpts, customerId: limitOrOpts.customerId || customerId, during: limitOrOpts.during || range };
  }
  return { limit: limitOrOpts, customerId, during: range };
}

function rangeOf(opts: DateRangeInput = {}): DateRangeInput {
  return { during: opts.during, since: opts.since, until: opts.until };
}

function campaignIdOf(value?: string): string {
  return String(value || '').replace(/\D/g, '');
}

function campaignWhere(opts: { campaign_id?: string } = {}): string {
  const id = campaignIdOf(opts.campaign_id);
  return id ? ` AND campaign.id = ${id}` : '';
}

function budgetFields(row: any) {
  const daily = microsToAmount(row?.campaignBudget?.amountMicros ?? row?.campaign_budget?.amount_micros);
  const total = microsToAmount(row?.campaignBudget?.totalAmountMicros ?? row?.campaign_budget?.total_amount_micros);
  const period = String((row?.campaignBudget?.period ?? row?.campaign_budget?.period) || 'DAILY').toUpperCase();
  return {
    budget: daily > 0 ? daily : total,
    budget_daily: daily,
    budget_total: total,
    budget_period: period || 'DAILY',
  };
}

async function loadCampaignSettings(customerId?: string, campaignId?: string) {
  const id = campaignIdOf(campaignId);
  const tail = `${id ? `WHERE campaign.id = ${id}` : ''} LIMIT ${id ? 1 : 500}`;
  const full = `SELECT campaign.id, campaign.name, campaign.status, campaign.serving_status,
            campaign.advertising_channel_type, campaign.advertising_channel_sub_type,
            campaign.bidding_strategy_type, campaign.optimization_score,
            campaign.start_date, campaign.end_date,
            campaign_budget.amount_micros, campaign_budget.total_amount_micros, campaign_budget.period
     FROM campaign ${tail}`;
  const basic = `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
            campaign.bidding_strategy_type, campaign.start_date, campaign.end_date,
            campaign_budget.amount_micros, campaign_budget.total_amount_micros, campaign_budget.period
     FROM campaign ${tail}`;
  const rows = await googleAdsSearch(full, customerId).catch(() => googleAdsSearch(basic, customerId));
  const map = new Map<string, any>();
  for (const row of rows) {
    const cid = String(row?.campaign?.id || '');
    if (!cid) continue;
    const opt = Number(row?.campaign?.optimizationScore ?? row?.campaign?.optimization_score ?? 0);
    map.set(cid, {
      id: cid,
      name: String(row?.campaign?.name || ''),
      status: String(row?.campaign?.status || ''),
      serving: String(row?.campaign?.servingStatus || row?.campaign?.serving_status || ''),
      channel: String(row?.campaign?.advertisingChannelType || row?.campaign?.advertising_channel_type || ''),
      channel_sub: String(row?.campaign?.advertisingChannelSubType || row?.campaign?.advertising_channel_sub_type || ''),
      bidding: String(row?.campaign?.biddingStrategyType || row?.campaign?.bidding_strategy_type || ''),
      start_date: String(row?.campaign?.startDate || row?.campaign?.start_date || ''),
      end_date: String(row?.campaign?.endDate || row?.campaign?.end_date || ''),
      opt_score: opt > 0 ? Math.round(opt * 1000) / 10 : null,
      ...budgetFields(row),
    });
  }
  return map;
}

type Bucket = {
  spend: number;
  clicks: number;
  impressions: number;
  conversions: number;
  allConversions: number;
  conversionValue: number;
};

function emptyBucket(): Bucket {
  return { spend: 0, clicks: 0, impressions: 0, conversions: 0, allConversions: 0, conversionValue: 0 };
}

function rowBucket(row: any): Bucket {
  return {
    spend: microsToAmount(row?.metrics?.costMicros ?? row?.metrics?.cost_micros),
    clicks: num(row, 'metrics.clicks'),
    impressions: num(row, 'metrics.impressions'),
    conversions: num(row, 'metrics.conversions'),
    allConversions: num(row, 'metrics.allConversions') || num(row, 'metrics.all_conversions'),
    conversionValue: num(row, 'metrics.conversionsValue') || num(row, 'metrics.conversions_value'),
  };
}

function addBucket(a: Bucket, b: Bucket): Bucket {
  return {
    spend: a.spend + b.spend,
    clicks: a.clicks + b.clicks,
    impressions: a.impressions + b.impressions,
    conversions: a.conversions + b.conversions,
    allConversions: a.allConversions + b.allConversions,
    conversionValue: a.conversionValue + b.conversionValue,
  };
}

function withRates(bucket: Bucket) {
  const spend = Math.round(bucket.spend * 100) / 100;
  const conversions = Math.round(bucket.conversions * 100) / 100;
  const all_conversions = Math.round((bucket.allConversions || (bucket as any).all_conversions || 0) * 100) / 100;
  const conversion_value = Math.round((bucket.conversionValue || 0) * 100) / 100;
  const denom = conversions > 0 ? conversions : all_conversions;
  return {
    spend,
    clicks: bucket.clicks,
    impressions: bucket.impressions,
    conversions,
    all_conversions,
    conversion_value,
    ctr: bucket.impressions > 0 ? Math.round((bucket.clicks / bucket.impressions) * 10000) / 100 : 0,
    cpc: bucket.clicks > 0 ? Math.round((spend / bucket.clicks) * 100) / 100 : null,
    cpl: denom > 0 ? Math.round((spend / denom) * 100) / 100 : null,
    roas: spend > 0 && conversion_value > 0 ? Math.round((conversion_value / spend) * 100) / 100 : null,
  };
}

function field(row: any, ...paths: string[]): string {
  for (const path of paths) {
    const parts = path.split('.');
    let cur: any = row;
    for (const part of parts) cur = cur?.[part];
    if (cur != null && String(cur).trim()) return String(cur);
  }
  return '';
}

function rsaHeadlines(ad: any): string[] {
  const list = ad?.responsiveSearchAd?.headlines || ad?.responsive_search_ad?.headlines || [];
  return (Array.isArray(list) ? list : [])
    .map((item: any) => String(item?.text || '').trim())
    .filter(Boolean)
    .slice(0, 4);
}

function num(row: any, path: string): number {
  const parts = path.split('.');
  let cur: any = row;
  for (const part of parts) cur = cur?.[part];
  return Number(cur || 0);
}

export async function testGoogleAdsConnection() {
  const settings = await getGoogleAdsSettings();
  const customers = await listAccessibleCustomerIds();
  const cid = settings.customerId;
  let account: { id: string; name: string; currency: string; timeZone: string } | null = null;
  if (cid) {
    const rows = await googleAdsSearch(
      'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone FROM customer LIMIT 1',
      cid,
    );
    const customer = rows[0]?.customer || {};
    account = {
      id: formatAdsCustomerId(String(customer.id || cid)),
      name: String(customer.descriptiveName || customer.descriptive_name || 'Google Ads'),
      currency: String(customer.currencyCode || customer.currency_code || 'INR'),
      timeZone: String(customer.timeZone || customer.time_zone || ''),
    };
  }
  const warnings: string[] = [];
  if (cid && customers.length && !customers.includes(cid)) {
    warnings.push(`Customer ${formatAdsCustomerId(cid)} is not in the accessible list. Check MCC login-customer-id.`);
  }
  return {
    ok: true,
    account,
    accessible_customers: customers.map(formatAdsCustomerId),
    warnings,
  };
}

export async function getAccount(customerId?: string) {
  const settings = await getGoogleAdsSettings();
  const cid = normalizeAdsCustomerId(customerId || settings.customerId);
  const rows = await googleAdsSearch(
    'SELECT customer.id, customer.descriptive_name, customer.currency_code, customer.time_zone, customer.status FROM customer LIMIT 1',
    cid,
  );
  const customer = rows[0]?.customer || {};
  return {
    id: formatAdsCustomerId(String(customer.id || cid)),
    name: String(customer.descriptiveName || customer.descriptive_name || 'Google Ads'),
    currency: String(customer.currencyCode || customer.currency_code || 'INR'),
    timeZone: String(customer.timeZone || customer.time_zone || ''),
    status: String(customer.status || ''),
  };
}

async function periodMetrics(range: DateRangeInput, customerId?: string) {
  const rows = await googleAdsSearch(
    `SELECT metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value
     FROM customer
     WHERE ${dateWhere(range)}`,
    customerId,
  );
  const spend = rows.reduce((sum, row) => sum + microsToAmount(row?.metrics?.costMicros ?? row?.metrics?.cost_micros), 0);
  const clicks = rows.reduce((sum, row) => sum + num(row, 'metrics.clicks'), 0);
  const impressions = rows.reduce((sum, row) => sum + num(row, 'metrics.impressions'), 0);
  const conversions = rows.reduce((sum, row) => sum + num(row, 'metrics.conversions'), 0);
  const conversionValue = rows.reduce(
    (sum, row) => sum + (num(row, 'metrics.conversionsValue') || num(row, 'metrics.conversions_value')),
    0,
  );
  return withRates({ spend, clicks, impressions, conversions, conversionValue });
}

export async function getDailySeries(range: DateRangeInput | string = 'LAST_30_DAYS', customerId?: string) {
  const input = typeof range === 'string' ? { during: range } : range;
  const rows = await googleAdsSearch(
    `SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value
     FROM customer
     WHERE ${dateWhere(input)}`,
    customerId,
  );
  return rows
    .map((row) => ({
      date: field(row, 'segments.date'),
      ...withRates(rowBucket(row)),
    }))
    .filter((row) => row.date)
    .sort((a, b) => a.date.localeCompare(b.date));
}

export async function getSpendSummary(customerId?: string, dateOpts?: DateRangeInput) {
  const account = await getAccount(customerId);
  const selectedRange = dateOpts || { during: 'LAST_7_DAYS' };
  const [today, last_7d, last_30d, selected, daily] = await Promise.all([
    periodMetrics({ during: 'TODAY' }, customerId),
    periodMetrics({ during: 'LAST_7_DAYS' }, customerId),
    periodMetrics({ during: 'LAST_30_DAYS' }, customerId),
    periodMetrics(selectedRange, customerId),
    getDailySeries(selectedRange, customerId),
  ]);
  return {
    account,
    currency: account.currency,
    periods: { today, last_7d, last_30d, selected },
    daily,
  };
}

export async function listCampaigns(limitOrOpts: number | GoogleAdsListOpts = 40, customerId?: string, range = 'LAST_7_DAYS') {
  const opts = listOpts(limitOrOpts, customerId, range);
  const where = dateWhere(rangeOf(opts));
  const scoped = campaignWhere(opts);
  const fullQuery = `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
            metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions,
            metrics.conversions_value, metrics.all_conversions, metrics.view_through_conversions,
            metrics.average_cpm, metrics.interactions, metrics.video_views
     FROM campaign
     WHERE ${where}${scoped}
     ORDER BY metrics.cost_micros DESC
     LIMIT 250`;
  const basicQuery = `SELECT campaign.id, campaign.name, campaign.status, campaign.advertising_channel_type,
            metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions,
            metrics.conversions_value
     FROM campaign
     WHERE ${where}${scoped}
     ORDER BY metrics.cost_micros DESC
     LIMIT 250`;
  const [settings, metricResult] = await Promise.all([
    loadCampaignSettings(opts.customerId, opts.campaign_id).catch(() => new Map<string, any>()),
    googleAdsSearch(fullQuery, opts.customerId)
      .catch(() => googleAdsSearch(basicQuery, opts.customerId)),
  ]);
  const rows = metricResult;
  const byId = new Map<string, any>();
  for (const row of rows) {
    const id = String(row?.campaign?.id || '');
    if (!id) continue;
    const settingsRow = settings.get(id) || {};
    const current = byId.get(id) || {
      id,
      name: String(settingsRow.name || row?.campaign?.name || ''),
      status: String(settingsRow.status || row?.campaign?.status || ''),
      serving: settingsRow.serving || '',
      channel: String(settingsRow.channel || row?.campaign?.advertisingChannelType || row?.campaign?.advertising_channel_type || ''),
      channel_sub: settingsRow.channel_sub || '',
      bidding: settingsRow.bidding || '',
      budget: Number(settingsRow.budget || 0),
      budget_daily: Number(settingsRow.budget_daily || 0),
      budget_total: Number(settingsRow.budget_total || 0),
      budget_period: settingsRow.budget_period || 'DAILY',
      start_date: settingsRow.start_date || '',
      end_date: settingsRow.end_date || '',
      opt_score: settingsRow.opt_score ?? null,
      spend: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      conversionValue: 0,
      all_conversions: 0,
      view_through: 0,
      interactions: 0,
      video_views: 0,
      cpm_micros: 0,
    };
    current.spend += microsToAmount(row?.metrics?.costMicros ?? row?.metrics?.cost_micros);
    current.clicks += num(row, 'metrics.clicks');
    current.impressions += num(row, 'metrics.impressions');
    current.conversions += num(row, 'metrics.conversions');
    current.conversionValue += num(row, 'metrics.conversionsValue') || num(row, 'metrics.conversions_value');
    current.all_conversions += num(row, 'metrics.allConversions') || num(row, 'metrics.all_conversions');
    current.view_through += num(row, 'metrics.viewThroughConversions') || num(row, 'metrics.view_through_conversions');
    current.interactions += num(row, 'metrics.interactions');
    current.video_views += num(row, 'metrics.videoViews') || num(row, 'metrics.video_views');
    current.cpm_micros += Number(row?.metrics?.averageCpm ?? row?.metrics?.average_cpm ?? 0);
    byId.set(id, current);
  }
  for (const [id, settingsRow] of settings) {
    if (byId.has(id)) continue;
    byId.set(id, {
      ...settingsRow,
      spend: 0,
      clicks: 0,
      impressions: 0,
      conversions: 0,
      conversionValue: 0,
      all_conversions: 0,
      view_through: 0,
      interactions: 0,
      video_views: 0,
      cpm_micros: 0,
    });
  }
  return applyListFilters(
    Array.from(byId.values()).map((row) => {
      const rates = withRates(row);
      const installs = /MULTI_CHANNEL|APP/i.test(String(row.channel || '')) ? row.conversions : 0;
      return {
        ...row,
        ...rates,
        conversion_value: rates.conversion_value,
        cpi: installs > 0 ? Math.round((row.spend / installs) * 100) / 100 : rates.cpl,
        cpia: rates.cpl,
        cpm: row.impressions > 0 ? Math.round((row.spend / row.impressions) * 1000 * 100) / 100 : microsToAmount(row.cpm_micros),
      };
    }),
    opts,
  );
}

export async function listAdGroups(limitOrOpts: number | GoogleAdsListOpts = 40, customerId?: string, range = 'LAST_7_DAYS') {
  const opts = listOpts(limitOrOpts, customerId, range);
  const rows = await googleAdsSearch(
    `SELECT ad_group.id, ad_group.name, ad_group.status, campaign.id, campaign.name,
            metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
     FROM ad_group
     WHERE ${dateWhere(rangeOf(opts))}${campaignWhere(opts)}
     ORDER BY metrics.cost_micros DESC
     LIMIT 250`,
    opts.customerId,
  );
  const byId = new Map<string, any>();
  for (const row of rows) {
    const id = field(row, 'adGroup.id', 'ad_group.id');
    if (!id) continue;
    const current = byId.get(id) || {
      id,
      name: field(row, 'adGroup.name', 'ad_group.name'),
      status: field(row, 'adGroup.status', 'ad_group.status'),
      campaign_id: field(row, 'campaign.id'),
      campaign: field(row, 'campaign.name'),
      ...emptyBucket(),
    };
    byId.set(id, { ...current, ...addBucket(current, rowBucket(row)) });
  }
  return applyListFilters(
    Array.from(byId.values()).map((row) => ({
      id: row.id,
      name: row.name,
      status: row.status,
      campaign_id: row.campaign_id,
      campaign: row.campaign,
      ...withRates(row),
    })),
    opts,
  );
}

export async function listAds(limitOrOpts: number | GoogleAdsListOpts = 40, customerId?: string, range = 'LAST_7_DAYS') {
  const opts = listOpts(limitOrOpts, customerId, range);
  const rows = await googleAdsSearch(
    `SELECT ad_group_ad.ad.id, ad_group_ad.ad.name, ad_group_ad.status, ad_group_ad.ad.type,
            ad_group_ad.ad.responsive_search_ad.headlines, ad_group.name, campaign.name,
            metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions
     FROM ad_group_ad
     WHERE ${dateWhere(rangeOf(opts))}${campaignWhere(opts)}
     ORDER BY metrics.cost_micros DESC
     LIMIT 250`,
    opts.customerId,
  );
  const byId = new Map<string, any>();
  for (const row of rows) {
    const ad = row?.adGroupAd?.ad || row?.ad_group_ad?.ad || {};
    const id = String(ad?.id || field(row, 'adGroupAd.ad.id', 'ad_group_ad.ad.id'));
    if (!id) continue;
    const headlines = rsaHeadlines(ad);
    const current = byId.get(id) || {
      id,
      name: String(headlines[0] || ad?.name || `Ad ${id}`),
      headlines,
      status: field(row, 'adGroupAd.status', 'ad_group_ad.status'),
      type: String(ad?.type || ''),
      ad_group: field(row, 'adGroup.name', 'ad_group.name'),
      campaign: field(row, 'campaign.name'),
      ...emptyBucket(),
    };
    byId.set(id, { ...current, headlines: current.headlines.length ? current.headlines : headlines, ...addBucket(current, rowBucket(row)) });
  }
  return applyListFilters(
    Array.from(byId.values()).map((row) => ({
      id: row.id,
      name: row.name,
      headlines: row.headlines,
      status: row.status,
      type: row.type,
      ad_group: row.ad_group,
      campaign: row.campaign,
      ...withRates(row),
    })),
    opts,
  );
}

export async function listKeywords(limitOrOpts: number | GoogleAdsListOpts = 40, customerId?: string, range = 'LAST_7_DAYS') {
  const opts = listOpts(limitOrOpts, customerId, range);
  const rows = await googleAdsSearch(
    `SELECT ad_group_criterion.keyword.text, ad_group_criterion.keyword.match_type,
            ad_group_criterion.status, ad_group.name, campaign.name,
            metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions,
            metrics.all_conversions, metrics.conversions_value
     FROM keyword_view
     WHERE ${dateWhere(rangeOf(opts))}${campaignWhere(opts)}
     ORDER BY metrics.cost_micros DESC
     LIMIT 250`,
    opts.customerId,
  );
  const byId = new Map<string, any>();
  for (const row of rows) {
    const text = field(row, 'adGroupCriterion.keyword.text', 'ad_group_criterion.keyword.text');
    if (!text) continue;
    const match = field(row, 'adGroupCriterion.keyword.matchType', 'ad_group_criterion.keyword.match_type');
    const key = `${text}::${match}`;
    const current = byId.get(key) || {
      text,
      match,
      status: field(row, 'adGroupCriterion.status', 'ad_group_criterion.status'),
      ad_group: field(row, 'adGroup.name', 'ad_group.name'),
      campaign: field(row, 'campaign.name'),
      ...emptyBucket(),
    };
    byId.set(key, { ...current, ...addBucket(current, rowBucket(row)) });
  }
  return applyListFilters(
    Array.from(byId.values()).map((row) => ({
      text: row.text,
      match: row.match,
      status: row.status,
      ad_group: row.ad_group,
      campaign: row.campaign,
      ...withRates(row),
    })),
    opts,
  );
}

export async function listSearchTerms(limitOrOpts: number | GoogleAdsListOpts = 40, customerId?: string, range = 'LAST_7_DAYS') {
  const opts = listOpts(limitOrOpts, customerId, range);
  const rows = await googleAdsSearch(
    `SELECT search_term_view.search_term, campaign.name, ad_group.name,
            metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions,
            metrics.all_conversions, metrics.conversions_value
     FROM search_term_view
     WHERE ${dateWhere(rangeOf(opts))}${campaignWhere(opts)}
     ORDER BY metrics.clicks DESC
     LIMIT 250`,
    opts.customerId,
  );
  const byId = new Map<string, any>();
  for (const row of rows) {
    const text = field(row, 'searchTermView.searchTerm', 'search_term_view.search_term');
    if (!text) continue;
    const current = byId.get(text) || {
      text,
      ad_group: field(row, 'adGroup.name', 'ad_group.name'),
      campaign: field(row, 'campaign.name'),
      ...emptyBucket(),
    };
    byId.set(text, { ...current, ...addBucket(current, rowBucket(row)) });
  }
  return applyListFilters(
    Array.from(byId.values()).map((row) => ({
      text: row.text,
      ad_group: row.ad_group,
      campaign: row.campaign,
      ...withRates(row),
    })),
    opts,
  );
}

function conversionActionRow(row: any) {
  const action = row?.conversionAction || row?.conversion_action || {};
  const include = action.includeInConversionsMetric ?? action.include_in_conversions_metric;
  return {
    id: String(action.id || field(row, 'conversionAction.id', 'conversion_action.id')),
    name: String(action.name || field(row, 'conversionAction.name', 'conversion_action.name') || field(row, 'segments.conversionActionName', 'segments.conversion_action_name')),
    type: String(action.type || field(row, 'conversionAction.type', 'conversion_action.type') || ''),
    category: String(action.category || field(row, 'conversionAction.category', 'conversion_action.category') || field(row, 'segments.conversionActionCategory', 'segments.conversion_action_category') || ''),
    status: String(action.status || field(row, 'conversionAction.status', 'conversion_action.status') || ''),
    origin: String(action.origin || field(row, 'conversionAction.origin', 'conversion_action.origin') || ''),
    counting: String(action.countingType || action.counting_type || ''),
    primary: Boolean(action.primaryForGoal ?? action.primary_for_goal),
    in_results: include === true || include === 'true' || String(include).toUpperCase() === 'TRUE',
    conversions: num(row, 'metrics.conversions'),
    all_conversions: num(row, 'metrics.allConversions') || num(row, 'metrics.all_conversions'),
    conversion_value: num(row, 'metrics.conversionsValue') || num(row, 'metrics.conversions_value'),
  };
}

function conversionActionIdFromSegment(row: any): string {
  const ref = field(row, 'segments.conversionAction', 'segments.conversion_action');
  const match = String(ref).match(/conversionActions\/(\d+)/i);
  return match?.[1] || '';
}

async function loadConversionMetrics(opts: GoogleAdsListOpts) {
  const where = dateWhere(rangeOf(opts));
  const scoped = campaignWhere(opts);
  const campaignQuery = `SELECT segments.conversion_action, segments.conversion_action_name, segments.conversion_action_category,
            metrics.conversions, metrics.all_conversions, metrics.conversions_value
     FROM campaign
     WHERE ${where}${scoped}
     LIMIT 500`;
  const customerQuery = `SELECT segments.conversion_action, segments.conversion_action_name, segments.conversion_action_category,
            metrics.conversions, metrics.all_conversions, metrics.conversions_value
     FROM customer
     WHERE ${where}
     LIMIT 500`;
  const actionQuery = `SELECT conversion_action.id, conversion_action.name,
            metrics.conversions, metrics.all_conversions, metrics.conversions_value
     FROM conversion_action
     WHERE ${where}
     LIMIT 200`;
  let rows = await googleAdsSearch(campaignQuery, opts.customerId).catch(() => []);
  if (!rows.length) rows = await googleAdsSearch(customerQuery, opts.customerId).catch(() => []);
  if (!rows.length) rows = await googleAdsSearch(actionQuery, opts.customerId).catch(() => []);
  return rows;
}

export async function listConversionActions(opts: GoogleAdsListOpts = {}) {
  const settingsQuery = `SELECT conversion_action.id, conversion_action.name, conversion_action.type,
            conversion_action.category, conversion_action.status, conversion_action.origin,
            conversion_action.counting_type, conversion_action.primary_for_goal,
            conversion_action.include_in_conversions_metric
     FROM conversion_action
     LIMIT 200`;
  const [settingsRows, metricRows] = await Promise.all([
    googleAdsSearch(settingsQuery, opts.customerId).catch(() => []),
    loadConversionMetrics(opts),
  ]);
  const byKey = new Map<string, any>();
  const byName = new Map<string, string>();
  for (const row of settingsRows) {
    const item = conversionActionRow(row);
    if (!item.id && !item.name) continue;
    const key = item.id || item.name;
    byKey.set(key, { ...item, conversions: 0, all_conversions: 0, conversion_value: 0 });
    if (item.name) byName.set(item.name.toLowerCase(), key);
  }
  for (const row of metricRows) {
    const item = conversionActionRow(row);
    const segmentId = conversionActionIdFromSegment(row);
    const key = segmentId || byName.get(item.name.toLowerCase()) || item.id || item.name;
    if (!key) continue;
    const current = byKey.get(key) || item;
    byKey.set(key, {
      ...current,
      name: current.name || item.name,
      category: current.category || item.category,
      conversions: Number(current.conversions || 0) + Number(item.conversions || 0),
      all_conversions: Number(current.all_conversions || 0) + Number(item.all_conversions || 0),
      conversion_value: Number(current.conversion_value || 0) + Number(item.conversion_value || 0),
    });
  }
  const actions = Array.from(byKey.values()).sort(
    (a, b) =>
      Number(b.all_conversions || 0) + Number(b.conversions || 0) - (Number(a.all_conversions || 0) + Number(a.conversions || 0)) ||
      a.name.localeCompare(b.name),
  );
  const visible = actions.filter((a) => !/REMOVED|HIDDEN/i.test(String(a.status || '')));
  const fired = visible.filter((a) => Number(a.conversions || 0) + Number(a.all_conversions || 0) > 0);
  return {
    actions: visible,
    fired,
    primary: visible.filter((a) => a.in_results),
    secondary: visible.filter((a) => !a.in_results),
    totals: visible.reduce(
      (acc, row) => ({
        conversions: acc.conversions + Number(row.conversions || 0),
        all_conversions: acc.all_conversions + Number(row.all_conversions || 0),
        conversion_value: acc.conversion_value + Number(row.conversion_value || 0),
      }),
      { conversions: 0, all_conversions: 0, conversion_value: 0 },
    ),
  };
}

export async function listCampaignConversions(campaignId: string, opts: GoogleAdsListOpts = {}) {
  const id = campaignIdOf(campaignId);
  if (!id) return [];
  const rows = await googleAdsSearch(
    `SELECT segments.conversion_action_name, segments.conversion_action_category,
            metrics.conversions, metrics.all_conversions, metrics.conversions_value
     FROM campaign
     WHERE campaign.id = ${id} AND ${dateWhere(rangeOf(opts))}
     LIMIT 200`,
    opts.customerId,
  ).catch(() => []);
  const byName = new Map<string, any>();
  for (const row of rows) {
    const item = conversionActionRow(row);
    const key = item.name || item.category || 'Unknown';
    const current = byName.get(key) || { ...item, name: key, conversions: 0, all_conversions: 0, conversion_value: 0 };
    current.conversions += Number(item.conversions || 0);
    current.all_conversions += Number(item.all_conversions || 0);
    current.conversion_value += Number(item.conversion_value || 0);
    current.category = current.category || item.category;
    byName.set(key, current);
  }
  return Array.from(byName.values()).sort((a, b) => (b.all_conversions || b.conversions) - (a.all_conversions || a.conversions));
}

export async function getCampaignDetail(campaignId: string, opts: GoogleAdsListOpts = {}) {
  const id = campaignIdOf(campaignId);
  if (!id) throw new Error('campaign_id is required');
  const scoped: GoogleAdsListOpts = { ...opts, campaign_id: id, limit: Math.max(opts.limit || 40, 40) };
  const dailyQuery = `SELECT segments.date, metrics.cost_micros, metrics.clicks, metrics.impressions, metrics.conversions, metrics.conversions_value
       FROM campaign
       WHERE campaign.id = ${id} AND ${dateWhere(rangeOf(opts))}`;
  const [listed, dailyRows, ad_groups, ads, keywords, search_terms, conversions] = await Promise.all([
    listCampaigns(scoped),
    googleAdsSearch(dailyQuery, opts.customerId).catch(() => []),
    listAdGroups(scoped).catch(() => []),
    listAds(scoped).catch(() => []),
    listKeywords(scoped).catch(() => []),
    listSearchTerms(scoped).catch(() => []),
    listCampaignConversions(id, opts).catch(() => []),
  ]);
  const campaign = listed[0];
  if (!campaign) throw new Error('Campaign not found');
  const daily = dailyRows
    .map((row: any) => ({
      date: field(row, 'segments.date'),
      ...withRates(rowBucket(row)),
    }))
    .filter((row: any) => row.date)
    .sort((a: any, b: any) => a.date.localeCompare(b.date));
  return {
    campaign,
    daily,
    ad_groups,
    ads,
    keywords,
    search_terms,
    conversions,
  };
}

function toolListOpts(params: Record<string, unknown>, customerId?: string): GoogleAdsListOpts {
  return {
    customerId,
    during: params.during != null ? String(params.during) : undefined,
    since: params.since != null ? String(params.since) : undefined,
    until: params.until != null ? String(params.until) : undefined,
    q: params.q != null ? String(params.q) : undefined,
    status: params.status != null ? String(params.status) : undefined,
    channel: params.channel != null ? String(params.channel) : undefined,
    campaign_id: params.campaign_id != null ? String(params.campaign_id) : undefined,
    min_spend: params.min_spend != null ? Number(params.min_spend) : undefined,
    sort: params.sort != null ? String(params.sort) : undefined,
    limit: params.limit != null ? Number(params.limit) : 40,
  };
}

export async function runGoogleAdsTool(name: string, params: Record<string, unknown> = {}) {
  const customerId = params.customer_id != null ? String(params.customer_id) : undefined;
  switch (name) {
    case 'list_accessible_customers':
      return { customers: (await listAccessibleCustomerIds()).map(formatAdsCustomerId) };
    case 'get_account':
      return getAccount(customerId);
    case 'get_spend_summary':
      return getSpendSummary(customerId);
    case 'list_campaigns':
      return { campaigns: await listCampaigns(toolListOpts(params, customerId)) };
    case 'get_campaign':
      return getCampaignDetail(String(params.campaign_id || ''), toolListOpts(params, customerId));
    case 'generate_report': {
      const { generateGoogleAdsReport } = await import('./report');
      return generateGoogleAdsReport(String(params.period || 'last_7d'), {
        during: params.during != null ? String(params.during) : undefined,
        since: params.since != null ? String(params.since) : undefined,
        until: params.until != null ? String(params.until) : undefined,
        campaign_id: params.campaign_id != null ? String(params.campaign_id) : undefined,
      });
    }
    case 'list_ad_groups':
      return { ad_groups: await listAdGroups(toolListOpts(params, customerId)) };
    case 'list_ads':
      return { ads: await listAds(toolListOpts(params, customerId)) };
    case 'list_keywords':
      return { keywords: await listKeywords(toolListOpts(params, customerId)) };
    case 'list_search_terms':
      return { search_terms: await listSearchTerms(toolListOpts(params, customerId)) };
    case 'list_conversions':
      return listConversionActions(toolListOpts(params, customerId));
    case 'search': {
      const query = String(params.query || '').trim();
      if (!query) throw new Error('query is required');
      if (!/^\s*select\s+/i.test(query)) throw new Error('Only SELECT GAQL queries are allowed.');
      if (/\b(mutate|remove|update|insert)\b/i.test(query)) throw new Error('Mutating queries are blocked.');
      if (query.length > 2500) throw new Error('Query is too long.');
      return { results: await googleAdsSearch(query, customerId) };
    }
    default:
      throw new Error(`Unknown Google Ads tool: ${name}`);
  }
}
