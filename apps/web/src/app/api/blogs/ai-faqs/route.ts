import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `
You are an SEO expert for MyFNG (India). Generate FAQs for a blog post.

Return STRICT JSON ONLY:
{
  "faqs": [
    { "question": "string", "answer": "string" }
  ]
}

Rules:
- Minimum 5 FAQs, maximum 8.
- Questions should be user-like and specific (often starting with What/How/Why/When/Is/Can).
- Answers: 1-3 short sentences, factual, no hallucinated prices.
- Do not include markdown fences. Do not include extra keys.
`.trim();

function normalizeFaqs(input: any): { question: string; answer: string }[] {
  const faqs = Array.isArray(input?.faqs) ? input.faqs : [];
  const cleaned = faqs
    .map((f: any) => ({
      question: String(f?.question || '').trim(),
      answer: String(f?.answer || '').trim(),
    }))
    .filter((f: any) => f.question && f.answer);

  // De-dup by question
  const seen = new Set<string>();
  const deduped: { question: string; answer: string }[] = [];
  for (const f of cleaned) {
    const key = f.question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(f);
  }
  return deduped.slice(0, 8);
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
        temperature: 0.3,
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

    const faqs = normalizeFaqs(parsed);
    if (faqs.length < 5) {
      return NextResponse.json({ error: 'AI did not generate enough FAQs (need at least 5)' }, { status: 500 });
    }

    return NextResponse.json({ success: true, faqs }, { status: 200 });
  } catch (e: any) {
    return NextResponse.json({ error: 'Internal server error', details: e?.message }, { status: 500 });
  }
}


