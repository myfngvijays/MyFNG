import { NextRequest, NextResponse } from 'next/server';
import { assertPushAdmin } from '@/lib/push/admin-auth';

export const dynamic = 'force-dynamic';

function extractSheetId(url: string): string | null {
  const match = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return match?.[1] || null;
}

function extractGid(url: string): string {
  const match = url.match(/[#&?]gid=(\d+)/);
  return match?.[1] || '0';
}

export async function POST(req: NextRequest) {
  const auth = await assertPushAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await req.json();
  const url = String(body?.url || '').trim();

  if (!url) {
    return NextResponse.json({ error: 'URL is required' }, { status: 400 });
  }

  const sheetId = extractSheetId(url);
  if (!sheetId) {
    return NextResponse.json({ error: 'Invalid Google Sheet URL. Paste the full URL from browser.' }, { status: 400 });
  }

  const gid = extractGid(url);
  const csvUrl = `https://docs.google.com/spreadsheets/d/${sheetId}/export?format=csv&gid=${gid}`;

  try {
    const res = await fetch(csvUrl, { signal: AbortSignal.timeout(15000) });
    if (!res.ok) {
      if (res.status === 404) {
        return NextResponse.json({ error: 'Sheet not found. Check the URL.' }, { status: 400 });
      }
      return NextResponse.json(
        { error: 'Cannot access sheet. Make sure sharing is set to "Anyone with the link can view".' },
        { status: 400 },
      );
    }

    const csv = await res.text();
    const phones: string[] = [];

    for (const line of csv.split(/[\n\r]+/)) {
      for (const cell of line.split(/[,\t]+/)) {
        const cleaned = cell.replace(/["' ]/g, '').replace(/[^0-9]/g, '');
        const last10 = cleaned.slice(-10);
        if (last10.length === 10 && /^[6-9]/.test(last10)) {
          phones.push(last10);
        }
      }
    }

    const unique = [...new Set(phones)];
    return NextResponse.json({ phones: unique, total: unique.length });
  } catch (err: any) {
    if (err?.name === 'TimeoutError' || err?.name === 'AbortError') {
      return NextResponse.json({ error: 'Request timed out. Try again or use CSV upload.' }, { status: 408 });
    }
    return NextResponse.json({ error: 'Failed to fetch sheet. Check the URL and sharing settings.' }, { status: 500 });
  }
}
