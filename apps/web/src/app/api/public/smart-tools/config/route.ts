import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  DEFAULT_SMART_TOOLS_HANDLER,
  getSmartToolsHandlerConfig,
  normalizeSmartToolsHandlerConfig,
} from '@/lib/smart-tools-config';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const NO_STORE_HEADERS = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
};

export async function GET() {
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json(
        { success: true, config: DEFAULT_SMART_TOOLS_HANDLER },
        { headers: NO_STORE_HEADERS },
      );
    }

    const config = await getSmartToolsHandlerConfig(supabaseAdmin);
    return NextResponse.json({ success: true, config }, { headers: NO_STORE_HEADERS });
  } catch {
    return NextResponse.json(
      { success: true, config: DEFAULT_SMART_TOOLS_HANDLER },
      { headers: NO_STORE_HEADERS },
    );
  }
}
