import AsyncStorage from '@react-native-async-storage/async-storage';

const DRAFTS_KEY = 'booking_drafts';

export interface BookingDraft {
  id: string;
  step: number;
  createdAt: string;
  updatedAt: string;
  city?: { id: string; name: string } | null;
  carModel?: { id: string; make: string; model_name: string; variant?: string | null } | null;
  customerName?: string;
  customerPhone?: string;
  selectedCategory?: string | null;
  selectedServices?: string[];
  serviceNames?: Record<string, string>;
  servicePrices?: Record<string, number>;
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
