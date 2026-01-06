// Client-safe VAPID helpers (no Node deps)

export function getVapidPublicKey(): string | null {
  // This MUST be public and client-exposed
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY || null;
}


