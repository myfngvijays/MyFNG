import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { createClientFromRequest } from '@/lib/supabase/server';
import { googleSheetToCsvExportUrl } from '@/lib/google-sheet-url';
import { extractPhonesFromPlainText, extractPhonesFromTabularText, normalizeIndianPhone } from '@/lib/phone-list-parser';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

function extractPhonesFromWorkbook(buffer: ArrayBuffer): string[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<(string | number | null)[]>(sheet, {
    header: 1,
    raw: false,
    defval: '',
  });
  if (!rows.length) return [];

  const header = (rows[0] || []).map((cell) => String(cell ?? '').trim().toLowerCase());
  const phoneColIdx = header.findIndex((cell) =>
    /^(phone|mobile|contact|customer_phone|customer mobile|whatsapp|number)$/.test(cell) ||
    /\b(phone|mobile|contact)\b/.test(cell),
  );

  const dataRows = phoneColIdx >= 0 && rows.length > 1 ? rows.slice(1) : rows;
  const phones: string[] = [];

  for (const row of dataRows) {
    if (!Array.isArray(row)) continue;
    if (phoneColIdx >= 0) {
      const phone = normalizeIndianPhone(row[phoneColIdx]);
      if (phone) phones.push(phone);
      continue;
    }
    for (const cell of row) {
      const phone = normalizeIndianPhone(cell);
      if (phone) phones.push(phone);
    }
  }

  return [...new Set(phones)];
}

async function fetchGoogleSheetPhones(url: string) {
  const exportUrl = googleSheetToCsvExportUrl(url);
  if (!exportUrl) {
    return { ok: false as const, error: 'Invalid Google Sheet URL.' };
  }

  const res = await fetch(exportUrl, {
    redirect: 'follow',
    headers: { 'User-Agent': 'MyFNG-Coupon-Assign/1.0' },
    cache: 'no-store',
  });

  if (!res.ok) {
    return {
      ok: false as const,
      error:
        'Could not fetch Google Sheet. Share the sheet as "Anyone with the link → Viewer" or publish it to web, then paste the link again.',
    };
  }

  const text = await res.text();
  const phones = extractPhonesFromTabularText(text);
  if (!phones.length) {
    return { ok: false as const, error: 'No valid 10-digit mobile numbers found in the sheet.' };
  }

  return { ok: true as const, phones, source: 'google_sheet' as const };
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 });
      }

      const name = String(file.name || '').toLowerCase();
      const buffer = await file.arrayBuffer();
      let phones: string[] = [];

      if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
        phones = extractPhonesFromWorkbook(buffer);
      } else {
        const text = new TextDecoder().decode(buffer);
        phones = extractPhonesFromPlainText(text);
      }

      if (!phones.length) {
        return NextResponse.json({ error: 'No valid mobile numbers found in the uploaded file.' }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        source: 'file',
        file_name: file.name,
        count: phones.length,
        phones,
        phones_text: phones.join('\n'),
      });
    }

    const body = await request.json().catch(() => ({}));
    const googleSheetUrl = String(body?.google_sheet_url || body?.sheet_url || '').trim();
    const phonesText = String(body?.phones_text || '').trim();

    if (googleSheetUrl) {
      const fetched = await fetchGoogleSheetPhones(googleSheetUrl);
      if (!fetched.ok) return NextResponse.json({ error: fetched.error }, { status: 400 });
      return NextResponse.json({
        success: true,
        source: fetched.source,
        count: fetched.phones.length,
        phones: fetched.phones,
        phones_text: fetched.phones.join('\n'),
      });
    }

    if (phonesText) {
      const phones = extractPhonesFromPlainText(phonesText);
      if (!phones.length) {
        return NextResponse.json({ error: 'No valid mobile numbers found in the pasted text.' }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        source: 'text',
        count: phones.length,
        phones,
        phones_text: phones.join('\n'),
      });
    }

    return NextResponse.json(
      { error: 'Provide google_sheet_url, phones_text, or upload a file (CSV / TXT / XLS / XLSX).' },
      { status: 400 },
    );
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Import failed' }, { status: 500 });
  }
}
