import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

type BlogRow = {
  id: string;
  title: string;
  slug: string;
  status: string;
  views: number | null;
  likes: number | null;
  is_featured: boolean | null;
  is_premium: boolean | null;
  excerpt: string | null;
  featured_image: string | null;
  read_time: number | null;
  published_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  seo_data: Record<string, unknown> | null;
  category_id: string | null;
  author?: { full_name: string | null } | null;
};

function blogCard(b: BlogRow) {
  return {
    id: b.id,
    title: b.title,
    slug: b.slug,
    status: b.status,
    views: Number(b.views || 0),
    likes: Number(b.likes || 0),
    is_featured: Boolean(b.is_featured),
    read_time: Number(b.read_time || 0),
    published_at: b.published_at,
    updated_at: b.updated_at,
    created_at: b.created_at,
    author_name: String(b.author?.full_name || '').trim() || 'Unknown',
  };
}

export async function GET(_request: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as { role_code?: string } | null)?.role_code;
    if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

    const [
      totalRes,
      publishedRes,
      draftRes,
      pendingRes,
      archivedRes,
      featuredRes,
      premiumRes,
      publishedMonthRes,
      createdMonthRes,
      categoriesRes,
      tagsRes,
      commentsRes,
      faqsRes,
      allBlogsRes,
      topViewsRes,
      pendingListRes,
      recentPublishedRes,
      recentUpdatedRes,
      mappingRes,
    ] = await Promise.all([
      supabase.from('blogs').select('*', { count: 'exact', head: true }),
      supabase.from('blogs').select('*', { count: 'exact', head: true }).eq('status', 'published'),
      supabase.from('blogs').select('*', { count: 'exact', head: true }).eq('status', 'draft'),
      supabase.from('blogs').select('*', { count: 'exact', head: true }).eq('status', 'pending_review'),
      supabase.from('blogs').select('*', { count: 'exact', head: true }).eq('status', 'archived'),
      supabase.from('blogs').select('*', { count: 'exact', head: true }).eq('is_featured', true),
      supabase.from('blogs').select('*', { count: 'exact', head: true }).eq('is_premium', true),
      supabase.from('blogs').select('*', { count: 'exact', head: true }).eq('status', 'published').gte('published_at', startOfMonth),
      supabase.from('blogs').select('*', { count: 'exact', head: true }).gte('created_at', startOfMonth),
      supabase.from('blog_categories').select('*', { count: 'exact', head: true }),
      supabase.from('blog_tags').select('*', { count: 'exact', head: true }),
      supabase.from('blog_comments').select('*', { count: 'exact', head: true }),
      supabase.from('blog_faqs').select('*', { count: 'exact', head: true }),
      supabase
        .from('blogs')
        .select('id, status, excerpt, featured_image, seo_data, views, likes, category_id'),
      supabase
        .from('blogs')
        .select(
          'id, title, slug, status, views, likes, is_featured, is_premium, read_time, published_at, created_at, updated_at, author:users_login!author_id(full_name)',
        )
        .eq('status', 'published')
        .order('views', { ascending: false })
        .limit(5),
      supabase
        .from('blogs')
        .select(
          'id, title, slug, status, views, likes, is_featured, read_time, published_at, created_at, updated_at, author:users_login!author_id(full_name)',
        )
        .eq('status', 'pending_review')
        .order('updated_at', { ascending: false })
        .limit(6),
      supabase
        .from('blogs')
        .select(
          'id, title, slug, status, views, likes, is_featured, read_time, published_at, created_at, updated_at, author:users_login!author_id(full_name)',
        )
        .eq('status', 'published')
        .order('published_at', { ascending: false, nullsFirst: false })
        .limit(5),
      supabase
        .from('blogs')
        .select(
          'id, title, slug, status, views, likes, is_featured, read_time, published_at, created_at, updated_at, author:users_login!author_id(full_name)',
        )
        .order('updated_at', { ascending: false })
        .limit(8),
      supabase.from('blog_category_mapping').select('category_id'),
    ]);

    const allBlogs = allBlogsRes.data || [];
    let totalViews = 0;
    let totalLikes = 0;
    let missingMetaDescription = 0;
    let missingFeaturedImage = 0;
    let missingFeaturedAlt = 0;
    let missingExcerpt = 0;
    let missingFaqsOnPublished = 0;

    for (const row of allBlogs) {
      totalViews += Number(row.views || 0);
      totalLikes += Number(row.likes || 0);
      if (row.status === 'archived') continue;
      const seo = (row.seo_data || {}) as Record<string, unknown>;
      if (!String(seo.meta_description || row.excerpt || '').trim()) missingMetaDescription++;
      if (!String(row.featured_image || '').trim()) missingFeaturedImage++;
      if (row.featured_image && !String(seo.featured_image_alt || '').trim()) missingFeaturedAlt++;
      if (!String(row.excerpt || '').trim()) missingExcerpt++;
    }

    const publishedIds = allBlogs.filter((b) => b.status === 'published').map((b) => b.id);
    if (publishedIds.length) {
      const { data: faqRows } = await supabase.from('blog_faqs').select('blog_id').in('blog_id', publishedIds);
      const withFaqs = new Set((faqRows || []).map((f) => f.blog_id));
      missingFaqsOnPublished = publishedIds.filter((id) => !withFaqs.has(id)).length;
    }

    const { data: categories } = await supabase.from('blog_categories').select('id, name, slug').order('name');
    const categoryCounts = new Map<string, number>();
    for (const c of categories || []) categoryCounts.set(c.id, 0);
    for (const b of allBlogs) {
      if (b.category_id && categoryCounts.has(b.category_id)) {
        categoryCounts.set(b.category_id, (categoryCounts.get(b.category_id) || 0) + 1);
      }
    }
    for (const m of mappingRes.data || []) {
      if (m.category_id && categoryCounts.has(m.category_id)) {
        categoryCounts.set(m.category_id, (categoryCounts.get(m.category_id) || 0) + 1);
      }
    }

    const categoryBreakdown = (categories || [])
      .map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        count: categoryCounts.get(c.id) || 0,
      }))
      .filter((c) => c.count > 0)
      .sort((a, b) => b.count - a.count)
      .slice(0, 8);

    const statusBreakdown = [
      { status: 'published', label: 'Published', count: publishedRes.count || 0, color: 'bg-emerald-500' },
      { status: 'draft', label: 'Draft', count: draftRes.count || 0, color: 'bg-slate-400' },
      { status: 'pending_review', label: 'Pending Review', count: pendingRes.count || 0, color: 'bg-amber-500' },
      { status: 'archived', label: 'Archived', count: archivedRes.count || 0, color: 'bg-gray-400' },
    ];

    const total = totalRes.count || 0;

    return NextResponse.json({
      summary: {
        total,
        published: publishedRes.count || 0,
        draft: draftRes.count || 0,
        pendingReview: pendingRes.count || 0,
        archived: archivedRes.count || 0,
        featured: featuredRes.count || 0,
        premium: premiumRes.count || 0,
        totalViews,
        totalLikes,
        avgViews: total > 0 ? Math.round(totalViews / total) : 0,
        publishedThisMonth: publishedMonthRes.count || 0,
        createdThisMonth: createdMonthRes.count || 0,
      },
      inventory: {
        categories: categoriesRes.count || 0,
        tags: tagsRes.count || 0,
        comments: commentsRes.count || 0,
        faqs: faqsRes.count || 0,
      },
      seoHealth: {
        missingMetaDescription,
        missingFeaturedImage,
        missingFeaturedAlt,
        missingExcerpt,
        missingFaqsOnPublished,
        score: Math.max(
          0,
          Math.round(
            100 -
              ((missingMetaDescription + missingFeaturedImage + missingExcerpt) / Math.max(total, 1)) * 25 -
              (missingFeaturedAlt / Math.max(total, 1)) * 15,
          ),
        ),
      },
      statusBreakdown,
      categoryBreakdown,
      topByViews: ((topViewsRes.data || []) as BlogRow[]).map(blogCard),
      pendingReview: ((pendingListRes.data || []) as BlogRow[]).map(blogCard),
      recentPublished: ((recentPublishedRes.data || []) as BlogRow[]).map(blogCard),
      recentlyUpdated: ((recentUpdatedRes.data || []) as BlogRow[]).map(blogCard),
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    console.error('Blog dashboard stats error:', error);
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
