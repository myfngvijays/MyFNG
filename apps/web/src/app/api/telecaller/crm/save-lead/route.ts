import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { toServiceLeadType } from '@/lib/customer-service-leads';
import { parseServiceIdList } from '@/lib/telecaller/crmQuote';

export const dynamic = 'force-dynamic';

const ALLOWED_LEAD_STATUS = new Set([
  'NEW',
  'ASSIGNED',
  'IN_PROGRESS',
  'VALIDATED',
  'REJECTED',
  'CONVERTED',
  'CLOSED',
  'COMPLETED',
]);

/**
 * POST /api/telecaller/crm/save-lead
 * Soft-save a lead with basic details (no full booking). is_incomplete = true.
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClientFromRequest(request);
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const profile = await resolveUserProfile(supabase, user);
    const roleCode = String((profile as any)?.roles?.role_code || '');
    if (roleCode !== 'TELECALLER' && roleCode !== 'SUPER_ADMIN' && roleCode !== 'LEAD_MANAGER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const customerName = String(body?.customer_name || '').trim();
    const phoneRaw = String(body?.customer_phone || '').replace(/\D/g, '');
    const customerPhone = phoneRaw.slice(-10);
    if (!customerName || customerPhone.length !== 10) {
      return NextResponse.json(
        { error: 'Customer name and valid 10-digit phone required' },
        { status: 400 },
      );
    }

    const serviceTypeIds = parseServiceIdList(body?.service_type_ids);
    const bookingType = String(body?.booking_type || 'CAR_SERVICE').toUpperCase();
    const leadType = toServiceLeadType(
      String(body?.lead_type || (bookingType === 'RSA' ? 'RSA' : 'NORMAL')),
    );
    let pricingCategories = Array.isArray(body?.pricing_categories)
      ? body.pricing_categories.map((c: any) => String(c || '').trim()).filter(Boolean)
      : [];
    if (!pricingCategories.length && bookingType === 'PERIODIC') {
      pricingCategories = ['Car Periodic Service'];
    }

    const leadNumber = `L-${Date.now().toString().slice(-8)}${Math.floor(Math.random() * 90 + 10)}`;
    const now = new Date().toISOString();
    const interest =
      String(body?.package_label || body?.service_type || '').trim() ||
      (bookingType === 'PERIODIC'
        ? 'Periodic Service'
        : bookingType === 'OTHER_SERVICES'
          ? 'Other Services'
          : bookingType === 'RSA'
            ? 'RSA'
            : bookingType === 'MEMBERSHIP'
              ? 'Membership'
              : 'Enquiry');

    const vehicleNumber =
      String(body?.vehicle_number || '')
        .trim()
        .toUpperCase()
        .slice(0, 20) || 'PENDING';

    const statusRaw = String(body?.status || 'NEW').toUpperCase();
    const status = ALLOWED_LEAD_STATUS.has(statusRaw) ? statusRaw : 'NEW';
    const callStatus = String(body?.call_status || 'ANSWERED').toUpperCase() || 'ANSWERED';
    const outcome = body?.outcome != null ? String(body.outcome) : 'INFO_COLLECTED';
    const callResult = String(body?.call_result || '').trim() || null;
    const callLabel = String(body?.call_label || '').trim() || null;
    const lostReason = String(body?.lost_reason || '').trim() || null;
    const callNotes =
      String(body?.call_notes || body?.problem_description || '').trim() || null;

    // activity_at = when the call/conversation happened (all statuses incl. Lost)
    // next_follow_up_at = optional future callback only (do NOT treat activity as follow-up)
    const parseIso = (raw: unknown): string | null => {
      if (!raw) return null;
      const d = new Date(String(raw));
      return Number.isNaN(d.getTime()) ? null : d.toISOString();
    };
    const activityAt = parseIso(body?.activity_at) || now;
    const nextFollowUpAt = parseIso(body?.next_follow_up_at);

    const { supabaseAdmin } = getSupabaseAdmin();
    const db = (supabaseAdmin ?? supabase) as any;

    const insert: Record<string, unknown> = {
      lead_number: leadNumber,
      lead_type: leadType,
      lead_source: String(body?.lead_source || 'TELECALLER').trim() || 'TELECALLER',
      customer_name: customerName,
      customer_phone: customerPhone,
      customer_alternate_phone: body?.customer_alternate_phone || null,
      customer_email: body?.customer_email || null,
      customer_address: body?.customer_address || null,
      city_id: body?.city_id || null,
      city: body?.city || null,
      pincode: body?.pincode ? String(body.pincode).replace(/\D/g, '').slice(0, 6) : null,
      vehicle_number: vehicleNumber,
      vehicle_make: body?.vehicle_make || null,
      model_id: body?.model_id || null,
      vehicle_model: body?.vehicle_model || null,
      vehicle_fuel_type: body?.vehicle_fuel_type || null,
      service_type_ids: serviceTypeIds.length ? JSON.stringify(serviceTypeIds) : null,
      service_type: interest,
      problem_description: callNotes,
      description: callNotes
        ? `Telecaller lead · ${callLabel || interest} · ${callNotes}`
        : `Telecaller lead (basic) · ${interest}`,
      status,
      lead_priority: body?.lead_priority || 'NORMAL',
      created_from: 'TELECALLER_CRM',
      created_by_id: profile?.id || null,
      assigned_telecaller_id: profile?.id || null,
      assigned_at: now,
      is_incomplete: true,
      last_call_at: activityAt,
      total_calls: 1,
      ...(nextFollowUpAt
        ? { follow_up_required: true, next_follow_up_at: nextFollowUpAt }
        : { follow_up_required: false, next_follow_up_at: null }),
      coupon_meta: {
        ...(typeof body?.coupon_meta === 'object' && body.coupon_meta ? body.coupon_meta : {}),
        booking_type: bookingType,
        saved_as: 'LEAD',
        vehicle_class: body?.vehicle_class || null,
        interest_label: interest,
        last_call_status: callStatus,
        last_call_result: callResult,
        last_call_label: callLabel,
        last_lost_reason: callResult === 'LOST' ? lostReason : null,
        last_call_at: activityAt,
        profile_history: [
          {
            at: activityAt,
            summary: callLabel || 'Lead created',
            remark: callNotes,
            status: callResult,
            event: 'CREATED',
            lost_reason: callResult === 'LOST' ? lostReason : null,
          },
        ],
        ...(pricingCategories.length ? { pricing_categories: pricingCategories } : {}),
      },
      created_at: now,
      updated_at: now,
    };

    const { data: lead, error } = await db
      .from('service_leads')
      .insert([insert])
      .select('id, lead_number, status, customer_name, customer_phone, is_incomplete')
      .single();

    if (error || !lead) {
      if (error && /is_incomplete/i.test(error.message || '')) {
        delete insert.is_incomplete;
        const retry = await db
          .from('service_leads')
          .insert([insert])
          .select('id, lead_number, status, customer_name, customer_phone')
          .single();
        if (retry.error || !retry.data) {
          return NextResponse.json(
            { error: retry.error?.message || error.message || 'Failed to save lead' },
            { status: 400 },
          );
        }
        return NextResponse.json({
          success: true,
          lead: retry.data,
          message: 'Lead saved (incomplete flag skipped on schema).',
        });
      }
      return NextResponse.json({ error: error?.message || 'Failed to save lead' }, { status: 400 });
    }

    try {
      await db.from('telecaller_call_logs').insert([
        {
          lead_id: lead.id,
          telecaller_id: profile?.id,
          call_type: 'OUTBOUND',
          call_status: callStatus,
          outcome: outcome || null,
          notes: callNotes || callLabel || 'Advanced CRM — saved as lead',
          phone_number: customerPhone,
          created_at: activityAt,
        },
      ]);
    } catch {
      /* optional */
    }

    // Only when client explicitly sends next_follow_up_at (Add Lead does not)
    if (nextFollowUpAt) {
      try {
        await db.from('telecaller_follow_ups').insert([
          {
            lead_id: lead.id,
            telecaller_id: profile?.id,
            follow_up_type: 'CALLBACK',
            scheduled_time: nextFollowUpAt,
            reason: callNotes || callLabel || 'Follow-up',
            priority: 'NORMAL',
            status: 'PENDING',
          },
        ]);
      } catch {
        /* optional */
      }
    }

    try {
      await db.from('lead_events').insert([
        {
          lead_id: lead.id,
          event_type: 'CREATED',
          event_data: {
            source: 'TELECALLER_CRM',
            saved_as: 'LEAD',
            booking_type: bookingType,
            call_result: callResult,
            call_label: callLabel,
            activity_at: activityAt,
          },
          created_by_id: profile?.id,
          created_at: activityAt,
        },
      ]);
    } catch {
      /* optional */
    }

    return NextResponse.json({
      success: true,
      lead,
      message: 'Lead saved. You can complete booking later from Lead Details.',
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
