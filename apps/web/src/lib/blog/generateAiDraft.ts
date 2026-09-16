import {
  buildAiLinkPromptPayload,
  enrichAiGeneratedHtml,
  fetchRelatedPublishedBlogs,
  toCampaignSlug,
} from '@/lib/blog/aiLinks';

function stripCodeFences(s: string) {
  const t = String(s || '').trim();
  const m = t.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  return m ? m[1].trim() : t;
}

export function toBlogSlug(title: string) {
  return String(title || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const BLOG_SYSTEM_PROMPT = `
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
- NEVER say MyFNG does doorstep / at-home / in-driveway car servicing. MyFNG does NOT send a mechanic to service the car at the customer's house.
- MyFNG offers car PICKUP AND DROP: we collect the car, service it at the workshop, and return it.
- Main conversion is downloading the MyFNG app. Mention the app naturally 2-3 times and use the provided app_download_url for every app-download link.
- Include a short "About MyFNG" section and a short "Book on the MyFNG app" section before the conclusion. Keep each to 2-4 sentences.
- Local SEO: write for the given city. Use the city name in the title or H2 when natural. Weave 4-8 locality names from local_areas and 3-6 phrases from local_keywords. Do not dump them as a list at the top.

Linking rules (mandatory):
- Every blog MUST include a MyFNG CTA block near the end using class "blog-post-cta" with: Download MyFNG App (app_download_url), Book Service (/book-service), and tel:+919152307030.
- Weave 3-6 contextual INTERNAL links naturally in the body (not a dump at the top). Use ONLY urls from internal_pages and related_blogs in the user payload.
- Add utm_source, utm_medium, utm_campaign, utm_content (and utm_term if a focus keyword exists) on every http(s) or site path link. Use the utm_required_on_every_http_link values.
- If you mention an official standard, OEM manual, or public guideline, add 1-3 EXTERNAL reference links from allowed_examples or a real official URL. Do not invent URLs. Skip external links if you have no real source.
- External links must also get the same UTM params, open in a new tab conceptually (target=_blank rel="noopener noreferrer").
- Never link to competitor booking sites.
`.trim();

const FAQ_SYSTEM_PROMPT = `
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

const TAG_SYSTEM_PROMPT = `
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

export type AiBlogDraft = {
  title: string;
  slug: string;
  excerpt: string;
  content_html: string;
  seo: {
    meta_title: string;
    meta_description: string;
    keywords: string;
    og_title: string;
    og_description: string;
    cta_text?: string;
    cta_url?: string;
    related_articles?: Array<{ title: string; url: string }>;
  };
  links: ReturnType<typeof enrichAiGeneratedHtml>['links'];
  read_time: number;
};

async function openaiJson(opts: {
  system: string;
  user: unknown;
  temperature?: number;
}): Promise<any> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: opts.temperature ?? 0.5,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: opts.system },
        { role: 'user', content: JSON.stringify(opts.user) },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`OpenAI request failed: ${errText.slice(0, 240)}`);
  }

  const json = (await res.json()) as any;
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') {
    throw new Error('OpenAI returned empty response');
  }

  try {
    return JSON.parse(stripCodeFences(content));
  } catch {
    throw new Error('AI response was not valid JSON');
  }
}

