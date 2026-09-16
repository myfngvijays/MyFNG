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
  { topic: 'Car jerking while changing gears: clutch, mounts or fuel issue', focusKeyword: 'car jerking gears', intent: 'Informational' },
  { topic: 'ABS light on: can you still drive and what a workshop should check', focusKeyword: 'ABS light on', intent: 'Commercial/Transactional' },
  { topic: 'Car pulling to one side: alignment, tyre wear or brake drag', focusKeyword: 'car pulling to one side', intent: 'Informational' },
  { topic: 'White smoke vs black smoke from exhaust: what it usually means', focusKeyword: 'car exhaust smoke', intent: 'Informational' },
  { topic: 'Car AC smell after monsoon: cabin filter, coil or drain blockage', focusKeyword: 'car AC smell', intent: 'Commercial/Transactional' },
  { topic: 'How often should you replace the cabin air filter in city traffic', focusKeyword: 'cabin air filter replacement', intent: 'Informational' },
  { topic: 'Low engine oil warning: top-up vs full oil change', focusKeyword: 'low engine oil', intent: 'Commercial/Transactional' },
  { topic: 'Car battery lasting only one year: charging, idle or weak cell', focusKeyword: 'car battery life', intent: 'Informational' },
  { topic: 'Jump start vs battery replacement: when a boost is not enough', focusKeyword: 'car jump start', intent: 'Informational' },
  { topic: 'Squeaking brakes after rain: pads, discs or rust film', focusKeyword: 'squeaking car brakes', intent: 'Commercial/Transactional' },
  { topic: 'Handbrake not holding on a slope: cable, shoes or rear pads', focusKeyword: 'handbrake not working', intent: 'Commercial/Transactional' },
  { topic: 'Power steering heavy or noisy: fluid, pump or belt', focusKeyword: 'power steering problem', intent: 'Commercial/Transactional' },
  { topic: 'Car vibrating at idle but smooth on the highway', focusKeyword: 'car vibrating idle', intent: 'Informational' },
  { topic: 'Check engine light flashing vs steady: stop now or book soon', focusKeyword: 'check engine light', intent: 'Informational' },
  { topic: 'Car overheating only in traffic: radiator fan, coolant or thermostat', focusKeyword: 'car overheating in traffic', intent: 'Commercial/Transactional' },
  { topic: 'Water leaking inside the cabin after a car wash', focusKeyword: 'car cabin water leak', intent: 'Informational' },
  { topic: 'Wiper not cleaning glass: blades, washer jet or linkage', focusKeyword: 'car wiper not working', intent: 'Informational' },
  { topic: 'Headlight dim at night: bulb, earth or charging system', focusKeyword: 'dim car headlights', intent: 'Commercial/Transactional' },
  { topic: 'Car key fob not unlocking: battery, pairing or door lock motor', focusKeyword: 'car key not working', intent: 'Informational' },
  { topic: 'Automatic car jerking in first gear: ATF, mount or software', focusKeyword: 'automatic car jerking', intent: 'Commercial/Transactional' },
  { topic: 'Manual car hard to shift in the morning: clutch fluid or cable', focusKeyword: 'hard gear shift', intent: 'Informational' },
  { topic: 'Tyre puncture vs sidewall bulge: when you must replace not repair', focusKeyword: 'tyre puncture repair', intent: 'Informational' },
  { topic: 'Alloy wheel kerb damage: cosmetic vs alignment risk', focusKeyword: 'alloy wheel repair', intent: 'Commercial/Transactional' },
  { topic: 'Car detailing vs interior dry clean: what actually removes odour', focusKeyword: 'car detailing vs dry clean', intent: 'Informational' },
  { topic: 'Underbody rust after monsoon: wash, wax or workshop treatment', focusKeyword: 'car underbody rust', intent: 'Local / Navigational' },
  { topic: 'Car not picking up speed: air filter, plugs or clutch slip', focusKeyword: 'car not picking speed', intent: 'Informational' },
  { topic: 'High fuel consumption after service: reset, driving or a real fault', focusKeyword: 'high fuel consumption', intent: 'Informational' },
  { topic: 'Fuel filter clogged: hesitation, smell and when to replace', focusKeyword: 'car fuel filter replacement', intent: 'Commercial/Transactional' },
  { topic: 'Diesel car black smoke on pickup: injector, filter or turbo', focusKeyword: 'diesel black smoke', intent: 'Commercial/Transactional' },
  { topic: 'Petrol car knocking sound: fuel quality, timing or carbon', focusKeyword: 'car engine knocking', intent: 'Informational' },
  { topic: 'Car stalling at signals: idle, sensor or dirty throttle', focusKeyword: 'car stalling at signals', intent: 'Informational' },
  { topic: 'Reverse camera not working after rain: camera, wiring or screen', focusKeyword: 'reverse camera not working', intent: 'Commercial/Transactional' },
  { topic: 'Infotainment restarting on bumps: loose connector or battery dip', focusKeyword: 'car infotainment restarting', intent: 'Informational' },
  { topic: 'Seat belt warning beeping with no passenger: sensor or buckle', focusKeyword: 'seat belt warning beep', intent: 'Informational' },
  { topic: 'Car door not closing properly: striker, latch or rubber seal', focusKeyword: 'car door not closing', intent: 'Informational' },
  { topic: 'Window going down but not up: regulator, switch or motor', focusKeyword: 'car window not going up', intent: 'Commercial/Transactional' },
  { topic: 'Sunroof leaking or rattling: drain tubes vs glass seal', focusKeyword: 'sunroof leaking', intent: 'Commercial/Transactional' },
  { topic: 'Car insurance claim after a small dent: workshop photos that help', focusKeyword: 'car insurance dent claim', intent: 'Informational' },
  { topic: 'How to read a car service invoice: labour, parts and GST', focusKeyword: 'car service invoice', intent: 'Informational' },
  { topic: 'OEM vs OES spare parts: what MyFNG uses and why it matters', focusKeyword: 'OEM vs OES parts', intent: 'Informational' },
  { topic: 'Free pickup and drop vs driving to the garage in office hours', focusKeyword: 'car service pickup drop', intent: 'Commercial/Transactional' },
  { topic: 'What photos and videos you should get before approving extra jobs', focusKeyword: 'approve extra car work', intent: 'Informational' },
  { topic: 'Car service starts from 1500: what is included and what is extra', focusKeyword: 'car service starts from 1500', intent: 'Commercial/Transactional' },
  { topic: '1 month 1000 km service warranty: what it covers and what it does not', focusKeyword: 'car service warranty', intent: 'Informational' },
  { topic: 'How to keep car service history in the app after every workshop visit', focusKeyword: 'car service history app', intent: 'Informational' },
  { topic: 'Same-day car service: jobs that finish today vs jobs that need parts', focusKeyword: 'same day garage service', intent: 'Commercial/Transactional' },
  { topic: 'Festival travel car check: brakes, tyres, lights and AC before the trip', focusKeyword: 'festival car checkup', intent: 'Local / Navigational' },
  { topic: 'Diwali garage rush: when to book pickup so the car is back on time', focusKeyword: 'Diwali car service', intent: 'Local / Navigational' },
  { topic: 'Winter morning hard start in India: battery, oil grade or glow plugs', focusKeyword: 'car hard start winter', intent: 'Informational' },
  { topic: 'Summer tyre burst risk: pressure, load and highway heat', focusKeyword: 'tyre burst summer', intent: 'Informational' },
  { topic: 'Manual vs automatic service: what a workshop checks differently', focusKeyword: 'manual vs automatic service', intent: 'Informational' },
  { topic: 'Second car sitting unused: battery, brakes and mice damage to check', focusKeyword: 'unused car maintenance', intent: 'Informational' },
  { topic: 'Family car with kids: cabin filter, AC and child-seat anchor check', focusKeyword: 'family car service', intent: 'Informational' },
  { topic: 'Office commuter hatchback: 10,000 km service that actually matters', focusKeyword: 'hatchback periodic service', intent: 'Commercial/Transactional' },
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
