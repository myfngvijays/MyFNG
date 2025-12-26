/**
 * Shared TypeScript Types
 */

import { UserRole } from '../constants/roles';

// Lead Types
export enum LeadType {
  NORMAL = 'NORMAL',
  RSA = 'RSA', // Roadside Assistance
  HOME_SERVICE = 'HOME_SERVICE',
}

// Lead Status
export enum LeadStatus {
  NEW = 'NEW',
  ASSIGNED = 'ASSIGNED',
  ACCEPTED = 'ACCEPTED',
  REJECTED = 'REJECTED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// Lead Priority
export enum LeadPriority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  URGENT = 'URGENT',
}

// Pickup Task Types
export enum PickupTaskType {
  PICKUP = 'PICKUP',
  DELIVERY = 'DELIVERY',
  BOTH = 'BOTH',
}

// Pickup Task Status (Matches database enum)
export enum PickupTaskStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_TRANSIT = 'IN_TRANSIT',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

// User Interface
export interface User {
  id: string;
  email: string;
  phone?: string;
  full_name: string;
  role_id: string;
  role?: Role;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_login?: string;
  profile_image?: string;
  department?: string;
  workshop_id?: string;
  workshop?: Workshop;
}

// Role Interface
export interface Role {
  id: string;
  role_code: UserRole;
  role_name: string;
  description?: string;
  permissions: Record<string, any>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// Workshop Interface
export interface Workshop {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contact_person: string;
  phone: string;
  email: string;
  is_verified: boolean;
  audit_score?: number;
  created_at: string;
  updated_at: string;
}

// Service Lead Interface
export interface ServiceLead {
  id: string;
  lead_number: string;
  lead_type: LeadType;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  vehicle_number: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  service_type: string;
  description?: string;
  estimated_amount?: number;
  actual_amount?: number;
  status: LeadStatus;
  priority: LeadPriority;
  assigned_to_id?: string;
  assigned_to?: User;
  workshop_id?: string;
  workshop?: Workshop;
  location_latitude?: number;
  location_longitude?: number;
  address?: string;
  city?: string;
  state?: string;
  pincode?: string;
  notes?: string;
  internal_notes?: string;
  assigned_at?: string;
  accepted_at?: string;
  declined_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  created_by_id?: string;
  created_by?: User;
  updated_by_id?: string;
  updated_by?: User;
  created_at: string;
  updated_at: string;
}

// Pickup Delivery Task Interface
export interface PickupDeliveryTask {
  id: string;
  task_number: string;
  task_type: PickupTaskType;
  lead_id?: string;
  lead?: ServiceLead;
  workshop_id?: string;
  workshop?: Workshop;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  vehicle_number: string;
  vehicle_make?: string;
  vehicle_model?: string;
  pickup_address: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  delivery_address?: string;
  delivery_latitude?: number;
  delivery_longitude?: number;
  assigned_to_id?: string;
  assigned_to?: User;
  assigned_by_id?: string;
  assigned_by?: User;
  status: PickupTaskStatus;
  scheduled_time?: string;
  started_at?: string;
  completed_at?: string;
  cancelled_at?: string;
  notes?: string;
  customer_instructions?: string;
  cancellation_reason?: string;
  created_by_id?: string;
  created_by?: User;
  created_at: string;
  updated_at: string;
}

// Audit Log Interface
export interface AuditLog {
  id: string;
  user_id?: string;
  user?: User;
  action: string;
  table_name?: string;
  record_id?: string;
  old_data?: Record<string, any>;
  new_data?: Record<string, any>;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// User Consent Interface (GDPR)
export interface UserConsent {
  id: string;
  user_id?: string;
  user?: User;
  consent_type: string;
  consent_given: boolean;
  consent_text?: string;
  ip_address?: string;
  created_at: string;
  updated_at: string;
}

// Data Deletion Request Interface (GDPR)
export interface DataDeletionRequest {
  id: string;
  user_id?: string;
  user?: User;
  email: string;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
  requested_at: string;
  processed_at?: string;
  processed_by?: string;
  processed_by_user?: User;
}

// ============================================
// PICKUP BOY SPECIFIC TYPES
// ============================================

// Pickup Status (Complete as per documentation)
export enum PickupStatus {
  NOT_ASSIGNED = 'NOT_ASSIGNED',
  PENDING = 'PENDING',
  ON_THE_WAY = 'ON_THE_WAY',              // ✨ NEW: Pickup boy started navigation
  ARRIVED = 'ARRIVED',                    // ✨ NEW: Arrived at customer location
  OTP_VERIFIED = 'OTP_VERIFIED',          // OTP verified, authorized to pickup
  PICKED = 'PICKED',                      // Vehicle picked from customer
  VEHICLE_IN_TRANSIT = 'VEHICLE_IN_TRANSIT', // ✨ NEW: Vehicle in transit to workshop
  ARRIVED_AT_WORKSHOP = 'ARRIVED_AT_WORKSHOP', // Arrived at workshop
  VEHICLE_DROPPED_AT_WORKSHOP = 'VEHICLE_DROPPED_AT_WORKSHOP', // ✨ NEW: Vehicle dropped at workshop (keys handed over)
  DROPPED = 'DROPPED',                    // Legacy status
  FAILED_PICKUP = 'FAILED_PICKUP',
}

// Drop Status (Complete as per documentation)
export enum DropStatus {
  NOT_REQUIRED = 'NOT_REQUIRED',
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',  // ✨ NEW: Out for delivery to customer
  IN_TRANSIT = 'IN_TRANSIT',              // Vehicle in transit to customer
  ARRIVED_AT_CUSTOMER = 'ARRIVED_AT_CUSTOMER', // ✨ NEW: Arrived at customer location for delivery
  DELIVERED = 'DELIVERED',                 // Vehicle delivered successfully
  FAILED_DROP = 'FAILED_DROP',
}

// Payment Mode
export enum PaymentMode {
  ONLINE = 'ONLINE',
  COD = 'COD',
  UPI = 'UPI',
  CARD = 'CARD',
  WALLET = 'WALLET',
  PENDING = 'PENDING',
}

// Incident Type
export enum IncidentType {
  WRONG_CUSTOMER = 'WRONG_CUSTOMER',
  VEHICLE_NOT_AVAILABLE = 'VEHICLE_NOT_AVAILABLE',
  CUSTOMER_REFUSED = 'CUSTOMER_REFUSED',
  WRONG_ADDRESS = 'WRONG_ADDRESS',
  CUSTOMER_AGGRESSIVE = 'CUSTOMER_AGGRESSIVE',
  SAFETY_ISSUE = 'SAFETY_ISSUE',
  ACCIDENT = 'ACCIDENT',
  VEHICLE_DAMAGE = 'VEHICLE_DAMAGE',
  OTHER = 'OTHER',
}

// Vehicle Photo Type (Complete as per documentation)
export enum VehiclePhotoType {
  // Pickup photos (BEFORE pickup - required)
  PICKUP_FRONT = 'PICKUP_FRONT',           // Front view
  PICKUP_REAR = 'PICKUP_REAR',             // Rear view
  PICKUP_LEFT = 'PICKUP_LEFT',             // Left side
  PICKUP_RIGHT = 'PICKUP_RIGHT',           // Right side
  PICKUP_INTERIOR = 'PICKUP_INTERIOR',     // Interior view
  PICKUP_DASHBOARD = 'PICKUP_DASHBOARD',   // ✨ NEW: Dashboard + Odometer (as per doc)
  PICKUP_ODOMETER = 'PICKUP_ODOMETER',     // Odometer reading
  PICKUP_DAMAGE = 'PICKUP_DAMAGE',         // Any visible damages
  PICKUP_FUEL = 'PICKUP_FUEL',             // Fuel level
  // Drop photos (Optional but recommended)
  DROP_FRONT = 'DROP_FRONT',               // Front view at delivery
  DROP_REAR = 'DROP_REAR',                 // Rear view at delivery
  DROP_LEFT = 'DROP_LEFT',                 // Left side at delivery
  DROP_RIGHT = 'DROP_RIGHT',               // Right side at delivery
  DROP_INTERIOR = 'DROP_INTERIOR',         // Interior at delivery
  DROP_DASHBOARD = 'DROP_DASHBOARD',       // ✨ NEW: Dashboard at delivery
  DROP_ODOMETER = 'DROP_ODOMETER',         // Odometer at delivery
  // After work photos
  AFTER_WORK = 'AFTER_WORK',               // After service completion
  // Delivery signature (for home delivery)
  DELIVERY_SIGNATURE = 'DELIVERY_SIGNATURE', // Customer signature at delivery
}

// Fuel Level
export enum FuelLevel {
  EMPTY = 'EMPTY',
  QUARTER = 'QUARTER',
  HALF = 'HALF',
  THREE_QUARTER = 'THREE_QUARTER',
  FULL = 'FULL',
}

// Pickup Tracking Interface
export interface PickupTracking {
  id: string;
  lead_id: string;
  lead?: ServiceLead;
  pickup_required: boolean;
  drop_required: boolean;
  
