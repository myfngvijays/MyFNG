/** Telecallers who must not see channel names (WhatsApp #, Meta Ads, etc.). */
export function telecallerHidesLeadSource(profile: {
  full_name?: string | null;
  phone?: string | null;
  email?: string | null;
} | null | undefined): boolean {
  if (!profile) return false;
  const name = String(profile.full_name || '').trim().toLowerCase();
  const phone10 = String(profile.phone || '').replace(/\D/g, '').slice(-10);
  const email = String(profile.email || '').trim().toLowerCase();
  if (name.includes('mahendra')) return true;
  if (phone10 === '9594050288') return true;
  if (email.includes('mahendra')) return true;
  return false;
}