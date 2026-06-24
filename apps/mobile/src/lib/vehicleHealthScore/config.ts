import type { Category, FuelType } from './types';

export const BRAND = {
  primaryBlue: '#023D95',
  secondaryBlue: '#0088E8',
  black: '#000000',
  white: '#FFFFFF',
};

export const SCORE_COLORS = {
  GREEN: '#1B9E5A',
  AMBER: '#E8A317',
  ORANGE: '#E8730C',
  RED: '#C0392B',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  ENGINE: 'Engine',
  TRANSMISSION: 'Transmission / Clutch',
  COOLING_AC: 'Cooling & AC',
  ELECTRICAL: 'Battery & Electrical',
  BRAKES: 'Brakes',
  TYRES: 'Tyres',
  SUSPENSION: 'Suspension & Steering',
  COMPLIANCE: 'Compliance',
  MAINTENANCE: 'Maintenance',
};

export const DIMENSION_LABELS = {
  SAFETY: 'Safety',
  MECHANICAL: 'Mechanical',
  MAINTENANCE: 'Maintenance & Cost',
  COMPLIANCE: 'Compliance',
} as const;

export const DEDUCTIONS: Record<string, { category: Category; points: number }[]> = {
  check_engine_light: [{ category: 'ENGINE', points: 30 }],
  knocking_ticking: [{ category: 'ENGINE', points: 25 }],
  smoke_white: [{ category: 'ENGINE', points: 22 }, { category: 'COOLING_AC', points: 10 }],
  smoke_blue: [{ category: 'ENGINE', points: 20 }],
  smoke_black: [{ category: 'ENGINE', points: 12 }],
  rough_idle_stall: [{ category: 'ENGINE', points: 18 }],
  hard_starting: [{ category: 'ENGINE', points: 15 }],
  power_loss: [{ category: 'ENGINE', points: 15 }],
  mileage_drop: [{ category: 'ENGINE', points: 10 }],
  leak_black_brown: [{ category: 'ENGINE', points: 15 }],
  light_oil: [{ category: 'ENGINE', points: 25 }],
  trans_slipping: [{ category: 'TRANSMISSION', points: 28 }],
  trans_jerks: [{ category: 'TRANSMISSION', points: 18 }],
  trans_shift_delay: [{ category: 'TRANSMISSION', points: 18 }],
  clutch_slip_hard: [{ category: 'TRANSMISSION', points: 22 }],
  gear_hard_engage: [{ category: 'TRANSMISSION', points: 15 }],
  leak_red: [{ category: 'TRANSMISSION', points: 15 }, { category: 'SUSPENSION', points: 8 }],
  temp_gauge_high: [{ category: 'COOLING_AC', points: 28 }],
  light_temp: [{ category: 'COOLING_AC', points: 25 }],
  coolant_frequent_topup: [{ category: 'COOLING_AC', points: 18 }],
  leak_green_orange: [{ category: 'COOLING_AC', points: 20 }],
  ac_not_cooling: [{ category: 'COOLING_AC', points: 10 }],
  light_battery: [{ category: 'ELECTRICAL', points: 25 }],
  battery_slow_crank: [{ category: 'ELECTRICAL', points: 15 }],
  electrical_glitches: [{ category: 'ELECTRICAL', points: 10 }],
  wiper_smear: [{ category: 'ELECTRICAL', points: 4 }],
  brake_soft_pedal: [{ category: 'BRAKES', points: 28 }],
  brake_grinding_squeal: [{ category: 'BRAKES', points: 25 }],
  light_abs: [{ category: 'BRAKES', points: 20 }],
  brake_vibration: [{ category: 'BRAKES', points: 18 }],
  brake_pulls_side: [{ category: 'BRAKES', points: 18 }],
  light_brake: [{ category: 'BRAKES', points: 22 }],
  tyre_cracks_bulges: [{ category: 'TYRES', points: 30 }],
  tyre_low_tread: [{ category: 'TYRES', points: 20 }],
  light_tpms: [{ category: 'TYRES', points: 10 }],
  susp_clunk_bumps: [{ category: 'SUSPENSION', points: 18 }],
  steer_vibration_speed: [{ category: 'SUSPENSION', points: 15 }],
  pulls_straight: [{ category: 'SUSPENSION', points: 15 }],
  uneven_tyre_wear: [{ category: 'SUSPENSION', points: 12 }, { category: 'TYRES', points: 15 }],
  light_power_steering: [{ category: 'SUSPENSION', points: 18 }],
  insurance_expired: [{ category: 'COMPLIANCE', points: 45 }],
  insurance_expiring_30d: [{ category: 'COMPLIANCE', points: 20 }],
  puc_expired: [{ category: 'COMPLIANCE', points: 25 }],
  puc_expiring_15d: [{ category: 'COMPLIANCE', points: 10 }],
  challans_pending: [{ category: 'COMPLIANCE', points: 15 }],
  service_overdue: [{ category: 'MAINTENANCE', points: 25 }],
  service_6_12: [{ category: 'MAINTENANCE', points: 10 }],
  service_often_delayed: [{ category: 'MAINTENANCE', points: 10 }],
  service_not_regular: [{ category: 'MAINTENANCE', points: 15 }],
};

