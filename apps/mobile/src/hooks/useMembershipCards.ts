import { useCallback, useEffect, useMemo, useState } from 'react';
import { ENV } from '../config/environment';
import { fetchAppMembershipCards, getCardsForSlot, type AppMembershipCard } from '../lib/membershipCards';

const CACHE_TTL_MS = 30_000;

let cachedCards: AppMembershipCard[] | null = null;
let cachedAt = 0;
let inflight: Promise<AppMembershipCard[]> | null = null;

async function loadCards(force = false): Promise<AppMembershipCard[]> {
  const stale = !cachedAt || Date.now() - cachedAt > CACHE_TTL_MS;
  if (!force && cachedCards && !stale) return cachedCards;
  if (!force && inflight) return inflight;
  inflight = fetchAppMembershipCards(ENV.API_URL)
    .then((cards) => {
      cachedCards = cards;
      cachedAt = Date.now();
      inflight = null;
      return cards;
    })
    .catch(() => {
      inflight = null;
      return cachedCards || [];
    });
  return inflight;
}

export function invalidateMembershipCardsCache() {
  cachedCards = null;
  cachedAt = 0;
  inflight = null;
}

export function useMembershipCards() {
  const [cards, setCards] = useState<AppMembershipCard[]>(cachedCards || []);
  const [loading, setLoading] = useState(!cachedCards);

  const sync = useCallback(async (force = false) => {
    const next = await loadCards(force);
    setCards(next);
    setLoading(false);
    return next;
  }, []);

  useEffect(() => {
    let cancelled = false;
    sync().then((next) => {
      if (!cancelled) setCards(next);
    });
    return () => {
      cancelled = true;
    };
  }, [sync]);

  const getCardsForScreenSlot = useMemo(
    () => (screen: 'home' | 'search' | 'rsa' | 'services', slot: string) =>
      getCardsForSlot(cards, screen, slot),
    [cards],
  );

  return { cards, loading, refresh: () => sync(true), getCardsForScreenSlot };
}
