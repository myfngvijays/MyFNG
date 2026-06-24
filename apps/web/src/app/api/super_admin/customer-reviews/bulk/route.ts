import { createClient } from '@/lib/supabase/server';
import {
  normalizeCustomerReviewInput,
  toCustomerReviewDbRow,
  type CustomerReviewInput,
} from '@/lib/customer-reviews-admin';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

const TABLE = 'customer_reviews';

async function requireSuperAdmin(supabase: any) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();
  if (userError || !user) {
    return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (roleError || !userData) {
    return { ok: false as const, res: NextResponse.json({ error: 'Forbidden - Role check failed' }, { status: 403 }) };
  }

  const roleCode = (userData as any).roles?.role_code;
  if (roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, res: NextResponse.json({ error: 'Forbidden - Not super admin' }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const auth = await requireSuperAdmin(supabase);
    if (!auth.ok) return auth.res;

    const body = await request.json().catch(() => ({}));
    const rawRows = Array.isArray(body?.reviews) ? body.reviews : [];
    if (rawRows.length === 0) {
      return NextResponse.json({ error: 'No reviews provided for bulk upload' }, { status: 400 });
    }
    if (rawRows.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 reviews per bulk upload' }, { status: 400 });
    }

    const rows: CustomerReviewInput[] = [];
    const errors: string[] = [];
    rawRows.forEach((raw: Partial<CustomerReviewInput>, index: number) => {
      const normalized = normalizeCustomerReviewInput(raw);
      if (!normalized) {
        errors.push(`Row ${index + 1}: name, text, and date are required.`);
        return;
      }
      rows.push(normalized);
    });

    if (rows.length === 0) {
      return NextResponse.json({ error: 'No valid reviews to import', errors }, { status: 400 });
    }

    const { data, error } = await supabase
      .from(TABLE)
      .insert(rows.map(toCustomerReviewDbRow))
      .select('id');

    if (error) {
      console.error('[customer-reviews][bulk] supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to bulk import reviews', details: error.message },
        { status: 500 },
      );
    }

    return NextResponse.json({
      success: true,
      imported: data?.length || rows.length,
      skipped: errors.length,
      errors,
      message: `Imported ${data?.length || rows.length} review(s)`,
    });
  } catch (e: any) {
    console.error('[customer-reviews][bulk] exception:', e);
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
