/** After telecaller / lead manager login — punch in so they show On Floor. Idempotent if already open. */
export async function ensureTelecallerPunchInOnLogin(): Promise<void> {
  try {
    await fetch('/api/telecaller/crm/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'punch_in' }),
      credentials: 'include',
    });
  } catch {
    /* non-blocking — attendance migration may be missing */
  }
}

/** On logout — close open punch so Live Floor shows Off Duty. Call before auth.signOut(). */
export async function ensureTelecallerPunchOutOnLogout(): Promise<void> {
  try {
    await fetch('/api/telecaller/crm/attendance', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'punch_out' }),
      credentials: 'include',
    });
  } catch {
    /* best-effort — still allow logout */
  }
}

export function isTelecallerFloorRole(roleCode: string | null | undefined): boolean {
  const r = String(roleCode || '').toUpperCase();
  return r === 'TELECALLER' || r === 'LEAD_MANAGER';
}
