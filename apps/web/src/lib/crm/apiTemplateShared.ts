/** Client-safe bits of CRM API Templates (labels, triggers, variable catalog). */

export const CRM_RESULT_LABELS: Record<string, string> = {
  FRESH: 'Fresh',
  RINGING: 'Ringing',
  INTERESTED: 'Interested',
  WILL_VISIT: 'He will visit',
  CALLBACK: 'Follow-up',
  BOOKING_CONFIRMED: 'Booking confirmed',
  IN_SERVICE: 'In Service',
  SERVICE_DONE: 'Service Done',
  LOST: 'Lost',
  OTHER: 'Other',
};

export const TRIGGER_OPTIONS: Array<{ id: string; label: string }> = [
  { id: 'SERVICE_DONE', label: 'Lead → Service Done' },
  { id: 'BOOKING_CONFIRMED', label: 'Lead → Booking confirmed' },
  { id: 'IN_SERVICE', label: 'Lead → In Service' },
  { id: 'LOST', label: 'Lead → Lost' },
  { id: 'INTERESTED', label: 'Lead → Interested' },
  { id: 'WILL_VISIT', label: 'Lead → He will visit' },
  { id: 'CALLBACK', label: 'Lead → Follow-up' },
  { id: 'RINGING', label: 'Lead → Ringing' },
  { id: 'OTHER', label: 'Lead → Other' },
  { id: 'MANUAL', label: 'Manual only (Test button)' },
];

export function triggerLabel(id: string) {
  return TRIGGER_OPTIONS.find((t) => t.id === id)?.label || id;
}

/** Variables shown in the editor. Names are case/space-insensitive when sent. */
export const TEMPLATE_VARIABLES: Array<{ name: string; hint: string }> = [
  { name: 'Phone', hint: '10-digit number' },
  { name: 'Phone With Code', hint: '91 + number' },
  { name: 'Name', hint: 'Customer name' },
  { name: 'Email', hint: 'Customer email' },
  { name: 'Workshop', hint: 'Workshop name' },
  { name: 'PACKAGE', hint: 'Service / package' },
  { name: 'Amount', hint: 'Estimated amount' },
  { name: 'PickupVisit', hint: 'Pickup or Visit' },
  { name: 'REMARK', hint: 'Telecaller remark' },
  { name: 'Note', hint: 'Lead note' },
  { name: 'Model', hint: 'Make + model' },
  { name: 'Make', hint: 'Car make' },
  { name: 'Car Model', hint: 'Car model only' },
  { name: 'CARNO', hint: 'Car number' },
  { name: 'Vehicle Class', hint: 'Hatchback / Sedan …' },
  { name: 'Fuel', hint: 'Fuel type' },
  { name: 'ADDRESS', hint: 'Full address' },
  { name: 'Area', hint: 'Area' },
  { name: 'City', hint: 'City' },
  { name: 'Pincode', hint: 'Pincode' },
  { name: 'Plan', hint: 'Membership plan' },
  { name: 'status', hint: 'New status label' },
  { name: 'Status Code', hint: 'e.g. SERVICE_DONE' },
  { name: 'Lead Number', hint: 'L-…' },
  { name: 'Lead Link', hint: 'Link to lead in admin panel' },
  { name: 'lead_id', hint: 'Same as Lead Link (TeleCRM name)' },
  { name: 'Lead UUID', hint: 'Internal id' },
  { name: 'Source', hint: 'Lead source' },
  { name: 'Service Done', hint: 'Date-time now (IST)' },
  { name: 'Date Time', hint: 'Date-time now (IST)' },
  { name: 'Sent At', hint: '21/11/2026 14:45:16 (sheet format)' },
  { name: 'Service', hint: 'Service name only' },
  { name: 'Preferred Slot', hint: 'Booked slot' },
  { name: 'ACTION_text', hint: 'System note: status + who' },
  { name: 'Changed By', hint: 'Who changed the status' },
  { name: 'ASSIGNEE_EMAIL', hint: 'Telecaller email' },
  { name: 'Assignee Name', hint: 'Telecaller name' },
  { name: 'Repeat Customer', hint: 'Yes / No' },
];

export type ApiTemplateRow = {
  id: string;
  name: string;
  description: string | null;
  method: string;
  url: string;
  timeout_seconds: number;
  auth_type: 'NONE' | 'BEARER' | 'BASIC' | 'HEADER';
  auth_token: string;
  auth_username: string;
  auth_password: string;
  auth_header_name: string;
  auth_header_value: string;
  has_auth_token: boolean;
  has_auth_password: boolean;
  has_auth_header_value: boolean;
  extra_headers: Record<string, string>;
  payload_type: 'JSON' | 'FORM';
  payload_template: string;
  trigger_status: string;
  is_active: boolean;
  send_once_per_lead: boolean;
  variables: string[];
  last_run_at: string | null;
  last_run_ok: boolean | null;
  last_run_status: number | null;
  last_run_error: string | null;
  created_by_name: string | null;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
};
