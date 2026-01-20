import { NextRequest, NextResponse } from 'next/server';
import { ApiError, createLeadFromBody } from '@/lib/enquiry/createLead';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const result = await createLeadFromBody({ body });
    return NextResponse.json({ success: true, ...result }, { status: 201 });
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

