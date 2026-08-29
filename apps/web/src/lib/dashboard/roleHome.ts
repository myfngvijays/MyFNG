/** Dashboard URL for a role. Internal role_code is unchanged. */
export function getRoleDashboardHome(roleCode: string): string {
  const code = String(roleCode || '').toUpperCase();
  if (code === 'APP_OPERATIONS') return '/dashboard/lead_manager';
  if (code === 'WORKSHOP_SUPERVISOR' || code === 'WORKSHOP_ADVISOR') {
    return '/dashboard/workshop-advisor';
  }
  return `/dashboard/${String(roleCode || 'lead_manager').toLowerCase()}`;
}

function normalizeRoleSlug(value: string): string {
  return String(value || '')
    .toLowerCase()
    .replace(/-/g, '_');
}

/** True when a page `role` prop matches the logged-in user's role_code. */
export function dashboardRolesMatch(pageRole: string, userRole: string): boolean {
  const page = normalizeRoleSlug(pageRole);
  const user = normalizeRoleSlug(userRole);
  if (user === 'app_operations' && page === 'lead_manager') return true;
  if (
    user === 'workshop_supervisor' &&
    (page === 'workshop_supervisor' || page === 'workshop_advisor')
  ) {
    return true;
  }
  return page === user;
}
