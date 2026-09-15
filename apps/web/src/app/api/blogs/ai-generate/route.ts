import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateAiBlogDraft } from '@/lib/blog/generateAiDraft';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('users_login')
      .select('id, roles!inner(role_code)')
      .eq('id', user.id)
      .maybeSingle();
    const roleCode = (profile?.roles as any)?.role_code as string | undefined;
    if (!roleCode) return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    if (roleCode !== 'DIGITAL_MARKETING' && roleCode !== 'SUPER_ADMIN' && roleCode !== 'DIGITAL_AUTHOR') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });
    }

    const body = await request.json().catch(() => ({}));
    const topic = String(body?.topic || '').trim();
    const focusKeyword = String(body?.focusKeyword || '').trim();
    const city = String(body?.city || '').trim();
    const intent = String(body?.intent || '').trim() || 'Informational';
    const tone = String(body?.tone || '').trim() || 'Professional';
    const wordCount = Math.max(400, Math.min(2500, Number(body?.wordCount || 900) || 900));

    if (!topic || topic.length < 6) {
      return NextResponse.json({ error: 'Topic is required (min 6 chars)' }, { status: 400 });
    }

    const draft = await generateAiBlogDraft({
      supabase,
      topic,
      focusKeyword,
      city,
      intent,
      tone,
      wordCount,
    });

    return NextResponse.json({ success: true, draft }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}
