import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const rows: Record<string, any>[] = body.rows;

    if (!Array.isArray(rows) || rows.length === 0) {
      return NextResponse.json({ error: 'No rows provided' }, { status: 400 });
    }

    const parseDate = (val: any): string | null => {
      if (!val) return null;
      const s = val.toString().trim();
      if (!s) return null;
      // DD/MM/YYYY or DD-MM-YYYY
      const dmy = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
      if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}-${dmy[1].padStart(2, '0')}`;
      // Already YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
      return null;
    };

    const cleaned = rows.map((r) => ({
      phone_no: String(r.phone_no || '').trim(),
      name: r.name?.toString().trim() || null,
      address: r.address?.toString().trim() || null,
      regdate: parseDate(r.regdate),
      car_number: r.car_number?.toString().trim() || null,
      make: r.make?.toString().trim() || null,
      model: r.model?.toString().trim() || null,
    }));

    const valid = cleaned.filter((r) => r.phone_no.length >= 10);

    if (valid.length === 0) {
      return NextResponse.json({ error: 'No valid rows with phone_no found' }, { status: 400 });
    }

    const supabase = await createClient();

    const BATCH = 500;
    let inserted = 0;
    const errors: string[] = [];

    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH);
      const { error } = await supabase.from('crm_enquiries').insert(batch);
      if (error) {
        errors.push(`Batch ${Math.floor(i / BATCH) + 1}: ${error.message}`);
      } else {
        inserted += batch.length;
      }
    }

    return NextResponse.json({
      success: true,
      inserted,
      skipped: rows.length - valid.length,
      total: rows.length,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
