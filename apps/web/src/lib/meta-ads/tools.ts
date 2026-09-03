import { DEFAULT_INSIGHT_FIELDS, graphGet, resolveAccountId, summarizeInsights } from './graph';
import { getMetaAdsSettings, normalizeAdAccountId } from './settings';

export type MetaAdsToolArea = 'Account' | 'Campaigns' | 'Ads' | 'Insights' | 'Funds' | 'Pages' | 'Pixel';

export type MetaAdsToolParam = {
  key: string;
  label: string;
  required?: boolean;
  placeholder?: string;
};

export type MetaAdsToolDef = {
  name: string;
  area: MetaAdsToolArea;
  description: string;
  params: MetaAdsToolParam[];
};

export const META_ADS_MCP_META = {
  name: 'myfng-meta-ads',
  version: '1.0.0',
  mode: 'read-only' as const,
  notes: [
    'Read-only Marketing API — no budget, pause, or create tools.',
    'Use a System User token with ads_read. For Pages assign the Page (View) + scopes pages_show_list and pages_read_engagement. For Pixel assign the dataset (View).',
    'Token is stored in system_settings (or META_ADS_* env). It is never shown in full after save.',
  ],
};

export const META_ADS_TOOLS: MetaAdsToolDef[] = [
  {
    name: 'get_account_info',
    area: 'Account',
    description: 'Ad account name, currency, status, spend-to-date',
    params: [{ key: 'account_id', label: 'Account ID', placeholder: 'act_… (blank = saved)' }],
  },
  {
    name: 'list_ad_accounts',
    area: 'Account',
    description: 'Ad accounts this token can access',
    params: [{ key: 'limit', label: 'Limit', placeholder: '25' }],
  },
  {
    name: 'list_campaigns',
    area: 'Campaigns',
    description: 'Campaigns + last-7d spend / leads',
    params: [
      { key: 'account_id', label: 'Account ID' },
      { key: 'status', label: 'Status', placeholder: 'ACTIVE / PAUSED / all' },
      { key: 'limit', label: 'Limit', placeholder: '25' },
    ],
  },
  {
    name: 'get_campaign',
    area: 'Campaigns',
    description: 'One campaign + last-7d insights',
    params: [{ key: 'campaign_id', label: 'Campaign ID', required: true }],
  },
  {
    name: 'list_adsets',
    area: 'Ads',
    description: 'Ad sets under a campaign or the whole account',
    params: [
      { key: 'campaign_id', label: 'Campaign ID' },
      { key: 'account_id', label: 'Account ID' },
      { key: 'limit', label: 'Limit', placeholder: '25' },
    ],
  },
  {
    name: 'list_ads',
    area: 'Ads',
    description: 'Ads under an ad set, campaign, or account',
    params: [
      { key: 'adset_id', label: 'Ad set ID' },
      { key: 'campaign_id', label: 'Campaign ID' },
      { key: 'account_id', label: 'Account ID' },
      { key: 'limit', label: 'Limit', placeholder: '25' },
    ],
  },
  {
    name: 'get_ad_performance',
    area: 'Ads',
    description:
      'Ads with headline/body copy PLUS last-7d spend, CTR, WA chats, CPR. Use before Keep/Test/Pause advice or “which copy to run”.',
    params: [
      { key: 'campaign_id', label: 'Campaign ID (blank = whole account)' },
      { key: 'date_preset', label: 'Date preset', placeholder: 'last_7d' },
      { key: 'limit', label: 'Limit', placeholder: '20' },
    ],
  },
  {
    name: 'get_insights',
    area: 'Insights',
    description: 'Spend, CTR, leads for account / campaign / ad set / ad',
    params: [
      { key: 'object_id', label: 'Object ID', placeholder: 'blank = saved account' },
      { key: 'level', label: 'Level', placeholder: 'account | campaign | adset | ad' },
      { key: 'date_preset', label: 'Date preset', placeholder: 'last_7d' },
    ],
  },
  {
    name: 'get_spend_summary',
    area: 'Insights',
    description: 'Today / 7d / 30d spend, clicks, leads, CPL',
    params: [{ key: 'account_id', label: 'Account ID' }],
  },
  {
    name: 'get_funds_tracker',
    area: 'Funds',
    description: 'Ad account balance, spend cap, remaining funds, payment source',
    params: [{ key: 'account_id', label: 'Account ID' }],
  },
  {
    name: 'list_ad_transactions',
    area: 'Funds',
    description: 'Recent billing / credit transactions',
    params: [
      { key: 'account_id', label: 'Account ID' },
      { key: 'limit', label: 'Limit', placeholder: '20' },
    ],
  },
  {
    name: 'list_pages',
    area: 'Pages',
    description: 'Facebook / IG pages this token can access',
    params: [{ key: 'limit', label: 'Limit', placeholder: '25' }],
  },
  {
    name: 'get_page',
    area: 'Pages',
    description: 'One page: fans, followers, IG account',
    params: [{ key: 'page_id', label: 'Page ID', required: true }],
  },
  {
    name: 'get_page_insights',
    area: 'Pages',
    description: 'Page impressions / engagements / fans',
    params: [
      { key: 'page_id', label: 'Page ID', required: true },
      { key: 'date_preset', label: 'Date preset', placeholder: 'last_7d' },
    ],
  },
  {
    name: 'list_pixels',
    area: 'Pixel',
    description: 'Pixels / datasets on the ad account',
    params: [{ key: 'account_id', label: 'Account ID' }],
  },
  {
    name: 'get_pixel',
    area: 'Pixel',
    description: 'One pixel: last fired, name, status',
    params: [{ key: 'pixel_id', label: 'Pixel ID', required: true }],
  },
  {
    name: 'get_pixel_stats',
    area: 'Pixel',
    description: 'Pixel event counts (PageView, Lead, …)',
    params: [
      { key: 'pixel_id', label: 'Pixel ID', required: true },
      { key: 'days', label: 'Days', placeholder: '7' },
    ],
  },
];

