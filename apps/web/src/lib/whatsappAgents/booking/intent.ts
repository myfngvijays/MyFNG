const GREETING_KEYWORDS = ['hi', 'hii', 'hello', 'hey', 'namaste', 'good morning', 'good evening', 'good afternoon'];

const BOOKING_KEYWORDS = [
  'book',
  'booking',
  'appointment',
  'slot',
  'schedule',
  'service',
  'pricing',
  'price',
  'cost',
  'quote',
  'quotation',
  'periodic',
  'maintenance',
  'workshop',
  'pincode',
  'pin code',
  'pickup',
  'pick up',
  'date',
  'time',
  'swift',
  'i20',
  'city',
  'creta',
  'baleno',
  'wagonr',
  'alto',
  'innova',
  'fortuner',
  'nexon',
  'punch',
];

const NON_BOOKING_PREFIXES = ['rsa', 'towing', 'tow', 'breakdown', 'flat tyre', 'battery dead', 'roadside'];

export function hasBookingIntent(message: string): boolean {
  const text = String(message || '').trim().toLowerCase();
  if (!text) return false;

  if (NON_BOOKING_PREFIXES.some((kw) => text.includes(kw))) return false;

  if (GREETING_KEYWORDS.some((kw) => text === kw || text.startsWith(`${kw} `))) return true;

  return BOOKING_KEYWORDS.some((kw) => text.includes(kw));
}
