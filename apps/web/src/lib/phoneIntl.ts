/**
 * Phone helpers that keep non-Indian numbers intact.
 *
 * Most of MyFNG stores Indian numbers as 10 digits and adds 91 when sending.
 * A WhatsApp lead can come from abroad (e.g. +966 Saudi). Those must keep their
 * own country code, or the reply/call goes to a wrong +91 number.
 */

function digitsOf(raw: unknown): string {
  return String(raw ?? '').replace(/\D/g, '');
}

/** True for a number that clearly carries a non-India country code (11–15 digits, not 91 / 0 prefix). */
export function isForeignPhone(raw: unknown): boolean {
  const d = digitsOf(raw);
  if (d.length <= 10 || d.length > 15) return false;
  if (d.length === 11 && d.startsWith('0')) return false; // 0 + Indian 10 digits
  if (d.length === 12 && d.startsWith('91')) return false;
  if (d.length === 13 && d.startsWith('091')) return false;
  return true;
}

/** Digits WhatsApp Cloud API expects: 91XXXXXXXXXX for India, full international digits otherwise. */
export function toWhatsAppPhone(raw: unknown): string {
  const d = digitsOf(raw);
  if (!d) return '';
  if (isForeignPhone(d)) return d;
  const last10 = d.slice(-10);
  if (last10.length === 10) return `91${last10}`;
  return d.startsWith('91') ? d : `91${d}`;
}

/** What we store on a lead: 10 digits for India, full international digits otherwise. */
export function toLeadPhone(raw: unknown): string {
  const d = digitsOf(raw);
  if (isForeignPhone(d)) return d;
  return d.slice(-10);
}

/** Known calling codes, longest first, so "+966 554729089" splits correctly. */
const COUNTRY_CODES = [
  '971', '966', '974', '973', '968', '965', '977', '880', '960', '94', '93', '92',
  '86', '81', '65', '61', '60', '49', '44', '33', '27', '20', '1',
];

export function phoneCountryCode(raw: unknown): string {
  const d = digitsOf(raw);
  if (!isForeignPhone(d)) return '91';
  return COUNTRY_CODES.find((code) => d.startsWith(code) && d.length - code.length >= 6) || '';
}

/** "+966 554729089" for foreign numbers, "+91 98765 43210" for Indian ones. */
export function formatPhoneDisplay(raw: unknown): string {
  const d = digitsOf(raw);
  if (!d) return '';
  if (isForeignPhone(d)) {
    const code = phoneCountryCode(d);
    return code ? `+${code} ${d.slice(code.length)}` : `+${d}`;
  }
  const last10 = d.slice(-10);
  if (last10.length !== 10) return d;
  return `+91 ${last10.slice(0, 5)} ${last10.slice(5)}`;
}
