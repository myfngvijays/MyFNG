import type { DailyBlogTopic } from '@/lib/blog/dailyTopics';

export const RSA_BLOG_RUN_KEY = 'rsa-2026-09-16';

export const RSA_BLOG_TOPICS: DailyBlogTopic[] = [
  { topic: '24x7 roadside assistance: when to call RSA immediately', focusKeyword: '24x7 roadside assistance', intent: 'Local / Navigational' },
  { topic: 'Car towing after a breakdown: what happens next', focusKeyword: 'car towing after breakdown', intent: 'Commercial/Transactional' },
  { topic: 'Dead battery on the road: jumpstart vs replacement', focusKeyword: 'car battery jumpstart', intent: 'Commercial/Transactional' },
  { topic: 'Flat tyre on the highway: spare, puncture fix or tow', focusKeyword: 'flat tyre roadside assistance', intent: 'Commercial/Transactional' },
  { topic: 'Emergency towing on the highway at night', focusKeyword: 'emergency highway towing', intent: 'Commercial/Transactional' },
  { topic: 'Car breakdown in city traffic: first 10 minutes', focusKeyword: 'car breakdown in traffic', intent: 'Informational' },
  { topic: 'Accident towing: photos, police and safe recovery', focusKeyword: 'accident car towing', intent: 'Informational' },
  { topic: 'Engine overheating on the highway: stop and call for a tow', focusKeyword: 'overheating emergency towing', intent: 'Informational' },
  { topic: 'How to book MyFNG roadside assistance from the app', focusKeyword: 'book roadside assistance app', intent: 'Commercial/Transactional' },
  { topic: 'Emergency towing from a society parking or basement', focusKeyword: 'emergency parking towing', intent: 'Commercial/Transactional' },
];

export const RSA_BLOG_FACTS = [
  'MyFNG RSA is 24×7 emergency roadside help: towing, battery jumpstart, flat tyre / puncture, emergency petrol or diesel delivery, accident recovery, and live tracking.',
  'RSA comes to the stranded car for emergency help. Do not call this doorstep / at-home periodic servicing.',
  'Typical ETA ranges only: jumpstart 10–30 min, puncture 15–30 min, fuel 20–30 min, towing 20–30 min, accident towing 30–35 min. Do not promise an exact minute.',
  'Towing starts from ₹25/km. Do not invent other RSA prices — say check the MyFNG app or /car-roadside-assistance.',
  'After towing, workshop repair is a separate booking with free pickup & drop. Never mix RSA on-spot help with a mechanic servicing the car at the house.',
  'Book RSA from the MyFNG app or call. WhatsApp can share location; the app is for booking and tracking.',
  'Petrol and diesel only. Do not write about CNG or EV roadside service.',
  'Never name competitor RSA brands.',
  'Write only for Mumbai, Navi Mumbai or Thane. Never mention Pune or any other city.',
];

export function rsaBlogKey(index: number) {
  return `batch-${RSA_BLOG_RUN_KEY}-${String(index).padStart(2, '0')}`;
}