export async function generateAiBlogDraft(opts: {
  supabase: any;
  topic: string;
  focusKeyword?: string;
  city?: string;
  localAreas?: string[];
  localKeywords?: string[];
  intent?: string;
  tone?: string;
  wordCount?: number;
  appDownloadUrl?: string;
}): Promise<AiBlogDraft> {
  const topic = String(opts.topic || '').trim();
  const focusKeyword = String(opts.focusKeyword || '').trim();
  const city = String(opts.city || '').trim();
  const intent = String(opts.intent || '').trim() || 'Informational';
  const tone = String(opts.tone || '').trim() || 'Professional';
  const wordCount = Math.max(400, Math.min(2500, Number(opts.wordCount || 900) || 900));

  if (!topic || topic.length < 6) {
    throw new Error('Topic is required (min 6 chars)');
  }

  const campaignHint = toCampaignSlug(focusKeyword || topic);
  const relatedBlogs = await fetchRelatedPublishedBlogs(opts.supabase, {
    topic,
    city,
    focusKeyword,
    limit: 6,
  }).catch(() => []);

  const parsed = await openaiJson({
    system: BLOG_SYSTEM_PROMPT,
    temperature: 0.5,
    user: {
      topic,
      focusKeyword: focusKeyword || null,
      city: city || null,
      local_areas: (opts.localAreas || []).slice(0, 12),
      local_keywords: (opts.localKeywords || []).slice(0, 8),
      intent,
      tone,
      wordCount,
      app_download_url: opts.appDownloadUrl || '/go/myfngapp',
      linking: buildAiLinkPromptPayload({
        city,
        topic,
        focusKeyword,
        relatedBlogs,
        campaignHint,
        appDownloadUrl: opts.appDownloadUrl,
      }),
    },
  });

  const title = String(parsed?.title || '').trim();
  const excerpt = String(parsed?.excerpt || '').trim();
  const rawHtml = String(parsed?.content_html || '').trim();
  const seo = parsed?.seo || {};
  const read_time = Number(parsed?.read_time || 5) || 5;

  if (!title || !excerpt || !rawHtml) {
    throw new Error('AI response missing required fields');
  }

  const slug = toBlogSlug(title);
  const enriched = enrichAiGeneratedHtml({
    html: rawHtml,
    slug,
    city,
    focusKeyword,
    relatedBlogs,
    appDownloadUrl: opts.appDownloadUrl,
  });

  return {
    title,
    slug,
    excerpt,
    content_html: enriched.html,
    seo: {
      meta_title: String(seo?.meta_title || title).trim().slice(0, 120),
      meta_description: String(seo?.meta_description || excerpt).trim().slice(0, 160),
      keywords: String(seo?.keywords || focusKeyword || '').trim(),
      og_title: String(seo?.og_title || title).trim().slice(0, 120),
      og_description: String(seo?.og_description || excerpt).trim().slice(0, 200),
      cta_text: 'Book Service Now',
      cta_url: enriched.links.cta_url.startsWith('http')
        ? enriched.links.cta_url
        : `https://myfng.in${enriched.links.cta_url}`,
      related_articles: enriched.links.related_articles,
    },
    links: enriched.links,
    read_time: Math.max(1, Math.min(30, Math.round(read_time))),
  };
}

export async function generateAiFaqs(opts: {
  title: string;
  content: string;
  focusKeyword?: string;
}): Promise<Array<{ question: string; answer: string }>> {
  const parsed = await openaiJson({
    system: FAQ_SYSTEM_PROMPT,
    temperature: 0.3,
    user: {
      title: opts.title,
      focusKeywords: opts.focusKeyword || null,
      content: String(opts.content || '').slice(0, 8000),
    },
  });

  const faqs = Array.isArray(parsed?.faqs) ? parsed.faqs : [];
  const seen = new Set<string>();
  const out: Array<{ question: string; answer: string }> = [];
  for (const f of faqs) {
    const question = String(f?.question || '').trim();
    const answer = String(f?.answer || '').trim();
    if (!question || !answer) continue;
    const key = question.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ question: question.slice(0, 500), answer: answer.slice(0, 2000) });
    if (out.length >= 8) break;
  }
  return out;
}

export async function generateAiTagNames(opts: {
  title: string;
  content: string;
  focusKeyword?: string;
}): Promise<string[]> {
  const parsed = await openaiJson({
    system: TAG_SYSTEM_PROMPT,
    temperature: 0.2,
    user: {
      title: opts.title,
      focusKeywords: opts.focusKeyword || null,
      content: String(opts.content || '').slice(0, 8000),
    },
  });

  const tags = Array.isArray(parsed?.tags) ? parsed.tags : [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of tags) {
    const name = String(raw || '').replace(/\s+/g, ' ').trim();
    const words = name.split(' ').filter(Boolean);
    if (words.length < 1 || words.length > 3) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(name);
    if (out.length >= 10) break;
  }
  return out;
}
