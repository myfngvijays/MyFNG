import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { requireCompetitorIntelAccess } from '@/lib/super-admin-auth';
import { crawlCompetitor, requestStopCrawl } from '@/lib/competitor-intel/crawl';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 180;

async function readBody(request: NextRequest) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

export async function POST(request: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const supabase = await createClient();
    const auth = await requireCompetitorIntelAccess(supabase);
    if (!auth.ok) return auth.res;

    const { id } = await context.params;
    const body = await readBody(request);
    if (body?.action === 'stop') {
      const result = await requestStopCrawl(id);
      return NextResponse.json(result, { status: result.ok ? 200 : result.missing ? 503 : 400 });
    }

    const onlyUrl = String(body?.url || body?.only_url || '').trim() || undefined;
    const result = await crawlCompetitor(id, onlyUrl ? { onlyUrl } : {});
    return NextResponse.json(result, {
      status: result.success ? 200 : result.missing ? 503 : 400,
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Scan failed' }, { status: 500 });
  }
}
