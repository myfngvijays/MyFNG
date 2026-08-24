import {
  DEFAULT_CALL_IQ_CANVAS,
  defaultCallIqNamedWorkflow,
  resolveCallIqCanvas,
  type CallIqNamedWorkflow,
} from '@/lib/telecaller/salesPlaybookDefaults';

function withCanvas(current: CallIqNamedWorkflow, next: CallIqNamedWorkflow): CallIqNamedWorkflow {
  const canvas = resolveCallIqCanvas(current);
  const empty = canvas.nodes.length === 0;
  return {
    ...next,
    canvas: empty
      ? {
          nodes: DEFAULT_CALL_IQ_CANVAS.nodes.map((n) => ({ ...n })),
          edges: DEFAULT_CALL_IQ_CANVAS.edges.map((e) => ({ ...e })),
        }
      : canvas,
  };
}

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';
const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4o-mini';

function matchStatuses(text: string, catalog: string[]) {
  const lower = text.toLowerCase();
  return catalog.filter((name) => {
    const n = name.toLowerCase();
    return lower.includes(n) || (n === 'he will visit' && /will visit|he will/i.test(text));
  });
}

export function applyLocalWorkflowChat(
  message: string,
  current: CallIqNamedWorkflow,
  crmStatuses: string[],
): { reply: string; workflow: CallIqNamedWorkflow } {
  const next = defaultCallIqNamedWorkflow({ ...current, lead_statuses: [...current.lead_statuses] });
  const text = String(message || '').trim();
  const bits: string[] = [];

  const sec = text.match(/(\d+)\s*(s|sec|secs|second|seconds|min)?/i);
  if (sec && /sec|second|\bs\b|duration|lamba|lambi|minute/i.test(text)) {
    let n = Number(sec[1]) || next.min_duration_sec;
    if (/min/i.test(sec[2] || '') || /minute/i.test(text)) n = n * 60;
    next.min_duration_sec = n;
    bits.push(`duration ≥ ${n}s`);
  }

  const statuses = matchStatuses(text, crmStatuses);
  if (statuses.length) {
    next.lead_statuses = statuses;
    bits.push(`statuses: ${statuses.join(', ')}`);
  }

  if (/\b(off|disable|band|pause|stop)\b/i.test(text) && !/\bon\b|enable|chalu|start/i.test(text)) {
    next.enabled = false;
    bits.push('flow OFF');
  } else if (/\b(on|enable|chalu|start|activate|live)\b/i.test(text)) {
    next.enabled = true;
    bits.push('flow ON');
  }

  if (/free sop|no deep|bina deep|notes only/i.test(text)) {
    next.use_deep_ai = false;
    bits.push('Deep AI off');
  } else if (/deep ai|deepai|transcript|sunke/i.test(text)) {
    next.use_deep_ai = true;
    bits.push('Deep AI on');
  }

  const named = text.match(/(?:name|naam|title|call it)\s*[:\-]\s*(.+)$/i);
  if (named?.[1]) {
    next.name = named[1].replace(/["']/g, '').trim().slice(0, 80);
    bits.push(`name “${next.name}”`);
  }

  if (!bits.length) {
    return {
      reply:
        'Bolo kya chahiye — jaise “Fresh aur Interested pe 90 second ke baad Deep AI SOP” ya “is flow ko ON karo”.',
      workflow: withCanvas(current, next),
    };
  }

  return {
    reply: `Flow update: ${bits.join(' · ')}. Canvas pe nodes change ho gaye. Publish dabao jab theek lage.`,
    workflow: withCanvas(current, next),
  };
}

export async function applyWorkflowChat(opts: {
  message: string;
  workflow: CallIqNamedWorkflow;
  crmStatuses: string[];
  history?: Array<{ role: 'user' | 'assistant'; content: string }>;
}): Promise<{ reply: string; workflow: CallIqNamedWorkflow; used_openai: boolean }> {
  const fallback = applyLocalWorkflowChat(opts.message, opts.workflow, opts.crmStatuses);
  if (!OPENAI_API_KEY) {
    return { ...fallback, used_openai: false };
  }

  const system = `You are MY FNG Call IQ workflow builder.
The live flow is: On call recording completed → Check If Lead (CRM statuses) → duration >= N seconds → Call Audit SOP (Deep AI).
Edit ONLY these fields. Do not invent other executable nodes.
Allowed CRM statuses: ${opts.crmStatuses.join(', ')}.
Return JSON only:
{
  "reply": "short Hindi-English explanation of what you changed",
  "workflow": {
    "name": "string",
    "enabled": true,
    "min_duration_sec": 90,
    "lead_statuses": ["Fresh"],
    "use_deep_ai": true,
    "skip_if_sop_exists": true
  }
}
If the user greets or asks how, keep workflow the same and explain how to speak a flow.`;

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: OPENAI_MODEL,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: system },
          ...(opts.history || []).slice(-8),
          {
            role: 'user',
            content: `Current workflow:\n${JSON.stringify({
              name: opts.workflow.name,
              enabled: opts.workflow.enabled,
              min_duration_sec: opts.workflow.min_duration_sec,
              lead_statuses: opts.workflow.lead_statuses,
              use_deep_ai: opts.workflow.use_deep_ai,
              skip_if_sop_exists: opts.workflow.skip_if_sop_exists,
            })}\n\nUser: ${opts.message}`,
          },
        ],
      }),
    });
    if (!res.ok) return { ...fallback, used_openai: false };
    const json = await res.json();
    const parsed = JSON.parse(String(json?.choices?.[0]?.message?.content || '{}'));
    const wf = parsed?.workflow || {};
    const statuses = Array.isArray(wf.lead_statuses)
      ? wf.lead_statuses.map(String).filter((s: string) =>
          opts.crmStatuses.some((c) => c.toLowerCase() === s.toLowerCase()),
        )
      : opts.workflow.lead_statuses;
    const workflow = defaultCallIqNamedWorkflow({
      ...opts.workflow,
      name: String(wf.name || opts.workflow.name),
      enabled: typeof wf.enabled === 'boolean' ? wf.enabled : opts.workflow.enabled,
      min_duration_sec: Math.max(0, Number(wf.min_duration_sec) || opts.workflow.min_duration_sec),
      lead_statuses: statuses.length ? statuses : opts.workflow.lead_statuses,
      use_deep_ai: typeof wf.use_deep_ai === 'boolean' ? wf.use_deep_ai : opts.workflow.use_deep_ai,
      skip_if_sop_exists:
        typeof wf.skip_if_sop_exists === 'boolean' ? wf.skip_if_sop_exists : opts.workflow.skip_if_sop_exists,
    });
    return {
      reply: String(parsed.reply || fallback.reply),
      workflow: withCanvas(opts.workflow, workflow),
      used_openai: true,
    };
  } catch {
    return { ...fallback, used_openai: false };
  }
}
