/** Shared pickup photo validation — accepts web (lead_media BEFORE_*) or mobile (vehicle_condition_photos PICKUP_*). */

export function isDummyPickupLead(lead: {
  lead_number?: string | null;
  created_from?: string | null;
  customer_name?: string | null;
}): boolean {
  const num = String(lead?.lead_number || '').toUpperCase();
  if (num.startsWith('L-DUM')) return true;
  if (lead?.created_from === 'DUMMY_SEED') return true;
  return /\bdummy\b/i.test(String(lead?.customer_name || ''));
}

export const isDummyWorkshopLead = isDummyPickupLead;

export const REQUIRED_BEFORE_TYPES = [
  'BEFORE_FRONT',
  'BEFORE_REAR',
  'BEFORE_LEFT',
  'BEFORE_RIGHT',
  'BEFORE_DASHBOARD',
  'BEFORE_ENGINE_BAY',
] as const;

export const REQUIRED_PICKUP_TYPES = [
  'PICKUP_FRONT',
  'PICKUP_LEFT',
  'PICKUP_RIGHT',
  'PICKUP_INTERIOR',
] as const;

export const PICKUP_TO_BEFORE: Record<string, string> = {
  PICKUP_FRONT: 'BEFORE_FRONT',
  PICKUP_REAR: 'BEFORE_REAR',
  PICKUP_LEFT: 'BEFORE_LEFT',
  PICKUP_RIGHT: 'BEFORE_RIGHT',
  PICKUP_INTERIOR: 'BEFORE_DASHBOARD',
  PICKUP_ODOMETER: 'BEFORE_DASHBOARD',
  PICKUP_FUEL: 'BEFORE_DASHBOARD',
  PICKUP_DAMAGE: 'BEFORE_REAR',
};

export function inferBeforeSlot(row: any): string {
  const t = String(row?.photo_type || row?.category || row?.media_category || '').trim().toUpperCase();
  if (t) {
    if (t.startsWith('BEFORE_')) return t;
    if (PICKUP_TO_BEFORE[t]) return PICKUP_TO_BEFORE[t];
  }
  const fn = String(row?.file_name || '').trim();
  const m = fn.match(/^(BEFORE_[A-Z0-9_]+)__+/);
  if (m?.[1]) return String(m[1]).toUpperCase();
  return '';
}

export type PickupPhotoCheckResult = {
  ok: boolean;
  missing: string[];
  source: 'before_full' | 'pickup_mobile' | 'none';
};

export async function checkMandatoryPickupPhotos(
  client: any,
  leadId: string
): Promise<PickupPhotoCheckResult> {
  const beforeSet = new Set<string>();
  const pickupSet = new Set<string>();

  try {
    const { data: mediaRows } = await client
      .from('lead_media')
      .select('file_name, category, photo_type, media_category')
      .eq('lead_id', leadId)
      .limit(200);

    for (const row of mediaRows || []) {
      const slot = inferBeforeSlot(row);
      if (slot.startsWith('BEFORE_')) beforeSet.add(slot);
    }
  } catch {
    // ignore
  }

  try {
    const { data: vcpRows } = await client
      .from('vehicle_condition_photos')
      .select('photo_type')
      .eq('lead_id', leadId)
      .limit(50);

    for (const row of vcpRows || []) {
      const pt = String(row?.photo_type || '').trim().toUpperCase();
      if (pt) pickupSet.add(pt);
      const mapped = PICKUP_TO_BEFORE[pt];
      if (mapped) beforeSet.add(mapped);
    }
  } catch {
    // ignore
  }

  const missingBefore = REQUIRED_BEFORE_TYPES.filter((t) => !beforeSet.has(t));
  if (missingBefore.length === 0) {
    return { ok: true, missing: [], source: 'before_full' };
  }

  const missingPickup = REQUIRED_PICKUP_TYPES.filter((t) => !pickupSet.has(t));
  if (missingPickup.length === 0) {
    return { ok: true, missing: [], source: 'pickup_mobile' };
  }

  return {
    ok: false,
    missing: missingBefore.length <= missingPickup.length ? [...missingBefore] : [...missingPickup],
    source: 'none',
  };
}

/** Mirror a mobile PICKUP_* upload into lead_media as BEFORE_* for unified gates. */
export async function mirrorPickupPhotoToLeadMedia(
  client: any,
  params: {
    leadId: string;
    photoType: string;
    photoUrl: string;
    uploadedBy: string;
    fileName?: string;
  }
): Promise<void> {
  const photoTypeUpper = String(params.photoType || '').trim().toUpperCase();
  const beforeType = PICKUP_TO_BEFORE[photoTypeUpper];
  if (!beforeType || !params.photoUrl) return;

  const now = new Date().toISOString();
  const payloadBase: Record<string, unknown> = {
    lead_id: params.leadId,
    file_url: params.photoUrl,
    file_name: `${beforeType}__${params.fileName || photoTypeUpper}`,
    uploaded_by: params.uploadedBy,
    created_at: now,
    category: beforeType,
    media_type: 'PHOTO',
  };

  for (const variant of ['full', 'base'] as const) {
    const payload =
      variant === 'full'
        ? payloadBase
        : {
            lead_id: params.leadId,
            file_url: params.photoUrl,
            file_name: payloadBase.file_name,
            uploaded_by: params.uploadedBy,
            created_at: now,
            media_type: 'PHOTO',
          };
    const { error } = await client.from('lead_media').insert(payload as any);
    if (!error) return;
    if (String((error as any)?.code || '') !== '42703' && !/does not exist/i.test(String(error?.message || ''))) {
      return;
    }
  }
}
