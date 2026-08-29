import { TRACKER_CONSENT_KEY } from '@/lib/dpdp/constants';

export type TrackerConsent = {
  analytics: boolean;
  advertising: boolean;
  decidedAt: string | null;
};

export const DEFAULT_TRACKER_CONSENT: TrackerConsent = {
  analytics: false,
  advertising: false,
  decidedAt: null,
};

export function readTrackerConsent(): TrackerConsent {
  if (typeof window === 'undefined') return DEFAULT_TRACKER_CONSENT;
  try {
    const raw = window.localStorage.getItem(TRACKER_CONSENT_KEY);
    if (!raw) return DEFAULT_TRACKER_CONSENT;
    const parsed = JSON.parse(raw) as Partial<TrackerConsent>;
    return {
      analytics: Boolean(parsed.analytics),
      advertising: Boolean(parsed.advertising),
      decidedAt: parsed.decidedAt || null,
    };
  } catch {
    return DEFAULT_TRACKER_CONSENT;
  }
}

export function writeTrackerConsent(next: TrackerConsent) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TRACKER_CONSENT_KEY, JSON.stringify(next));
  window.dispatchEvent(new CustomEvent('myfng:dpdp-tracker-consent', { detail: next }));
}
