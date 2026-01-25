// Shared types used by both web and mobile.
// Mobile imports this via relative path from within apps/mobile/** -> ../../../../../apps/shared/types
// Keep minimal fields to satisfy mobile usage.

export type FuelLevel = 'EMPTY' | 'LOW' | 'HALF' | 'THREE_QUARTER' | 'FULL';

export type VehiclePhotoType =
  // Pickup photos
  | 'PICKUP_FRONT'
  | 'PICKUP_LEFT'
  | 'PICKUP_RIGHT'
  | 'PICKUP_REAR'
  | 'PICKUP_INTERIOR'
  | 'PICKUP_ODOMETER'
  | 'PICKUP_FUEL'
  | 'PICKUP_DAMAGE'
  // Drop photos
  | 'DROP_FRONT'
  | 'DROP_LEFT'
  | 'DROP_RIGHT'
  | 'DROP_REAR'
  | 'DROP_INTERIOR'
  | 'DROP_ODOMETER'
  | 'DROP_HANDOVER'
  // After-service / signature
  | 'AFTER_WORK'
  | 'DELIVERY_SIGNATURE';

export type IncidentType =
  | 'WRONG_CUSTOMER'
  | 'VEHICLE_NOT_AVAILABLE'
  | 'CUSTOMER_REFUSED'
  | 'WRONG_ADDRESS'
  | 'CUSTOMER_AGGRESSIVE'
  | 'SAFETY_ISSUE'
  | 'ACCIDENT'
  | 'VEHICLE_DAMAGE'
  | 'OTHER';

export interface ServiceLead {
  id: string;
  lead_number?: string | null;
  status?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  customer_email?: string | null;
  customer_address?: string | null;
  vehicle_number?: string | null;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  service_type?: string | null;
  workshop_id?: string | null;
  created_at?: string | null;
}

export interface PickupTracking {
  id: string;
  lead_id: string;
  pickup_boy_id?: string | null;
  pickup_type?: string | null;
  pickup_status?: string | null;
  drop_status?: string | null;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  pickup_address?: string | null;
  drop_latitude?: number | null;
  drop_longitude?: number | null;
  drop_address?: string | null;
  pickup_otp_verified_at?: string | null;
  drop_otp_verified_at?: string | null;
  started_at?: string | null;
  arrived_at?: string | null;
  completed_at?: string | null;
}


