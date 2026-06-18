import { useCallback, useEffect, useMemo, useState } from 'react';
import { ENV } from '../config/environment';
import { fetchAppMembershipPlans, type AppMembershipPlan } from '../lib/membershipPlan';
import { isPlacementEnabled, type MembershipType } from '../lib/membershipPlacements';

const CACHE_TTL_MS = 60_000;

let cachedPlans: AppMembershipPlan[] | null = null;
let cachedAt = 0;
let inflight: Promise<AppMembershipPlan[]> | null = null;

async function loadPlans(force = false): Promise<AppMembershipPlan[]> {
  const stale = !cachedAt || Date.now() - cachedAt > CACHE_TTL_MS;
  if (!force && cachedPlans && !stale) return cachedPlans;
  if (!force && inflight) return inflight;
  inflight = fetchAppMembershipPlans(ENV.API_URL)
    .then((plans) => {
      cachedPlans = plans;
      cachedAt = Date.now();
      inflight = null;
      return plans;
    })
    .catch(() => {
      inflight = null;
      return cachedPlans || [];
    });
  return inflight;
}

export function invalidateAppMembershipPlansCache() {
  cachedPlans = null;
  cachedAt = 0;
  inflight = null;
}

export function useAppMembershipPlans() {
  const [plans, setPlans] = useState<AppMembershipPlan[]>(cachedPlans || []);
  const [loading, setLoading] = useState(!cachedPlans);

  const syncPlans = useCallback(async (force = false) => {
    const next = await loadPlans(force);
    setPlans(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    syncPlans().then((next) => {
      if (!cancelled) setPlans(next);
    });
    return () => {
      cancelled = true;
    };
  }, [syncPlans]);

  const getPlansForSlot = useMemo(
    () => (screen: 'home' | 'rsa' | 'services', slot: string) =>
      plans.filter((plan) => isPlacementEnabled(plan.appPlacements, `${screen}.${slot}`)),
    [plans],
  );

  const getPlansForGlobalSlot = useMemo(
    () => (slot: 'settings_page' | 'search_banner' | 'search_grid') =>
      plans.filter((plan) => isPlacementEnabled(plan.appPlacements, slot)),
    [plans],
  );

  const getSettingsPlans = useMemo(
    () => (membershipType?: MembershipType) =>
      plans.filter(
        (plan) =>
          isPlacementEnabled(plan.appPlacements, 'settings_page') &&
          (membershipType ? plan.membershipType === membershipType : true),
      ),
    [plans],
  );

  return {
    plans,
    loading,
    refresh: () => syncPlans(true),
    getPlansForSlot,
    getPlansForGlobalSlot,
    getSettingsPlans,
  };
}