export const META_ADS_AREAS = ['Account', 'Campaigns', 'Ads', 'Insights', 'Funds', 'Pages', 'Pixel'] as const;

function limitOf(raw: unknown, fallback = 25): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(100, Math.max(1, Math.floor(n)));
}

async function firstInsight(path: string, extra: Record<string, string | number | undefined> = {}) {
  const json = await graphGet<{ data?: any[] }>(path, {
    fields: DEFAULT_INSIGHT_FIELDS,
    date_preset: String(extra.date_preset || 'last_7d'),
    ...extra,
  });
  return json?.data?.[0] || null;
}

export async function testMetaAdsConnection() {
  const settings = await getMetaAdsSettings();
  if (!settings.accessToken) throw new Error('Paste a Meta access token first.');
  const me = await graphGet<{ id: string; name?: string }>('me', { fields: 'id,name' });
  let account: any = null;
  if (settings.accountId) {
    account = await graphGet(settings.accountId, {
      fields: 'id,name,account_status,currency,timezone_name,amount_spent,balance,business_name',
    });
  }
  return {
    ok: true,
    user: me,
    account,
    account_id: settings.accountId || null,
    pages: [] as any[],
    pixels: [] as any[],
    warnings: [] as string[],
  };
}

export async function getSpendSummary(accountId?: string) {
  const act = await resolveAccountId(accountId);
  const account = await graphGet(act, {
    fields: 'id,name,account_status,currency,timezone_name,amount_spent,business_name',
  });
  const presets = ['last_7d', 'today', 'last_30d'] as const;
  const periods: Record<string, ReturnType<typeof summarizeInsights>> = {};
  let rateLimited = false;
  for (const preset of presets) {
    try {
      const row = await firstInsight(`${act}/insights`, { date_preset: preset });
      periods[preset] = summarizeInsights(row);
    } catch (e: any) {
      const msg = String(e?.message || '');
      if (/rate limit/i.test(msg)) {
        rateLimited = true;
        break;
      }
      throw e;
    }
  }
  return {
    ok: true,
    account,
    currency: account?.currency || 'INR',
    periods,
    rate_limited: rateLimited,
  };
}

const FUNDING_TYPE_LABEL: Record<number, string> = {
  1: 'Credit card',
  2: 'Facebook wallet (Funds)',
  3: 'Paid credit',
  4: 'Extended credit',
  7: 'Facebook token',
  15: 'External deposit',
  20: 'Stored balance (Funds)',
};

