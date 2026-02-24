import { createClient } from '@supabase/supabase-js';

type CategoryRow = {
  uuid: string;
  category: string;
  description: string | null;
  sequence: number | null;
};

export async function fetchActiveCategories(): Promise<
  Array<{ uuid: string; category: string; description: string | null; sequence: number }>
> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
  if (!url || !key) return [];

  const supabase = createClient(url, key);
  const { data, error } = await supabase
    .from('categories')
    .select('uuid, category, description, sequence')
    .eq('is_active', true)
    .order('sequence', { ascending: true });

  if (error || !data) return [];
  return (data as CategoryRow[]).map((row) => ({
    uuid: row.uuid,
    category: row.category,
    description: row.description ?? null,
    sequence: typeof row.sequence === 'number' ? row.sequence : 999,
  }));
}
