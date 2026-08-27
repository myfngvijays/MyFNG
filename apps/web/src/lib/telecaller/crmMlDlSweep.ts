import { scoreLeadById, scoreOpenLeads } from '@/lib/telecaller/leadMlScore';
import { enqueueCrmDlOnRecordingCompleted, sweepCrmDl } from '@/lib/telecaller/leadDlVoice';

export { enqueueCrmDlOnRecordingCompleted };

export async function sweepCrmMlDl(opts?: { dlLimit?: number; mlLimit?: number }) {
  const dl = await sweepCrmDl(opts?.dlLimit ?? 3).catch((e) => ({
    scanned: 0,
    ran: 0,
    skipped: 0,
    warning: e?.message || 'dl sweep failed',
  }));
  const ml = await scoreOpenLeads(opts?.mlLimit ?? 40).catch((e) => ({
    scored: 0,
    warning: e?.message || 'ml sweep failed',
  }));
  return { dl, ml };
}

export async function refreshLeadBrain(leadId: string, opts?: { processDl?: boolean }) {
  let voiceWarning: string | undefined;
  if (opts?.processDl) {
    const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
    const { processCallDl } = await import('@/lib/telecaller/leadDlVoice');
    const { supabaseAdmin } = getSupabaseAdmin();
    if (supabaseAdmin) {
      const { data: logs } = await supabaseAdmin
        .from('telecaller_call_logs')
        .select('id, call_recording_url, call_duration')
        .eq('lead_id', leadId)
        .not('call_recording_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1);
      const log = Array.isArray(logs) ? logs[0] : null;
      if (log?.id) {
        const result = await processCallDl(String(log.id), { force: false });
        voiceWarning = result.warning;
      }
    }
  }
  const scored = await scoreLeadById(leadId);
  return { ...scored, voiceWarning };
}