  // Pickup workflow (Complete as per documentation)
  pickup_status: PickupStatus;
  pickup_assigned_to?: string;
  pickup_assigned_to_user?: User;
  pickup_assigned_at?: string;
  pickup_start_time?: string;              // When navigation started
  pickup_on_the_way_at?: string;          // ✨ NEW: When status changed to ON_THE_WAY
  pickup_arrived_at?: string;              // ✨ NEW: When arrived at customer location
  pickup_otp?: string;
  pickup_otp_verified_at?: string;
  pickup_picked_time?: string;
  pickup_odometer_reading?: number;        // ✨ NEW: Odometer reading at pickup
  pickup_in_transit_at?: string;          // ✨ NEW: When started driving to workshop
  pickup_arrival_time?: string;           // When arrived at workshop
  pickup_handover_to_workshop_at?: string; // ✨ NEW: When keys handed over
  pickup_handover_to_workshop_by?: string; // ✨ NEW: Who received at workshop (Supervisor/Admin/Reception)
  pickup_address?: string;
  pickup_latitude?: number;
  pickup_longitude?: number;
  pickup_distance?: number;
  pickup_time_slot?: string;               // ✨ NEW: Time slot (e.g., "10:00 AM - 12:00 PM")
  pickup_time_window_start?: string;
  pickup_time_window_end?: string;
  pickup_notes?: string;
  pickup_customer_instructions?: string;
  pickup_remarks?: string;                // ✨ NEW: Any remarks during pickup
  
