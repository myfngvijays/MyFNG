import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import {
  CLAUDE_CONNECTORS_URL,
  MCP_PUBLIC_ORIGIN,
  mcpTokenStatus,
} from '@/lib/mcp/httpAuth';
import {
  getMetaAdsSettings,
  metaAdsSettingsStatus,
  saveMetaAdsSettings,
} from '@/lib/meta-ads/settings';
import {
  META_ADS_AREAS,
  META_ADS_MCP_META,
  META_ADS_TOOLS,
  getSpendSummary,
  listCampaigns,
  listPages,
  listPixels,
  getFundsTracker,
  runMetaAdsTool,
  testMetaAdsConnection,
} from '@/lib/meta-ads/tools';
import { answerMetaAdsChat } from '@/lib/meta-ads/chat';
import { generateMetaAdsReport } from '@/lib/meta-ads/report';
import { getMetaAdsPlaybook, saveMetaAdsPlaybook } from '@/lib/meta-ads/playbook';

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
    const productionUrl = `${MCP_PUBLIC_ORIGIN}/api/mcp/meta-ads`;
    const thisHostUrl = `${origin}/api/mcp/meta-ads`;
    const [settings, mcpToken, playbook] = await Promise.all([
      metaAdsSettingsStatus(),
      mcpTokenStatus(),
      getMetaAdsPlaybook(),
    ]);
    const byArea = Object.fromEntries(
      META_ADS_AREAS.map((area) => [area, META_ADS_TOOLS.filter((t) => t.area === area)]),
    );

    return NextResponse.json({
      ok: true,
      meta: META_ADS_MCP_META,
      status: settings.ready ? 'ready' : settings.has_token ? 'needs_account' : 'needs_token',
      settings,
      claude: {
        connectors_url: CLAUDE_CONNECTORS_URL,
        connector_url: productionUrl,
        this_host_url: thisHostUrl,
        localhost_blocked: /localhost|127\.0\.0\.1/i.test(origin),
        header_name: 'authorization',
        header_value_prefix: 'Bearer ',
        ...mcpToken,
      },
      tool_count: META_ADS_TOOLS.length,
      tools: META_ADS_TOOLS,
      by_area: byArea,
      setup_steps: [
        'Meta Business Suite → Users → System Users → Myfng-adsreader',
        'Assign assets: Ad account (View) + Pages you run ads on (View) + Pixel / Dataset (View)',
        'Generate token with ads_read, pages_show_list, pages_read_engagement',
        'Paste token + act_ account ID here, then Test connection',
      ],
      playbook,
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

    if (action === 'save_settings') {
      const saved = await saveMetaAdsSettings(
        {
          accessToken: body?.access_token,
          accountId: body?.account_id,
          appId: body?.app_id,
        },
        gate.userId,
      );
      return NextResponse.json({
        success: true,
        settings: await metaAdsSettingsStatus(),
        note: saved.accessToken ? 'Credentials saved. Token will not be shown again.' : 'Account saved.',
      });
    }

    if (action === 'save_playbook') {
      const playbook = await saveMetaAdsPlaybook(body?.playbook && typeof body.playbook === 'object' ? body.playbook : {}, gate.userId);
      return NextResponse.json({ success: true, playbook });
    }

    if (action === 'test_connection') {
      const result = await testMetaAdsConnection();
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'overview') {
      const result = await getSpendSummary(body?.account_id);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'list_campaigns') {
      const result = await listCampaigns({
        account_id: body?.account_id,
        status: body?.status,
        limit: body?.limit,
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'list_pages') {
      const result = await listPages({ limit: body?.limit });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'list_pixels') {
      const result = await listPixels({ account_id: body?.account_id });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'funds') {
      const result = await getFundsTracker(body?.account_id);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'chat') {
      const settings = await getMetaAdsSettings();
      if (!settings.accessToken) {
        return NextResponse.json({ error: 'Connect a Meta access token first' }, { status: 400 });
      }
      const result = await answerMetaAdsChat({
        message: body?.message,
        history: Array.isArray(body?.history) ? body.history : [],
      });
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'generate_report') {
      const settings = await getMetaAdsSettings();
      if (!settings.accessToken) {
        return NextResponse.json({ error: 'Connect a Meta access token first' }, { status: 400 });
      }
      const periodRaw = String(body?.period || 'briefing');
      const period =
        periodRaw === 'today' || periodRaw === 'last_7d' || periodRaw === 'last_30d' ? periodRaw : 'briefing';
      const report = await generateMetaAdsReport(period);
      return NextResponse.json({ success: true, report });
    }

    if (action === 'transcribe') {
      const apiKey = String(process.env.OPENAI_API_KEY || '').trim();
      if (!apiKey) {
        return NextResponse.json({ error: 'Voice transcribe ke liye OPENAI_API_KEY chahiye' }, { status: 503 });
      }
      const b64 = String(body?.audio_base64 || '').replace(/^data:[^;]+;base64,/, '');
      if (!b64) return NextResponse.json({ error: 'Audio missing' }, { status: 400 });
      const rawMime = String(body?.mime || 'audio/webm').toLowerCase();
      const bin = Buffer.from(b64, 'base64');
      if (!bin.length) return NextResponse.json({ error: 'Empty audio' }, { status: 400 });

      let mime = 'audio/webm';
      let filename = 'ask.webm';
      if (rawMime.includes('wav')) {
        mime = 'audio/wav';
        filename = 'ask.wav';
      } else if (rawMime.includes('mp4') || rawMime.includes('m4a')) {
        mime = 'audio/mp4';
        filename = 'ask.m4a';
      } else if (rawMime.includes('mpeg') || rawMime.includes('mp3')) {
        mime = 'audio/mpeg';
        filename = 'ask.mp3';
      } else if (rawMime.includes('ogg') || rawMime.includes('oga')) {
        mime = 'audio/ogg';
        filename = 'ask.ogg';
      }

      const transcribeOnce = async (model: string) => {
        const form = new FormData();
        form.append('model', model);
        form.append('file', new Blob([new Uint8Array(bin)], { type: mime }), filename);
        return fetch('https://api.openai.com/v1/audio/transcriptions', {
          method: 'POST',
          headers: { Authorization: `Bearer ${apiKey}` },
          body: form,
        });
      };

      // Browser MediaRecorder is webm/opus — whisper-1 accepts it; gpt-4o-mini-transcribe often does not.
      let res = await transcribeOnce('whisper-1');
      if (!res.ok) {
        res = await transcribeOnce(process.env.OPENAI_TRANSCRIBE_MODEL || 'gpt-4o-mini-transcribe');
      }
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        return NextResponse.json({ error: `Transcription failed (${res.status}) ${txt.slice(0, 120)}` }, { status: 502 });
      }
      const json = await res.json().catch(() => ({}));
      const text = String(json?.text || '').replace(/\s+/g, ' ').trim();
      return NextResponse.json({ success: true, text });
    }

    if (action === 'run_tool') {
      const name = String(body?.name || '').trim();
      if (!name) return NextResponse.json({ error: 'Tool name required' }, { status: 400 });
      const settings = await getMetaAdsSettings();
      if (!settings.accessToken) {
        return NextResponse.json({ error: 'Connect a Meta access token first' }, { status: 400 });
      }
      const result = await runMetaAdsTool(name, body?.params && typeof body.params === 'object' ? body.params : {});
      return NextResponse.json({ success: true, tool: name, result });
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}
