import {
  DEFAULT_CALLER_PERMISSIONS,
  mergeCrmPermissions,
  type CrmPermissions,
} from '@/lib/telecaller/crmPermissions';
import { normalizeRoleCode } from '@/lib/telecaller/crmRoles';

/**
 * Resolve effective CRM permissions for a users_login id.
 * Managers always get full access. Telecallers use assigned template or default.
 */
export async function resolveCrmPermissionsForUser(
  db: any,
  userId: string,
  roleCode: string,
): Promise<{ permissions: CrmPermissions; templateId: string | null; templateName: string | null }> {
  const code = normalizeRoleCode(roleCode);
  if (code === 'LEAD_MANAGER' || code === 'SUPER_ADMIN' || code === 'SUB_ADMIN') {
    return { permissions: mergeCrmPermissions(code, null), templateId: null, templateName: null };
  }

  const { data: userRow } = await db
    .from('users_login')
    .select('crm_permission_template_id')
    .eq('id', userId)
    .maybeSingle();

  const templateId = userRow?.crm_permission_template_id
    ? String(userRow.crm_permission_template_id)
    : null;

  let template: { id: string; name: string; permissions: unknown } | null = null;
  if (templateId) {
    const { data } = await db
      .from('telecaller_permission_templates')
      .select('id, name, permissions, is_active')
      .eq('id', templateId)
      .maybeSingle();
    if (data?.is_active !== false) template = data;
  }

  if (!template) {
    const { data } = await db
      .from('telecaller_permission_templates')
      .select('id, name, permissions')
      .eq('is_default', true)
      .eq('is_active', true)
      .maybeSingle();
    template = data;
  }

  if (!template) {
    return {
      permissions: { ...DEFAULT_CALLER_PERMISSIONS },
      templateId: null,
      templateName: 'Built-in Default Caller',
    };
  }

  return {
    permissions: mergeCrmPermissions(code, template.permissions),
    templateId: String(template.id),
    templateName: String(template.name || 'Template'),
  };
}
