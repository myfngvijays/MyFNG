/**
 * Blog Detail API Routes
 * GET /api/blogs/[id] - Get blog by ID or slug
 * PUT /api/blogs/[id] - Update blog
 * DELETE /api/blogs/[id] - Delete blog
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateBlogImageName } from '@/lib/blog/imageNaming';
import { collectHeadingWordWarnings, computeReadTimeFromHtml, countWords, validateAllImgHaveAlt } from '@/lib/blog/text';
import { notifyRoleCodesGlobal } from '@/lib/notifications';
import { isPuneOrPcmcCity, resolveLocalAreas } from '@/lib/blog/localSeo';
import { resolveCityGeoAndLocalities } from '@/lib/blog/googlePlaces';

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
        categories:blog_category_mapping(
          is_primary,
          category:blog_categories(*)
        ),
        author:users_login!author_id(id, full_name, email),
        tags:blog_tag_mapping(
          tag:blog_tags(*)
        ),
        images:blog_images(*),
        faqs:blog_faqs(*)
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
      tags: blog.tags?.map((t: any) => t.tag) || [],
      categories: (blog as any)?.categories?.map((c: any) => c?.category).filter(Boolean) || [],
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
    const prevStatus = String(existingBlog.status || '');

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
      category_ids,
      read_time,
      featured_image,
      status,
      is_featured,
      is_premium,
      tag_ids,
      image_urls
    } = body;

    const faqs = Array.isArray(body?.faqs) ? body.faqs : (Array.isArray((seo_data || {})?.faqs) ? (seo_data as any).faqs : undefined);

    // Normalize optional UUID/text fields (avoid sending empty string to DB UUID columns)
    const normalizedCategoryId =
      typeof category_id === 'string' ? (category_id.trim() ? category_id.trim() : null) : (category_id ?? null);

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

    // Enforce ALT tags on all images inside the HTML body (if content is being updated).
    if (content !== undefined) {
      const altCheck = validateAllImgHaveAlt(String(content), 125);
      if (!altCheck.ok) return NextResponse.json({ error: altCheck.error }, { status: 400 });
    }

    // Featured image ALT must be provided if featured_image is present or being set.
    if (featured_image !== undefined) {
      const effectiveSeo = seo_data !== undefined ? seo_data : existingBlog.seo_data;
      const featuredAlt = String((effectiveSeo || {})?.featured_image_alt || '').trim();
      if (featured_image && !featuredAlt) {
        return NextResponse.json({ error: 'Featured image ALT text is required' }, { status: 400 });
      }
      if (featuredAlt && featuredAlt.length > 125) {
        return NextResponse.json({ error: 'Featured image ALT is too long (max 125 chars)' }, { status: 400 });
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
        const alt_text = typeof item === 'object' ? String(item?.alt_text ?? item?.alt ?? '').trim() : '';
        if (!url) continue;
        if (!alt_text) {
          return NextResponse.json({ error: 'Every uploaded image must have an ALT tag (alt_text is missing).' }, { status: 400 });
        }
        if (alt_text.length > 125) {
          return NextResponse.json({ error: 'ALT tag too long (max 125 chars).' }, { status: 400 });
        }
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
    if (content !== undefined) {
      updateData.content = content;
      // Auto-calc reading time as per spec (100 words/minute).
      const { minutes } = computeReadTimeFromHtml(String(content));
      updateData.read_time = minutes;
    }
    if (seo_data !== undefined) updateData.seo_data = seo_data;
    if (category_id !== undefined) updateData.category_id = normalizedCategoryId;
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

    // If we're transitioning to published, run publish-time Local SEO enrichment (best-effort)
    try {
      if (status === 'published' && existingBlog.status !== 'published' && (roleCode === 'DIGITAL_MARKETING' || roleCode === 'SUPER_ADMIN')) {
        const baseSeo = (seo_data !== undefined ? seo_data : (existingBlog.seo_data || {})) as any;
        let nextSeo = { ...baseSeo };

        const city = String(nextSeo?.local_city || '').trim();
        const isPune = isPuneOrPcmcCity(city);
        const key = String(process.env.GOOGLE_MAPS_API_KEY || '').trim();

        if (!isPune && city && key) {
          const resolved = await resolveCityGeoAndLocalities({ city, country: 'IN', key });
          if (resolved.geo_lat != null && resolved.geo_lng != null) {
            nextSeo = {
              ...nextSeo,
              geo_region: resolved.geo_region || nextSeo.geo_region,
              geo_placename: resolved.geo_placename || nextSeo.geo_placename,
              geo_lat: resolved.geo_lat,
              geo_lng: resolved.geo_lng,
              geo_position: `${resolved.geo_lat};${resolved.geo_lng}`,
              icbm: `${resolved.geo_lat},${resolved.geo_lng}`,
              local_areas_resolved: (resolved.local_areas_resolved || []).slice(0, 60),
              local_areas_resolved_at: new Date().toISOString(),
            };
          }
        }

        const areas = resolveLocalAreas(nextSeo);
        if (areas.length) nextSeo = { ...nextSeo, local_areas_render: areas.slice(0, 60) };

        updateData.seo_data = nextSeo;
      }
    } catch (e) {
      console.warn('Local SEO enrichment failed (non-blocking):', e);
    }

    // Update blog
    const { data: updatedBlog, error: updateError } = await supabase
      .from('blogs')
      .update(updateData)
      .eq('id', blogId)
      .select()
      .single();

    if (updateError) {
      console.error('Blog update error:', updateError);
      const msg = String(updateError.message || '');
      // Common: local DB still has blogs_status_check that doesn't include 'pending_review'
      if (msg.toLowerCase().includes('blogs_status_check') && String(updateData?.status) === 'pending_review') {
        return NextResponse.json(
          {
            error: `Your database schema doesn't allow status "pending_review" yet.`,
            details:
              'Run `database/93_blog_marketing_requirements.sql` (Step 2: Blogs status) to update the blogs_status_check constraint.',
          },
          { status: 400 }
        );
      }
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
        const images = image_urls
          .map((item: any) => {
            const url = typeof item === 'string' ? item : item?.url;
            if (!url) return null;
            return {
              blog_id: blogId,
              image_url: url,
              caption: typeof item === 'object' ? (item?.caption ?? null) : null,
              alt_text: typeof item === 'object' ? String(item?.alt_text ?? item?.alt ?? '').trim() : '',
            };
          })
          .filter(Boolean) as any[];

        const invalid = images.find((x: any) => !x.alt_text || String(x.alt_text).trim().length === 0);
        if (invalid) return NextResponse.json({ error: 'Every uploaded image must have an ALT tag.' }, { status: 400 });

        const imageErr = images.length ? (await supabase.from('blog_images').insert(images)).error : null;
        if (imageErr) return NextResponse.json({ error: 'Failed to save blog images', details: imageErr.message }, { status: 500 });
      }
    }

    // Multi-category support (best-effort)
    if (category_ids !== undefined) {
      // reset mappings
      const del = await supabase.from('blog_category_mapping').delete().eq('blog_id', blogId);
      if (del.error) return NextResponse.json({ error: 'Failed to update categories', details: del.error.message }, { status: 500 });

      if (Array.isArray(category_ids) && category_ids.length) {
        const ids = category_ids.filter((x: any) => typeof x === 'string' && x.trim()).map((x: string) => x.trim());
        if (ids.length) {
          const mappings = ids.map((cid: string, idx: number) => ({ blog_id: blogId, category_id: cid, is_primary: idx === 0 }));
          const ins = await supabase.from('blog_category_mapping').insert(mappings as any);
          if (ins.error) return NextResponse.json({ error: 'Failed to update categories', details: ins.error.message }, { status: 500 });

          // Keep single category_id in sync
          updateData.category_id = ids[0];
        }
      }
    }

    // Update FAQs if provided
    if (faqs !== undefined) {
      const delFaq = await supabase.from('blog_faqs').delete().eq('blog_id', blogId);
      if (delFaq.error) return NextResponse.json({ error: 'Failed to update FAQs', details: delFaq.error.message }, { status: 500 });

      const faqRows = (Array.isArray(faqs) ? faqs : [])
        .map((f: any, idx: number) => ({
          blog_id: blogId,
          question: String(f?.question || '').trim(),
          answer: String(f?.answer || '').trim(),
          sort_order: typeof f?.sort_order === 'number' ? f.sort_order : idx,
        }))
        .filter((f: any) => f.question && f.answer);

      if (faqRows.length) {
        const insFaq = await supabase.from('blog_faqs').insert(faqRows as any);
        if (insFaq.error) return NextResponse.json({ error: 'Failed to update FAQs', details: insFaq.error.message }, { status: 500 });
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

    // Soft SEO warnings (returned, but do not block save).
    const warnings: string[] = [];
    const effectiveTitle = String(title ?? existingBlog.title ?? '').trim();
    const titleLen = effectiveTitle.length;
    if (titleLen && (titleLen < 50 || titleLen > 60)) warnings.push('Blog Title recommended length: 50–60 characters.');
    const effectiveSeo = seo_data !== undefined ? seo_data : existingBlog.seo_data;
    const metaDescLen = String((effectiveSeo || {})?.meta_description || '').trim().length;
    if (metaDescLen && (metaDescLen < 120 || metaDescLen > 155)) warnings.push('Meta Description recommended length: 120–155 characters.');
    const summaryWords = countWords(String(excerpt ?? existingBlog.excerpt ?? ''));
    if (summaryWords && summaryWords > 60) warnings.push('AI Summary (Takeaways) recommended max: 60 words.');
    const tagCount = Array.isArray(tag_ids) ? tag_ids.length : Array.isArray(existingBlog?.tag_ids) ? existingBlog.tag_ids.length : 0;
    if (tagCount && (tagCount < 5 || tagCount > 10)) warnings.push('Tags recommended: 5–10 tags total per post.');
    const effectiveContent = String(content ?? existingBlog.content ?? '');
    const { words } = computeReadTimeFromHtml(effectiveContent);
    if (words && words < 800) warnings.push('Word Count recommended minimum: 800+ words.');
    warnings.push(...collectHeadingWordWarnings(effectiveContent, 10));

    const transformedBlog = completeBlog ? {
      ...completeBlog,
      tags: completeBlog.tags?.map((t: any) => t.tag) || []
    } : updatedBlog;

    // Workflow: when Digital Author sends blog for review → notify Digital Marketing
    try {
      const nextStatus = String(updateData?.status ?? prevStatus);
      if (prevStatus !== 'pending_review' && nextStatus === 'pending_review' && roleCode === 'DIGITAL_AUTHOR') {
        await notifyRoleCodesGlobal({
          roleCodes: ['DIGITAL_MARKETING'],
          type: 'SYSTEM_ALERT',
          title: 'Blog pending review',
          message: `${String(userProfile.full_name || 'Author')} sent a blog for review: ${String(existingBlog.title || transformedBlog?.title || '').trim()}`,
          priority: 'HIGH',
          actionUrl: `/dashboard/digital_marketing/blogs/${blogId}/edit`,
          metadata: { blog_id: blogId, status: 'pending_review' },
        });
      }
    } catch (e) {
      console.warn('Failed to notify Digital Marketing (non-blocking):', e);
    }

    return NextResponse.json({ blog: transformedBlog, warnings });
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
