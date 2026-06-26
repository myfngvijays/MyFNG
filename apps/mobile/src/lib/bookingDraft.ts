import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFTS_KEY = 'booking_drafts';

export interface BookingDraft {
  id: string;
  step: number;
  createdAt: string;
  updatedAt: string;
  city?: { id: string; name: string; zone_id?: string } | null;
  carModel?: { id: string; make: string; model_name: string; variant?: string | null; class?: string | null } | null;
  customerName?: string;
  customerPhone?: string;
  selectedCategory?: string | null;
  selectedServices?: string[];
  serviceNames?: Record<string, string>;
  servicePrices?: Record<string, number>;
  /** Full pricing map from the booking session (same prices user saw on step 2). */
  pricingSnapshot?: Record<string, number>;
  pickupRequired?: boolean;
  pickupDate?: string;
  pickupTime?: string;
  pickupAddress?: string;
  vehicleNumber?: string;
  paymentMethod?: string;
}

export async function getBookingDrafts(): Promise<BookingDraft[]> {
  try {
    const raw = await AsyncStorage.getItem(DRAFTS_KEY);
    if (!raw) return [];
    const drafts: BookingDraft[] = JSON.parse(raw);
    return drafts.sort(
      (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
  } catch {
    return [];
  }
}

export async function saveBookingDraft(draft: BookingDraft): Promise<void> {
  try {
    const drafts = await getBookingDrafts();
    const idx = drafts.findIndex((d) => d.id === draft.id);
    if (idx >= 0) {
      drafts[idx] = { ...drafts[idx], ...draft, updatedAt: new Date().toISOString() };
    } else {
      drafts.unshift({ ...draft, updatedAt: new Date().toISOString() });
    }
    // Keep only latest 10 drafts
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts.slice(0, 10)));
  } catch {}
}

export async function removeBookingDraft(draftId: string): Promise<void> {
  try {
    const drafts = await getBookingDrafts();
    const filtered = drafts.filter((d) => d.id !== draftId);
    await AsyncStorage.setItem(DRAFTS_KEY, JSON.stringify(filtered));
  } catch {}
}

export async function clearAllBookingDrafts(): Promise<void> {
  try {
    await AsyncStorage.removeItem(DRAFTS_KEY);
  } catch {}
}

/** Count selected services in the most recent draft that has services. */
export function countDraftCartItems(drafts: BookingDraft[]): number {
  const draft = drafts.find((d) => (d.selectedServices?.length || 0) > 0) || drafts[0];
  if (!draft) return 0;
  return draft.selectedServices?.length || 0;
}

export async function getBookingCartItemCount(): Promise<number> {
  const drafts = await getBookingDrafts();
  return countDraftCartItems(drafts);
}

/** Prefer saved session pricing over live DB lookup on resume/cart. */
export function getDraftDisplayPrices(draft: BookingDraft | null | undefined): Record<string, number> {
  if (!draft) return {};
  if (draft.pricingSnapshot && Object.keys(draft.pricingSnapshot).length > 0) {
    return draft.pricingSnapshot;
  }
  return draft.servicePrices || {};
}

export function getDraftDisplayTotal(draft: BookingDraft | null | undefined): number {
  const prices = getDraftDisplayPrices(draft);
  const selected = draft?.selectedServices || [];
  if (selected.length === 0) return Object.values(prices).reduce((s, p) => s + p, 0);
  return selected.reduce((s, id) => s + (prices[id] || 0), 0);
}

/** Resume at pricing step when services were already chosen. */
export function buildResumeDraft(draft: BookingDraft): BookingDraft {
  const hasServices = (draft.selectedServices?.length || 0) > 0;
  return {
    ...draft,
    step: hasServices ? Math.max(draft.step ?? 0, 2) : draft.step ?? 0,
  };
}
