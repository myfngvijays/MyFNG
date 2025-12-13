'use client';

export type CustomerChecklistItem = {
  id: string;
  name: string;
  category?: string;
};

export type CustomerChecklistTemplate = {
  title: string;
  points?: number;
  items: CustomerChecklistItem[];
};

function normalize(name: string) {
  return String(name || '').trim().toUpperCase();
}

// NOTE:
// These are customer-facing “what will be done” points.
// Primary source should be DB-driven via `service_type_checklist_templates`.
// This file is a safe fallback for common “Points” packages.
const PREMIUM_50_ITEMS: CustomerChecklistItem[] = [
  { id: '1', name: 'Clean Air Filter', category: 'Engine Compartment' },
  { id: '2', name: 'Spark Plugs Cleaning & Adjustment', category: 'Engine Compartment' },
  { id: '3', name: 'Top up Brake Oil', category: 'Engine Compartment' },
  { id: '4', name: 'Top up Gear Oil', category: 'Engine Compartment' },
  { id: '5', name: 'Top up Power Steering Oil & Clutch Oil (If applicable)', category: 'Engine Compartment' },
  { id: '6', name: 'Battery Terminal Cleaning', category: 'Engine Compartment' },
  { id: '7', name: 'Battery Load Testing', category: 'Engine Compartment' },
  { id: '8', name: 'Battery Terminal Coating', category: 'Engine Compartment' },
  { id: '9', name: 'Top up Battery Water', category: 'Engine Compartment' },
  { id: '10', name: 'Top up Coolant', category: 'Engine Compartment' },
  { id: '11', name: 'Top up Wiper Water Tank with Screen Wash', category: 'Engine Compartment' },
  { id: '12', name: 'Align Wiper Water Nozzles', category: 'Engine Compartment' },
  { id: '13', name: 'Replace Oil Filter', category: 'Engine Compartment' },
  { id: '14', name: 'Replace Engine Oil', category: 'Engine Compartment' },
  { id: '15', name: 'Check all Radiator Lines & Hoses', category: 'Engine Compartment' },
  { id: '16', name: 'Inspect Belts for Cracks & Hardness / Adjustment of Tensioners', category: 'Engine Compartment' },
  { id: '17', name: 'Check and Adjust Clutch play (if required)', category: 'Engine Compartment' },
  { id: '18', name: 'Check All Glass Winder Operations', category: 'Cabin' },
  { id: '19', name: 'Window Glass Run Channel Lubrication', category: 'Cabin' },
  { id: '20', name: 'Clean AC Filter', category: 'Cabin' },
  { id: '21', name: 'Check AC Cooling / Gas Leak Test', category: 'Cabin' },
  { id: '22', name: 'AC Disinfectant Spray in AC Vents', category: 'Cabin' },
  { id: '23', name: 'Inspect Front Lights, Rear Lights & Indicators', category: 'Cabin' },
  { id: '24', name: 'Inspect Internal Lights & Power Switches', category: 'Cabin' },
  { id: '25', name: 'Interior Vacuuming', category: 'Cabin' },
  { id: '26', name: 'Dashboard Polish', category: 'Cabin' },
  { id: '27', name: 'Pre Greasing - Anti Squeak Spray on Door Hinges', category: 'Cabin' },
  { id: '28', name: 'Greasing on Door Hinges', category: 'Cabin' },
  { id: '29', name: 'Check Door Locks & Central Locking System', category: 'Cabin' },
  { id: '30', name: 'Door Locks Lubrication', category: 'Cabin' },
  { id: '31', name: 'All Wheel Nuts & Bolts Greasing', category: 'Wheel & Brakes' },
  { id: '32', name: 'Front Brake Pads Cleaning', category: 'Wheel & Brakes' },
  { id: '33', name: 'Front Brake Calliper Pins Lubrication', category: 'Wheel & Brakes' },
  { id: '34', name: 'Rear Brake Pads / Liners Cleaning', category: 'Wheel & Brakes' },
  { id: '35', name: 'Rear Brake Calliper Pins Lubrication / Liners Setting', category: 'Wheel & Brakes' },
  { id: '36', name: 'Air Bleeding from Brake Fluid Lines', category: 'Wheel & Brakes' },
  { id: '37', name: 'Hand Brake Setting', category: 'Wheel & Brakes' },
  { id: '38', name: 'Check Wheel Bearings', category: 'Wheel & Brakes' },
  { id: '39', name: 'Check Ball Joints, Steering Rack, Lower Arms, Linkages & Boots', category: 'Wheel & Brakes' },
  { id: '40', name: 'Inspect Front Shock Absorbers, Suspension Struts, Balance Rod Bushes & Lower Arms', category: 'Wheel & Brakes' },
  { id: '41', name: 'Inspect Rear Shock Absorbers, Buffer Bushes & Coil Pads', category: 'Wheel & Brakes' },
  { id: '42', name: 'Re-torque all Nuts and Bolts on Chassis & Body', category: 'Wheel & Brakes' },
  { id: '43', name: 'Check all Tyres & Rims', category: 'Wheel & Brakes' },
  { id: '44', name: 'Inspect all Wheel Arcs & Entire Under Body', category: 'Wheel & Brakes' },
  { id: '45', name: 'Tyre Rotation', category: 'Wheel & Brakes' },
  { id: '46', name: 'Final Wheel Nuts Torque', category: 'Wheel & Brakes' },
  { id: '47', name: 'Top up Tyre Pressure', category: 'Wheel & Brakes' },
  { id: '48', name: 'Trial Drive & Final Inspection Post Trial Drive', category: 'Others' },
  { id: '49', name: 'Wash', category: 'Others' },
  { id: '50', name: 'Comprehensive Report', category: 'Others' },
];

