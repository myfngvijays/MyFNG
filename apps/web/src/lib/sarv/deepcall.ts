/**
 * DeepCall (formerly Sarv) recording URL helper.
 *
 * Naya DeepCall panel webhook me sirf relative recording path bhejta hai
 * (jaise `/mp3/<userid>/2026/04/25/<file>.mp3`). Browser me play hone ke
 * liye ek per-call signed URL chahiye jo DeepCall ke `CallReport/detail`
 * API se generate hota hai. Token approx ssid se tied hai aur kafi der
 * tak valid rehta hai (ek hi token multiple calls me dekha gaya).
 *
 * Required env vars:
 *   DEEPCALL_API_BASE     (default: https://v4-api.deepcall.com)
 *   DEEPCALL_USER_ID      (DeepCall account id, e.g. "11965974")
 *   DEEPCALL_SSID         (DeepCall login session token; rotate when expires)
 *
 * Optional fallback:
 *   SARV_RECORDING_BASE_URL (legacy s-ct3 host, used only when API call fails
 *                            and we have a relative path to fall back on)
 */

const DEEPCALL_API_BASE = (
  process.env.DEEPCALL_API_BASE || 'https://v4-api.deepcall.com'
).replace(/\/+$/, '');

const DEEPCALL_USER_ID = process.env.DEEPCALL_USER_ID || '';
const DEEPCALL_SSID = process.env.DEEPCALL_SSID || '';

const STREAM_PREFIX = `${DEEPCALL_API_BASE}/api/v2/recording/directstream`;

export type DeepcallRecordingResolution = {
  url: string | null;
  /** Why we didn't get a URL (only set on failure). */
  error?: string;
  /** Raw `rcrd` token-string from DeepCall (handy for debugging). */
  rawRcrd?: string | null;
};

/**
 * `rcrd` field DeepCall me `*` separator se token+path ek string me deta hai:
 *   "<256-hex-token>*mp3*<userid>*<YYYY>*<MM>*<DD>*<file>.mp3"
 * Ise streaming URL me convert karta hai.
 */
export function buildDirectstreamUrl(rcrd: string | null | undefined): string | null {
  if (!rcrd) return null;
  const trimmed = String(rcrd).trim();
  if (!trimmed) return null;
  // Already a full URL (DeepCall might one day return absolute) — pass through.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const path = trimmed.split('*').filter(Boolean).join('/');
  if (!path) return null;
  return `${STREAM_PREFIX}/${path}`;
}

/**
 * DeepCall ke /CallReport/detail API ko POST karke fresh signed recording URL
 * lao. Multiple recordings ke case me sabki list deta hai; default `nodeId`
 * "#3" pe priority deta hai (typical answered-agent leg). Agar specific node
 * nahi mila to first answered recording return karta hai.
 */
export async function fetchDeepcallRecordingUrl(
  callid: string,
  options?: { nodeId?: string; signal?: AbortSignal }
): Promise<DeepcallRecordingResolution> {
  if (!DEEPCALL_USER_ID || !DEEPCALL_SSID) {
    return { url: null, error: 'DEEPCALL_USER_ID / DEEPCALL_SSID env not set' };
  }
  if (!callid) return { url: null, error: 'Missing callid' };

  let res: Response;
  try {
    res = await fetch(`${DEEPCALL_API_BASE}/api/v2/CallReport/detail`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Origin: 'https://app.deepcall.com',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        ssid: DEEPCALL_SSID,
        userId: DEEPCALL_USER_ID,
        clId: callid,
        rType: ['rcrd'],
      }),
      signal: options?.signal,
      // DeepCall sometimes responds slowly when recording ready ho raha hota hai.
      cache: 'no-store',
    });
  } catch (e: any) {
    return { url: null, error: `DeepCall network error: ${e?.message || e}` };
  }

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    return {
      url: null,
      error: `DeepCall ${res.status}: ${body.slice(0, 200) || res.statusText}`,
    };
  }

  let json: any;
  try {
    json = await res.json();
  } catch (e: any) {
    return { url: null, error: `DeepCall invalid JSON: ${e?.message || e}` };
  }

  const list: any[] = Array.isArray(json?.data?.rcrdAr) ? json.data.rcrdAr : [];
  if (!list.length) {
    return { url: null, error: 'No recordings in DeepCall response', rawRcrd: null };
  }

  const preferred = options?.nodeId
    ? list.find((item) => String(item?.ndId || '').trim() === options.nodeId.trim())
    : null;

  const picked =
    preferred ||
    list.find((item) => String(item?.rcrd || '').trim()) ||
    list[0];

  const rawRcrd = String(picked?.rcrd || '').trim() || null;
  const url = buildDirectstreamUrl(rawRcrd);
  if (!url) {
    return { url: null, error: 'Empty rcrd field in DeepCall response', rawRcrd };
  }
  return { url, rawRcrd };
}

/**
 * Quick convenience: just give me the URL string (or null on any failure).
 * Errors are swallowed — use `fetchDeepcallRecordingUrl` directly for diagnostics.
 */
export async function getDeepcallRecordingUrl(
  callid: string,
  options?: { nodeId?: string }
): Promise<string | null> {
  const { url } = await fetchDeepcallRecordingUrl(callid, options);
  return url;
}
