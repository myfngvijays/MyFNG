export type DailyBlogTopic = {
  topic: string;
  focusKeyword: string;
  intent: 'Informational' | 'Commercial/Transactional' | 'Local / Navigational';
};

/** Rotating GMB-style topics so each morning post is a new service angle. */
export const DAILY_BLOG_TOPICS: DailyBlogTopic[] = [
  { topic: 'When to skip a periodic car service and when you should not', focusKeyword: 'skip car service', intent: 'Informational' },
  { topic: 'Periodic car service checklist every owner should follow in India', focusKeyword: 'periodic car service checklist', intent: 'Informational' },
  { topic: 'Car AC not cooling in summer? Common causes and fixes', focusKeyword: 'car AC service', intent: 'Commercial/Transactional' },
  { topic: 'How often should you change engine oil in Indian city traffic', focusKeyword: 'engine oil change interval', intent: 'Informational' },
  { topic: 'Brake sound, vibration or longer stopping distance: what to check first', focusKeyword: 'car brake service', intent: 'Commercial/Transactional' },
  { topic: 'Wheel alignment vs balancing: which one does your car need', focusKeyword: 'wheel alignment', intent: 'Informational' },
  { topic: 'Battery drain after parking overnight: causes and prevention', focusKeyword: 'car battery service', intent: 'Commercial/Transactional' },
  { topic: 'Clutch slipping in traffic: signs you should not ignore', focusKeyword: 'clutch repair', intent: 'Commercial/Transactional' },
  { topic: 'Monsoon car care checklist for city roads and flooded stretches', focusKeyword: 'monsoon car service', intent: 'Local / Navigational' },
  { topic: 'Dent and paint: when a small scratch needs workshop attention', focusKeyword: 'denting painting', intent: 'Commercial/Transactional' },
  { topic: 'Car not starting in the morning: battery, starter or fuel?', focusKeyword: 'car not starting', intent: 'Informational' },
  { topic: 'How to choose a trusted car garage near you', focusKeyword: 'trusted car garage', intent: 'Local / Navigational' },
  { topic: 'Car pickup and drop for workshop service: how MyFNG collects and returns your car', focusKeyword: 'car pickup and drop', intent: 'Commercial/Transactional' },
  { topic: 'Tyre life in Indian summers: pressure, rotation and replacement', focusKeyword: 'car tyre care', intent: 'Informational' },
  { topic: 'Steering vibration at highway speed: alignment, tyres or suspension', focusKeyword: 'steering vibration', intent: 'Informational' },
  { topic: 'AC gas refill vs full AC service: what actually cools the cabin', focusKeyword: 'car AC gas refill', intent: 'Commercial/Transactional' },
  { topic: 'First service after buying a used car: what a workshop should inspect', focusKeyword: 'used car inspection', intent: 'Informational' },
  { topic: 'Warning lights on the dashboard: which ones mean stop now', focusKeyword: 'car warning lights', intent: 'Informational' },
  { topic: 'Why car pickup and drop is easier than taking leave for a workshop visit', focusKeyword: 'workshop pickup drop', intent: 'Informational' },
  { topic: 'Coolant leak and engine overheating: early signs and safe next steps', focusKeyword: 'engine overheating', intent: 'Informational' },
  { topic: 'Car smelling of fuel or burning rubber: do not keep driving', focusKeyword: 'car burning smell', intent: 'Informational' },
  { topic: 'Annual car maintenance budget for hatchbacks and sedans in India', focusKeyword: 'car maintenance cost', intent: 'Informational' },
  { topic: 'Why regular car washing is not the same as a proper service', focusKeyword: 'car wash vs service', intent: 'Informational' },
  { topic: 'Suspension noise on speed breakers: bushes, shocks or tyres', focusKeyword: 'car suspension repair', intent: 'Commercial/Transactional' },
  { topic: 'How to prepare your car before a long highway trip', focusKeyword: 'highway car checkup', intent: 'Local / Navigational' },
  { topic: 'What to check when MyFNG picks up your car for service and drops it back', focusKeyword: 'car pickup inspection', intent: 'Informational' },
  { topic: 'Ceramic coating vs regular polish: what lasts longer in Indian dust', focusKeyword: 'ceramic coating', intent: 'Commercial/Transactional' },
  { topic: 'Car insurance cashless garage vs independent workshop: how to decide', focusKeyword: 'cashless garage', intent: 'Informational' },
  { topic: 'Idling in traffic: does it damage the engine more than short trips', focusKeyword: 'car idling damage', intent: 'Informational' },
  { topic: 'When a cheap local mechanic becomes expensive: hidden service gaps', focusKeyword: 'trusted car mechanic', intent: 'Informational' },
];

export function pickDailyTopic(dayOfYear: number, usedFocusKeywords: string[]): DailyBlogTopic {
  const used = new Set(usedFocusKeywords.map((k) => k.toLowerCase().trim()).filter(Boolean));
  const unused = DAILY_BLOG_TOPICS.filter((t) => !used.has(t.focusKeyword.toLowerCase()));
  const pool = unused.length ? unused : DAILY_BLOG_TOPICS;
  return pool[dayOfYear % pool.length];
}

export function dayOfYearIst(now = new Date()): number {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = Number(parts.find((p) => p.type === 'year')?.value);
  const month = Number(parts.find((p) => p.type === 'month')?.value);
  const day = Number(parts.find((p) => p.type === 'day')?.value);
  const utcApprox = Date.UTC(year, month - 1, day);
  const start = Date.UTC(year, 0, 1);
  return Math.floor((utcApprox - start) / 86400000) + 1;
}

export function istDateString(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

export function nextTenAmIstIso(now = new Date()): string {
  const date = istDateString(now);
  const [y, m, d] = date.split('-').map(Number);
  // 10:00 IST = 04:30 UTC
  const todayTenUtc = Date.UTC(y, m - 1, d, 4, 30, 0);
  const next = now.getTime() < todayTenUtc ? todayTenUtc : todayTenUtc + 86400000;
  return new Date(next).toISOString();
}
