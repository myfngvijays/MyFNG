import { getServicePlansByPincode } from './database-queries';

export type MisaResolvedService = {
  name: string;
  price: number;
  service_type_id: string | null;
};

export function normalizeMisaServiceName(value?: string | null) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

export function splitMisaServiceNames(raw: string): string[] {
  const text = String(raw || '').trim();
  if (!text) return [];

  const parts = text
    .split(/\s*,\s*|\s+\+\s+|\s+&\s+|\s+and\s+|\s+along with\s+/i)
    .map((part) => part.trim())
    .filter(Boolean);

  return parts.length > 0 ? parts : [text];
}

export function pickMisaPlanPrice(plan: Record<string, unknown> | null | undefined): number {
  if (!plan) return 0;
  for (const key of ['min_price', 'max_price', 'price', 'custom_price']) {
    const amount = Number(plan[key]);
    if (Number.isFinite(amount) && amount > 0) return amount;
  }
  return 0;
}

export function findPlanForServiceName(
  plans: Array<Record<string, unknown>>,
  serviceName: string,
): Record<string, unknown> | undefined {
  const target = normalizeMisaServiceName(serviceName);
  if (!target || !plans.length) return undefined;

  const exact = plans.find(
    (plan) => normalizeMisaServiceName(String(plan.service_name || '')) === target,
  );
  if (exact) return exact;

  let best: Record<string, unknown> | undefined;
  let bestScore = 0;
  for (const plan of plans) {
    const planName = normalizeMisaServiceName(String(plan.service_name || ''));
    if (!planName) continue;
    if (planName.includes(target) || target.includes(planName)) {
      const score = Math.min(planName.length, target.length);
      if (score > bestScore) {
        bestScore = score;
        best = plan;
      }
    }
  }
  return best;
}

export function mergePricingPlans(
  existing: Array<Record<string, unknown>>,
  incoming: Array<Record<string, unknown>>,
): Array<Record<string, unknown>> {
  const merged = [...existing];
  for (const plan of incoming) {
    const name = normalizeMisaServiceName(String(plan.service_name || ''));
    if (!name) continue;
    const idx = merged.findIndex(
      (row) => normalizeMisaServiceName(String(row.service_name || '')) === name,
    );
    if (idx >= 0) merged[idx] = plan;
    else merged.push(plan);
  }
  return merged;
}

export function formatMisaServicesLabel(services: MisaResolvedService[]): string {
  return services.map((service) => service.name).filter(Boolean).join(', ');
}

export async function resolveMisaServicesPricing(opts: {
  serviceNameRaw: string;
  sessionPlans?: Array<Record<string, unknown>>;
  pincode?: string;
  carModel?: string;
  category?: string;
  directQuotedPrice?: number;
}): Promise<{
  services: MisaResolvedService[];
  totalPrice: number;
  serviceTypeIds: string[];
  displayLabel: string;
}> {
  const parts = splitMisaServiceNames(opts.serviceNameRaw);
  const sessionPlans = Array.isArray(opts.sessionPlans) ? opts.sessionPlans : [];

  if (parts.length === 1 && opts.directQuotedPrice && opts.directQuotedPrice > 0) {
    const plan = findPlanForServiceName(sessionPlans, parts[0]);
    const serviceTypeId = plan?.service_type_id ? String(plan.service_type_id) : null;
    return {
      services: [
        {
          name: parts[0],
          price: opts.directQuotedPrice,
          service_type_id: serviceTypeId,
        },
      ],
      totalPrice: opts.directQuotedPrice,
      serviceTypeIds: serviceTypeId ? [serviceTypeId] : [],
      displayLabel: parts[0],
    };
  }

  const services: MisaResolvedService[] = [];

  for (const part of parts) {
    let plan = findPlanForServiceName(sessionPlans, part);

    if (!plan && opts.pincode && opts.carModel && opts.category) {
      try {
        const fetched = await getServicePlansByPincode({
          category: opts.category,
          carModel: opts.carModel,
          pincode: opts.pincode,
        });
        const validPlans = (fetched || []).filter((row: any) => !row?.error);
        plan = findPlanForServiceName(validPlans, part);
      } catch {
        // Non-blocking — continue with zero price for unmatched service
      }
    }

    const price = pickMisaPlanPrice(plan);
    services.push({
      name: part,
      price,
      service_type_id: plan?.service_type_id ? String(plan.service_type_id) : null,
    });
  }

  let totalPrice = services.reduce((sum, service) => sum + service.price, 0);

  if (totalPrice <= 0 && opts.directQuotedPrice && opts.directQuotedPrice > 0) {
    totalPrice = opts.directQuotedPrice;
    if (services.length === 1 && services[0].price <= 0) {
      services[0].price = opts.directQuotedPrice;
    }
  }

  const serviceTypeIds = services
    .map((service) => service.service_type_id)
    .filter((id): id is string => Boolean(id));

  return {
    services,
    totalPrice,
    serviceTypeIds,
    displayLabel: formatMisaServicesLabel(services),
  };
}

export function findQuotedPriceInPlans(
  plans: Array<Record<string, unknown>>,
  serviceName: string,
): number | undefined {
  const resolved = findPlanForServiceName(plans, serviceName);
  const price = pickMisaPlanPrice(resolved);
  return price > 0 ? price : undefined;
}

export async function resolveQuotedPriceForMisaBooking(
  args: Record<string, unknown>,
  session?: {
    lastShownPlans?: Array<Record<string, unknown>>;
    bookingState?: {
      pincode?: string;
      carModel?: string;
      category?: string;
      selectedServicePlan?: { service_name: string; min_price: number; max_price: number };
    };
  },
): Promise<number | undefined> {
  const direct = Number(args.quoted_price);
  const serviceName = String(args.service_name || '').trim();
  const sessionPlans = Array.isArray(session?.lastShownPlans) ? session.lastShownPlans : [];

  const resolved = await resolveMisaServicesPricing({
    serviceNameRaw: serviceName,
    sessionPlans,
    pincode: String(args.pincode || session?.bookingState?.pincode || '').trim(),
    carModel: String(args.car_model || session?.bookingState?.carModel || '').trim(),
    category: String(args.service_category || session?.bookingState?.category || '').trim(),
    directQuotedPrice: Number.isFinite(direct) && direct > 0 ? direct : undefined,
  });

  if (resolved.totalPrice > 0) return resolved.totalPrice;

  const selectedPlan = session?.bookingState?.selectedServicePlan;
  if (selectedPlan) {
    const selectedName = normalizeMisaServiceName(selectedPlan.service_name);
    const targetName = normalizeMisaServiceName(serviceName);
    if (
      selectedName &&
      targetName &&
      (selectedName === targetName ||
        selectedName.includes(targetName) ||
        targetName.includes(selectedName))
    ) {
      const selectedPrice = pickMisaPlanPrice(selectedPlan as unknown as Record<string, unknown>);
      if (selectedPrice > 0) return selectedPrice;
    }
  }

  return undefined;
}
