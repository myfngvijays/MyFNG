import { assertPushAdmin } from '@/lib/push/admin-auth';
import { executeAdminPushBroadcast } from '@/lib/push/executeAdminBroadcast';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const result = await executeAdminPushBroadcast(body, {
      userId: auth.userId,
      userName: auth.userName,
    });

    const status = Number(result.status || (result.error && !result.success ? 400 : 200));
    if (result.error && result.success !== true && status >= 400) {
      return NextResponse.json(result, { status });
    }
    return NextResponse.json(result);
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Internal server error', details: error?.message },
      { status: 500 },
    );
  }
}
