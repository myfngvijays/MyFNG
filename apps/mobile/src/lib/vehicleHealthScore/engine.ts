import {
  BRAND_DEFAULTS,
  CATEGORY_LABELS,
  DEDUCTIONS,
  DIMENSION_LABELS,
  ENGINE_SCHEDULES,
  GENERIC_DEFAULT,
  MODEL_TO_ENGINE,
  PREDICTIVE_RULES,
  SCORE_COLORS,
  SIGNAL_LABELS,
  WEAR_BASELINES,
  WEIGHTS,
  type EngineSchedule,
} from './config';
import type {
  Category,
  DimensionName,
  HealthCheckInput,
  HealthReport,
  PredictiveItem,
  RcData,
  Recommendation,
  TransmissionType,
} from './types';

const ALL_CATEGORIES: Category[] = [
  'ENGINE',
  'TRANSMISSION',
  'COOLING_AC',
  'ELECTRICAL',
  'BRAKES',
  'TYRES',
  'SUSPENSION',
  'COMPLIANCE',
  'MAINTENANCE',
];

function emptyReasons(): Record<Category, string[]> {
  return {
    ENGINE: [],
    TRANSMISSION: [],
    COOLING_AC: [],
    ELECTRICAL: [],
    BRAKES: [],
    TYRES: [],
    SUSPENSION: [],
    COMPLIANCE: [],
    MAINTENANCE: [],
  };
}

function round(n: number): number {
  return Math.round(n);
}

export function bandFor(score: number): 'GREEN' | 'AMBER' | 'RED' {
  if (score >= 75) return 'GREEN';
  if (score >= 50) return 'AMBER';
  return 'RED';
}

export function compositeBand(score: number): { label: string; color: string; summary: string } {
  if (score >= 80) {
    return {
      label: 'Healthy',
      color: SCORE_COLORS.GREEN,
      summary: 'Your car looks in good shape. Keep up routine service and preventive checks.',
    };
  }
  if (score >= 60) {
    return {
      label: 'Needs attention soon',
      color: SCORE_COLORS.AMBER,
      summary: 'A few areas need a closer look soon to avoid bigger repairs later.',
    };
  }
  if (score >= 40) {
    return {
      label: 'Service recommended',
      color: SCORE_COLORS.ORANGE,
      summary: 'Several systems may need service - booking an inspection is a good next step.',
    };
  }
  return {
    label: 'Urgent attention',
    color: SCORE_COLORS.RED,
    summary: 'Critical issues flagged - please book an inspection at the earliest.',
  };
}

export function getSchedule(make: string, model: string, fuel: string): EngineSchedule {
  const key = `${make} ${model}`.toLowerCase().trim();
  const code = MODEL_TO_ENGINE[key];
  if (code && ENGINE_SCHEDULES[code]) return ENGINE_SCHEDULES[code];
  const base = GENERIC_DEFAULT[fuel] ?? GENERIC_DEFAULT.Petrol;
  return { ...base, ...(BRAND_DEFAULTS[make.toLowerCase()] ?? {}) };
}

export function conditionMultiplier(input: HealthCheckInput): number {
  let m = 1.0;
  if (input.driving_type === 'city') m *= 0.75;
  if (input.driving_type === 'highway') m *= 1.15;
  if (input.area_condition === 'coastal') m *= 0.9;
  if (input.area_condition === 'flood') m *= 0.85;
  if (input.monthly_running === '2000+') m *= 0.95;
  return m;
}

