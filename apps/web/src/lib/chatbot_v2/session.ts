import { supabase } from './supabase';

export interface SessionData {
  history: { role: string; content: string }[];
}

export async function getSession(sessionId: string): Promise<SessionData> {
  if (!supabase) {
    return { history: [] };
  }

  try {
    const { data } = await supabase
      .from('chat_sessions')
      .select('data')
      .eq('session_id', sessionId)
      .gt('expires_at', new Date().toISOString())
      .single();

    if (!data?.data) {
      return { history: [] };
    }

    return data.data as SessionData;
  } catch {
    return { history: [] };
  }
}

export async function saveSession(sessionId: string, data: SessionData): Promise<void> {
  if (!supabase) return;

  try {
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + 24);

    await supabase
      .from('chat_sessions')
      .upsert(
        {
          session_id: sessionId,
          data,
          expires_at: expiresAt.toISOString(),
        },
        { onConflict: 'session_id' }
      );
  } catch {
    // Best-effort write.
  }
}
