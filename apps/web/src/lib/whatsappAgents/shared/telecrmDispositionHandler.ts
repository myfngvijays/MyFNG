import { fetchAgentConfig } from './configStore';
import type { TelecrmRowSnapshot } from './crmUpdateTrigger';
import {
  findDispositionRule,
  interpolateDispositionMessage,
  type DispositionEventKind,
} from './dispositionRules';
import { sendAgentOutboundMessage } from './outboundAgentMessage';
import {
  endInstance,
  findOrCreateInstance,
  getActiveInstance,
  getActiveInstancesByPhone,
  normalizeAgentPhone,
} from './instanceService';
import { loadMemory, saveMemory } from './memoryService';
import { processChaseAgentEvent } from '../chase/handler';
import { processFollowupAgentEvent } from '../followup/handler';
import {
  normalizePhoneNumber,
  sendTemplateMessage,
} from '@/lib/services/whatsappService';
import { archiveAgentOutboundMessage } from './outbound';
import type { AgentInstance } from './types';

export type DispositionHandleResult = {
  handled: boolean;
  skippedReason?: string;
  ruleId?: string;
  bot?: string;
  messageMode?: string;
  instanceId?: string;
};

async function endActiveBotsForPhone(phone: string): Promise<void> {
  const instances = await getActiveInstancesByPhone(phone, ['CHASE', 'FOLLOWUP']);
  for (const inst of instances) {
    await endInstance(inst.id, 'MANUAL');
  }
}

async function ensureChaseInstance(row: TelecrmRowSnapshot): Promise<AgentInstance | null> {
  const phone = normalizeAgentPhone(row.mobile || '');
  if (!phone) return null;

  const existing = await getActiveInstance('CHASE', phone);
  if (existing) return existing;

  const instance = await findOrCreateInstance({
    agentType: 'CHASE',
    phone,
    telecrmId: row.id || null,
    metadata: {
      source: 'telecrm_disposition',
      telecrm_name: row.name,
      disposition: row.disposition,
    },
  });

  const memory = await loadMemory(instance.id);
  memory.lead_details = {
    name: row.name,
    city: row.city,
    pincode: row.pincode,
    vehicle_model: row.vehicle_model,
    service_type: row.service_type,
  };
  memory.crm_snapshot = { ...row };
  await saveMemory(memory);
  return instance;
}

async function ensureFollowupInstance(row: TelecrmRowSnapshot): Promise<AgentInstance | null> {
  const phone = normalizeAgentPhone(row.mobile || '');
  if (!phone || !row.id) return null;

  const existing = await getActiveInstance('FOLLOWUP', phone);
  if (existing) return existing;

  const instance = await findOrCreateInstance({
    agentType: 'FOLLOWUP',
    phone,
    telecrmId: row.id,
    metadata: {
      source_type: 'telecrm_disposition',
      source_id: row.id,
      disposition: row.disposition,
      follow_up_type: 'telecrm_stage',
      reason: `TeleCRM stage: ${row.disposition}`,
    },
  });

  const memory = await loadMemory(instance.id);
  memory.lead_details = {
    name: row.name,
    vehicle_model: row.vehicle_model,
    service_type: row.service_type,
    follow_up_type: 'telecrm_stage',
    reason: `TeleCRM stage: ${row.disposition}`,
  };
  memory.crm_snapshot = { ...row };
  memory.extra = {
    ...memory.extra,
    followup_source: 'telecrm_disposition',
    followup_context: row,
  };
  await saveMemory(memory);
  return instance;
}

async function sendFixedOrTemplateMessage(input: {
  phone: string;
  row: TelecrmRowSnapshot;
  messageMode: 'fixed' | 'template';
  message?: string;
  templateName?: string;
  templateLanguage?: string;
  config: Awaited<ReturnType<typeof fetchAgentConfig>>;
  instance: AgentInstance;
  source: string;
}): Promise<{ success: boolean; error?: string }> {
  const phone = normalizePhoneNumber(input.phone);
  const customerName = String(input.row.name || 'there').trim() || 'there';

  if (input.messageMode === 'template') {
    const templateName =
      String(input.templateName || '').trim() ||
      String((input.config.triggers_json as Record<string, unknown>).outbound_template_name || '').trim();
    const templateLanguage =
      String(input.templateLanguage || '').trim() ||
      String((input.config.triggers_json as Record<string, unknown>).outbound_template_language || 'en').trim();

    if (!templateName) {
      return { success: false, error: 'No template_name configured for this disposition rule' };
    }

    const result = await sendTemplateMessage({
      phoneNumber: phone,
      templateName,
      templateParams: [customerName.slice(0, 50)],
      languageCode: templateLanguage,
    });

    if (result.success) {
      await archiveAgentOutboundMessage({
        phone,
        text: input.message || `[template:${templateName}]`,
        sendResult: result,
        source: input.source,
        meta: { instance_id: input.instance.id, disposition: input.row.disposition },
      });
    }
    return { success: result.success, error: result.error };
  }

  const text = interpolateDispositionMessage(String(input.message || '').trim(), input.row);
  if (!text) return { success: false, error: 'Empty fixed message for disposition rule' };

  const send = await sendAgentOutboundMessage({
    phone,
    message: text,
    config: input.config,
    source: input.source,
    meta: { instance_id: input.instance.id, customer_name: customerName, disposition: input.row.disposition },
  });
  return { success: send.success, error: send.error };
}

