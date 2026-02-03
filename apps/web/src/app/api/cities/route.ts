import { createClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET: Fetch cities
export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: cities, error } = await supabase
      .from('cities')
      .select('id, name, state')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching cities:', error);
      return NextResponse.json({ error: 'Failed to fetch cities' }, { status: 500 });
    }

    return NextResponse.json({ cities: cities || [] });
  } catch (error: any) {
    console.error('Error in GET /api/cities:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

