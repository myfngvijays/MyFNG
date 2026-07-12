import { apiFetch } from './api';
import type { BookingDraft } from './bookingDraft';

export async function syncBookingDraftToServer(draft: BookingDraft, step: number): Promise<void> {
  try {
    await apiFetch('/api/customer/booking-drafts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        draft_key: draft.id,
        step,
        draft_payload: draft,
      }),
    });
  } catch {
    // Guest users or offline — local draft still works.
  }
}

export async function completeBookingDraftOnServer(draftId: string): Promise<void> {
  try {
    await apiFetch(`/api/customer/booking-drafts?draft_key=${encodeURIComponent(draftId)}`, {
      method: 'DELETE',
    });
  } catch {
    // Non-blocking cleanup.
  }
}
