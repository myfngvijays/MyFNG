import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  listAutomationSettings,
  sendAutomationWhatsApp,
  type WhatsAppAutomationTriggerKey,
  WHATSAPP_AUTOMATION_TRIGGER_KEYS,
  isWhatsAppAutomationCronMasterEnabled,
  setWhatsAppAutomationCronMasterEnabled,
} from '@/lib/services/whatsappAutomation';
import {
  createAutomationTemplateFromSetting,
  getAutomationTemplateExamples,
  getAutomationTemplateStatus,
  setAutomationTriggerEnabled,
  setAutomationTriggerCronEnabled,
  syncAutomationTemplateFromSetting,
} from '@/lib/services/whatsappAutomationMeta';
import { buildBookingConfirmedTemplateParams } from '@/lib/services/bookingConfirmedWhatsApp';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function assertSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) return { ok: false as const, status: 403, error: 'Forbidden' };

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userProfile: userData };
}

function parseTriggerKey(value: unknown): WhatsAppAutomationTriggerKey | null {
  const key = String(value || '').trim() as WhatsAppAutomationTriggerKey;
  return WHATSAPP_AUTOMATION_TRIGGER_KEYS.includes(key) ? key : null;
}

export async function GET() {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const settings = await listAutomationSettings();
    const cronMasterEnabled = await isWhatsAppAutomationCronMasterEnabled();
    const triggers = await Promise.all(
      settings.map(async (setting) => ({
        ...setting,
        templateStatus: await getAutomationTemplateStatus(setting.trigger_key as WhatsAppAutomationTriggerKey),
        exampleValues: await getAutomationTemplateExamples(setting.trigger_key as WhatsAppAutomationTriggerKey),
      }))
    );

    return NextResponse.json({ success: true, cronMasterEnabled, triggers });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();
    const triggerKey = parseTriggerKey(body?.triggerKey);

    if (action === 'toggle-cron-master') {
      const result = await setWhatsAppAutomationCronMasterEnabled(
        Boolean(body?.cronMasterEnabled),
        auth.userProfile.id,
      );
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 500 });
      }
      return NextResponse.json({ success: true, cronMasterEnabled: result.enabled });
    }

    if (!triggerKey) {
      return NextResponse.json({ error: 'Valid triggerKey is required' }, { status: 400 });
    }

    if (action === 'create-template') {
      const result = await createAutomationTemplateFromSetting(triggerKey, auth.userProfile.id);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'sync-template') {
      const result = await syncAutomationTemplateFromSetting(triggerKey, auth.userProfile.id);
      return NextResponse.json({ success: true, ...result });
    }

    if (action === 'toggle-enabled') {
      const result = await setAutomationTriggerEnabled(triggerKey, Boolean(body?.isEnabled));
      return NextResponse.json({ success: true, trigger: result });
    }

    if (action === 'toggle-cron-enabled') {
      const result = await setAutomationTriggerCronEnabled(triggerKey, Boolean(body?.cronEnabled));
      return NextResponse.json({ success: true, trigger: result });
    }

    if (action === 'test-send') {
      const phone = String(body?.phone || '').trim();
      if (!phone) {
        return NextResponse.json({ error: 'phone is required for test-send' }, { status: 400 });
      }

      // Refresh Meta status first so APPROVED templates aren't blocked by draft is_active=false.
      try {
        await syncAutomationTemplateFromSetting(triggerKey, auth.userProfile.id);
      } catch {
        /* send path still reports a clear error if template isn't ready */
      }

      const templateParams =
        Array.isArray(body?.templateParams) && body.templateParams.length > 0
          ? body.templateParams.map((value: unknown) => String(value ?? '').trim())
          : triggerKey === 'booking_confirmed' || triggerKey === 'booking_updated'
            ? buildBookingConfirmedTemplateParams({
                customer_name: 'Test Customer',
                lead_number: 'L-TEST1234',
                vehicle_make: 'Honda',
                vehicle_model: 'City',
                service_type: triggerKey === 'booking_updated' ? 'General Service' : 'Periodic Service',
                preferred_slot_start: new Date().toISOString(),
              })
            : await getAutomationTemplateExamples(triggerKey);

      const result = await sendAutomationWhatsApp({
        triggerKey,
        phone,
        templateParams,
        payload: { source: 'admin_test_send' },
        skipEnabledCheck: Boolean(body?.skipEnabledCheck),
        skipCooldownCheck: true,
        skipTemplateApprovalCheck: Boolean(body?.skipTemplateApprovalCheck),
      });

      return NextResponse.json({ success: result.sent, result });
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
