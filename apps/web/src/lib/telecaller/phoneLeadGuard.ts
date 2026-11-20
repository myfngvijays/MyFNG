import { normalizePhone } from '@/lib/coupon-rules';
import { crmLeadClosedForFollowUp } from '@/lib/telecaller/crmFollowUpClose';
import {
  lookupKnownCustomerFill,
  type KnownCustomerFill,
} from '@/lib/whatsappAgents/inboundServiceLead';

export type PhoneLeadCheck = {
  phone10: string | null;
  blocked: boolean;
  message: string | null;
  leadNumber: string | null;
  ownerName: string | null;
  fill: KnownCustomerFill;
};

function blankLeadValue(value: unknown): boolean {
  const text = String(value ?? '').trim();
  if (!text) return true;
  const upper = text.toUpperCase();
  if (upper === 'NA' || upper === 'TBD' || upper === 'PENDING') return true;
  if (/^(customer[_\s]?\d+|call\s*\d+|whatsapp\s+\d+)/i.test(text)) return true;
  return false;
}

/** Copy stored customer/vehicle fields onto a new lead only where the new row is empty. */
export async function fillNewLeadFromHistory(db: any, payload: Record<string, unknown>) {
  const phone10 = normalizePhone(String(payload.customer_phone || ''));
  if (!phone10) return;
  const fill = await lookupKnownCustomerFill(db, phone10);
  applyKnownFillToPayload(payload, fill);
}

export function applyKnownFillToPayload(
  payload: Record<string, unknown>,
  fill: KnownCustomerFill | null | undefined,
) {
  if (!fill) return;
  const set = (key: string, value: string | null | undefined) => {
    const next = String(value || '').trim();
    if (!next || !blankLeadValue(payload[key])) return;
    payload[key] = key === 'vehicle_number' ? next.toUpperCase() : next;
  };
  set('customer_name', fill.customer_name);
  set('customer_email', fill.customer_email);
  set('vehicle_number', fill.vehicle_number);
  set('vehicle_make', fill.vehicle_make);
  set('vehicle_model', fill.vehicle_model);
  set('vehicle_variant', fill.vehicle_variant);
  set('vehicle_fuel_type', fill.vehicle_fuel_type);
  set('city', fill.city);
  set('pincode', fill.pincode);
  set('customer_address', fill.customer_address);
  set('pickup_address', fill.pickup_address);
}

/**
 * Manual add: block when this phone is already an open lead on someone else's id.
 * Any new lead: return the details we already have so empty fields can be filled.
 */
export async function inspectPhoneForNewLead(
  db: any,
  phone: unknown,
  actorId?: string | null,
): Promise<PhoneLeadCheck> {
  const phone10 = normalizePhone(String(phone || ''));
  const empty: PhoneLeadCheck = {
    phone10,
    blocked: false,
    message: null,
    leadNumber: null,
    ownerName: null,
    fill: {},
  };
  if (!phone10 || phone10.length < 10) return empty;

  const fill = await lookupKnownCustomerFill(db, phone10);
  const { data: rows } = await db
    .from('service_leads')
    .select('id, lead_number, status, assigned_telecaller_id, coupon_meta, created_at')
    .or(
      `customer_phone.eq.${phone10},customer_phone.eq.91${phone10},customer_phone.eq.+91${phone10}`,
    )
    .order('created_at', { ascending: false })
    .limit(30);

  const actor = String(actorId || '').trim();
  const other = (rows || []).find((row: any) => {
    const owner = String(row?.assigned_telecaller_id || '').trim();
    if (!owner || (actor && owner === actor)) return false;
    return !crmLeadClosedForFollowUp(row);
  });

  if (!other) {
    return { ...empty, fill };
  }

  let ownerName = '';
  const { data: user } = await db
    .from('users_login')
    .select('full_name, first_name, last_name')
    .eq('id', other.assigned_telecaller_id)
    .maybeSingle();
  ownerName = String(
    user?.full_name ||
      [user?.first_name, user?.last_name].filter(Boolean).join(' ') ||
      '',
  ).trim();

  const who = ownerName || 'kisi aur telecaller';
  const leadNumber = String(other.lead_number || '').trim();
  return {
    phone10,
    blocked: true,
    message: `Ye number pehle se ${who} ke lead${leadNumber ? ` ${leadNumber}` : ''} par hai.`,
    leadNumber: leadNumber || null,
    ownerName: ownerName || null,
    fill,
  };
}
