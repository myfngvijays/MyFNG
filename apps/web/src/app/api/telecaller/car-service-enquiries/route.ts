import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const POST_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const BEARER_TOKEN = '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';
const LEADTAG = process.env.CAR_SERVICE_ENQUIRY_LEADTAG || 'DL-Service';
const SOURCE_NOTE = 'Lead Source: delhi_service';

function normalizePhone(input: string) {
  const digits = String(input || '').replace(/\D/g, '');
  if (!digits) return { raw: '', normalized: '' };
  if (digits.length === 10) return { raw: input, normalized: `91${digits}` };
  return { raw: input, normalized: digits };
}

async function assertTelecaller(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();
  if (authError || !user) return { ok: false, status: 401, error: 'Unauthorized', supabase, profile: null };

  const profile = await resolveUserProfile(supabase as any, user as any);
  const roleCode = (profile?.roles as any)?.role_code || null;
  if (roleCode !== 'TELECALLER') return { ok: false, status: 403, error: 'Forbidden', supabase, profile: null };

  return { ok: true, status: 200, error: null, supabase, profile };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await assertTelecaller(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { searchParams } = new URL(request.url);
    const limit = Math.min(Math.max(parseInt(searchParams.get('limit') || '50', 10) || 50, 1), 200);

    const { data, error } = await auth.supabase
      .from('car_service_enquiries')
      .select(
        'id, created_at, customer_name, customer_phone_raw, customer_phone_norm, car_model, remark, leadtag, source_note, external_status, external_error'
      )
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      return NextResponse.json({ error: 'Failed to load enquiries', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, enquiries: data || [] });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await assertTelecaller(request);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    if (!POST_URL || !BEARER_TOKEN) {
      return NextResponse.json({ error: 'Car service API not configured' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const customer_name = String(body?.customer_name || '').trim();
    const phone_input = String(body?.customer_phone || '').trim();
    const car_model = String(body?.car_model || '').trim();
    const remark = String(body?.remark || '').trim();

    if (!customer_name || !phone_input) {
      return NextResponse.json({ error: 'Name and phone are required' }, { status: 400 });
    }

    const phone = normalizePhone(phone_input);
    if (!phone.normalized) {
      return NextResponse.json({ error: 'Invalid phone number' }, { status: 400 });
    }

    const payload = {
      fields: {
        Name: customer_name,
        Phone: phone.normalized,
        LEADTAG: LEADTAG,
        carModel: car_model,
        REMARK: remark,
      },
      actions: [
        {
          type: 'SYSTEM_NOTE',
          text: SOURCE_NOTE,
        },
      ],
    };

    let externalStatus: number | null = null;
    let externalResponse: any = null;
    let externalError: string | null = null;

    try {
      const res = await fetch(POST_URL, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${BEARER_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      });
      externalStatus = res.status;
      const text = await res.text();
      try {
        externalResponse = text ? JSON.parse(text) : null;
      } catch {
        externalResponse = text || null;
      }
      if (!res.ok) {
        externalError = typeof externalResponse === 'string' ? externalResponse : 'External API error';
      }
    } catch (e: any) {
      externalError = e?.message || 'External API error';
    }

    const { data: saved, error: saveError } = await (auth.supabase as any)
      .from('car_service_enquiries')
      .insert({
        customer_name,
        customer_phone_raw: phone.raw,
        customer_phone_norm: phone.normalized,
        car_model: car_model || null,
        remark: remark || null,
        leadtag: LEADTAG,
        source_note: SOURCE_NOTE,
        external_status: externalStatus,
        external_response: externalResponse,
        external_error: externalError,
        external_request: payload,
      })
      .select(
        'id, created_at, customer_name, customer_phone_raw, customer_phone_norm, car_model, remark, leadtag, source_note, external_status, external_error'
      )
      .single();

    if (saveError) {
      return NextResponse.json({ error: 'Failed to save enquiry', details: saveError.message }, { status: 500 });
    }

    const ok = externalError ? false : true;
    return NextResponse.json(
      {
        success: ok,
        enquiry: saved,
        external_status: externalStatus,
        external_error: externalError,
      },
      { status: ok ? 200 : 502 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
