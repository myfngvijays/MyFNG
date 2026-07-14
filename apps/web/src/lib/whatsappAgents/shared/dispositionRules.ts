import type { AgentConfig, TelecrmDispositionRule } from './types';
import type { TelecrmRowSnapshot } from './crmUpdateTrigger';

export type DispositionEventKind = 'new_lead' | 'disposition_change';

const DEFAULT_RULES: TelecrmDispositionRule[] = [
  {
    id: 'interested',
    disposition: 'Interested',
    enabled: true,
    trigger_on: 'both',
    bot: 'CHASE',
    message_mode: 'ai',
    ai_prompt_addon:
      'TeleCRM stage: Interested. Customer showed interest — offer car service booking, share value, one clear CTA.',
  },
  {
    id: 'follow-up',
    disposition: 'Follow-up',
    enabled: true,
    trigger_on: 'both',
    bot: 'FOLLOWUP',
    message_mode: 'ai',
    ai_prompt_addon:
      'TeleCRM stage: Follow-up. Telecaller marked callback needed — gentle reminder, ask best time for car service.',
  },
  {
    id: 'attempted-contact',
    disposition: 'Attempted Contact',
    enabled: true,
    trigger_on: 'both',
    bot: 'CHASE',
    message_mode: 'fixed',
    message:
      'Hi {{name}}, we tried reaching you about your car service enquiry with MyFNG. When is a good time to connect?',
  },
  {
    id: 'appointment-scheduled',
    disposition: 'Appointment Scheduled',
    enabled: true,
    trigger_on: 'disposition_change',
    bot: 'FOLLOWUP',
    message_mode: 'fixed',
    message:
      'Hi {{name}}, your MyFNG car service appointment is noted. Reply here if you need to reschedule or have questions.',
  },
  {
    id: 'not-interested',
    disposition: 'Not Interested',
    enabled: true,
    trigger_on: 'disposition_change',
    bot: 'NONE',
    message_mode: 'skip',
    end_active_bots: true,
  },
  {
    id: 'do-not-call',
    disposition: 'DO NOT CALL',
    enabled: true,
    trigger_on: 'disposition_change',
    bot: 'NONE',
    message_mode: 'skip',
    end_active_bots: true,
  },
];

export function getDispositionRulesConfig(config: AgentConfig): {
  enabled: boolean;
  rules: TelecrmDispositionRule[];
} {
  const triggers = config.triggers_json as Record<string, unknown>;
  const block = (triggers.disposition_rules as { enabled?: boolean; rules?: TelecrmDispositionRule[] }) || {};
  const rules = Array.isArray(block.rules) && block.rules.length ? block.rules : DEFAULT_RULES;
  return {
    enabled: block.enabled !== false,
    rules: rules.filter((r) => r && String(r.disposition || '').trim()),
  };
}

function normalizeDisposition(value: string | null | undefined): string {
  return String(value || '').trim().toLowerCase();
}

export function dispositionRuleMatches(
  rule: TelecrmDispositionRule,
  disposition: string | null | undefined,
): boolean {
  const needle = normalizeDisposition(disposition);
  const hay = normalizeDisposition(rule.disposition);
  if (!needle || !hay) return false;
  if (rule.match_mode === 'exact') return needle === hay;
  return needle === hay || needle.includes(hay) || hay.includes(needle);
}

export function findDispositionRule(
  config: AgentConfig,
  disposition: string | null | undefined,
  eventKind: DispositionEventKind,
): TelecrmDispositionRule | null {
  const { enabled, rules } = getDispositionRulesConfig(config);
  if (!enabled) return null;

  for (const rule of rules) {
    if (rule.enabled === false) continue;
    const triggerOn = rule.trigger_on || 'both';
    if (triggerOn !== 'both' && triggerOn !== eventKind) continue;
    if (dispositionRuleMatches(rule, disposition)) return rule;
  }
  return null;
}

export function interpolateDispositionMessage(
  template: string,
  crm: TelecrmRowSnapshot | Record<string, unknown>,
): string {
  const map: Record<string, string> = {
    name: String(crm.name || 'there'),
    city: String(crm.city || ''),
    pincode: String(crm.pincode || ''),
    vehicle_model: String(crm.vehicle_model || ''),
    service_type: String(crm.service_type || ''),
    disposition: String(crm.disposition || ''),
    disposition_category: String((crm as TelecrmRowSnapshot).disposition_category || ''),
  };

  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, key: string) => map[key] ?? '');
}

export function shouldStartChaseForDisposition(config: AgentConfig, disposition: string | null): boolean {
  const rule = findDispositionRule(config, disposition, 'new_lead');
  if (rule) {
    if (rule.end_active_bots || rule.message_mode === 'skip' || rule.bot === 'NONE') return false;
    return rule.bot === 'CHASE';
  }
  return false;
}

export function shouldStartFollowupForDisposition(config: AgentConfig, disposition: string | null): boolean {
  const rule = findDispositionRule(config, disposition, 'new_lead');
  if (!rule || rule.enabled === false) return false;
  return rule.bot === 'FOLLOWUP' && rule.message_mode !== 'skip';
}