export const SIGNAL_LABELS: Record<string, string> = {
  check_engine_light: 'Check engine light on',
  knocking_ticking: 'Engine knocking or ticking noise',
  smoke_white: 'White smoke from exhaust',
  smoke_blue: 'Blue smoke from exhaust',
  smoke_black: 'Black smoke from exhaust',
  rough_idle_stall: 'Rough idle or stalling',
  hard_starting: 'Hard to start',
  power_loss: 'Loss of power while driving',
  mileage_drop: 'Fuel mileage has dropped',
  leak_black_brown: 'Oil leak under car',
  light_oil: 'Engine oil warning light',
  trans_slipping: 'Transmission slipping',
  trans_jerks: 'Jerky gear shifts',
  trans_shift_delay: 'Delayed gear shifts',
  clutch_slip_hard: 'Clutch slipping or hard pedal',
  gear_hard_engage: 'Hard to engage gears',
  leak_red: 'Red fluid leak',
  temp_gauge_high: 'Temperature gauge runs high',
  light_temp: 'Engine temperature warning light',
  coolant_frequent_topup: 'Coolant needs frequent top-up',
  leak_green_orange: 'Coolant leak',
  ac_not_cooling: 'AC not cooling well',
  light_battery: 'Battery warning light',
  battery_slow_crank: 'Slow cranking in the morning',
  electrical_glitches: 'Electrical glitches (windows/lights)',
  wiper_smear: 'Wipers smearing',
  brake_soft_pedal: 'Soft or spongy brake pedal',
  brake_grinding_squeal: 'Brake grinding or squealing',
  light_abs: 'ABS warning light',
  brake_vibration: 'Brake pedal vibration',
  brake_pulls_side: 'Car pulls to one side under braking',
  light_brake: 'Brake warning light',
  tyre_cracks_bulges: 'Tyre cracks or bulges',
  tyre_low_tread: 'Low tyre tread',
  light_tpms: 'Tyre pressure warning light',
  susp_clunk_bumps: 'Clunk over bumps',
  steer_vibration_speed: 'Steering vibration at speed',
  pulls_straight: 'Pulls left or right on straight road',
  uneven_tyre_wear: 'Uneven tyre wear',
  light_power_steering: 'Power steering warning light',
  insurance_expired: 'Insurance expired',
  insurance_expiring_30d: 'Insurance expiring within 30 days',
  puc_expired: 'PUC expired',
  puc_expiring_15d: 'PUC expiring within 15 days',
  challans_pending: 'Pending traffic challans',
  service_overdue: 'Service overdue',
  service_6_12: 'Last service 6-12 months ago',
  service_often_delayed: 'Service often delayed',
  service_not_regular: 'Irregular service history',
};

export const WEIGHTS = {
  SAFETY: { weight: 0.35, cats: { BRAKES: 0.4, TYRES: 0.3, SUSPENSION: 0.3 } },
  MECHANICAL: {
    weight: 0.3,
    cats: { ENGINE: 0.4, TRANSMISSION: 0.25, COOLING_AC: 0.2, ELECTRICAL: 0.15 },
  },
  MAINTENANCE: { weight: 0.2, cats: { MAINTENANCE: 1.0 } },
  COMPLIANCE: { weight: 0.15, cats: { COMPLIANCE: 1.0 } },
} as const;

