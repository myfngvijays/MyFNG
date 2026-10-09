import type { DailyBlogTopic } from '@/lib/blog/dailyTopics';
import { DAILY_CITY_THANE, type DailyTargetCity } from '@/lib/blog/dailyCities';
import { THANE_BLOG_KEYWORDS } from '@/lib/blog/localSeo';

export const BATCH_BLOG_RUN_KEY = '2026-10-09';

export type BatchBlogTopic = DailyBlogTopic & {
  news?: boolean;
};

/** Exact phrases in every Thane car-service post. Do not shorten or re-case them. */
export const THANE_BATCH_KEYWORDS = [...THANE_BLOG_KEYWORDS];

export const THANE_BATCH_CITY: DailyTargetCity = {
  ...DAILY_CITY_THANE,
  keywords: [...THANE_BATCH_KEYWORDS],
};

/** Thane car-owner problems (9 Oct 2026). Each post keeps the approved title. */
export const BATCH_BLOG_TOPICS: BatchBlogTopic[] = [
  { topic: 'Brake Squeal on Daily Thane Traffic Runs', focusKeyword: 'brake squeal', intent: 'Commercial/Transactional' },
  { topic: 'Car Jerks When Accelerating in Thane Traffic', focusKeyword: 'car jerks when accelerating', intent: 'Commercial/Transactional' },
  { topic: 'Car AC Not Cooling in Thane Afternoon Heat', focusKeyword: 'car AC not cooling', intent: 'Commercial/Transactional' },
  { topic: 'Engine Oil Smell Inside the Cabin in Thane', focusKeyword: 'engine oil smell in cabin', intent: 'Informational' },
  { topic: 'Car Battery Dies After Short Trips in Thane', focusKeyword: 'car battery dies', intent: 'Commercial/Transactional' },
  { topic: 'Clutch Feels Hard in Thane Stop-Go Traffic', focusKeyword: 'hard clutch pedal', intent: 'Commercial/Transactional' },
  { topic: 'White Smoke From the Exhaust on Thane Roads', focusKeyword: 'white smoke from exhaust', intent: 'Informational' },
  { topic: 'Steering Feels Heavy While Parking in Thane', focusKeyword: 'heavy steering while parking', intent: 'Commercial/Transactional' },
  { topic: 'Car Overheats Only in Thane Traffic Jams', focusKeyword: 'car overheats in traffic', intent: 'Commercial/Transactional' },
  { topic: 'Vibration in the Seat at Speed in Thane', focusKeyword: 'seat vibration at speed', intent: 'Informational' },
  { topic: 'Brake Pedal Feels Soft After Rain in Thane', focusKeyword: 'soft brake pedal', intent: 'Commercial/Transactional' },
  { topic: 'One Headlight Dimmer Than the Other in Thane', focusKeyword: 'dim headlight', intent: 'Commercial/Transactional' },
  { topic: 'Grinding Noise When You Brake in Thane Traffic', focusKeyword: 'grinding noise when braking', intent: 'Commercial/Transactional' },
  { topic: 'Car Won\'t Start After Office Parking in Thane', focusKeyword: 'car will not start', intent: 'Commercial/Transactional' },
  { topic: 'Milky Engine Oil After Short Runs in Thane', focusKeyword: 'milky engine oil', intent: 'Informational' },
  { topic: 'Tyres Wearing on the Inner Edge in Thane', focusKeyword: 'inner tyre wear', intent: 'Commercial/Transactional' },
  { topic: 'AC Smell When You Switch It On in Thane', focusKeyword: 'AC smell', intent: 'Commercial/Transactional' },
  { topic: 'Gear Slips Out While Climbing a Flyover in Thane', focusKeyword: 'gear slips out', intent: 'Commercial/Transactional' },
  { topic: 'Knock From the Front Wheel Over Thane Bumps', focusKeyword: 'front wheel knock', intent: 'Commercial/Transactional' },
  { topic: 'Petrol Smell Around a Parked Car in Thane', focusKeyword: 'petrol smell', intent: 'Informational' },
  { topic: 'Wipers Smear the Windscreen in Thane Rain', focusKeyword: 'wipers smear windscreen', intent: 'Commercial/Transactional' },
  { topic: 'Car Pulls Right After a Kerb Hit in Thane', focusKeyword: 'car pulls right', intent: 'Commercial/Transactional' },
  { topic: 'Coolant Level Keeps Dropping on Thane Runs', focusKeyword: 'coolant level dropping', intent: 'Informational' },
  { topic: 'Rattle From the Dashboard on Bumps in Thane', focusKeyword: 'dashboard rattle', intent: 'Informational' },
  { topic: 'Hard Gear Shift in Morning Traffic in Thane', focusKeyword: 'hard gear shift', intent: 'Commercial/Transactional' },
  { topic: 'Brake Dust on Alloys After City Runs in Thane', focusKeyword: 'brake dust on alloys', intent: 'Informational' },
  { topic: 'Engine Hesitates When You Overtake in Thane', focusKeyword: 'engine hesitates', intent: 'Commercial/Transactional' },
  { topic: 'Weak Car Horn During Thane Monsoon Drives', focusKeyword: 'weak car horn', intent: 'Commercial/Transactional' },
  { topic: 'Power Window Stuck Halfway Down in Thane', focusKeyword: 'power window stuck', intent: 'Commercial/Transactional' },
  { topic: 'Exhaust Noise Louder Than Usual in Thane', focusKeyword: 'loud exhaust', intent: 'Commercial/Transactional' },
  { topic: 'Car Shakes When the AC Turns On in Thane', focusKeyword: 'car shakes when AC on', intent: 'Commercial/Transactional' },
  { topic: 'Oil Patch Under the Parked Car in Thane', focusKeyword: 'oil patch under car', intent: 'Informational' },
  { topic: 'Steering Wheel Off-Centre After a Bump in Thane', focusKeyword: 'steering wheel off centre', intent: 'Commercial/Transactional' },
  { topic: 'Burning Smell After a Hill Climb in Thane', focusKeyword: 'burning smell after climb', intent: 'Informational' },
  { topic: 'Boot Floor Wet After Rain Parking in Thane', focusKeyword: 'wet boot floor', intent: 'Informational' },
  { topic: 'Clicking Sound on Full Steering Turn in Thane', focusKeyword: 'clicking on full turn', intent: 'Commercial/Transactional' },
  { topic: 'Idle RPM Hunts at a Red Light in Thane', focusKeyword: 'idle RPM hunting', intent: 'Informational' },
  { topic: 'Brake Warning Light On After a Wash in Thane', focusKeyword: 'brake warning light', intent: 'Informational' },
  { topic: 'One Door Not Locking With the Key in Thane', focusKeyword: 'door not locking', intent: 'Commercial/Transactional' },
  { topic: 'Foggy Windshield That Wipers Miss in Thane', focusKeyword: 'foggy windshield', intent: 'Informational' },
  { topic: 'Suspension Knock on Speed Breakers in Thane', focusKeyword: 'suspension knock', intent: 'Commercial/Transactional' },
  { topic: 'Car Takes Longer to Start in Thane Mornings', focusKeyword: 'slow morning start', intent: 'Commercial/Transactional' },
  { topic: 'Black Smoke When You Accelerate in Thane', focusKeyword: 'black smoke when accelerating', intent: 'Informational' },
  { topic: 'Handbrake Not Holding on a Slope in Thane', focusKeyword: 'handbrake not holding', intent: 'Commercial/Transactional' },
  { topic: 'Car Pulls When Braking in Wet Thane Traffic', focusKeyword: 'car pulls when braking', intent: 'Commercial/Transactional' },
  { topic: 'AC Vents Blowing Weak Air in a Thane Cabin', focusKeyword: 'weak AC airflow', intent: 'Commercial/Transactional' },
  { topic: 'Metallic Noise From the Engine Bay in Thane', focusKeyword: 'metallic engine noise', intent: 'Informational' },
  { topic: 'Tyre Pressure Dropping Every Week in Thane', focusKeyword: 'tyre pressure dropping', intent: 'Informational' },
  { topic: 'Squeak From the Clutch Pedal on Thane Runs', focusKeyword: 'clutch pedal squeak', intent: 'Commercial/Transactional' },
  { topic: 'Check Engine Light After a Thane Traffic Jam', focusKeyword: 'check engine light', intent: 'Informational' },
];

export function batchBlogKey(index: number) {
  return `batch-${BATCH_BLOG_RUN_KEY}-${String(index).padStart(2, '0')}`;
}
