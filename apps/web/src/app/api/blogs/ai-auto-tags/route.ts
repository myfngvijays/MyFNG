import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `
You are an SEO specialist for MyFNG (India).
Suggest blog tags based on title, content and focus keywords.

Return STRICT JSON ONLY:
{
  "tags": ["string"]
}

Rules:
- Provide 5 to 10 tags.
- Each tag must be 1-3 words, title case (e.g., "Car Service", "AC Repair").
- Avoid duplicates, avoid overly generic tags like "Blog".
- No markdown fences. No extra keys.
`.trim();

function toSlug(name: string) {
  return String(name || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function normalizeTags(input: any): string[] {
  const tags = Array.isArray(input?.tags) ? input.tags : [];
  const cleaned = tags
    .map((t: any) => String(t || '').trim())
    .filter(Boolean)
    .map((t: string) => t.replace(/\s+/g, ' ').trim());

  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of cleaned) {
    const words = t.split(' ').filter(Boolean);
    if (words.length < 1 || words.length > 3) continue;
    const key = t.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(t);
    if (out.length >= 10) break;
  }
  return out.length >= 5 ? out : out.slice(0, 10);
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
    const title = String(body?.title || '').trim();
    const content = String(body?.content || '').trim();
    const focusKeywords = String(body?.focusKeywords || body?.focusKeyword || '').trim();

    if (!title || title.length < 6) return NextResponse.json({ error: 'Title is required (min 6 chars)' }, { status: 400 });
    if (!content || content.length < 50) return NextResponse.json({ error: 'Content is required (min 50 chars)' }, { status: 400 });

    const payload = { title, focusKeywords: focusKeywords || null, content };

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

    const suggested = normalizeTags(parsed);
    if (suggested.length < 5) {
      return NextResponse.json({ error: 'AI did not generate enough tags (need 5-10)' }, { status: 500 });
    }

    // Ensure tags exist in DB and return ids
    const slugs = suggested.map((t) => toSlug(t)).filter(Boolean);
    const { data: existing } = await supabase.from('blog_tags').select('id, slug, name').in('slug', slugs);
    const existingBySlug = new Map<string, any>((existing || []).map((t: any) => [t.slug, t]));

    const toCreate = suggested
      .map((name) => ({ name, slug: toSlug(name) }))
      .filter((t) => t.slug && !existingBySlug.has(t.slug));

    if (toCreate.length) {
      const { error: insErr } = await supabase.from('blog_tags').insert(toCreate);
      // If insert fails (RLS/unique), continue best-effort and re-fetch below
      if (insErr) {
        console.error('auto-tag insert failed:', insErr);
      }
    }

    const { data: allTags, error: fetchErr } = await supabase.from('blog_tags').select('id, slug, name').in('slug', slugs);
    if (fetchErr) {
      return NextResponse.json({ error: 'Failed to fetch tags', details: fetchErr.message }, { status: 500 });
    }

    const ids = (allTags || [])
      .sort((a: any, b: any) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug))
      .map((t: any) => t.id);

    return NextResponse.json(
      { success: true, tags: (allTags || []).sort((a: any, b: any) => slugs.indexOf(a.slug) - slugs.indexOf(b.slug)), tag_ids: ids },
      { status: 200 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


