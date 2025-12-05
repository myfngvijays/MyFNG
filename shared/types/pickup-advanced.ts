/**
 * Advanced Pickup Features Types
 * Phase 7F Implementation - EXACT schema match
 */

// ============================================
// 1. PICKUP_DELIVERY_TASKS TABLE
// ============================================
export interface PickupDeliveryTask {
  id: string;
  task_number: string; // NOT NULL UNIQUE
  task_type: string; // NOT NULL (USER-DEFINED: pickup_task_type)
  lead_id: string | null;
  workshop_id: string | null;
  customer_name: string; // NOT NULL
  customer_phone: string; // NOT NULL
  customer_email: string | null;
  vehicle_number: string; // NOT NULL
  vehicle_make: string | null;
  vehicle_model: string | null;
  pickup_address: string; // NOT NULL
  pickup_latitude: number | null;
  pickup_longitude: number | null;
  delivery_address: string | null;
  delivery_latitude: number | null;
  delivery_longitude: number | null;
  assigned_to_id: string | null;
  assigned_by_id: string | null;
  status: string; // DEFAULT 'PENDING' (USER-DEFINED: pickup_task_status)
  scheduled_time: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  notes: string | null;
  customer_instructions: string | null;
  cancellation_reason: string | null;
  created_by_id: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 2. PICKUP_INCIDENTS TABLE
// ============================================
export interface PickupIncident {
  id: string;
  lead_id: string; // NOT NULL
  reported_by: string; // NOT NULL
  incident_type: string; // NOT NULL (USER-DEFINED: pickup_incident_type)
  description: string; // NOT NULL
  location_address: string | null;
  latitude: number | null;
  longitude: number | null;
  severity: string; // NOT NULL
  photo_urls: string[]; // ARRAY
  status: string; // DEFAULT 'OPEN'
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  notified_users: string[]; // ARRAY
  created_at: string;
  updated_at: string;
}

// ============================================
// 3. PICKUP_LOCATION_TRACKING TABLE
// ============================================
export interface PickupLocationTracking {
  id: string;
  lead_id: string; // NOT NULL
  pickup_boy_id: string; // NOT NULL
  latitude: number; // NOT NULL
  longitude: number; // NOT NULL
  accuracy: number | null;
  speed: number | null;
  heading: number | null;
  status: string; // NOT NULL
  battery_level: number | null;
  timestamp: string; // DEFAULT now()
}

// ============================================
// 4. PICKUP_OTPS TABLE
// ============================================
export interface PickupOTP {
  id: string;
  lead_id: string; // NOT NULL
  otp_type: string; // NOT NULL
  otp_code: string; // NOT NULL
  is_verified: boolean; // DEFAULT false
  verified_at: string | null;
  verified_by: string | null;
  expires_at: string; // NOT NULL
  resend_count: number; // DEFAULT 0
  created_at: string;
}

// ============================================
// 5. VEHICLE_CONDITION_PHOTOS TABLE
// ============================================
export interface VehicleConditionPhoto {
  id: string;
  lead_id: string; // NOT NULL
  photo_type: string; // NOT NULL
  photo_url: string; // NOT NULL
  thumbnail_url: string | null;
  uploaded_by: string; // NOT NULL
  odometer_reading: number | null;
  fuel_level: string | null;
  damage_description: string | null;
  latitude: number | null;
  longitude: number | null;
  timestamp: string; // DEFAULT now()
}

// INPUT TYPES
export interface CreatePickupTaskInput {
  task_type: string;
  lead_id?: string | null;
  workshop_id?: string | null;
  customer_name: string;
  customer_phone: string;
  customer_email?: string | null;
  vehicle_number: string;
  vehicle_make?: string | null;
  vehicle_model?: string | null;
  pickup_address: string;
  pickup_latitude?: number | null;
  pickup_longitude?: number | null;
  delivery_address?: string | null;
  delivery_latitude?: number | null;
  delivery_longitude?: number | null;
  scheduled_time?: string | null;
  notes?: string | null;
  customer_instructions?: string | null;
  created_by_id?: string | null;
}

export interface CreatePickupIncidentInput {
  lead_id: string;
  reported_by: string;
  incident_type: string;
  description: string;
  location_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  severity: string;
  photo_urls?: string[];
}

export interface CreateLocationTrackingInput {
  lead_id: string;
  pickup_boy_id: string;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  speed?: number | null;
  heading?: number | null;
  status: string;
  battery_level?: number | null;
}

export interface CreatePickupOTPInput {
  lead_id: string;
  otp_type: string;
  otp_code: string;
  expires_at: string;
}

export interface CreateVehiclePhotoInput {
  lead_id: string;
  photo_type: string;
  photo_url: string;
  thumbnail_url?: string | null;
  uploaded_by: string;
  odometer_reading?: number | null;
  fuel_level?: string | null;
  damage_description?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

// UTILITY TYPES (Updated to match database)
export type PickupTaskType = 'PICKUP' | 'DELIVERY' | 'BOTH'; // Matches pickup_task_type enum
export type PickupTaskStatus = 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'COMPLETED' | 'CANCELLED'; // Matches pickup_task_status enum
export type PickupIncidentType = 'WRONG_CUSTOMER' | 'VEHICLE_NOT_AVAILABLE' | 'CUSTOMER_REFUSED' | 'WRONG_ADDRESS' | 'CUSTOMER_AGGRESSIVE' | 'SAFETY_ISSUE' | 'ACCIDENT' | 'VEHICLE_DAMAGE' | 'OTHER';
export type IncidentSeverity = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
export type OTPType = 'PICKUP' | 'DROP'; // Matches database
export type PhotoType = 
  // Pickup photos
  'PICKUP_FRONT' | 'PICKUP_REAR' | 'PICKUP_LEFT' | 'PICKUP_RIGHT' | 'PICKUP_INTERIOR' | 
  'PICKUP_DASHBOARD' | 'PICKUP_ODOMETER' | 'PICKUP_DAMAGE' | 'PICKUP_FUEL' |
  // Drop photos
  'DROP_FRONT' | 'DROP_REAR' | 'DROP_LEFT' | 'DROP_RIGHT' | 'DROP_INTERIOR' | 
  'DROP_DASHBOARD' | 'DROP_ODOMETER' |
  // After work
  'AFTER_WORK';
export type FuelLevel = 'EMPTY' | 'QUARTER' | 'HALF' | 'THREE_QUARTER' | 'FULL';