function accountCurrencyAmount(raw: unknown): number {
  if (raw == null || raw === '') return 0;
  if (typeof raw === 'object') {
    const o = raw as Record<string, unknown>;
    if (o.offsetted_amount != null) return accountCurrencyAmount(o.offsetted_amount);
    if (o.amount_in_hundredths != null) return Number(o.amount_in_hundredths) / 100;
    return accountCurrencyAmount(o.amount ?? o.balance ?? o.value ?? o.credit_available);
  }
  const s = String(raw).trim().replace(/,/g, '');
  const n = Number(s.replace(/[^\d.-]/g, ''));
  if (!Number.isFinite(n)) return 0;
  if (s.includes('.')) return n;
  return n / 100;
}

function couponList(details: any): any[] {
  if (!details) return [];
  if (Array.isArray(details.coupons)) return details.coupons;
  if (Array.isArray(details.coupons?.data)) return details.coupons.data;
  if (details.coupon) return [details.coupon];
  return [];
}

function detailsList(raw: any): any[] {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  if (Array.isArray(raw.data)) return raw.data;
  return [raw];
}

function walletFromFundingDetails(details: any): { funds: number; credits: number; label: string; type: number | null } {
  if (!details) return { funds: 0, credits: 0, label: '—', type: null };
  const type = details.type == null ? null : Number(details.type);
  const label = String(
    details.display_string || FUNDING_TYPE_LABEL[type || 0] || details.type || details.id || '—',
  );
  const coupons = couponList(details);
  const couponSum = coupons.reduce(
    (sum, row) => sum + accountCurrencyAmount(row?.amount ?? row?.display_amount ?? row?.original_amount),
    0,
  );
  const direct = accountCurrencyAmount(details.amount ?? details.display_amount);
  const funds = couponSum || direct;
  return { funds, credits: couponSum, label, type };
}

function sumFunding(raw: any) {
  const rows = detailsList(raw);
  let funds = 0;
  let credits = 0;
  let label = '—';
  let types: Array<number | null> = [];
  for (const row of rows) {
    const parsed = walletFromFundingDetails(row);
    funds += parsed.funds;
    credits += parsed.credits;
    types.push(parsed.type);
    if (/master|visa|card|\*/i.test(parsed.label) || parsed.type === 1) label = parsed.label;
    else if (label === '—' && parsed.label !== '—') label = parsed.label;
  }
  return { funds, credits, label, types, rows, keys: rows[0] ? Object.keys(rows[0]) : [] };
}

function fundingSourceId(account: any): string {
  const src = account?.funding_source;
  if (!src) return '';
  if (typeof src === 'string' || typeof src === 'number') return String(src);
  return String(src.id || '');
}

async function graphTry<T>(path: string, params: Record<string, string | number | undefined> = {}) {
  try {
    return { data: await graphGet<T>(path, params), error: null as string | null };
  } catch (e: any) {
    return { data: null as T | null, error: String(e?.message || 'blocked') };
  }
}

