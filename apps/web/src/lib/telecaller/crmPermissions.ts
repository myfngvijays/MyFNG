/** Telecaller CRM permission flags (TeleCRM-style templates). */

export type CrmPermissionKey =
  | 'reports'
  | 'reports_export'
  | 'reports_team_leaderboard'
  | 'reports_duplicates'
  | 'engage';

export type CrmPermissions = Record<CrmPermissionKey, boolean>;

export const DEFAULT_CALLER_PERMISSIONS: CrmPermissions = {
  reports: true,
  reports_export: false,
  reports_team_leaderboard: false,
  reports_duplicates: true,
  engage: false,
};

export const FULL_MANAGER_PERMISSIONS: CrmPermissions = {
  reports: true,
  reports_export: true,
  reports_team_leaderboard: true,
  reports_duplicates: true,
  engage: true,
};

export const CRM_PERMISSION_LABELS: Record<CrmPermissionKey, string> = {
  reports: 'Reports section',
  reports_export: 'CSV export / downloads',
  reports_team_leaderboard: 'Team leaderboard (all telecallers)',
  reports_duplicates: 'Duplicate phones report',
  engage: 'Engage menu (follow-ups / scripts)',
};

export function normalizeCrmPermissions(raw: unknown): CrmPermissions {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const out = { ...DEFAULT_CALLER_PERMISSIONS };
  (Object.keys(out) as CrmPermissionKey[]).forEach((key) => {
    if (typeof src[key] === 'boolean') out[key] = src[key] as boolean;
  });
  return out;
}

export function mergeCrmPermissions(
  roleCode: string,
  templatePermissions: unknown | null | undefined,
): CrmPermissions {
  const code = String(roleCode || '').toUpperCase();
  if (code === 'LEAD_MANAGER' || code === 'SUPER_ADMIN' || code === 'SUB_ADMIN') {
    return { ...FULL_MANAGER_PERMISSIONS };
  }
  return normalizeCrmPermissions(templatePermissions ?? DEFAULT_CALLER_PERMISSIONS);
}

/** Personal board title for telecallers (never "Team" unless team mode). */
export function personalLeaderboardLabel(fullName?: string | null): string {
  const first = String(fullName || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)[0];
  if (first) return `${first}'s leaderboard`;
  return 'Your leaderboard';
}
