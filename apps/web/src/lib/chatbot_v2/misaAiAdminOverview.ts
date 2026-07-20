import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  DEFAULT_MISA_AI_USD_INR_RATE,
  getMisaAiUsdInrRate,
  MISA_AI_MODEL_PRICING_USD,
} from '@/lib/chatbot_v2/misaAiBilling';
import { enumerateYmdRange, istYmd, resolveReportDateRange } from '@/lib/report-date-range';

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

type UsageRow = {
  channel: string;
  model: string;
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
  estimated_cost_usd: number;
  created_at: string;
};

function isMissingTableError(message?: string | null) {
  const value = String(message || '').toLowerCase();
  return value.includes('misa_ai_usage_logs') && (value.includes('does not exist') || value.includes('relation'));
}

function aggregateSessions(rows: Array<{ data?: any; expires_at?: string }>, startIso: string, endIso: string) {
  let conversations = 0;
  let messages = 0;
  let userMessages = 0;
  let assistantMessages = 0;
  let withBookingProgress = 0;
  let withPhone = 0;

  const startMs = new Date(startIso).getTime();
  const endMs = new Date(endIso).getTime();

  for (const row of rows) {
    const expiresMs = new Date(String(row.expires_at || '')).getTime();
    if (!Number.isFinite(expiresMs)) continue;
    const activityMs = expiresMs - SESSION_TTL_MS;
    if (activityMs < startMs || activityMs > endMs) continue;

    conversations += 1;
    const history: Array<{ role?: string; content?: string }> = row.data?.history || [];
    messages += history.length;
    userMessages += history.filter((item) => item.role === 'user').length;
    assistantMessages += history.filter((item) => item.role === 'assistant').length;

    const bookingState = row.data?.bookingState || {};
    if (bookingState.customerName || bookingState.selectedService || bookingState.phoneNumber) {
      withBookingProgress += 1;
    }
    if (bookingState.phoneNumber || row.data?.phoneVerification?.phone) {
      withPhone += 1;
    }
  }

  return {
    conversations,
    messages,
    user_messages: userMessages,
    assistant_messages: assistantMessages,
    avg_messages_per_conversation: conversations > 0 ? Number((messages / conversations).toFixed(1)) : 0,
    with_booking_progress: withBookingProgress,
    with_phone: withPhone,
  };
}

function aggregateUsage(rows: UsageRow[]) {
  const byChannel: Record<string, { requests: number; tokens: number; cost_usd: number }> = {};
  const byModel: Record<string, { requests: number; tokens: number; cost_usd: number }> = {};
  const dailyMap = new Map<string, { requests: number; tokens: number; cost_usd: number; conversations: number }>();

  let requests = 0;
  let promptTokens = 0;
  let completionTokens = 0;
  let totalTokens = 0;
  let costUsd = 0;

  for (const row of rows) {
    requests += 1;
    promptTokens += Number(row.prompt_tokens || 0);
    completionTokens += Number(row.completion_tokens || 0);
    totalTokens += Number(row.total_tokens || 0);
    costUsd += Number(row.estimated_cost_usd || 0);

    const channel = String(row.channel || 'UNKNOWN').toUpperCase();
    if (!byChannel[channel]) byChannel[channel] = { requests: 0, tokens: 0, cost_usd: 0 };
    byChannel[channel].requests += 1;
    byChannel[channel].tokens += Number(row.total_tokens || 0);
    byChannel[channel].cost_usd += Number(row.estimated_cost_usd || 0);

    const model = String(row.model || 'gpt-4o');
    if (!byModel[model]) byModel[model] = { requests: 0, tokens: 0, cost_usd: 0 };
    byModel[model].requests += 1;
    byModel[model].tokens += Number(row.total_tokens || 0);
    byModel[model].cost_usd += Number(row.estimated_cost_usd || 0);

    const day = istYmd(new Date(row.created_at));
    const daily = dailyMap.get(day) || { requests: 0, tokens: 0, cost_usd: 0, conversations: 0 };
    daily.requests += 1;
    daily.tokens += Number(row.total_tokens || 0);
    daily.cost_usd += Number(row.estimated_cost_usd || 0);
    dailyMap.set(day, daily);
  }

  return {
    requests,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    cost_usd: Number(costUsd.toFixed(4)),
    by_channel: Object.entries(byChannel)
      .map(([channel, stats]) => ({ channel, ...stats, cost_usd: Number(stats.cost_usd.toFixed(4)) }))
      .sort((a, b) => b.requests - a.requests),
    by_model: Object.entries(byModel)
      .map(([model, stats]) => ({ model, ...stats, cost_usd: Number(stats.cost_usd.toFixed(4)) }))
      .sort((a, b) => b.requests - a.requests),
    daily_map: dailyMap,
  };
}

