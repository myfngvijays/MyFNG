import Constants from 'expo-constants';

/** Which phone app this binary is acting as. */
export type AppVariant = 'customer' | 'partner' | 'unified';

/**
 * Where a signed-in role is allowed to continue.
 * `unified` is the current single app: every mobile role still opens.
 */
export type RoleAccessKind = 'allowed' | 'partner_app' | 'customer_app' | 'website';

export type RoleAccess = {
  kind: RoleAccessKind;
};

const CUSTOMER_ROLES = new Set(['CUSTOMER']);

/** Phone staff. Office roles stay on the website. */
const PARTNER_ROLES = new Set([
  'TELECALLER',
  'LEAD_MANAGER',
  'APP_OPERATIONS',
  'CSE',
  'CUSTOMER_SERVICE_EXECUTIVE',
  'WORKSHOP_ADMIN',
  'WORKSHOP_SUPERVISOR',
  'WORKSHOP_MECHANIC',
  'WORKSHOP_PICKUP_BOY',
  'RSA_MANAGER',
  'HOME_SERVICE_MANAGER',
  'COMPANY_MECHANIC_RSA',
  'COMPANY_VAN_TECHNICIAN',
  'COMPANY_VAN_DRIVER',
]);

const WEB_ONLY_ROLES = new Set([
  'SUPER_ADMIN',
  'SUB_ADMIN',
  'AUDITOR',
  'ACCOUNTS_TEAM',
  'BILLING',
  'FINANCE',
  'DIGITAL_MARKETING',
  'DIGITAL_AUTHOR',
]);

function readVariant(raw: unknown): AppVariant {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'customer' || value === 'partner') return value;
  return 'unified';
}

/**
 * Comes from app.config.js: APP_VARIANT unset = `customer` (MyFNG listing, customers only),
 * `partner` = MyFNG Partner (staff), `unified` = old all-roles app for local testing.
 */
export function getAppVariant(): AppVariant {
  return readVariant(Constants.expoConfig?.extra?.appVariant);
}

export function normalizeRoleCode(roleCode: unknown): string {
  return String(roleCode || '').trim().toUpperCase();
}

export function resolveRoleAccess(
  roleCode: unknown,
  variant: AppVariant = getAppVariant(),
): RoleAccess {
  const code = normalizeRoleCode(roleCode);
  if (!code || code === 'UNKNOWN') return { kind: 'allowed' };
  if (variant === 'unified') return { kind: 'allowed' };

  if (CUSTOMER_ROLES.has(code)) {
    return { kind: variant === 'customer' ? 'allowed' : 'customer_app' };
  }
  if (PARTNER_ROLES.has(code)) {
    return { kind: variant === 'partner' ? 'allowed' : 'partner_app' };
  }
  if (WEB_ONLY_ROLES.has(code)) return { kind: 'website' };

  return { kind: 'website' };
}
