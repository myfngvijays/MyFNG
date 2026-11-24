/**
 * Telecaller CRM permissions (TeleCRM-style templates).
 *
 * ONE place to add a feature: append an entry to CRM_PERMISSION_CATALOG.
 * Types, defaults, labels, the Lead Manager "Permission templates" page, the telecaller
 * side menu and the page guard all read from this list — nothing else to update.
 * Templates saved before a key existed get that key's `callerDefault`, and the editor
 * marks it "New" until the template is saved again.
 */

export type CrmPermissionGroup = 'pages' | 'reports' | 'tools';

export const CRM_PERMISSION_GROUPS: { id: CrmPermissionGroup; label: string; hint: string }[] = [
  { id: 'pages', label: 'Menu pages', hint: 'Side menu mein kaunse pages dikhenge. OFF = menu se hide + page band.' },
  { id: 'reports', label: 'Reports', hint: 'Leaderboard, export aur duplicate reports.' },
  { id: 'tools', label: 'Tools', hint: 'Follow-ups, scripts aur baaki tools.' },
];

export const CRM_PERMISSION_CATALOG = [
  // ── Menu pages ────────────────────────────────────────────────────────────
  {
    key: 'page_booking_confirmed',
    group: 'pages',
    label: 'Booking Confirmed list',
    description: 'Booking confirmed leads ki list.',
    callerDefault: true,
    pagePaths: ['/dashboard/telecaller/booking-confirmed'],
  },
  {
    key: 'page_deleted_leads',
    group: 'pages',
    label: 'Deleted Leads',
    description: 'Deleted leads dekhna aur restore karna.',
    callerDefault: true,
    pagePaths: ['/dashboard/telecaller/deleted-leads'],
  },
  {
    key: 'page_whatsapp',
    group: 'pages',
    label: 'WhatsApp inbox',
    description: 'Menu ka WhatsApp inbox.',
    callerDefault: true,
    pagePaths: [],
  },
  {
    key: 'page_book',
    group: 'pages',
    label: 'Book (new booking / lead)',
    description: 'Naya lead ya booking banana.',
    callerDefault: true,
    pagePaths: ['/dashboard/telecaller/book'],
  },
  {
    key: 'page_recordings',
    group: 'pages',
    label: 'Recordings',
    description: 'Call recordings sunna.',
    callerDefault: true,
    pagePaths: ['/dashboard/telecaller/recordings'],
  },
  {
    key: 'page_call_tracking',
    group: 'pages',
    label: 'Call Tracking',
    description: 'Phone call tracking / recording setup.',
    callerDefault: true,
    pagePaths: ['/dashboard/telecaller/call-recording'],
  },
  {
    key: 'page_workshops',
    group: 'pages',
    label: 'Workshops',
    description: 'Workshop locator.',
    callerDefault: true,
    pagePaths: ['/dashboard/telecaller/workshops'],
  },
  {
    key: 'page_zone_prices',
    group: 'pages',
    label: 'Zone Prices',
    description: 'Zone-wise service prices.',
    callerDefault: true,
    pagePaths: ['/dashboard/telecaller/zone-prices'],
  },
  {
    key: 'page_call_scripts',
    group: 'pages',
    label: 'Call scripts',
    description: 'Call script templates.',
    callerDefault: true,
    pagePaths: ['/dashboard/telecaller/templates'],
  },
  // ── Reports ───────────────────────────────────────────────────────────────
  {
    key: 'reports',
    group: 'reports',
    label: 'Reports section',
    description: 'Apna leaderboard aur call activity.',
    callerDefault: true,
    pagePaths: [],
  },
  {
    key: 'reports_export',
    group: 'reports',
    label: 'CSV export / downloads',
    description: 'Leads aur calls CSV mein download karna.',
    callerDefault: false,
    pagePaths: ['/dashboard/telecaller/reports/exports'],
  },
  {
    key: 'reports_team_leaderboard',
    group: 'reports',
    label: 'Team leaderboard',
    description: 'Saare telecallers ki ranking dekhna.',
    callerDefault: false,
    pagePaths: [],
  },
  {
    key: 'reports_duplicates',
    group: 'reports',
    label: 'Duplicate phones report',
    description: 'Ek hi phone wali duplicate leads.',
    callerDefault: true,
    pagePaths: ['/dashboard/telecaller/reports/duplicates'],
  },
  // ── Tools ─────────────────────────────────────────────────────────────────
  {
    key: 'view_booking_price',
    group: 'tools',
    label: 'Booking ka price dekhna',
    description:
      'Lead page par "Booking & price" card aur list ke "App user" badge par click karke booking ka hisaab: service + add-ons ka price, coupon, wallet, membership aur actual payable. Sirf apni assigned lead ka. Wallet balance ya App Customers page nahi dikhta.',
    callerDefault: true,
    pagePaths: [],
  },
  {
    key: 'view_lead_source',
    group: 'tools',
    label: 'Lead source dekhna',
    description:
      'Leads list ke "Lead from" column mein lead kahan se aayi (App booking, Website, MISA AI, WhatsApp, Sarv call, Meta / Google Ads). OFF = sirf "Booking · call pending" / "OTP verified" dikhega, channel ka naam nahi. UTM / campaign details kabhi nahi dikhte.',
    callerDefault: true,
    pagePaths: [],
  },
  {
    key: 'engage',
    group: 'tools',
    label: 'Engage (follow-ups / scripts)',
    description: 'Engage page: bulk follow-ups aur scripts.',
    callerDefault: false,
    pagePaths: ['/dashboard/telecaller/engage'],
  },
] as const satisfies readonly {
  key: string;
  group: CrmPermissionGroup;
  label: string;
  description: string;
  callerDefault: boolean;
  /** Telecaller pages this permission opens. OFF → hidden from menu and redirected home. */
  pagePaths: readonly string[];
}[];

