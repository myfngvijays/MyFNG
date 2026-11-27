/** Browser CRM calls: keep cookies, retry once after refresh on 401, backoff on auth blip 503. */
export async function crmFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const opts: RequestInit = { ...init, credentials: init?.credentials ?? 'include' };
  let res = await fetch(input, opts);
  if (res.status === 401) {
    try {
      const { createClient } = await import('@/lib/supabase/client');
      const supabase = createClient();
      const { data } = await supabase.auth.refreshSession();
      if (data?.session?.access_token) {
        res = await fetch(input, opts);
      }
    } catch {
      /* keep original 401 */
    }
  } else if (res.status === 503) {
    await new Promise((r) => setTimeout(r, 600));
    res = await fetch(input, opts);
  }
  return res;
}