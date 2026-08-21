/**
 * Telecaller-facing lead tags only (Google / Meta / channel reference).
 * Managers still see the full tag catalog.
 */
export const TELECALLER_ALLOWED_TAG_LABELS = [
  'Website',
  'Google',
  'Reference',
  'WhatsApp',
  'Facebook',
  'Instagram',
  'Banner/Offline',
  'Other',
] as const;

/** Normalize for matching: lower, strip ads/punctuation. */
export function normalizeLeadTagName(name: string): string {
  return String(name || '')
    .toLowerCase()
    .replace(/\bads?\b/g, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Map DB tag name → one of the 8 telecaller labels, or null if not allowed. */
export function telecallerTagBucket(name: string): string | null {
  const n = normalizeLeadTagName(name);
  if (!n) return null;
  if (n === 'website' || n === 'web') return 'Website';
  if (n === 'google' || n.startsWith('google ')) return 'Google';
  if (n === 'reference' || n === 'referral' || n === 'refer') return 'Reference';
  if (n === 'whatsapp' || n === 'wa') return 'WhatsApp';
  if (n === 'facebook' || n === 'fb' || n.startsWith('facebook ')) return 'Facebook';
  if (n === 'instagram' || n === 'ig' || n.startsWith('instagram ')) return 'Instagram';
  if (
    n === 'banner/offline' ||
    n === 'banner offline' ||
    n === 'banner' ||
    n === 'offline' ||
    n.includes('banner') ||
    n.includes('offline')
  ) {
    return 'Banner/Offline';
  }
  if (n === 'other' || n === 'others') return 'Other';
  return null;
}

/**
 * Filter + de-dupe tags for telecaller UI (one pill per allowed bucket).
 * Prefers exact label match when multiple DB tags map to the same bucket.
 */
export function filterTagsForTelecaller<T extends { id: string; name: string }>(
  tags: T[],
): T[] {
  const byBucket = new Map<string, T>();
  for (const tag of tags) {
    const bucket = telecallerTagBucket(tag.name);
    if (!bucket) continue;
    const existing = byBucket.get(bucket);
    if (!existing) {
      byBucket.set(bucket, { ...tag, name: bucket });
      continue;
    }
    // Prefer exact name match over alias (e.g. "Google" over "Google Ads")
    if (normalizeLeadTagName(tag.name) === normalizeLeadTagName(bucket)) {
      byBucket.set(bucket, { ...tag, name: bucket });
    }
  }
  return TELECALLER_ALLOWED_TAG_LABELS.map((label) => byBucket.get(label)).filter(
    Boolean,
  ) as T[];
}