export type CrmPermissionKey = (typeof CRM_PERMISSION_CATALOG)[number]['key'];

export type CrmPermissions = Record<CrmPermissionKey, boolean>;

export const CRM_PERMISSION_KEYS = CRM_PERMISSION_CATALOG.map((p) => p.key) as CrmPermissionKey[];

export const DEFAULT_CALLER_PERMISSIONS: CrmPermissions = Object.fromEntries(
  CRM_PERMISSION_CATALOG.map((p) => [p.key, p.callerDefault]),
) as CrmPermissions;

export const FULL_MANAGER_PERMISSIONS: CrmPermissions = Object.fromEntries(
  CRM_PERMISSION_CATALOG.map((p) => [p.key, true]),
) as CrmPermissions;

export const CRM_PERMISSION_LABELS: Record<CrmPermissionKey, string> = Object.fromEntries(
  CRM_PERMISSION_CATALOG.map((p) => [p.key, p.label]),
) as Record<CrmPermissionKey, string>;

/** Permission that controls a telecaller page path (longest match), or null if always open. */
export function crmPermissionForPath(pathname: string): CrmPermissionKey | null {
  const path = String(pathname || '').replace(/\/+$/, '');
  let best: { key: CrmPermissionKey; len: number } | null = null;
  for (const p of CRM_PERMISSION_CATALOG) {
    for (const prefix of p.pagePaths) {
      if ((path === prefix || path.startsWith(`${prefix}/`)) && (!best || prefix.length > best.len)) {
        best = { key: p.key, len: prefix.length };
      }
    }
  }
  return best?.key ?? null;
}

/** Keys missing from a stored template (added to the catalog after it was saved). */
export function missingCrmPermissionKeys(raw: unknown): CrmPermissionKey[] {
  const src = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  return CRM_PERMISSION_KEYS.filter((k) => typeof src[k] !== 'boolean');
}

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
