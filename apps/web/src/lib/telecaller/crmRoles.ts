/** Shared CRM access for Telecaller Advanced CRM + Lead Manager Advanced. */

export const TELECALLER_CRM_ROLES = [
  'TELECALLER',
  'LEAD_MANAGER',
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'RSA_MANAGER',
] as const;

export type TelecallerCrmRole = (typeof TELECALLER_CRM_ROLES)[number];

export function normalizeRoleCode(role: unknown): string {
  return String(role || '').trim().toUpperCase();
}

export function isTelecallerCrmRole(role: unknown): boolean {
  return (TELECALLER_CRM_ROLES as readonly string[]).includes(normalizeRoleCode(role));
}

/** Lead Manager / admins see full pool; telecallers see only assigned-to-me. */
export function crmSeesAllLeads(role: unknown): boolean {
  const code = normalizeRoleCode(role);
  return code === 'LEAD_MANAGER' || code === 'SUPER_ADMIN' || code === 'SUB_ADMIN';
}

export function canCreateCrmBooking(role: unknown): boolean {
  const code = normalizeRoleCode(role);
  return code === 'TELECALLER' || code === 'LEAD_MANAGER' || code === 'SUPER_ADMIN';
}

export type CrmDashboardBase = {
  base: '/dashboard/telecaller' | '/dashboard/lead_manager';
  layoutRole: 'telecaller' | 'lead_manager';
  scopeAll: boolean;
  isLeadManager: boolean;
};

export function getCrmDashboardBase(pathname: string | null | undefined): CrmDashboardBase {
  if (String(pathname || '').includes('/lead_manager')) {
    return {
      base: '/dashboard/lead_manager',
      layoutRole: 'lead_manager',
      scopeAll: true,
      isLeadManager: true,
    };
  }
  return {
    base: '/dashboard/telecaller',
    layoutRole: 'telecaller',
    scopeAll: false,
    isLeadManager: false,
  };
}
