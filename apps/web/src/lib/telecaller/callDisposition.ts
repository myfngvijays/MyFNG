/**
 * Map telecaller call-log notes / outcome → CRM disposition on service_leads.
 */

/** Only dispositions that advance the pipeline column (null = keep current status). */
export const DISPOSITION_TO_LEAD_STATUS: Record<string, string> = {
  BOOKING_CONFIRMED: 'VALIDATED',
  IN_SERVICE: 'IN_PROGRESS',
  SERVICE_DONE: 'COMPLETED',
  LOST: 'REJECTED',
};

export const DISPOSITION_LABEL: Record<string, string> = {
  INTERESTED: 'Interested',
  WILL_VISIT: 'He will visit',
  BOOKING_CONFIRMED: 'Booking confirmed',
  IN_SERVICE: 'In Service',
  SERVICE_DONE: 'Service Done',
  LOST: 'Lost',
  RINGING: 'Ringing',
};

const NOTE_TAG_TO_RESULT: Array<{ re: RegExp; id: string }> = [
  { re: /^lost\b/i, id: 'LOST' },
  { re: /^interested\b/i, id: 'INTERESTED' },
  { re: /will\s*visit/i, id: 'WILL_VISIT' },
  { re: /booking\s*confirmed/i, id: 'BOOKING_CONFIRMED' },
  { re: /^in\s*service\b/i, id: 'IN_SERVICE' },
  { re: /service\s*done/i, id: 'SERVICE_DONE' },
  { re: /ringing|no\s*answer/i, id: 'RINGING' },
];

const OUTCOME_TO_RESULT: Record<string, string> = {
  NOT_INTERESTED: 'LOST',
  LEAD_CREATED: 'BOOKING_CONFIRMED',
  INFO_COLLECTED: 'INTERESTED',
};

export type ParsedCallDisposition = {
  result: string;
  label: string;
  lostReason: string | null;
  leadStatus: string | null;
};

/** Extract `[Lost - Not Interested]` / `[Lost · …]` style tag from call notes. */
export function parseNotesActivityTag(notes: string | null | undefined): string {
  const m = String(notes || '').match(/^\[([^\]]+)\]/);
  return m?.[1]?.trim() || '';
}

export function parseCallDisposition(input: {
  notes?: string | null;
  outcome?: string | null;
  activity?: string | null;
  call_status?: string | null;
}): ParsedCallDisposition | null {
  const activity = String(input.activity || '').trim().toUpperCase();
  if (activity && DISPOSITION_LABEL[activity]) {
    const tag = parseNotesActivityTag(input.notes);
    const lostReason =
      activity === 'LOST'
        ? tag.replace(/^lost\s*[·\-–—]\s*/i, '').trim() || null
        : null;
    const label =
      activity === 'LOST' && lostReason
        ? `Lost · ${lostReason}`
        : DISPOSITION_LABEL[activity];
    return {
      result: activity,
      label,
      lostReason,
      leadStatus: DISPOSITION_TO_LEAD_STATUS[activity] || null,
    };
  }

  const rawNotes = String(input.notes || '').trim();
  const tag = parseNotesActivityTag(rawNotes) || (
    // Unbracketed notes like "Lost - Not Interested · customer said…"
    NOTE_TAG_TO_RESULT.some(({ re }) => re.test(rawNotes.split(/[.|·]/)[0] || ''))
      ? (rawNotes.split(/[.|·]/)[0] || '').trim()
      : ''
  );
  if (tag) {
    for (const { re, id } of NOTE_TAG_TO_RESULT) {
      if (re.test(tag)) {
        const lostReason =
          id === 'LOST' ? tag.replace(/^lost\s*[·\-–—]\s*/i, '').trim() || null : null;
        const label =
          id === 'LOST' && lostReason ? `Lost · ${lostReason}` : DISPOSITION_LABEL[id] || tag;
        return {
          result: id,
          label,
          lostReason,
          leadStatus: DISPOSITION_TO_LEAD_STATUS[id] || null,
        };
      }
    }
  }

  const outcome = String(input.outcome || '').trim().toUpperCase();
  if (outcome && OUTCOME_TO_RESULT[outcome]) {
    const id = OUTCOME_TO_RESULT[outcome];
    return {
      result: id,
      label: DISPOSITION_LABEL[id] || id,
      lostReason: id === 'LOST' ? 'Not Interested' : null,
      leadStatus: DISPOSITION_TO_LEAD_STATUS[id] || null,
    };
  }

  const callStatus = String(input.call_status || '').trim().toUpperCase();
  if (callStatus === 'NO_ANSWER' || callStatus === 'MISSED' || callStatus === 'BUSY') {
    return {
      result: 'RINGING',
      label: 'Ringing',
      lostReason: null,
      leadStatus: null,
    };
  }

  return null;
}
