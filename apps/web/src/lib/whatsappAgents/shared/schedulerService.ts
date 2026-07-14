import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import type { AgentEventType } from './types';

function getAdminDb() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (!supabaseAdmin) throw new Error(error || 'Supabase admin client unavailable');
  return supabaseAdmin;
}

export async function scheduleWakeup(input: {
  instanceId: string;
  wakeAt: Date;
  eventType?: 'SCHEDULED_FOLLOWUP' | 'CHASE_RETRY' | 'FOLLOWUP_TRIGGER';
}): Promise<void> {
  const db = getAdminDb();
  await db.from('whatsapp_agent_scheduled_wakeups').upsert(
    {
      instance_id: input.instanceId,
      wake_at: input.wakeAt.toISOString(),
      event_type: input.eventType || 'CHASE_RETRY',
      status: 'PENDING',
    },
    { onConflict: 'instance_id' },
  );

  await db
    .from('whatsapp_agent_instances')
    .update({
      status: 'WAITING',
      next_wakeup_at: input.wakeAt.toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', input.instanceId);
}

export async function cancelWakeup(instanceId: string): Promise<void> {
  const db = getAdminDb();
  await db
    .from('whatsapp_agent_scheduled_wakeups')
    .update({ status: 'CANCELLED' })
    .eq('instance_id', instanceId)
    .eq('status', 'PENDING');
}

export async function fetchDueWakeups(limit = 50): Promise<
  Array<{
    id: string;
    instance_id: string;
    wake_at: string;
    event_type: string;
    instance: Record<string, unknown>;
  }>
> {
  const db = getAdminDb();
  const now = new Date().toISOString();

  const { data, error } = await db
    .from('whatsapp_agent_scheduled_wakeups')
    .select('id, instance_id, wake_at, event_type, instance:whatsapp_agent_instances(*)')
    .eq('status', 'PENDING')
    .lte('wake_at', now)
    .order('wake_at', { ascending: true })
    .limit(limit);

  if (error) throw new Error(error.message);
  return (data || []) as any[];
}

export async function markWakeupDone(wakeupId: string): Promise<void> {
  const db = getAdminDb();
  await db
    .from('whatsapp_agent_scheduled_wakeups')
    .update({ status: 'DONE' })
    .eq('id', wakeupId);
}

export async function markWakeupProcessing(wakeupId: string): Promise<void> {
  const db = getAdminDb();
  await db
    .from('whatsapp_agent_scheduled_wakeups')
    .update({ status: 'PROCESSING' })
    .eq('id', wakeupId);
}

export async function markWakeupFailed(wakeupId: string): Promise<void> {
  const db = getAdminDb();
  await db
    .from('whatsapp_agent_scheduled_wakeups')
    .update({ status: 'PENDING' })
    .eq('id', wakeupId);
}

/** Reset wakeups stuck in PROCESSING for more than 15 minutes. */
export async function recoverStuckWakeups(): Promise<number> {
  const db = getAdminDb();
  const cutoff = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  const { data, error } = await db
    .from('whatsapp_agent_scheduled_wakeups')
    .select('id')
    .eq('status', 'PROCESSING')
    .lt('created_at', cutoff);

  if (error || !data?.length) return 0;

  const ids = data.map((row: { id: string }) => row.id);
  await db.from('whatsapp_agent_scheduled_wakeups').update({ status: 'PENDING' }).in('id', ids);
  return ids.length;
}

export function computeWaitUntil(decision: { wait_hours?: number; wait_days?: number }): Date {
  const hours = decision.wait_hours ?? (decision.wait_days ? decision.wait_days * 24 : 24);
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}