export async function getFundsTracker(accountId?: string) {
  const act = await resolveAccountId(accountId);
  const extras: string[] = [];

  const core = await graphTry<any>(act, {
    fields:
      'id,name,account_status,currency,timezone_name,business_name,amount_spent,balance,spend_cap,min_daily_budget,disable_reason,created_time',
  });
  if (!core.data) {
    throw new Error(core.error || 'Could not load ad account billing fields from Meta.');
  }
  const account: any = { ...core.data };

  const nested = await graphTry<any>(act, {
    fields:
      'is_prepay_account,funding_source,funding_source_details{id,type,display_string,amount,currency,display_amount,coupons{amount,currency,display_amount,expiration,original_amount,original_display_amount}}',
  });
  if (nested.data) {
    Object.assign(account, nested.data);
  } else {
    const extra = await graphTry<any>(act, {
      fields: 'is_prepay_account,funding_source,funding_source_details',
    });
    if (extra.data) Object.assign(account, extra.data);
    else if (extra.error) extras.push(extra.error);
  }

  const amountDue = accountCurrencyAmount(account.balance);
  const lifetimeSpend = accountCurrencyAmount(account.amount_spent);
  const spendCap = accountCurrencyAmount(account.spend_cap);
  const details = account.funding_source_details;
  const summed = sumFunding(details);
  let fundsWallet = summed.funds;
  let fundsLabel = summed.label;
  let adCredits = summed.credits;

  const nodeIds = new Set<string>();
  const srcId = fundingSourceId(account);
  if (srcId) nodeIds.add(srcId);
  for (const row of summed.rows) {
    if (row?.id) nodeIds.add(String(row.id));
  }
  for (const id of nodeIds) {
    if (fundsWallet > 0) break;
    const src = await graphTry<any>(id, {
      fields: 'id,amount,display_string,type,coupon,coupons,balance,credit_available',
    });
    if (src.data) {
      const fromSrc = sumFunding(src.data);
      if (fromSrc.funds > 0) fundsWallet = fromSrc.funds;
      if (fromSrc.credits > 0) adCredits = fromSrc.credits;
      if (src.data.display_string && fundsLabel === '—') fundsLabel = String(src.data.display_string);
    }
  }

  const bizLink = await graphTry<any>(act, { fields: 'business,owner_business' });
  const businessId = String(
    bizLink.data?.business?.id || bizLink.data?.owner_business?.id || '',
  );
  let credits: any[] = [];
  if (businessId) {
    const biz = await graphTry<any>(businessId, {
      fields: 'id,name,payment_account_id',
    });
    const payId = String(biz.data?.payment_account_id || '');
    if (payId && fundsWallet <= 0) {
      const pay = await graphTry<any>(payId, {
        fields: 'id,balance,amount,currency,available_balance,display_string,funding_source_details',
      });
      if (pay.data) {
        const payAmt = accountCurrencyAmount(
          pay.data.available_balance ?? pay.data.balance ?? pay.data.amount,
        );
        const fromPay = sumFunding(pay.data.funding_source_details || pay.data);
        if (fromPay.funds > 0) fundsWallet = fromPay.funds;
        else if (payAmt > 0 && Math.abs(payAmt - amountDue) > 1) fundsWallet = payAmt;
      }
    }

    if (fundsWallet <= 0) {
      const cred = await graphTry<{ data?: any[] }>(`${businessId}/extendedcredits`, {
        fields: 'id,balance,max_balance,legal_entity_name,credit_available,credit_type',
      });
      if (cred.data) {
        credits = cred.data.data || [];
        const creditBal = credits.reduce((sum, row) => sum + accountCurrencyAmount(row.credit_available), 0);
        if (creditBal > 0) fundsWallet = creditBal;
      }
    }
  }

  let payThreshold: number | null = null;
  const cycle = await graphTry<{ data?: any[] }>(`${act}/adspaymentcycle`);
  if (cycle.data) {
    const row = cycle.data.data?.[0] || cycle.data;
    payThreshold = accountCurrencyAmount(row?.threshold_amount ?? row?.threshold);
  }

  let transactions: any[] = [];
  const tx = await graphTry<{ data?: any[] }>(`${act}/transactions`, { limit: 10 });
  if (tx.data?.data) {
    transactions = tx.data.data.map((row) => ({
      id: row.id,
      time: row.start_time || row.time || row.created_time,
      amount: row.amount != null ? accountCurrencyAmount(row.amount) : null,
      type: row.status_text || row.type || row.app_type || row.reason || 'transaction',
    }));
  }

  const availableAfterPayment = fundsWallet > 0 ? Math.max(0, fundsWallet - amountDue) : null;
  const fundsFromApi = fundsWallet > 0;
  const permissionHint = fundsFromApi
    ? null
    : 'Prepaid Funds (₹7,xxx wallet) Meta Graph API nahi deta jab primary pay method card ho. Ads Manager → Billing & payments mein dekho. Yahan due, cap, aur card sahi hain.';

  return {
    ok: true,
    currency: account.currency || 'INR',
    account: {
      id: account.id,
      name: account.name,
      status: account.account_status,
      timezone: account.timezone_name,
      prepay: Boolean(account.is_prepay_account) || fundsWallet > 0,
      funding: fundsLabel,
      funding_raw: details || null,
      business_id: businessId || null,
      funding_debug: {
        types: summed.types,
        keys: summed.keys,
        coupon_count: couponList(details).length,
        row_count: summed.rows.length,
      },
    },
    lifetime_spend: lifetimeSpend,
    balance: amountDue,
    amount_due: amountDue,
    funds: fundsWallet,
    funds_from_api: fundsFromApi,
    ad_credits: adCredits,
    available_after_payment: availableAfterPayment,
    spend_cap: spendCap,
    remaining: fundsWallet > 0 ? fundsWallet : spendCap,
    cap_remaining: spendCap,
    pay_threshold: payThreshold,
    daily_spend_limit: null,
    min_daily_budget: accountCurrencyAmount(account.min_daily_budget),
    credits,
    notes: extras,
    permission_hint: permissionHint,
    transactions,
    transactions_error: null as string | null,
  };
}

