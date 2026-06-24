export type ISanctionCarLoanLead = {
  mobileNo: string;
  panId: string;
  vehicleRegistrationNumber: string;
  income: number;
  occupation: string;
};

export type ISanctionPushResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; message: string; retryable: boolean };

const DEFAULT_ISANCTION_URL = 'https://backend2.isanction.in/api/web/leads/partners';
const LEGACY_ISANCTION_API_KEY = '1flSSHcw$z7v77/F6qHdHbDrRByPqcbudRBqR@JZFTw=';

function isanctionConfig() {
  return {
    url: String(process.env.ISANCTION_API_URL || DEFAULT_ISANCTION_URL).trim(),
    apiKey: String(process.env.ISANCTION_API_KEY || LEGACY_ISANCTION_API_KEY).trim(),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseErrorMessage(status: number, rawBody: string, jsonBody: Record<string, unknown>): string {
  const jsonMessage = String(jsonBody.message || jsonBody.error || '').trim();
  if (jsonMessage) return jsonMessage;

  const trimmed = rawBody.trim();
  if (trimmed.startsWith('<!DOCTYPE') || trimmed.startsWith('<html') || trimmed.includes('Bad gateway')) {
    return `iSanction partner server unavailable (${status}). Lead saved in MyFNG CRM; sync will retry automatically.`;
  }

  if (status === 502 || status === 503 || status === 504) {
    return `iSanction partner server unavailable (${status}). Lead saved in MyFNG CRM; sync will retry automatically.`;
  }

  return `iSanction API failed (${status})`;
}

export async function pushCarLoanLeadToISanction(
  data: ISanctionCarLoanLead,
  opts?: { maxAttempts?: number },
): Promise<ISanctionPushResult> {
  const { url, apiKey } = isanctionConfig();
  if (!apiKey) {
    return {
      ok: false,
      status: 500,
      message: 'iSanction API key is not configured on server',
      retryable: false,
    };
  }

  const maxAttempts = Math.max(1, Math.min(opts?.maxAttempts ?? 3, 5));
  let lastResult: ISanctionPushResult = {
    ok: false,
    status: 0,
    message: 'iSanction API failed',
    retryable: true,
  };

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': apiKey,
        },
        body: JSON.stringify({
          mobileNo: data.mobileNo,
          type: 'CAR_LOAN',
          vehicleRegistrationNumber: data.vehicleRegistrationNumber,
          panId: data.panId,
          income: data.income,
          occupation: data.occupation,
        }),
        cache: 'no-store',
      });

      const rawBody = await res.text().catch(() => '');
      let jsonBody: Record<string, unknown> = {};
      if (rawBody) {
        try {
          jsonBody = JSON.parse(rawBody) as Record<string, unknown>;
        } catch {
          jsonBody = {};
        }
      }

      if (res.ok && jsonBody.success === true) {
        return { ok: true, body: jsonBody };
      }

      const retryable = res.status >= 500 || res.status === 429 || res.status === 408;
      lastResult = {
        ok: false,
        status: res.status,
        message: parseErrorMessage(res.status, rawBody, jsonBody),
        retryable,
      };

      if (!retryable || attempt >= maxAttempts) break;
    } catch (err: any) {
      lastResult = {
        ok: false,
        status: 0,
        message: err?.message || 'Could not reach iSanction partner API',
        retryable: true,
      };
      if (attempt >= maxAttempts) break;
    }

    await sleep(attempt * 800);
  }

  return lastResult;
}
