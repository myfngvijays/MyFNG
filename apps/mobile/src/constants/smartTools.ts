import type { Ionicons } from '@expo/vector-icons';

export type SmartToolId =
  | 'car_health'
  | 'fuel_calculator'
  | 'price_compare'
  | 'car_loan'
  | 'resale_value'
  | 'car_quiz'
  | 'parking_finder'
  | 'parts_price';

export type SmartToolItem = {
  id: SmartToolId;
  title: string;
  icon: keyof typeof Ionicons.glyphMap;
  color: string;
  bg: string;
  screen: string;
};

export const SMART_TOOLS: SmartToolItem[] = [
  { id: 'car_health', title: 'Smart Health Checkup', icon: 'pulse', color: '#023D95', bg: '#EFF6FF', screen: 'CarHealthCheck' },
  { id: 'fuel_calculator', title: 'Fuel Cost Calculator', icon: 'speedometer', color: '#D97706', bg: '#FFFBEB', screen: 'FuelCostCalculator' },
  { id: 'price_compare', title: 'Compare Service Cost', icon: 'git-compare', color: '#2563EB', bg: '#EFF6FF', screen: 'AuthorisedPricing' },
  { id: 'car_loan', title: 'Loan Against Car', icon: 'cash', color: '#7C3AED', bg: '#F5F3FF', screen: 'SmartToolWeb' },
  { id: 'resale_value', title: 'Car Resale Value', icon: 'trending-up', color: '#0891B2', bg: '#ECFEFF', screen: 'ResaleValue' },
  { id: 'car_quiz', title: 'Car Quiz', icon: 'game-controller', color: '#DB2777', bg: '#FDF2F8', screen: 'CarQuizGame' },
  { id: 'parking_finder', title: 'Nearby Parking', icon: 'location', color: '#EA580C', bg: '#FFF7ED', screen: 'SmartToolWeb' },
  { id: 'parts_price', title: 'Check Parts Price', icon: 'construct', color: '#004AAD', bg: '#EFF6FF', screen: 'CarPartsPrice' },
];

export const SMART_TOOL_WEB_URLS: Record<string, string> = {
  car_loan: 'https://myfng.in/car-loan',
  parking_finder: 'https://www.google.com/maps/search/parking+near+me',
};

export const COMPARE_SERVICE_CATEGORIES = [
  { id: 'periodic', name: 'Periodic Service', icon: 'construct' as const, color: '#2563EB', bg: '#EFF6FF' },
  { id: 'ac', name: 'AC Service', icon: 'snow' as const, color: '#0891B2', bg: '#ECFEFF' },
  { id: 'brakes', name: 'Brake Service', icon: 'disc' as const, color: '#DC2626', bg: '#FEF2F2' },
  { id: 'engine', name: 'Engine Care', icon: 'speedometer' as const, color: '#EA580C', bg: '#FFF7ED' },
  { id: 'battery', name: 'Battery', icon: 'battery-charging' as const, color: '#059669', bg: '#ECFDF5' },
  { id: 'tyre', name: 'Tyre & Wheel', icon: 'ellipse-outline' as const, color: '#1F2937', bg: '#F3F4F6' },
] as const;

export const COMPARE_USPS = [
  { icon: 'shield-checkmark' as const, text: 'Genuine parts only' },
  { icon: 'car' as const, text: 'Free pickup & drop' },
  { icon: 'eye' as const, text: 'Live photo updates' },
  { icon: 'ribbon' as const, text: 'Service warranty' },
];
