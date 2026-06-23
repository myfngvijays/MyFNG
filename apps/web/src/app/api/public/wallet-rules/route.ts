import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { getWalletConfig, getWalletLogicSettings, parseWalletPlatform, walletRulesToPublicPayload } from '@/lib/wallet-config';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const platform = parseWalletPlatform(
      request.headers.get('x-app-platform') || request.headers.get('X-App-Platform'),
    );
    const { supabaseAdmin } = getSupabaseAdmin();
    const [config, settings] = await Promise.all([
      getWalletConfig(supabaseAdmin, platform),
      getWalletLogicSettings(supabaseAdmin),
    ]);
    return NextResponse.json({
      ...walletRulesToPublicPayload(config, settings),
      platform,
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}