export const PREDICTIVE_RULES = [
  { item: 'Periodic / major service', kmThreshold: 10000, yrThreshold: 1, overduePts: 12, dueSoonPts: 6, cta: 'BOOK_SERVICE', resetBy: 'service' },
  { item: 'Brake pads', kmThreshold: 40000, yrThreshold: null, overduePts: 12, dueSoonPts: 6, cta: 'BOOK_INSPECTION', resetBy: 'brakes' },
  { item: 'Tyres', kmThreshold: 50000, yrThreshold: 5, overduePts: 12, dueSoonPts: 6, cta: 'BOOK_INSPECTION', resetBy: 'tyres' },
  { item: 'Battery health', kmThreshold: null, yrThreshold: 3.5, overduePts: 10, dueSoonPts: 5, cta: 'BOOK_INSPECTION', resetBy: 'battery' },
  { item: 'Clutch (manual)', kmThreshold: 80000, yrThreshold: null, overduePts: 12, dueSoonPts: 6, cta: 'BOOK_INSPECTION', resetBy: 'clutch', manualOnly: true },
  { item: 'Timing belt (if belt-driven)', kmThreshold: 90000, yrThreshold: 5, overduePts: 12, dueSoonPts: 6, cta: 'BOOK_INSPECTION', resetBy: 'timing belt' },
  { item: 'Suspension (bushes/struts)', kmThreshold: 80000, yrThreshold: 6, overduePts: 10, dueSoonPts: 5, cta: 'BOOK_INSPECTION', resetBy: 'suspension' },
  { item: 'Coolant flush', kmThreshold: 40000, yrThreshold: 2, overduePts: 8, dueSoonPts: 4, cta: 'BOOK_SERVICE', resetBy: 'service' },
  { item: 'Brake fluid', kmThreshold: 40000, yrThreshold: 2, overduePts: 8, dueSoonPts: 4, cta: 'BOOK_SERVICE', resetBy: 'service' },
  { item: 'Transmission oil (AT)', kmThreshold: 40000, yrThreshold: null, overduePts: 8, dueSoonPts: 4, cta: 'BOOK_SERVICE', autoOnly: true },
  { item: 'AC service', kmThreshold: null, yrThreshold: 2, overduePts: 5, dueSoonPts: 3, cta: 'BOOK_SERVICE', resetBy: 'AC compressor' },
] as const;

export interface EngineSchedule {
  label: string;
  periodicServiceKm: number;
  periodicServiceMonths: number;
  engineOilKm: number;
  engineOilMonths: number;
  timingDrive: 'chain' | 'belt' | 'verify';
  timingBeltKm?: number;
  sparkPlugKm?: number;
  fuelFilterKm?: number;
  coolantKm: number;
  coolantMonths: number;
  brakeFluidKm: number;
  brakeFluidMonths: number;
  transOilKmAuto?: number;
  fuel: FuelType;
}

export const MODEL_TO_ENGINE: Record<string, string> = {
  'maruti ertiga': 'msil_k15c',
  'maruti brezza': 'msil_k15c',
  'maruti xl6': 'msil_k15c',
  'maruti swift': 'msil_z12e',
  'maruti dzire': 'msil_z12e',
  'maruti baleno': 'msil_k12n',
  'hyundai creta': 'hmil_g15_mpi',
  'hyundai venue': 'hmil_kappa_12',
  'hyundai i20': 'hmil_kappa_12',
  'honda city': 'hmc_l15',
  'honda amaze': 'hmc_l12',
  'tata nexon': 'tml_revotron_12',
  'mahindra xuv300': 'mahindra_mstallion_12',
};

export const ENGINE_SCHEDULES: Record<string, EngineSchedule> = {
  msil_k15c: {
    label: 'Maruti K15C 1.5 Petrol',
    fuel: 'Petrol',
    periodicServiceKm: 10000,
    periodicServiceMonths: 12,
    engineOilKm: 10000,
    engineOilMonths: 12,
    timingDrive: 'chain',
    sparkPlugKm: 100000,
    coolantKm: 100000,
    coolantMonths: 60,
    brakeFluidKm: 40000,
    brakeFluidMonths: 24,
  },
  hmc_l15: {
    label: 'Honda L15 1.5 i-VTEC',
    fuel: 'Petrol',
    periodicServiceKm: 10000,
    periodicServiceMonths: 12,
    engineOilKm: 10000,
    engineOilMonths: 12,
    timingDrive: 'chain',
    sparkPlugKm: 100000,
    coolantKm: 100000,
    coolantMonths: 60,
    brakeFluidKm: 40000,
    brakeFluidMonths: 24,
  },
  tml_revotron_12: {
    label: 'Tata Revotron 1.2 Turbo Petrol',
    fuel: 'Petrol',
    periodicServiceKm: 15000,
    periodicServiceMonths: 12,
    engineOilKm: 15000,
    engineOilMonths: 12,
    timingDrive: 'verify',
    sparkPlugKm: 60000,
    coolantKm: 60000,
    coolantMonths: 36,
    brakeFluidKm: 45000,
    brakeFluidMonths: 24,
  },
};

export const BRAND_DEFAULTS: Record<string, Partial<EngineSchedule>> = {
  maruti: { periodicServiceKm: 10000, periodicServiceMonths: 12 },
  hyundai: { periodicServiceKm: 10000, periodicServiceMonths: 12 },
  honda: { periodicServiceKm: 10000, periodicServiceMonths: 12 },
  tata: { periodicServiceKm: 15000, periodicServiceMonths: 12 },
};

