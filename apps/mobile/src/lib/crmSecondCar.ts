export type CrmSecondCar = {
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  model_id: string;
  vehicle_class: string;
  vehicle_year: string;
  vehicle_fuel_type: string;
  odometer_km: string;
};

export function emptySecondCar(): CrmSecondCar {
  return {
    vehicle_number: '',
    vehicle_make: '',
    vehicle_model: '',
    model_id: '',
    vehicle_class: '',
    vehicle_year: '',
    vehicle_fuel_type: 'PETROL',
    odometer_km: '',
  };
}

export function parseSecondCar(meta: unknown): CrmSecondCar | null {
  const raw =
    meta && typeof meta === 'object' ? (meta as { second_car?: unknown }).second_car : null;
  if (!raw || typeof raw !== 'object') return null;
  const row = raw as Record<string, unknown>;
  const make = String(row.vehicle_make || '').trim();
  const model = String(row.vehicle_model || '').trim();
  const number = String(row.vehicle_number || '').trim();
  if (!make && !model && !number) return null;
  return {
    vehicle_number: number.toUpperCase(),
    vehicle_make: make,
    vehicle_model: model,
    model_id: String(row.model_id || '').trim(),
    vehicle_class: String(row.vehicle_class || '').trim(),
    vehicle_year: row.vehicle_year != null ? String(row.vehicle_year).trim() : '',
    vehicle_fuel_type: String(row.vehicle_fuel_type || 'PETROL').trim() || 'PETROL',
    odometer_km: row.odometer_km != null ? String(row.odometer_km).trim() : '',
  };
}

export function serializeSecondCar(car: CrmSecondCar | null): Record<string, unknown> | null {
  if (!car) return null;
  const make = String(car.vehicle_make || '').trim();
  const model = String(car.vehicle_model || '').trim();
  const number = String(car.vehicle_number || '')
    .trim()
    .toUpperCase();
  if (!make && !model && !number) return null;
  return {
    vehicle_number: number || null,
    vehicle_make: make || null,
    vehicle_model: model || null,
    model_id: String(car.model_id || '').trim() || null,
    vehicle_class: String(car.vehicle_class || '').trim() || null,
    vehicle_year: car.vehicle_year ? Number(car.vehicle_year) || null : null,
    vehicle_fuel_type: String(car.vehicle_fuel_type || '').trim() || null,
    odometer_km: car.odometer_km ? Number(car.odometer_km) || null : null,
  };
}

export function secondCarLabel(car: CrmSecondCar | null | undefined): string {
  if (!car) return '';
  const model = [car.vehicle_make, car.vehicle_model].filter(Boolean).join(' ');
  return [car.vehicle_number, model].filter(Boolean).join(' · ');
}
