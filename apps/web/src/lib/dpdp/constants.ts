/** DPDP Act, 2023 — operational constants. Legal copy is a working draft. */

export const DPDP_NOTICE_VERSION = '2026-08-26';

export const GRIEVANCE_OFFICER = {
  name: 'Nitish Jha',
  title: 'Grievance and Data Protection Officer',
  email: 'cs-reply@myfng.in',
  supportEmail: 'info@myfng.in',
  phone: '+91-9152307030',
  address:
    'A/309, Centrum Business Square, Road No. 16, Wagle Industrial Estate, Thane (West), Maharashtra - 400604, India',
  acknowledgeHours: 48,
  resolveDays: 30,
} as const;

export const CONSENT_PURPOSES = [
  {
    id: 'service',
    label: 'Service delivery',
    description:
      'Use my name, phone, vehicle, and address to book, assign, and complete car service or RSA.',
  },
  {
    id: 'marketing',
    label: 'Promotional messages',
    description: 'Send offers and updates on WhatsApp, SMS, RCS, email, or phone. I can withdraw anytime.',
  },
  {
    id: 'analytics',
    label: 'Analytics cookies',
    description: 'Allow Google Analytics / GTM / Clarity to measure how the website is used.',
  },
  {
    id: 'advertising',
    label: 'Advertising cookies',
    description: 'Allow Meta Pixel and similar ads tools to measure campaigns. Not required for booking.',
  },
] as const;

export type ConsentPurposeId = (typeof CONSENT_PURPOSES)[number]['id'];

export const DATA_RIGHTS_TYPES = [
  { id: 'access', label: 'Access my data' },
  { id: 'correct', label: 'Correct my data' },
  { id: 'erase', label: 'Erase / delete my data' },
  { id: 'withdraw', label: 'Withdraw consent' },
  { id: 'nominate', label: 'Nominate another person' },
  { id: 'grievance', label: 'Grievance / complaint' },
] as const;

export const TRACKER_CONSENT_KEY = 'myfng.dpdp.tracker.v1';
