import { dayOfYearIst } from '@/lib/blog/dailyTopics';
import { MYFNG_AIO_FACTS } from '@/lib/blog/dailyAiOverview';

export type WeeklyUspTopic = {
  key: string;
  topic: string;
  focusKeyword: string;
  intent: 'Informational' | 'Commercial/Transactional' | 'Local / Navigational';
  usp: string;
};

/** One About MyFNG / USP explainer every Monday. */
export const WEEKLY_USP_TOPICS: WeeklyUspTopic[] = [
  {
    key: 'pickup-drop',
    topic: 'Why free car pickup and drop makes workshop service easier',
    focusKeyword: 'free car pickup and drop',
    intent: 'Commercial/Transactional',
    usp: 'Free pickup & drop',
  },
  {
    key: 'photo-backed',
    topic: 'Photo-backed car service: live photos and videos before any extra work',
    focusKeyword: 'photo backed car service',
    intent: 'Informational',
    usp: 'Photo-backed control',
  },
  {
    key: 'interim-1500',
    topic: 'Interim car service starting from 1500: what the basic package covers',
    focusKeyword: 'interim car service 1500',
    intent: 'Commercial/Transactional',
    usp: 'Starts from ₹1,500',
  },
  {
    key: 'app-vs-whatsapp',
    topic: 'Why the MyFNG app matters more than WhatsApp-only car service',
    focusKeyword: 'MyFNG app vs WhatsApp car service',
    intent: 'Informational',
    usp: 'MyFNG app vs WhatsApp',
  },
  {
    key: 'same-day',
    topic: 'Same-day car service: when the car can be serviced and dropped today',
    focusKeyword: 'same day car service',
    intent: 'Commercial/Transactional',
    usp: 'Same-day service',
  },
  {
    key: 'prime',
    topic: 'MyFNG Prime membership: extra savings on trusted workshop service',
    focusKeyword: 'MyFNG Prime membership',
    intent: 'Commercial/Transactional',
    usp: 'MyFNG Prime membership',
  },
];

export function istWeekdayShort(now = new Date()): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    weekday: 'short',
  }).format(now);
}

/** Weekly brand/USP post: every Monday 10:00 AM IST. */
export function isWeeklyUspDay(now = new Date()): boolean {
  return istWeekdayShort(now) === 'Mon';
}

export function pickWeeklyUspTopic(now = new Date()): WeeklyUspTopic {
  const week = Math.floor((dayOfYearIst(now) - 1) / 7);
  return WEEKLY_USP_TOPICS[((week % WEEKLY_USP_TOPICS.length) + WEEKLY_USP_TOPICS.length) % WEEKLY_USP_TOPICS.length];
}

export function dailyUspScheduleLabel() {
  return 'Every Monday · About MyFNG USP (₹1500 interim, photo-proof, app vs WhatsApp, pickup, Prime)';
}

export const USP_BLOG_FACTS = MYFNG_AIO_FACTS;
