/**
 * Financial Management Types (Refunds & Payouts)
 * Phase 7C Implementation - EXACT schema match
 */

// ============================================
// 1. REFUND_REQUESTS TABLE
// ============================================
export interface RefundRequest {
  id: string;
  lead_id: string; // NOT NULL
  customer_id: string | null;
  workshop_id: string | null;
  amount: number; // NOT NULL, CHECK >= 0
  original_amount: number; // NOT NULL
  refund_type: string; // DEFAULT 'FULL', CHECK (FULL, PARTIAL, CANCELLATION, COMPLAINT, QUALITY_ISSUE)
  reason: string; // NOT NULL
  reason_category: string | null;
  customer_remarks: string | null;
  attachments: Record<string, any>[]; // jsonb DEFAULT '[]'
  complaint_id: string | null;
  status: string; // DEFAULT 'PENDING', CHECK (PENDING, APPROVED, REJECTED, PROCESSING, COMPLETED, FAILED)
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  refund_method: string | null;
  refund_reference: string | null;
  refund_date: string | null;
  workshop_penalty: number; // DEFAULT 0
  platform_cost: number; // DEFAULT 0
  who_bears_cost: string | null;
  notes: string | null;
  internal_remarks: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface CreateRefundRequestInput {
  lead_id: string;
  customer_id?: string | null;
  workshop_id?: string | null;
  amount: number;
  original_amount: number;
  refund_type?: string;
  reason: string;
  reason_category?: string | null;
  customer_remarks?: string | null;
  attachments?: Record<string, any>[];
  complaint_id?: string | null;
}

// ============================================
// 2. WORKSHOP_PAYOUTS TABLE
// ============================================
export interface WorkshopPayout {
  id: string;
  workshop_id: string; // NOT NULL
  amount: number; // NOT NULL, CHECK >= 0
  payout_period_start: string; // date, NOT NULL
  payout_period_end: string; // date, NOT NULL
  total_jobs: number; // DEFAULT 0
  job_ids: Record<string, any>[]; // jsonb DEFAULT '[]'
  status: string; // DEFAULT 'PENDING', CHECK (PENDING, APPROVED, REJECTED, PROCESSING, COMPLETED, FAILED)
  approved_by: string | null;
  approved_at: string | null;
  approval_notes: string | null;
  rejected_by: string | null;
  rejected_at: string | null;
  rejection_reason: string | null;
  payment_method: string | null;
  payment_reference: string | null;
  payment_date: string | null;
  bank_account_number: string | null;
  bank_ifsc_code: string | null;
  bank_name: string | null;
  calculation_breakdown: Record<string, any> | null; // jsonb
  deductions: Record<string, any> | null; // jsonb
  notes: string | null;
  created_at: string;
  created_by: string | null;
  updated_at: string;
}

export interface CreatePayoutInput {
  workshop_id: string;
  amount: number;
  payout_period_start: string;
  payout_period_end: string;
  total_jobs?: number;
  job_ids?: Record<string, any>[];
  calculation_breakdown?: Record<string, any>;
  deductions?: Record<string, any>;
  bank_account_number?: string;
  bank_ifsc_code?: string;
  bank_name?: string;
}

// UTILITY TYPES
export type RefundType = 'FULL' | 'PARTIAL' | 'CANCELLATION' | 'COMPLAINT' | 'QUALITY_ISSUE';
export type RefundStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';
export type PayoutStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

