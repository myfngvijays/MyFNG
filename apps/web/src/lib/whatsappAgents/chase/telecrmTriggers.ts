import type { AgentConfig } from '../shared/types';
import { findDispositionRule, getDispositionRulesConfig } from '../shared/dispositionRules';

export type TelecrmLeadCandidate = {
  id: string;
  name: string | null;
  mobile: string | null;
  city: string | null;
  pincode: string | null;
  disposition: string | null;
  service_type: string | null;
  vehicle_model: string | null;
  created_at: string;
};

export function dispositionMatches(disposition: string | null, allowed: string[]): boolean {
  const d = String(disposition || '').trim().toLowerCase();
  if (!d) return allowed.some((a) => a.toLowerCase() === 'new');
  return allowed.some((a) => d.includes(a.toLowerCase()) || a.toLowerCase().includes(d));
}

export function getChaseTriggerConfig(config: AgentConfig) {
  const triggers = config.triggers_json as Record<string, unknown>;
  const telecrmNew = (triggers.telecrm_new_lead as { enabled?: boolean; dispositions?: string[] }) || {};
  const dispositionsToChase = Array.isArray(triggers.dispositions_to_chase)
    ? (triggers.dispositions_to_chase as string[])
    : ['Interested', 'Callback', 'Quotation Sent', 'New'];

  return {
    telecrmNewEnabled: telecrmNew.enabled !== false,
    newLeadDispositions: telecrmNew.dispositions || ['New', 'Interested'],
    dispositionsToChase,
    noReplyHours: Number(triggers.no_reply_hours) || 48,
    coldLeadDays: Number(triggers.cold_lead_days) || 3,
    lookbackHours: Number(triggers.lookback_hours) || 48,
  };
}

export function shouldChaseTelecrmLead(lead: TelecrmLeadCandidate, config: AgentConfig): boolean {
  const tc = getChaseTriggerConfig(config);
  if (!tc.telecrmNewEnabled) return false;
  if (!lead.mobile) return false;

  const { enabled: rulesEnabled } = getDispositionRulesConfig(config);
  if (rulesEnabled) {
    const rule = findDispositionRule(config, lead.disposition, 'new_lead');
    if (rule) {
      if (rule.enabled === false || rule.end_active_bots || rule.message_mode === 'skip') return false;
      return rule.bot === 'CHASE';
    }
  }

  return dispositionMatches(lead.disposition, tc.newLeadDispositions);
}