export async function getMisaAiAdminOverview(input: {
  preset?: string;
  start?: string | null;
  end?: string | null;
}) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error('Database admin client unavailable');
  }

  const range = resolveReportDateRange(input.preset, input.start, input.end);
  const startIso = range.start;
  const endIso = range.end;
  const expiresStartIso = new Date(new Date(startIso).getTime() + SESSION_TTL_MS).toISOString();
  const expiresEndIso = new Date(new Date(endIso).getTime() + SESSION_TTL_MS).toISOString();

  const [sessionsRes, bookingsRes, kbRes, usageRes] = await Promise.all([
    supabaseAdmin
      .from('chat_sessions')
      .select('session_id, data, expires_at')
      .gte('expires_at', expiresStartIso)
      .lte('expires_at', expiresEndIso)
      .limit(5000),
    supabaseAdmin
      .from('chatbot_bookings')
      .select('id, status, created_at, source, service_name, city')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .limit(5000),
    supabaseAdmin
      .from('kb_question_events')
      .select('id, status, created_at')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .limit(5000),
    supabaseAdmin
      .from('misa_ai_usage_logs')
      .select('channel, model, prompt_tokens, completion_tokens, total_tokens, estimated_cost_usd, created_at')
      .gte('created_at', startIso)
      .lte('created_at', endIso)
      .order('created_at', { ascending: false })
      .limit(10000),
  ]);

  const sessionStats = aggregateSessions(sessionsRes.data || [], startIso, endIso);
  const bookings = bookingsRes.data || [];
  const kbEvents = kbRes.data || [];

  let usageAvailable = true;
  let usageRows: UsageRow[] = [];
  if (usageRes.error) {
    usageAvailable = !isMissingTableError(usageRes.error.message);
    if (usageAvailable) throw new Error(usageRes.error.message);
  } else {
    usageRows = (usageRes.data || []) as UsageRow[];
  }

  const usageStats = aggregateUsage(usageRows);
  const usdInr = getMisaAiUsdInrRate();

  const dailyDates = enumerateYmdRange(range.startYmd, range.endYmd).slice(-30);
  const daily_volume = dailyDates.map((date) => {
    const usageDay = usageStats.daily_map.get(date);
    return {
      date,
      requests: usageDay?.requests || 0,
      tokens: usageDay?.tokens || 0,
      cost_usd: Number((usageDay?.cost_usd || 0).toFixed(4)),
      cost_inr: Math.round((usageDay?.cost_usd || 0) * usdInr),
    };
  });

  const bookingsCompleted = bookings.filter((row) => String(row.status || '').toLowerCase() === 'completed').length;
  const bookingsPending = bookings.filter((row) => {
    const status = String(row.status || '').toLowerCase();
    return status && status !== 'completed' && status !== 'cancelled';
  }).length;

  const kbNew = kbEvents.filter((row) => String(row.status || '').toLowerCase() === 'new').length;

  return {
    success: true,
    preset: input.preset || 'last_7_days',
    range_label: range.label,
    from: startIso,
    to: endIso,
    usage_tracking_available: usageAvailable,
    kpis: {
      conversations: sessionStats.conversations,
      messages: sessionStats.messages,
      user_messages: sessionStats.user_messages,
      assistant_messages: sessionStats.assistant_messages,
      avg_messages_per_conversation: sessionStats.avg_messages_per_conversation,
      with_booking_progress: sessionStats.with_booking_progress,
      with_phone: sessionStats.with_phone,
      ai_requests: usageStats.requests,
      total_tokens: usageStats.total_tokens,
      prompt_tokens: usageStats.prompt_tokens,
      completion_tokens: usageStats.completion_tokens,
      estimated_cost_usd: usageStats.cost_usd,
      estimated_cost_inr: Math.round(usageStats.cost_usd * usdInr),
      bookings_total: bookings.length,
      bookings_completed: bookingsCompleted,
      bookings_pending: bookingsPending,
      kb_events: kbEvents.length,
      kb_new: kbNew,
      conversion_rate:
        sessionStats.conversations > 0
          ? Number(((bookingsCompleted / sessionStats.conversations) * 100).toFixed(1))
          : 0,
    },
    channels: usageStats.by_channel,
    models: usageStats.by_model,
    daily_volume,
    recent_bookings: bookings.slice(0, 8).map((row) => ({
      id: row.id,
      status: row.status,
      created_at: row.created_at,
      source: row.source,
      service_name: row.service_name,
      city: row.city,
    })),
    billing: {
      usd_inr_rate: usdInr,
      default_usd_inr_rate: DEFAULT_MISA_AI_USD_INR_RATE,
      model_pricing_usd: MISA_AI_MODEL_PRICING_USD,
      note: usageAvailable
        ? 'Costs are estimated from logged OpenAI token usage using published model rates.'
        : 'Run database/278_misa_ai_usage_logs.sql to enable usage & billing tracking.',
    },
  };
}

