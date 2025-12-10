/**
 * Public Blog API Route
 * GET /api/blogs/public - Get published blogs (no authentication required)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Create an anonymous Supabase client for public access
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Supabase configuration missing' },
        { status: 500 }
      );
    }
    
    const supabase = createClient(supabaseUrl, supabaseAnonKey);
    
    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const category_id = searchParams.get('category_id');
    const tag_id = searchParams.get('tag_id');
    const search = searchParams.get('search');
    const featured = searchParams.get('featured') === 'true';
    const page = parseInt(searchParams.get('page') || '1');
    const limit = Math.min(parseInt(searchParams.get('limit') || '20'), 100);
    const offset = (page - 1) * limit;

    // Build query - only published blogs, no authentication required
    let query = supabase
      .from('blogs')
      .select(`
        *,
        category:blog_categories(*),
        author:users_login!author_id(id, full_name, email),
        tags:blog_tag_mapping(
          tag:blog_tags(*)
        )
      `, { count: 'exact' })
      .eq('status', 'published'); // Only published blogs

    // Apply filters
    if (category_id) {
      query = query.eq('category_id', category_id);
    }
    
    if (featured) {
      query = query.eq('is_featured', true);
    }
    
    if (search) {
      query = query.or(`title.ilike.%${search}%,excerpt.ilike.%${search}%,content.ilike.%${search}%`);
    }

    // Ordering
    query = query.order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
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
      tags: blog.tags?.map((t: any) => t.tag).filter(Boolean) || []
    }));

    return NextResponse.json({
      blogs: transformedBlogs,
      pagination: {
        page,
        limit,
        total: count || 0,
        totalPages: Math.ceil((count || 0) / limit)
      }
    });
  } catch (error: any) {
    console.error('Error in public blog API:', error);
    return NextResponse.json(
      { error: 'Internal server error', details: error.message },
      { status: 500 }
    );
  }
}
