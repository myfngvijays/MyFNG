import 'server-only';

export type CustomerTargetFilters = {
  targetCities?: string[];
  targetMembership?: string;
  targetMembershipPlans?: string[];
  targetServiceCenters?: string[];
  targetCarBrands?: string[];
  targetCustomerType?: string;
  targetCouponUsers?: string;
  targetCouponCodes?: string[];
  targetWallet?: string;
  targetBooking?: string;
  targetPhoneList?: string[];
};

function normalizePhone(value: unknown): string {
  return String(value || '')
    .replace(/\D/g, '')
    .slice(-10);
}

function intersectOrSet(base: Set<string> | null, next: Set<string>): Set<string> {
  if (base === null) return next;
  return new Set([...base].filter((id) => next.has(id)));
}

function excludeFromOrAll(
  supabaseAdmin: any,
  base: Set<string> | null,
  exclude: Set<string>,
): Promise<Set<string>> {
  if (base !== null) {
    return Promise.resolve(new Set([...base].filter((id) => !exclude.has(id))));
  }
  return supabaseAdmin
    .from('customers')
    .select('id')
    .then(({ data }: { data: any[] | null }) =>
      new Set((data || []).map((c: any) => String(c.id)).filter((id: string) => !exclude.has(id))),
    );
}

/** Resolve customer IDs matching Advance Push targeting filters (same rules as send). */
export async function resolveTargetCustomerIds(
  supabaseAdmin: any,
  filters: CustomerTargetFilters,
): Promise<Set<string> | null> {
  let filteredCustomerIds: Set<string> | null = null;

  const targetPhoneList = filters.targetPhoneList || [];
  const targetCities = filters.targetCities || [];
  const targetMembership = String(filters.targetMembership || '').trim();
  const targetMembershipPlans = filters.targetMembershipPlans || [];
  const targetServiceCenters = filters.targetServiceCenters || [];
  const targetCarBrands = filters.targetCarBrands || [];
  const targetCustomerType = String(filters.targetCustomerType || '').trim();
  const targetCouponUsers = String(filters.targetCouponUsers || '').trim();
  const targetCouponCodes = filters.targetCouponCodes || [];
  const targetWallet = String(filters.targetWallet || '').trim();
  const targetBooking = String(filters.targetBooking || '').trim();

  if (targetPhoneList.length > 0) {
    const { data: customers } = await supabaseAdmin.from('customers').select('id, phone');
    const normalizedList = new Set(targetPhoneList.map((p) => normalizePhone(p)).filter((p) => p.length === 10));
    filteredCustomerIds = new Set(
      (customers || [])
        .filter((c: any) => normalizedList.has(normalizePhone(c.phone)))
        .map((c: any) => String(c.id)),
    );
    return filteredCustomerIds;
  }

  if (targetCities.length > 0) {
    const { data: cityRows } = await supabaseAdmin.from('cities').select('id').in('name', targetCities);
    const cityIds = (cityRows || []).map((c: any) => c.id);
    if (cityIds.length > 0) {
      const { data: leads } = await supabaseAdmin
        .from('service_leads')
        .select('customer_phone')
        .in('city_id', cityIds)
        .not('customer_phone', 'is', null);
      const cityPhones = [
        ...new Set(
          (leads || [])
            .map((l: any) => normalizePhone(l.customer_phone))
            .filter((p: string) => p.length === 10),
        ),
      ];
      if (cityPhones.length > 0) {
        const { data: customers } = await supabaseAdmin.from('customers').select('id, phone');
        filteredCustomerIds = new Set(
          (customers || [])
            .filter((c: any) => cityPhones.includes(normalizePhone(c.phone)))
            .map((c: any) => String(c.id)),
        );
      } else {
        filteredCustomerIds = new Set();
      }
    } else {
      filteredCustomerIds = new Set();
    }
  }

  if (targetMembership === 'members' || targetMembership === 'non_members') {
    let membershipQuery = supabaseAdmin
      .from('customer_memberships')
      .select('customer_id, plan_id')
      .eq('status', 'ACTIVE');

    if (targetMembership === 'members' && targetMembershipPlans.length > 0) {
      const { data: planRows } = await supabaseAdmin
        .from('membership_plans')
        .select('id')
        .in('code', targetMembershipPlans);
      const planIds = (planRows || []).map((p: any) => p.id);
      if (planIds.length > 0) membershipQuery = membershipQuery.in('plan_id', planIds);
    }

    const { data: memberships } = await membershipQuery;
    const memberIds = new Set((memberships || []).map((m: any) => String(m.customer_id)));

    if (targetMembership === 'members') {
      filteredCustomerIds = filteredCustomerIds !== null
        ? new Set([...filteredCustomerIds].filter((id) => memberIds.has(id)))
        : memberIds;
    } else {
      filteredCustomerIds = await excludeFromOrAll(supabaseAdmin, filteredCustomerIds, memberIds);
    }
  }

  if (targetServiceCenters.length > 0) {
    const { data: workshopRows } = await supabaseAdmin
      .from('workshops')
      .select('id')
      .in('name', targetServiceCenters);
    const workshopIds = (workshopRows || []).map((w: any) => w.id);
    if (workshopIds.length > 0) {
      const { data: leads } = await supabaseAdmin
        .from('service_leads')
        .select('customer_phone')
        .in('workshop_id', workshopIds)
        .not('customer_phone', 'is', null);
      const scPhones = [
        ...new Set(
          (leads || [])
            .map((l: any) => normalizePhone(l.customer_phone))
            .filter((p: string) => p.length === 10),
        ),
      ];
      if (scPhones.length > 0) {
        const { data: customers } = await supabaseAdmin.from('customers').select('id, phone');
        const scIds = new Set(
          (customers || [])
            .filter((c: any) => scPhones.includes(normalizePhone(c.phone)))
            .map((c: any) => String(c.id)),
        );
        filteredCustomerIds = intersectOrSet(filteredCustomerIds, scIds);
      } else {
        filteredCustomerIds = new Set();
      }
    }
  }

  if (targetCarBrands.length > 0) {
    const { data: leads } = await supabaseAdmin
      .from('service_leads')
      .select('customer_phone')
      .in('vehicle_make', targetCarBrands)
      .not('customer_phone', 'is', null);
    const brandPhones = [
      ...new Set(
        (leads || [])
          .map((l: any) => normalizePhone(l.customer_phone))
          .filter((p: string) => p.length === 10),
      ),
    ];
    if (brandPhones.length > 0) {
      const { data: customers } = await supabaseAdmin.from('customers').select('id, phone');
      const brandIds = new Set(
        (customers || [])
          .filter((c: any) => brandPhones.includes(normalizePhone(c.phone)))
          .map((c: any) => String(c.id)),
      );
      filteredCustomerIds = intersectOrSet(filteredCustomerIds, brandIds);
    } else {
      filteredCustomerIds = new Set();
    }
  }

  if (targetCustomerType === 'new' || targetCustomerType === 'returning') {
    const { data: leadCounts } = await supabaseAdmin
      .from('service_leads')
      .select('customer_phone')
      .not('customer_phone', 'is', null);
    const phoneBookingCount = new Map<string, number>();
    for (const l of leadCounts || []) {
      const p = normalizePhone(l.customer_phone);
      if (p.length === 10) phoneBookingCount.set(p, (phoneBookingCount.get(p) || 0) + 1);
    }
    const { data: customers } = await supabaseAdmin.from('customers').select('id, phone');
    const matchedIds = new Set(
      (customers || [])
        .filter((c: any) => {
          const p = normalizePhone(c.phone);
          const count = phoneBookingCount.get(p) || 0;
          return targetCustomerType === 'new' ? count <= 1 : count > 1;
        })
        .map((c: any) => String(c.id)),
    );
    filteredCustomerIds = intersectOrSet(filteredCustomerIds, matchedIds);
  }

  if (targetCouponUsers === 'used' || targetCouponUsers === 'never') {
    let redemptionQuery = supabaseAdmin
      .from('coupon_redemptions')
      .select('customer_id, coupon_id')
      .not('customer_id', 'is', null);
    if (targetCouponUsers === 'used' && targetCouponCodes.length > 0) {
      const { data: couponRows } = await supabaseAdmin
        .from('coupons')
        .select('id')
        .in('code', targetCouponCodes);
      const couponIds = (couponRows || []).map((c: any) => c.id);
      if (couponIds.length > 0) redemptionQuery = redemptionQuery.in('coupon_id', couponIds);
    }
    const { data: redemptions } = await redemptionQuery;
    const couponCustomerIds = new Set((redemptions || []).map((r: any) => String(r.customer_id)));
    if (targetCouponUsers === 'used') {
      filteredCustomerIds = intersectOrSet(filteredCustomerIds, couponCustomerIds);
    } else {
      filteredCustomerIds = await excludeFromOrAll(supabaseAdmin, filteredCustomerIds, couponCustomerIds);
    }
  }

  if (targetCouponUsers === 'assigned') {
    let assignQuery = supabaseAdmin
      .from('customer_coupon_assignments')
      .select('customer_id, coupon_id')
      .not('customer_id', 'is', null)
      .is('redeemed_at', null);
    if (targetCouponCodes.length > 0) {
      const { data: couponRows } = await supabaseAdmin
        .from('coupons')
        .select('id')
        .in('code', targetCouponCodes);
      const couponIds = (couponRows || []).map((c: any) => c.id);
      if (couponIds.length > 0) assignQuery = assignQuery.in('coupon_id', couponIds);
    }
    const { data: assignments } = await assignQuery;
    const assignedCustomerIds = new Set((assignments || []).map((a: any) => String(a.customer_id)));
    filteredCustomerIds = intersectOrSet(filteredCustomerIds, assignedCustomerIds);
  }

  if (targetWallet === 'has_balance' || targetWallet === 'no_balance') {
    const { data: wallets } = await supabaseAdmin
      .from('wallet_accounts')
      .select('customer_id, current_balance')
      .gt('current_balance', 0);
    const withBalanceIds = new Set(
      (wallets || []).map((w: any) => String(w.customer_id || '').trim()).filter(Boolean),
    );
    if (targetWallet === 'has_balance') {
      filteredCustomerIds = intersectOrSet(filteredCustomerIds, withBalanceIds);
    } else {
      filteredCustomerIds = await excludeFromOrAll(supabaseAdmin, filteredCustomerIds, withBalanceIds);
    }
  }

  if (targetBooking === 'booked' || targetBooking === 'completed' || targetBooking === 'never') {
    let leadsQuery = supabaseAdmin
      .from('service_leads')
      .select('customer_id, customer_phone, status')
      .not('customer_phone', 'is', null);
    if (targetBooking === 'completed') {
      leadsQuery = leadsQuery.in('status', ['COMPLETED', 'READY_FOR_DELIVERY']);
    }
    const { data: leads } = await leadsQuery;
    const bookedPhones = new Set<string>();
    const bookedDirectIds = new Set<string>();
    for (const lead of leads || []) {
      const cid = String((lead as any).customer_id || '').trim();
      if (cid) bookedDirectIds.add(cid);
      const phone = normalizePhone((lead as any).customer_phone);
      if (phone.length === 10) bookedPhones.add(phone);
    }
    const { data: customers } = await supabaseAdmin.from('customers').select('id, phone');
    const bookedIds = new Set<string>(bookedDirectIds);
    for (const c of customers || []) {
      const phone = normalizePhone((c as any).phone);
      if (phone.length === 10 && bookedPhones.has(phone)) bookedIds.add(String((c as any).id));
    }
    if (targetBooking === 'never') {
      filteredCustomerIds = await excludeFromOrAll(supabaseAdmin, filteredCustomerIds, bookedIds);
    } else {
      filteredCustomerIds = intersectOrSet(filteredCustomerIds, bookedIds);
    }
  }

  return filteredCustomerIds;
}

export function hasAdvancedTargeting(filters: CustomerTargetFilters): boolean {
  return Boolean(
    (filters.targetPhoneList && filters.targetPhoneList.length > 0) ||
      (filters.targetCities && filters.targetCities.length > 0) ||
      filters.targetMembership ||
      (filters.targetServiceCenters && filters.targetServiceCenters.length > 0) ||
      (filters.targetCarBrands && filters.targetCarBrands.length > 0) ||
      filters.targetCustomerType ||
      filters.targetCouponUsers ||
      filters.targetWallet === 'has_balance' ||
      filters.targetWallet === 'no_balance' ||
      filters.targetBooking === 'booked' ||
      filters.targetBooking === 'completed' ||
      filters.targetBooking === 'never',
  );
}