const PLATINUM_60_ITEMS: CustomerChecklistItem[] = [
  ...PREMIUM_50_ITEMS.slice(0, 47),
  { id: '48', name: 'Engine Compression Test', category: 'Engine Compartment' },
  { id: '49', name: 'Fuel System Cleaning', category: 'Engine Compartment' },
  { id: '50', name: 'Throttle Body Cleaning', category: 'Engine Compartment' },
  { id: '51', name: 'EGR Valve Cleaning', category: 'Engine Compartment' },
  { id: '52', name: 'Interior Deep Cleaning', category: 'Cabin' },
  { id: '53', name: 'Leather Seat Conditioning', category: 'Cabin' },
  { id: '54', name: 'Headlight Restoration', category: 'Cabin' },
  { id: '55', name: 'Paint Protection Coating', category: 'Others' },
  { id: '56', name: 'Underbody Coating', category: 'Others' },
  { id: '57', name: 'Trial Drive, Diagnostics Scanning & Final Inspection Post Trial Drive', category: 'Others' },
  { id: '58', name: 'Premium Wash & Wax', category: 'Others' },
  { id: '59', name: 'Comprehensive Report', category: 'Others' },
  { id: '60', name: 'Customer Satisfaction Follow-up', category: 'Others' },
];

const FALLBACK_TEMPLATES: Record<string, CustomerChecklistTemplate> = {
  BASIC_15: {
    title: 'Basic Service (15 Points) – What we will do',
    points: 15,
    items: [
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
    ],
  },
  GENERAL_30: {
    title: 'General Service (30 Points) – What we will do',
    points: 30,
    items: [
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
    ],
  },
  PREMIUM_50: {
    title: 'Premium Service (50 Points) – What we will do',
    points: 50,
    // For customer view, keep the main 50 items (same as checklist template).
    // If the DB template exists, UI will prefer DB.
    items: PREMIUM_50_ITEMS,
  },
  PLATINUM_60: {
    title: 'Platinum Service (60 Points) – What we will do',
    points: 60,
    // Customer view uses the 60-point template.
    items: PLATINUM_60_ITEMS,
  },
};

export function getFallbackChecklistTemplate(serviceName: string): CustomerChecklistTemplate | null {
  const n = normalize(serviceName);

  // Match by keywords + points number, but keep forgiving.
  if (n.includes('BASIC') && (n.includes('15') || n.includes('15 POINT'))) return FALLBACK_TEMPLATES.BASIC_15;
  if (n.includes('GENERAL') && (n.includes('30') || n.includes('30 POINT'))) return FALLBACK_TEMPLATES.GENERAL_30;
  if (n.includes('PREMIUM') && (n.includes('50') || n.includes('50 POINT'))) return FALLBACK_TEMPLATES.PREMIUM_50;
  if (n.includes('PLATINUM') && (n.includes('60') || n.includes('60 POINT'))) return FALLBACK_TEMPLATES.PLATINUM_60;

  // If name itself contains “Points” but not recognized, we still return null.
  // The DB-driven table should be used for all other checklists.
  return null;
}
