import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const TELECRM_AUTOUPDATE_URL =
  'https://022os10kr2.execute-api.ap-south-1.amazonaws.com/enterprise/66f6bc6faf29b5a6f29c9bbf/autoupdatelead';
const TELECRM_BEARER =
  '398fc0c7-ee90-4992-b214-4063f9f7ad031727771960659:e9580bb4-cb6f-47ff-81fb-847e5a98a5a2';

const HOURS_DELAY = 12;
const BATCH_SIZE = 50;

function assertCronAuth(req: NextRequest): string | null {
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!secret) return 'CRON secret is not configured on server';

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) return 'Unauthorized';
  return null;
}

export async function GET(request: NextRequest) {
  const authError = assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
  }
  const db = supabaseAdmin as any;

  const cutoff = new Date(Date.now() - HOURS_DELAY * 60 * 60 * 1000).toISOString();

  const { data: rows, error: fetchErr } = await db
    .from('telecrm_api')
    .select('id, name, mobile, city, pincode, state, disposition, disposition_category, disposition_note, service_type, vehicle_number, vehicle_model, customer_quoted_amount, location_link, recording_url')
    .is('api_response', null)
    .lt('updated_at', cutoff)
    .order('updated_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ success: true, processed: 0, message: 'No pending rows' });
  }

  const results: { id: string; status: 'ok' | 'error'; error?: string }[] = [];

  for (const row of rows) {
    try {
      const phone10 = String(row.mobile || '').replace(/\D/g, '').slice(-10);
      if (!phone10) {
        results.push({ id: row.id, status: 'error', error: 'No mobile number' });
        continue;
      }

      const payload = {
        fields: {
          Name: row.name || 'RSA Call Lead',
          Phone: `+91${phone10}`,
          LEADTAG: 'RSA_CALL',
          LeadSource: 'Sarv Call',
          City: row.city || null,
          State: row.state || null,
          Pincode: row.pincode || null,
          ServiceType: row.service_type || null,
          VehicleNumber: row.vehicle_number || null,
          VehicleModel: row.vehicle_model || null,
          Disposition: row.disposition || null,
          DispositionCategory: row.disposition_category || null,
          CustomerQuotedAmount: row.customer_quoted_amount ?? null,
          LocationLink: row.location_link || null,
          RecordingUrl: row.recording_url || null,
        },
        actions: [
          {
            type: 'SYSTEM_NOTE',
            text: 'Lead Source: RSA_CALL',
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

      const responseBody = await res.text().catch(() => '');
      let parsedResponse: any;
      try {
        parsedResponse = JSON.parse(responseBody);
      } catch {
        parsedResponse = { raw: responseBody, status: res.status };
      }

      const now = new Date().toISOString();
      await db
        .from('telecrm_api')
        .update({
          api_response: parsedResponse,
          api_datetime: now,
          updated_at: now,
        })
        .eq('id', row.id);

      if (!res.ok) {
        results.push({ id: row.id, status: 'error', error: `TeleCRM ${res.status}` });
      } else {
        results.push({ id: row.id, status: 'ok' });
      }
    } catch (err: any) {
      console.error(`[telecrm-push cron] row ${row.id} failed:`, err?.message || err);
      results.push({ id: row.id, status: 'error', error: err?.message || 'Unknown error' });
    }
  }

  const okCount = results.filter((r) => r.status === 'ok').length;
  return NextResponse.json({ success: true, processed: results.length, ok: okCount, results });
}
