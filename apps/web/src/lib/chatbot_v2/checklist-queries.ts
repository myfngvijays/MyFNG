import { supabase } from './supabase';

export async function getServiceChecklist(serviceName: string): Promise<any[]> {
  if (!supabase) return [];

  try {
    const { data: serviceType } = await supabase
      .from('service_types')
      .select('id, name')
      .ilike('name', `%${serviceName}%`)
      .limit(1)
      .single();
    if (!serviceType?.id) return [];

    const { data: checklist } = await supabase
      .from('service_type_checklist_templates')
      .select('checklist_items')
      .eq('service_type_id', serviceType.id)
      .single();

    return checklist?.checklist_items || [];
  } catch {
    return [];
  }
}
