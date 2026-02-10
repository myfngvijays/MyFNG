import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { resolveUserProfile } from '@/lib/telecaller/resolveUserProfile';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function normalizePhone10(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 10 ? digits : digits.slice(-10);
}

/**
 * GET /api/rsa/mechanics/check-number?number=xxxxxxxxxx
 * Returns { exists: boolean, id?, code?, mechanic_name? }
 */
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const userProfile = await resolveUserProfile(supabase as any, user as any);
    const roleCode = String((userProfile?.roles as any)?.role_code || '');
    const allowed = new Set(['RSA_MANAGER', 'SUPER_ADMIN', 'SUB_ADMIN']);
    if (!allowed.has(roleCode)) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

    const { searchParams } = new URL(request.url);
    const numberRaw = searchParams.get('number') || '';
    const number = normalizePhone10(numberRaw);
    if (!number || number.length !== 10) {
      return NextResponse.json({ exists: false }, { status: 200 });
    }

    const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return NextResponse.json({ error: adminError || 'Admin client not configured' }, { status: 500 });
    }

    const db = supabaseAdmin as any;
    const or = `number.eq.${number},alternate_number1.eq.${number},alternate_number2.eq.${number}`;
    const { data, error } = await db
      .from('company_mechanic_rsa')
      .select('id, code, mechanic_name, number, alternate_number1, alternate_number2')
      .or(or)
      .limit(1);

    if (error) {
      return NextResponse.json({ error: 'Failed to check number', details: error.message }, { status: 500 });
    }

    const row = Array.isArray(data) && data.length ? data[0] : null;
    if (!row) return NextResponse.json({ exists: false }, { status: 200 });

    return NextResponse.json(
      {
        exists: true,
        id: row.id,
        code: row.code,
        mechanic_name: row.mechanic_name,
      },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

