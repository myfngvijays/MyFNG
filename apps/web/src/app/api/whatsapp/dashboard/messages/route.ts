import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  fetchWhatsAppOutboundMessages,
  outboundMessagesToCsv,
} from '@/lib/services/whatsappDashboardMessages';

const ALLOWED_ADMIN_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];

async function assertAdmin(db: any) {
  const {
    data: { user },
    error: authError,
  } = await db.auth.getUser();
  if (authError || !user) {
    return { ok: false, status: 401, error: 'Unauthorized' };
  }

  const { data: userProfile } = await db
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();

  const roleCode = (userProfile as any)?.roles?.role_code;
  if (!userProfile || !ALLOWED_ADMIN_ROLES.includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden' };
  }
  return { ok: true, status: 200, error: null };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const db: any = supabase;
    const auth = await assertAdmin(db);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const params = request.nextUrl.searchParams;
    const preset = String(params.get('preset') || 'last_7_days');
    const start = params.get('start');
    const end = params.get('end');
    const page = Number(params.get('page') || 1);
    const limit = Number(params.get('limit') || 20);
    const status = String(params.get('status') || 'all');
    const source = String(params.get('source') || 'all');
    const template = String(params.get('template') || '');
    const phone = String(params.get('phone') || '');
    const exportCsv = params.get('export') === '1';

    const result = await fetchWhatsAppOutboundMessages({
      preset,
      start,
      end,
      page: exportCsv ? 1 : page,
      limit: exportCsv ? 5000 : limit,
      status,
      source,
      template,
      phone,
    });

    if (exportCsv) {
      const csv = outboundMessagesToCsv(result.rows);
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="whatsapp-outbound-messages-${preset}.csv"`,
        },
      });
    }

    return NextResponse.json({ success: true, ...result });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Internal server error' }, { status: 500 });
  }
}
