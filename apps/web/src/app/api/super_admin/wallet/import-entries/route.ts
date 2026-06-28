import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import {
  assertWalletAdmin,
  extractWalletEntriesFromTabularText,
  parseWalletEntriesFromPlainText,
  type WalletBulkEntry,
} from '@/lib/wallet/walletBulkAdmin';
import { WALLET_BULK_MAX_ENTRIES, walletBulkLimitError } from '@/lib/wallet/walletBulkConstants';
import { googleSheetToCsvExportUrl } from '@/lib/google-sheet-url';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function extractWalletEntriesFromWorkbook(buffer: ArrayBuffer): WalletBulkEntry[] {
  const workbook = XLSX.read(buffer, { type: 'array' });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) return [];

  const sheet = workbook.Sheets[sheetName];
  const csv = XLSX.utils.sheet_to_csv(sheet);
  return extractWalletEntriesFromTabularText(csv);
}

export async function POST(request: NextRequest) {
  try {
    const auth = await assertWalletAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      const file = form.get('file');
      if (!(file instanceof File)) {
        return NextResponse.json({ error: 'file is required' }, { status: 400 });
      }

      const name = String(file.name || '').toLowerCase();
      const buffer = await file.arrayBuffer();
      let entries: WalletBulkEntry[] = [];

      if (name.endsWith('.xls') || name.endsWith('.xlsx')) {
        entries = extractWalletEntriesFromWorkbook(buffer);
      } else {
        const text = new TextDecoder().decode(buffer);
        entries =
          text.includes('phone') || text.includes('mobile') || text.includes('amount')
            ? extractWalletEntriesFromTabularText(text)
            : parseWalletEntriesFromPlainText(text);
      }

      if (!entries.length) {
        return NextResponse.json(
          { error: 'No valid phone + amount rows found. Use columns: phone, amount' },
          { status: 400 },
        );
      }

      if (entries.length > WALLET_BULK_MAX_ENTRIES) {
        return NextResponse.json({ error: walletBulkLimitError(entries.length) }, { status: 400 });
      }

      return NextResponse.json({
        success: true,
        source: 'file',
        file_name: file.name,
        count: entries.length,
        entries,
        entries_text: entries.map((e) => `${e.phone},${e.amount}`).join('\n'),
      });
    }

    const body = await request.json().catch(() => ({}));
    const googleSheetUrl = String(body?.google_sheet_url || body?.sheet_url || '').trim();
    const entriesText = String(body?.entries_text || body?.phones_text || '').trim();

    if (googleSheetUrl) {
      const exportUrl = googleSheetToCsvExportUrl(googleSheetUrl);
      if (!exportUrl) return NextResponse.json({ error: 'Invalid Google Sheet URL.' }, { status: 400 });
      const res = await fetch(exportUrl, {
        redirect: 'follow',
        headers: { 'User-Agent': 'MyFNG-Wallet-Import/1.0' },
        cache: 'no-store',
      });
      if (!res.ok) {
        return NextResponse.json({ error: 'Could not fetch Google Sheet.' }, { status: 400 });
      }
      const text = await res.text();
      const entries = extractWalletEntriesFromTabularText(text);
      if (!entries.length) {
        return NextResponse.json(
          { error: 'Sheet must have phone + amount columns (e.g. mobile, amount).' },
          { status: 400 },
        );
      }
      if (entries.length > WALLET_BULK_MAX_ENTRIES) {
        return NextResponse.json({ error: walletBulkLimitError(entries.length) }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        source: 'google_sheet',
        count: entries.length,
        entries,
        entries_text: entries.map((e) => `${e.phone},${e.amount}`).join('\n'),
      });
    }

    if (entriesText) {
      const entries = parseWalletEntriesFromPlainText(entriesText);
      if (!entries.length) {
        return NextResponse.json(
          { error: 'Use format: phone,amount per line (e.g. 8652710389,500)' },
          { status: 400 },
        );
      }
      if (entries.length > WALLET_BULK_MAX_ENTRIES) {
        return NextResponse.json({ error: walletBulkLimitError(entries.length) }, { status: 400 });
      }
      return NextResponse.json({
        success: true,
        source: 'text',
        count: entries.length,
        entries,
      });
    }

    return NextResponse.json(
      { error: 'Provide google_sheet_url, entries_text, or upload a file.' },
      { status: 400 },
    );
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
