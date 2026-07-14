import { NextRequest, NextResponse } from 'next/server';
import { pauseInstance } from '@/lib/whatsappAgents/shared/instanceAdmin';
import { getDbWithAdmin } from '@/app/api/whatsapp/agents/utils';

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const auth = await getDbWithAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await params;
    if (!isUuid(id)) return NextResponse.json({ error: 'Invalid instance id' }, { status: 400 });

    const body = await request.json().catch(() => ({}));
    const reason = body?.reason ? String(body.reason) : undefined;

    const instance = await pauseInstance(id, reason);

    return NextResponse.json({ success: true, instance });
  } catch (error: any) {
    const message = error?.message || 'Internal server error';
    const status = message.includes('not found') ? 404 : message.includes('Cannot pause') ? 409 : 500;
    return NextResponse.json({ error: message }, { status });
  }
}
