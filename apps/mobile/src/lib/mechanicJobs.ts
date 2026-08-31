import { ENV } from '../config/environment';

export type MechanicDashboardJob = {
  id: string;
  job_id?: string;
  lead_id: string;
  lead_number?: string;
  customer_name: string;
  vehicle_number: string;
  vehicle_make?: string;
  vehicle_model?: string;
  service_type?: string;
  service_types?: string[];
  mechanic_status: string;
  job_priority?: string;
  assigned_at?: string;
  started_at?: string;
  completed_at?: string;
  sla_remaining_minutes?: number;
  before_images_count?: number;
  progress_images_count?: number;
  after_images_count?: number;
  has_pending_extra_work?: boolean;
  checklist_completed?: boolean;
  pickup_status?: string;
  pickup_required?: boolean;
  checklist_done?: number;
  checklist_total?: number;
  display_status?: string;
};

/** Fetch mechanic jobs via API (bypasses auth.uid vs users_login.id RLS mismatch). */
export async function fetchMechanicJobs(accessToken: string): Promise<MechanicDashboardJob[]> {
  const response = await fetch(`${ENV.API_URL}/api/mechanic/jobs`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'x-mobile-client': 'true',
    },
  });
  const json = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(json.error || json.details || `HTTP ${response.status}`);
  }
  return Array.isArray(json.jobs) ? json.jobs : [];
}
