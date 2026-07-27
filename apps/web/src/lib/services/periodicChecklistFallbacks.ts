/**
 * Server-safe periodic checklists (15 / 30 / 50 / 60).
 * ONE master list of 60 — higher tiers are supersets so WhatsApp can show
 * only ADDITIONAL points (Basic 1–15, General 16–30, Premium 31–50, Platinum 51–60).
 */

export type PeriodicChecklistItem = {
  id: string;
  name: string;
  category?: string;
};

export type PeriodicChecklistFallback = {
  title: string;
  points: number;
  items: PeriodicChecklistItem[];
};

/** Shared 1–30 (Basic + General extras) */
const POINTS_1_TO_30: PeriodicChecklistItem[] = [
  { id: '1', name: 'Clean Air Filter', category: 'Engine Compartment' },
  { id: '2', name: 'Spark Plugs Servicing', category: 'Engine Compartment' },
  { id: '3', name: 'Top up Brake Oil', category: 'Engine Compartment' },
  { id: '4', name: 'Top up Gear Oil', category: 'Engine Compartment' },
  { id: '5', name: 'Top up Power Steering Oil & Clutch Oil (If applicable)', category: 'Engine Compartment' },
  { id: '6', name: 'Top up Coolant', category: 'Engine Compartment' },
  { id: '7', name: 'Top up Battery Water', category: 'Engine Compartment' },
  { id: '8', name: 'Top up Wiper Water Tank', category: 'Engine Compartment' },
  { id: '9', name: 'Replace Oil Filter', category: 'Engine Compartment' },
  { id: '10', name: 'Replace Engine Oil', category: 'Engine Compartment' },
  { id: '11', name: 'Clean Cabin AC Filter', category: 'Cabin' },
  { id: '12', name: 'Interior Vacuuming', category: 'Cabin' },
  { id: '13', name: 'Grease Door Hinges', category: 'Cabin' },
  { id: '14', name: 'Inspect & Top up Tyre Pressure', category: 'Others' },
  { id: '15', name: 'Body Wash', category: 'Others' },
  { id: '16', name: 'Check Brake Pads', category: 'Wheel & Brakes' },
  { id: '17', name: 'Check Brake Fluid', category: 'Wheel & Brakes' },
  { id: '18', name: 'Check Suspension', category: 'Wheel & Brakes' },
  { id: '19', name: 'Check Tyre Condition', category: 'Wheel & Brakes' },
  { id: '20', name: 'Wheel Alignment Check', category: 'Wheel & Brakes' },
  { id: '21', name: 'Battery Terminal Cleaning', category: 'Engine Compartment' },
  { id: '22', name: 'Check Alternator Belt', category: 'Engine Compartment' },
  { id: '23', name: 'Check Radiator Cap', category: 'Engine Compartment' },
  { id: '24', name: 'Check Windshield Wipers', category: 'Cabin' },
  { id: '25', name: 'Check Horn', category: 'Cabin' },
  { id: '26', name: 'Check All Lights', category: 'Cabin' },
  { id: '27', name: 'Check AC Performance', category: 'Cabin' },
  { id: '28', name: 'Check Steering System', category: 'Wheel & Brakes' },
  { id: '29', name: 'Test Drive', category: 'Others' },
  { id: '30', name: 'Final Inspection', category: 'Others' },
];

