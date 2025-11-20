/**
 * Job Cards & Pricing Types
 * Phase 7E Implementation - EXACT schema match
 */

// ============================================
// 1. JOB_CARDS TABLE
// ============================================
export interface JobCard {
  id: string;
  lead_id: string; // NOT NULL UNIQUE
  job_card_number: string; // NOT NULL UNIQUE
  labor_charges: number; // DEFAULT 0
  additional_work: string | null;
  mechanic_notes: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

// ============================================
// 2. JOB_CARD_PARTS TABLE
// ============================================
export interface JobCardPart {
  id: string;
  job_card_id: string; // NOT NULL
  part_name: string; // NOT NULL
  part_number: string | null;
  quantity: number; // NOT NULL DEFAULT 1
  unit_price: number; // NOT NULL
  total_price: number; // NOT NULL
  created_at: string;
}

// ============================================
// 3. LEAD_PRICING_ITEMS TABLE
// ============================================
export interface LeadPricingItem {
  id: string;
  lead_id: string; // NOT NULL
  service_type_id: number | null;
  subservice_id: number | null;
  item_name: string; // NOT NULL
  item_description: string | null;
  base_price: number; // NOT NULL DEFAULT 0
  final_price: number; // NOT NULL
  qty: number; // NOT NULL DEFAULT 1
  discount_percentage: number; // DEFAULT 0
  tax_percentage: number; // DEFAULT 0
  is_addon: boolean; // DEFAULT false
  status: string; // DEFAULT 'ACTIVE'
  added_by: string | null;
  locked_at: string; // DEFAULT now()
  created_at: string;
  updated_at: string;
}

// INPUT TYPES
export interface CreateJobCardInput {
  lead_id: string;
  labor_charges?: number;
  additional_work?: string | null;
  mechanic_notes?: string | null;
  created_by?: string | null;
}

export interface CreateJobCardPartInput {
  job_card_id: string;
  part_name: string;
  part_number?: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
}

export interface CreatePricingItemInput {
  lead_id: string;
  service_type_id?: number | null;
  subservice_id?: number | null;
  item_name: string;
  item_description?: string | null;
  base_price: number;
  final_price: number;
  qty?: number;
  discount_percentage?: number;
  tax_percentage?: number;
  is_addon?: boolean;
  status?: string;
  added_by?: string | null;
}

export interface JobCardWithParts extends JobCard {
  parts: JobCardPart[];
}

