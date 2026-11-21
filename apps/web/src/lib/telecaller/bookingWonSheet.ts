import 'server-only';
import * as crypto from 'crypto';

const SPREADSHEET_ID = '1vT7wU0U3MRsA8mQj1WnTNkzrLOKqakvnNv8DxY7rPsjI';
const SHEET_TAB = 'Today';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

type Creds = { client_email: string; private_key: string };

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function loadCreds(): Creds | null {
  const raw =
    process.env.GA4_SERVICE_ACCOUNT_JSON?.trim() ||
    process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim() ||
    '';
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { client_email?: string; private_key?: string };
    if (!parsed.client_email || !parsed.private_key) return null;
    return {
      client_email: parsed.client_email,
      private_key: parsed.private_key.replace(/\\n/g, '\n'),
    };
  } catch {
    return null;
  }
}

async function accessToken(creds: Creds): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: creds.client_email,
      scope: SCOPE,
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );
  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const assertion = `${signInput}.${base64url(sign.sign(creds.private_key))}`;
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${encodeURIComponent(assertion)}`,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json.access_token) {
    throw new Error(json?.error_description || json?.error || `Google token ${res.status}`);
  }
  return String(json.access_token);
}

function istDate(d = new Date()) {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
}

export type BookingWonSheetInput = {
  name?: string | null;
  phone?: string | null;
  address?: string | null;
  carNo?: string | null;
  make?: string | null;
  carModel?: string | null;
  packageName?: string | null;
  packageAmount?: string | number | null;
  workshop?: string | null;
  agent?: string | null;
  remark?: string | null;
  customerRemark?: string | null;
  vehicleClass?: string | null;
  area?: string | null;
  pickupRequired?: boolean | null;
  leadNumber?: string | null;
  pincode?: string | null;
  city?: string | null;
};

function istDateTime(d = new Date()) {
  // 21/11/2026 14:45:16 — same as the rows already in "Today send lead".
  return new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  })
    .format(d)
    .replace(',', '');
}

/**
 * Google Apps Script web app inside the sheet (scripts/google-apps-script/booking-sheet-webhook.gs).
 * No Sheets API / service account: the script runs as the sheet owner and appends the row.
 */
async function postBookingToSheetWebhook(
  url: string,
  secret: string,
  input: BookingWonSheetInput,
): Promise<{ ok: boolean; error?: string }> {
  const digits = String(input.phone || '').replace(/\D/g, '');
  const phone = digits.length === 10 ? `91${digits}` : digits;
  const booking = {
    name: String(input.name || '').trim(),
    phone,
    address: String(input.address || '').trim(),
    carNo: String(input.carNo || '').trim().toUpperCase(),
    make: String(input.make || '').trim(),
    carModel: String(input.carModel || '').trim().toUpperCase(),
    vehicleClass: String(input.vehicleClass || '').trim(),
    // Column H "Package": the chosen package, else the car class (TeleCRM rows show "Hatchback" here).
    package: String(input.packageName || input.vehicleClass || '').trim(),
    regDate: '',
    area: String(input.area || '').trim(),
    agent: String(input.agent || '').trim(),
    visitType: input.pickupRequired ? 'Pickup' : 'Visit',
    remark: String(input.remark || '').trim(),
    customerRemark: String(input.customerRemark || '').trim(),
    workshop: String(input.workshop || '').trim(),
    packageName: String(input.packageName || '').trim(),
    packageAmount: input.packageAmount == null ? '' : String(input.packageAmount),
    leadNumber: String(input.leadNumber || '').trim(),
    pincode: String(input.pincode || '').trim(),
    city: String(input.city || '').trim(),
    sentAt: istDateTime(),
  };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ secret, booking }),
      redirect: 'follow',
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) {
      return { ok: false, error: json?.error || `Sheet webhook ${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Sheet webhook failed' };
  }
}

function normHeader(value: string) {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}

function findHeader(headers: string[], match: (header: string) => boolean) {
  return headers.findIndex((h) => match(normHeader(h)));
}

function buildRow(headers: string[], input: BookingWonSheetInput): string[] {
  const width = Math.max(headers.length, 1);
  const row = Array.from({ length: width }, () => '');
  const put = (idx: number, value: string | number | null | undefined) => {
    if (idx < 0) return;
    row[idx] = String(value ?? '').trim();
  };
  const amount =
    input.packageAmount == null || input.packageAmount === ''
      ? ''
      : String(input.packageAmount);

  put(
    findHeader(headers, (h) => h === 'name' || h === 'customer name' || (h.includes('name') && !h.includes('package'))),
    input.name,
  );
  put(findHeader(headers, (h) => h === 'number' || h.includes('phone') || h.includes('mobile')), input.phone);
  put(findHeader(headers, (h) => h === 'address' || h.includes('address')), input.address);
  put(findHeader(headers, (h) => h.includes('car no') || h.includes('vehicle no')), input.carNo);
  put(findHeader(headers, (h) => h === 'make' || h === 'car make'), input.make);
  put(findHeader(headers, (h) => h.includes('model')), input.carModel);
  put(findHeader(headers, (h) => h === 'package'), input.packageName);
  put(findHeader(headers, (h) => h.includes('workshop')), input.workshop);
  put(findHeader(headers, (h) => h === 'agent' || h.includes('telecaller')), input.agent);
  put(
    findHeader(headers, (h) => h.includes('remark') && h.includes('service')),
    input.remark,
  );
  put(findHeader(headers, (h) => h.includes('lead send') && h.includes('date')), istDate());
  put(
    findHeader(headers, (h) => h.includes('customer') && h.includes('remark')),
    input.customerRemark,
  );
  put(findHeader(headers, (h) => h.includes('service status')), 'Booking confirmed');
  put(
    findHeader(headers, (h) => h.includes('final') && h.includes('package') && h.includes('name')),
    input.packageName,
  );
  put(
    findHeader(headers, (h) => h.includes('final') && h.includes('amount')),
    amount,
  );
  return row;
}

