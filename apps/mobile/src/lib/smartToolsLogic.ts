export type HealthOption = { label: string; score: number; value: string };

export type HealthStep = {
  id: string;
  question: string;
  hint?: string;
  options: HealthOption[];
  showIf?: (answers: Record<string, string>) => boolean;
};

export const HEALTH_STEPS: HealthStep[] = [
  {
    id: 'service_gap',
    question: 'How long since your last service?',
    hint: 'Regular servicing keeps your car healthy.',
    options: [
      { label: '0–3 months', score: 0, value: '0-3' },
      { label: '3–6 months', score: 8, value: '3-6' },
      { label: '6–12 months', score: 18, value: '6-12' },
      { label: 'Over 12 months', score: 30, value: '12+' },
    ],
  },
  {
    id: 'warning_light',
    question: 'Does any dashboard warning light come on?',
    options: [
      { label: 'No', score: 0, value: 'no' },
      { label: 'Sometimes', score: 12, value: 'sometimes' },
      { label: 'Always on', score: 25, value: 'always' },
    ],
  },
  {
    id: 'warning_which',
    question: 'Which warning light appears on the dashboard?',
    showIf: (a) => a.warning_light === 'sometimes' || a.warning_light === 'always',
    options: [
      { label: 'Check Engine', score: 8, value: 'check_engine' },
      { label: 'Battery / Charging', score: 6, value: 'battery' },
      { label: 'Engine Oil', score: 10, value: 'oil' },
      { label: 'ABS / Brake', score: 12, value: 'abs' },
      { label: 'Airbag (SRS)', score: 14, value: 'airbag' },
      { label: 'Tyre Pressure (TPMS)', score: 4, value: 'tpms' },
      { label: 'Other / Multiple', score: 10, value: 'other' },
    ],
  },
  {
    id: 'brakes',
    question: 'How do your brakes feel while driving?',
    options: [
      { label: 'Strong & smooth', score: 0, value: 'good' },
      { label: 'Soft pedal or noise', score: 10, value: 'soft' },
      { label: 'Weak or vibration', score: 22, value: 'weak' },
    ],
  },
  {
    id: 'tyres',
    question: 'What is the condition of your tyres?',
    options: [
      { label: 'Good tread depth', score: 0, value: 'good' },
      { label: 'Moderate wear', score: 8, value: 'avg' },
      { label: 'Worn or cracked', score: 18, value: 'poor' },
    ],
  },
  {
    id: 'ac',
    question: 'How is your AC cooling performance?',
    options: [
      { label: 'Excellent', score: 0, value: 'good' },
      { label: 'Reduced cooling', score: 6, value: 'low' },
      { label: 'Not cooling', score: 14, value: 'dead' },
    ],
  },
  {
    id: 'mileage',
    question: 'Have you noticed a drop in fuel mileage?',
    options: [
      { label: 'No drop', score: 0, value: 'no' },
      { label: 'Slight drop', score: 7, value: 'slight' },
      { label: 'Significant drop', score: 15, value: 'high' },
    ],
  },
  {
    id: 'sounds',
    question: 'Any unusual noise from engine or suspension?',
    options: [
      { label: 'None', score: 0, value: 'no' },
      { label: 'Occasionally', score: 8, value: 'sometimes' },
      { label: 'Frequently', score: 16, value: 'often' },
    ],
  },
  {
    id: 'battery',
    question: 'How old is your car battery?',
    options: [
      { label: 'Under 1 year', score: 0, value: '0-1' },
      { label: '1–2 years', score: 5, value: '1-2' },
      { label: '2–3 years', score: 10, value: '2-3' },
      { label: 'Over 3 years', score: 18, value: '3+' },
    ],
  },
];

export function getVisibleHealthSteps(answers: Record<string, string>): HealthStep[] {
  return HEALTH_STEPS.filter((step) => !step.showIf || step.showIf(answers));
}

export function computeHealthScoreFromAnswers(answers: Record<string, string>): number {
  const visible = getVisibleHealthSteps(answers);
  let penalty = 0;
  for (const step of visible) {
    const val = answers[step.id];
    const opt = step.options.find((o) => o.value === val);
    if (opt) penalty += opt.score;
  }
  return Math.max(0, Math.min(100, 100 - penalty));
}

export function healthGrade(score: number): { label: string; color: string; tip: string } {
  if (score >= 85) return { label: 'Excellent', color: '#059669', tip: 'Your car is in great shape. Keep up with scheduled service.' };
  if (score >= 70) return { label: 'Good', color: '#2563EB', tip: 'Minor checks may be due. A basic inspection is recommended.' };
  if (score >= 50) return { label: 'Fair', color: '#D97706', tip: 'Some components need attention. Book a service soon.' };
  return { label: 'Needs Attention', color: '#DC2626', tip: 'Your car needs a workshop check. Book via Misa AI today.' };
}

