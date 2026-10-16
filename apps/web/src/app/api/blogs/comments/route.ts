import { NextRequest, NextResponse } from 'next/server';
import { createClient as createAnonClient } from '@supabase/supabase-js';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const ADMIN_ROLES = new Set(['DIGITAL_MARKETING', 'SUPER_ADMIN']);

function getAnonClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseAnonKey) return { supabase: null as any, error: 'Supabase configuration missing' };
  return { supabase: createAnonClient(supabaseUrl, supabaseAnonKey), error: null as any };
}

function cleanStr(v: unknown, max: number) {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

function cleanComment(v: unknown, max: number) {
  return String(v ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
    .slice(0, max);
}

function commentIds(body: any, single?: string) {
  const raw = Array.isArray(body?.comment_ids) ? body.comment_ids : [];
  const ids = raw.map((id: unknown) => cleanStr(id, 80)).filter(Boolean);
  if (single) ids.push(single);
  return [...new Set(ids)].slice(0, 200);
}

async function getActor(_req: NextRequest) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('users_login')
      .select('id, full_name, email, roles!inner(role_code)')
      .eq('id', user.id)
      .maybeSingle();
    const roleCode = (profile?.roles as { role_code?: string } | null)?.role_code || '';
    return {
      supabase,
      isAdmin: ADMIN_ROLES.has(roleCode),
      fullName: String((profile as { full_name?: string } | null)?.full_name || '').trim(),
      email: String((profile as { email?: string } | null)?.email || '').trim(),
    };
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  try {
    const manage = req.nextUrl.searchParams.get('manage') === '1';
    if (manage) {
      const actor = await getActor(req);
      if (!actor?.isAdmin) {
        return NextResponse.json({ error: actor ? 'Forbidden' : 'Unauthorized' }, { status: actor ? 403 : 401 });
      }

      const statusParam = cleanStr(req.nextUrl.searchParams.get('status'), 20);
      let query = actor.supabase
        .from('blog_comments')
        .select('id, blog_id, user_name, user_email, comment, parent_comment_id, status, created_at')
        .order('created_at', { ascending: false })
        .limit(500);

      if (statusParam === '0' || statusParam === '1') {
        query = query.eq('status', Number(statusParam));
      }

      const [listRes, totalRes, pendingRes, approvedRes] = await Promise.all([
        query,
        actor.supabase.from('blog_comments').select('*', { count: 'exact', head: true }),
        actor.supabase.from('blog_comments').select('*', { count: 'exact', head: true }).eq('status', 0),
        actor.supabase.from('blog_comments').select('*', { count: 'exact', head: true }).eq('status', 1),
      ]);

      if (listRes.error) {
        return NextResponse.json({ error: 'Failed to fetch comments', details: listRes.error.message }, { status: 500 });
      }

      const rows = listRes.data || [];
      const blogIds = [...new Set(rows.map((row: { blog_id?: string }) => row.blog_id).filter(Boolean))];
      const blogsById = new Map<string, { id: string; title: string; slug: string }>();
      if (blogIds.length) {
        const { data: blogs } = await actor.supabase.from('blogs').select('id, title, slug').in('id', blogIds);
        for (const blog of blogs || []) {
          blogsById.set(blog.id, blog);
        }
      }

      return NextResponse.json({
        comments: rows.map((row: { blog_id: string }) => ({
          ...row,
          blog: blogsById.get(row.blog_id) || null,
        })),
        counts: {
          total: totalRes.count || 0,
          pending: pendingRes.count || 0,
          approved: approvedRes.count || 0,
        },
      });
    }

    const { supabase, error } = getAnonClient();
    if (!supabase) return NextResponse.json({ error }, { status: 500 });

    const blogId = cleanStr(req.nextUrl.searchParams.get('blog_id'), 80);
    if (!blogId) return NextResponse.json({ error: 'blog_id is required' }, { status: 400 });

    const { data, error: qErr } = await supabase
      .from('blog_comments')
      .select('id, blog_id, user_name, user_email, comment, parent_comment_id, status, created_at')
      .eq('blog_id', blogId)
      .eq('status', 1)
      .order('created_at', { ascending: true });

    if (qErr) return NextResponse.json({ error: 'Failed to fetch comments', details: qErr.message }, { status: 500 });
    return NextResponse.json({ comments: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const blog_id = cleanStr(body?.blog_id, 80);
    const user_name = cleanStr(body?.user_name, 150);
    const user_email = cleanStr(body?.user_email, 200);
    const comment = cleanComment(body?.comment, 5000);
    const parent_comment_id = cleanStr(body?.parent_comment_id, 80) || null;

    if (body?.as_admin) {
      const actor = await getActor(req);
      if (!actor?.isAdmin) {
        return NextResponse.json({ error: actor ? 'Forbidden' : 'Unauthorized' }, { status: actor ? 403 : 401 });
      }
      if (!blog_id) return NextResponse.json({ error: 'blog_id is required' }, { status: 400 });
      if (!parent_comment_id) return NextResponse.json({ error: 'parent_comment_id is required' }, { status: 400 });
      if (!comment) return NextResponse.json({ error: 'comment is required' }, { status: 400 });

      const { data: parent, error: parentErr } = await actor.supabase
        .from('blog_comments')
        .select('id, blog_id, parent_comment_id, status')
        .eq('id', parent_comment_id)
        .maybeSingle();
      if (parentErr) return NextResponse.json({ error: 'Failed to load comment', details: parentErr.message }, { status: 500 });
      if (!parent || parent.blog_id !== blog_id) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

      const rootId = parent.parent_comment_id || parent.id;
      const { supabaseAdmin } = getSupabaseAdmin();
      const writer = supabaseAdmin || actor.supabase;

      const { data, error: insErr } = await writer
        .from('blog_comments')
        .insert({
          blog_id,
          user_name: actor.fullName || 'MyFNG',
          user_email: actor.email || null,
          comment,
          parent_comment_id: rootId,
          status: 1,
        })
        .select('id, status, parent_comment_id')
        .single();

      if (insErr) return NextResponse.json({ error: 'Failed to post reply', details: insErr.message }, { status: 500 });

      if (Number(parent.status) !== 1) {
        await writer.from('blog_comments').update({ status: 1 }).eq('id', parent.id);
        if (parent.parent_comment_id) {
          await writer.from('blog_comments').update({ status: 1 }).eq('id', parent.parent_comment_id);
        }
      }

      return NextResponse.json({ success: true, pending: false, comment: data }, { status: 201 });
    }

    const { supabase, error } = getAnonClient();
    if (!supabase) return NextResponse.json({ error }, { status: 500 });

    if (!blog_id) return NextResponse.json({ error: 'blog_id is required' }, { status: 400 });
    if (!comment) return NextResponse.json({ error: 'comment is required' }, { status: 400 });
    if (user_email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user_email)) {
      return NextResponse.json({ error: 'invalid email' }, { status: 400 });
    }

    const { data, error: insErr } = await supabase
      .from('blog_comments')
      .insert({
        blog_id,
        user_name: user_name || null,
        user_email: user_email || null,
        comment,
        parent_comment_id,
        status: 0,
      })
      .select('id, status')
      .single();

    if (insErr) return NextResponse.json({ error: 'Failed to create comment', details: insErr.message }, { status: 500 });
    return NextResponse.json(
      {
        success: true,
        pending: true,
        comment: data,
        message: 'Comment submitted. It will appear after approval.',
      },
      { status: 201 },
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const actor = await getActor(req);
    if (!actor?.isAdmin) {
      return NextResponse.json({ error: actor ? 'Forbidden' : 'Unauthorized' }, { status: actor ? 403 : 401 });
    }

    const body = await req.json().catch(() => ({}));
    const ids = commentIds(body, cleanStr(body?.comment_id, 80));
    if (!ids.length) return NextResponse.json({ error: 'comment_id is required' }, { status: 400 });

    const hasComment = typeof body?.comment === 'string';
    if (hasComment) {
      if (ids.length !== 1) return NextResponse.json({ error: 'Edit one comment at a time' }, { status: 400 });
      const commentText = cleanComment(body.comment, 5000);
      if (!commentText) return NextResponse.json({ error: 'comment is required' }, { status: 400 });
      const patch: { comment: string; status?: number } = { comment: commentText };
      if (body?.status === 0 || body?.status === 1 || body?.status === '0' || body?.status === '1') {
        patch.status = Number(body.status);
      }
      const { data, error } = await actor.supabase
        .from('blog_comments')
        .update(patch)
        .eq('id', ids[0])
        .select('id, comment, status')
        .maybeSingle();
      if (error) return NextResponse.json({ error: 'Failed to update comment', details: error.message }, { status: 500 });
      if (!data) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
      return NextResponse.json({ success: true, comment: data });
    }

    const status = Number(body?.status);
    if (status !== 0 && status !== 1) {
      return NextResponse.json({ error: 'status must be 0 (pending) or 1 (approved)' }, { status: 400 });
    }

    const { data, error } = await actor.supabase
      .from('blog_comments')
      .update({ status })
      .in('id', ids)
      .select('id, status');

    if (error) return NextResponse.json({ error: 'Failed to update comment', details: error.message }, { status: 500 });
    if (!data?.length) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });
    return NextResponse.json({ success: true, updated: data.length, comments: data });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const blog_id = cleanStr(body?.blog_id, 80);
    const comment_id = cleanStr(body?.comment_id, 80);
    const ids = commentIds(body, comment_id);
    if (!ids.length) return NextResponse.json({ error: 'comment_id is required' }, { status: 400 });

    const actor = await getActor(req);
    if (actor?.isAdmin) {
      const { error: deleteErr } = await actor.supabase.from('blog_comments').delete().in('id', ids);
      if (deleteErr) return NextResponse.json({ error: 'Failed to delete comment', details: deleteErr.message }, { status: 500 });
      return NextResponse.json({ success: true, deleted: ids.length }, { status: 200 });
    }

    if (ids.length !== 1) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { supabase, error } = getAnonClient();
    if (!supabase) return NextResponse.json({ error }, { status: 500 });

    const user_name = cleanStr(body?.user_name, 150);
    const user_email = cleanStr(body?.user_email, 200).toLowerCase();
    if (!blog_id) return NextResponse.json({ error: 'blog_id is required' }, { status: 400 });

    const { data: existing, error: existingErr } = await supabase
      .from('blog_comments')
      .select('id, blog_id, user_name, user_email')
      .eq('id', comment_id)
      .eq('blog_id', blog_id)
      .maybeSingle();

    if (existingErr) {
      return NextResponse.json({ error: 'Failed to verify comment ownership', details: existingErr.message }, { status: 500 });
    }
    if (!existing) return NextResponse.json({ error: 'Comment not found' }, { status: 404 });

    const existingEmail = String(existing.user_email || '').trim().toLowerCase();
    const existingName = cleanStr(existing.user_name, 150);
    const emailMatches = Boolean(existingEmail && user_email && existingEmail === user_email);
    const nameMatches = !existingEmail && Boolean(existingName && user_name && existingName === user_name);

    if (!emailMatches && !nameMatches) {
      return NextResponse.json(
        { error: existingEmail ? 'Enter same email used while posting to delete this comment' : 'Enter same name used while posting to delete this comment' },
        { status: 403 },
      );
    }

    const { error: childDeleteErr } = await supabase
      .from('blog_comments')
      .delete()
      .eq('blog_id', blog_id)
      .eq('parent_comment_id', comment_id);
    if (childDeleteErr) {
      return NextResponse.json({ error: 'Failed to delete replies', details: childDeleteErr.message }, { status: 500 });
    }

    const { error: deleteErr } = await supabase
      .from('blog_comments')
      .delete()
      .eq('id', comment_id)
      .eq('blog_id', blog_id);

    if (deleteErr) return NextResponse.json({ error: 'Failed to delete comment', details: deleteErr.message }, { status: 500 });
    return NextResponse.json({ success: true }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
