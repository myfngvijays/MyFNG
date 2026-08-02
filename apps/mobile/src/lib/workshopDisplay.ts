/** Fields used for locator / CRM display (never raw long street-only fallback alone). */
export type WorkshopAddressFields = {
  address?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  short_address?: string | null;
  workshop_area?: string | null;
  near_famous_area?: string | null;
  landmark?: string | null;
};

export type GmbDataLike = {
  formatted_address?: string | null;
} | null | undefined;

export function workshopShortAddress(w: WorkshopAddressFields): string | null {
  return (
    String(w.short_address || '').trim() ||
    String(w.workshop_area || '').trim() ||
    String(w.near_famous_area || '').trim() ||
    String(w.landmark || '').trim() ||
    null
  );
}

/** Same address as /workshop/[slug] → Workshop Details card. */
export function workshopPublicPageAddress(workshop: WorkshopAddressFields, gmb?: GmbDataLike): string | null {
  const gmbAddress = String(gmb?.formatted_address || '').trim();
  if (gmbAddress) return gmbAddress;

  const joined = [workshop.address, workshop.city, workshop.state, workshop.pincode]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(', ');
  if (joined) return joined;

  return workshopShortAddress(workshop);
}

/** Locator lists only MyFNG-branded workshops — excludes stray GMB entries like third-party garages. */
export function isMyFngBrandedWorkshop(input: {
  name?: string | null;
  workshop_name?: string | null;
  gmb_business_name?: string | null;
}): boolean {
  const hay = [input.workshop_name, input.name, input.gmb_business_name]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .join(' ');
  return /my\s*fng|myfng/i.test(hay);
}
