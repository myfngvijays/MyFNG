import { Activity, Battery, Circle, Disc3, Paintbrush, Snowflake, Sparkles, Wrench, Zap } from 'lucide-react';

const SERVICE_IMAGE_BASE_URL =
  'https://cffommijlvicfjhbqyzk.supabase.co/storage/v1/object/public/Service_image_public';

export type Service = {
  id: number;
  slug: string;
  title: string;
  bookPrefill: { category: string; query: string };
  icon: any;
  description: string;
  longDescription: string;
  features: string[];
  benefits: string[];
  image: string;
  duration: string;
  warranty: string;
};

export function normalizeSpaces(s: string) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

export function canonicalCategoryName(name: string) {
  const n = normalizeSpaces(name);
  // Backward-compatible mapping (in case DB still has legacy category names)
  if (n === 'Car Periodic Service') return 'Periodic Car Service';
  if (n === 'Brake Service') return 'Car Brake Service';
  if (n === 'Clutch Service') return 'Car Clutch Service';
  if (n === 'Detailing Service') return 'Car Detailing Service';
  if (n === 'Denting & Painting') return 'Car Denting & Painting';
  if (n === 'Tyre & Wheel Care') return 'Car Tyre & Wheel Care';
  return n;
}

export function makeShortDescription(longText: string) {
  const t = normalizeSpaces(longText);
  if (!t) return '';
  const firstSentence = t.split(/(?<=\.)\s+/)[0] || t;
  const max = 110;
  if (firstSentence.length <= max) return firstSentence;
  return `${firstSentence.slice(0, max - 1).trim()}…`;
}

