import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { estimateMisaAiCostUsd } from '@/lib/chatbot_v2/misaAiBilling';
import type { MisaBookingChannel } from '@/lib/chatbot_v2/misaLeadSource';

export type MisaAiUsageChannel = MisaBookingChannel | 'ADMIN' | 'UNKNOWN';

export type MisaAiUsageInput = {
  sessionId?: string | null;
  channel?: MisaAiUsageChannel;
  model: string;
  promptTokens: number;
  completionTokens: number;
  totalTokens?: number;
  toolCallsCount?: number;
  iterations?: number;
  userMessagePreview?: string | null;
};

function mapChannel(channel?: MisaAiUsageChannel): string {
  const value = String(channel || 'WEBSITE').trim().toUpperCase();
  if (['WEBSITE', 'APP', 'WHATSAPP', 'ADMIN', 'UNKNOWN'].includes(value)) return value;
  return 'UNKNOWN';
}

export async function logMisaAiUsage(input: MisaAiUsageInput): Promise<boolean> {
  const promptTokens = Math.max(0, Number(input.promptTokens || 0));
  const completionTokens = Math.max(0, Number(input.completionTokens || 0));
  const totalTokens = Math.max(0, Number(input.totalTokens || promptTokens + completionTokens));

  if (totalTokens <= 0) return false;

  const { supabaseAdmin } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.error('[MISA AI] Usage log skipped: Supabase admin client unavailable');
    return false;
  }

  const model = String(input.model || 'gpt-4o').trim() || 'gpt-4o';
  const estimatedCostUsd = estimateMisaAiCostUsd({
    model,
    promptTokens,
    completionTokens,
  });

  const { error } = await supabaseAdmin.from('misa_ai_usage_logs').insert({
    session_id: input.sessionId || null,
    channel: mapChannel(input.channel),
    model,
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
    tool_calls_count: Math.max(0, Number(input.toolCallsCount || 0)),
    iterations: Math.max(1, Number(input.iterations || 1)),
    estimated_cost_usd: estimatedCostUsd,
    user_message_preview: String(input.userMessagePreview || '').slice(0, 240) || null,
  });

  if (error) {
    console.error('[MISA AI] Failed to log usage:', error.message, error.details || '');
    return false;
  }

  return true;
}
