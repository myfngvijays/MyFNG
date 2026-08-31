import * as FileSystem from 'expo-file-system';
import { supabase } from './supabase';
import { ENV } from '../config/environment';
import type { FuelLevel } from '../../../shared/types';

export type VehiclePhotoKind = 'odometer' | 'fuel' | 'dashboard';

export async function analyzeVehiclePhoto(
  leadId: string,
  uri: string,
  kind: VehiclePhotoKind,
): Promise<{ odometer_km?: number; fuel_level?: FuelLevel; confidence?: number; note?: string } | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated');

  const formData = new FormData();
  formData.append('kind', kind);
  // @ts-ignore — React Native FormData
  formData.append('file', {
    uri,
    name: `${kind}.jpg`,
    type: 'image/jpeg',
  });

  const response = await fetch(`${ENV.API_URL}/api/pickup/${leadId}/analyze-vehicle-photo`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}` },
    body: formData,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    return null;
  }

  return {
    odometer_km: result.odometer_km ?? undefined,
    fuel_level: result.fuel_level ?? undefined,
    confidence: result.confidence ?? undefined,
    note: result.note ?? undefined,
  };
}

/** Read local file as base64 when needed for debug / future use. */
export async function readPhotoBase64(uri: string): Promise<string> {
  return FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
}