export function formatInr(n: number): string {
  return `₹${Math.round(n).toLocaleString('en-IN')}`;
}

export function formatInrRange(low: number, high: number): string {
  return `${formatInr(low)} – ${formatInr(high)}`;
}

export type PeriodicPackageCompare = {
  id: string;
  name: string;
  checkpoints: number;
  highlights: string[];
  authorisedLow: number;
  authorisedHigh: number;
  myfngLow: number;
  myfngHigh: number;
  discountLabel: string;
};

export const PERIODIC_PACKAGES: PeriodicPackageCompare[] = [
  {
    id: 'basic',
    name: 'Basic Service',
    checkpoints: 15,
    highlights: ['Engine oil change', 'Oil filter', 'Brake inspection', 'Fluid top-up'],
    authorisedLow: 3500,
    authorisedHigh: 5500,
    myfngLow: 2199,
    myfngHigh: 2999,
    discountLabel: 'Save up to 35%',
  },
  {
    id: 'general',
    name: 'General Service',
    checkpoints: 30,
    highlights: ['Everything in Basic', 'Air filter clean', 'Battery check', 'AC inspection'],
    authorisedLow: 5200,
    authorisedHigh: 7800,
    myfngLow: 3299,
    myfngHigh: 4499,
    discountLabel: 'Save up to 38%',
  },
  {
    id: 'premium',
    name: 'Premium Service',
    checkpoints: 50,
    highlights: ['Everything in General', 'Diagnostics scan', 'Fuel system check', 'Interior vacuum'],
    authorisedLow: 7800,
    authorisedHigh: 11500,
    myfngLow: 4999,
    myfngHigh: 6499,
    discountLabel: 'Save up to 40%',
  },
  {
    id: 'platinum',
    name: 'Platinum Service',
    checkpoints: 60,
    highlights: ['Everything in Premium', 'Seat shampoo', 'Machine polish', 'Engine dressing'],
    authorisedLow: 10500,
    authorisedHigh: 15500,
    myfngLow: 6499,
    myfngHigh: 8499,
    discountLabel: 'Save up to 42%',
  },
];

export const OTHER_SERVICE_COMPARE: Record<
  string,
  { name: string; authorisedLow: number; authorisedHigh: number; myfngLow: number; myfngHigh: number; points: string[] }
> = {
  ac: { name: 'AC Service', authorisedLow: 2800, authorisedHigh: 4500, myfngLow: 1699, myfngHigh: 2499, points: ['Gas check', 'Coil cleaning', 'Blower service'] },
  brakes: { name: 'Brake Service', authorisedLow: 6500, authorisedHigh: 9800, myfngLow: 3999, myfngHigh: 5999, points: ['Pad inspection', 'Disc check', 'Brake fluid'] },
  engine: { name: 'Engine Care', authorisedLow: 4500, authorisedHigh: 8500, myfngLow: 2799, myfngHigh: 4999, points: ['Engine flush', 'Spark plug', 'Tune-up'] },
  battery: { name: 'Battery Service', authorisedLow: 3200, authorisedHigh: 7500, myfngLow: 2499, myfngHigh: 5499, points: ['Health check', 'Terminal clean', 'Replacement option'] },
  tyre: { name: 'Tyre & Wheel', authorisedLow: 1800, authorisedHigh: 3500, myfngLow: 999, myfngHigh: 1799, points: ['Alignment', 'Balancing', 'Rotation'] },
};

export function estimateResaleValue(input: {
  brand: string;
  year: number;
  fuel: string;
  km: number;
  owners: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  cityTier: 'metro' | 'tier2' | 'other';
  hadAccident: boolean;
}): { low: number; high: number; mid: number } {
  const brandMultipliers: Record<string, number> = {
    maruti: 1,
    hyundai: 1.05,
    tata: 0.95,
    mahindra: 0.98,
    honda: 1.08,
    toyota: 1.15,
    kia: 1.02,
    volkswagen: 0.9,
    skoda: 0.88,
    bmw: 1.4,
    mercedes: 1.5,
    audi: 1.35,
    nissan: 0.92,
    renault: 0.9,
    ford: 0.88,
    jeep: 1.1,
    mg: 0.95,
    citroen: 0.88,
  };
  const brandKey = Object.keys(brandMultipliers).find((k) => input.brand.toLowerCase().includes(k)) || 'other';
  const brandMul = brandMultipliers[brandKey] ?? 0.85;
  const age = Math.max(0, new Date().getFullYear() - input.year);
  const baseNewPrice =
    input.fuel === 'diesel' ? 950000 : input.fuel === 'cng' ? 780000 : input.fuel === 'ev' ? 1400000 : 850000;

  let value = baseNewPrice * brandMul;
  value *= Math.pow(0.88, age);
  value *= Math.max(0.42, 1 - input.km / 250000);

  const conditionMul = { excellent: 1.08, good: 1, fair: 0.88, poor: 0.72 }[input.condition];
  const ownerMul = input.owners <= 1 ? 1.04 : input.owners === 2 ? 0.96 : 0.88;
  const cityMul = { metro: 1.05, tier2: 1, other: 0.92 }[input.cityTier];
  const accidentMul = input.hadAccident ? 0.82 : 1;

  const mid = Math.round(value * conditionMul * ownerMul * cityMul * accidentMul);
  return { low: Math.round(mid * 0.9), high: Math.round(mid * 1.12), mid };
}

