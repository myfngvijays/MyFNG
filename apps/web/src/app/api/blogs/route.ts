/**
 * Blog API Routes
 * GET /api/blogs - List all blogs with filters
 * POST /api/blogs - Create a new blog
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

const ALLOWED_BLOG_IMAGE_EXTS = new Set(['webp', 'jpg', 'jpeg', 'png']);

function extractFilenameParts(url: string): { base: string | null; ext: string | null } {
  const clean = url.split('?')[0]?.split('#')[0] ?? '';
  const last = clean.split('/').filter(Boolean).pop() ?? '';
  const idx = last.lastIndexOf('.');
  if (idx <= 0) return { base: null, ext: null };
  const base = last.slice(0, idx);
  const ext = last.slice(idx + 1).toLowerCase();
  return { base, ext };
}

function shouldEnforceBlogImageName(url: string): boolean {
  if (!url) return false;
  // Relative URLs are assumed to be our assets → enforce.
  if (url.startsWith('/')) return true;
  // If not an absolute http(s) URL, enforce as well.
  if (!/^https?:\/\//i.test(url)) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // Enforce for our domains and common storage hosts used by us.
    return host.endsWith('myfng.in') || host.endsWith('myfng.cloud') || host.includes('supabase.co');
  } catch {
    return true;
  }
}

function validateBlogImageName(url: string, slug: string): string | null {
  if (!url || !slug) return null;
  if (!shouldEnforceBlogImageName(url)) return null;

  const { base, ext } = extractFilenameParts(url);
  if (!base || !ext || !ALLOWED_BLOG_IMAGE_EXTS.has(ext)) {
    return `Blog image file name must exactly match the slug (e.g. "${slug}.webp" or "${slug}.jpg").`;
  }
  if (base !== slug) {
    return `Blog image file name must exactly match the slug (expected "${slug}.${ext}", got "${base}.${ext}").`;
  }
  return null;
}

export async function GET(request: NextRequest) {
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
      .select('id, role_id, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const status = searchParams.get('status'); // draft, published, archived
    const category_id = searchParams.get('category_id');
    const tag_id = searchParams.get('tag_id');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Build query
    let query = supabase
      .from('blogs')
      .select(`
        *,
        category:blog_categories(*),
        author:users_login!author_id(id, full_name, email),
        tags:blog_tag_mapping(
          tag:blog_tags(*)
        )
      `, { count: 'exact' });

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    if (category_id) {
      query = query.eq('category_id', category_id);
    }
    
    if (featured) {
      query = query.eq('is_featured', true);
    }
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%,content.ilike.%${search}%`);
    }

    // Digital Author can only see their own blogs
    if (roleCode === 'DIGITAL_AUTHOR') {
      query = query.eq('author_id', userProfile.id);
    }

    // Ordering
    query = query.order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data: blogs, error, count } = await query;

    // Filter by tag_id after fetching (since it's a many-to-many relationship)
    let filteredBlogs = blogs || [];
    if (tag_id) {
      filteredBlogs = filteredBlogs.filter((blog: any) => {
        const blogTags = blog.tags?.map((t: any) => t.tag?.id || t.tag_id) || [];
        return blogTags.includes(tag_id);
      });
    }

    if (error) {
      console.error('Blog fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch blogs', details: error.message }, { status: 500 });
    }

    // Transform tags structure
    const transformedBlogs = filteredBlogs.map((blog: any) => ({
      ...blog,
      tags: blog.tags?.map((t: any) => t.tag) || []
    }));

    return NextResponse.json({
      blogs: transformedBlogs || [],
      pagination: {
        page,
        limit,
        total: tag_id ? filteredBlogs.length : (count || 0), // Adjust count if tag filtered
        totalPages: tag_id ? Math.ceil(filteredBlogs.length / limit) : Math.ceil((count || 0) / limit)
      }
    });
  } catch (error: any) {
    console.error('Blogs GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
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
      .select('id, role_id, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;

    // Check permissions
    if (roleCode !== 'DIGITAL_AUTHOR' && roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    const body = await request.json();
    const {
      title,
      slug,
      excerpt,
      content,
      seo_data,
      category_id,
      read_time,
      featured_image,
      status: requestedStatus = 'draft',
      is_featured: requestedIsFeatured = false,
      is_premium: requestedIsPremium = false,
      tag_ids = [],
      image_urls = []
    } = body;

    // Digital Author restrictions
    let finalStatus = requestedStatus;
    let finalIsFeatured = requestedIsFeatured;
    let finalIsPremium = requestedIsPremium;
    
    if (roleCode === 'DIGITAL_AUTHOR') {
      // Force draft if trying to publish
      if (requestedStatus === 'published') {
        finalStatus = 'draft';
      }
      // Cannot set featured or premium
      finalIsFeatured = false;
      finalIsPremium = false;
    }

    // Validation
    if (!title || !slug || !content) {
      return NextResponse.json({ error: 'Title, slug, and content are required' }, { status: 400 });
    }

    // SEO requirement: uploaded blog image filename must match slug.
    if (featured_image) {
      const err = validateBlogImageName(String(featured_image), String(slug));
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    if (Array.isArray(image_urls) && image_urls.length) {
      for (const item of image_urls) {
        const url = typeof item === 'string' ? item : item?.url;
        if (!url) continue;
        const err = validateBlogImageName(String(url), String(slug));
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
    }

    // Check if slug already exists
    const { data: existingBlog } = await supabase
      .from('blogs')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingBlog) {
      return NextResponse.json({ error: 'Blog with this slug already exists' }, { status: 400 });
    }

    // Create blog
    const { data: blog, error: blogError } = await supabase
      .from('blogs')
      .insert({
        title,
        slug,
        excerpt,
        content,
        seo_data: seo_data || {},
        category_id,
        author_id: userProfile.id,
        created_by: userProfile.id,
        updated_by: userProfile.id,
        read_time: read_time || 3,
        featured_image,
        status: finalStatus,
        is_featured: finalIsFeatured,
        is_premium: finalIsPremium,
        published_at: (finalStatus === 'published' && (roleCode === 'DIGITAL_MARKETING' || roleCode === 'SUPER_ADMIN')) 
          ? new Date().toISOString() 
          : null
      })
      .select()
      .single();

    if (blogError) {
      console.error('Blog creation error:', blogError);
      return NextResponse.json({ error: 'Failed to create blog', details: blogError.message }, { status: 500 });
    }

    // Add tags if provided
    if (tag_ids.length > 0) {
      const tagMappings = tag_ids.map((tag_id: string) => ({
        blog_id: blog.id,
        tag_id
      }));

      const { error: tagError } = await supabase
        .from('blog_tag_mapping')
        .insert(tagMappings);

      if (tagError) {
        console.error('Tag mapping error:', tagError);
        // Don't fail the whole request, just log it
      }
    }

    // Add additional images if provided
    if (image_urls.length > 0) {
      const images = image_urls.map((url: string) => ({
        blog_id: blog.id,
        image_url: url
      }));

      const { error: imageError } = await supabase
        .from('blog_images')
        .insert(images);

      if (imageError) {
        console.error('Image insertion error:', imageError);
        // Don't fail the whole request, just log it
      }
    }

    // Fetch complete blog with relations
    const { data: completeBlog, error: fetchError } = await supabase
      .from('blogs')
      .select(`
        *,
        category:blog_categories(*),
        author:users_login!author_id(id, full_name, email),
        tags:blog_tag_mapping(
          tag:blog_tags(*)
        )
      `)
      .eq('id', blog.id)
      .single();

    if (fetchError) {
      console.error('Blog fetch error:', fetchError);
    }

    const transformedBlog = completeBlog ? {
      ...completeBlog,
      tags: completeBlog.tags?.map((t: any) => t.tag) || []
    } : blog;

    return NextResponse.json({ blog: transformedBlog }, { status: 201 });
  } catch (error: any) {
    console.error('Blogs POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
