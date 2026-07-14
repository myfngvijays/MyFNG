import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';
import { checkWhatsAppAgentsCredentials } from '@/lib/whatsappAgents/shared/agentsHealthCheck';
import {
  buildWhatsAppAgentsBootstrapPayload,
  saveWhatsAppAgentsEnvConfig,
} from '@/lib/whatsappAgents/shared/envConfigStore';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/super_admin/whatsapp-agents/env-settings/bootstrap
 * One-click setup: fill whatsapp_agents_env_config from server .env.
 */
export async function POST() {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const roleCode = (auth.userProfile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '';
    if (roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Only Super Admin can bootstrap agent credentials' }, { status: 403 });
    }

    const payload = buildWhatsAppAgentsBootstrapPayload();
    if (!payload.openai_api_key.trim() || !payload.whatsapp_access_token.trim() || !payload.whatsapp_phone_number_id.trim()) {
      return NextResponse.json(
        {
          error:
            'Server env missing OPENAI_API_KEY, WHATSAPP_ACCESS_TOKEN, or WHATSAPP_PHONE_NUMBER_ID. Add them to .env.local (local) or VPS env (production), then retry.',
        },
        { status: 400 },
      );
    }

    const userId = (auth.userProfile as { id?: string } | null)?.id || '';
    const result = await saveWhatsAppAgentsEnvConfig(payload, userId);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 500 });
    }

    const health = await checkWhatsAppAgentsCredentials();

    return NextResponse.json({
      success: true,
      message: health.ok
        ? 'Agent credentials configured. Test Connection should show all green.'
        : 'Settings saved, but some health checks failed — see health details.',
      health,
      configured: {
        credentials_source: 'database',
        use_db_credentials: true,
        whatsapp_phone_number_id: payload.whatsapp_phone_number_id,
        whatsapp_api_url: payload.whatsapp_api_url,
        cron_configured: Boolean(payload.cron_secret.trim()),
        telecrm_configured: Boolean(payload.telecrm_webhook_secret.trim()),
      },
      manual_steps: [
        'SUPABASE_SERVICE_ROLE_KEY server .env mein hi rehta hai — yahan save nahi hota (security).',
        'TeleCRM webhook URL: /api/webhooks/telecrm with header x-webhook-secret.',
        'Cron jobs use CRON_SECRET in Authorization: Bearer header.',
      ],
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: 'Internal server error', details: msg }, { status: 500 });
  }
}
