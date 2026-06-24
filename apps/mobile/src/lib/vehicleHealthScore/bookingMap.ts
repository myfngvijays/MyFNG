import type { Category } from './types';

export function mapHealthCtaToServiceCategory(
  ctaType: string,
  title: string,
  category?: Category | 'PREDICTIVE',
): string {
  const t = title.toLowerCase();

  if (t.includes('engine') || category === 'ENGINE') return 'ENGINE';
  if (t.includes('brake') || category === 'BRAKES') return 'BRAKE';
  if (t.includes('tyre') || category === 'TYRES') return 'TYRE';
  if (t.includes('battery') || category === 'ELECTRICAL') return 'BATTERY';
  if (t.includes(' ac') || t.startsWith('ac') || t.includes('coolant') || category === 'COOLING_AC') return 'AC';
  if (t.includes('clutch') || t.includes('transmission') || category === 'TRANSMISSION') return 'CLUTCH';
  if (t.includes('suspension') || t.includes('steering') || category === 'SUSPENSION') return 'SUSPENSION';
  if (
    t.includes('periodic') ||
    t.includes('maintenance') ||
    t.includes('service') ||
    t.includes('fluid') ||
    category === 'MAINTENANCE'
  ) {
    return 'PERIODIC';
  }
  if (ctaType === 'ADD_TO_CART') {
    if (t.includes('battery')) return 'BATTERY';
    if (t.includes('ac')) return 'AC';
  }
  if (ctaType === 'BOOK_INSPECTION') return 'PERIODIC';
  return 'PERIODIC';
}
