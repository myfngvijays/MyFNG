import { fetchAgentConfig } from '../shared/configStore';
import {
  createChaseInstanceFromTelecrmLead,
  processChaseAgentEvent,
} from './handler';
import { shouldChaseTelecrmLead, type TelecrmLeadCandidate } from './telecrmTriggers';

/**
 * Fire-and-forget: when a telecrm_api row is created/updated, start chase if eligible.
 */
export function triggerChaseForTelecrmRowSafe(row: Partial<TelecrmLeadCandidate> & { mobile?: string | null }): void {
  Promise.resolve()
    .then(async () => {
      const config = await fetchAgentConfig('CHASE');
      if (!config.enabled) return;

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

      if (!shouldChaseTelecrmLead(candidate, config)) return;

      const instance = await createChaseInstanceFromTelecrmLead(candidate);
      if (!instance) return;

      const phone = String(candidate.mobile || '').replace(/\D/g, '').slice(-10);
      if (!phone) return;

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