export const DEFAULT_SERVICES: Service[] = [
  {
    id: 1,
    slug: 'periodic-service',
    title: 'Periodic Car Service',
    bookPrefill: { category: 'PERIODIC SERVICE', query: 'BASIC' },
    icon: Activity,
    description: 'Standardised periodic maintenance to keep your car smooth, safe, and fuel-efficient.',
    longDescription:
      'Keep your car running smooth, safe, and fuel-efficient with MyFNG Periodic Car Service. We follow a standardised service process to inspect, clean, and maintain all critical components - helping prevent your car breakdowns and costly repairs.',
    features: [
      'Engine Oil Replacement (Shell/Castrol Premium)',
      'Oil Filter & Air Filter Replacement',
      'Brake, Coolant & Fluid Top-up',
      '40-Point Comprehensive Inspection',
      'Battery Health Check',
      'Tire Pressure & Condition Check',
      'Digital Health Report with AI Analysis',
      'Warranty on All Parts & Labor',
    ],
    benefits: ['Improved fuel efficiency', 'Extended engine life', 'Preventive maintenance', 'AI-powered diagnostics'],
    image: `${SERVICE_IMAGE_BASE_URL}/MyFNG_Car_Periodic_Service.png`,
    duration: '2-3 hours',
    warranty: '6 months / 5,000 km',
  },
  {
    id: 2,
    slug: 'engine-service',
    title: 'Car Engine Service',
    bookPrefill: { category: 'ENGINE SERVICE', query: 'ENGINE' },
    icon: Zap,
    description: 'Thorough engine inspection, cleaning & tuning for mileage and long engine life.',
    longDescription:
      'Your car’s engine is its heart. MyFNG Car Engine Service ensures smooth performance, better mileage, and long engine life by thoroughly inspecting, cleaning, and tuning critical engine components. We identify early warning signs, prevent major failures, and help you avoid expensive engine repairs through a standardised, expert-led service process.',
    features: [
      'Complete Engine Diagnostics',
      'Engine Oil Service & Replacement',
      'Oil Filter & Air Filter Change',
      'Performance Check & Tuning',
      'Spark Plug Inspection & Replacement',
      'Timing Belt Check',
      'Cooling System Inspection',
      'Exhaust System Check',
    ],
    benefits: ['Optimal engine performance', 'Early problem detection', 'Reduced breakdowns', 'Better fuel economy'],
    image: `${SERVICE_IMAGE_BASE_URL}/MyFNG_Car_Engine_Service.png`,
    duration: '3-4 hours',
    warranty: '6 months / 5,000 km',
  },
  {
    id: 3,
    slug: 'ac-service',
    title: 'Car AC Service',
    bookPrefill: { category: 'AC SERVICE', query: 'AC' },
    icon: Snowflake,
    description: 'Faster cooling, cleaner air, and reliable AC performance.',
    longDescription:
      'Beat the heat with MyFNG Car AC Service, designed to deliver faster cooling, cleaner air, and consistent performance. We inspect, clean, and optimise your car’s AC system to prevent weak cooling, bad odour, and sudden AC failures.',
    features: [
      'AC Gas Top-up / Replacement',
      'Cooling Coil & Condenser Cleaning',
      'AC Filter Replacement',
      'Vents Cleaning & Sanitization',
      'Leakage Testing & Repair',
      'AC Performance Testing',
      'Bacterial & Odor Removal',
      'Complete System Sanitization',
    ],
    benefits: ['Better cooling performance', 'Improved air quality', 'Reduced energy consumption', 'Fresh cabin environment'],
    image: `${SERVICE_IMAGE_BASE_URL}/MyFNG_Car_AC_Service.png`,
    duration: '2-3 hours',
    warranty: '6 months',
  },
  {
    id: 4,
    slug: 'battery-service',
    title: 'Car Battery Service',
    bookPrefill: { category: 'BATTERY SERVICE', query: 'BATTERY' },
    icon: Battery,
    description: 'Battery + charging system health checks for reliable starts.',
    longDescription:
      'Avoid sudden breakdowns with MyFNG Car Battery Service, designed to keep your car starting reliably every time. We test, inspect, and optimise your battery and charging system to ensure consistent power and longer battery life.',
    features: [
      'Battery Health Check & Analysis',
      'Charging System Testing',
      'Battery Terminal Cleaning',
      'Voltage & Load Testing',
      'Battery Replacement (if needed)',
      'Alternator & Starter Check',
      'Warranty on New Batteries',
      'Free Installation',
    ],
    benefits: ['Reliable vehicle starts', 'Preventive replacement', 'Extended battery life', 'Peace of mind'],
    image: `${SERVICE_IMAGE_BASE_URL}/MyFNG_Car_Battery_Service.png`,
    duration: '1-2 hours',
    warranty: '18-24 months',
  },
  {
    id: 5,
    slug: 'brake-service',
    title: 'Car Brake Service',
    bookPrefill: { category: 'BRAKE SERVICE', query: 'BRAKE' },
    icon: Disc3,
    description: 'Responsive braking with inspection, cleaning & precise adjustments.',
    longDescription:
      'Your car’s safety depends on its brakes. MyFNG Car Brake Service ensures responsive braking, reduced stopping distance, and complete driving confidence through detailed inspection, cleaning, and precise adjustments. We identify early brake wear and fix issues before they turn into expensive or dangerous failures.',
    features: [
      'Brake Pad Check & Replacement',
      'Brake Fluid Replacement',
      'Disc & Drum Inspection',
      'Brake System Safety Test',
      'ABS System Check',
      'Parking Brake Adjustment',
      'Brake Line Inspection',
      'Complete System Bleeding',
    ],
    benefits: ['Enhanced safety', 'Optimal stopping power', 'Reduced brake noise', 'Longer component life'],
    image: `${SERVICE_IMAGE_BASE_URL}/MyFNG_Car_Brake_Service.png`,
    duration: '2-3 hours',
    warranty: '6 months / 10,000 km',
  },
  {
    id: 6,
    slug: 'clutch-service',
    title: 'Car Clutch Service',
    bookPrefill: { category: 'CLUTCH SERVICE', query: 'CLUTCH' },
    icon: Wrench,
    description: 'Early clutch wear diagnosis for smooth shifts and longer clutch life.',
    longDescription:
      'A healthy clutch ensures smooth gear shifts and comfortable driving. MyFNG Car Clutch Service diagnoses wear and performance issues early to prevent breakdowns, jerks, and costly transmission damage. We inspect, adjust, and service clutch components using a standardised process for reliable performance and longer clutch life.',
    features: [
      'Clutch System Inspection',
      'Clutch Plate & Pressure Plate Check',
      'Release Bearing Inspection',
      'Hydraulic / Cable Check',
      'Test Drive & Shift Calibration',
      'Replacement with Quality Parts (if needed)',
      'Transparent Estimate Before Work',
      'Warranty on Parts & Labor',
    ],
    benefits: ['Smoother gear shifts', 'Better drivability', 'Reduced vibration/noise', 'Prevents breakdowns'],
    image: `${SERVICE_IMAGE_BASE_URL}/MyFNG_Car_Clutch_Service.png`,
    duration: '3-6 hours',
    warranty: '3 months / 3,000 km',
  },
  {
    id: 7,
    slug: 'tyre-wheel-care',
    title: 'Car Tyre & Wheel Care',
    bookPrefill: { category: 'TYRE & WHEEL CARE', query: 'TYRE' },
    icon: Circle,
    description: 'Alignment & tyre care for better grip, steering control, and longer tyre life.',
    longDescription:
      'Safe handling and smooth rides start with healthy tyres and well-aligned wheels. MyFNG Car Tyre & Wheel Care service improves road grip, steering control, and tyre life through precise inspection and corrective maintenance. We help prevent uneven tyre wear, vibrations, and poor fuel efficiency with a standardised care process.',
    features: [
      'Tyre Rotation & Balancing',
      'Wheel Alignment (4-Wheel)',
      'Tyre Pressure Check & Adjustment',
      'Tread Depth Measurement',
      'Tyre Replacement (if needed)',
      'Wheel Balancing',
      'TPMS Sensor Check',
      'Road Hazard Inspection',
    ],
    benefits: ['Better fuel efficiency', 'Extended tyre life', 'Improved handling', 'Enhanced safety'],
    image: `${SERVICE_IMAGE_BASE_URL}/MyFNG_Car_Wheel_Care_Service.png`,
    duration: '1-2 hours',
    warranty: '6 months',
  },
  {
    id: 8,
    slug: 'detailing-service',
    title: 'Car Detailing Service',
    bookPrefill: { category: 'DETAILING SERVICE', query: 'DETAIL' },
    icon: Sparkles,
    description: 'Deep clean + protection for comfort, hygiene, and a showroom-like finish.',
    longDescription:
      'A clean car isn’t just about looks—it’s about comfort, hygiene, and safety. MyFNG Car Detailing Service deep-cleans, restores, and protects your car’s interior and exterior, helping maintain visibility, air quality, and long-term value. We use professional-grade products and a standardised detailing process to give your car a fresh, showroom-like finish.',
    features: [
      'Interior Deep Cleaning',
      'Exterior Polish & Waxing',
      'Ceramic Coating Application',
      'Dashboard & Upholstery Cleaning',
      'Engine Bay Cleaning',
      'Headlight Restoration',
      'Paint Protection Film',
      'Leather Conditioning',
    ],
    benefits: ['Showroom finish', 'Paint protection', 'Increased resale value', 'Long-lasting shine'],
    image: `${SERVICE_IMAGE_BASE_URL}/MyFNG_Car_Detailing_Service.png`,
    duration: '4-6 hours',
    warranty: '3-6 months',
  },
  {
    id: 9,
    slug: 'denting-painting',
    title: 'Car Denting & Painting',
    bookPrefill: { category: 'DENTING PAINTING', query: 'PAINT' },
    icon: Paintbrush,
    description: 'Dent repair + paint matching to restore body strength and resale value.',
    longDescription:
      'Dents and scratches don’t just spoil your car’s look—they can weaken body panels and lead to rust over time. MyFNG Car Denting & Painting service restores your car’s body strength, paint finish, and resale value using professional repair and paint-matching techniques. We ensure precise dent removal and a smooth, factory-like paint finish through a standardised repair process.',
    features: [
      'Dent Removal & Repair',
      'Color Matching Technology',
      '4-Layer Painting Process',
      'Panel Rubbing & Polishing',
      'Primer & Paint Application',
      'Paint Protection',
      'Quality Check & Inspection',
      '2-Year Paint Warranty',
    ],
    benefits: ['Flawless finish', 'Color match guarantee', 'Long-lasting paint', 'Increased resale value'],
    image: `${SERVICE_IMAGE_BASE_URL}/MyFNG_Car_Denting-Painting_Service.png`,
    duration: '2-5 days',
    warranty: '2 years',
  },
];

export function findServiceBySlug(slug: string) {
  return DEFAULT_SERVICES.find((service) => service.slug === slug);
}
