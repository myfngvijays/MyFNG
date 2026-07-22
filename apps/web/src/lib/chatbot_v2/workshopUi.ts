export const DEFAULT_WORKSHOP_PHONE = '9152307030';

export type WorkshopCardItem = {
  id: string;
  name: string;
  address?: string;
  phone?: string;
  mapLink?: string | null;
  city?: string;
  pincode?: string;
  workingTime?: string;
};

export type WorkshopCarouselPayload = {
  kind: 'WORKSHOP_CAROUSEL';
  title?: string;
  items: WorkshopCardItem[];
};

export function normalizeWorkshopPhone(value?: string | null) {
  const digits = String(value || DEFAULT_WORKSHOP_PHONE).replace(/\D/g, '');
  if (digits.length >= 10) return digits.slice(-10);
  return DEFAULT_WORKSHOP_PHONE;
}

export function buildWorkshopCarouselFromToolRows(rows: unknown[]): WorkshopCarouselPayload | null {
  if (!Array.isArray(rows) || rows.length === 0) return null;

  const items = rows
    .map((row, index) => {
      const w = row as Record<string, unknown>;
      const name = String(w.name || w.workshop_name || '').trim();
      if (!name) return null;
      const id = String(w.id || `workshop-${index}-${name.toLowerCase().replace(/\s+/g, '-')}`);
      const address = String(w.address || w.short_address || w.subtitle || '').trim();
      const mapLink = String(w.map_link || w.mapLink || w.near_area_google_map || '').trim() || null;
      return {
        id,
        name,
        address: address || undefined,
        phone: normalizeWorkshopPhone(typeof w.phone === 'string' ? w.phone : undefined),
        mapLink,
        city: typeof w.city === 'string' ? w.city : undefined,
        pincode: typeof w.pincode === 'string' ? w.pincode : undefined,
        workingTime: typeof w.working_time === 'string' ? w.working_time : undefined,
      } satisfies WorkshopCardItem;
    })
    .filter(Boolean) as WorkshopCardItem[];

  if (!items.length) return null;
  return {
    kind: 'WORKSHOP_CAROUSEL',
    title: 'Nearest workshops',
    items,
  };
}

/** Fallback when LLM returns plain-text workshop list instead of structured UI. */
export function parseWorkshopsFromAssistantText(text: string): WorkshopCardItem[] {
  const raw = String(text || '');
  if (!raw.trim()) return [];
  if (!/workshop|nearest|📍/i.test(raw)) return [];

  const blocks = raw.split(/\n(?=\d+[.)]\s)/).map((part) => part.trim()).filter(Boolean);
  const items: WorkshopCardItem[] = [];

  for (const block of blocks) {
    const headerMatch = block.match(/^\d+[.)]\s*(?:\*\*)?([^*\n]+?)(?:\*\*)?(?:\n|$)/);
    if (!headerMatch?.[1]) continue;

    const name = headerMatch[1].trim();
    if (!name || /here are|nearest workshops/i.test(name)) continue;

    const addressMatch = block.match(/📍\s*([^\n]+)/);
    const phoneMatch = block.match(/📞\s*([0-9+\-\s]{8,})/);
    const mdMapMatch = block.match(/\[Map Link\]\((https?:\/\/[^\s)]+)\)/i);
    const rawUrlMatch = block.match(/(https?:\/\/(?:maps\.google|goo\.gl|www\.google\.com\/maps)[^\s)\]]+)/i);

    items.push({
      id: `parsed-${items.length}-${name.toLowerCase().replace(/\s+/g, '-')}`,
      name,
      address: addressMatch?.[1]?.trim(),
      phone: normalizeWorkshopPhone(phoneMatch?.[1]),
      mapLink: mdMapMatch?.[1] || rawUrlMatch?.[1] || null,
    });
  }

  return items;
}

export function assistantMessageShowsWorkshopList(text: string): boolean {
  const t = String(text || '');
  return (
    /nearest workshops|workshops near|here are the nearest workshops/i.test(t) &&
    (/\d+[.)]\s/.test(t) || /MyFNG/i.test(t))
  );
}

export function extractWorkshopListTitle(text: string): string {
  const line =
    String(text || '')
      .split('\n')
      .map((l) => l.trim())
      .find((l) => /nearest workshops|workshops near/i.test(l)) || '';
  return line.replace(/^[^\w]*\s*/, '').replace(/\*+$/, '').trim() || 'Nearest workshops';
}

export function collapseWorkshopListText(text: string): string {
  const title = extractWorkshopListTitle(text);
  return title.replace(/\*+/g, '').trim() || '📍 Nearest workshops';
}
