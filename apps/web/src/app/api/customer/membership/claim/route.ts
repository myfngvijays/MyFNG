import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';
import {
  createAutoMembershipClaimBooking,
  getMembershipBenefitsStatus,
} from '@/lib/membership-benefits-service';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const ctx = await requireCustomer();
    if ('response' in ctx) return ctx.response;
    const { customer, supabaseAdmin } = ctx;

    const body = await request.json().catch(() => ({}));
    const benefitCode = String(body.benefit_code || body.benefitCode || '').trim();
    const vehicleHint = {
      vehicle_number: body.vehicle_number || body.vehicleNumber || null,
      make: body.vehicle_make || body.make || null,
      model: body.vehicle_model || body.model || null,
      vehicle_label: body.vehicle_label || body.vehicleLabel || null,
    };

    if (!benefitCode) {
      return NextResponse.json({ error: 'benefit_code is required' }, { status: 400 });
    }

    const result = await createAutoMembershipClaimBooking(
      supabaseAdmin,
      customer,
      benefitCode,
      vehicleHint,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    try {
      await logCustomerEvent(supabaseAdmin, customer.id, 'membership_benefit_claimed', 'membership', {
        benefitCode: result.claim.benefit_code,
        leadId: result.lead.id,
        leadNumber: result.lead.lead_number,
        vehicleNumber: result.claim.vehicle_number,
      });
    } catch (eventErr: unknown) {
      const message = eventErr instanceof Error ? eventErr.message : String(eventErr);
      console.error('[membership-claim] analytics event failed:', message);
    }

    const status = await getMembershipBenefitsStatus(supabaseAdmin, customer.id, customer.phone);

    return NextResponse.json({
      success: true,
      lead: result.lead,
      claim: result.claim,
      benefits: status.benefits,
      history: status.history,
      claims_unlocked: status.claims_unlocked,
      claims_unlock_message: status.claims_unlock_message,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to claim this benefit.';
    console.error('[membership-claim] unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
