import { ENV } from '../config/environment';
import { CAR_BRANDS, type PublicBrand } from '../constants/publicAppData';
import { apiFetch } from './api';
import { getCustomerSessionToken } from './customerSession';
import { detectHeaderLocation } from './locationDisplay';

export type CustomerVehicle = {
  id?: string;
  vehicle_number?: string;
  registration_number?: string;
  make?: string;
  model?: string;
  model_name?: string;
  variant?: string;
  fuel_type?: string;
  year?: number | string;
  odometer_km?: number | string;
  is_default?: boolean;
};

export async function fetchCarBrands(): Promise<PublicBrand[]> {
  try {
    const res = await fetch(`${ENV.API_URL}/api/public/car-brands`);
    if (res.ok) {
      const json = await res.json();
      const brands: PublicBrand[] = (json.data || [])
        .map((b: any) => ({ name: b.name, logo: b.logo_url || '' }))
        .filter((b: PublicBrand) => b.name);
      if (brands.length > 0) return brands;
    }
  } catch {
    // fallback below
  }
  return CAR_BRANDS;
}

export async function fetchCustomerVehicles(): Promise<CustomerVehicle[]> {
  try {
    const token = await getCustomerSessionToken();
    if (!token) return [];
    const json = await apiFetch<{ vehicles?: CustomerVehicle[] }>('/api/customer/vehicles');
    return json?.vehicles || [];
  } catch {
    return [];
  }
}

export async function fetchSmartToolCity(): Promise<string> {
  try {
    return (await detectHeaderLocation()) || 'Your City';
  } catch {
    return 'Your City';
  }
}

export function vehicleLabel(v: CustomerVehicle): string {
  const make = v.make || '';
  const model = v.model || v.model_name || '';
  const reg = v.registration_number || v.vehicle_number || '';
  return [make, model].filter(Boolean).join(' ') || reg || 'My Car';
}

export function vehicleFuel(v: CustomerVehicle): string {
  return String(v.fuel_type || 'petrol').toLowerCase();
}
