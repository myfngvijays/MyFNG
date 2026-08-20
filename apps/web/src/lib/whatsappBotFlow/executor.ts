import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { sendTemplateMessage } from '@/lib/services/whatsappService';
import {
  normalizeBotFlowGraph,
  type BotFlowEdge,
  type BotFlowGraph,
  type BotFlowNode,
} from './validation';
import { upsertFlowSession, getFlowSession, type FlowSessionRecord } from './sessionStore';
import type { WhatsAppBrainConfig } from './brainConfig';
import { isRsaRelatedMessage } from './rsaIntent';
import { performWhatsAppHandoff } from './handoff';
import { sendBrainOutboundMessage } from './sessionWindow';
import {
  addLeadTags,
  ensureTagIdsByNames,
} from '@/lib/telecaller/crmLeadTagsApply';
import { stampFreshCrmDisposition } from '@/lib/telecaller/freshLeadStatus';
import { pickTelecallerWeightedRoundRobin } from '@/lib/enquiry/assignment';
import { channelFromWhatsAppLabels } from '@/lib/enquiry/leadChannels';
import { notifyTelecallerNewLeadAssignedSafe } from '@/lib/notifications';

export type FlowExecuteInput = {
  phone: string;
  message: string;
  profileName?: string | null;
  dryRun?: boolean;
  config: WhatsAppBrainConfig;
  inboundReceivedAt?: string | null;
};

export type FlowExecuteResult = {
  handled: boolean;
  skippedReason?: string;
  reply?: string;
  sent?: boolean;
  trace?: string[];
  session?: FlowSessionRecord | null;
};

type LoadedFlow = {
  flowId: string;
  versionId: string;
  graph: BotFlowGraph;
};

function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin unavailable');
  return supabaseAdmin;
}

export async function loadActivePublishedFlow(config: WhatsAppBrainConfig): Promise<LoadedFlow | null> {
  if (!config.active_flow_id) return null;
  const db = getAdminDb();
  const { data: flow } = await db
    .from('bot_flows')
    .select('id, active_version_id, status')
    .eq('id', config.active_flow_id)
    .maybeSingle();

  if (!flow?.active_version_id) return null;

  const { data: version } = await db
    .from('bot_flow_versions')
    .select('id, graph_json, status')
    .eq('id', flow.active_version_id)
    .maybeSingle();

  if (!version || String(version.status).toUpperCase() !== 'PUBLISHED') return null;

  return {
    flowId: String(flow.id),
    versionId: String(version.id),
    graph: normalizeBotFlowGraph(version.graph_json),
  };
}

function getNodeType(node: BotFlowNode): string {
  return String(node.data?.nodeType || node.type || 'message');
}

function outgoingEdges(graph: BotFlowGraph, nodeId: string): BotFlowEdge[] {
  return graph.edges.filter((edge) => edge.source === nodeId);
}

function resolveTemplateParams(mapping: unknown, variables: Record<string, unknown>): string[] {
  const list = Array.isArray(mapping) ? mapping : [];
  return list.map((item) => {
    const key = String(item || '').trim();
    if (!key) return '';
    if (key.startsWith('var:')) return String(variables[key.slice(4)] || '');
    return key;
  });
}

function detectIntent(message: string): string {
  if (isRsaRelatedMessage(message)) return 'RSA';

  const text = message.toLowerCase();
  if (/\b(workshop|garage|near me|nearby)\b/.test(text)) return 'WORKSHOP';
  if (/\b(hi|hello|hey|namaste)\b/.test(text)) return 'GREETING';
  return 'GENERAL';
}

