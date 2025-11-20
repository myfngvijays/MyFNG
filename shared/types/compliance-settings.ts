/**
 * Compliance & Settings Types
 * Phase 7J Implementation - EXACT schema match
 */

// ============================================
// 1. LEAD_SOURCES TABLE
// ============================================
export interface LeadSource {
  id: string;
  source_code: string; // NOT NULL UNIQUE
  source_name: string; // NOT NULL
  description: string | null;
  is_active: boolean; // DEFAULT true
  created_at: string;
}

// ============================================
// 2. DATA_DELETION_REQUESTS TABLE
// ============================================
export interface DataDeletionRequest {
  id: string;
  user_id: string | null;
  email: string; // NOT NULL
  reason: string | null;
  status: string; // DEFAULT 'PENDING'
  requested_at: string; // DEFAULT now()
  processed_at: string | null;
  processed_by: string | null;
}

// ============================================
// 3. USER_CONSENTS TABLE
// ============================================
export interface UserConsent {
  id: string;
  user_id: string | null;
  consent_type: string; // NOT NULL
  consent_given: boolean; // DEFAULT false
  consent_text: string | null;
  ip_address: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 4. SYSTEM_SETTINGS TABLE
// ============================================
export interface SystemSetting {
  id: string;
  setting_key: string; // NOT NULL UNIQUE
  setting_value: string; // NOT NULL
  setting_type: string; // NOT NULL DEFAULT 'STRING', CHECK (STRING, NUMBER, BOOLEAN, JSON, DATE)
  category: string; // NOT NULL
  description: string | null;
  default_value: string | null;
  is_editable: boolean; // DEFAULT true
  requires_restart: boolean; // DEFAULT false
  validation_rules: Record<string, any> | null; // jsonb
  updated_by: string | null;
  updated_at: string; // DEFAULT now()
  created_at: string;
}

// INPUT TYPES
export interface CreateLeadSourceInput {
  source_code: string;
  source_name: string;
  description?: string | null;
  is_active?: boolean;
}

export interface CreateDeletionRequestInput {
  user_id?: string | null;
  email: string;
  reason?: string | null;
}

export interface CreateUserConsentInput {
  user_id?: string | null;
  consent_type: string;
  consent_given: boolean;
  consent_text?: string | null;
  ip_address?: string | null;
}

export interface CreateSystemSettingInput {
  setting_key: string;
  setting_value: string;
  setting_type?: string;
  category: string;
  description?: string | null;
  default_value?: string | null;
  is_editable?: boolean;
  requires_restart?: boolean;
  validation_rules?: Record<string, any> | null;
}

export interface UpdateSystemSettingInput {
  setting_value: string;
  updated_by?: string | null;
}

// UTILITY TYPES
export type SettingType = 'STRING' | 'NUMBER' | 'BOOLEAN' | 'JSON' | 'DATE';
export type DeletionRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'COMPLETED';
export type ConsentType = 'TERMS_OF_SERVICE' | 'PRIVACY_POLICY' | 'MARKETING' | 'DATA_SHARING' | 'COOKIES';

export interface SettingsByCategory {
  [category: string]: SystemSetting[];
}

