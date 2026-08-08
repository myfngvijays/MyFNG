type RecordLoginHistoryInput = {
  supabase: any;
  userId: string;
  platform?: 'web' | 'mobile' | 'unknown';
  userAgent?: string | null;
};

/** Update last_login + append a login history row (best-effort). */
export async function recordLoginHistory(input: RecordLoginHistoryInput) {
  const userId = String(input.userId || '').trim();
  if (!userId || !input.supabase) return;

  const now = new Date().toISOString();
  const platform = input.platform || 'web';
  const userAgent = String(input.userAgent || '').trim().slice(0, 400) || null;

  try {
    await input.supabase.from('users_login').update({ last_login: now }).eq('id', userId);
  } catch (e) {
    console.warn('[recordLoginHistory] last_login update failed', e);
  }

  try {
    await input.supabase.from('user_login_history').insert({
      user_id: userId,
      logged_in_at: now,
      platform,
      user_agent: userAgent,
    });
  } catch (e) {
    console.warn('[recordLoginHistory] history insert failed', e);
  }
}
