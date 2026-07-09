import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { requireCustomer } from '@/lib/customer-api';
import { createAuthenticatedServiceBooking } from '@/lib/service-booking-create';
import { validateCouponForCheckout, redeemCouponAtomic } from '@/lib/coupon-service';
import { LEAD_SOURCES, normalizeLeadSource } from '@/lib/enquiry/createLead';
import { normalizeCustomerPhone, toServiceLeadType, findCustomerByPhone } from '@/lib/customer-service-leads';
import { pushServiceLeadToTeleCRM, saveBookedVehicleToProfile } from '@/lib/booking-telecrm-sync';
import { calculateBookingMembershipBundleDiscount } from '@/lib/booking-membership-discount';
import {
  calculateBundleDiscountWithConfig,
  getPostBookingMembershipConfig,
} from '@/lib/post-booking-membership-config';
import {
  debitServiceBookingWallet,
  resolveBookingServiceLabel,
  resolveServiceBookingWallet,
} from '@/lib/booking-wallet-apply';
import { buildPostBookingMembershipOffer } from '@/lib/post-booking-membership-offer';

type BookingPayload = {
  lead?: Record<string, any>;
  coupon?: {
    code?: string;
    lead_context?: {
      subtotal?: number;
      service_type_ids?: string[];
      subservice_ids?: string[];
      custom_labels?: string[];
      service_items?: Array<{
        service_type_id?: string | null;
        subservice_id?: string | null;
        label?: string | null;
        price?: number | null;
      }>;
      customer_phone?: string | null;
    };
  };
};

function normalizeCode(code: string) {
  return code.trim().toUpperCase();
}

function generateLeadNumber() {
  return `L-${Date.now().toString().slice(-8)}`;
}

function toEnquiryLeadType(input: string) {
  const raw = String(input || '').trim().toUpperCase();
  if (raw === 'CAR_SERVICE') return 'CAR_SERVICE';
  if (raw === 'HOME_CAR_SERVICE') return 'HOME_CAR_SERVICE';
  if (raw === 'RSA') return 'RSA';
  if (raw === 'NORMAL') return 'CAR_SERVICE';
  if (raw === 'HOME_SERVICE') return 'HOME_CAR_SERVICE';
  return null;
}

