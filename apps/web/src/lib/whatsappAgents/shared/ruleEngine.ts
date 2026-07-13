import type { AgentConfig, AgentDecision, AgentInstance, RuleValidationResult } from './types';

function parseTimeToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec(hhmm.trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

function isWithinWindow(now: Date, start: string, end: string, timezone: string): boolean {
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(now);
    const hour = Number(parts.find((p) => p.type === 'hour')?.value || 0);
    const minute = Number(parts.find((p) => p.type === 'minute')?.value || 0);
    const current = hour * 60 + minute;

    const startMin = parseTimeToMinutes(start);
    const endMin = parseTimeToMinutes(end);
    if (startMin == null || endMin == null) return true;

    if (startMin <= endMin) {
      return current >= startMin && current <= endMin;
    }
    // overnight window e.g. 21:00 - 08:00
    return current >= startMin || current <= endMin;
  } catch {
    return true;
  }
}

function containsBlockedWord(message: string, blocked: string[]): string | null {
  const lower = message.toLowerCase();
  for (const word of blocked) {
    const w = word.trim().toLowerCase();
    if (w && lower.includes(w)) return w;
  }
  return null;
}

function containsEscalationKeyword(text: string, keywords: string[]): boolean {
  const lower = text.toLowerCase();
  return keywords.some((k) => k.trim() && lower.includes(k.trim().toLowerCase()));
}

export type RuleEngineInput = {
  config: AgentConfig;
  instance: AgentInstance | null;
  decision: AgentDecision;
  customerMessage?: string;
  dailyMessageCount?: number;
  isChatAssigned?: boolean;
  now?: Date;
};

export function validateRules(input: RuleEngineInput): RuleValidationResult {
  const { config, instance, decision } = input;
  const rules = config.rules_json;
  const now = input.now || new Date();
  const checks: string[] = [];

  if (!config.enabled) {
    return { passed: false, checks: ['agent_disabled'], block_reason: 'Agent is disabled' };
  }
  checks.push('agent_enabled');

  if (instance && ['PAUSED', 'ENDED', 'ESCALATED'].includes(instance.status)) {
    return {
      passed: false,
      checks: [...checks, 'instance_status'],
      block_reason: `Instance status is ${instance.status}`,
    };
  }
  checks.push('instance_active');

  if (decision.confidence < rules.confidence_threshold) {
    if (decision.action !== 'ASSIGN_TO_HUMAN') {
      return {
        passed: false,
        checks: [...checks, 'confidence_threshold'],
        block_reason: `Confidence ${decision.confidence} below threshold ${rules.confidence_threshold}`,
      };
    }
  }
  checks.push('confidence_ok');

  if (decision.action === 'SEND_MESSAGE') {
    const followUpCount = instance?.follow_up_count ?? 0;
    if (followUpCount >= rules.max_follow_ups) {
      return {
        passed: false,
        checks: [...checks, 'max_follow_ups'],
        block_reason: `Max follow-ups (${rules.max_follow_ups}) reached`,
      };
    }
    checks.push('under_max_follow_ups');

    const dailyCount = input.dailyMessageCount ?? 0;
    if (dailyCount >= rules.max_daily_messages) {
      return {
        passed: false,
        checks: [...checks, 'max_daily_messages'],
        block_reason: `Max daily messages (${rules.max_daily_messages}) reached`,
      };
    }
    checks.push('under_max_daily');

    if (!isWithinWindow(now, rules.business_hours.start, rules.business_hours.end, rules.business_hours.timezone)) {
      return {
        passed: false,
        checks: [...checks, 'business_hours'],
        block_reason: 'Outside business hours',
      };
    }
    checks.push('business_hours');

    if (isWithinWindow(now, rules.dnd_hours.start, rules.dnd_hours.end, rules.business_hours.timezone)) {
      return {
        passed: false,
        checks: [...checks, 'dnd_hours'],
        block_reason: 'Do-not-disturb window',
      };
    }
    checks.push('not_dnd');

    if (decision.message) {
      const blocked = containsBlockedWord(decision.message, rules.blocked_words);
      if (blocked) {
        return {
          passed: false,
          checks: [...checks, 'blocked_words'],
          block_reason: `Blocked word: ${blocked}`,
        };
      }
      checks.push('no_blocked_words');
    }

    if (rules.skip_assigned_chats && input.isChatAssigned) {
      return {
        passed: false,
        checks: [...checks, 'skip_assigned_chats'],
        block_reason: 'Chat assigned to human agent',
      };
    }
    checks.push('not_assigned');
  }

  if (decision.action === 'WAIT') {
    const waitHours = decision.wait_hours ?? (decision.wait_days ? decision.wait_days * 24 : 0);
    if (waitHours > 0 && waitHours < rules.min_wait_hours) {
      return {
        passed: false,
        checks: [...checks, 'min_wait_hours'],
        block_reason: `Wait ${waitHours}h below minimum ${rules.min_wait_hours}h`,
      };
    }
    checks.push('min_wait_ok');
  }

  const escalationText = [input.customerMessage, decision.message, decision.assign_reason]
    .filter(Boolean)
    .join(' ');
  if (containsEscalationKeyword(escalationText, rules.escalation_keywords)) {
    if (decision.action === 'ASSIGN_TO_HUMAN' || decision.action === 'END_CONVERSATION') {
      checks.push('escalation_allowed');
    } else {
      return {
        passed: false,
        checks: [...checks, 'escalation_keywords'],
        block_reason: 'Customer requested human / escalation keyword detected',
      };
    }
  }

  return { passed: true, checks };
}
