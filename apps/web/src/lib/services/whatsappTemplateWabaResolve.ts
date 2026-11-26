/** Resolve which WABA owns a phone_number_id for template sync/push (Meta Graph). */

async function graphGet(apiUrl: string, accessToken: string, path: string) {
  const response = await fetch(`${apiUrl}/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: 'no-store',
  });
  const json = await response.json().catch(() => ({}));
  return { ok: response.ok, json };
}

async function idHasTemplates(apiUrl: string, accessToken: string, id: string) {
  const result = await graphGet(apiUrl, accessToken, `${id}/message_templates?fields=id&limit=1`);
  if (result.ok) return true;
  return !/nonexisting field|message_templates/i.test(String(result.json?.error?.message || ''));
}

async function wabaOwnsPhone(apiUrl: string, accessToken: string, wabaId: string, phoneNumberId: string) {
  const result = await graphGet(apiUrl, accessToken, `${wabaId}/phone_numbers?fields=id&limit=50`);
  return (result.json?.data || []).some((row: { id?: string }) => String(row.id) === phoneNumberId);
}

async function wabasUnderBusiness(apiUrl: string, accessToken: string, businessId: string) {
  const ids: string[] = [];
  for (const edge of ['owned_whatsapp_business_accounts', 'client_whatsapp_business_accounts']) {
    const result = await graphGet(apiUrl, accessToken, `${businessId}/${edge}?fields=id&limit=20`);
    for (const row of result.json?.data || []) ids.push(String(row.id || ''));
  }
  return Array.from(new Set(ids.filter(Boolean)));
}

async function discoverWabaId(apiUrl: string, accessToken: string, phoneNumberId: string, savedWabaId: string) {
  if (savedWabaId) return savedWabaId;
  const debug = await fetch(`${apiUrl}/debug_token?input_token=${encodeURIComponent(accessToken)}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const payload = await debug.json().catch(() => ({}));
  const appId = String(payload?.data?.app_id || '');
  const appSecret = String(process.env.WHATSAPP_APP_SECRET || '');
  let scopes = Array.isArray(payload?.data?.granular_scopes) ? payload.data.granular_scopes : [];
  if (appId && appSecret && !scopes.some((scope: { target_ids?: string[] }) => scope?.target_ids?.length)) {
    const appToken = `${appId}|${appSecret}`;
    const again = await fetch(`${apiUrl}/debug_token?input_token=${encodeURIComponent(accessToken)}&access_token=${encodeURIComponent(appToken)}`);
    const againPayload = await again.json().catch(() => ({}));
    if (Array.isArray(againPayload?.data?.granular_scopes)) scopes = againPayload.data.granular_scopes;
  }
  const ids = Array.from(new Set(scopes.flatMap((scope: { target_ids?: string[] }) => scope?.target_ids || [])));
  for (const id of ids) {
    const phones = await fetch(`${apiUrl}/${id}/phone_numbers?fields=id&limit=50`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    const json = await phones.json().catch(() => ({}));
    if ((json.data || []).some((row: { id?: string }) => String(row.id) === phoneNumberId)) return String(id);
  }
  return String(ids[0] || '');
}

export async function resolveWabaForTemplates(
  apiUrl: string,
  accessToken: string,
  phoneNumberId: string,
  candidateId: string,
) {
  const nested = candidateId ? await wabasUnderBusiness(apiUrl, accessToken, candidateId) : [];
  const pool = Array.from(new Set([candidateId, ...nested].filter(Boolean)));
  for (const id of pool) {
    if (!(await idHasTemplates(apiUrl, accessToken, id))) continue;
    if (await wabaOwnsPhone(apiUrl, accessToken, id, phoneNumberId)) return id;
  }
  const usable = [];
  for (const id of nested) {
    if (await idHasTemplates(apiUrl, accessToken, id)) usable.push(id);
  }
  if (usable.length === 1) return usable[0];
  return discoverWabaId(apiUrl, accessToken, phoneNumberId, '');
}