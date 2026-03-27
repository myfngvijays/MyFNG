import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const TELECRM_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const TELECRM_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

function normalizePhone(input: string | null | undefined) {
  const digits = String(input || '').replace(/\D/g, '').slice(-10);
  return digits.length === 10 ? `+91${digits}` : '';
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;
    const leadId = String(id || '').trim();
    if (!leadId) return NextResponse.json({ error: 'Missing lead id' }, { status: 400 });

    const supabase = await createClientFromRequest(request);
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const body = await request.json().catch(() => ({}));
    const leadTag = String((body as any)?.lead_tag || '').trim();
    if (!leadTag) return NextResponse.json({ error: 'lead_tag is required' }, { status: 400 });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const { data: lead, error: leadErr } = await (supabaseAdmin as any)
      .from('rsa_leads')
      .select(
        'id, service_type, vehicle_number, customer_name, contact_number, alternate_number, lead_registered_at, pincode, customer_quoted_amount'
      )
      .eq('id', leadId)
      .single();

    if (leadErr || !lead) {
      return NextResponse.json({ error: 'Lead not found' }, { status: 404 });
    }

    let district: string | null = null;
    let state: string | null = null;
    const pincode = String(lead.pincode || '').trim();

    if (pincode && pincode.length === 6) {
      const { data: pincodeRow } = await (supabaseAdmin as any)
        .from('pincode_city_state')
        .select('district, state')
        .eq('pincode', pincode)
        .limit(1)
        .maybeSingle();

      if (pincodeRow) {
        district = pincodeRow.district || null;
        state = pincodeRow.state || null;
      }
    }

    const phone = normalizePhone(lead.contact_number);
    if (!phone) {
      return NextResponse.json({ error: 'Lead has no valid contact number' }, { status: 400 });
    }

    const payload = {
      fields: {
        Name: lead.customer_name || 'RSA Lead',
        Phone: phone,
        LEADTAG: leadTag,
        ServiceType: lead.service_type || null,
        VehicleNumber: lead.vehicle_number || null,
        AlternateNumber: normalizePhone(lead.alternate_number) || null,
        RegisterDateTime: lead.lead_registered_at || null,
        Pincode: pincode || null,
        District: district,
        State: state,
        CustomerQuotedAmount: lead.customer_quoted_amount ?? null,
        CreatedFrom: 'RSA',
        CreatedAt: new Date().toISOString(),
      },
      actions: [
        {
          type: 'SYSTEM_NOTE',
          text: `RSA Lead — Tag: ${leadTag}, Service: ${lead.service_type || 'N/A'}, Vehicle: ${lead.vehicle_number || 'N/A'}`,
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
      const text = await res.text().catch(() => '');
      console.error('[telecrm-push] TeleCRM push failed:', res.status, text);
      return NextResponse.json(
        { error: 'TeleCRM push failed', status: res.status, details: text },
        { status: 502 }
      );
    }

    return NextResponse.json({ success: true, lead_tag: leadTag });
  } catch (e: any) {
    console.error('[telecrm-push] Internal error:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
