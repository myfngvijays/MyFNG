/** Telecaller remarks live in coupon_meta.telecaller_remarks and/or service_leads.notes — keep in sync on handoff. */

export function clipRemark(value: unknown): string {
  return String(value ?? '').trim();
}

/** Legacy transfer bug replaced service_leads.notes with a one-line audit string. */
export function isTransferAuditNoteText(notes: string): boolean {
  const n = clipRemark(notes);
  return /^\w*\s*\|\s*Transferred:/i.test(n) || /^Transferred from/i.test(n);
}

export function mergeLeadRemarkFields(lead: {
  notes?: unknown;
  telecaller_remarks?: unknown;
  coupon_meta?: unknown;
}): {
  notes: string | null;
  coupon_meta: Record<string, unknown>;
  mergedRemark: string;
} {
  const meta =
    lead.coupon_meta && typeof lead.coupon_meta === 'object' && !Array.isArray(lead.coupon_meta)
      ? { ...(lead.coupon_meta as Record<string, unknown>) }
      : {};

  const fromColumn = clipRemark(lead.telecaller_remarks);
  const fromNotes = clipRemark(lead.notes);
  const fromMeta = clipRemark(meta.telecaller_remarks);

  let merged = fromMeta || fromNotes || fromColumn;
  if (!merged && fromNotes && fromMeta && fromNotes !== fromMeta) {
    merged = `${fromMeta}\n${fromNotes}`.trim();
  }

  if (merged) {
    meta.telecaller_remarks = merged;
  }

  const preservedNotes = fromNotes || merged || null;

  return {
    notes: preservedNotes,
    coupon_meta: meta,
    mergedRemark: merged,
  };
}