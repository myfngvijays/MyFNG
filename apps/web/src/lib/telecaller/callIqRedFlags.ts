/**
 * SOP / Deep AI red flags — shared by Recordings, Call Intelligence, and mobile.
 */

export type CallIqRedFlag = {
  id: string;
  label: string;
  severity: 'high' | 'medium';
};

export type CallIqFlagSource = {
  quality_grade?: string | null;
  quality_score?: number | null;
  quality_flags?: string[] | null;
  sentiment?: string | null;
  overall_resolution?: string | null;
  queries_unresolved?: number | null;
  unresolved_gaps?: string[] | null;
  sop_audit?: {
    overall_score?: number | null;
    claimed_own_workshops?: string | null;
    professionalism?: string | null;
    registration_before_pricing?: string | null;
    closing_attempt?: string | null;
    objection_handling_quality?: string | null;
    myfng_introduced?: string | null;
    pickup_option_asked?: string | null;
    own_workshop_claim_quote?: string | null;
    improvement_suggestions?: string[] | null;
  } | null;
} | null | undefined;

export function collectCallIqRedFlags(hit: CallIqFlagSource): CallIqRedFlag[] {
  if (!hit) return [];
  const flags: CallIqRedFlag[] = [];
  const add = (id: string, label: string, severity: 'high' | 'medium' = 'high') => {
    if (!flags.some((f) => f.id === id)) flags.push({ id, label, severity });
  };
  const sop = hit.sop_audit || {};
  const score = Number(sop.overall_score);
  const grade = String(hit.quality_grade || '').toUpperCase();

  if (sop.claimed_own_workshops === 'Yes') {
    add('own_ws', 'Claimed MyFNG owns workshops', 'high');
  }
  if (sop.professionalism === 'No') {
    add('unprofessional', 'Unprofessional / script fail', 'high');
  }
  if (Number.isFinite(score) && score > 0 && score < 40) {
    add('sop_poor', `SOP ${score}/100 — poor call`, 'high');
  } else if (Number.isFinite(score) && score > 0 && score < 55) {
    add('sop_weak', `SOP ${score}/100 — needs coaching`, 'medium');
  }
  if (grade === 'D' || grade === 'F') {
    add('grade', `Quality grade ${grade}`, 'high');
  }
  if (String(hit.sentiment || '').toUpperCase() === 'ANGRY') {
    add('angry', 'Angry / complaint tone', 'high');
  }
  if (String(hit.overall_resolution || '').toUpperCase() === 'UNRESOLVED') {
    add('unresolved', 'Customer queries unresolved', 'high');
  }
  if (Number(hit.queries_unresolved) > 0) {
    add('gaps', `${hit.queries_unresolved} query gap(s)`, 'high');
  }
  if (sop.registration_before_pricing === 'No') {
    add('reg', 'Quoted without registration', 'medium');
  }
  if (sop.closing_attempt === 'No Ask') {
    add('close', 'No booking ask', 'medium');
  }
  if (sop.objection_handling_quality === 'Weak') {
    add('obj', 'Weak objection handling', 'medium');
  }
  if (sop.myfng_introduced === 'No') {
    add('intro', 'MyFNG not introduced', 'medium');
  }
  if (sop.pickup_option_asked === 'No') {
    add('pickup', 'Pickup not offered', 'medium');
  }
  for (const raw of hit.quality_flags || []) {
    const qf = String(raw || '').trim();
    if (!qf) continue;
    const high = /angry|without|unprofessional|own workshop|complaint/i.test(qf);
    add(`qf_${qf.slice(0, 40)}`, qf, high ? 'high' : 'medium');
  }
  return flags.slice(0, 8);
}

export function callHasRedFlags(hit: CallIqFlagSource): boolean {
  return collectCallIqRedFlags(hit).some((f) => f.severity === 'high');
}

export function callHasAnyFlags(hit: CallIqFlagSource): boolean {
  return collectCallIqRedFlags(hit).length > 0;
}
