/**
 * Blog Publish API Route
 * POST /api/blogs/[id]/publish - Publish a blog
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

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

    // Validate blog before publishing
    if (!existingBlog.title || !existingBlog.content || !existingBlog.featured_image) {
      return NextResponse.json({ 
        error: 'Cannot publish: Blog must have title, content, and featured image' 
      }, { status: 400 });
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
        author:users_login!author_id(id, full_name, email),
        tags:blog_tag_mapping(
          tag:blog_tags(*)
        )
      `)
      .single();

    if (publishError) {
      console.error('Blog publish error:', publishError);
      return NextResponse.json({ error: 'Failed to publish blog', details: publishError.message }, { status: 500 });
    }

    const transformedBlog = publishedBlog ? {
      ...publishedBlog,
      tags: publishedBlog.tags?.map((t: any) => t.tag) || []
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
