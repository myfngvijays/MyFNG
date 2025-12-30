import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `
You are a local SEO specialist for MyFNG (India).
Given a target location (area + city), generate local search keyword variations relevant to the blog topic.

Return STRICT JSON ONLY:
{
  "local_keywords": ["string"]
}

Rules:
- 8 to 15 items.
- Each item should be a realistic query phrase (2-6 words).
- Avoid duplicates. Avoid stuffing.
- No markdown fences. No extra keys.
`.trim();

function normalizeKeywords(input: any): string[] {
  const list = Array.isArray(input?.local_keywords) ? input.local_keywords : [];
  const cleaned = list
    .map((k: any) => String(k || '').trim())
    .filter(Boolean)
    .map((k: string) => k.replace(/\s+/g, ' ').trim());
  const out: string[] = [];
  const seen = new Set<string>();
  for (const k of cleaned) {
    const key = k.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(k);
    if (out.length >= 15) break;
  }
  return out;
}

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
    const location = String(body?.location || body?.area || '').trim();
    const title = String(body?.title || '').trim();
    const focusKeywords = String(body?.focusKeywords || body?.focusKeyword || '').trim();

    if (!location || location.length < 3) return NextResponse.json({ error: 'Location is required (e.g. "Vartak Nagar, Thane West")' }, { status: 400 });
    if (!title || title.length < 6) return NextResponse.json({ error: 'Title is required (min 6 chars)' }, { status: 400 });

    const payload = { location, title, focusKeywords: focusKeywords || null };

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content: JSON.stringify(payload) },
        ],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      return NextResponse.json({ error: 'OpenAI request failed', details: errText }, { status: 500 });
    }

    const json = (await res.json()) as any;
    const contentText = json?.choices?.[0]?.message?.content;
    if (!contentText || typeof contentText !== 'string') {
      return NextResponse.json({ error: 'OpenAI returned empty response' }, { status: 500 });
    }

    let parsed: any = null;
    try {
      parsed = JSON.parse(contentText);
    } catch {
      return NextResponse.json({ error: 'AI response was not valid JSON' }, { status: 500 });
    }

    const local_keywords = normalizeKeywords(parsed);
    if (local_keywords.length < 8) {
      return NextResponse.json({ error: 'AI did not generate enough local keywords (need 8-15)' }, { status: 500 });
    }

    return NextResponse.json({ success: true, local_keywords }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


