import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  fetchPcmsReports,
  mapRedemptionsForCsv,
  PCM_REPORT_CSV_COLUMNS,
} from '@/lib/pcms-reports';
import { rowsToCsv } from '@/lib/report-date-range';
import { PassThrough } from 'stream';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const };
}

export async function GET(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminError }, { status: 500 });

    const { searchParams } = request.nextUrl;
    const preset = searchParams.get('preset') || 'last_30_days';
    const customStart = searchParams.get('start');
    const customEnd = searchParams.get('end');
    const exportMode = searchParams.get('export') === '1';

    const report = await fetchPcmsReports(supabaseAdmin, {
      preset,
      customStart,
      customEnd,
      limit: exportMode ? 5000 : 500,
    });

    if (!exportMode) {
      return NextResponse.json(report);
    }

    const redemptionRows = mapRedemptionsForCsv(report.redemptions);
    const deviceRows = report.devices;
    const membershipRows = report.memberships.map((m: any) => ({
      ...m,
      has_second_car: m.has_second_car ? 'Yes' : 'No',
    }));

    const summaryText = [
      'PCMS Report Export',
      `Range: ${report.range.label}`,
      `From: ${report.range.start}`,
      `To: ${report.range.end}`,
      '',
      `Total Redemptions: ${report.summary.total_redemptions}`,
      `Total Discount: ${report.summary.total_discount}`,
      `New App Customers: ${report.summary.new_app_customers}`,
      `Android Installs: ${report.summary.android_installs}`,
      `iOS Installs: ${report.summary.ios_installs}`,
      `New Memberships: ${report.summary.new_memberships}`,
    ].join('\n');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const archiver = require('archiver') as any;
    const out = new PassThrough();
    const chunks: Buffer[] = [];
    out.on('data', (chunk: Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });

    const archive = archiver('zip', { zlib: { level: 6 } });
    archive.pipe(out);
    archive.on('error', (err: Error) => out.destroy(err));

    archive.append(summaryText, { name: 'summary.txt' });
    archive.append(rowsToCsv(redemptionRows, PCM_REPORT_CSV_COLUMNS.redemptions), {
      name: 'coupon-redemptions.csv',
    });
    archive.append(rowsToCsv(deviceRows, PCM_REPORT_CSV_COLUMNS.devices), {
      name: 'app-devices.csv',
    });
    archive.append(rowsToCsv(membershipRows, PCM_REPORT_CSV_COLUMNS.memberships), {
      name: 'memberships.csv',
    });

    const zipBuffer = await new Promise<Buffer>((resolve, reject) => {
      out.on('end', () => resolve(Buffer.concat(chunks)));
      out.on('error', reject);
      archive.finalize();
    });

    const filename = `pcm-report-${report.range.startYmd}-to-${report.range.endYmd}.zip`;

    return new NextResponse(zipBuffer, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': String(zipBuffer.length),
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
