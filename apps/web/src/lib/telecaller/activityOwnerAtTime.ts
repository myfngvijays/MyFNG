/** Who owned a lead at time T from transfer history (for activity initials). */

export type LeadTransferRow = {
  created_at: string;
  from_telecaller_id?: string;
  to_telecaller_id?: string;
  from_name?: string;
  to_name?: string;
};

export type OwnerSegment = {
  fromMs: number;
  toMs: number;
  name: string;
  id: string;
};

export function buildLeadOwnerSegments(
  transfers: LeadTransferRow[],
  leadCreatedAt: string,
  currentAssigneeId: string,
  currentAssigneeName: string,
): OwnerSegment[] {
  const sorted = [...transfers]
    .map((t) => ({
      ...t,
      ms: Date.parse(String(t.created_at || '')),
    }))
    .filter((t) => Number.isFinite(t.ms))
    .sort((a, b) => a.ms - b.ms);

  const segments: OwnerSegment[] = [];
  const leadStart = Date.parse(leadCreatedAt);
  let cursor = Number.isFinite(leadStart) ? leadStart : 0;

  if (sorted.length === 0) {
    if (currentAssigneeName || currentAssigneeId) {
      segments.push({
        fromMs: cursor,
        toMs: Number.MAX_SAFE_INTEGER,
        name: currentAssigneeName,
        id: currentAssigneeId,
      });
    }
    return segments;
  }

  let ownerId = String(sorted[0].from_telecaller_id || '');
  let ownerName = String(sorted[0].from_name || '').trim();

  for (const t of sorted) {
    segments.push({
      fromMs: cursor,
      toMs: t.ms,
      name: ownerName,
      id: ownerId,
    });
    ownerId = String(t.to_telecaller_id || '');
    ownerName = String(t.to_name || '').trim();
    cursor = t.ms;
  }

  segments.push({
    fromMs: cursor,
    toMs: Number.MAX_SAFE_INTEGER,
    name: ownerName || currentAssigneeName,
    id: ownerId || currentAssigneeId,
  });

  return segments;
}

export function leadOwnerAt(
  segments: OwnerSegment[],
  iso: string,
): { name: string; id: string } | null {
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  for (const s of segments) {
    if (t >= s.fromMs && t < s.toMs && s.name) {
      return { name: s.name, id: s.id };
    }
  }
  return null;
}