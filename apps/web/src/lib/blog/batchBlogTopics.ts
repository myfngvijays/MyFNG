import type { DailyBlogTopic } from '@/lib/blog/dailyTopics';

export const BATCH_BLOG_RUN_KEY = '2026-09-16';

export type BatchBlogTopic = DailyBlogTopic & {
  news?: boolean;
};

/** One-shot batch (16 Sep 2026). No CNG / EV / new-car launch posts. */
export const BATCH_BLOG_TOPICS: BatchBlogTopic[] = [
  { topic: 'When to book periodic car service before Diwali travel', focusKeyword: 'Diwali car service booking', intent: 'Local / Navigational' },
  { topic: 'Free pickup and drop vs taking leave for a garage visit', focusKeyword: 'car service pickup drop', intent: 'Commercial/Transactional' },
  { topic: 'Photos and videos you must get before approving extra workshop jobs', focusKeyword: 'approve extra car work', intent: 'Informational' },
  { topic: 'Car service starts from 1500: what is included and what is extra', focusKeyword: 'car service starts from 1500', intent: 'Commercial/Transactional' },
  { topic: '1 month 1000 km service warranty: what it covers and what it does not', focusKeyword: 'car service warranty', intent: 'Informational' },
  { topic: 'Why the MyFNG app matters more than WhatsApp-only car service updates', focusKeyword: 'MyFNG app vs WhatsApp', intent: 'Informational' },
  { topic: 'How to read a car service invoice: labour, parts and GST', focusKeyword: 'car service invoice', intent: 'Informational' },
  { topic: 'OEM vs OES spare parts: what should go into your car', focusKeyword: 'OEM vs OES parts', intent: 'Informational' },
  { topic: 'Same-day car service: jobs that finish today vs jobs that need parts', focusKeyword: 'same day garage service', intent: 'Commercial/Transactional' },
  { topic: 'Second car sitting unused: battery, brakes and mice damage to check', focusKeyword: 'unused car maintenance', intent: 'Informational' },
  { topic: 'Office commuter hatchback: 10,000 km service that actually matters', focusKeyword: 'hatchback periodic service', intent: 'Commercial/Transactional' },
  { topic: 'Family car with kids: cabin filter, AC and child-seat anchor check', focusKeyword: 'family car service', intent: 'Informational' },
  { topic: 'Coolant leak and engine overheating: early signs and safe next steps', focusKeyword: 'engine overheating', intent: 'Informational' },
  { topic: 'Car AC not cooling after summer: gas refill vs full AC service', focusKeyword: 'car AC service', intent: 'Commercial/Transactional' },
  { topic: 'Car AC smell after monsoon: cabin filter, coil or drain blockage', focusKeyword: 'car AC smell', intent: 'Commercial/Transactional' },
  { topic: 'Squeaking brakes after rain: pads, discs or rust film', focusKeyword: 'squeaking car brakes', intent: 'Commercial/Transactional' },
  { topic: 'Handbrake not holding on a slope: cable, shoes or rear pads', focusKeyword: 'handbrake not working', intent: 'Commercial/Transactional' },
  { topic: 'Car pulling to one side: alignment, tyre wear or brake drag', focusKeyword: 'car pulling to one side', intent: 'Informational' },
  { topic: 'Steering vibration at highway speed: alignment, tyres or suspension', focusKeyword: 'steering vibration', intent: 'Informational' },
  { topic: 'Wheel alignment vs balancing: which one does your car need first', focusKeyword: 'wheel alignment', intent: 'Informational' },
  { topic: 'Tyre puncture vs sidewall bulge: when you must replace not repair', focusKeyword: 'tyre puncture repair', intent: 'Informational' },
  { topic: 'Summer tyre burst risk: pressure, load and highway heat', focusKeyword: 'tyre burst summer', intent: 'Informational' },
  { topic: 'Alloy wheel kerb damage: cosmetic vs alignment risk', focusKeyword: 'alloy wheel repair', intent: 'Commercial/Transactional' },
  { topic: 'Battery drain after parking overnight: causes and prevention', focusKeyword: 'car battery service', intent: 'Commercial/Transactional' },
  { topic: 'Jump start vs battery replacement: when a boost is not enough', focusKeyword: 'car jump start', intent: 'Informational' },
  { topic: 'Car not starting in the morning: battery, starter or fuel', focusKeyword: 'car not starting', intent: 'Informational' },
  { topic: 'Check engine light flashing vs steady: stop now or book soon', focusKeyword: 'check engine light', intent: 'Informational' },
  { topic: 'ABS light on: can you still drive and what a workshop should check', focusKeyword: 'ABS light on', intent: 'Commercial/Transactional' },
  { topic: 'Car jerking while changing gears: clutch, mounts or fuel issue', focusKeyword: 'car jerking gears', intent: 'Informational' },
  { topic: 'Automatic car jerking in first gear: ATF, mount or software', focusKeyword: 'automatic car jerking', intent: 'Commercial/Transactional' },
  { topic: 'Manual car hard to shift in the morning: clutch fluid or cable', focusKeyword: 'hard gear shift', intent: 'Informational' },
  { topic: 'Clutch slipping in traffic: signs you should not ignore', focusKeyword: 'clutch repair', intent: 'Commercial/Transactional' },
  { topic: 'Car not picking up speed: air filter, plugs or clutch slip', focusKeyword: 'car not picking speed', intent: 'Informational' },
  { topic: 'High fuel consumption after service: reset, driving or a real fault', focusKeyword: 'high fuel consumption', intent: 'Informational' },
  { topic: 'Petrol car knocking sound: fuel quality, timing or carbon', focusKeyword: 'car engine knocking', intent: 'Informational' },
  { topic: 'Diesel car black smoke on pickup: injector, filter or turbo', focusKeyword: 'diesel black smoke', intent: 'Commercial/Transactional' },
  { topic: 'Car stalling at signals: idle, sensor or dirty throttle', focusKeyword: 'car stalling at signals', intent: 'Informational' },
  { topic: 'Car vibrating at idle but smooth on the highway', focusKeyword: 'car vibrating idle', intent: 'Informational' },
  { topic: 'Power steering heavy or noisy: fluid, pump or belt', focusKeyword: 'power steering problem', intent: 'Commercial/Transactional' },
  { topic: 'Suspension noise on speed breakers: bushes, shocks or tyres', focusKeyword: 'car suspension repair', intent: 'Commercial/Transactional' },
  { topic: 'Underbody rust after monsoon: wash, wax or workshop treatment', focusKeyword: 'car underbody rust', intent: 'Local / Navigational' },
  { topic: 'Water leaking inside the cabin after a car wash', focusKeyword: 'car cabin water leak', intent: 'Informational' },
  { topic: 'Headlight dim at night: bulb, earth or charging system', focusKeyword: 'dim car headlights', intent: 'Commercial/Transactional' },
  { topic: 'Reverse camera not working after rain: camera, wiring or screen', focusKeyword: 'reverse camera not working', intent: 'Commercial/Transactional' },
  { topic: 'Festival travel car check: brakes, tyres, lights and AC before the trip', focusKeyword: 'festival car checkup', intent: 'Local / Navigational' },
];

export function batchBlogKey(index: number) {
  return `batch-${BATCH_BLOG_RUN_KEY}-${String(index).padStart(2, '0')}`;
}
