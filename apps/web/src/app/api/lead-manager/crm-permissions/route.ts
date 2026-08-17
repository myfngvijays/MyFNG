import { NextRequest, NextResponse } from 'next/server';
import {
  isNextResponse,
  requireCrmReportsContext,
} from '@/lib/telecaller/crmReportsAuth';
import {
  CRM_PERMISSION_LABELS,
  normalizeCrmPermissions,
  type CrmPermissionKey,
} from '@/lib/telecaller/crmPermissions';
import { crmSeesAllLeads } from '@/lib/telecaller/crmRoles';

export const dynamic = 'force-dynamic';

/**
 * Lead Manager / admin: list templates + telecaller assignments,
 * create/update templates, assign template to telecaller.
 */
export async function GET(request: NextRequest) {
  try {
    const ctx = await requireCrmReportsContext(request);
    if (isNextResponse(ctx)) return ctx;
    if (!crmSeesAllLeads(ctx.roleCode)) {
      return NextResponse.json({ error: 'Lead Manager only' }, { status: 403 });
    }

    const [templatesRes, usersRes] = await Promise.all([
      ctx.db
        .from('telecaller_permission_templates')
        .select('id, name, description, permissions, is_default, is_active, updated_at')
        .order('is_default', { ascending: false })
        .order('name'),
      ctx.db
        .from('users_login')
        .select(
          'id, full_name, phone, is_active, crm_permission_template_id, roles!role_id(role_code)',
        )
        .eq('is_active', true)
        .order('full_name')
        .limit(300),
    ]);

    if (templatesRes.error) throw templatesRes.error;
    if (usersRes.error) throw usersRes.error;

    const telecallers = (usersRes.data || [])
      .filter((u: any) => String(u?.roles?.role_code || '').toUpperCase() === 'TELECALLER')
      .map((u: any) => ({
        id: String(u.id),
        full_name: u.full_name ? String(u.full_name) : null,
        phone: u.phone ? String(u.phone) : null,
        template_id: u.crm_permission_template_id ? String(u.crm_permission_template_id) : null,
      }));

    return NextResponse.json({
      ok: true,
      permission_labels: CRM_PERMISSION_LABELS,
      templates: templatesRes.data || [],
      telecallers,
    });
  } catch (e: any) {
    const msg = String(e?.message || e || '');
    if (msg.includes('telecaller_permission_templates') || msg.includes('crm_permission_template')) {
      return NextResponse.json(
        {
          error: 'Permission tables missing. Run database/313_telecaller_crm_permissions.sql',
          migration_required: true,
        },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCrmReportsContext(request);
    if (isNextResponse(ctx)) return ctx;
    if (!crmSeesAllLeads(ctx.roleCode)) {
      return NextResponse.json({ error: 'Lead Manager only' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (action === 'assign') {
      const telecallerId = String(body?.telecaller_id || '').trim();
      const templateId = body?.template_id == null || body?.template_id === ''
        ? null
        : String(body.template_id).trim();
      if (!telecallerId) {
        return NextResponse.json({ error: 'telecaller_id required' }, { status: 400 });
      }
      const { error } = await ctx.db
        .from('users_login')
        .update({
          crm_permission_template_id: templateId,
          updated_at: new Date().toISOString(),
        })
        .eq('id', telecallerId);
      if (error) throw error;
      return NextResponse.json({ ok: true });
    }

    if (action === 'upsert_template') {
      const id = body?.id ? String(body.id) : null;
      const name = String(body?.name || '').trim();
      if (!name) return NextResponse.json({ error: 'name required' }, { status: 400 });
      const permissions = normalizeCrmPermissions(body?.permissions);
      const description = body?.description != null ? String(body.description) : null;
      const isDefault = Boolean(body?.is_default);

      if (isDefault) {
        await ctx.db
          .from('telecaller_permission_templates')
          .update({ is_default: false, updated_at: new Date().toISOString() })
          .eq('is_default', true);
      }

      if (id) {
        const { error } = await ctx.db
          .from('telecaller_permission_templates')
          .update({
            name,
            description,
            permissions,
            is_default: isDefault,
            updated_at: new Date().toISOString(),
          })
          .eq('id', id);
        if (error) throw error;
        return NextResponse.json({ ok: true, id });
      }

      const { data, error } = await ctx.db
        .from('telecaller_permission_templates')
        .insert({
          name,
          description,
          permissions,
          is_default: isDefault,
        })
        .select('id')
        .single();
      if (error) throw error;
      return NextResponse.json({ ok: true, id: data?.id });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Failed' }, { status: 500 });
  }
}

export type { CrmPermissionKey };
