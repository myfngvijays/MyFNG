import { enrichBookingLead, getLeadPricingBreakdown } from '@/lib/booking-lead-utils';
import { getPostBookingMembershipConfig } from '@/lib/post-booking-membership-config';
import { resolveAdminBookingPriceBreakdown, resolveAdminBookingPayableAmount } from '@/lib/post-booking-membership-offer';
import { buildTelecallerCrmQuote } from '@/lib/telecaller/crmQuote';

export type LeadPriceLine = { kind: 'service' | 'addon'; name: string; price: number };

/** One booking's price, line by line — same maths as App Customers (Customer Insights). */
export type LeadPriceSummary = {
  lines: LeadPriceLine[];
  subtotal: number;
  couponDiscount: number;
  couponCode: string | null;
  referralDiscount: number;
  membershipDiscount: number;
  walletUsed: number;
  walletPercent: number | null;
  /** Membership bought with the booking, still to collect with the service. */
  membershipFee: number;
  membershipPaidOnline: boolean;
  membershipPlanPrice: number;
  invoiceAmount: number;
  payable: number;
  source: string | null;
  bookedAt: string | null;
  slot: string | null;
  serviceLabel: string;
};

function parseIds(raw: unknown): string[] {
  let v: unknown = raw;
  if (typeof v === 'string') {
    try {
      v = JSON.parse(v);
    } catch {
      v = [];
    }
  }
  return Array.isArray(v) ? v.map((x) => String(x || '').trim()).filter(Boolean) : [];
}

export async function buildLeadPriceSummary(db: any, rawLead: Record<string, any>): Promise<LeadPriceSummary> {
  const lead = enrichBookingLead(rawLead) as Record<string, any>;
  const pbConfig = await getPostBookingMembershipConfig(db);
  const breakdown = resolveAdminBookingPriceBreakdown(lead, pbConfig);
  // Same wallet % as App Customers: taken from the booking's wallet debit, not recomputed.
  let walletTx: { amount: number; percent?: number } | undefined;
  try {
    const { data: tx } = await db
      .from('wallet_transactions')
      .select('amount, metadata, idempotency_key')
      .eq('transaction_type', 'DEBIT')
      .or(`idempotency_key.eq.booking:${lead.id},metadata->>lead_id.eq.${lead.id}`)
      .limit(1)
      .maybeSingle();
    if (tx) {
      const m = tx.metadata && typeof tx.metadata === 'object' ? tx.metadata : {};
      walletTx = { amount: Math.abs(Number(tx.amount || 0)), percent: Number(m.usage_percent || 0) || undefined };
    }
  } catch {
    walletTx = undefined;
  }
  const pricing = getLeadPricingBreakdown(lead, {
    walletTxAmount: walletTx?.amount,
    walletTxPercent: walletTx?.percent,
    payableOverride: resolveAdminBookingPayableAmount(lead, pbConfig),
  });

  const serviceIds = parseIds(lead.service_type_ids);
  const addonIds = parseIds(lead.subservice_ids);
  let lines: LeadPriceLine[] = [];
  if (serviceIds.length || addonIds.length) {
    try {
      const cm = lead.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
      const quote = await buildTelecallerCrmQuote(db, {
        serviceTypeIds: serviceIds,
        addonIds,
        cityId: lead.city_id ? String(lead.city_id) : null,
        vehicleClass: cm.vehicle_class ? String(cm.vehicle_class) : null,
        modelId: lead.model_id ? String(lead.model_id) : null,
        vehicleMake: lead.vehicle_make ? String(lead.vehicle_make) : null,
        vehicleModel: lead.vehicle_model ? String(lead.vehicle_model) : null,
      });
      const byId = new Map(quote.line_items.map((li) => [String(li.id), li]));
      lines = [...serviceIds, ...addonIds].map((id, idx) => {
        const li = byId.get(id);
        return {
          kind: idx === 0 ? 'service' : 'addon',
          name: li?.name || 'Service',
          price: Number(li?.price || 0),
        };
      });
    } catch {
      lines = [];
    }
  }

  const slotRaw = lead.preferred_slot_start || (lead.preferred_date ? `${lead.preferred_date} ${lead.preferred_time_slot || ''}` : '');

  return {
    lines,
    subtotal: breakdown.serviceSubtotal > 0 ? breakdown.serviceSubtotal : pricing.original,
    couponDiscount: breakdown.couponDiscount > 0 ? breakdown.couponDiscount : pricing.couponDiscount,
    couponCode: lead.coupon_display_code ? String(lead.coupon_display_code) : null,
    referralDiscount: pricing.referralDiscount,
    membershipDiscount: breakdown.membershipBundleDiscount,
    walletUsed: breakdown.walletUsed > 0 ? breakdown.walletUsed : pricing.walletUsed,
    walletPercent: pricing.walletUsagePercent,
    membershipFee: breakdown.membershipFee,
    membershipPaidOnline: breakdown.membershipPaidOnline,
    membershipPlanPrice: breakdown.membershipPlanPrice,
    invoiceAmount: breakdown.invoiceAmount,
    payable: pricing.payable,
    source: lead.booking_source_label ? String(lead.booking_source_label) : lead.lead_source ? String(lead.lead_source) : null,
    bookedAt: lead.created_at ? String(lead.created_at) : null,
    slot: String(slotRaw || '').trim() || null,
    serviceLabel: String(lead.service_type || '').trim(),
  };
}
