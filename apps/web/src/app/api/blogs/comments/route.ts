import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

function getClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
  if (!supabaseUrl || !supabaseAnonKey) return { supabase: null as any, error: 'Supabase configuration missing' };
  return { supabase: createClient(supabaseUrl, supabaseAnonKey), error: null as any };
}

function cleanStr(v: unknown, max: number) {
  return String(v ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

export async function GET(req: NextRequest) {
  try {
    const { supabase, error } = getClient();
    if (!supabase) return NextResponse.json({ error }, { status: 500 });

    const blogId = cleanStr(req.nextUrl.searchParams.get('blog_id'), 80);
    if (!blogId) return NextResponse.json({ error: 'blog_id is required' }, { status: 400 });

    const { data, error: qErr } = await supabase
      .from('blog_comments')
      .select('id, blog_id, user_name, user_email, comment, parent_comment_id, status, created_at')
      .eq('blog_id', blogId)
      .order('created_at', { ascending: true });

    if (qErr) return NextResponse.json({ error: 'Failed to fetch comments', details: qErr.message }, { status: 500 });
    return NextResponse.json({ comments: data || [] }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { supabase, error } = getClient();
    if (!supabase) return NextResponse.json({ error }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const blog_id = cleanStr(body?.blog_id, 80);
    const user_name = cleanStr(body?.user_name, 150);
    const user_email = cleanStr(body?.user_email, 200);
    const comment = cleanStr(body?.comment, 5000);
    const parent_comment_id = cleanStr(body?.parent_comment_id, 80) || null;

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
      })
      .select('id, blog_id, user_name, user_email, comment, parent_comment_id, status, created_at')
      .single();

    if (insErr) return NextResponse.json({ error: 'Failed to create comment', details: insErr.message }, { status: 500 });
    return NextResponse.json({ success: true, comment: data }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { supabase, error } = getClient();
    if (!supabase) return NextResponse.json({ error }, { status: 500 });

    const body = await req.json().catch(() => ({}));
    const blog_id = cleanStr(body?.blog_id, 80);
    const comment_id = cleanStr(body?.comment_id, 80);
    const user_name = cleanStr(body?.user_name, 150);
    const user_email = cleanStr(body?.user_email, 200).toLowerCase();

    if (!blog_id) return NextResponse.json({ error: 'blog_id is required' }, { status: 400 });
    if (!comment_id) return NextResponse.json({ error: 'comment_id is required' }, { status: 400 });

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
        { status: 403 }
      );
    }

    // Delete replies first, then parent comment.
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