async function runListAdTransactions(params: Record<string, unknown>) {
  const funds = await getFundsTracker(params.account_id as string | undefined);
  const limit = limitOf(params.limit, 20);
  return {
    ok: true,
    count: funds.transactions.length,
    transactions: funds.transactions.slice(0, limit),
    error: funds.transactions_error,
  };
}

export async function listCampaigns(params: { account_id?: string; status?: string; limit?: unknown } = {}) {
  const act = await resolveAccountId(params.account_id);
  const limit = limitOf(params.limit);
  const status = String(params.status || '').trim().toUpperCase();
  const json = await graphGet<{ data?: any[] }>(`${act}/campaigns`, {
    fields: 'id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,updated_time',
    limit,
    ...(status && status !== 'ALL' ? { effective_status: `["${status}"]` } : {}),
  });
  let insightById = new Map<string, ReturnType<typeof summarizeInsights>>();
  try {
    const insights = await graphGet<{ data?: any[] }>(`${act}/insights`, {
      fields: `${DEFAULT_INSIGHT_FIELDS},campaign_id,campaign_name`,
      date_preset: 'last_7d',
      level: 'campaign',
      limit: 100,
    });
    for (const row of insights.data || []) {
      if (row.campaign_id) insightById.set(String(row.campaign_id), summarizeInsights(row));
    }
  } catch {
    insightById = new Map();
  }
  const campaigns = (json.data || []).map((row) => ({
    id: row.id,
    name: row.name,
    status: row.status,
    effective_status: row.effective_status,
    objective: row.objective,
    daily_budget: row.daily_budget ? Number(row.daily_budget) / 100 : null,
    lifetime_budget: row.lifetime_budget ? Number(row.lifetime_budget) / 100 : null,
    created_time: row.created_time,
    last_7d: insightById.get(String(row.id)) || summarizeInsights(null),
  }));
  return { ok: true, count: campaigns.length, campaigns };
}

async function runGetAccountInfo(params: Record<string, unknown>) {
  const act = await resolveAccountId(params.account_id as string | undefined);
  const account = await graphGet(act, {
    fields: 'id,name,account_status,currency,timezone_name,amount_spent,balance,spend_cap,business_name,disable_reason',
  });
  return { ok: true, account };
}

async function runListAdAccounts(params: Record<string, unknown>) {
  const json = await graphGet<{ data?: any[] }>('me/adaccounts', {
    fields: 'id,name,account_status,currency,amount_spent,business_name',
    limit: limitOf(params.limit),
  });
  return { ok: true, count: json.data?.length || 0, accounts: json.data || [] };
}

async function runGetCampaign(params: Record<string, unknown>) {
  const id = String(params.campaign_id || '').trim();
  if (!id) throw new Error('campaign_id is required');
  const campaign = await graphGet(id, {
    fields:
      'id,name,status,effective_status,objective,daily_budget,lifetime_budget,created_time,insights.date_preset(last_7d){spend,impressions,clicks,ctr,cpc,actions}',
  });
  const insight = Array.isArray(campaign.insights?.data) ? campaign.insights.data[0] : null;
  return { ok: true, campaign: { ...campaign, last_7d: summarizeInsights(insight) } };
}

async function runListAdsets(params: Record<string, unknown>) {
  const parent = String(params.campaign_id || '').trim() || (await resolveAccountId(params.account_id as string | undefined));
  const json = await graphGet<{ data?: any[] }>(`${parent}/adsets`, {
    fields: 'id,name,status,effective_status,daily_budget,lifetime_budget,optimization_goal,billing_event,campaign_id',
    limit: limitOf(params.limit),
  });
  return { ok: true, count: json.data?.length || 0, adsets: json.data || [] };
}

async function runListAds(params: Record<string, unknown>) {
  const parent =
    String(params.adset_id || '').trim() ||
    String(params.campaign_id || '').trim() ||
    (await resolveAccountId(params.account_id as string | undefined));
  const json = await graphGet<{ data?: any[] }>(`${parent}/ads`, {
    fields: 'id,name,status,effective_status,adset_id,campaign_id,creative{id,name,title,body}',
    limit: limitOf(params.limit),
  });
  return { ok: true, count: json.data?.length || 0, ads: json.data || [] };
}

