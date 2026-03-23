import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';

const ISANCTION_URL = 'https://backend2.isanction.in/api/web/leads/partners';
const ISANCTION_API_KEY = '1flSSHcw$z7v77/F6qHdHbDrRByPqcbudRBqR@JZFTw=';

const TELECRM_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const TELECRM_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

async function pushToISanction(data: {
  mobileNo: string;
  panId: string;
  vehicleRegistrationNumber: string;
  income: number;
  occupation: string;
}) {
  const res = await fetch(ISANCTION_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'api-key': ISANCTION_API_KEY,
    },
    body: JSON.stringify({
      mobileNo: data.mobileNo,
      type: 'CAR_LOAN',
      vehicleRegistrationNumber: data.vehicleRegistrationNumber,
      panId: data.panId,
      income: data.income,
      occupation: data.occupation,
    }),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok || !body.success) {
    throw new Error(body.message || `iSanction API failed: ${res.status}`);
  }
  return body;
}

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
        text: `Car Loan lead from website. PAN: ${data.panId}, Vehicle: ${data.vehicleRegistrationNumber}, Income: ₹${data.income}/month, Occupation: ${data.occupation}`,
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
        { status: 400 }
      );
    }

    const phone = String(mobile).replace(/\D/g, '').slice(-10);
    if (phone.length !== 10) {
      return NextResponse.json(
        { success: false, error: 'Invalid mobile number' },
        { status: 400 }
      );
    }

    const leadData = {
      mobileNo: phone,
      panId: String(pan).toUpperCase(),
      vehicleRegistrationNumber: String(vehicle).toUpperCase(),
      income: Number(income),
      occupation: String(occupation),
    };

    // Store in database
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
        })
        .select('id')
        .single();

      if (dbError) {
        console.error('[car-loan] DB insert failed (non-blocking):', dbError);
      } else {
        dbLeadId = dbLead?.id || null;
      }
    }

    const [iSanctionResult] = await Promise.allSettled([
      pushToISanction(leadData),
      pushToTeleCRM(phone, leadData).catch((err) => {
        console.error('[car-loan] TeleCRM sync failed (non-blocking):', err);
      }),
    ]);

    // Update DB status based on iSanction result
    if (supabaseAdmin && dbLeadId) {
      const isSuccess = iSanctionResult.status === 'fulfilled';
      supabaseAdmin
        .from('car_loan_leads')
        .update({
          status: isSuccess ? 'SUBMITTED' : 'API_FAILED',
          isanction_synced: isSuccess,
          isanction_response: isSuccess
            ? (iSanctionResult as PromiseFulfilledResult<any>).value
            : { error: (iSanctionResult as PromiseRejectedResult).reason?.message },
        })
        .eq('id', dbLeadId)
        .then(({ error }) => {
          if (error) console.error('[car-loan] DB status update failed:', error);
        });
    }

    if (iSanctionResult.status === 'rejected') {
      console.error('[car-loan] iSanction failed:', iSanctionResult.reason);
      return NextResponse.json(
        { success: false, error: iSanctionResult.reason?.message || 'Failed to check eligibility' },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, message: 'Lead created successfully' });
  } catch (err: any) {
    console.error('[car-loan] Unexpected error:', err);
    return NextResponse.json(
      { success: false, error: 'Server error. Please try again.' },
      { status: 500 }
    );
  }
}
