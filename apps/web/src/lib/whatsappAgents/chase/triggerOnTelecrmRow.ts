import { fetchAgentConfig } from '../shared/configStore';
import { getDispositionRulesConfig } from '../shared/dispositionRules';
import {
  handleTelecrmDispositionEvent,
  handleTelecrmDispositionEventSafe,
} from '../shared/telecrmDispositionHandler';
import {
  createChaseInstanceFromTelecrmLead,
  processChaseAgentEvent,
} from './handler';
import { getActiveInstance } from '../shared/instanceService';
import { triggerCrmUpdateForTelecrmRowSafe } from '../shared/crmUpdateTrigger';
import { shouldChaseTelecrmLead, type TelecrmLeadCandidate } from './telecrmTriggers';

/**
 * Fire-and-forget: when a telecrm_api row is created/updated, apply disposition rules or legacy chase.
 */
export function triggerChaseForTelecrmRowSafe(row: Partial<TelecrmLeadCandidate> & { mobile?: string | null }): void {
  Promise.resolve()
    .then(async () => {
      const config = await fetchAgentConfig('CHASE');
      if (!config.enabled && !(await fetchAgentConfig('FOLLOWUP')).enabled) return;

      const candidate: TelecrmLeadCandidate = {
        id: String(row.id || ''),
        name: row.name ?? null,
        mobile: row.mobile ?? null,
        city: row.city ?? null,
        pincode: row.pincode ?? null,
        disposition: row.disposition ?? 'New',
        service_type: row.service_type ?? null,
        vehicle_model: row.vehicle_model ?? null,
        created_at: row.created_at || new Date().toISOString(),
      };

      const phone = String(candidate.mobile || '').replace(/\D/g, '').slice(-10);
      if (!phone) return;

      const { enabled: rulesEnabled } = getDispositionRulesConfig(config);
      if (rulesEnabled && candidate.disposition) {
        const existing = await getActiveInstance('CHASE', phone);
        const eventKind = existing ? 'disposition_change' : 'new_lead';
        const result = await handleTelecrmDispositionEvent({
          row: {
            id: candidate.id,
            mobile: phone,
            name: candidate.name,
            city: candidate.city,
            pincode: candidate.pincode,
            disposition: candidate.disposition,
            service_type: candidate.service_type,
            vehicle_model: candidate.vehicle_model,
          },
          eventKind,
        });
        if (result.handled || result.skippedReason !== 'no_matching_disposition_rule') return;
      }

      const existing = await getActiveInstance('CHASE', phone);
      if (existing) {
        triggerCrmUpdateForTelecrmRowSafe({
          id: candidate.id || existing.telecrm_id,
          mobile: phone,
          name: candidate.name,
          city: candidate.city,
          pincode: candidate.pincode,
          disposition: candidate.disposition,
          service_type: candidate.service_type,
          vehicle_model: candidate.vehicle_model,
        });
        return;
      }

      if (!shouldChaseTelecrmLead(candidate, config)) return;

      const instance = await createChaseInstanceFromTelecrmLead(candidate);
      if (!instance) return;

      await processChaseAgentEvent({
        phone,
        eventType: 'NEW_LEAD',
        telecrmId: candidate.id || instance.telecrm_id,
        instance,
      });
    })
    .catch((err) => {
      console.error('[chase-trigger] failed:', err?.message || err);
    });
}

export { handleTelecrmDispositionEventSafe };
