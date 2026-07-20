import { resolveReportDateRange } from '@/lib/report-date-range';
import { estimateMisaAiCostUsd, getMisaAiUsdInrRate } from '@/lib/chatbot_v2/misaAiBilling';

const OPENAI_API_BASE = 'https://api.openai.com/v1';

type OpenAiBucket<T> = {
  object?: string;
  start_time?: number;
  end_time?: number;
  results?: T[];
};

type OpenAiPaginatedResponse<T> = {
  object?: string;
  data?: OpenAiBucket<T>[];
  has_more?: boolean;
  next_page?: string | null;
};

type CompletionUsageResult = {
  input_tokens?: number;
  output_tokens?: number;
  num_model_requests?: number;
  model?: string | null;
  user_id?: string | null;
  project_id?: string | null;
  api_key_id?: string | null;
  input_cached_tokens?: number;
};

type CostResult = {
  amount?: { value?: number; currency?: string };
  line_item?: string | null;
  project_id?: string | null;
};

export type OpenAiOrgUsageSummary = {
  configured: boolean;
  error?: string;
  range_label: string;
  from_unix: number;
  to_unix: number;
  timezone_note: string;
  project_filter: string | null;
  fetched_at: string;
  total_spend_usd: number;
  total_spend_inr: number;
  total_tokens: number;
  input_tokens: number;
  output_tokens: number;
  total_requests: number;
  cached_tokens: number;
  daily_costs: Array<{ date: string; cost_usd: number; cost_inr: number }>;
  daily_usage: Array<{ date: string; requests: number; tokens: number; input_tokens: number; output_tokens: number }>;
  by_model: Array<{ model: string; requests: number; input_tokens: number; output_tokens: number; tokens: number }>;
  by_user: Array<{ user_id: string; requests: number; tokens: number }>;
  by_line_item: Array<{ line_item: string; cost_usd: number }>;
  completions_summary: {
    requests: number;
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
};

let cache: { key: string; expiresAt: number; value: OpenAiOrgUsageSummary } | null = null;
const CACHE_TTL_MS = 120_000;
const OPENAI_ADMIN_MIN_GAP_MS = 350;

let lastOpenAiAdminRequestAt = 0;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function throttleOpenAiAdminRequest() {
  const now = Date.now();
  const waitMs = lastOpenAiAdminRequestAt + OPENAI_ADMIN_MIN_GAP_MS - now;
  if (waitMs > 0) await sleep(waitMs);
  lastOpenAiAdminRequestAt = Date.now();
}

function parseRetryAfterMs(res: Response, attempt: number): number {
  const header = res.headers.get('retry-after');
  const seconds = header ? Number(header) : NaN;
  if (Number.isFinite(seconds) && seconds > 0) return seconds * 1000;
  return Math.min(15_000, 4_000 + attempt * 2_000);
}

async function fetchOpenAiOrgPages<T>(
  path: string,
  params: Record<string, string | number | string[] | undefined>,
): Promise<OpenAiBucket<T>[]> {
  const adminKey = getOpenAiAdminKey();
  if (!adminKey) {
    throw new Error('OPENAI_ADMIN_API_KEY is not configured on server');
  }

  const buckets: OpenAiBucket<T>[] = [];
  let page: string | undefined;

  do {
    const query = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      if (value === undefined || value === null || value === '') continue;
      if (Array.isArray(value)) {
        for (const item of value) query.append(`${key}[]`, item);
      } else {
        query.set(key, String(value));
      }
    }
    if (page) query.set('page', page);

    let attempt = 0;
    let res: Response | null = null;
    while (attempt < 5) {
      attempt += 1;
      await throttleOpenAiAdminRequest();
      res = await fetch(`${OPENAI_API_BASE}${path}?${query.toString()}`, {
        headers: {
          Authorization: `Bearer ${adminKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      });

      if (res.status === 429) {
        await sleep(parseRetryAfterMs(res, attempt));
        continue;
      }
      break;
    }

    if (!res || !res.ok) {
      const txt = await res?.text().catch(() => '') || '';
      throw new Error(`OpenAI admin API failed (${res?.status || 500}): ${txt.slice(0, 300)}`);
    }

    const json = (await res.json()) as OpenAiPaginatedResponse<T>;
    buckets.push(...(json.data || []));
    page = json.next_page || undefined;
  } while (page);

  return buckets;
}

function getOpenAiAdminKey(): string | null {
  const key = String(process.env.OPENAI_ADMIN_API_KEY || process.env.OPENAI_ADMIN_KEY || '').trim();
  return key || null;
}

function unixFromIso(iso: string): number {
  return Math.floor(new Date(iso).getTime() / 1000);
}

/** OpenAI usage dashboard buckets days in UTC — match platform.openai.com/usage */
function openAiUtcRangeFromYmd(startYmd: string, endYmd: string) {
  const [sy, sm, sd] = startYmd.split('-').map(Number);
  const [ey, em, ed] = endYmd.split('-').map(Number);
  const startUnix = Math.floor(Date.UTC(sy, sm - 1, sd, 0, 0, 0) / 1000);
  // OpenAI end_time is exclusive — use start of day after endYmd (UTC)
  const endUnix = Math.floor(Date.UTC(ey, em - 1, ed + 1, 0, 0, 0) / 1000);
  return { startUnix, endUnix };
}

function getOpenAiProjectIds(): string[] {
  const raw = String(process.env.OPENAI_ORG_PROJECT_ID || process.env.OPENAI_PROJECT_ID || '').trim();
  if (!raw) return [];
  return raw.split(',').map((value) => value.trim()).filter(Boolean);
}

function ymdFromUnix(unix: number): string {
  const date = new Date(unix * 1000);
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

function aggregateGroupedUsage(
  buckets: OpenAiBucket<CompletionUsageResult>[],
  field: 'model' | 'user_id',
) {
  const map = new Map<string, { requests: number; input_tokens: number; output_tokens: number; tokens: number }>();

  for (const bucket of buckets) {
    for (const row of bucket.results || []) {
      const key = String((row as Record<string, unknown>)[field] || 'unknown').trim() || 'unknown';
      const current = map.get(key) || { requests: 0, input_tokens: 0, output_tokens: 0, tokens: 0 };
      const input = Number(row.input_tokens || 0);
      const output = Number(row.output_tokens || 0);
      current.requests += Number(row.num_model_requests || 0);
      current.input_tokens += input;
      current.output_tokens += output;
      current.tokens += input + output;
      map.set(key, current);
    }
  }

  return [...map.entries()]
    .map(([id, stats]) => ({
      ...(field === 'model' ? { model: id } : { user_id: id }),
      ...stats,
    }))
    .sort((a, b) => b.tokens - a.tokens);
}

export async function getOpenAiOrgUsageSummary(input: {
  preset?: string;
  start?: string | null;
  end?: string | null;
  force?: boolean;
}): Promise<OpenAiOrgUsageSummary> {
  const adminKey = getOpenAiAdminKey();
  const range = resolveReportDateRange(input.preset, input.start, input.end);
  const { startUnix, endUnix } = openAiUtcRangeFromYmd(range.startYmd, range.endYmd);
  const projectIds = getOpenAiProjectIds();
  const cacheKey = `${input.preset || 'last_7_days'}:${range.startYmd}:${range.endYmd}:${projectIds.join(',')}`;

  if (!input.force && cache && cache.key === cacheKey && cache.expiresAt > Date.now()) {
    return cache.value;
  }

  if (!adminKey) {
    return {
      configured: false,
      error: 'Add OPENAI_ADMIN_API_KEY in server env (OpenAI → Settings → Admin keys). Regular OPENAI_API_KEY cannot read org usage.',
      range_label: range.label,
      from_unix: startUnix,
      to_unix: endUnix,
      timezone_note: 'OpenAI costs use UTC day boundaries to match platform.openai.com.',
      project_filter: projectIds.length > 0 ? projectIds.join(', ') : null,
      fetched_at: new Date().toISOString(),
      total_spend_usd: 0,
      total_spend_inr: 0,
      total_tokens: 0,
      input_tokens: 0,
      output_tokens: 0,
      total_requests: 0,
      cached_tokens: 0,
      daily_costs: [],
      daily_usage: [],
      by_model: [],
      by_user: [],
      by_line_item: [],
      completions_summary: { requests: 0, input_tokens: 0, output_tokens: 0, total_tokens: 0 },
    };
  }

  const daySpan = Math.max(1, Math.ceil((endUnix - startUnix) / 86400));
  // OpenAI allows max limit=31 when bucket_width=1d; longer ranges use pagination (next_page)
  const limit = Math.min(Math.max(daySpan + 2, 7), 31);

  const baseParams: Record<string, string | number | string[] | undefined> = {
    start_time: startUnix,
    end_time: endUnix,
    bucket_width: '1d',
    limit,
  };
  if (projectIds.length > 0) {
    baseParams.project_ids = projectIds;
  }

  // Sequential calls — OpenAI admin usage API allows ~10 requests/minute
  const costBuckets = await fetchOpenAiOrgPages<CostResult>('/organization/costs', {
    ...baseParams,
    group_by: ['line_item'],
  });
  const usageBuckets = await fetchOpenAiOrgPages<CompletionUsageResult>(
    '/organization/usage/completions',
    baseParams,
  );
  const modelBuckets = await fetchOpenAiOrgPages<CompletionUsageResult>(
    '/organization/usage/completions',
    {
      ...baseParams,
      group_by: ['model'],
      limit: 31,
    },
  );
  const userBuckets = await fetchOpenAiOrgPages<CompletionUsageResult>(
    '/organization/usage/completions',
    {
      ...baseParams,
      group_by: ['user_id'],
      limit: 31,
    },
  );

  const usdInr = getMisaAiUsdInrRate();
  let totalSpendUsd = 0;
  const dailyCostsMap = new Map<string, number>();
  const lineItemMap = new Map<string, number>();

  for (const bucket of costBuckets) {
    const date = ymdFromUnix(Number(bucket.start_time || 0));
    for (const row of bucket.results || []) {
      const value = Number(row.amount?.value || 0);
      totalSpendUsd += value;
      dailyCostsMap.set(date, (dailyCostsMap.get(date) || 0) + value);
      const lineItem = String(row.line_item || 'other').trim() || 'other';
      lineItemMap.set(lineItem, (lineItemMap.get(lineItem) || 0) + value);
    }
  }

  let inputTokens = 0;
  let outputTokens = 0;
  let totalRequests = 0;
  let cachedTokens = 0;
  const dailyUsageMap = new Map<string, { requests: number; input_tokens: number; output_tokens: number; tokens: number }>();

  for (const bucket of usageBuckets) {
    const date = ymdFromUnix(Number(bucket.start_time || 0));
    for (const row of bucket.results || []) {
      const input = Number(row.input_tokens || 0);
      const output = Number(row.output_tokens || 0);
      const requests = Number(row.num_model_requests || 0);
      inputTokens += input;
      outputTokens += output;
      totalRequests += requests;
      cachedTokens += Number(row.input_cached_tokens || 0);
      const daily = dailyUsageMap.get(date) || { requests: 0, input_tokens: 0, output_tokens: 0, tokens: 0 };
      daily.requests += requests;
      daily.input_tokens += input;
      daily.output_tokens += output;
      daily.tokens += input + output;
      dailyUsageMap.set(date, daily);
    }
  }

  const daily_costs = [...dailyCostsMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, cost_usd]) => ({
      date,
      cost_usd: Number(cost_usd.toFixed(4)),
      cost_inr: Math.round(cost_usd * usdInr),
    }));

  const daily_usage = [...dailyUsageMap.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, row]) => ({ date, ...row }));

  const by_model = aggregateGroupedUsage(modelBuckets, 'model').map((row) => ({
    model: row.model,
    requests: row.requests,
    input_tokens: row.input_tokens,
    output_tokens: row.output_tokens,
    tokens: row.tokens,
  }));

  const by_user = aggregateGroupedUsage(userBuckets, 'user_id').map((row) => ({
    user_id: row.user_id,
    requests: row.requests,
    tokens: row.tokens,
  }));

  const by_line_item = [...lineItemMap.entries()]
    .map(([line_item, cost_usd]) => ({ line_item, cost_usd: Number(cost_usd.toFixed(4)) }))
    .sort((a, b) => b.cost_usd - a.cost_usd);

  const summary: OpenAiOrgUsageSummary = {
    configured: true,
    range_label: range.label,
    from_unix: startUnix,
    to_unix: endUnix,
    timezone_note: 'OpenAI costs use UTC day boundaries to match platform.openai.com.',
    project_filter: projectIds.length > 0 ? projectIds.join(', ') : null,
    fetched_at: new Date().toISOString(),
    total_spend_usd: Number(totalSpendUsd.toFixed(4)),
    total_spend_inr: Math.round(totalSpendUsd * usdInr),
    total_tokens: inputTokens + outputTokens,
    input_tokens: inputTokens,
    output_tokens: outputTokens,
    total_requests: totalRequests,
    cached_tokens: cachedTokens,
    daily_costs,
    daily_usage,
    by_model,
    by_user,
    by_line_item,
    completions_summary: {
      requests: totalRequests,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      total_tokens: inputTokens + outputTokens,
    },
  };

  cache = { key: cacheKey, expiresAt: Date.now() + CACHE_TTL_MS, value: summary };
  return summary;
}

export function maskOpenAiAdminKeyHint(): string {
  const key = getOpenAiAdminKey();
  if (!key) return '';
  if (key.length <= 8) return '••••';
  return `${key.slice(0, 4)}…${key.slice(-4)}`;
}

/** OpenAI daily costs API rejects ranges shorter than ~1 UTC day */
const MIN_OPENAI_COSTS_RANGE_SECONDS = 86400;

async function getOpenAiOrgSpendUsdFromCompletionsUsage(startUnix: number, endUnix: number): Promise<number> {
  const rangeSeconds = endUnix - startUnix;
  const useMinuteBuckets = rangeSeconds <= 2 * 3600;
  const bucketWidth = useMinuteBuckets ? '1m' : '1h';
  const bucketSeconds = useMinuteBuckets ? 60 : 3600;
  const limit = Math.min(
    Math.max(Math.ceil(rangeSeconds / bucketSeconds) + 2, useMinuteBuckets ? 60 : 24),
    useMinuteBuckets ? 1440 : 168,
  );

  const projectIds = getOpenAiProjectIds();
  const baseParams: Record<string, string | number | string[] | undefined> = {
    start_time: startUnix,
    end_time: endUnix,
    bucket_width: bucketWidth,
    limit,
    group_by: ['model'],
  };
  if (projectIds.length > 0) {
    baseParams.project_ids = projectIds;
  }

  const usageBuckets = await fetchOpenAiOrgPages<CompletionUsageResult>(
    '/organization/usage/completions',
    baseParams,
  );

  let totalSpendUsd = 0;
  for (const bucket of usageBuckets) {
    const bucketStart = Number(bucket.start_time || 0);
    if (bucketStart > 0 && bucketStart + bucketSeconds <= startUnix) continue;

    for (const row of bucket.results || []) {
      totalSpendUsd += estimateMisaAiCostUsd({
        model: String(row.model || 'gpt-4o'),
        promptTokens: Number(row.input_tokens || 0),
        completionTokens: Number(row.output_tokens || 0),
      });
    }
  }

  return Number(totalSpendUsd.toFixed(4));
}

/** Total org spend in USD between unix timestamps (uses Admin costs API, paginated). */
export async function getOpenAiOrgSpendUsdInRange(startUnix: number, endUnix: number): Promise<number> {
  if (!Number.isFinite(startUnix) || !Number.isFinite(endUnix) || endUnix <= startUnix) {
    return 0;
  }

  const rangeSeconds = endUnix - startUnix;
  if (rangeSeconds < MIN_OPENAI_COSTS_RANGE_SECONDS) {
    return getOpenAiOrgSpendUsdFromCompletionsUsage(startUnix, endUnix);
  }

  const projectIds = getOpenAiProjectIds();
  const baseParams: Record<string, string | number | string[] | undefined> = {
    start_time: startUnix,
    end_time: endUnix,
    bucket_width: '1d',
    limit: 31,
  };
  if (projectIds.length > 0) {
    baseParams.project_ids = projectIds;
  }

  const costBuckets = await fetchOpenAiOrgPages<CostResult>('/organization/costs', baseParams);
  let totalSpendUsd = 0;
  for (const bucket of costBuckets) {
    for (const row of bucket.results || []) {
      totalSpendUsd += Number(row.amount?.value || 0);
    }
  }
  return totalSpendUsd;
}

/** Lightweight probe for System Monitor — one admin API call max */
export async function probeOpenAiAdminBillingAccess(): Promise<{ ok: boolean; error?: string }> {
  const adminKey = getOpenAiAdminKey();
  if (!adminKey) {
    return { ok: false, error: 'OPENAI_ADMIN_API_KEY is not set' };
  }

  const startUnix = Math.floor(Date.now() / 1000) - 86400;
  try {
    const res = await fetch(
      `${OPENAI_API_BASE}/organization/costs?start_time=${startUnix}&bucket_width=1d&limit=1`,
      {
        headers: {
          Authorization: `Bearer ${adminKey}`,
          'Content-Type': 'application/json',
        },
        cache: 'no-store',
      },
    );
    if (!res.ok) {
      const txt = await res.text().catch(() => '');
      return { ok: false, error: `HTTP ${res.status}: ${txt.slice(0, 180)}` };
    }
    return { ok: true };
  } catch (error: unknown) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}
