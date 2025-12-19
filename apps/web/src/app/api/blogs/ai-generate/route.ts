import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

function stripCodeFences(s: string) {
  const t = String(s || '').trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

function toSlug(title: string) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const SYSTEM_PROMPT = `
You are an expert automotive content writer for MyFNG (India).
Write helpful, accurate, non-duplicative blog drafts.

Return STRICT JSON ONLY with keys:
- title (string)
- excerpt (string, 40-60 words)
- content_html (string, valid HTML)
- seo (object): meta_title, meta_description (<=160 chars), keywords (comma-separated), og_title, og_description
- read_time (number, minutes)

Content rules:
- Use <h2> sections, <ul>/<ol> where helpful, and short paragraphs.
- Include a checklist section and pricing disclaimers (prices vary by model & inspection).
- If tone is "Hindi + English (Hinglish)", write Hinglish but keep headings in English.
- Don't invent exact prices; use ranges or "starts from" phrasing.
- No markdown fences. No extra keys. JSON must be parseable.
`.trim();

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

    const apiKey = process.env.OPENAI_API_KEY;
    const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
    if (!apiKey) return NextResponse.json({ error: 'OPENAI_API_KEY not set' }, { status: 500 });

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

    const userPayload = {
      topic,
      focusKeyword: focusKeyword || null,
      city: city || null,
      intent,
      tone,
      wordCount,
    };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.5,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(userPayload) },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json({ error: 'OpenAI request failed', details: errText }, { status: 500 });
    }

    const json = (await res.json()) as any;
    const content = json?.choices?.[0]?.message?.content;
    if (!content || typeof content !== 'string') {
      return NextResponse.json({ error: 'OpenAI returned empty response' }, { status: 500 });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(stripCodeFences(content));
    } catch {
      return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 500 });
    }

    const title = String(parsed?.title || '').trim();
    const excerpt = String(parsed?.excerpt || '').trim();
    const content_html = String(parsed?.content_html || '').trim();
    const seo = parsed?.seo || {};
    const read_time = Number(parsed?.read_time || 5) || 5;

    if (!title || !excerpt || !content_html) {
      return NextResponse.json({ error: 'AI response missing required fields' }, { status: 500 });
    }

    const draft = {
      title,
      slug: toSlug(title),
      excerpt,
      content_html,
      seo: {
        meta_title: String(seo?.meta_title || title).trim().slice(0, 120),
        meta_description: String(seo?.meta_description || excerpt).trim().slice(0, 160),
        keywords: String(seo?.keywords || focusKeyword || '').trim(),
        og_title: String(seo?.og_title || title).trim().slice(0, 120),
        og_description: String(seo?.og_description || excerpt).trim().slice(0, 200),
      },
      read_time: Math.max(1, Math.min(30, Math.round(read_time))),
    };

    return NextResponse.json({ success: true, draft }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}

