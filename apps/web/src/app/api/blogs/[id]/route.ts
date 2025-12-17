/**
 * Blog Detail API Routes
 * GET /api/blogs/[id] - Get blog by ID or slug
 * PUT /api/blogs/[id] - Update blog
 * DELETE /api/blogs/[id] - Delete blog
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
  if (url.startsWith('/')) return true;
  if (!/^https?:\/\//i.test(url)) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
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

export async function GET(
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

    const blogId = params.id;

    // Fetch blog (can be ID or slug)
    const { data: blog, error } = await supabase
      .from('blogs')
      .select(`
        *,
        category:blog_categories(*),
        author:users_login!author_id(id, full_name, email),
        tags:blog_tag_mapping(
          tag:blog_tags(*)
        ),
        images:blog_images(*)
      `)
      .or(`id.eq.${blogId},slug.eq.${blogId}`)
      .single();

    if (error || !blog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    // Check if user can view this blog
    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as any)?.role_code;

    // Digital Author can only view their own blogs (unless published)
    if (roleCode === 'DIGITAL_AUTHOR' && blog.status !== 'published') {
      if (blog.author_id !== userProfile?.id) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
      }
    }

    // Transform tags structure
    const transformedBlog = {
      ...blog,
      tags: blog.tags?.map((t: any) => t.tag) || []
    };

    return NextResponse.json({ blog: transformedBlog });
  } catch (error: any) {
    console.error('Blog GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function PUT(
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
      .select('id, role_id, full_name, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const blogId = params.id;

    // Get existing blog
    const { data: existingBlog, error: fetchError } = await supabase
      .from('blogs')
      .select('*')
      .eq('id', blogId)
      .single();

    if (fetchError || !existingBlog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    // Parse request body first
    const body = await request.json();

    // Check permissions
    if (roleCode === 'DIGITAL_AUTHOR') {
      // Digital Author can only edit their own blogs
      if (existingBlog.author_id !== userProfile.id) {
        return NextResponse.json({ error: 'Forbidden: You can only edit your own blogs' }, { status: 403 });
      }
      // Digital Author cannot publish blogs - only save as draft
      if (body.status === 'published') {
        return NextResponse.json({ error: 'Forbidden: Digital Authors cannot publish blogs. Please save as draft and request Digital Marketing to publish.' }, { status: 403 });
      }
      // Digital Author cannot set featured or premium
      if (body.is_featured !== undefined || body.is_premium !== undefined) {
        return NextResponse.json({ error: 'Forbidden: Digital Authors cannot set featured or premium status' }, { status: 403 });
      }
    } else if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }
    const {
      title,
      slug,
      excerpt,
      content,
      seo_data,
      category_id,
      read_time,
      featured_image,
      status,
      is_featured,
      is_premium,
      tag_ids,
      image_urls
    } = body;

    // Check slug uniqueness if changed
    if (slug && slug !== existingBlog.slug) {
      const { data: slugExists } = await supabase
        .from('blogs')
        .select('id')
        .eq('slug', slug)
        .neq('id', blogId)
        .single();

      if (slugExists) {
        return NextResponse.json({ error: 'Blog with this slug already exists' }, { status: 400 });
      }
    }

    // SEO requirement: uploaded blog image filename must match slug.
    const effectiveSlug = String(slug ?? existingBlog.slug);
    if (featured_image !== undefined && featured_image !== null) {
      const err = validateBlogImageName(String(featured_image), effectiveSlug);
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    if (image_urls !== undefined && Array.isArray(image_urls) && image_urls.length) {
      for (const item of image_urls) {
        const url = typeof item === 'string' ? item : item?.url;
        if (!url) continue;
        const err = validateBlogImageName(String(url), effectiveSlug);
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
    }

    // Prepare update data
    const updateData: any = {
      updated_by: userProfile.id
    };

    if (title !== undefined) updateData.title = title;
    if (slug !== undefined) updateData.slug = slug;
    if (excerpt !== undefined) updateData.excerpt = excerpt;
    if (content !== undefined) updateData.content = content;
    if (seo_data !== undefined) updateData.seo_data = seo_data;
    if (category_id !== undefined) updateData.category_id = category_id;
    if (read_time !== undefined) updateData.read_time = read_time;
    if (featured_image !== undefined) updateData.featured_image = featured_image;
    if (status !== undefined) {
      // Only Digital Marketing and Super Admin can change status to published
      if (status === 'published' && roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
        return NextResponse.json({ error: 'Forbidden: Only Digital Marketing can publish blogs' }, { status: 403 });
      }
      updateData.status = status;
      // Set published_at when status changes to published
      if (status === 'published' && existingBlog.status !== 'published') {
        updateData.published_at = new Date().toISOString();
      }
      // Clear published_at if status changes from published to draft
      if (status === 'draft' && existingBlog.status === 'published') {
        updateData.published_at = null;
      }
    }
    if (is_featured !== undefined) updateData.is_featured = is_featured;
    if (is_premium !== undefined) updateData.is_premium = is_premium;

    // Update blog
    const { data: updatedBlog, error: updateError } = await supabase
      .from('blogs')
      .update(updateData)
      .eq('id', blogId)
      .select()
      .single();

    if (updateError) {
      console.error('Blog update error:', updateError);
      return NextResponse.json({ error: 'Failed to update blog', details: updateError.message }, { status: 500 });
    }

    // Update tags if provided
    if (tag_ids !== undefined) {
      // Delete existing mappings
      await supabase
        .from('blog_tag_mapping')
        .delete()
        .eq('blog_id', blogId);

      // Insert new mappings
      if (tag_ids.length > 0) {
        const tagMappings = tag_ids.map((tag_id: string) => ({
          blog_id: blogId,
          tag_id
        }));

        await supabase
          .from('blog_tag_mapping')
          .insert(tagMappings);
      }
    }

    // Update images if provided
    if (image_urls !== undefined) {
      // Delete existing images
      await supabase
        .from('blog_images')
        .delete()
        .eq('blog_id', blogId);

      // Insert new images
      if (image_urls.length > 0) {
        const images = image_urls.map((item: any) => ({
          blog_id: blogId,
          image_url: typeof item === 'string' ? item : item.url,
          caption: typeof item === 'object' ? item.caption : null
        }));

        await supabase
          .from('blog_images')
          .insert(images);
      }
    }

    // Fetch complete updated blog
    const { data: completeBlog, error: fetchError2 } = await supabase
      .from('blogs')
      .select(`
        *,
        category:blog_categories(*),
        author:users_login!author_id(id, full_name, email),
        tags:blog_tag_mapping(
          tag:blog_tags(*)
        ),
        images:blog_images(*)
      `)
      .eq('id', blogId)
      .single();

    const transformedBlog = completeBlog ? {
      ...completeBlog,
      tags: completeBlog.tags?.map((t: any) => t.tag) || []
    } : updatedBlog;

    return NextResponse.json({ blog: transformedBlog });
  } catch (error: any) {
    console.error('Blog PUT error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function DELETE(
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
      .select('id, role_id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    if (profileError || !userProfile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    const roleCode = (userProfile.roles as any)?.role_code;
    const blogId = params.id;

    // Only DIGITAL_MARKETING and SUPER_ADMIN can delete blogs
    if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only Digital Marketing and Super Admin can delete blogs' }, { status: 403 });
    }

    // Get existing blog
    const { data: existingBlog, error: fetchError } = await supabase
      .from('blogs')
      .select('id')
      .eq('id', blogId)
      .single();

    if (fetchError || !existingBlog) {
      return NextResponse.json({ error: 'Blog not found' }, { status: 404 });
    }

    // Delete blog (CASCADE will handle related records)
    const { error: deleteError } = await supabase
      .from('blogs')
      .delete()
      .eq('id', blogId);

    if (deleteError) {
      console.error('Blog delete error:', deleteError);
      return NextResponse.json({ error: 'Failed to delete blog', details: deleteError.message }, { status: 500 });
    }

    return NextResponse.json({ message: 'Blog deleted successfully' });
  } catch (error: any) {
    console.error('Blog DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
