/**
 * Blog Category Detail API Routes
 * GET /api/blogs/categories/[id] - Get category by ID
 * PUT /api/blogs/categories/[id] - Update category
 * DELETE /api/blogs/categories/[id] - Soft-delete category (status=0)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

function isAllowedRole(roleCode: unknown) {
  return roleCode === 'DIGITAL_MARKETING' || roleCode === 'SUPER_ADMIN';
}

async function requireManagerRole(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return { ok: false as const, res: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();

  if (profileError || !userProfile) {
    return { ok: false as const, res: NextResponse.json({ error: 'User profile not found' }, { status: 404 }) };
  }

  const roleCode = (userProfile.roles as any)?.role_code;
  if (!isAllowedRole(roleCode)) {
    return { ok: false as const, res: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return { ok: true as const };
}

export async function GET(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await paramsPromise;
    const auth = await requireManagerRole(supabase);
    if (!auth.ok) return auth.res;

    const { data: category, error } = await supabase
      .from('blog_categories')
      .select('*')
      .eq('id', params.id)
      .single();

    if (error || !category) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    return NextResponse.json({ category });
  } catch (error: any) {
    console.error('Category GET error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function PUT(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await paramsPromise;
    const auth = await requireManagerRole(supabase);
    if (!auth.ok) return auth.res;

    const body = await request.json();
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    const slug = typeof body?.slug === 'string' ? body.slug.trim() : '';
    const description = body?.description === null ? null : (typeof body?.description === 'string' ? body.description : undefined);
    const status = body?.status === null || body?.status === undefined ? undefined : Number(body.status);

    if (!name || !slug) {
      return NextResponse.json({ error: 'Name and slug are required' }, { status: 400 });
    }

    // Ensure category exists
    const { data: existing, error: fetchError } = await supabase
      .from('blog_categories')
      .select('id, slug')
      .eq('id', params.id)
      .single();

    if (fetchError || !existing) {
      return NextResponse.json({ error: 'Category not found' }, { status: 404 });
    }

    // Check slug uniqueness (excluding current)
    if (slug && slug !== existing.slug) {
      const { data: slugExists } = await supabase
        .from('blog_categories')
        .select('id')
        .eq('slug', slug)
        .neq('id', params.id)
        .single();

      if (slugExists) {
        return NextResponse.json({ error: 'Category with this slug already exists' }, { status: 400 });
      }
    }

    const updateData: any = {
      name,
      slug,
      updated_at: new Date().toISOString(),
    };
    if (description !== undefined) updateData.description = description;
    if (status !== undefined && !Number.isNaN(status)) updateData.status = status;

    const { data: category, error: updateError } = await supabase
      .from('blog_categories')
      .update(updateData)
      .eq('id', params.id)
      .select()
      .single();

    if (updateError) {
      console.error('Category update error:', updateError);
      return NextResponse.json({ error: 'Failed to update category', details: updateError.message }, { status: 500 });
    }

    return NextResponse.json({ category });
  } catch (error: any) {
    console.error('Category PUT error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params: paramsPromise }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const params = await paramsPromise;
    const auth = await requireManagerRole(supabase);
    if (!auth.ok) return auth.res;

    // Soft delete (status=0) to avoid breaking existing blog relations
    const { data: category, error } = await supabase
      .from('blog_categories')
      .update({ status: 0, updated_at: new Date().toISOString() })
      .eq('id', params.id)
      .select()
      .single();

    if (error) {
      console.error('Category delete error:', error);
      return NextResponse.json({ error: 'Failed to delete category', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ category, message: 'Category deactivated' });
  } catch (error: any) {
    console.error('Category DELETE error:', error);
    return NextResponse.json({ error: 'Internal server error', details: error.message }, { status: 500 });
  }
}