export async function getAdPerformance(params: {
  campaign_id?: string;
  account_id?: string;
  date_preset?: string;
  limit?: unknown;
} = {}) {
  const parent =
    String(params.campaign_id || '').trim() || (await resolveAccountId(params.account_id as string | undefined));
  const datePreset = String(params.date_preset || 'last_7d').trim() || 'last_7d';
  const adsJson = await graphGet<{ data?: any[] }>(`${parent}/ads`, {
    fields:
      'id,name,status,effective_status,campaign_id,creative{id,name,title,body,call_to_action_type}',
    limit: limitOf(params.limit, 20),
  });
  let insightRows: any[] = [];
  try {
    const ins = await graphGet<{ data?: any[] }>(`${parent}/insights`, {
      fields: `${DEFAULT_INSIGHT_FIELDS},ad_id,ad_name,campaign_id,campaign_name`,
      date_preset: datePreset,
      level: 'ad',
      limit: 50,
    });
    insightRows = ins.data || [];
  } catch {
    insightRows = [];
  }
  const byId = new Map<string, ReturnType<typeof summarizeInsights>>();
  const names = new Map<string, string>();
  for (const row of insightRows) {
    const id = String(row.ad_id || '');
    if (!id) continue;
    byId.set(id, summarizeInsights(row));
    if (row.campaign_name) names.set(id, String(row.campaign_name));
  }
  const ads = (adsJson.data || []).map((ad) => {
    const creative = ad.creative || {};
    const perf = byId.get(String(ad.id)) || null;
    return {
      id: ad.id,
      name: ad.name,
      status: ad.effective_status || ad.status,
      campaign_id: ad.campaign_id,
      campaign_name: names.get(String(ad.id)) || null,
      headline: String(creative.title || creative.name || '').slice(0, 180),
      body: String(creative.body || '').slice(0, 280),
      cta: creative.call_to_action_type || '',
      last_7d: perf,
    };
  });
  return { ok: true, parent, date_preset: datePreset, count: ads.length, ads };
}

async function runGetInsights(params: Record<string, unknown>) {
  const objectId = String(params.object_id || '').trim() || (await resolveAccountId());
  const level = String(params.level || 'account').trim().toLowerCase();
  const datePreset = String(params.date_preset || 'last_7d').trim() || 'last_7d';
  const json = await graphGet<{ data?: any[] }>(`${objectId}/insights`, {
    fields: `${DEFAULT_INSIGHT_FIELDS},campaign_id,campaign_name,adset_id,ad_id`,
    date_preset: datePreset,
    ...(level && level !== 'account' ? { level } : {}),
    limit: 50,
  });
  const rows = (json.data || []).map((row) => ({
    ...summarizeInsights(row),
    campaign_id: row.campaign_id,
    campaign_name: row.campaign_name,
    adset_id: row.adset_id,
    ad_id: row.ad_id,
    raw_actions: row.actions || [],
  }));
  return { ok: true, object_id: objectId, level, date_preset: datePreset, count: rows.length, rows };
}

const PAGE_FIELDS =
  'id,name,fan_count,followers_count,link,category,verification_status,instagram_business_account{id,username}';

export async function listPages(params: { limit?: unknown } = {}) {
  const json = await graphGet<{ data?: any[] }>('me/accounts', {
    fields: PAGE_FIELDS,
    limit: limitOf(params.limit),
  });
  return { ok: true, count: json.data?.length || 0, pages: json.data || [] };
}

async function runGetPage(params: Record<string, unknown>) {
  const id = String(params.page_id || '').trim();
  if (!id) throw new Error('page_id is required');
  const page = await graphGet(id, { fields: PAGE_FIELDS });
  return { ok: true, page };
}

async function runGetPageInsights(params: Record<string, unknown>) {
  const id = String(params.page_id || '').trim();
  if (!id) throw new Error('page_id is required');
  const datePreset = String(params.date_preset || 'last_7d').trim() || 'last_7d';
  const json = await graphGet<{ data?: any[] }>(`${id}/insights`, {
    metric: 'page_impressions,page_impressions_unique,page_post_engagements,page_fans,page_follows',
    period: 'day',
    date_preset: datePreset,
  });
  const metrics = (json.data || []).map((row) => ({
    name: row.name,
    title: row.title,
    period: row.period,
    values: row.values,
  }));
  return { ok: true, page_id: id, date_preset: datePreset, metrics };
}