export const GENERIC_DEFAULT: Record<string, EngineSchedule> = {
  Petrol: {
    label: 'Generic Petrol',
    fuel: 'Petrol',
    periodicServiceKm: 10000,
    periodicServiceMonths: 12,
    engineOilKm: 10000,
    engineOilMonths: 12,
    timingDrive: 'verify',
    coolantKm: 40000,
    coolantMonths: 24,
    brakeFluidKm: 40000,
    brakeFluidMonths: 24,
  },
  Diesel: {
    label: 'Generic Diesel',
    fuel: 'Diesel',
    periodicServiceKm: 10000,
    periodicServiceMonths: 12,
    engineOilKm: 10000,
    engineOilMonths: 12,
    timingDrive: 'verify',
    fuelFilterKm: 40000,
    coolantKm: 40000,
    coolantMonths: 24,
    brakeFluidKm: 40000,
    brakeFluidMonths: 24,
  },
};

export const WEAR_BASELINES = {
  brakePadsKm: 40000,
  clutchKm: 80000,
  tyresKm: 50000,
  tyresYears: 5,
  suspensionKm: 80000,
  suspensionYears: 6,
  batteryYears: 3.5,
};

export const SYMPTOM_GROUPS: Array<{ title: string; items: { id: string; label: string }[] }> = [
  {
    title: 'Engine',
    items: [
      { id: 'check_engine_light', label: 'Check engine light on' },
      { id: 'hard_starting', label: 'Hard to start' },
      { id: 'rough_idle_stall', label: 'Rough idle or stalling' },
      { id: 'power_loss', label: 'Loss of power' },
      { id: 'knocking_ticking', label: 'Knocking / ticking noise' },
      { id: 'smoke_white', label: 'White smoke' },
      { id: 'smoke_blue', label: 'Blue smoke' },
      { id: 'smoke_black', label: 'Black smoke' },
      { id: 'mileage_drop', label: 'Mileage drop' },
    ],
  },
  {
    title: 'Transmission',
    items: [
      { id: 'clutch_slip_hard', label: 'Clutch slipping / hard pedal' },
      { id: 'gear_hard_engage', label: 'Hard to engage gears' },
      { id: 'trans_jerks', label: 'Jerky shifts (Auto)' },
      { id: 'trans_shift_delay', label: 'Delayed shifts (Auto)' },
      { id: 'trans_slipping', label: 'Transmission slipping (Auto)' },
    ],
  },
  {
    title: 'Brakes',
    items: [
      { id: 'brake_grinding_squeal', label: 'Grinding or squealing' },
      { id: 'brake_vibration', label: 'Pedal vibration' },
      { id: 'brake_soft_pedal', label: 'Soft / spongy pedal' },
      { id: 'brake_pulls_side', label: 'Pulls to one side' },
    ],
  },
  {
    title: 'Suspension & Steering',
    items: [
      { id: 'susp_clunk_bumps', label: 'Clunk over bumps' },
      { id: 'steer_vibration_speed', label: 'Steering vibration at speed' },
      { id: 'pulls_straight', label: 'Pulls on straight road' },
      { id: 'uneven_tyre_wear', label: 'Uneven tyre wear' },
    ],
  },
  {
    title: 'Cooling & AC',
    items: [
      { id: 'temp_gauge_high', label: 'Temp gauge runs high' },
      { id: 'coolant_frequent_topup', label: 'Coolant top-up often' },
      { id: 'ac_not_cooling', label: 'AC not cooling' },
    ],
  },
  {
    title: 'Leaks under car',
    items: [
      { id: 'leak_black_brown', label: 'Black / brown (oil)' },
      { id: 'leak_red', label: 'Red (ATF / steering)' },
      { id: 'leak_green_orange', label: 'Green / orange (coolant)' },
    ],
  },
  {
    title: 'Electrical',
    items: [{ id: 'electrical_glitches', label: 'Windows / locks / lights glitching' }],
  },
];

export const WARNING_LIGHTS = [
  { id: 'light_check_engine', label: 'Check Engine', mapsTo: 'check_engine_light' },
  { id: 'light_battery', label: 'Battery' },
  { id: 'light_oil', label: 'Engine Oil' },
  { id: 'light_temp', label: 'Temperature' },
  { id: 'light_abs', label: 'ABS' },
  { id: 'light_airbag', label: 'Airbag' },
  { id: 'light_brake', label: 'Brake' },
  { id: 'light_tpms', label: 'Tyre Pressure' },
  { id: 'light_power_steering', label: 'Power Steering' },
];

export const CTA_LABELS: Record<string, string> = {
  BOOK_INSPECTION: 'Book Free Inspection',
  BOOK_SERVICE: 'Book Service',
  INSURANCE_HELP: 'Get Insurance Help',
  ADD_TO_CART: 'Add to Cart',
};