/**
 * The sheet webhook is handled by Settings → API Templates when a template there (ON or OFF)
 * posts to BOOKING_SHEET_WEBHOOK_URL for this status; the hardcoded sender below then stands down.
 * OFF in the panel therefore really stops the sheet; deleting the template brings this back.
 */
export async function sheetHandledByApiTemplate(db: any, trigger: 'BOOKING_CONFIRMED' | 'IN_SERVICE') {
  const url = String(process.env.BOOKING_SHEET_WEBHOOK_URL || '').trim();
  if (!url) return false;
  const { hasApiTemplate } = await import('@/lib/crm/apiTemplates');
  return hasApiTemplate(db, trigger, url);
}

export async function appendBookingConfirmedToSheet(
  input: BookingWonSheetInput,
): Promise<{ ok: boolean; error?: string }> {
  // Preferred: Apps Script webhook in the sheet ("Today send lead" tab).
  const webhookUrl = String(process.env.BOOKING_SHEET_WEBHOOK_URL || '').trim();
  if (webhookUrl) {
    return postBookingToSheetWebhook(
      webhookUrl,
      String(process.env.BOOKING_SHEET_WEBHOOK_SECRET || '').trim(),
      input,
    );
  }
  const creds = loadCreds();
  if (!creds) return { ok: false, error: 'Google service account missing' };
  try {
    const token = await accessToken(creds);
    const headerRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(`${SHEET_TAB}!1:1`)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    const headerJson = await headerRes.json().catch(() => ({}));
    if (!headerRes.ok) {
      const msg = headerJson?.error?.message || `Sheet read ${headerRes.status}`;
      return { ok: false, error: msg };
    }
    const headers = ((headerJson.values?.[0] || []) as unknown[]).map((c) => String(c || ''));
    const row = buildRow(headers, input);
    const appendRes = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(`${SHEET_TAB}!A:AZ`)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ values: [row] }),
      },
    );
    const appendJson = await appendRes.json().catch(() => ({}));
    if (!appendRes.ok) {
      return { ok: false, error: appendJson?.error?.message || `Sheet append ${appendRes.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Sheet append failed' };
  }
}

export async function bookingWonSheetReadable(): Promise<{ ok: boolean; error?: string }> {
  const creds = loadCreds();
  if (!creds) return { ok: false, error: 'Google service account missing' };
  try {
    const token = await accessToken(creds);
    const res = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${SPREADSHEET_ID}/values/${encodeURIComponent(`${SHEET_TAB}!A1`)}`,
      { headers: { Authorization: `Bearer ${token}` } },
    );
    if (!res.ok) {
      const json = await res.json().catch(() => ({}));
      return { ok: false, error: json?.error?.message || `Sheet read ${res.status}` };
    }
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Sheet unreachable' };
  }
}

/**
 * Lead moved to In Service → move its line from "Today send lead" to the "Today" tab
 * (Apps Script action "in_service", matched by phone). Not found on the sheet is fine.
 */
export async function moveBookingToInServiceSheet(input: {
  phone?: string | null;
  name?: string | null;
}): Promise<{ ok: boolean; moved?: boolean; error?: string }> {
  const url = String(process.env.BOOKING_SHEET_WEBHOOK_URL || '').trim();
  if (!url) return { ok: false, error: 'BOOKING_SHEET_WEBHOOK_URL not set' };
  const digits = String(input.phone || '').replace(/\D/g, '');
  if (digits.length < 10) return { ok: false, error: 'phone missing' };
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        secret: String(process.env.BOOKING_SHEET_WEBHOOK_SECRET || '').trim(),
        action: 'in_service',
        // No name on purpose: an older script without the in_service action then rejects this
        // ("name and phone required") instead of appending it as a new booking line.
        booking: { phone: digits },
      }),
      redirect: 'follow',
    });
    const json = (await res.json().catch(() => null)) as { ok?: boolean; moved?: boolean; error?: string } | null;
    if (!res.ok || !json?.ok) return { ok: false, error: json?.error || `Sheet webhook ${res.status}` };
    return { ok: true, moved: Boolean(json.moved) };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'Sheet webhook failed' };
  }
}
