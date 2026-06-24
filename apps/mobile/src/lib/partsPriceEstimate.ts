import { ENV } from '../config/environment';
import { buildMobileAuthHeaders } from './serviceBooking';

export type PartsPricePartRow = {
  name: string;
  low: number;
  high: number;
  note?: string;
};

export type PartsPriceCategory = {
  id: string;
  name: string;
  icon: string;
  parts: PartsPricePartRow[];
};

export type PartsPriceEstimateSource =
  | 'boodmo_google'
  | 'boodmo'
  | 'google'
  | 'catalog_fallback';

export type PartsPriceEstimate = {
  source: PartsPriceEstimateSource;
  vehicle_summary: string;
  categories: PartsPriceCategory[];
  disclaimer: string;
};

export type PartsPriceRequest = {
  make: string;
  model: string;
  regYear?: number;
  fuel?: string;
  variant?: string;
  vehicleClass?: string | null;
  city?: string | null;
};

export async function fetchPartsPriceEstimate(payload: PartsPriceRequest): Promise<PartsPriceEstimate> {
  const headers = await buildMobileAuthHeaders();
  const res = await fetch(`${ENV.API_URL}/api/public/car-parts-price`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      make: payload.make,
      model: payload.model,
      reg_year: payload.regYear,
      fuel: payload.fuel,
      variant: payload.variant,
      vehicle_class: payload.vehicleClass,
      city: payload.city,
    }),
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok || !json?.estimate) {
    throw new Error(String(json?.error || 'Could not fetch parts prices'));
  }
  return json.estimate as PartsPriceEstimate;
}

export function formatPartsPriceRange(low: number, high: number): string {
  const fmt = (n: number) => `₹${Math.round(n).toLocaleString('en-IN')}`;
  if (low === high) return fmt(low);
  return `${fmt(low)} – ${fmt(high)}`;
}