/** Shared 31–50 (Premium extras beyond General) */
const POINTS_31_TO_50: PeriodicChecklistItem[] = [
  { id: '31', name: 'Inspect Belts for Cracks & Hardness / Adjustment of Tensioners', category: 'Engine Compartment' },
  { id: '32', name: 'Check and Adjust Clutch play (if required)', category: 'Engine Compartment' },
  { id: '33', name: 'Check all Radiator Lines & Hoses', category: 'Engine Compartment' },
  { id: '34', name: 'Battery Load Testing', category: 'Engine Compartment' },
  { id: '35', name: 'Battery Terminal Coating', category: 'Engine Compartment' },
  { id: '36', name: 'Align Wiper Water Nozzles', category: 'Engine Compartment' },
  { id: '37', name: 'Check All Glass Winder Operations', category: 'Cabin' },
  { id: '38', name: 'Window Glass Run Channel Lubrication', category: 'Cabin' },
  { id: '39', name: 'Replace AC Filter', category: 'Cabin' },
  { id: '40', name: 'Check AC Cooling / Gas Leak Test', category: 'Cabin' },
  { id: '41', name: 'AC Disinfectant Spray in AC Vents', category: 'Cabin' },
  { id: '42', name: 'Dashboard Polish', category: 'Cabin' },
  { id: '43', name: 'Door Locks Lubrication', category: 'Cabin' },
  { id: '44', name: 'Check Door Locks & Central Locking System', category: 'Cabin' },
  { id: '45', name: 'Front Brake Pads Cleaning', category: 'Wheel & Brakes' },
  { id: '46', name: 'Front Brake Calliper Pins Lubrication', category: 'Wheel & Brakes' },
  { id: '47', name: 'Rear Brake Pads / Liners Cleaning', category: 'Wheel & Brakes' },
  { id: '48', name: 'Air Bleeding from Brake Fluid Lines', category: 'Wheel & Brakes' },
  { id: '49', name: 'Hand Brake Setting', category: 'Wheel & Brakes' },
  { id: '50', name: 'Comprehensive Report', category: 'Others' },
];

/** Shared 51–60 (Platinum extras beyond Premium) */
const POINTS_51_TO_60: PeriodicChecklistItem[] = [
  { id: '51', name: 'Engine Compression Test', category: 'Engine Compartment' },
  { id: '52', name: 'Fuel System Cleaning', category: 'Engine Compartment' },
  { id: '53', name: 'Throttle Body Cleaning', category: 'Engine Compartment' },
  { id: '54', name: 'EGR Valve Cleaning', category: 'Engine Compartment' },
  { id: '55', name: 'Interior Deep Cleaning', category: 'Cabin' },
  { id: '56', name: 'Leather Seat Conditioning', category: 'Cabin' },
  { id: '57', name: 'Headlight Restoration', category: 'Cabin' },
  { id: '58', name: 'Paint Protection Coating', category: 'Others' },
  { id: '59', name: 'Underbody Coating', category: 'Others' },
  { id: '60', name: 'Premium Wash & Wax', category: 'Others' },
];

/** Full nested master list — every higher tier includes all lower points */
export const PERIODIC_MASTER_60: PeriodicChecklistItem[] = [
  ...POINTS_1_TO_30,
  ...POINTS_31_TO_50,
  ...POINTS_51_TO_60,
];

const TIER_TO_POINTS: Record<string, number> = {
  basic: 15,
  general: 30,
  premium: 50,
  platinum: 60,
};

const TITLES: Record<number, string> = {
  15: 'Basic Service (15 Points)',
  30: 'General Service (30 Points)',
  50: 'Premium Service (50 Points)',
  60: 'Platinum Service (60 Points)',
};

/** Slice master list: Basic=15, General=30, Premium=50, Platinum=60 (same item names). */
export function getPeriodicChecklistSlice(points: number): PeriodicChecklistFallback | null {
  const pts = Number(points || 0);
  if (![15, 30, 50, 60].includes(pts)) return null;
  return {
    title: TITLES[pts] || `${pts} Points`,
    points: pts,
    items: PERIODIC_MASTER_60.slice(0, pts).map((item, idx) => ({
      ...item,
      id: String(idx + 1),
    })),
  };
}

export function resolvePeriodicTierPoints(input: {
  points?: number | null;
  tier?: string | null;
  serviceName?: string | null;
}): number | null {
  const pts = Number(input.points || 0);
  if ([15, 30, 50, 60].includes(pts)) return pts;

  const tier = String(input.tier || '').trim().toLowerCase();
  if (tier && TIER_TO_POINTS[tier]) return TIER_TO_POINTS[tier];

  const name = String(input.serviceName || '').toLowerCase();
  if (name.includes('platinum')) return 60;
  if (name.includes('premium')) return 50;
  if (name.includes('general')) return 30;
  if (name.includes('basic')) return 15;

  const m = name.match(/\b(15|30|50|60)\b/);
  return m ? Number(m[1]) : null;
}

export function getPeriodicChecklistFallback(input: {
  points?: number | null;
  tier?: string | null;
  serviceName?: string | null;
}): PeriodicChecklistFallback | null {
  const pts = resolvePeriodicTierPoints(input);
  if (!pts) return null;
  return getPeriodicChecklistSlice(pts);
}
