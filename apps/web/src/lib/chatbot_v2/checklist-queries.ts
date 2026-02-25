import { supabase } from './supabase';

/**
 * Get checklist for a specific service by name
 */
export async function getServiceChecklist(serviceName: string): Promise<any[]> {
  if (!supabase) return [];

  try {
    const { data: serviceType } = await supabase
      .from('service_types')
      .select('id, name')
      .ilike('name', `%${serviceName}%`)
      .limit(1)
      .single();
    if (!serviceType) {
      console.log(`[CHECKLIST] Service not found: ${serviceName}`);
      return [];
    }

    const { data: checklist } = await supabase
      .from('service_type_checklist_templates')
      .select('checklist_items')
      .eq('service_type_id', serviceType.id)
      .single();

    if (!checklist || !checklist.checklist_items) {
      console.log(`[CHECKLIST] No checklist found for: ${serviceType.name}`);
      return [];
    }

    return checklist.checklist_items;
  } catch (err) {
    console.error('[CHECKLIST] Error:', err);
    return [];
  }
}

/**
 * Format checklist items for display
 */
export function formatChecklist(items: any[]): string {
  if (!items || items.length === 0) {
    return 'Checklist details will be provided by our team during booking.';
  }

  // Group by category
  const grouped: Record<string, any[]> = {};
  items.forEach((item: any) => {
    const category = item.category || 'General';
    if (!grouped[category]) grouped[category] = [];
    grouped[category].push(item);
  });

  // Format as text
  let result = "**What's Included:**\n\n";
  Object.entries(grouped).forEach(([category, categoryItems]) => {
    result += `🔧 **${category}:**\n`;
    categoryItems.forEach((item: any) => {
      result += `   ✓ ${item.name}\n`;
    });
    result += '\n';
  });

  return result.trim();
}