export type QuizQuestion = {
  q: string;
  options: string[];
  correct: number;
  brandLogo?: string;
  brandName?: string;
  category?: string;
};

export const CAR_QUIZ_POOL: QuizQuestion[] = [
  { q: 'What does ABS stand for?', options: ['Auto Brake System', 'Anti-lock Braking System', 'Active Balance System', 'Automatic Brake Support'], correct: 1, category: 'Safety' },
  { q: 'Which fluid is used in the engine cooling system?', options: ['Brake fluid', 'Coolant', 'Power steering fluid', 'AC gas'], correct: 1, category: 'Engine' },
  { q: 'What is the primary job of engine oil?', options: ['Cooling only', 'Lubrication & protection', 'Fuel combustion', 'Battery charging'], correct: 1, category: 'Engine' },
  { q: 'TPMS warning light indicates an issue with:', options: ['Engine timing', 'Tyre pressure', 'Transmission', 'Fuel pump'], correct: 1, category: 'Safety' },
  { q: 'Which brand is shown in the logo?', options: ['Hyundai', 'Honda', 'Toyota', 'Tata'], correct: 0, brandLogo: 'https://logo.clearbit.com/hyundai.com', brandName: 'Hyundai', category: 'Brands' },
  { q: 'Which brand is shown in the logo?', options: ['Maruti Suzuki', 'Mahindra', 'Kia', 'Skoda'], correct: 0, brandLogo: 'https://logo.clearbit.com/suzuki.com', brandName: 'Maruti', category: 'Brands' },
  { q: 'CNG stands for:', options: ['Compressed Natural Gas', 'Carbon Neutral Gas', 'Combined Nitrogen Gas', 'Controlled Natural Gear'], correct: 0, category: 'Fuel' },
  { q: 'When should tyre pressure ideally be checked?', options: ['When tyres are hot', 'On cold tyres regularly', 'Only after puncture', 'Once a year'], correct: 1, category: 'Maintenance' },
  { q: 'OBD port is mainly used for:', options: ['Music system', 'Vehicle diagnostics', 'GPS tracking', 'Tyre inflation'], correct: 1, category: 'Tech' },
  { q: 'Which part wears out and needs periodic replacement in brakes?', options: ['Brake disc only', 'Brake pads', 'Shock absorber', 'Alternator'], correct: 1, category: 'Brakes' },
  { q: 'ESP in cars helps with:', options: ['Fuel economy', 'Electronic stability', 'Seat comfort', 'Parking sensors'], correct: 1, category: 'Safety' },
  { q: 'Which brand is shown in the logo?', options: ['Toyota', 'Honda', 'Volkswagen', 'Ford'], correct: 1, brandLogo: 'https://logo.clearbit.com/honda.com', brandName: 'Honda', category: 'Brands' },
  { q: 'Alternator in a car is responsible for:', options: ['Starting engine only', 'Charging battery while driving', 'Cooling AC', 'Powering brakes'], correct: 1, category: 'Electrical' },
  { q: 'Wheel alignment issue commonly causes:', options: ['Better mileage', 'Uneven tyre wear', 'Louder horn', 'Faster acceleration'], correct: 1, category: 'Maintenance' },
  { q: 'Which is a sign of a weak battery?', options: ['Slow engine crank', 'Better AC cooling', 'Higher top speed', 'Smoother gear shift'], correct: 0, category: 'Electrical' },
  { q: 'Radiator cap should be opened when engine is:', options: ['Hot', 'Cold', 'Running at high RPM', 'Anytime'], correct: 1, category: 'Engine' },
  { q: 'Which brand is shown in the logo?', options: ['Tata Motors', 'Mahindra', 'Hyundai', 'Renault'], correct: 0, brandLogo: 'https://logo.clearbit.com/tatamotors.com', brandName: 'Tata', category: 'Brands' },
  { q: 'Cruise control is used to:', options: ['Maintain set speed', 'Increase brake force', 'Cool engine faster', 'Lock wheels'], correct: 0, category: 'Features' },
  { q: 'Power steering fluid is part of which system?', options: ['Brake', 'Steering', 'Exhaust', 'Ignition'], correct: 1, category: 'Maintenance' },
  { q: 'Which filter improves engine air intake quality?', options: ['Cabin filter', 'Air filter', 'Fuel cap', 'Oil cap'], correct: 1, category: 'Engine' },
  { q: 'Which brand is shown in the logo?', options: ['Kia', 'Toyota', 'Skoda', 'MG'], correct: 1, brandLogo: 'https://logo.clearbit.com/toyota.com', brandName: 'Toyota', category: 'Brands' },
  { q: 'Over-inflated tyres can cause:', options: ['Better grip always', 'Centre wear & harsh ride', 'More fuel always', 'No effect'], correct: 1, category: 'Tyres' },
  { q: 'HHC in automatic cars refers to:', options: ['Hill Hold Control', 'High Heat Cooling', 'Hybrid Hub Control', 'Handbrake Hold Circuit'], correct: 0, category: 'Features' },
  { q: 'Which liquid should NEVER be used as coolant substitute long-term?', options: ['Distilled water mix', 'Plain water only', 'OEM coolant mix', 'Approved antifreeze'], correct: 1, category: 'Engine' },
];

