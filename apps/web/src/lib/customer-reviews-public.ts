import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export type PublicGoogleReview = {
  id: string;
  name: string;
  location: string;
  vehicle: string;
  rating: number;
  text: string;
  date: string;
};

function toCard(row: {
  id?: string;
  name?: string;
  car?: string;
  stars?: number;
  rating?: number;
  text?: string;
  date?: string;
}): PublicGoogleReview | null {
  const text = String(row.text || '').trim();
  const rating = Number(row.stars || row.rating || 0);
  const name = String(row.name || '').trim();
  if (!text || !name || rating < 4) return null;
  const car = String(row.car || '').trim();
  const date = String(row.date || '').trim();
  const isGoogle = /google/i.test(car);
  return {
    id: String(row.id || `${name}|${text.slice(0, 40)}`),
    name,
    location: date || (isGoogle ? 'Google' : ''),
    vehicle: isGoogle ? 'Google review' : car || 'MyFNG',
    rating: Math.min(5, rating),
    text,
    date,
  };
}

export async function listPublicGoogleReviews(opts: {
  screen?: 'home' | 'rsa';
  limit?: number;
} = {}): Promise<PublicGoogleReview[]> {
  const screen = opts.screen === 'rsa' ? 'rsa' : 'home';
  const limit = Math.min(20, Math.max(1, Number(opts.limit) || 8));
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    console.warn('[public-reviews] no admin client', adminError);
    return [];
  }

  const seen = new Set<string>();
  const out: PublicGoogleReview[] = [];
  const push = (row: PublicGoogleReview | null) => {
    if (!row) return;
    const key = `${row.name}|${row.text.slice(0, 40)}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(row);
  };

  const { data, error } = await supabaseAdmin
    .from('customer_reviews')
    .select('id, name, car, stars, text, date, display_order')
    .eq('is_active', true)
    .gte('stars', 4)
    .or(screen === 'rsa' ? 'screen.eq.rsa' : 'screen.eq.home,screen.is.null')
    .order('display_order', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.warn('[public-reviews] table', error.message);
  }
  for (const row of data || []) push(toCard(row));

  if (!out.length) {
    const { data: anyRows } = await supabaseAdmin
      .from('customer_reviews')
      .select('id, name, car, stars, text, date, display_order, screen')
      .eq('is_active', true)
      .gte('stars', 4)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false })
      .limit(limit);
    for (const row of anyRows || []) push(toCard(row));
  }

  return out.slice(0, limit);
}
