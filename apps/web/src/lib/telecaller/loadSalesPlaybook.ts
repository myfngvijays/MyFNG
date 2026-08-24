import { mergePlaybook, type SalesPlaybook } from '@/lib/telecaller/salesPlaybookDefaults';

export async function loadSalesPlaybook(db: any): Promise<SalesPlaybook> {
  try {
    const { data, error } = await db
      .from('ai_sales_playbook')
      .select('*')
      .eq('workspace_key', 'myfng')
      .maybeSingle();
    if (error || !data) return mergePlaybook(null);
    return mergePlaybook(data);
  } catch {
    return mergePlaybook(null);
  }
}
