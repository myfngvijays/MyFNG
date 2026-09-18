import type { DailyBlogTopic } from '@/lib/blog/dailyTopics';

export const PACKAGE_EDU_BLOG_RUN_KEY = '2026-09-18-packages';

export const PACKAGE_EDUCATION_FACTS = [
  'Use ONLY these MyFNG periodic packages. Do not invent other package names or point counts.',
  'Basic Service = 15 points: Clean Air Filter; Spark Plugs Servicing; Top up Brake Oil; Top up Gear Oil; Top up Power Steering Oil & Clutch Oil (if applicable); Top up Coolant; Top up Battery Water; Top up Wiper Water Tank; Replace Oil Filter; Replace Engine Oil; Clean Cabin AC Filter; Interior Vacuuming; Grease Door Hinges; Inspect & Top up Tyre Pressure; Body Wash.',
  'General Service = 30 points: everything in Basic plus Check Brake Pads; Check Brake Fluid; Check Suspension; Check Tyre Condition; Wheel Alignment Check; Battery Terminal Cleaning; Check Alternator Belt; Check Radiator Cap; Check Windshield Wipers; Check Horn; Check All Lights; Check AC Performance; Check Steering System; Test Drive; Final Inspection.',
  'Premium Service = 50 points: everything in General plus belt/hose checks; clutch play check; Battery Load Testing; Battery Terminal Coating; AC Filter Replace; AC Cooling / Gas Leak Test; AC disinfectant; door locks; front/rear brake cleaning and caliper pin lubrication; brake line bleeding; hand brake setting; comprehensive report.',
  'Platinum Service = 60 points: everything in Premium plus Engine Compression Test; Fuel System Cleaning; Throttle Body Cleaning; EGR Valve Cleaning; interior deep clean; leather conditioning; headlight restoration; paint protection; underbody coating; premium wash & wax.',
  'Basic does NOT include brake pad check, suspension check, alignment, battery load test, AC gas leak test, diagnostics scan, compression test, fuel/throttle/EGR cleaning.',
  'Battery water top-up is Basic. Battery load testing is Premium. A no-start the next day can be a weak battery that Basic never tested.',
  'Brake oil top-up is Basic. Brake pad check is General. Brake pad cleaning is Premium.',
  'Cabin AC filter clean is Basic. AC performance check is General. AC cooling / gas leak test is Premium.',
  'Tyre pressure top-up is Basic. Tyre condition and wheel alignment check start at General.',
  'Engine stall / misfire after Basic is often fuel, throttle, EGR or compression — Platinum points 51–54 — not a failed oil change.',
  'Extra parts or repairs outside the booked package start only after photo/video proof and customer approval.',
  'Do not invent package prices. Service starts from ₹1,500 and varies by car and inspection.',
];

export const PACKAGE_EDUCATION_TOPICS: DailyBlogTopic[] = [
  {
    topic: 'Basic service has only 15 points: why the car can still break down after it',
    focusKeyword: 'basic car service 15 points',
    intent: 'Informational',
  },
  {
    topic: 'You booked Basic and the battery died next day: load test is not in 15 points',
    focusKeyword: 'battery died after basic service',
    intent: 'Informational',
  },
  {
    topic: 'Brakes failed after periodic service: Basic tops up oil, pad check starts at General',
    focusKeyword: 'brakes after basic car service',
    intent: 'Informational',
  },
  {
    topic: 'Car stalled after Basic service: compression and EGR are Platinum jobs',
    focusKeyword: 'car stalled after basic service',
    intent: 'Informational',
  },
  {
    topic: 'AC not cooling after a 15-point service: cabin filter clean is not a gas leak test',
    focusKeyword: 'AC not cooling after basic service',
    intent: 'Informational',
  },
  {
    topic: 'What MyFNG periodic packages include: Basic 15 vs General 30 vs Premium 50 vs Platinum 60',
    focusKeyword: 'periodic service packages 15 30 50 60',
    intent: 'Commercial/Transactional',
  },
  {
    topic: 'Car pulls or knocks after Basic service: alignment and suspension are not in 15 points',
    focusKeyword: 'car pulling after basic service',
    intent: 'Informational',
  },
  {
    topic: 'A lower periodic package cannot promise no problem after service',
    focusKeyword: 'periodic service package limits',
    intent: 'Informational',
  },
  {
    topic: 'Dashboard light after Basic service: inspection vs repair vs a higher package',
    focusKeyword: 'warning light after basic service',
    intent: 'Informational',
  },
  {
    topic: 'Before you blame the workshop: match the complaint to the package you paid for',
    focusKeyword: 'blame workshop after basic service',
    intent: 'Informational',
  },
];

export function packageEducationBlogKey(index: number) {
  return `pkg-edu-${PACKAGE_EDU_BLOG_RUN_KEY}-${String(index).padStart(2, '0')}`;
}
