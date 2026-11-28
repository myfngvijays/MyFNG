/** Map browser / Supabase fetch failures to short Hindi-English copy for staff UI. */
export function formatClientNetworkError(err: unknown, fallback = 'Request failed — try again.'): string {
  const name = String((err as { name?: string })?.name || '');
  const msg = String((err as { message?: string })?.message || err || '').trim();
  const blob = `${name} ${msg}`;

  if (name === 'AbortError' || /signal is aborted|aborted without reason/i.test(blob)) {
    return 'Connection was interrupted (slow network or server busy). Please wait a few seconds and try again.';
  }
  if (/timed out|timeout|AUTH_TIMEOUT/i.test(blob)) {
    return 'Server is taking too long to respond. Please try again in a minute.';
  }
  if (/fetch failed|failed to fetch|network|ECONNRESET|ENOTFOUND/i.test(blob)) {
    return 'Network error — check your internet or try again when myfng.in is not showing Bad Gateway.';
  }
  if (msg && !/^AbortError:/i.test(msg)) return msg;
  return fallback;
}