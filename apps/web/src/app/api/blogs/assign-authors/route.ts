import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { fetchDigitalAuthors, resolveBlogAuthorId } from '@/lib/blog/ownership';

export const dynamic = 'force-dynamic';

/**
 * Reassign blogs currently owned by Marketing/Admin (or null author) to a Digital Author.
 * POST /api/blogs/assign-authors { author_id?: string }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: userProfile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .single();

    const roleCode = (userProfile?.roles as { role_code?: string } | null)?.role_code;
    if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const targetAuthorId = await resolveBlogAuthorId(
      supabase,
      roleCode,
      userProfile!.id,
      body?.author_id,
    );

    const { data: marketingUsers } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .in('roles.role_code', ['DIGITAL_MARKETING', 'SUPER_ADMIN']);

    const marketingIds = new Set((marketingUsers || []).map((u) => String(u.id)));

    const { data: blogs, error: listError } = await supabase
      .from('blogs')
      .select('id, title, author_id');

    if (listError) {
      return NextResponse.json({ error: 'Failed to list blogs', details: listError.message }, { status: 500 });
    }

    const toReassign = (blogs || []).filter((b) => {
      const aid = b.author_id ? String(b.author_id) : '';
      if (aid === targetAuthorId) return false;
      if (!aid) return true;
      return marketingIds.has(aid);
    });

    if (!toReassign.length) {
      return NextResponse.json({ updated: 0, author_id: targetAuthorId, message: 'All blogs already assigned to author' });
    }

    const ids = toReassign.map((b) => b.id);
    const { error: updateError } = await supabase
      .from('blogs')
      .update({ author_id: targetAuthorId, updated_by: userProfile!.id })
      .in('id', ids);

    if (updateError) {
      return NextResponse.json({ error: 'Failed to reassign blogs', details: updateError.message }, { status: 500 });
    }

    const authors = await fetchDigitalAuthors(supabase);
    const authorName = authors.find((a) => a.id === targetAuthorId)?.full_name || 'Author';

    return NextResponse.json({
      updated: ids.length,
      author_id: targetAuthorId,
      author_name: authorName,
      message: `${ids.length} blog(s) assigned to ${authorName}`,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json({ error: 'Internal server error', details: message }, { status: 500 });
  }
}
