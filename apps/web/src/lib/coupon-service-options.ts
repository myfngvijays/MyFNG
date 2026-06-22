export type BookableServiceOption = {
  key: string;
  id: string;
  name: string;
  kind: 'category';
};

/** Top-level services only — Periodic, AC, Brake, etc. (no package breakdown). */
export function buildBookableServices(
  categories: Array<{ uuid: string; category: string }>,
): BookableServiceOption[] {
  return categories
    .map((cat) => ({
      key: `category:${cat.uuid}`,
      id: cat.uuid,
      name: cat.category,
      kind: 'category' as const,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export function serviceSelectionKeysFromCoupon(
  coupon: any,
  serviceTypes: Array<{ id: string; category_uuid?: string | null }> = [],
): string[] {
  const categoryIds = new Set<string>(
    Array.isArray(coupon?.applicable_category_ids) ? coupon.applicable_category_ids.map(String) : [],
  );

  // Legacy coupons saved with specific service_type ids → show parent category selected
  if (categoryIds.size === 0 && Array.isArray(coupon?.applicable_service_type_ids)) {
    for (const stId of coupon.applicable_service_type_ids) {
      const st = serviceTypes.find((row) => String(row.id) === String(stId));
      if (st?.category_uuid) categoryIds.add(String(st.category_uuid));
    }
  }

  return Array.from(categoryIds).map((id) => `category:${id}`);
}

export function splitServiceSelectionKeys(keys: string[]) {
  const applicable_category_ids: string[] = [];
  for (const key of keys) {
    if (key.startsWith('category:')) applicable_category_ids.push(key.slice('category:'.length));
  }
  return { applicable_category_ids, applicable_service_type_ids: [] as string[] };
}

export function bookableServiceLabel(item: BookableServiceOption) {
  return item.name;
}
