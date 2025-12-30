/**
 * Blog Publish API Route
 * POST /api/blogs/[id]/publish - Publish a blog
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateBlogImageName } from '@/lib/blog/imageNaming';
import { validateAllImgHaveAlt } from '@/lib/blog/text';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabase = await createClient();
    
    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user profile
    const { data: userProfile, error: profileError } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const blogId = params.id;

    // Only DIGITAL_MARKETING and SUPER_ADMIN can publish blogs
    if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only Digital Marketing can publish blogs' }, { status: 403 });
    }

    // Get existing blog
    const { data: existingBlog, error: fetchError } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', blogId)
      .single();

    if (fetchError || !existingBlog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    // Validate blog before publishing (Aman Sir workflow)
    if (!existingBlog.title || !existingBlog.content || !existingBlog.slug) {
      return NextResponse.json({ error: 'Cannot publish: Blog must have title, slug, and content' }, { status: 400 });
    }

    // All <img> in HTML must have alt
    const altCheck = validateAllImgHaveAlt(String(existingBlog.content || ''), 125);
    if (!altCheck.ok) return NextResponse.json({ error: altCheck.error }, { status: 400 });

    // Featured image required + ALT required
    if (!existingBlog.featured_image) {
      return NextResponse.json({ error: 'Cannot publish: Featured image is required' }, { status: 400 });
    }
    const featuredAlt = String((existingBlog.seo_data || {})?.featured_image_alt || '').trim();
    if (!featuredAlt) {
      return NextResponse.json({ error: 'Cannot publish: Featured image ALT text is required' }, { status: 400 });
    }
    if (featuredAlt.length > 125) {
      return NextResponse.json({ error: 'Cannot publish: Featured image ALT too long (max 125 chars)' }, { status: 400 });
    }

    // Enforce image naming for our hosted images
    const nameErr = validateBlogImageName(String(existingBlog.featured_image), String(existingBlog.slug));
    if (nameErr) return NextResponse.json({ error: nameErr }, { status: 400 });

    // If FAQ schema is enabled, require at least 5 FAQs.
    const seo = (existingBlog.seo_data || {}) as any;
    if (Boolean(seo?.schema_faq)) {
      const { count: faqCount } = await supabase
        .from('blog_faqs')
        .select('id', { count: 'exact', head: true })
        .eq('blog_id', existingBlog.id);
      if ((faqCount || 0) < 5) {
        return NextResponse.json({ error: 'Cannot publish: At least 5 FAQs are required (generate/edit FAQs before publishing).' }, { status: 400 });
      }
    }

    // Publish the blog
    const { data: publishedBlog, error: publishError } = await supabase
      .from('blogs')
      .update({
        status: 'published',
        published_at: new Date().toISOString(),
        updated_by: userProfile.id
      })
      .eq('id', blogId)
      .select(`
        *,
        category:blog_categories(*),
        categories:blog_category_mapping(
          is_primary,
          category:blog_categories(*)
        ),
        author:users_login!author_id(id, full_name, email),
        tags:blog_tag_mapping(
          tag:blog_tags(*)
        ),
        faqs:blog_faqs(*)
      `)
      .single();

    if (publishError) {
      console.error('Blog publish error:', publishError);
      return NextResponse.json({ error: 'Failed to publish blog', details: publishError.message }, { status: 500 });
    }

    const transformedBlog = publishedBlog ? {
      ...publishedBlog,
      tags: publishedBlog.tags?.map((t: any) => t.tag) || [],
      categories: (publishedBlog as any).categories?.map((c: any) => c?.category).filter(Boolean) || [],
    } : null;

    return NextResponse.json({ 
      message: 'Blog published successfully',
      blog: transformedBlog 
    });
  } catch (error: any) {
    console.error('Blog publish error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
