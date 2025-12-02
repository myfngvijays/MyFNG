import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// GET: Fetch telecaller scripts
export async function GET(request: NextRequest) {
  try {
    const supabase = createRouteHandlerClient({ cookies });
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const category = searchParams.get('category');
    const search = searchParams.get('search');

    let query = supabase
      .from('telecaller_scripts')
      .select('*')
      .eq('is_active', true)
      .order('script_type', { ascending: true });

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    if (search) {
      query = query.or(`script_title.ilike.%${search}%,script_content.ilike.%${search}%`);
    }

    const { data: scripts, error } = await query;

    if (error) {
      console.error('Error fetching telecaller scripts:', error);
      return NextResponse.json({ error: 'Failed to fetch scripts' }, { status: 500 });
    }

    return NextResponse.json({ scripts: scripts || [] });
  } catch (error: any) {
    console.error('Error in GET /api/telecaller/scripts:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

