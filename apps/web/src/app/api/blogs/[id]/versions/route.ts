/**
 * Blog Versions API Routes
 * GET /api/blogs/[id]/versions - Get version history for a blog
 * POST /api/blogs/[id]/versions - Restore a specific version
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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

    // Check permissions - only DIGITAL_MARKETING and SUPER_ADMIN can view versions
    if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only Digital Marketing can view versions' }, { status: 403 });
    }

    // Get versions
    const { data: versions, error } = await supabase
      .from('blog_versions')
      .select(`
        *,
        updated_by_user:users_login!updated_by(id, full_name)
      `)
      .eq('blog_id', blogId)
      .order('version_number', { ascending: false });

    if (error) {
      console.error('Versions fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch versions', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ versions: versions || [] });
  } catch (error: any) {
    console.error('Versions GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  const params = await paramsPromise;
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

    // Only DIGITAL_MARKETING and SUPER_ADMIN can restore versions
    if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden: Only Digital Marketing can restore versions' }, { status: 403 });
    }

    const body = await request.json();
    const { version_id } = body;

    if (!version_id) {
      return NextResponse.json({ error: 'version_id is required' }, { status: 400 });
    }

    // Get the version to restore
    const { data: version, error: versionError } = await supabase
      .from('blog_versions')
      .select('*')
      .eq('id', version_id)
      .eq('blog_id', blogId)
      .single();

    if (versionError || !version) {
      return NextResponse.json({ error: 'Version not found' }, { status: 404 });
    }

    // Restore the version by updating the blog
    const { data: restoredBlog, error: restoreError } = await supabase
      .from('blogs')
      .update({
        title: version.old_title,
        content: version.old_content,
        seo_data: version.old_seo_data,
        updated_by: userProfile.id
      })
      .eq('id', blogId)
      .select()
      .single();

    if (restoreError) {
      console.error('Version restore error:', restoreError);
      return NextResponse.json({ error: 'Failed to restore version', details: restoreError.message }, { status: 500 });
    }

    return NextResponse.json({ 
      message: 'Version restored successfully',
      blog: restoredBlog 
    });
  } catch (error: any) {
    console.error('Version restore error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}
