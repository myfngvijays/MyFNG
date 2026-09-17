import type { DailyBlogTopic } from '@/lib/blog/dailyTopics';
import { DAILY_CITY_THANE, type DailyTargetCity } from '@/lib/blog/dailyCities';

export const BATCH_BLOG_RUN_KEY = '2026-09-17';

export type BatchBlogTopic = DailyBlogTopic & {
  news?: boolean;
};

/** Same local phrases in every 17 Sep 2026 Thane car-service post. */
export const THANE_BATCH_KEYWORDS = [
  'car service in Thane',
  'car service in Wagle Estate',
  'car service in Manpada',
  'car service in Ghodbunder Road',
  'car service in Vartak Nagar',
  'car service in Majiwada',
  'car service in Naupada',
  'car service in Hiranandani Estate',
  'car garage Thane',
  'periodic car service Thane',
  'car pickup and drop Thane',
  'car mechanic near me Thane',
] as const;

export const THANE_BATCH_CITY: DailyTargetCity = {
  ...DAILY_CITY_THANE,
  keywords: [...THANE_BATCH_KEYWORDS],
};

/** Thane-only car-service batch (17 Sep 2026). No RSA / CNG / EV / launch posts. */
export const BATCH_BLOG_TOPICS: BatchBlogTopic[] = [
  { topic: 'Periodic car service interval for Thane daily traffic', focusKeyword: 'periodic car service Thane', intent: 'Local / Navigational' },
  { topic: 'What a complete car service includes and what is extra', focusKeyword: 'complete car service Thane', intent: 'Commercial/Transactional' },
  { topic: 'Engine oil change: when city traffic needs it earlier', focusKeyword: 'engine oil change Thane', intent: 'Commercial/Transactional' },
  { topic: '5W-30 vs 5W-40: which engine oil your workshop should use', focusKeyword: 'engine oil grade', intent: 'Informational' },
  { topic: 'Air filter clogged by dust: signs, replacement and cost', focusKeyword: 'car air filter replacement', intent: 'Commercial/Transactional' },
  { topic: 'Cabin filter change for AC smell and allergy in the city', focusKeyword: 'cabin filter replacement', intent: 'Informational' },
  { topic: 'Fuel filter clogged: hesitation, smell and when to replace', focusKeyword: 'car fuel filter replacement', intent: 'Commercial/Transactional' },
  { topic: 'Spark plug replacement: misfire, mileage and hard start', focusKeyword: 'spark plug replacement', intent: 'Commercial/Transactional' },
  { topic: 'Low engine oil warning: top-up vs full oil service', focusKeyword: 'low engine oil service', intent: 'Commercial/Transactional' },
  { topic: 'Oil leak under the parked car: gasket, drain plug or sump', focusKeyword: 'car oil leak', intent: 'Informational' },
  { topic: 'Coolant colour change and radiator flush: when it is due', focusKeyword: 'radiator flush', intent: 'Commercial/Transactional' },
  { topic: 'Car overheating only in Ghodbunder Road traffic', focusKeyword: 'car overheating in traffic', intent: 'Commercial/Transactional' },
  { topic: 'Thermostat stuck: heater, temperature gauge and fan', focusKeyword: 'car thermostat replacement', intent: 'Informational' },
  { topic: 'Water pump leak: early drip vs engine overheating risk', focusKeyword: 'car water pump leak', intent: 'Commercial/Transactional' },
  { topic: 'Brake pad replacement: squeal, dust and stopping distance', focusKeyword: 'brake pad replacement', intent: 'Commercial/Transactional' },
  { topic: 'Spongy brake pedal: fluid, air in line or master cylinder', focusKeyword: 'spongy brake pedal', intent: 'Informational' },
  { topic: 'Brake fluid change interval after monsoon and hill roads', focusKeyword: 'brake fluid change', intent: 'Informational' },
  { topic: 'Stuck brake caliper: one wheel hot after a short drive', focusKeyword: 'stuck brake caliper', intent: 'Commercial/Transactional' },
  { topic: 'Wheel alignment after potholes on Ghodbunder Road', focusKeyword: 'wheel alignment Thane', intent: 'Local / Navigational' },
  { topic: 'Tyre rotation pattern that actually extends tyre life', focusKeyword: 'tyre rotation', intent: 'Informational' },
  { topic: 'Wheel balancing after a puncture repair', focusKeyword: 'wheel balancing', intent: 'Commercial/Transactional' },
  { topic: 'Uneven tyre wear: alignment, pressure or worn bushes', focusKeyword: 'uneven tyre wear', intent: 'Informational' },
  { topic: 'Spare tyre unused for years: pressure, rust and age', focusKeyword: 'spare tyre check', intent: 'Informational' },
  { topic: 'Battery health test before the next unexpected no-start', focusKeyword: 'car battery health test', intent: 'Commercial/Transactional' },
  { topic: 'Alternator not charging: dim lights and battery warning', focusKeyword: 'car alternator not charging', intent: 'Commercial/Transactional' },
  { topic: 'Starter motor click but engine does not crank', focusKeyword: 'starter motor not cranking', intent: 'Informational' },
  { topic: 'Parasitic battery drain: which workshop test to ask for', focusKeyword: 'car battery drain test', intent: 'Informational' },
  { topic: 'OBD scan during periodic service: what codes actually mean', focusKeyword: 'car OBD scan', intent: 'Informational' },
  { topic: 'Dashboard warning lights a Thane workshop should explain', focusKeyword: 'car warning lights service', intent: 'Informational' },
  { topic: 'AC not cooling in Thane humidity: gas, condenser or fan', focusKeyword: 'car AC service Thane', intent: 'Commercial/Transactional' },
  { topic: 'Weak AC blower: cabin filter, resistor or blower motor', focusKeyword: 'car AC blower weak', intent: 'Commercial/Transactional' },
  { topic: 'AC condenser cleaning after dusty Wagle Estate roads', focusKeyword: 'car AC condenser cleaning', intent: 'Local / Navigational' },
  { topic: 'Clutch bite point high: lining wear vs cable adjustment', focusKeyword: 'clutch bite point high', intent: 'Commercial/Transactional' },
  { topic: 'Gear oil change for manual cars used in stop-go traffic', focusKeyword: 'manual gear oil change', intent: 'Informational' },
  { topic: 'Automatic transmission fluid colour: pink, brown or burnt', focusKeyword: 'ATF colour check', intent: 'Informational' },
  { topic: 'CV joint click on lock-to-lock turns: boot tear vs joint', focusKeyword: 'CV joint click', intent: 'Commercial/Transactional' },
  { topic: 'Wheel bearing hum that gets louder with speed', focusKeyword: 'wheel bearing noise', intent: 'Informational' },
  { topic: 'Shock absorber leak after speed breakers in Majiwada', focusKeyword: 'shock absorber leak', intent: 'Commercial/Transactional' },
  { topic: 'Stabilizer link knock on small bumps: cheap part, big rattle', focusKeyword: 'stabilizer link noise', intent: 'Commercial/Transactional' },
  { topic: 'Control arm bush wear: wander, tyre wear and clunk', focusKeyword: 'control arm bush', intent: 'Informational' },
  { topic: 'Steering rack leak: oily boots and heavy parking turns', focusKeyword: 'steering rack leak', intent: 'Commercial/Transactional' },
  { topic: 'Power steering flush vs top-up: when fluid change is due', focusKeyword: 'power steering flush', intent: 'Informational' },
  { topic: 'Wiper not cleaning glass in heavy rain: blades vs motor', focusKeyword: 'car wiper service', intent: 'Informational' },
  { topic: 'Headlight condensation and dim beam after night drives', focusKeyword: 'headlight condensation', intent: 'Informational' },
  { topic: 'Central locking not working on one door: actuator or key', focusKeyword: 'central locking not working', intent: 'Commercial/Transactional' },
  { topic: 'Power window slow or stuck: regulator, switch or motor', focusKeyword: 'power window repair', intent: 'Commercial/Transactional' },
  { topic: 'Exhaust silencer rust and hanging pipe after monsoon', focusKeyword: 'exhaust silencer rust', intent: 'Local / Navigational' },
  { topic: 'Multi-point inspection before you approve extra jobs', focusKeyword: 'car multi point inspection', intent: 'Informational' },
  { topic: 'How car pickup and drop works from Wagle Estate and Manpada', focusKeyword: 'car pickup and drop Thane', intent: 'Commercial/Transactional' },
  { topic: 'How to book trusted car service in Thane on the MyFNG app', focusKeyword: 'book car service Thane', intent: 'Local / Navigational' },
];

export function batchBlogKey(index: number) {
  return `batch-${BATCH_BLOG_RUN_KEY}-${String(index).padStart(2, '0')}`;
}