/**
 * TeleCRM disposition/stage → bot action (chase, follow-up, fixed message, or stop).
 */
export async function handleTelecrmDispositionEvent(input: {
  row: TelecrmRowSnapshot;
  eventKind: DispositionEventKind;
  previousDisposition?: string | null;
}): Promise<DispositionHandleResult> {
  const phone = normalizeAgentPhone(input.row.mobile || '');
  if (!phone) return { handled: false, skippedReason: 'no_phone' };

  const chaseConfig = await fetchAgentConfig('CHASE');
  const followupConfig = await fetchAgentConfig('FOLLOWUP');

  const rule = findDispositionRule(chaseConfig, input.row.disposition, input.eventKind);
  if (!rule) {
    return { handled: false, skippedReason: 'no_matching_disposition_rule' };
  }

  if (rule.end_active_bots) {
    await endActiveBotsForPhone(phone);
    return {
      handled: true,
      ruleId: rule.id,
      bot: 'NONE',
      messageMode: 'end_active_bots',
    };
  }

  if (rule.message_mode === 'skip' || rule.bot === 'NONE') {
    return { handled: false, skippedReason: 'rule_skip', ruleId: rule.id };
  }

  const bot = rule.bot || 'CHASE';
  const agentEnabled = bot === 'FOLLOWUP' ? followupConfig.enabled : chaseConfig.enabled;
  if (!agentEnabled) {
    return { handled: false, skippedReason: `${bot.toLowerCase()}_disabled`, ruleId: rule.id };
  }

  const agentConfig = bot === 'FOLLOWUP' ? followupConfig : chaseConfig;
  const instance =
    bot === 'FOLLOWUP'
      ? await ensureFollowupInstance(input.row)
      : await ensureChaseInstance(input.row);

  if (!instance) {
    return { handled: false, skippedReason: 'instance_not_created', ruleId: rule.id };
  }

  if (rule.message_mode === 'fixed' || rule.message_mode === 'template') {
    const send = await sendFixedOrTemplateMessage({
      phone,
      row: input.row,
      messageMode: rule.message_mode,
      message: rule.message,
      templateName: rule.template_name,
      templateLanguage: rule.template_language,
      config: agentConfig,
      instance,
      source: `whatsapp_${bot.toLowerCase()}_disposition`,
    });

    if (!send.success) {
      return {
        handled: false,
        skippedReason: send.error || 'send_failed',
        ruleId: rule.id,
        bot,
        messageMode: rule.message_mode,
        instanceId: instance.id,
      };
    }

    if (bot === 'FOLLOWUP') {
      await endInstance(instance.id, 'MANUAL');
    }

    return {
      handled: true,
      ruleId: rule.id,
      bot,
      messageMode: rule.message_mode,
      instanceId: instance.id,
    };
  }

  const memory = await loadMemory(instance.id);
  memory.crm_snapshot = { ...memory.crm_snapshot, ...input.row };
  if (rule.ai_prompt_addon?.trim()) {
    memory.extra = {
      ...memory.extra,
      disposition_prompt_addon: rule.ai_prompt_addon.trim(),
      telecrm_disposition: input.row.disposition,
    };
  }
  await saveMemory(memory);

  const eventType = input.eventKind === 'new_lead' ? 'NEW_LEAD' : 'CRM_UPDATE';
  const result =
    bot === 'FOLLOWUP'
      ? await processFollowupAgentEvent({
          phone,
          eventType,
          instance,
          force: true,
          sourceType: 'telecrm_disposition',
          sourceId: String(input.row.id || instance.id),
        })
      : await processChaseAgentEvent({
          phone,
          eventType,
          telecrmId: input.row.id || instance.telecrm_id,
          instance,
          force: true,
        });

  return {
    handled: result.handled,
    skippedReason: result.skippedReason,
    ruleId: rule.id,
    bot,
    messageMode: 'ai',
    instanceId: instance.id,
  };
}

export function handleTelecrmDispositionEventSafe(
  input: Parameters<typeof handleTelecrmDispositionEvent>[0],
): void {
  Promise.resolve()
    .then(() => handleTelecrmDispositionEvent(input))
    .catch((err) => {
      console.error('[telecrm-disposition] failed:', err?.message || err);
    });
}
