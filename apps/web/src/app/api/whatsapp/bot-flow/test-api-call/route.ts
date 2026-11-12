import { NextRequest, NextResponse } from 'next/server';
import { executeFlowApiRequest, flowApiVariables } from '@/lib/whatsappBotFlow/apiRequest';
import { getDbWithAdmin } from '../utils';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  const auth = await getDbWithAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => ({}));
  const data = body?.data && typeof body.data === 'object' ? body.data : {};
  const uid = String(body?.uid || data.apiTestUid || '').trim();
  try {
    const result = await executeFlowApiRequest(data, flowApiVariables(uid, { name: 'Test', button: 'Interested' }, 'Test'));
    return NextResponse.json({ success: true, status: result.status, body: result.body });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Test call failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
