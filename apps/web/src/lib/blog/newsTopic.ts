export const NEWS_TOPICS = ['New Launch', 'EV News', 'Sales', 'Market', 'Industry'] as const;

export type NewsTopic = (typeof NEWS_TOPICS)[number];

const EV_BIKE_BRAND = /\b(ather|ola electric|iqube|chetak|vida|simple one|simple energy|okinawa|ampere|revolt|ultraviolette|oben|vinfast)\b/i;
const TWO_WHEELER = /\b(scooters?|e-scooters?|escooters?|motorbikes?|motorcycles?|e-bikes?|ebikes?|bikes?|two[- ]wheelers?)\b/i;
const EV_SIGNAL = /\belectric\b|\bev\b|\be-scooter\b|\bescooter\b|\bbattery\b/i;
const SERVICE_SIGNAL = /\b(service|servicing|maintenance|repairs?|workshop|warranty|battery swap|spare|first service|periodic service)\b/i;

const TOPIC_ALIASES: Record<string, NewsTopic> = {
  launch: 'New Launch',
  'new launch': 'New Launch',
  ev: 'EV News',
  'ev news': 'EV News',
  'ev bike': 'EV News',
  'ev bikes': 'EV News',
  'ev bike service': 'EV News',
  'ev bikes service': 'EV News',
  'electric bike': 'EV News',
  'electric bikes': 'EV News',
  'electric scooter': 'EV News',
  'electric scooter service': 'EV News',
  'electric bike service': 'EV News',
};

export function isEvBikeText(text: string) {
  const value = String(text || '');
  if (!value.trim()) return false;
  if (EV_BIKE_BRAND.test(value)) return true;
  return TWO_WHEELER.test(value) && EV_SIGNAL.test(value);
}

export function isEvBikeServiceText(text: string) {
  return isEvBikeText(text) && SERVICE_SIGNAL.test(text);
}

export function newsTopicFromStored(value: unknown): NewsTopic | null {
  const text = String(value || '').trim().toLowerCase();
  if (!text) return null;
  return NEWS_TOPICS.find((topic) => topic.toLowerCase() === text) || TOPIC_ALIASES[text] || null;
}

function matchTopic(text: string): NewsTopic | null {
  const value = text.toLowerCase();
  if (!value.trim()) return null;
  if (isEvBikeServiceText(value) || isEvBikeText(value)) return 'EV News';
  if (/\belectric\b|\bev\b|\bbattery\b|\bhybrid\b/.test(value)) return 'EV News';
  if (/\bsales\b|\bsold\b|\bwholesale|\bretail\b|\bsurpass|\boutperform|\bmarket share\b/.test(value)) return 'Sales';
  if (/\bloan\b|\brepo\b|\bresale\b|\bused car\b|\bdemand\b|\brbi\b|\binterest rate\b/.test(value)) return 'Market';
  if (/\blaunch|\bunveil|\bpriced\b|\bfacelift\b|\bintroduc|\bdebut\b|\bbookings?\b/.test(value)) return 'New Launch';
  return null;
}

export function classifyNewsTopic(title: string, excerpt = ''): NewsTopic {
  return matchTopic(title) || matchTopic(excerpt) || 'Industry';
}

export function resolveNewsTopic(stored: unknown, title: string, excerpt = ''): NewsTopic {
  return newsTopicFromStored(stored) || classifyNewsTopic(title, excerpt);
}
