import { NextResponse } from 'next/server';
import { requireCustomer } from '@/lib/customer-api';
import {
  expireUnpaidBookingMembershipBundleIfNeeded,
  resolveActiveMembershipBundleDiscount,
  resolveLeadAmountDisplay,
  resolvePostBookingMembershipOfferStatus,
  resolveServiceLeadCouponDiscount,
} from '@/lib/post-booking-membership-offer';
import { getPostBookingMembershipConfig } from '@/lib/post-booking-membership-config';

export const dynamic = 'force-dynamic';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const ctx = await requireCustomer();
  if ('response' in ctx) return ctx.response;
  const { customer, supabaseAdmin } = ctx;
  const { id } = await params;

  const { data: lead, error } = await supabaseAdmin
    .from('service_leads')
    .select('*')
    .eq('id', id)
    .eq('customer_phone', customer.phone)
    .maybeSingle();
  if (error || !lead) return NextResponse.json({ error: 'Order not found' }, { status: 404 });

  const pbConfig = await getPostBookingMembershipConfig(supabaseAdmin);
  await expireUnpaidBookingMembershipBundleIfNeeded(supabaseAdmin, lead as Record<string, unknown>, pbConfig);

  const parseIdList = (input: unknown): string[] => {
    if (!input) return [];
    if (Array.isArray(input)) return input.map((v) => String(v || '').trim()).filter(Boolean);
    const raw = String(input || '').trim();
    if (!raw) return [];
    try {
      if (raw.startsWith('[') && raw.endsWith(']')) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) return parsed.map((v) => String(v || '').trim()).filter(Boolean);
      }
    } catch {
      // ignore
    }
    return raw.split(',').map((v) => v.trim()).filter(Boolean);
  };

  const serviceTypeIds = parseIdList((lead as any).service_type_ids);
  const addonIds = parseIdList((lead as any).subservice_ids);

  const serviceNameById: Record<string, string> = {};
  if (serviceTypeIds.length > 0) {
    const { data: serviceTypes } = await supabaseAdmin
      .from('service_types')
      .select('id, name')
      .in('id', serviceTypeIds);
    for (const row of serviceTypes || []) {
      serviceNameById[String((row as any).id)] = String((row as any).name || '');
    }
  }

  const addonNameById: Record<string, string> = {};
  if (addonIds.length > 0) {
    const { data: addons } = await supabaseAdmin
      .from('service_addons')
      .select('id, name')
      .in('id', addonIds);
    for (const row of addons || []) {
      addonNameById[String((row as any).id)] = String((row as any).name || '');
    }
  }

  const resolvedServiceNames = serviceTypeIds.map((x) => serviceNameById[x]).filter(Boolean);
  const resolvedAddonNames = addonIds.map((x) => addonNameById[x]).filter(Boolean);
  const resolvedServiceType =
    resolvedServiceNames.join(', ') ||
    String((lead as any).service_type || '').trim() ||
    String((lead as any).description || '').trim() ||
    'Service';

  let workshopName = '';
  const workshopId = String((lead as any).workshop_id || '').trim();
  if (workshopId) {
    const { data: workshop } = await supabaseAdmin
      .from('workshops')
      .select('name, workshop_name')
      .eq('id', workshopId)
      .maybeSingle();
    workshopName = String((workshop as any)?.workshop_name || (workshop as any)?.name || '');
  }

  const leadMeta =
    (lead as any).meta && typeof (lead as any).meta === 'object'
      ? ((lead as any).meta as Record<string, unknown>)
      : {};
  const walletDeduction = Number(leadMeta.wallet_deduction || 0);
  const preferredSlotStart = String((lead as any).preferred_slot_start || '').trim();
  const preferredTimeSlot = String((lead as any).preferred_time_slot || '').trim();
  const preferredDate = String((lead as any).preferred_date || '').trim();
  const appointmentAt =
    preferredSlotStart ||
    (preferredDate && preferredTimeSlot ? `${preferredDate}T${preferredTimeSlot}` : preferredDate || null);
  const displayAddress =
    String((lead as any).pickup_address || '').trim() ||
    String((lead as any).customer_address || '').trim() ||
    String((lead as any).address || '').trim() ||
    '';
  const pickupRequired = (lead as any).pickup_required;
  const serviceMode =
    pickupRequired === true ? 'Doorstep Pickup' : pickupRequired === false ? 'Workshop Visit' : 'Not specified';
  const couponCode = String((lead as any).coupon_code || '').trim() || null;
  const membershipBundleDiscount = resolveActiveMembershipBundleDiscount(
    lead as Record<string, unknown>,
    pbConfig,
  );
  const couponDiscount = resolveServiceLeadCouponDiscount(lead as Record<string, unknown>, pbConfig);

  const { data: invoice } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, payment_status, final_amount, invoice_type, status, line_items, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: allInvoices } = await supabaseAdmin
    .from('invoices')
    .select('id, invoice_number, payment_status, final_amount, invoice_type, status, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(10);

  const { data: checklist } = await supabaseAdmin
    .from('service_checklists')
    .select('id, checklist_items, total_items, completed_items, completion_percentage, all_mandatory_completed, started_at, completed_at, updated_at')
    .eq('lead_id', id)
    .order('updated_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: leadMedia } = await supabaseAdmin
    .from('lead_media')
    .select('*')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: mechanicPhotos } = await supabaseAdmin
    .from('mechanic_job_photos')
    .select('id, photo_url, photo_type, photo_category, notes, timestamp, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(200);

  const { data: activities } = await supabaseAdmin
    .from('lead_activities')
    .select('id, activity_type, description, metadata, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(30);

  const { data: extraCharges } = await supabaseAdmin
    .from('lead_extra_charges')
    .select('id, description, amount, status, reason, image_url, created_at')
    .eq('lead_id', id)
    .order('created_at', { ascending: false })
    .limit(30);

  const mappedLeadMedia = (leadMedia || []).map((m: any) => ({
    id: m.id,
    url: m.file_url || m.photo_url || '',
    type: String(m.photo_type || m.category || m.media_type || 'OTHER').toUpperCase(),
    note: m.description || null,
    created_at: m.created_at || null,
    source: 'lead_media',
  })).filter((m: any) => !!m.url);

  const mappedMechanicMedia = (mechanicPhotos || []).map((m: any) => ({
    id: m.id,
    url: m.photo_url || '',
    type: String(m.photo_type || m.photo_category || 'OTHER').toUpperCase(),
    note: m.notes || null,
    created_at: m.created_at || m.timestamp || null,
    source: 'mechanic_job_photos',
  })).filter((m: any) => !!m.url);

  const allMedia = [...mappedLeadMedia, ...mappedMechanicMedia]
    .sort((a: any, b: any) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())
    .slice(0, 200);

  const order = {
    ...lead,
    service_display: resolvedServiceType,
    services: resolvedServiceNames,
    addons: resolvedAddonNames,
    workshop_name: workshopName,
    appointment_at: appointmentAt,
    display_address: displayAddress,
    service_mode: serviceMode,
    wallet_deduction: walletDeduction,
    coupon_code: couponCode,
    coupon_discount: couponDiscount,
    membership_bundle_discount: membershipBundleDiscount,
  };

  return NextResponse.json({
    order: {
      ...order,
      amount_display: resolveLeadAmountDisplay(lead as Record<string, unknown>, pbConfig),
      post_booking_membership: resolvePostBookingMembershipOfferStatus(lead as Record<string, unknown>, pbConfig),
    },
    post_booking_membership: resolvePostBookingMembershipOfferStatus(lead as Record<string, unknown>, pbConfig),
    invoice: invoice || null,
    invoices: allInvoices || [],
    checklist: checklist || null,
    media: allMedia,
    activities: activities || [],
    extra_charges: extraCharges || [],
  });
}

