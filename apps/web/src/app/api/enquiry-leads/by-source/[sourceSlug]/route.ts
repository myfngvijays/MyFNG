import { NextRequest, NextResponse } from 'next/server';
import { ApiError, createLeadFromBody } from '@/lib/enquiry/createLead';

const SOURCE_SLUG_MAP: Record<string, string> = {
  'google-ads': 'Google Ads',
  'instagram-ads': 'Instagram Ads',
  'whatsapp': 'WhatsApp',
  'website': 'Website',
  'app-booking': 'App Booking',
  'banner-offline': 'Banner/Offline',
  'reference': 'Reference',
  'partner': 'Partner',
  'other': 'Other',
};

export async function POST(request: NextRequest, { params }: { params: { sourceSlug: string } }) {
  try {
    const slug = String(params?.sourceSlug || '').trim().toLowerCase();
    const leadSource = SOURCE_SLUG_MAP[slug];
    if (!leadSource) {
      return NextResponse.json({ error: 'Invalid lead_source' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const result = await createLeadFromBody({ body, leadSourceOverride: leadSource });

    return NextResponse.json(
      { success: true, ...result },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof ApiError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    return NextResponse.json(
      { error: 'Internal server error', details: err?.message || String(err) },
      { status: 500 }
    );
  }
}
