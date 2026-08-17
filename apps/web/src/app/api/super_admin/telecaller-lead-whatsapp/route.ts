import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  TELECALLER_NEW_LEAD_TEMPLATE,
  buildTelecallerNewLeadTemplateParams,
  createTelecallerNewLeadTemplate,
  getTelecallerNewLeadTemplateStatus,
  getTelecallerNewLeadWhatsAppSettings,
  saveTelecallerNewLeadWhatsAppSettings,
  sendTelecallerNewLeadTemplateMessage,
  syncTelecallerNewLeadTemplate,
} from '@/lib/services/telecallerNewLeadWhatsApp';

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

  const roleCode = (userData as { roles?: { role_code?: string } }).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN', 'LEAD_MANAGER'].includes(String(roleCode || ''))) {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: String((userData as { id?: string }).id || user.id) };
}

export async function GET() {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const [settings, templateStatus] = await Promise.all([
      getTelecallerNewLeadWhatsAppSettings(),
      getTelecallerNewLeadTemplateStatus(),
    ]);

    return NextResponse.json({
      success: true,
      settings,
      template_status: templateStatus,
      template_preview: TELECALLER_NEW_LEAD_TEMPLATE,
    });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const settings = await saveTelecallerNewLeadWhatsAppSettings({
      enabled: body.enabled !== undefined ? Boolean(body.enabled) : undefined,
    });

    return NextResponse.json({ success: true, settings });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await assertSuperAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json();
    const action = String(body.action || '');

    if (action === 'create-template') {
      const result = await createTelecallerNewLeadTemplate(auth.userId);
      const templateStatus = await getTelecallerNewLeadTemplateStatus();
      return NextResponse.json({ success: true, ...result, template_status: templateStatus });
    }

    if (action === 'sync-template') {
      const result = await syncTelecallerNewLeadTemplate(auth.userId);
      const templateStatus = await getTelecallerNewLeadTemplateStatus();
      return NextResponse.json({ success: true, ...result, template_status: templateStatus });
    }

    if (action === 'test-send') {
      const telecallerId = String(body.telecaller_id || '').trim();
      const phoneOverride = String(body.phone || '').replace(/\D/g, '').trim();

      let phone = phoneOverride;
      let telecallerName = 'Telecaller';

      if (telecallerId) {
        const { supabaseAdmin } = getSupabaseAdmin();
        if (!supabaseAdmin) {
          return NextResponse.json({ success: false, error: 'Admin client unavailable' }, { status: 500 });
        }
        const { data: telecaller } = await supabaseAdmin
          .from('users_login')
          .select('id, full_name, phone')
          .eq('id', telecallerId)
          .maybeSingle();
        if (!telecaller) {
          return NextResponse.json({ success: false, error: 'Telecaller not found' }, { status: 404 });
        }
        // Custom phone wins; otherwise use profile phone
        phone = phoneOverride || String(telecaller.phone || '').replace(/\D/g, '').trim();
        telecallerName = String(telecaller.full_name || 'Telecaller').trim() || 'Telecaller';
      }

      if (!phone) {
        return NextResponse.json(
          { success: false, error: 'Enter a phone number or select a telecaller with phone set' },
          { status: 400 },
        );
      }

      const params = buildTelecallerNewLeadTemplateParams({
        telecallerName,
        leadNumber: 'TEST-LEAD',
        customerName: 'Test Customer',
        customerPhone: '9999999999',
      });

      const result = await sendTelecallerNewLeadTemplateMessage(phone, params);
      return NextResponse.json({
        success: result.success,
        message: result.success
          ? `Test WhatsApp sent to ${phone}`
          : result.error || 'Test send failed',
        messageId: result.messageId,
        error: result.error,
      });
    }

    if (action === 'update-telecaller-phone') {
      const telecallerId = String(body.telecaller_id || '').trim();
      const phone = String(body.phone || '').replace(/\D/g, '').trim();
      if (!telecallerId) {
        return NextResponse.json({ success: false, error: 'telecaller_id required' }, { status: 400 });
      }
      if (!phone || phone.length < 10) {
        return NextResponse.json(
          { success: false, error: 'Valid phone required (at least 10 digits)' },
          { status: 400 },
        );
      }

      const { supabaseAdmin } = getSupabaseAdmin();
      if (!supabaseAdmin) {
        return NextResponse.json({ success: false, error: 'Admin client unavailable' }, { status: 500 });
      }

      const { data: telecaller, error: findErr } = await supabaseAdmin
        .from('users_login')
        .select('id, full_name, roles!role_id(role_code)')
        .eq('id', telecallerId)
        .maybeSingle();

      if (findErr || !telecaller) {
        return NextResponse.json({ success: false, error: 'Telecaller not found' }, { status: 404 });
      }

      const roleRaw = (telecaller as { roles?: { role_code?: string } | null }).roles;
      const roleCode = String(roleRaw?.role_code || '').toUpperCase();
      if (roleCode && roleCode !== 'TELECALLER') {
        return NextResponse.json(
          { success: false, error: 'User is not a TELECALLER' },
          { status: 400 },
        );
      }

      const { error: updateErr } = await supabaseAdmin
        .from('users_login')
        .update({ phone })
        .eq('id', telecallerId);

      if (updateErr) {
        return NextResponse.json(
          { success: false, error: updateErr.message || 'Failed to update phone' },
          { status: 500 },
        );
      }

      const name = String((telecaller as { full_name?: string }).full_name || 'Telecaller').trim();
      return NextResponse.json({
        success: true,
        message: `Saved ${phone} for ${name}`,
        telecaller_id: telecallerId,
        phone,
      });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    );
  }
}