function seededIndex(seed: number, max: number): number {
  return Math.abs((seed * 9301 + 49297) % 233280) % max;
}

export function getDailyQuizQuestions(): QuizQuestion[] {
  const day = Math.floor(Date.now() / 86400000);
  const picked: QuizQuestion[] = [];
  const used = new Set<number>();
  let seed = day;
  while (picked.length < 8 && used.size < CAR_QUIZ_POOL.length) {
    const idx = seededIndex(seed, CAR_QUIZ_POOL.length);
    seed += 17;
    if (used.has(idx)) continue;
    used.add(idx);
    picked.push(CAR_QUIZ_POOL[idx]);
  }
  return picked;
}

export type PartCategory = {
  id: string;
  name: string;
  icon: string;
  parts: Array<{ name: string; low: number; high: number; note?: string }>;
};

export const PARTS_CATALOG: PartCategory[] = [
  {
    id: 'service',
    name: 'Service Consumables',
    icon: 'water',
    parts: [
      { name: 'Engine Oil + Filter', low: 1800, high: 4500 },
      { name: 'Air Filter', low: 450, high: 1800 },
      { name: 'Cabin AC Filter', low: 600, high: 2200 },
      { name: 'Spark Plugs (set)', low: 800, high: 3500 },
    ],
  },
  {
    id: 'brakes',
    name: 'Brakes',
    icon: 'disc',
    parts: [
      { name: 'Front Brake Pads', low: 2200, high: 6500 },
      { name: 'Rear Brake Pads', low: 1800, high: 5200 },
      { name: 'Brake Disc (each)', low: 2500, high: 8000 },
      { name: 'Brake Fluid Top-up', low: 400, high: 1200 },
    ],
  },
  {
    id: 'electrical',
    name: 'Electrical',
    icon: 'flash',
    parts: [
      { name: 'Car Battery 45Ah', low: 3500, high: 7500 },
      { name: 'Alternator', low: 6500, high: 18000 },
      { name: 'Headlight Assembly', low: 2500, high: 12000 },
      { name: 'Starter Motor', low: 4500, high: 14000 },
    ],
  },
  {
    id: 'suspension',
    name: 'Suspension',
    icon: 'car-sport',
    parts: [
      { name: 'Shock Absorber (each)', low: 2800, high: 8500 },
      { name: 'Lower Arm', low: 2200, high: 6500 },
      { name: 'Wheel Bearing', low: 1800, high: 5500 },
    ],
  },
  {
    id: 'ac',
    name: 'AC & Cooling',
    icon: 'snow',
    parts: [
      { name: 'AC Compressor', low: 12000, high: 28000 },
      { name: 'Radiator', low: 3500, high: 9000 },
      { name: 'Coolant Refill', low: 500, high: 1500 },
    ],
  },
  {
    id: 'tyres',
    name: 'Tyres & Wheels',
    icon: 'ellipse-outline',
    parts: [
      { name: 'Tyre (each)', low: 3500, high: 12000 },
      { name: 'Wheel Alignment', low: 600, high: 1500 },
      { name: 'Wheel Balancing (4)', low: 400, high: 1000 },
    ],
  },
];

export function partsBrandMultiplier(brand: string): number {
  const b = brand.toLowerCase();
  if (['bmw', 'mercedes', 'audi', 'volvo', 'jaguar'].some((x) => b.includes(x))) return 1.5;
  if (['toyota', 'honda', 'skoda', 'volkswagen'].some((x) => b.includes(x))) return 1.15;
  return 1;
}