function evaluateCondition(expression: string, ctx: { message: string; variables: Record<string, unknown> }): boolean {
  const expr = String(expression || '').trim();
  if (!expr || expr.toLowerCase() === 'default' || expr.toLowerCase() === 'else') return true;
  if (expr.toLowerCase() === 'true') return true;
  if (expr.toLowerCase() === 'false') return false;

  if (expr.toLowerCase().startsWith('contains:')) {
    const needle = expr.slice('contains:'.length).trim().toLowerCase();
    return ctx.message.toLowerCase().includes(needle);
  }

  const intentEq = expr.match(/intent\s*==\s*["'](.+?)["']/i);
  if (intentEq) {
    return String(ctx.variables.intent || '').toUpperCase() === intentEq[1].toUpperCase();
  }

  const intent = String(ctx.variables.intent || '').toUpperCase();
  if (/\bpricing\b/i.test(expr)) return intent === 'PRICING';
  if (/\bbooking\b/i.test(expr)) return intent === 'BOOKING';
  if (/\brsa\b/i.test(expr)) return intent === 'RSA';
  if (/\bworkshop\b/i.test(expr)) return intent === 'WORKSHOP';
  if (/\bgreet/i.test(expr)) return intent === 'GREETING';

  return false;
}

function pickConditionTarget(node: BotFlowNode, graph: BotFlowGraph, ctx: { message: string; variables: Record<string, unknown> }) {
  const edges = outgoingEdges(graph, node.id);
  for (const edge of edges) {
    const label = String(edge.label || '').trim();
    if (!label) continue;
    if (evaluateCondition(label, ctx)) return edge.target;
  }
  const dataExpr = String(node.data?.condition || '').trim();
  if (dataExpr) {
    for (const edge of edges) {
      if (evaluateCondition(dataExpr, ctx)) return edge.target;
    }
  }
  const defaultEdge = edges.find((edge) => /^(default|else)$/i.test(String(edge.label || '').trim()));
  return defaultEdge?.target || edges[0]?.target || null;
}

async function performHandoff(
  phone: string,
  note: string,
  ctx?: { message?: string; profileName?: string | null },
) {
  await performWhatsAppHandoff({
    phone,
    note,
    message: ctx?.message,
    profileName: ctx?.profileName,
    createRsaLead: isRsaRelatedMessage(ctx?.message || note),
  });
}

export async function executeBotFlow(input: FlowExecuteInput): Promise<FlowExecuteResult> {
  const phone = input.phone;
  const message = String(input.message || '').trim();
  const trace: string[] = [];

  const loaded = await loadActivePublishedFlow(input.config);
  if (!loaded) {
    return { handled: false, skippedReason: 'no_active_published_flow' };
  }

  let session = await getFlowSession(phone);
  if (session?.status === 'HANDOFF') {
    return { handled: false, skippedReason: 'flow_handed_off' };
  }

  const intent = detectIntent(message);
  const variables: Record<string, unknown> = {
    ...(session?.variables || {}),
    intent,
    last_message: message,
    profile_name: input.profileName || null,
  };

  const graph = loaded.graph;
  const trigger = graph.nodes.find((node) => getNodeType(node) === 'trigger');
  if (!trigger) return { handled: false, skippedReason: 'flow_missing_trigger' };

  let currentNodeId =
    session?.flow_id === loaded.flowId && session?.current_node_id
      ? session.current_node_id
      : (outgoingEdges(graph, trigger.id)[0]?.target || null);

  if (!currentNodeId) return { handled: false, skippedReason: 'flow_no_start_node' };

  const replies: string[] = [];
  let sent = false;
  let steps = 0;
  let terminalStatus: 'ACTIVE' | 'COMPLETED' | 'HANDOFF' | null = null;

  async function sendFlowText(body: string) {
    if (input.dryRun) return true;
    const result = await sendBrainOutboundMessage({
      phone,
      message: body,
      config: input.config,
      inboundAt: input.inboundReceivedAt,
      profileName: input.profileName,
    });
    return result.success;
  }

  while (currentNodeId && steps < 12) {
    steps += 1;
    const node = graph.nodes.find((n) => n.id === currentNodeId);
    if (!node) break;

    const nodeType = getNodeType(node);
    trace.push(`${nodeType}:${node.data?.label || node.id}`);

    if (nodeType === 'trigger') {
      currentNodeId = outgoingEdges(graph, node.id)[0]?.target || null;
      continue;
    }

    if (nodeType === 'message') {
      const body = String(node.data?.messageBody || node.data?.text || node.data?.label || '').trim();
      if (body) {
        replies.push(body);
        sent = (await sendFlowText(body)) || sent;
      }
      currentNodeId = outgoingEdges(graph, node.id)[0]?.target || null;
      continue;
    }

    if (nodeType === 'template') {
      const templateName = String(node.data?.templateName || '').trim();
      if (templateName && !input.dryRun) {
        const params = resolveTemplateParams(node.data?.templateParamsMapping, variables);
        const res = await sendTemplateMessage({
          phoneNumber: phone,
          templateName,
          templateParams: params,
        });
        sent = sent || res.success;
        replies.push(`[template:${templateName}]`);
      } else if (templateName) {
        replies.push(`[template:${templateName}]`);
      }
      currentNodeId = outgoingEdges(graph, node.id)[0]?.target || null;
      continue;
    }

    if (nodeType === 'condition') {
      currentNodeId = pickConditionTarget(node, graph, { message, variables });
      continue;
    }

    if (nodeType === 'handoff') {
      const note = String(node.data?.handoffNote || node.data?.label || 'Bot flow handoff').trim();
      replies.push('Connecting you to our team. A human agent will reply shortly.');
      if (!input.dryRun) {
        await performHandoff(phone, note, {
          message,
          profileName: input.profileName,
        });
        sent = (await sendFlowText(replies[replies.length - 1])) || sent;
      }
      terminalStatus = 'HANDOFF';
      currentNodeId = null;
      break;
    }

    if (nodeType === 'end') {
      const body = String(node.data?.messageBody || node.data?.text || '').trim();
      if (body) {
        replies.push(body);
        sent = (await sendFlowText(body)) || sent;
      }
      terminalStatus = 'COMPLETED';
      currentNodeId = null;
      break;
    }

    if (nodeType === 'api_request') {
      trace.push('api_request:skipped_phase2');
      currentNodeId = outgoingEdges(graph, node.id)[0]?.target || null;
      continue;
    }

    if (nodeType === 'delay') {
      const secs = Math.max(0, Number(node.data?.delaySeconds || 0));
      trace.push(`delay:${secs}s`);
      // Sync path: record only (async wait via cron can be added later).
      currentNodeId = outgoingEdges(graph, node.id)[0]?.target || null;
      continue;
    }

    if (nodeType === 'update_lead') {
      const status = String(node.data?.leadStatus || '').trim();
      const disposition = String(node.data?.crmDisposition || '')
        .trim()
        .toUpperCase();
      trace.push(`update_lead:${status || disposition || 'noop'}`);
      if (!input.dryRun && (status || disposition)) {
        try {
          const db = getAdminDb();
          const digits = String(phone || '').replace(/\D/g, '');
          const local10 = digits.slice(-10);
          const { data: leads } = await db
            .from('service_leads')
            .select('id, coupon_meta, status')
            .or(`customer_phone.ilike.%${local10}%`)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(3);
          for (const lead of leads || []) {
            const patch: Record<string, unknown> = {
              updated_at: new Date().toISOString(),
            };
            if (status) patch.status = status;
            if (disposition === 'FRESH' || disposition === 'FRESH_STATUS') {
              const prev =
                lead.coupon_meta && typeof lead.coupon_meta === 'object'
                  ? (lead.coupon_meta as Record<string, unknown>)
                  : {};
              patch.coupon_meta = stampFreshCrmDisposition(prev);
            } else if (disposition) {
              const prev =
                lead.coupon_meta && typeof lead.coupon_meta === 'object'
                  ? (lead.coupon_meta as Record<string, unknown>)
                  : {};
              patch.coupon_meta = {
                ...prev,
                last_call_result: disposition,
                last_call_label: disposition.replace(/_/g, ' '),
              };
            }
            await db.from('service_leads').update(patch).eq('id', lead.id);
          }
        } catch (err) {
          trace.push(`update_lead:error:${(err as Error)?.message || 'failed'}`);
        }
      }
      currentNodeId = outgoingEdges(graph, node.id)[0]?.target || null;
      continue;
    }

    if (nodeType === 'apply_tags') {
      const tagNames = Array.isArray(node.data?.tagNames)
        ? (node.data.tagNames as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
        : String(node.data?.tagNamesCsv || '')
            .split(',')
            .map((x) => x.trim())
            .filter(Boolean);
      const tagIdsDirect = Array.isArray(node.data?.tagIds)
        ? (node.data.tagIds as unknown[]).map((x) => String(x || '').trim()).filter(Boolean)
        : [];
      trace.push(`apply_tags:${tagNames.join('|') || tagIdsDirect.join('|') || 'noop'}`);
      if (!input.dryRun && (tagNames.length || tagIdsDirect.length)) {
        try {
          const db = getAdminDb();
          const digits = String(phone || '').replace(/\D/g, '');
          const local10 = digits.slice(-10);
          const { data: lead } = await db
            .from('service_leads')
            .select('id')
            .or(`customer_phone.ilike.%${local10}%`)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lead?.id) {
            const fromNames = tagNames.length
              ? await ensureTagIdsByNames(tagNames, {
                  parentName: tagNames.some((n) => /meta\s*ads/i.test(n))
                    ? 'Meta Ads'
                    : null,
                })
              : [];
            await addLeadTags(String(lead.id), [...fromNames, ...tagIdsDirect]);
          }
        } catch (err) {
          trace.push(`apply_tags:error:${(err as Error)?.message || 'failed'}`);
        }
      }
      currentNodeId = outgoingEdges(graph, node.id)[0]?.target || null;
      continue;
    }

    if (nodeType === 'assign_telecaller') {
      const mode = String(node.data?.assignMode || 'auto').toLowerCase();
      const fixedId = String(node.data?.telecallerId || '').trim();
      trace.push(`assign_telecaller:${mode}:${fixedId || 'rr'}`);
      if (!input.dryRun) {
        try {
          const db = getAdminDb();
          const digits = String(phone || '').replace(/\D/g, '');
          const local10 = digits.slice(-10);
          const { data: lead } = await db
            .from('service_leads')
            .select('id, lead_number, assigned_telecaller_id, lead_source, created_from, pincode')
            .or(`customer_phone.ilike.%${local10}%`)
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(1)
            .maybeSingle();
          if (lead?.id) {
            let telecallerId = fixedId || null;
            if (mode !== 'fixed' || !telecallerId) {
              const channel = channelFromWhatsAppLabels(
                String(lead.created_from || ''),
                String(lead.lead_source || ''),
              );
              const picked = await pickTelecallerWeightedRoundRobin(
                channel,
                lead.pincode ? String(lead.pincode) : null,
              );
              telecallerId = picked.telecallerId || null;
            }
            if (telecallerId) {
              const prev = lead.assigned_telecaller_id
                ? String(lead.assigned_telecaller_id)
                : null;
              await db
                .from('service_leads')
                .update({
                  assigned_telecaller_id: telecallerId,
                  assigned_at: new Date().toISOString(),
                  updated_at: new Date().toISOString(),
                })
                .eq('id', lead.id);
              if (prev !== telecallerId) {
                void notifyTelecallerNewLeadAssignedSafe({
                  leadId: String(lead.id),
                  leadNumber: lead.lead_number ? String(lead.lead_number) : null,
                  telecallerId,
                  previousTelecallerId: prev,
                  assignedByName: 'WhatsApp bot flow',
                  notes: 'Assigned by workflow',
                });
              }
            }
          }
        } catch (err) {
          trace.push(`assign_telecaller:error:${(err as Error)?.message || 'failed'}`);
        }
      }
      currentNodeId = outgoingEdges(graph, node.id)[0]?.target || null;
      continue;
    }

    currentNodeId = outgoingEdges(graph, node.id)[0]?.target || null;
  }

  const nextStatus = terminalStatus || 'ACTIVE';
  session = await upsertFlowSession({
    phone,
    flow_id: loaded.flowId,
    version_id: loaded.versionId,
    current_node_id: currentNodeId,
    status: nextStatus,
    variables,
  });

  const runStatus =
    nextStatus === 'HANDOFF' || nextStatus === 'COMPLETED' || replies.length > 0 ? 'SUCCESS' : 'SKIPPED';
  try {
    const db = getAdminDb();
    await db.from('bot_flow_runs').insert({
      bot_flow_id: loaded.flowId,
      version_id: loaded.versionId,
      trigger_event: String(
        graph.nodes.find((n) => getNodeType(n) === 'trigger')?.data?.triggerEvent || 'whatsapp_incoming',
      ),
      phone,
      status: runStatus,
      input_payload: {
        message,
        profile_name: input.profileName || null,
        dry_run: Boolean(input.dryRun),
      },
      trace,
      finished_at: new Date().toISOString(),
    });
    if (runStatus === 'SUCCESS') {
      const { data: flowRow } = await db
        .from('bot_flows')
        .select('total_runs, success_runs, failed_runs')
        .eq('id', loaded.flowId)
        .maybeSingle();
      if (flowRow) {
        await db
          .from('bot_flows')
          .update({
            total_runs: Number(flowRow.total_runs || 0) + 1,
            success_runs: Number(flowRow.success_runs || 0) + 1,
            last_run_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq('id', loaded.flowId);
      }
    }
  } catch {
    /* runs table optional until migration 315 */
  }

  if (replies.length === 0) {
    return { handled: false, skippedReason: 'flow_no_reply', trace, session };
  }

  return {
    handled: true,
    reply: replies.join('\n\n'),
    sent,
    trace,
    session,
  };
}
