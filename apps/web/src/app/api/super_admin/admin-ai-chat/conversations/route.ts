import { NextRequest, NextResponse } from 'next/server';
import { assertSuperAdminAccess } from '@/lib/admin_ai/auth';
import { listAdminChatConversations } from '@/lib/admin_ai/chatStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: NextRequest) {
  const auth = await assertSuperAdminAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const search = String(request.nextUrl.searchParams.get('search') || '').trim();
    const limit = Number(request.nextUrl.searchParams.get('limit') || '200');
    const conversations = await listAdminChatConversations({
      userId: auth.userId,
      search,
      limit,
    });
    return NextResponse.json({ conversations }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load conversations' },
      { status: 500 }
    );
  }
}

