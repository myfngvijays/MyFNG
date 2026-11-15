import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { isValidEnquiryPhone, normalizePhoneDigits } from '@/lib/crm/normalizeEnquiryCsv';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const phones = [
      ...new Set(
        (Array.isArray(body?.phones) ? body.phones : [])
          .map((phone: unknown) => normalizePhoneDigits(String(phone || '')))
          .filter((phone: string) => isValidEnquiryPhone(phone)),
      ),
    ];
    const fileSet = new Set(phones);

    const supabase = await createClient();
    const { supabaseAdmin } = getSupabaseAdmin();
    const writer = supabaseAdmin || supabase;
    if (!writer) return NextResponse.json({ error: 'Could not read leads' }, { status: 500 });

    const panelPhones = new Set<string>();
    let panelTotal = 0;
    let matchedLeads = 0;
    let from = 0;

    while (true) {
      let query = writer
        .from('service_leads')
        .select('customer_phone')
        .order('id', { ascending: true })
        .range(from, from + 999);
      query = query.is('deleted_at', null);
      let { data, error } = await query;
      if (error && /deleted_at/i.test(String(error.message || ''))) {
        const retry = await writer
          .from('service_leads')
          .select('customer_phone')
          .order('id', { ascending: true })
          .range(from, from + 999);
        data = retry.data;
        error = retry.error;
      }
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      const rows = data || [];
      for (const row of rows) {
        panelTotal += 1;
        const phone = normalizePhoneDigits(String((row as { customer_phone?: string }).customer_phone || ''));
        if (!phone) continue;
        panelPhones.add(phone);
        if (fileSet.has(phone)) matchedLeads += 1;
      }
      if (rows.length < 1000) break;
      from += 1000;
    }

    let matched = 0;
    for (const phone of phones) {
      if (panelPhones.has(phone)) matched += 1;
    }

    return NextResponse.json({
      file_phones: phones.length,
      matched,
      fresh: Math.max(0, phones.length - matched),
      matched_leads: matchedLeads,
      panel_total: panelTotal,
      panel_kept: Math.max(0, panelTotal - matchedLeads),
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Preview failed' }, { status: 500 });
  }
}
