export type ISanctionCarLoanLead = {
  mobileNo: string;
  panId: string;
  vehicleRegistrationNumber: string;
  fullName: string;
  income: number;
  occupation: string;
  loanAmount?: number;
};

export type ISanctionPushResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; status: number; message: string; retryable: boolean };

const DEFAULT_ISANCTION_URL = 'https://backend-isanction-crm.isanction.in/api/v1/leads';
const DEFAULT_LEAD_TYPE = 'USED_CAR_LOAN';
const DEFAULT_LEAD_SOURCE = 'partner_website';

function isanctionConfig() {
  return {
    url: String(process.env.ISANCTION_API_URL || DEFAULT_ISANCTION_URL).trim(),
    clientId: String(process.env.ISANCTION_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.ISANCTION_CLIENT_SECRET || '').trim(),
    leadType: String(process.env.ISANCTION_LEAD_TYPE || DEFAULT_LEAD_TYPE).trim(),
    leadSource: String(process.env.ISANCTION_LEAD_SOURCE || DEFAULT_LEAD_SOURCE).trim(),
  };
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseErrorMessage(status: number, rawBody: string, jsonBody: Record<string, unknown>): string {
  const jsonMessage = String(
    jsonBody.message || jsonBody.error || jsonBody.detail || jsonBody.msg || '',
  ).trim();
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

function isSuccessResponse(status: number, jsonBody: Record<string, unknown>): boolean {
  if (status < 200 || status >= 300) return false;
  if (jsonBody.success === false) return false;
  if (jsonBody.error || jsonBody.errors) return false;
  if (jsonBody.success === true) return true;
  if (jsonBody.id || jsonBody.lead_id || jsonBody.leadId) return true;
  return true;
}

function buildLeadPayload(
  data: ISanctionCarLoanLead,
  config: ReturnType<typeof isanctionConfig>,
): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    lead_type: config.leadType,
    mobile_no: data.mobileNo,
    full_name: String(data.fullName || 'MyFNG Customer').trim(),
    pan_id: data.panId,
    registration_no: data.vehicleRegistrationNumber,
    source: config.leadSource,
    loan_amount: data.loanAmount,
  };

  return payload;
}

export async function pushCarLoanLeadToISanction(
  data: ISanctionCarLoanLead,
  opts?: { maxAttempts?: number },
): Promise<ISanctionPushResult> {
  const config = isanctionConfig();
  if (!config.clientId || !config.clientSecret) {
    return {
      ok: false,
      status: 500,
      message: 'iSanction client credentials are not configured on server',
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

  const payload = buildLeadPayload(data, config);

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const res = await fetch(config.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Client-ID': config.clientId,
          'X-Client-Secret': config.clientSecret,
        },
        body: JSON.stringify(payload),
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

      if (isSuccessResponse(res.status, jsonBody)) {
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
