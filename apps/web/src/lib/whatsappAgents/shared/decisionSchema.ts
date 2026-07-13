import { z } from 'zod';

const actionEnum = z.enum([
  'SEND_MESSAGE',
  'WAIT',
  'UPDATE_CRM',
  'ASSIGN_TO_HUMAN',
  'BOOK_APPOINTMENT',
  'END_CONVERSATION',
  'ACTIVATE_BOOKING_BOT',
]);

export const agentDecisionSchema = z
  .object({
    action: actionEnum,
    message: z.string().max(2000).optional(),
    wait_hours: z.number().min(1).max(168).optional(),
    wait_days: z.number().min(1).max(30).optional(),
    crm_fields: z.record(z.string()).optional(),
    assign_reason: z.string().max(500).optional(),
    booking_details: z.record(z.unknown()).optional(),
    end_reason: z.string().max(200).optional(),
    confidence: z.number().min(0).max(1),
    reason: z.string().min(1).max(1000),
  })
  .superRefine((data, ctx) => {
    if (data.action === 'SEND_MESSAGE' && !data.message?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'SEND_MESSAGE requires message', path: ['message'] });
    }
    if (data.action === 'WAIT' && data.wait_hours == null && data.wait_days == null) {
      ctx.addIssue({ code: 'custom', message: 'WAIT requires wait_hours or wait_days', path: ['wait_hours'] });
    }
    if (data.action === 'ASSIGN_TO_HUMAN' && !data.assign_reason?.trim()) {
      ctx.addIssue({ code: 'custom', message: 'ASSIGN_TO_HUMAN requires assign_reason', path: ['assign_reason'] });
    }
  });

export type ParsedAgentDecision = z.infer<typeof agentDecisionSchema>;

export function parseDecisionJson(raw: unknown): { ok: true; decision: ParsedAgentDecision } | { ok: false; error: string } {
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch {
      return { ok: false, error: 'Invalid JSON string' };
    }
  }

  const result = agentDecisionSchema.safeParse(raw);
  if (!result.success) {
    const msg = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    return { ok: false, error: msg };
  }
  return { ok: true, decision: result.data };
}
