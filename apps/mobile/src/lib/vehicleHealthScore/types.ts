export type Category =
  | 'ENGINE'
  | 'TRANSMISSION'
  | 'COOLING_AC'
  | 'ELECTRICAL'
  | 'BRAKES'
  | 'TYRES'
  | 'SUSPENSION'
  | 'COMPLIANCE'
  | 'MAINTENANCE';

export type DimensionName = 'SAFETY' | 'MECHANICAL' | 'MAINTENANCE' | 'COMPLIANCE';

export type FuelType = 'Petrol' | 'Diesel' | 'CNG' | 'Electric' | 'Hybrid';

export type TransmissionType = 'Manual' | 'AMT' | 'Automatic' | 'DCT';

export interface RcData {
  regNumber: string;
  make: string;
  model: string;
  variant?: string;
  registrationYear: number;
  fuel: FuelType;
  insuranceValidTill?: string;
  pucValidTill?: string;
  challansPending?: 'yes' | 'no' | 'unknown';
}

export interface HealthCheckInput {
  odometer: number;
  odometer_last_service?: number;
  transmission: TransmissionType;
  monthly_running?: string;
  driving_type?: 'city' | 'highway' | 'mixed';
  area_condition?: 'coastal' | 'flood' | 'normal';
  parking?: 'covered' | 'open';
  last_service_months?: '<3' | '3-6' | '6-12' | '12+' | 'dont_remember';
  service_provider?: 'authorized' | 'local' | 'myfng' | 'self' | 'not_regular';
  service_timing?: 'on_schedule' | 'often_delayed';
  recent_major_jobs?: { job: string; monthsAgo?: number }[];
  symptoms: string[];
  warningLights: string[];
  tyre_condition?: string[];
  battery_age?: number;
  battery_slow_crank?: boolean;
  wiper_smear?: boolean;
  tyre_last_change?: { years?: number; km?: number };
  insurance_valid_till?: string;
  puc_valid_till?: string;
  challans_pending?: 'yes' | 'no' | 'unknown';
}

export interface CategoryScore {
  category: Category;
  score: number;
  band: 'GREEN' | 'AMBER' | 'RED';
  reason: string;
}

export interface DimensionScore {
  name: DimensionName;
  label: string;
  score: number;
  band: 'GREEN' | 'AMBER' | 'RED';
}

export interface PredictiveItem {
  item: string;
  status: 'overdue' | 'due_soon';
  deduction: number;
  cta: string;
}

export interface Recommendation {
  title: string;
  severity: 'RED' | 'AMBER' | 'INFO';
  category: Category | 'PREDICTIVE';
  reason: string;
  ctaType: string;
}

export interface HealthReport {
  composite: number;
  band: { label: string; color: string; summary: string };
  dimensions: DimensionScore[];
  categories: CategoryScore[];
  predictive: PredictiveItem[];
  recommendations: Recommendation[];
  accuracy: 'BASIC' | 'GOOD' | 'DETAILED';
  generatedAt: number;
  odometer: number;
}

export type HealthWizardStep =
  | 'intro'
  | 'rc'
  | 'vehicle_confirm'
  | 'basics'
  | 'usage'
  | 'service'
  | 'symptoms'
  | 'wear'
  | 'warning_lights'
  | 'compliance'
  | 'generating'
  | 'report';