function parseHealthDate(raw: string): Date | null {
  const s = raw.trim();
  if (!s) return null;
  const dmy = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
  if (dmy) {
    const [, dd, mm, yyyy] = dmy;
    const d = new Date(Number(yyyy), Number(mm) - 1, Number(dd));
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (iso) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const d = new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

function daysUntil(dateStr: string): number {
  const d = parseHealthDate(dateStr);
  if (!d) return 999;
  return (d.getTime() - Date.now()) / 86400000;
}

function signalLabel(id: string): string {
  return SIGNAL_LABELS[id] ?? id.replace(/_/g, ' ');
}

function mapWarningLightToSignal(lightId: string): string {
  if (lightId === 'light_check_engine') return 'check_engine_light';
  return lightId;
}

export function deriveFlags(
  input: HealthCheckInput,
  _vehicleAgeYears: number,
  kmSinceService: number | null,
): string[] {
  const flags: string[] = [];

  if (input.insurance_valid_till) {
    const d = daysUntil(input.insurance_valid_till);
    if (d < 0) flags.push('insurance_expired');
    else if (d <= 30) flags.push('insurance_expiring_30d');
  }
  if (input.puc_valid_till) {
    const d = daysUntil(input.puc_valid_till);
    if (d < 0) flags.push('puc_expired');
    else if (d <= 15) flags.push('puc_expiring_15d');
  }
  if (input.challans_pending === 'yes') flags.push('challans_pending');

  const overdue =
    input.last_service_months === '12+' ||
    (kmSinceService != null && kmSinceService > 10000);
  if (overdue) flags.push('service_overdue');
  else if (input.last_service_months === '6-12') flags.push('service_6_12');
  if (input.service_timing === 'often_delayed') flags.push('service_often_delayed');
  if (
    input.service_provider === 'self' ||
    input.service_provider === 'not_regular' ||
    input.last_service_months === 'dont_remember'
  ) {
    flags.push('service_not_regular');
  }

  if (input.tyre_condition?.includes('cracks_bulges')) flags.push('tyre_cracks_bulges');
  if (input.tyre_condition?.includes('low_tread')) flags.push('tyre_low_tread');
  if (input.battery_slow_crank) flags.push('battery_slow_crank');
  if (input.wiper_smear) flags.push('wiper_smear');

  return flags;
}

function isAutoTransmission(t: TransmissionType): boolean {
  return t === 'Automatic' || t === 'AMT' || t === 'DCT';
}

function jobRecentlyDone(
  recentJobs: HealthCheckInput['recent_major_jobs'],
  resetBy: string,
): boolean {
  if (!recentJobs?.length) return false;
  const needle = resetBy.toLowerCase();
  return recentJobs.some((j) => {
    const job = j.job.toLowerCase();
    const match =
      job.includes(needle) ||
      (needle.includes('battery') && job.includes('battery')) ||
      (needle.includes('clutch') && job.includes('clutch')) ||
      (needle.includes('tyre') && (job.includes('tyre') || job.includes('tire'))) ||
      (needle.includes('brake') && job.includes('brake')) ||
      (needle.includes('suspension') && job.includes('suspension')) ||
      (needle.includes('service') && job.includes('service')) ||
      (needle.includes('ac') && (job.includes('ac') || job.includes('compressor')));
    if (!match) return false;
    if (j.monthsAgo != null && j.monthsAgo > 24) return false;
    return true;
  });
}

type PredictiveRule = (typeof PREDICTIVE_RULES)[number];

function effectiveKmThreshold(rule: PredictiveRule, schedule: EngineSchedule, mult: number): number | null {
  if (rule.item.includes('Periodic')) return schedule.periodicServiceKm;
  if (rule.item.includes('Coolant')) return schedule.coolantKm;
  if (rule.item.includes('Brake fluid')) return schedule.brakeFluidKm;
  if (rule.item.includes('Transmission oil')) return schedule.transOilKmAuto ?? rule.kmThreshold;
  if (rule.item.includes('Brake pads')) return WEAR_BASELINES.brakePadsKm * mult;
  if (rule.item.includes('Tyres')) return WEAR_BASELINES.tyresKm * mult;
  if (rule.item.includes('Clutch')) return WEAR_BASELINES.clutchKm * mult;
  if (rule.item.includes('Suspension')) return WEAR_BASELINES.suspensionKm * mult;
  if (rule.item.includes('Timing belt')) return schedule.timingBeltKm ?? rule.kmThreshold ?? null;
  return rule.kmThreshold;
}

function effectiveYrThreshold(rule: PredictiveRule, schedule: EngineSchedule): number | null {
  if (rule.item.includes('Periodic')) return schedule.periodicServiceMonths / 12;
  if (rule.item.includes('Coolant')) return schedule.coolantMonths / 12;
  if (rule.item.includes('Brake fluid')) return schedule.brakeFluidMonths / 12;
  if (rule.item.includes('Tyres')) return WEAR_BASELINES.tyresYears;
  if (rule.item.includes('Battery')) return WEAR_BASELINES.batteryYears;
  if (rule.item.includes('Suspension')) return WEAR_BASELINES.suspensionYears;
  if (rule.item.includes('Timing belt')) return rule.yrThreshold;
  if (rule.item.includes('AC service')) return rule.yrThreshold;
  return rule.yrThreshold;
}

function evaluatePredictiveStatus(
  km: number | null | undefined,
  kmThreshold: number | null,
  ageYears: number,
  yrThreshold: number | null,
  kmSinceService: number | null,
  useServiceKm: boolean,
): 'overdue' | 'due_soon' | null {
  const compareKm = useServiceKm ? kmSinceService : km;
  if (kmThreshold != null && compareKm != null) {
    if (compareKm >= kmThreshold) return 'overdue';
    if (compareKm >= kmThreshold * 0.85 || compareKm >= kmThreshold - 3000) return 'due_soon';
  }
  if (yrThreshold != null) {
    if (ageYears >= yrThreshold) return 'overdue';
    if (ageYears >= yrThreshold - 2 / 12) return 'due_soon';
  }
  return null;
}

export function runPredictive(
  schedule: EngineSchedule,
  mult: number,
  vehicleAgeYears: number,
  odometer: number,
  kmSinceService: number | null,
  transmission: TransmissionType,
  recentJobs: HealthCheckInput['recent_major_jobs'],
  fuel: string,
  batteryAge?: number,
): PredictiveItem[] {
  const items: PredictiveItem[] = [];
  const isManual = transmission === 'Manual';
  const isAuto = isAutoTransmission(transmission);

  for (const rule of PREDICTIVE_RULES) {
    if ('manualOnly' in rule && rule.manualOnly && !isManual) continue;
    if ('autoOnly' in rule && rule.autoOnly && !isAuto) continue;

    if (rule.item.includes('Timing belt')) {
      if (schedule.timingDrive === 'chain') continue;
      if (schedule.timingDrive === 'verify') {
        items.push({
          item: 'Confirm timing belt vs chain',
          status: 'due_soon',
          deduction: 0,
          cta: 'BOOK_INSPECTION',
        });
        continue;
      }
    }

    if ('resetBy' in rule && rule.resetBy && jobRecentlyDone(recentJobs, rule.resetBy)) continue;

    const kmThreshold = effectiveKmThreshold(rule, schedule, mult);
    const yrThreshold = effectiveYrThreshold(rule, schedule);
    const useServiceKm = rule.item.includes('Periodic') || rule.item.includes('Coolant') || rule.item.includes('Brake fluid');

    let ageForRule = vehicleAgeYears;
    if (rule.item.includes('Battery') && batteryAge != null) ageForRule = batteryAge;
    if (rule.item.includes('Tyres') && recentJobs) {
      /* tyre_last_change handled via km on odometer baseline */
    }

    if (rule.item.includes('fuel filter') && fuel !== 'Diesel') continue;

    const status = evaluatePredictiveStatus(
      odometer,
      kmThreshold,
      ageForRule,
      yrThreshold,
      kmSinceService,
      useServiceKm,
    );
    if (!status) continue;

    items.push({
      item: rule.item,
      status,
      deduction: status === 'overdue' ? rule.overduePts : rule.dueSoonPts,
      cta: rule.cta,
    });
  }

  return items;
}

function ctaForCategory(category: Category, reasons: string[]): string {
  if (category === 'COMPLIANCE') {
    if (reasons.some((r) => r.toLowerCase().includes('insurance'))) return 'INSURANCE_HELP';
  }
  if (category === 'MAINTENANCE') return 'BOOK_SERVICE';
  if (category === 'COOLING_AC' && reasons.some((r) => r.toLowerCase().includes('ac'))) return 'ADD_TO_CART';
  if (category === 'ELECTRICAL' && reasons.some((r) => r.toLowerCase().includes('battery'))) return 'ADD_TO_CART';
  return 'BOOK_INSPECTION';
}

function buildRecommendations(
  cats: Record<Category, number>,
  reasons: Record<Category, string[]>,
  predictive: PredictiveItem[],
  input: HealthCheckInput,
): Recommendation[] {
  const recs: Recommendation[] = [];

  const sortedCats = ALL_CATEGORIES.filter((c) => bandFor(cats[c]) === 'RED' || bandFor(cats[c]) === 'AMBER').sort(
    (a, b) => cats[a] - cats[b],
  );

  const recTitles = new Set<string>();

  for (const cat of sortedCats) {
    const band = bandFor(cats[cat]);
    const reasonList = reasons[cat];
    const topReason = reasonList[0] ?? 'Issues reported in this area';
    recTitles.add(CATEGORY_LABELS[cat].toLowerCase());
    recs.push({
      title: CATEGORY_LABELS[cat],
      severity: band === 'RED' ? 'RED' : 'AMBER',
      category: cat,
      reason: topReason,
      ctaType: ctaForCategory(cat, reasonList),
    });
  }

  for (const p of predictive.filter((x) => x.status === 'overdue')) {
    const titleLower = p.item.toLowerCase();
    if (p.item.includes('Periodic') && recs.some((r) => r.category === 'MAINTENANCE')) continue;
    if (recTitles.has(titleLower)) continue;
    recTitles.add(titleLower);
    recs.push({
      title: p.item,
      severity: 'AMBER',
      category: 'PREDICTIVE',
      reason: 'Likely overdue based on age & km - not a detected fault.',
      ctaType: p.cta,
    });
  }

  if (recs.length === 0 && cats.COMPLIANCE < 100) {
    /* compliance-only edge */
  }

  if (
    recs.length === 0 &&
    Object.values(cats).every((s) => bandFor(s) === 'GREEN') &&
    input.odometer > 0
  ) {
    recs.push({
      title: 'Routine service',
      severity: 'INFO',
      category: 'MAINTENANCE',
      reason: 'No urgent issues flagged - stay on schedule with periodic service.',
      ctaType: 'BOOK_SERVICE',
    });
  }

  return recs;
}

export function accuracyLevel(input: HealthCheckInput): 'BASIC' | 'GOOD' | 'DETAILED' {
  let filled = 0;
  if (input.last_service_months) filled++;
  if (input.symptoms?.length || input.warningLights?.length) filled++;
  if (input.monthly_running && input.driving_type) filled++;
  if (input.tyre_condition?.length || input.battery_age != null) filled++;
  if (input.insurance_valid_till || input.puc_valid_till) filled++;
  if (filled <= 1) return 'BASIC';
  if (filled <= 3) return 'GOOD';
  return 'DETAILED';
}

export function accuracyHint(level: 'BASIC' | 'GOOD' | 'DETAILED'): string {
  if (level === 'DETAILED') return 'Detailed report - great job sharing your car details.';
  if (level === 'GOOD') return 'Answer 2–3 more sections for a more detailed report.';
  return 'Answer 3 more sections to improve accuracy.';
}

export function computeHealthReport(input: HealthCheckInput, rc: RcData): HealthReport {
  const vehicleAgeYears = Math.max(0, new Date().getFullYear() - rc.registrationYear);
  const kmSinceService =
    input.odometer != null && input.odometer_last_service != null
      ? input.odometer - input.odometer_last_service
      : null;

  const signals = new Set<string>([
    ...input.symptoms,
    ...input.warningLights.map(mapWarningLightToSignal),
    ...deriveFlags(input, vehicleAgeYears, kmSinceService),
  ]);

  const cats: Record<Category, number> = {
    ENGINE: 100,
    TRANSMISSION: 100,
    COOLING_AC: 100,
    ELECTRICAL: 100,
    BRAKES: 100,
    TYRES: 100,
    SUSPENSION: 100,
    COMPLIANCE: 100,
    MAINTENANCE: 100,
  };
  const reasons = emptyReasons();

  for (const sig of signals) {
    for (const d of DEDUCTIONS[sig] ?? []) {
      cats[d.category] = Math.max(0, cats[d.category] - d.points);
      reasons[d.category].push(signalLabel(sig));
    }
  }

  const schedule = getSchedule(rc.make, rc.model, rc.fuel);
  const predictive = runPredictive(
    schedule,
    conditionMultiplier(input),
    vehicleAgeYears,
    input.odometer,
    kmSinceService,
    input.transmission,
    input.recent_major_jobs,
    rc.fuel,
    input.battery_age,
  );

  for (const p of predictive) {
    cats.MAINTENANCE = Math.max(0, cats.MAINTENANCE - p.deduction);
  }

  const dimensions = (Object.keys(WEIGHTS) as DimensionName[]).map((name) => {
    const def = WEIGHTS[name];
    const score = round(
      Object.entries(def.cats).reduce((s, [c, w]) => s + cats[c as Category] * w, 0),
    );
    return { name, label: DIMENSION_LABELS[name], score, band: bandFor(score) };
  });

  const composite = round(dimensions.reduce((s, d) => s + d.score * WEIGHTS[d.name].weight, 0));

  const categories = ALL_CATEGORIES.map((category) => {
    const score = cats[category];
    const band = bandFor(score);
    const reasonList = reasons[category];
    let reason = 'No issues reported';
    if (band === 'GREEN') {
      reason = 'Looks fine based on what you shared';
    } else if (reasonList.length) {
      reason = reasonList[0];
    } else if (category === 'MAINTENANCE' && predictive.length) {
      reason = predictive[0].item;
    }
    return { category, score, band, reason };
  });

  const recommendations = buildRecommendations(cats, reasons, predictive, input);

  return {
    composite,
    band: compositeBand(composite),
    dimensions,
    categories,
    predictive,
    recommendations,
    accuracy: accuracyLevel(input),
    generatedAt: Date.now(),
    odometer: input.odometer,
  };
}

export { BRAND, SCORE_COLORS } from './config';
