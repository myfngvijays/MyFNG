/**
 * Blog API Routes
 * GET /api/blogs - List all blogs with filters
 * POST /api/blogs - Create a new blog
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validateBlogImageName } from '@/lib/blog/imageNaming';
import { collectHeadingWordWarnings, computeReadTimeFromHtml, countWords, validateAllImgHaveAlt } from '@/lib/blog/text';
import { autoFillSeoFromSummary } from '@/lib/blog/seo';
import { isPuneOrPcmcCity, resolveLocalAreas } from '@/lib/blog/localSeo';
import { resolveCityGeoAndLocalities } from '@/lib/blog/googlePlaces';
import {
  normalizeBlogHtmlMedia,
  normalizeBlogMediaUrl,
  normalizeBlogRecordForResponse,
  normalizeBlogSeoData,
} from '@/lib/blog/normalizeBlogMedia';

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
      .select(
        `
        *,
        category:blog_categories(*),
        categories:blog_category_mapping(
          category_id,
          is_primary,
          category:blog_categories(*)
        ),
        author:users_login!author_id(id, full_name, email),
        tags:blog_tag_mapping(
          tag:blog_tags(*)
        )
      `,
        { count: 'exact' }
      );

    // Apply filters
    if (status) {
      query = query.eq('status', status);
    }
    
    // NOTE: Multi-category filtering is applied after fetch (via blog_category_mapping).
    
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
    if (category_id) {
      filteredBlogs = filteredBlogs.filter((blog: any) => {
        const primary = blog.category_id;
        const mapped = (blog.categories || []).map((c: any) => c?.category_id || c?.category?.id).filter(Boolean);
        return primary === category_id || mapped.includes(category_id);
      });
    }

    if (error) {
      console.error('Blog fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch blogs', details: error.message }, { status: 500 });
    }

    // Transform tags structure
    const transformedBlogs = filteredBlogs.map((blog: any) => ({
      ...blog,
      featured_image: blog.featured_image ? normalizeBlogMediaUrl(String(blog.featured_image)) : blog.featured_image,
      tags: blog.tags?.map((t: any) => t.tag) || [],
      categories: (blog.categories || []).map((c: any) => c?.category).filter(Boolean) || [],
    }));

    return NextResponse.json({
      blogs: transformedBlogs || [],
      pagination: {
        page,
        limit,
        total: tag_id || category_id ? filteredBlogs.length : (count || 0),
        totalPages: tag_id || category_id ? Math.ceil(filteredBlogs.length / limit) : Math.ceil((count || 0) / limit)
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
      category_ids,
      read_time,
      featured_image,
      status: requestedStatus = 'draft',
      is_featured: requestedIsFeatured = false,
      is_premium: requestedIsPremium = false,
      tag_ids = [],
      image_urls = []
    } = body;

    const faqs = Array.isArray(body?.faqs) ? body.faqs : (Array.isArray((seo_data || {})?.faqs) ? (seo_data as any).faqs : []);

    // Normalize optional UUID/text fields (avoid sending empty string to DB)
    const normalizedCategoryId =
      typeof category_id === 'string' ? (category_id.trim() ? category_id.trim() : null) : (category_id ?? null);
    const normalizedFeaturedImage =
      typeof featured_image === 'string'
        ? normalizeBlogMediaUrl(featured_image.trim() ? featured_image.trim() : null)
        : featured_image != null
          ? normalizeBlogMediaUrl(String(featured_image))
          : null;
    const normalizedExcerpt = typeof excerpt === 'string' ? (excerpt.trim() ? excerpt.trim() : null) : (excerpt ?? null);
    const normalizedContent = normalizeBlogHtmlMedia(String(content || ''));

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
    if (!title || !slug || !normalizedContent) {
      return NextResponse.json({ error: 'Title, slug, and content are required' }, { status: 400 });
    }

    // Enforce ALT tags on all images inside the HTML body.
    const altCheck = validateAllImgHaveAlt(normalizedContent, 125);
    if (!altCheck.ok) return NextResponse.json({ error: altCheck.error }, { status: 400 });

    // Featured image ALT must be provided (stored in seo_data.featured_image_alt).
    const featuredAlt = String((seo_data || {})?.featured_image_alt || '').trim();
    if (featured_image && !featuredAlt) {
      return NextResponse.json({ error: 'Featured image ALT text is required' }, { status: 400 });
    }
    if (featuredAlt && featuredAlt.length > 125) {
      return NextResponse.json({ error: 'Featured image ALT is too long (max 125 chars)' }, { status: 400 });
    }

    // SEO requirement: uploaded blog image filename must match slug.
    if (featured_image) {
      const err = validateBlogImageName(String(featured_image), String(slug));
      if (err) return NextResponse.json({ error: err }, { status: 400 });
    }
    if (Array.isArray(image_urls) && image_urls.length) {
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
        const err = validateBlogImageName(String(url), String(slug));
        if (err) return NextResponse.json({ error: err }, { status: 400 });
      }
    }

    // Auto-calc reading time as per spec (100 words/minute).
    const { words, minutes } = computeReadTimeFromHtml(normalizedContent);

    // Soft SEO warnings (returned, but do not block save).
    const warnings: string[] = [];
    const titleLen = String(title).trim().length;
    if (titleLen < 50 || titleLen > 60) warnings.push('Blog Title recommended length: 50–60 characters.');
    const metaDescLen = String((seo_data || {})?.meta_description || '').trim().length;
    if (metaDescLen && (metaDescLen < 120 || metaDescLen > 155)) warnings.push('Meta Description recommended length: 120–155 characters.');
    const summaryWords = countWords(String(excerpt || ''));
    if (summaryWords && summaryWords > 60) warnings.push('AI Summary (Takeaways) recommended max: 60 words.');
    const tagCount = Array.isArray(tag_ids) ? tag_ids.length : 0;
    if (tagCount && (tagCount < 5 || tagCount > 10)) warnings.push('Tags recommended: 5–10 tags total per post.');
    if (words && words < 800) warnings.push('Word Count recommended minimum: 800+ words.');
    warnings.push(...collectHeadingWordWarnings(normalizedContent, 10));

    // FAQ warning
    if (Array.isArray(faqs) && faqs.length && faqs.length < 5) warnings.push('FAQs recommended minimum: 5 (AI can generate).');

    // Check if slug already exists
    const { data: existingBlog } = await supabase
      .from('blogs')
      .select('id')
      .eq('slug', slug)
      .single();

    if (existingBlog) {
      return NextResponse.json({ error: 'Blog with this slug already exists' }, { status: 400 });
    }

    // Multi-category: pick primary
    const normalizedCategoryIds = Array.isArray(category_ids)
      ? category_ids.filter((x: any) => typeof x === 'string' && x.trim()).map((x: string) => x.trim())
      : [];
    const primaryCategoryId = normalizedCategoryIds[0] || normalizedCategoryId;

    // Server-side auto-fill: meta_description + keywords from AI Summary if empty.
    let finalSeoData: any = autoFillSeoFromSummary(excerpt, seo_data || {});

    // If creating as published (DM/SUPER only), enrich Local SEO (best-effort)
    try {
      if (finalStatus === 'published' && (roleCode === 'DIGITAL_MARKETING' || roleCode === 'SUPER_ADMIN')) {
        const city = String(finalSeoData?.local_city || '').trim();
        const isPune = isPuneOrPcmcCity(city);
        const key = String(process.env.GOOGLE_MAPS_API_KEY || '').trim();

        if (!isPune && city && key) {
          const resolved = await resolveCityGeoAndLocalities({ city, country: 'IN', key });
          if (resolved.geo_lat != null && resolved.geo_lng != null) {
            finalSeoData = {
              ...finalSeoData,
              geo_region: resolved.geo_region || finalSeoData.geo_region,
              geo_placename: resolved.geo_placename || finalSeoData.geo_placename,
              geo_lat: resolved.geo_lat,
              geo_lng: resolved.geo_lng,
              geo_position: `${resolved.geo_lat};${resolved.geo_lng}`,
              icbm: `${resolved.geo_lat},${resolved.geo_lng}`,
              local_areas_resolved: (resolved.local_areas_resolved || []).slice(0, 60),
              local_areas_resolved_at: new Date().toISOString(),
            };
          }
        }

        const areas = resolveLocalAreas(finalSeoData);
        if (areas.length) finalSeoData = { ...finalSeoData, local_areas_render: areas.slice(0, 60) };
      }
    } catch (e) {
      console.warn('Local SEO enrichment failed (non-blocking):', e);
    }

    finalSeoData = normalizeBlogSeoData(finalSeoData);

    // Create blog
    const { data: blog, error: blogError } = await supabase
      .from('blogs')
      .insert({
        title,
        slug,
        excerpt: normalizedExcerpt,
        content: normalizedContent,
        seo_data: finalSeoData,
        category_id: primaryCategoryId,
        author_id: userProfile.id,
        created_by: userProfile.id,
        updated_by: userProfile.id,
        read_time: minutes,
        featured_image: normalizedFeaturedImage,
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
      const images = image_urls
        .map((item: any) => {
          const url = typeof item === 'string' ? item : item?.url;
          if (!url) return null;
          return {
            blog_id: blog.id,
            image_url: url,
            caption: typeof item === 'object' ? (item?.caption ?? null) : null,
            alt_text: typeof item === 'object' ? String(item?.alt_text ?? item?.alt ?? '').trim() : '',
          };
        })
        .filter(Boolean) as any[];

      const invalid = images.find((x: any) => !x.alt_text || String(x.alt_text).trim().length === 0);
      if (invalid) return NextResponse.json({ error: 'Every uploaded image must have an ALT tag.' }, { status: 400 });

      let imageError: any = null;
      if (images.length) imageError = (await supabase.from('blog_images').insert(images)).error;

      if (imageError) {
        console.error('Image insertion error:', imageError);
        return NextResponse.json({ error: 'Failed to save blog images', details: imageError.message }, { status: 500 });
      }
    }

    // Multi-category support (best-effort, requires blog_category_mapping table)
    if (normalizedCategoryIds.length) {
      const mappings = normalizedCategoryIds.map((cid: string, idx: number) => ({
        blog_id: blog.id,
        category_id: cid,
        is_primary: idx === 0,
      }));
      const { error: mapErr } = await supabase.from('blog_category_mapping').insert(mappings as any);
      if (mapErr) return NextResponse.json({ error: 'Failed to save categories', details: mapErr.message }, { status: 500 });
    }

    // Save FAQs (editable, structured)
    if (Array.isArray(faqs) && faqs.length) {
      const faqRows = faqs
        .map((f: any, idx: number) => ({
          blog_id: blog.id,
          question: String(f?.question || '').trim(),
          answer: String(f?.answer || '').trim(),
          sort_order: typeof f?.sort_order === 'number' ? f.sort_order : idx,
        }))
        .filter((f: any) => f.question && f.answer);

      if (faqRows.length) {
        const { error: faqErr } = await supabase.from('blog_faqs').insert(faqRows as any);
        if (faqErr) return NextResponse.json({ error: 'Failed to save FAQs', details: faqErr.message }, { status: 500 });
      }
    }

    // Fetch complete blog with relations
    const { data: completeBlog, error: fetchError } = await supabase
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
      .eq('id', blog.id)
      .single();

    if (fetchError) {
      console.error('Blog fetch error:', fetchError);
    }

    const transformedBlog = completeBlog ? {
      ...completeBlog,
      tags: completeBlog.tags?.map((t: any) => t.tag) || [],
      categories: (completeBlog as any).categories?.map((c: any) => c?.category).filter(Boolean) || [],
    } : blog;

    return NextResponse.json({ blog: transformedBlog, warnings }, { status: 201 });
  } catch (error: any) {
    console.error('Blogs POST error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