  // Drop workflow (Complete as per documentation)
  drop_status: DropStatus;
  drop_assigned_to?: string;
  drop_assigned_to_user?: User;
  drop_assigned_at?: string;
  drop_start_time?: string;               // When started from workshop
  drop_out_for_delivery_at?: string;      // ✨ NEW: When status changed to OUT_FOR_DELIVERY
  drop_in_transit_at?: string;            // ✨ NEW: When in transit to customer
  drop_arrived_at?: string;               // ✨ NEW: When arrived at customer location
  drop_otp?: string;
  drop_otp_verified_at?: string;
  drop_completed_time?: string;
  drop_odometer_reading?: number;         // ✨ NEW: Odometer reading at delivery
  drop_address?: string;
  drop_latitude?: number;
  drop_longitude?: number;
  drop_time_slot?: string;                // ✨ NEW: Time slot for delivery
  drop_notes?: string;
  drop_final_remarks?: string;            // ✨ NEW: Customer issues reported at delivery
  
  // Payment
  payment_mode: PaymentMode;
  payment_amount?: number;
  payment_collected_at?: string;
  payment_proof_url?: string;
  
  // Invoice verification (for delivery)
  invoice_paid?: boolean;                  // ✨ NEW: Invoice payment verification
  invoice_paid_at?: string;                 // ✨ NEW: When invoice was paid
  invoice_paid_by?: string;                // ✨ NEW: Who verified payment
  invoice_id?: string;                     // ✨ NEW: Reference to invoice
  
  created_at: string;
  updated_at: string;
}

// Pickup OTP Interface
export interface PickupOTP {
  id: string;
  lead_id: string;
  otp_type: 'PICKUP' | 'DROP';
  otp_code: string;
  is_verified: boolean;
  verified_at?: string;
  verified_by?: string;
  verified_by_user?: User;
  expires_at: string;
  resend_count: number;
  created_at: string;
}

// Vehicle Condition Photo Interface
export interface VehicleConditionPhoto {
  id: string;
  lead_id: string;
  photo_type: VehiclePhotoType;
  photo_url: string;
  thumbnail_url?: string;
  uploaded_by: string;
  uploaded_by_user?: User;
  odometer_reading?: number;
  fuel_level?: FuelLevel;
  damage_description?: string;
  latitude?: number;
  longitude?: number;
  timestamp: string;
}

// Pickup Incident Interface
export interface PickupIncident {
  id: string;
  lead_id: string;
  lead?: ServiceLead;
  reported_by: string;
  reported_by_user?: User;
  incident_type: IncidentType;
  description: string;
  location_address?: string;
  latitude?: number;
  longitude?: number;
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  photo_urls: string[];
  status: 'OPEN' | 'INVESTIGATING' | 'RESOLVED' | 'CLOSED';
  resolved_by?: string;
  resolved_by_user?: User;
  resolved_at?: string;
  resolution_notes?: string;
  notified_users: string[];
  created_at: string;
  updated_at: string;
}

// Pickup Location Tracking Interface
export interface PickupLocationTracking {
  id: string;
  lead_id: string;
  pickup_boy_id: string;
  pickup_boy?: User;
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  status: 'IDLE' | 'MOVING_TO_PICKUP' | 'AT_PICKUP' | 'IN_TRANSIT_TO_WORKSHOP' | 'AT_WORKSHOP' | 'MOVING_TO_DROP' | 'AT_DROP';
  battery_level?: number;
  timestamp: string;
}

// Pickup Boy Metrics Interface
export interface PickupBoyMetrics {
  id: string;
  pickup_boy_id: string;
  pickup_boy?: User;
  date: string;
  total_pickups: number;
  completed_pickups: number;
  failed_pickups: number;
  total_drops: number;
  completed_drops: number;
  failed_drops: number;
  avg_pickup_time?: number;
  avg_drop_time?: number;
  punctuality_score?: number;
  otp_success_rate?: number;
  photo_compliance_rate?: number;
  customer_complaints: number;
  distance_traveled?: number;
  created_at: string;
  updated_at: string;
}

// Pickup Boy Dashboard Data
export interface PickupBoyDashboardData {
  today_pickups: PickupTracking[];
  today_drops: PickupTracking[];
  pending_otp: PickupTracking[];
  completed_pickups: PickupTracking[];
  completed_drops: PickupTracking[];
  total_distance: number;
  metrics: PickupBoyMetrics;
}

