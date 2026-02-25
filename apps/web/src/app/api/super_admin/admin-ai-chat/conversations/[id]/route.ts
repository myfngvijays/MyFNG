import { NextRequest, NextResponse } from 'next/server';
import { assertSuperAdminAccess } from '@/lib/admin_ai/auth';
import { getAdminChatMessages } from '@/lib/admin_ai/chatStore';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const auth = await assertSuperAdminAccess();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  try {
    const params = await context.params;
    const conversationId = String(params?.id || '').trim();
    if (!conversationId) {
      return NextResponse.json({ error: 'Conversation id is required' }, { status: 400 });
    }
    const limit = Number(request.nextUrl.searchParams.get('limit') || '1000');
    const messages = await getAdminChatMessages({
      userId: auth.userId,
      conversationId,
      limit,
    });
    return NextResponse.json({ conversationId, messages }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to load conversation' },
      { status: 500 }
    );
  }
}

