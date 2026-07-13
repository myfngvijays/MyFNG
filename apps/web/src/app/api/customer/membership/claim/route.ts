import { NextRequest, NextResponse } from 'next/server';
import { logCustomerEvent, requireCustomer } from '@/lib/customer-api';
import { getMembershipBenefitsStatus } from '@/lib/membership-benefits-service';
import { submitMembershipClaimForApproval } from '@/lib/membership-claim-approval';

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

    const result = await submitMembershipClaimForApproval(
      supabaseAdmin,
      customer,
      benefitCode,
      vehicleHint,
    );

    if (!result.success) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    try {
      await logCustomerEvent(supabaseAdmin, customer.id, 'membership_benefit_claim_submitted', 'membership', {
        benefitCode: result.request.benefit_code,
        requestId: result.request.id,
        vehicleNumber: result.request.vehicle_number,
      });
    } catch (eventErr: unknown) {
      const message = eventErr instanceof Error ? eventErr.message : String(eventErr);
      console.error('[membership-claim] analytics event failed:', message);
    }

    const status = await getMembershipBenefitsStatus(supabaseAdmin, customer.id, customer.phone);

    return NextResponse.json({
      success: true,
      pending: true,
      message: result.message,
      request: result.request,
      benefits: status.benefits,
      history: status.history,
      pending_requests: status.pending_requests,
      claims_unlocked: status.claims_unlocked,
      claims_unlock_message: status.claims_unlock_message,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unable to submit this benefit request.';
    console.error('[membership-claim] unhandled error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
