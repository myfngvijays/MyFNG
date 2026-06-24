import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { pushCarLoanLeadToISanction } from '@/lib/isanction-car-loan';

export const dynamic = 'force-dynamic';

const TELECRM_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const TELECRM_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

async function pushToTeleCRM(phone: string, data: {
  panId: string;
  vehicleRegistrationNumber: string;
  income: number;
  occupation: string;
}) {
  const payload = {
    fields: {
      Phone: `+91${phone}`,
      LEADTAG: 'CAR_LOAN_WEBSITE',
      LeadSource: 'Website Car Loan',
      LeadStatus: 'NEW',
      CreatedFrom: 'WEB',
      CreatedAt: new Date().toISOString(),
      PAN: data.panId,
      VehicleNumber: data.vehicleRegistrationNumber,
      MonthlyIncome: String(data.income),
      Occupation: data.occupation,
    },
    actions: [
      {
        type: 'SYSTEM_NOTE',
        text: 'Lead Source: CAR_LOAN_WEBSITE',
      },
    ],
  };

  const res = await fetch(TELECRM_AUTOUPDATE_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TELECRM_BEARER}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`TeleCRM push failed: ${res.status} ${body}`.trim());
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));

    const { pan, mobile, vehicle, income, occupation } = body;

    if (!pan || !mobile || !vehicle || !income || !occupation) {
      return NextResponse.json(
        { success: false, error: 'All fields are required' },
        { status: 400 },
      );
    }

    const phone = String(mobile).replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number' },
        { status: 400 },
      );
    }

    const leadData = {
      mobileNo: phone,
      panId: String(pan).toUpperCase(),
      vehicleRegistrationNumber: String(vehicle).toUpperCase(),
      income: Number(income),
      occupation: String(occupation),
    };

    const { supabaseAdmin } = getSupabaseAdmin();
    let dbLeadId: string | null = null;
    if (supabaseAdmin) {
      const { data: dbLead, error: dbError } = await supabaseAdmin
        .from('car_loan_leads')
        .insert({
          pan: leadData.panId,
          mobile: phone,
          vehicle_number: leadData.vehicleRegistrationNumber,
          monthly_income: leadData.income,
          occupation: leadData.occupation,
          status: 'NEW',
          isanction_synced: false,
        })
        .select('id')
        .single();

      if (dbError) {
        console.error('[car-loan] DB insert failed (non-blocking):', dbError);
      } else {
        dbLeadId = dbLead?.id || null;
      }
    }

    const [iSanctionResult, telecrmResult] = await Promise.allSettled([
      pushCarLoanLeadToISanction(leadData, { maxAttempts: 3 }),
      pushToTeleCRM(phone, leadData),
    ]);

    const iSanctionOk =
      iSanctionResult.status === 'fulfilled' && iSanctionResult.value.ok === true;
    const iSanctionError =
      iSanctionResult.status === 'fulfilled'
        ? iSanctionResult.value.ok
          ? null
          : iSanctionResult.value.message
        : iSanctionResult.reason?.message || 'Failed to reach iSanction partner API';

    if (telecrmResult.status === 'rejected') {
      console.error('[car-loan] TeleCRM sync failed (non-blocking):', telecrmResult.reason);
    }

    if (supabaseAdmin && dbLeadId) {
      supabaseAdmin
        .from('car_loan_leads')
        .update({
          status: iSanctionOk ? 'SUBMITTED' : 'API_FAILED',
          isanction_synced: iSanctionOk,
          isanction_response: iSanctionOk
            ? (iSanctionResult as PromiseFulfilledResult<{ ok: true; body: Record<string, unknown> }>).value.body
            : {
                error: iSanctionError,
                status:
                  iSanctionResult.status === 'fulfilled' && !iSanctionResult.value.ok
                    ? iSanctionResult.value.status
                    : null,
              },
          updated_at: new Date().toISOString(),
        })
        .eq('id', dbLeadId)
        .then(({ error }) => {
          if (error) console.error('[car-loan] DB status update failed:', error);
        });
    }

    if (!iSanctionOk) {
      console.error('[car-loan] iSanction failed:', iSanctionError);
    }

    // Lead is already in MyFNG CRM/TeleCRM — do not block the customer when partner API is down.
    return NextResponse.json({
      success: true,
      message: iSanctionOk
        ? 'Lead created successfully'
        : 'Application received. Partner sync is pending and will retry automatically.',
      isanction_synced: iSanctionOk,
      partner_sync_pending: !iSanctionOk,
      partner_error: iSanctionOk ? null : iSanctionError,
    });
  } catch (err: any) {
    console.error('[car-loan] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error. Please try again.' },
      { status: 500 },
    );
  }
}
