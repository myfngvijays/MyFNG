import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type StoredAdminMessage = {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  createdAt: string;
};

export type StoredConversation = {
  id: string;
  title: string;
  preview: string;
  lastMessageAt: string;
  messageCount: number;
};

const ACTION = 'ADMIN_AI_CHAT_MESSAGE';

function makeConversationTitle(text: string) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > 72 ? `${clean.slice(0, 69)}...` : clean || 'New chat';
}

function makePreview(text: string) {
  const clean = String(text || '').replace(/\s+/g, ' ').trim();
  return clean.length > 120 ? `${clean.slice(0, 117)}...` : clean;
}

export async function appendAdminChatMessage(params: {
  userId: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  text: string;
  titleHint?: string;
  toolTrace?: any;
}) {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Admin DB client not configured');
  const db = supabaseAdmin as any;

  const payload = {
    user_id: params.userId,
    action: ACTION,
    table_name: 'admin_ai_chat',
    record_id: params.conversationId,
    session_id: params.conversationId,
    action_category: 'DATA',
    severity: 'LOW',
    new_data: {
      conversation_id: params.conversationId,
      role: params.role,
      content: params.text,
      title: params.titleHint || makeConversationTitle(params.text),
      preview: makePreview(params.text),
      tool_trace: params.toolTrace || null,
    },
  };

  const { error: insertError } = await db.from('audit_logs').insert(payload);
  if (insertError) throw new Error(insertError.message || 'Failed to persist message');
}

export async function listAdminChatConversations(params: { userId: string; search?: string; limit?: number }) {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Admin DB client not configured');
  const db = supabaseAdmin as any;
  const limit = Math.max(1, Math.min(2000, Number(params.limit || 1000)));

  const { data, error: queryError } = await db
    .from('audit_logs')
    .select('id, session_id, user_id, created_at, new_data')
    .eq('action', ACTION)
    .eq('table_name', 'admin_ai_chat')
    .eq('user_id', params.userId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (queryError) throw new Error(queryError.message || 'Failed to load conversations');

  const grouped = new Map<string, StoredConversation>();
  for (const row of data || []) {
    const conversationId = String((row as any)?.session_id || '').trim();
    if (!conversationId) continue;
    const meta = (row as any)?.new_data || {};
    const title = String(meta?.title || 'New chat').trim() || 'New chat';
    const preview = String(meta?.preview || meta?.content || '').trim();
    const createdAt = String((row as any)?.created_at || '');
    const existing = grouped.get(conversationId);
    if (!existing) {
      grouped.set(conversationId, {
        id: conversationId,
        title,
        preview,
        lastMessageAt: createdAt,
        messageCount: 1,
      });
    } else {
      existing.messageCount += 1;
      if (!existing.title && title) existing.title = title;
      if (!existing.preview && preview) existing.preview = preview;
    }
  }

  let rows = Array.from(grouped.values()).sort((a, b) => b.lastMessageAt.localeCompare(a.lastMessageAt));
  const q = String(params.search || '').trim().toLowerCase();
  if (q) {
    rows = rows.filter(
      (r) => r.title.toLowerCase().includes(q) || r.preview.toLowerCase().includes(q) || r.id.toLowerCase().includes(q)
    );
  }
  return rows.slice(0, 200);
}

export async function getAdminChatMessages(params: { userId: string; conversationId: string; limit?: number }) {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Admin DB client not configured');
  const db = supabaseAdmin as any;
  const limit = Math.max(1, Math.min(5000, Number(params.limit || 500)));

  const { data, error: queryError } = await db
    .from('audit_logs')
    .select('id, created_at, session_id, user_id, new_data')
    .eq('action', ACTION)
    .eq('table_name', 'admin_ai_chat')
    .eq('user_id', params.userId)
    .eq('session_id', params.conversationId)
    .order('created_at', { ascending: true })
    .limit(limit);

  if (queryError) throw new Error(queryError.message || 'Failed to load messages');

  return (data || []).map((row: any) => {
    const meta = row?.new_data || {};
    return {
      id: String(row?.id || ''),
      conversationId: String(row?.session_id || params.conversationId),
      role: String(meta?.role || 'assistant') as 'user' | 'assistant' | 'system',
      text: String(meta?.content || ''),
      createdAt: String(row?.created_at || ''),
    } as StoredAdminMessage;
  });
}