function findFreeServicePrice(
  coupon: any,
  context: BookingPayload['coupon'] extends infer C
    ? C extends { lead_context?: infer L }
      ? L
      : any
    : any
) {
  const serviceTypeIds = new Set((context as any)?.service_type_ids || []);
  const subserviceIds = new Set((context as any)?.subservice_ids || []);
  const customLabels = new Set(
    ((context as any)?.custom_labels || []).map((l: string) => String(l).toLowerCase())
  );
  const items = (context as any)?.service_items || [];

  const targetServiceTypeId = coupon?.target_service_type_id || null;
  const targetSubserviceId = coupon?.target_subservice_id || null;
  const targetCustomLabel = coupon?.target_custom_label || null;

  let matched = false;
  let price = 0;
  let matchLabel: string | null = null;

  if (targetServiceTypeId && serviceTypeIds.has(targetServiceTypeId)) matched = true;
  if (targetSubserviceId && subserviceIds.has(targetSubserviceId)) matched = true;
  if (targetCustomLabel && customLabels.has(String(targetCustomLabel).toLowerCase())) {
    matched = true;
    matchLabel = targetCustomLabel;
  }

  if (!matched) {
    return { matched: false, price: 0, matchLabel };
  }

  for (const item of items) {
    if (targetServiceTypeId && item.service_type_id === targetServiceTypeId) {
      price = Number(item.price || 0);
      matchLabel = item.label || matchLabel;
      break;
    }
    if (targetSubserviceId && item.subservice_id === targetSubserviceId) {
      price = Number(item.price || 0);
      matchLabel = item.label || matchLabel;
      break;
    }
    if (targetCustomLabel && item.label && String(item.label).toLowerCase() === String(targetCustomLabel).toLowerCase()) {
      price = Number(item.price || 0);
      matchLabel = item.label || matchLabel;
      break;
    }
  }

  return { matched: true, price, matchLabel };
}

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json().catch(() => ({}))) as BookingPayload & Record<string, unknown>;

    // Logged-in app users: wallet, membership bundle, CRM sync (same as customer route).
    const authCtx = await requireCustomer();
    if (!('response' in authCtx)) {
      return createAuthenticatedServiceBooking(request, authCtx, body);
    }

    const lead = body?.lead || {};

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const serviceLeadType = toServiceLeadType(String(lead?.lead_type || 'NORMAL'));
    const enquiryLeadType = toEnquiryLeadType(String(lead?.lead_type || 'NORMAL'));
    const isMobileClient = request.headers.get('x-mobile-client') === 'true';
    const leadSource = normalizeLeadSource(lead?.lead_source, { isMobileClient });
    if (!serviceLeadType || !enquiryLeadType) {
      return NextResponse.json({ error: 'Invalid lead_type' }, { status: 400 });
    }
    if (!LEAD_SOURCES.includes(leadSource as any)) {
      return NextResponse.json({ error: 'Invalid lead_source' }, { status: 400 });
    }

    const customerPhone = normalizeCustomerPhone(lead?.customer_phone || null);
    if (!customerPhone) {
      return NextResponse.json({ error: 'customer_phone is required' }, { status: 400 });
    }
    const registeredCustomer = await findCustomerByPhone(supabaseAdmin, customerPhone);
    const useWallet = Boolean(body.use_wallet);
    const subtotal = Number(body.subtotal || lead?.estimated_amount || 0);
    const pbConfig = await getPostBookingMembershipConfig(supabaseAdmin);
    const customerName = String(lead?.customer_name || '').trim() || `Customer_${customerPhone.slice(-4)}`;
    const vehicleNumber = String(lead?.vehicle_number || '').trim().toUpperCase() || 'NA';
    const serviceType =
      String(
        lead?.service_type ||
          (Array.isArray(lead?.service_type_ids) && lead.service_type_ids.length > 0 ? 'CAR_SERVICE' : '') ||
          lead?.problem_description ||
          'CAR_SERVICE'
      )
        .trim()
        .slice(0, 100) || 'CAR_SERVICE';

    const nowIso = new Date().toISOString();
    const leadNumber = String(lead?.lead_number || generateLeadNumber());

    let couponCode: string | null = null;
    let discountAmount = 0;
    let couponMeta: any = null;

    if (body?.coupon?.code) {
      const channel = String(body?.coupon?.lead_context?.channel || (request.headers.get('x-mobile-client') ? 'MOBILE' : 'WEB')).toUpperCase();
      const subtotal = Number(body?.coupon?.lead_context?.subtotal || lead?.estimated_amount || 0);
      const couponResult = await validateCouponForCheckout(
        supabaseAdmin,
        String(body.coupon.code || ''),
        {
          ...(body.coupon.lead_context || {}),
          subtotal,
          customer_phone: body?.coupon?.lead_context?.customer_phone || customerPhone,
          channel,
        },
        { serviceBooking: true },
      );

      if (!couponResult.valid) {
        return NextResponse.json({ error: couponResult.error }, { status: 400 });
      }

      couponCode = String(couponResult.coupon.code || '');
      discountAmount = couponResult.discountAmount;
      couponMeta = couponResult.couponMeta;
    }

    let membershipBundleDiscount = 0;
    const includeBookingMembership = Boolean(body.include_booking_membership);
    if (includeBookingMembership && subtotal > 0) {
      membershipBundleDiscount = calculateBundleDiscountWithConfig(subtotal, pbConfig);
    } else if (Number(body.membership_bundle_discount || 0) > 0) {
      membershipBundleDiscount = Math.min(
        Number(body.membership_bundle_discount),
        calculateBundleDiscountWithConfig(subtotal, pbConfig),
      );
    }

    let walletDeduction = 0;
    let finalAmount = Math.max(0, subtotal - discountAmount - membershipBundleDiscount);

    let postBookingMembershipOffer: ReturnType<typeof buildPostBookingMembershipOffer> | null = null;
    if (registeredCustomer?.id && subtotal > 0) {
      const { data: activeMembershipForOffer } = await supabaseAdmin
        .from('customer_memberships')
        .select('id')
        .eq('customer_id', registeredCustomer.id)
        .eq('status', 'ACTIVE')
        .gt('ends_at', nowIso)
        .limit(1)
        .maybeSingle();
      if (!activeMembershipForOffer) {
        postBookingMembershipOffer = pbConfig.enabled
          ? buildPostBookingMembershipOffer(subtotal, pbConfig)
          : null;
      }
    }

    if (useWallet && registeredCustomer?.id) {
      const walletResult = await resolveServiceBookingWallet(
        supabaseAdmin,
        registeredCustomer.id,
        request,
        body,
        {
          subtotal,
          couponDiscount: discountAmount,
          membershipBundleDiscount,
          vehicleNumber,
          useWallet: true,
        },
      );

      if (walletResult.blocked) {
        return NextResponse.json(
          { error: walletResult.reason || 'Wallet cannot be used for this vehicle' },
          { status: 400 },
        );
      }

      walletDeduction = walletResult.walletDeduction;
      finalAmount = walletResult.finalAmount;
    }

    const serviceLeadPayload = {
      ...lead,
      lead_number: leadNumber,
      lead_type: serviceLeadType || toServiceLeadType(String(lead?.lead_type || 'NORMAL')),
      lead_source: leadSource,
      created_from: lead?.created_from || (isMobileClient ? 'MOBILE_APP' : 'WEB'),
      status: lead?.status || 'NEW',
      customer_name: customerName,
      customer_phone: customerPhone,
      vehicle_number: vehicleNumber,
      service_type: serviceType,
      coupon_code: couponCode,
      discount_amount: discountAmount + membershipBundleDiscount,
      coupon_meta: couponMeta,
      estimated_amount: finalAmount,
      actual_amount: finalAmount,
      meta: (() => {
        const nextMeta: Record<string, unknown> =
          lead?.meta && typeof lead.meta === 'object' ? { ...(lead.meta as Record<string, unknown>) } : {};
        if (registeredCustomer?.id) nextMeta.customer_id = registeredCustomer.id;
        nextMeta.service_subtotal = subtotal;
        if (includeBookingMembership) {
          nextMeta.unpaid_membership_line_price = Number(body.membership_line_price || 0) || null;
        }
        if (membershipBundleDiscount > 0) {
          nextMeta.booking_membership_bundle = {
            include_membership: includeBookingMembership,
            discount_amount: membershipBundleDiscount,
            coupon_discount: discountAmount,
            service_subtotal: subtotal,
          };
        }
        if (walletDeduction > 0) {
          nextMeta.wallet_deduction = walletDeduction;
          nextMeta.wallet_applied = true;
        }
        if (postBookingMembershipOffer) {
          nextMeta.post_booking_membership_offer = postBookingMembershipOffer;
        }
        return Object.keys(nextMeta).length ? nextMeta : null;
      })(),
      created_at: lead?.created_at || nowIso,
    };

    const { data: serviceLead, error: leadError } = await supabaseAdmin
      .from('service_leads')
      .insert([serviceLeadPayload])
      .select()
      .single();

    if (leadError) {
      return NextResponse.json({ error: leadError.message }, { status: 500 });
    }

    if (walletDeduction > 0 && registeredCustomer?.id && serviceLead?.id) {
      try {
        const serviceLabel = resolveBookingServiceLabel(body);
        await debitServiceBookingWallet(supabaseAdmin, registeredCustomer.id, request, {
          leadId: serviceLead.id,
          leadNumber: serviceLead.lead_number || leadNumber,
          subtotal,
          couponDiscount: discountAmount,
          membershipBundleDiscount,
          walletDeduction,
          vehicleNumber,
          serviceLabel,
        });
      } catch (walletErr: any) {
        await supabaseAdmin.from('service_leads').delete().eq('id', serviceLead.id);
        return NextResponse.json(
          { error: walletErr?.message || 'Wallet deduction failed' },
          { status: 400 },
        );
      }
    }

    if (couponMeta?.coupon_id) {
      const redeemed = await redeemCouponAtomic(supabaseAdmin, {
        couponId: String(couponMeta.coupon_id),
        customerPhone,
        discountAmount,
        appliedByRole: 'CUSTOMER',
        serviceLeadId: serviceLead?.id || null,
        idempotencyKey: serviceLead?.id ? `lead:${serviceLead.id}` : null,
        meta: {
          lead_source: leadSource,
          channel: body?.coupon?.lead_context?.channel || (request.headers.get('x-mobile-client') ? 'MOBILE' : 'WEB'),
          customer_name: customerName,
          lead_number: leadNumber,
        },
      });
      if (!redeemed.success) {
        console.error('[bookings/create] coupon redemption failed:', redeemed.error);
      }
    }

    await saveBookedVehicleToProfile(supabaseAdmin, serviceLead as Record<string, any>, customerPhone);

    try {
      await pushServiceLeadToTeleCRM(serviceLead as Record<string, any>, supabaseAdmin, {
        leadTag: isMobileClient ? 'APP' : 'WEBSITE',
        leadSource: isMobileClient ? 'App Booking' : 'delhi_service',
        createdFrom: isMobileClient ? 'MOBILE_APP' : 'WEB',
        systemNote: isMobileClient ? 'Lead Source: App Booking' : 'Lead Source: WEBSITE',
      });
    } catch (err) {
      console.error('[bookings/create] external sync failed:', err);
      try {
        await supabaseAdmin.from('telecrm_api').insert({
          name: serviceLead?.customer_name || null,
          mobile: customerPhone,
          city: serviceLead?.city || null,
          service_type: serviceLead?.service_type || null,
          vehicle_number: serviceLead?.vehicle_number || null,
          vehicle_model: serviceLead?.vehicle_make ? `${serviceLead.vehicle_make} ${serviceLead.vehicle_model || ''}`.trim() : null,
          customer_quoted_amount: serviceLead?.estimated_amount || null,
          disposition: isMobileClient ? 'App Booking' : 'Website Booking',
          disposition_note: `Lead ${serviceLead?.lead_number || leadNumber} - TeleCRM direct push failed, queued for cron retry`,
        });
      } catch (fallbackErr: any) {
        console.error('[bookings/create] TeleCRM fallback insert failed:', fallbackErr?.message || fallbackErr);
      }
    }

    return NextResponse.json(
      {
        success: true,
        lead_id: serviceLead?.id || null,
        lead: serviceLead,
        coupon: couponMeta,
        wallet_deduction: walletDeduction,
        membership_bundle_discount: membershipBundleDiscount,
        amount_payable: finalAmount,
      },
      { status: 201 }
    );
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
