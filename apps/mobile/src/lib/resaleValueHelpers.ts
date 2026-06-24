import type { CityRow } from './compareServicePricing';
import { formatInrRange } from './smartToolsLogic';

export type ResaleCondition = 'excellent' | 'good' | 'fair' | 'poor';
export type ResaleCityTier = 'metro' | 'tier2' | 'other';
export type ResaleServiceRecords = 'yes' | 'partial' | 'no';
export type ResaleTyreCondition = 'good' | 'fair' | 'replace';
export type ResaleBodyPaint = 'original' | 'minor' | 'major';
export type ResaleMonthlyRunning = '<500' | '500-1000' | '1000-2000' | '2000+';
export type ResaleLastService = '<3' | '3-6' | '6-12' | '12+' | 'dont_remember';

export type ResaleFormInput = {
  make: string;
  model: string;
  variant?: string;
  modelId?: string;
  vehicleClass?: string | null;
  vehicleNumber?: string;
  regYear: number;
  fuel: string;
  transmission: 'manual' | 'automatic';
  km: number;
  owners: number;
  condition: ResaleCondition;
  hadAccident: boolean;
  insuranceValid: boolean;
  serviceRecords: ResaleServiceRecords;
  tyreCondition: ResaleTyreCondition;
  bodyPaint: ResaleBodyPaint;
  hypothecation: boolean;
  duplicateKey: boolean;
  monthlyRunning: ResaleMonthlyRunning;
  lastService: ResaleLastService;
  cityName: string;
  cityTier: ResaleCityTier;
};

export type ResaleEstimate = { low: number; mid: number; high: number };

export type ResaleSession = {
  step: 'result';
  savedAt: number;
  selectedCar: {
    label: string;
    make: string;
    model: string;
    modelId?: string;
    vehicleClass?: string | null;
    vehicleId?: string;
  };
  form: {
    regYear?: number;
    fuel: string;
    transmission: 'manual' | 'automatic';
    km: string;
    owners: string;
    variant: string;
    condition: ResaleCondition;
    hadAccident: string;
    insuranceValid: string;
    serviceRecords: ResaleServiceRecords;
    tyreCondition: ResaleTyreCondition;
    bodyPaint: ResaleBodyPaint;
    hypothecation: string;
    duplicateKey: string;
    monthlyRunning: ResaleMonthlyRunning;
    lastService: ResaleLastService;
  };
  formInput: ResaleFormInput;
  estimate: ResaleEstimate;
  cityName: string;
  detectedLabel: string;
  selectedCity?: { id: string; name: string; state?: string | null } | null;
};

const METRO_KEYWORDS = [
  'mumbai',
  'delhi',
  'new delhi',
  'bangalore',
  'bengaluru',
  'chennai',
  'hyderabad',
  'kolkata',
  'pune',
  'ahmedabad',
  'thane',
  'navi mumbai',
  'gurgaon',
  'gurugram',
  'noida',
  'faridabad',
  'ghaziabad',
];

const TIER2_KEYWORDS = [
  'nashik',
  'surat',
  'jaipur',
  'lucknow',
  'kanpur',
  'nagpur',
  'indore',
  'bhopal',
  'visakhapatnam',
  'kochi',
  'coimbatore',
  'vadodara',
  'rajkot',
  'goa',
  'panaji',
  'aurangabad',
  'solapur',
  'kolhapur',
  'amritsar',
  'chandigarh',
  'ludhiana',
  'patna',
  'ranchi',
  'bhubaneswar',
  'cuttack',
  'mysore',
  'mangalore',
  'trivandrum',
  'thiruvananthapuram',
];

export function resolveCityTier(cityName: string): ResaleCityTier {
  const n = String(cityName || '').toLowerCase();
  if (METRO_KEYWORDS.some((k) => n.includes(k))) return 'metro';
  if (TIER2_KEYWORDS.some((k) => n.includes(k))) return 'tier2';
  return 'other';
}

export function cityLine(city: CityRow | null, fallbackLabel?: string): string {
  if (city) return `${city.name}${city.state ? `, ${city.state}` : ''}`;
  return fallbackLabel || 'your city';
}

function labelMonthlyRunning(v: ResaleMonthlyRunning): string {
  if (v === '<500') return 'Under 500 km';
  if (v === '500-1000') return '500 - 1000 km';
  if (v === '1000-2000') return '1000 - 2000 km';
  return '2000+ km';
}

function labelLastService(v: ResaleLastService): string {
  if (v === '<3') return 'Under 3 months';
  if (v === '3-6') return '3 - 6 months';
  if (v === '6-12') return '6 - 12 months';
  if (v === '12+') return '12+ months';
  return "Don't remember";
}

export function buildValuationText(input: ResaleFormInput, estimate: ResaleEstimate): string {
  const lines = [
    'MyFNG Car Resale Value Estimate',
    '--------------------------------',
    `Vehicle: ${input.make} ${input.model}`,
    input.variant ? `Variant: ${input.variant}` : null,
    input.vehicleNumber ? `Reg: ${input.vehicleNumber}` : null,
    input.vehicleClass ? `Class: ${input.vehicleClass}` : null,
    `Year: ${input.regYear}`,
    `Fuel: ${input.fuel}`,
    `Transmission: ${input.transmission}`,
    `Odometer: ${input.km.toLocaleString('en-IN')} km`,
    `Monthly running: ${labelMonthlyRunning(input.monthlyRunning)}`,
    `Owners: ${input.owners}`,
    `Condition: ${input.condition}`,
    `Tyres: ${input.tyreCondition}`,
    `Body & paint: ${input.bodyPaint}`,
    `Major accident: ${input.hadAccident ? 'Yes' : 'No'}`,
    `Insurance valid: ${input.insuranceValid ? 'Yes' : 'No'}`,
    `Service records: ${input.serviceRecords}`,
    `Last service: ${labelLastService(input.lastService)}`,
    `Loan/hypothecation: ${input.hypothecation ? 'Active' : 'Clear'}`,
    `Duplicate key: ${input.duplicateKey ? 'Yes' : 'No'}`,
    `City: ${input.cityName} (${input.cityTier})`,
    '',
    `Estimated range: ${formatInrRange(estimate.low, estimate.high)}`,
    `Mid estimate: ₹${estimate.mid.toLocaleString('en-IN')}`,
    '',
    'Indicative range only. Final price may change after physical inspection.',
  ];
  return lines.filter(Boolean).join('\n');
}

export function resaleTips(input: ResaleFormInput): string[] {
  const tips: string[] = [];
  if (input.condition === 'fair' || input.condition === 'poor') {
    tips.push('A pre-sale detailing and minor fixes can improve buyer offers.');
  }
  if (input.tyreCondition === 'replace' || input.tyreCondition === 'fair') {
    tips.push('Fresh tyres often help close deals faster.');
  }
  if (!input.insuranceValid) {
    tips.push('Renew insurance before listing - buyers prefer a transfer-ready car.');
  }
  if (input.hypothecation) {
    tips.push('Close hypothecation/NOC before handover to avoid deal delays.');
  }
  if (input.serviceRecords === 'no' || input.lastService === '12+' || input.lastService === 'dont_remember') {
    tips.push('A recent service history from MyFNG can boost buyer confidence.');
  }
  if (tips.length === 0) {
    tips.push('Your car profile looks strong for resale. A quick inspection can confirm the best asking price.');
  }
  return tips.slice(0, 3);
}
