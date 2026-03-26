import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const TELECRM_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const TELECRM_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

async function pushToTeleCRM(data: Record<string, any>) {
  const phone = String(data.phone_no || '').replace(/\D/g, '').slice(-10);
  if (!phone) return;

  const payload = {
    fields: {
      Name: data.name || 'CRM Lead',
      Phone: `+91${phone}`,
      LEADTAG: 'DELHILEAD',
      LeadSource: 'CRM Enquiry',
      LeadStatus: 'NEW',
      CreatedFrom: 'CRM',
      CreatedAt: new Date().toISOString(),
      VehicleNumber: data.car_number || null,
      VehicleMake: data.make || null,
      VehicleModel: data.model || null,
      Address: data.address || null,
      RegistrationDate: data.regdate || null,
      Disposition: data.disposition || null,
      DialerID: data.dialer_id || null,
      Remark: data.remark || null,
    },
    actions: [
      {
        type: 'SYSTEM_NOTE',
        text: `CRM Enquiry — Disposition: ${data.disposition || 'N/A'}, Dialer: ${data.dialer_id || 'N/A'}, Vehicle: ${data.car_number || 'N/A'} ${data.make || ''} ${data.model || ''}`.trim(),
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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');

    if (!phone || !/^\d{10}$/.test(phone)) {
      return NextResponse.json({ error: 'Valid 10-digit phone number is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const { data, error } = await supabase
      .from('crm_enquiries')
      .select('*')
      .eq('phone_no', phone)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch enquiry', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, data: data || null });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { phone_no, name, address, regdate, car_number, make, model, disposition, remark, dialer_id } = body;

    if (!phone_no || !/^\d{10}$/.test(phone_no)) {
      return NextResponse.json({ error: 'Valid 10-digit phone number is required' }, { status: 400 });
    }

    const supabase = await createClient();

    const insertData = {
      phone_no,
      name: name || null,
      address: address || null,
      regdate: regdate || null,
      car_number: car_number || null,
      make: make || null,
      model: model || null,
      disposition: disposition || null,
      remark: remark || null,
      dialer_id: dialer_id || null,
    };

    const { data, error } = await (supabase as any)
      .from('crm_enquiries')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to save enquiry', details: error.message }, { status: 500 });
    }

    // Push to TeleCRM (non-blocking)
    let teleCrmStatus = 'skipped';
    try {
      await pushToTeleCRM(insertData);
      teleCrmStatus = 'success';
    } catch (err: any) {
      console.error('[CRM] TeleCRM push failed:', err.message);
      teleCrmStatus = 'failed';
    }

    return NextResponse.json({ success: true, data, telecrm: teleCrmStatus }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
