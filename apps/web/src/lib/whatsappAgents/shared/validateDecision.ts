import { parseDecisionJson } from './decisionSchema';
import type { AgentDecision } from './types';

export function validateDecision(raw: unknown): { ok: true; decision: AgentDecision } | { ok: false; error: string } {
  const parsed = parseDecisionJson(raw);
  if (!parsed.ok) return parsed;
  return { ok: true, decision: parsed.decision as AgentDecision };
}

export function extractJsonFromLlmText(text: string): unknown {
  const trimmed = text.trim();
  if (trimmed.startsWith('{')) {
    try {
      return JSON.parse(trimmed);
    } catch {
      // fall through
    }
  }

  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenceMatch?.[1]) {
    try {
      return JSON.parse(fenceMatch[1].trim());
    } catch {
      // fall through
    }
  }

  const start = trimmed.indexOf('{');
  const end = trimmed.lastIndexOf('}');
  if (start >= 0 && end > start) {
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      // fall through
    }
  }

  return null;
}
