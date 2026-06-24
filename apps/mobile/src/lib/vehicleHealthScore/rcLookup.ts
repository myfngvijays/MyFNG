import AsyncStorage from '@react-native-async-storage/async-storage';
import { ENV } from '../../config/environment';
import type { FuelType, RcData } from './types';

const RC_CACHE_PREFIX = 'myfng_rc_cache:';

export type RcLookupResult =
  | { ok: true; data: RcData; source: 'cache' | 'api' | 'manual' }
  | { ok: false; error: string };

function normalizeReg(reg: string): string {
  return reg.replace(/\s+/g, '').toUpperCase();
}

function parseFuel(raw?: string): FuelType {
  const v = (raw || 'Petrol').toLowerCase();
  if (v.includes('diesel')) return 'Diesel';
  if (v.includes('cng')) return 'CNG';
  if (v.includes('electric')) return 'Electric';
  if (v.includes('hybrid')) return 'Hybrid';
  return 'Petrol';
}

async function readCache(reg: string): Promise<RcData | null> {
  try {
    const raw = await AsyncStorage.getItem(RC_CACHE_PREFIX + normalizeReg(reg));
    if (!raw) return null;
    return JSON.parse(raw) as RcData;
  } catch {
    return null;
  }
}

export async function cacheRcData(data: RcData): Promise<void> {
  try {
    await AsyncStorage.setItem(RC_CACHE_PREFIX + normalizeReg(data.regNumber), JSON.stringify(data));
  } catch {
    /* ignore cache errors */
  }
}

/** RC lookup with cache → API attempt → manual fallback (never blocks flow). */
export async function lookupRc(regNumber: string): Promise<RcLookupResult> {
  const reg = normalizeReg(regNumber);
  if (reg.length < 4) return { ok: false, error: 'Enter a valid registration number' };

  const cached = await readCache(reg);
  if (cached) return { ok: true, data: { ...cached, regNumber: reg }, source: 'cache' };

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(`${ENV.API_URL}/api/public/vehicle-rc?reg=${encodeURIComponent(reg)}`, {
      signal: controller.signal,
    });
    clearTimeout(timer);

    if (res.ok) {
      const json = await res.json();
      const data: RcData = {
        regNumber: reg,
        make: String(json.make || json.manufacturer || '').trim() || 'Unknown',
        model: String(json.model || '').trim() || 'Unknown',
        variant: json.variant ? String(json.variant) : undefined,
        registrationYear: Number(json.registrationYear || json.registration_year || json.manufactureYear) || new Date().getFullYear() - 3,
        fuel: parseFuel(json.fuel || json.fuel_type),
        insuranceValidTill: json.insuranceValidTill || json.insurance_valid_till,
        pucValidTill: json.pucValidTill || json.puc_valid_till,
        challansPending: json.challansPending,
      };
      await cacheRcData(data);
      return { ok: true, data, source: 'api' };
    }
  } catch {
    /* fall through to manual */
  }

  return { ok: false, error: 'Could not fetch RC details — please enter manually.' };
}

export function emptyRc(regNumber: string): RcData {
  return {
    regNumber: normalizeReg(regNumber),
    make: '',
    model: '',
    registrationYear: new Date().getFullYear() - 5,
    fuel: 'Petrol',
  };
}
