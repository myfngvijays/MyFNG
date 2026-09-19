import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { CLAUDE_CONNECTORS_URL, MCP_PUBLIC_ORIGIN, mcpTokenStatus } from '@/lib/mcp/httpAuth';
import { googleAdsSettingsStatus, saveGoogleAdsSettings } from '@/lib/google-ads/settings';
import { getGoogleAdsPlaybook, saveGoogleAdsPlaybook } from '@/lib/google-ads/playbook';
import { answerGoogleAdsChat } from '@/lib/google-ads/chat';
import { generateGoogleAdsReport } from '@/lib/google-ads/report';
import {
  GOOGLE_ADS_MCP_META,
  GOOGLE_ADS_TOOLS,
  getSpendSummary,
  listAdGroups,
  listAds,
  getCampaignDetail,
  listCampaigns,
  listConversionActions,
  listKeywords,
  listSearchTerms,
  runGoogleAdsTool,
  testGoogleAdsConnection,
  type GoogleAdsListOpts,
} from '@/lib/google-ads/tools';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };
  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('id, role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();
  const roleCode = (userProfile?.role as { role_code?: string } | null)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }
  return { ok: true as const, userId: String((userProfile as { id?: string })?.id || user.id) };
}

function requestOrigin(request: NextRequest): string {
  const proto = request.headers.get('x-forwarded-proto') || 'https';
  const host = request.headers.get('x-forwarded-host') || request.headers.get('host') || '';
  if (host) return `${proto}://${host}`.replace(/\/$/, '');
  return MCP_PUBLIC_ORIGIN;
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const origin = requestOrigin(request);
    const settings = await googleAdsSettingsStatus();
    const [mcpToken, playbook] = await Promise.all([mcpTokenStatus(), getGoogleAdsPlaybook()]);
    return NextResponse.json({
      ok: true,
      meta: GOOGLE_ADS_MCP_META,
      status: settings.ready ? 'ready' : settings.has_refresh_token ? 'needs_account' : 'needs_oauth',
      settings,
      playbook,
      claude: {
        connectors_url: CLAUDE_CONNECTORS_URL,
        connector_url: `${MCP_PUBLIC_ORIGIN}/api/mcp/google-ads`,
        this_host_url: `${origin}/api/mcp/google-ads`,
        official_repo: 'https://github.com/googleads/google-ads-mcp',
        header_name: 'authorization',
        header_value_prefix: 'Bearer ',
        ...mcpToken,
      },
      oauth_url: `${origin}/api/super_admin/google-ads-mcp/oauth`,
      tool_count: GOOGLE_ADS_TOOLS.length,
      tools: GOOGLE_ADS_TOOLS,
      setup_steps: [
        'Google Cloud project gmb-api-for-myfng → enable Google Ads API',
        'Add OAuth redirect: this host + /api/super_admin/google-ads-mcp/oauth',
        'Connect with Google (Ads scope) so a refresh token is saved',
        'Test connection, then use Overview / Campaigns / Ads / Keywords',
      ],
      checked_at: new Date().toISOString(),
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    const listOpts = (body: any): GoogleAdsListOpts => ({
      customerId: body?.customer_id,
      during: body?.during,
      since: body?.since,
      until: body?.until,
      limit: Number(body?.limit || 40),
      q: body?.q,
      status: body?.status,
      channel: body?.channel,
      campaign_id: body?.campaign_id,
      min_spend: body?.min_spend,
      sort: body?.sort,
    });

    if (action === 'save_playbook') {
      const playbook = await saveGoogleAdsPlaybook(
        body?.playbook && typeof body.playbook === 'object' ? body.playbook : {},
        gate.userId,
      );
      return NextResponse.json({ success: true, playbook });
    }

    if (action === 'chat') {
      const result = await answerGoogleAdsChat({
        message: body?.message,
        history: Array.isArray(body?.history) ? body.history : [],
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'generate_report') {
      const report = await generateGoogleAdsReport(String(body?.period || 'last_7d'), {
        during: body?.during,
        since: body?.since,
        until: body?.until,
        campaign_id: body?.campaign_id,
      });
      return NextResponse.json({ success: true, report });
    }

    if (action === 'save_settings') {
      await saveGoogleAdsSettings(
        {
          developerToken: body?.developer_token,
          customerId: body?.customer_id,
          loginCustomerId: body?.login_customer_id,
          refreshToken: body?.refresh_token,
        },
        gate.userId,
      );
      return NextResponse.json({ success: true, settings: await googleAdsSettingsStatus() });
    }

    if (action === 'test_connection') {
      const result = await testGoogleAdsConnection();
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'overview') {
      return NextResponse.json({
        success: true,
        ...(await getSpendSummary(body?.customer_id, {
          during: body?.during,
          since: body?.since,
          until: body?.until,
        })),
      });
    }

    if (action === 'campaigns') {
      return NextResponse.json({ success: true, campaigns: await listCampaigns(listOpts(body)) });
    }

    if (action === 'campaign_detail') {
      return NextResponse.json({
        success: true,
        ...(await getCampaignDetail(String(body?.campaign_id || ''), listOpts(body))),
      });
    }

    if (action === 'ad_groups') {
      return NextResponse.json({ success: true, ad_groups: await listAdGroups(listOpts(body)) });
    }

    if (action === 'ads') {
      return NextResponse.json({ success: true, ads: await listAds(listOpts(body)) });
    }

    if (action === 'keywords') {
      return NextResponse.json({ success: true, keywords: await listKeywords(listOpts(body)) });
    }

    if (action === 'search_terms') {
      return NextResponse.json({ success: true, search_terms: await listSearchTerms(listOpts(body)) });
    }

    if (action === 'conversions') {
      return NextResponse.json({ success: true, ...(await listConversionActions(listOpts(body))) });
    }

    if (action === 'tool') {
      const name = String(body?.name || '');
      const result = await runGoogleAdsTool(name, body?.params && typeof body.params === 'object' ? body.params : {});
      return NextResponse.json({ success: true, result });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