export async function listPixels(params: { account_id?: string } = {}) {
  const act = await resolveAccountId(params.account_id);
  const fields = 'id,name,is_unavailable,last_fired_time,creation_time,owner_ad_account';
  const collected = new Map<string, any>();
  const add = (rows?: any[]) => {
    for (const row of rows || []) {
      if (row?.id) collected.set(String(row.id), row);
    }
  };

  try {
    add((await graphGet<{ data?: any[] }>(`${act}/adspixels`, { fields })).data);
  } catch {
    /* try fallbacks */
  }
  if (collected.size === 0) {
    try {
      const acc = await graphGet<any>(act, { fields: `adspixels{${fields}},business{id}` });
      add(acc?.adspixels?.data);
      const businessId = acc?.business?.id;
      if (businessId && collected.size === 0) {
        for (const edge of ['owned_pixels', 'client_pixels'] as const) {
          try {
            add((await graphGet<{ data?: any[] }>(`${businessId}/${edge}`, { fields })).data);
          } catch {
            /* ignore */
          }
        }
      }
    } catch {
      /* ignore */
    }
  }

  const pixels = [...collected.values()];
  if (pixels[0]?.id) {
    try {
      const stats = await runGetPixelStats({ pixel_id: pixels[0].id, days: 7 });
      pixels[0] = { ...pixels[0], events: stats.events };
    } catch {
      /* stats optional */
    }
  }
  return { ok: true, count: pixels.length, pixels };
}

async function runGetPixel(params: Record<string, unknown>) {
  const id = String(params.pixel_id || '').trim();
  if (!id) throw new Error('pixel_id is required');
  const pixel = await graphGet(id, {
    fields: 'id,name,is_unavailable,last_fired_time,creation_time,owner_ad_account',
  });
  return { ok: true, pixel };
}

function unixDaysAgo(days: number): number {
  return Math.floor(Date.now() / 1000) - Math.max(1, days) * 86400;
}

function normalizePixelStats(raw: any): Array<{ event: string; count: number }> {
  const rows: Array<{ event: string; count: number }> = [];
  const payload = Array.isArray(raw?.data) ? raw.data[0] : raw;
  const inner = payload?.data;
  if (inner && typeof inner === 'object' && !Array.isArray(inner)) {
    for (const [event, count] of Object.entries(inner)) {
      rows.push({ event, count: Number(count || 0) });
    }
    return rows.sort((a, b) => b.count - a.count);
  }
  if (Array.isArray(inner)) {
    for (const item of inner) {
      const event = String(item?.value || item?.event || item?.key || '');
      if (event) rows.push({ event, count: Number(item?.count || item?.value || 0) });
    }
  }
  return rows.sort((a, b) => b.count - a.count);
}

async function runGetPixelStats(params: Record<string, unknown>) {
  const id = String(params.pixel_id || '').trim();
  if (!id) throw new Error('pixel_id is required');
  const days = Math.min(90, Math.max(1, Number(params.days) || 7));
  const json = await graphGet(`${id}/stats`, {
    aggregation: 'event',
    start_time: unixDaysAgo(days),
    end_time: Math.floor(Date.now() / 1000),
  });
  const events = normalizePixelStats(json);
  return { ok: true, pixel_id: id, days, events };
}

export async function runMetaAdsTool(name: string, params: Record<string, unknown> = {}) {
  switch (name) {
    case 'get_account_info':
      return runGetAccountInfo(params);
    case 'list_ad_accounts':
      return runListAdAccounts(params);
    case 'list_campaigns':
      return listCampaigns(params);
    case 'get_campaign':
      return runGetCampaign(params);
    case 'list_adsets':
      return runListAdsets(params);
    case 'list_ads':
      return runListAds(params);
    case 'get_ad_performance':
      return getAdPerformance(params);
    case 'get_insights':
      return runGetInsights(params);
    case 'get_spend_summary':
      return getSpendSummary(params.account_id as string | undefined);
    case 'get_funds_tracker':
      return getFundsTracker(params.account_id as string | undefined);
    case 'list_ad_transactions':
      return runListAdTransactions(params);
    case 'list_pages':
      return listPages(params);
    case 'get_page':
      return runGetPage(params);
    case 'get_page_insights':
      return runGetPageInsights(params);
    case 'list_pixels':
      return listPixels(params);
    case 'get_pixel':
      return runGetPixel(params);
    case 'get_pixel_stats':
      return runGetPixelStats(params);
    default:
      throw new Error(`Unknown Meta Ads tool: ${name}`);
  }
}

