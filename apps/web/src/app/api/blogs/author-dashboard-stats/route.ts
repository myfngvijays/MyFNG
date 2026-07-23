import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { authorBlogOrFilter } from '@/lib/blog/ownership';
import { normalizeBlogMediaUrl } from '@/lib/blog/normalizeBlogMedia';

export const dynamic = 'force-dynamic';

type BlogRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  views: number | null;
  read_time: number | null;
  published_at: string | null;
  updated_at: string | null;
  created_at: string | null;
  featured_image: string | null;
  excerpt: string | null;
  category?: { name: string } | null;
};

function card(b: BlogRow) {
  return {
    id: b.id,
    title: b.title,
    slug: b.slug,
    status: b.status,
    views: Number(b.views || 0),
    read_time: Number(b.read_time || 0),
    published_at: b.published_at,
    updated_at: b.updated_at,
    created_at: b.created_at,
    featured_image: b.featured_image ? normalizeBlogMediaUrl(String(b.featured_image)) : null,
    excerpt: b.excerpt,
    category_name: b.category?.name || null,
  };
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as { role_code?: string } | null)?.role_code;
    if (roleCode !== 'DIGITAL_AUTHOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const ownerFilter = authorBlogOrFilter(userProfile!.id);

    const [allRes, publishedRes, draftRes, pendingRes, recentRes] = await Promise.all([
      supabase.from('blogs').select('views, status').or(ownerFilter),
      supabase.from('blogs').select('*', { count: 'exact', head: true }).or(ownerFilter).eq('status', 'published'),
      supabase.from('blogs').select('*', { count: 'exact', head: true }).or(ownerFilter).eq('status', 'draft'),
      supabase.from('blogs').select('*', { count: 'exact', head: true }).or(ownerFilter).eq('status', 'pending_review'),
      supabase
        .from('blogs')
        .select(
          'id, title, slug, status, views, read_time, published_at, updated_at, created_at, featured_image, excerpt, category:blog_categories(name)',
        )
        .or(ownerFilter)
        .order('updated_at', { ascending: false })
        .limit(10),
    ]);

    const rows = allRes.data || [];
    const total = rows.length;
    const totalViews = rows.reduce((sum, r) => sum + Number(r.views || 0), 0);

    return NextResponse.json({
      summary: {
        total,
        published: publishedRes.count || 0,
        draft: draftRes.count || 0,
        pendingReview: pendingRes.count || 0,
        totalViews,
      },
      recent: ((recentRes.data || []) as BlogRow[]).map(card),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
