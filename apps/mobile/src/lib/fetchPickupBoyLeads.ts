import { supabase } from './supabase';

/** Pickup jobs (assigned_pickup_boy_id) plus separately assigned delivery jobs (drop_assigned_to). */
export async function fetchPickupBoyLeads(pickupBoyId: string) {
  const [{ data: pickupRows, error: pickupErr }, { data: dropRows, error: dropErr }] = await Promise.all([
    supabase
      .from('service_leads')
      .select('*')
      .eq('assigned_pickup_boy_id', pickupBoyId)
      .not('status', 'in', '(REJECTED,CANCELLED)'),
    supabase
      .from('pickup_tracking')
      .select('lead_id, drop_assigned_to, drop_status')
      .eq('drop_assigned_to', pickupBoyId),
  ]);
  if (pickupErr) throw pickupErr;
  if (dropErr) throw dropErr;

  const pickupList = pickupRows || [];
  const dropList = dropRows || [];
  const pickupIds = new Set(pickupList.map((l: any) => l.id));
  const extraIds = dropList.map((r: any) => r.lead_id).filter((id: string) => id && !pickupIds.has(id));

  let extra: any[] = [];
  if (extraIds.length) {
    const { data, error } = await supabase.from('service_leads').select('*').in('id', extraIds);
    if (error) throw error;
    extra = data || [];
  }

  const allIds = [...pickupList.map((l: any) => l.id), ...extra.map((l: any) => l.id)];
  const { data: allTrack } = allIds.length
    ? await supabase
        .from('pickup_tracking')
        .select('lead_id, drop_assigned_to, drop_status')
        .in('lead_id', allIds)
    : { data: dropList };

  const trackMap = new Map((allTrack || dropList).map((r: any) => [r.lead_id, r]));
  const merged = [...pickupList, ...extra];
  const seen = new Set<string>();
  return merged
    .filter((l: any) => {
      if (!l?.id || seen.has(l.id)) return false;
      seen.add(l.id);
      return true;
    })
    .map((l: any) => {
      const t = trackMap.get(l.id);
      return {
        ...l,
        drop_assigned_to: t?.drop_assigned_to || null,
        drop_status: t?.drop_status || null,
      };
    });
}