export async function listMisaAiUsageLogs(input: {
  preset?: string;
  start?: string | null;
  end?: string | null;
  page?: number;
  limit?: number;
  exportCsv?: boolean;
}) {
  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    throw new Error('Database admin client unavailable');
  }

  const range = resolveReportDateRange(input.preset, input.start, input.end);
  const startIso = range.start;
  const endIso = range.end;
  const page = Math.max(1, Number(input.page || 1));
  const limit = Math.min(Math.max(Number(input.limit || 50), 1), 200);
  const from = (page - 1) * limit;
  const to = from + limit - 1;

  const query = supabaseAdmin
    .from('misa_ai_usage_logs')
    .select(
      'id, session_id, channel, model, prompt_tokens, completion_tokens, total_tokens, tool_calls_count, iterations, estimated_cost_usd, user_message_preview, created_at',
      { count: 'exact' },
    )
    .gte('created_at', startIso)
    .lte('created_at', endIso)
    .order('created_at', { ascending: false });

  if (input.exportCsv) {
    const { data, error } = await query.limit(5000);
    if (error) throw new Error(error.message);
    const rows = data || [];
    const header = [
      'created_at',
      'channel',
      'model',
      'session_id',
      'prompt_tokens',
      'completion_tokens',
      'total_tokens',
      'tool_calls_count',
      'iterations',
      'estimated_cost_usd',
      'user_message_preview',
    ];
    const csv = [
      header.join(','),
      ...rows.map((row) =>
        [
          row.created_at,
          row.channel,
          row.model,
          row.session_id || '',
          row.prompt_tokens,
          row.completion_tokens,
          row.total_tokens,
          row.tool_calls_count,
          row.iterations,
          row.estimated_cost_usd,
          `"${String(row.user_message_preview || '').replace(/"/g, '""')}"`,
        ].join(','),
      ),
    ].join('\n');
    return {
      csv,
      filename: `misa-ai-usage-${range.startYmd}-${range.endYmd}.csv`,
    };
  }

  const { data, error, count } = await query.range(from, to);
  if (error) {
    if (isMissingTableError(error.message)) {
      return {
        rows: [],
        total: 0,
        page,
        total_pages: 1,
        usage_tracking_available: false,
        total_all_time: 0,
      };
    }
    throw new Error(error.message);
  }

  const { count: totalAllTime } = await supabaseAdmin
    .from('misa_ai_usage_logs')
    .select('*', { count: 'exact', head: true });

  const usdInr = getMisaAiUsdInrRate();
  return {
    rows: (data || []).map((row) => ({
      ...row,
      estimated_cost_inr: Math.round(Number(row.estimated_cost_usd || 0) * usdInr),
    })),
    total: count || 0,
    total_all_time: totalAllTime || 0,
    page,
    total_pages: Math.max(1, Math.ceil((count || 0) / limit)),
    usage_tracking_available: true,
    range_label: range.label,
  };
}
