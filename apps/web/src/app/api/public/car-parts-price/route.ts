import { NextRequest, NextResponse } from 'next/server';
import { estimateCarPartsPrices } from '@/lib/car-parts-price-estimate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const make = String(body?.make || '').trim();
    const model = String(body?.model || '').trim();

    if (!make || !model) {
      return NextResponse.json({ error: 'make and model are required' }, { status: 400 });
    }

    const regYearRaw = body?.reg_year ?? body?.regYear;
    const regYear = regYearRaw != null && String(regYearRaw).trim() !== '' ? Number(regYearRaw) : undefined;

    const estimate = await estimateCarPartsPrices({
      make,
      model,
      regYear: Number.isFinite(regYear) ? regYear : undefined,
      fuel: body?.fuel ? String(body.fuel) : undefined,
      variant: body?.variant ? String(body.variant) : undefined,
      vehicleClass: body?.vehicle_class ?? body?.vehicleClass ?? null,
      city: body?.city ? String(body.city) : null,
    });

    return NextResponse.json({ success: true, estimate });
  } catch (err: any) {
    console.error('[public/car-parts-price][POST]', err);
    return NextResponse.json({ error: err?.message || 'Could not estimate parts prices' }, { status: 500 });
  }
}
