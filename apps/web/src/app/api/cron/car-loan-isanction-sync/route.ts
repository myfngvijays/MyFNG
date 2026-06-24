import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { pushCarLoanLeadToISanction } from '@/lib/isanction-car-loan';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 25;

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

  const { data: rows, error: fetchErr } = await supabaseAdmin
    .from('car_loan_leads')
    .select('id, pan, mobile, vehicle_number, monthly_income, occupation, status, isanction_synced')
    .eq('isanction_synced', false)
    .in('status', ['NEW', 'API_FAILED'])
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  if (!rows?.length) {
    return NextResponse.json({ success: true, processed: 0, synced: 0, failed: 0 });
  }

  let synced = 0;
  let failed = 0;
  const details: Array<{ id: string; ok: boolean; message?: string }> = [];

  for (const row of rows) {
    const result = await pushCarLoanLeadToISanction(
      {
        mobileNo: String(row.mobile || '').replace(/\D/g, '').slice(-10),
        panId: String(row.pan || '').toUpperCase(),
        vehicleRegistrationNumber: String(row.vehicle_number || '').toUpperCase(),
        income: Number(row.monthly_income || 0),
        occupation: String(row.occupation || ''),
      },
      { maxAttempts: 2 },
    );

    if (result.ok) {
      synced += 1;
      await supabaseAdmin
        .from('car_loan_leads')
        .update({
          status: 'SUBMITTED',
          isanction_synced: true,
          isanction_response: result.body,
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      details.push({ id: row.id, ok: true });
    } else {
      failed += 1;
      await supabaseAdmin
        .from('car_loan_leads')
        .update({
          status: 'API_FAILED',
          isanction_synced: false,
          isanction_response: { error: result.message, status: result.status, retryable: result.retryable },
          updated_at: new Date().toISOString(),
        })
        .eq('id', row.id);
      details.push({ id: row.id, ok: false, message: result.message });
    }
  }

  return NextResponse.json({
    success: true,
    processed: rows.length,
    synced,
    failed,
    details,
  });
}
