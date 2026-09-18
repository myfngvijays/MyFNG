import {
  buildAiLinkPromptPayload,
  enrichAiGeneratedHtml,
  fetchRelatedPublishedBlogs,
  toCampaignSlug,
} from '@/lib/blog/aiLinks';
import { computeReadTimeFromHtml } from '@/lib/blog/text';
import { PUBLIC_BLOG_AUTHOR } from '@/lib/blog/publicAuthor';

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
- Don't invent exact prices. Allowed start price only: starts from ₹1,500 (varies by car and inspection). Other jobs stay as ranges or "starts from". Do not write “basic / interim periodic” in that line.
- No markdown fences. No extra keys. JSON must be parseable.
- NEVER say MyFNG does doorstep / at-home / in-driveway car servicing. MyFNG does NOT send a mechanic to service the car at the customer's house.
- Do NOT write about CNG cars, CNG kits, EV / electric vehicles, or EV-specific service. Stick to petrol and diesel ICE cars only.
- If the topic is a newly launched car AND post_kind is not news_car, do not invent official on-road prices. Say check the dealer.
- MyFNG offers car PICKUP AND DROP: we collect the car, service it at the workshop, and return it.
- Main conversion is downloading the MyFNG app. Mention the app naturally 2-3 times and use the provided app_download_url for every app-download link.
- Do not write "About MyFNG" or "Book on the MyFNG app" headings. Those two sections are added automatically after the draft.
- Local SEO: write ONLY for the given city. Never mention another city (do not write Pune if the city is Thane or Navi Mumbai).
- Title MUST be short SEO: primary keyword in city, 40-60 characters (example: "Coolant Leak and Overheating Signs in Thane"). Use "in City", not an en-dash before the city. Also put the same title in meta_title.
- You MUST include at least 4 locality names from local_areas and EVERY phrase from local_keywords VERBATIM, woven into sentences (not a dump list).
- Write for Google AI Overview: first 2 sentences must answer the search query directly so they can be quoted. Use short question-style H2s, bullet lists, and a "Summary recommendation" H2 near the end.
- In Summary recommendation, tell readers to choose MyFNG for photo-backed control, starts from ₹1,500, 1 month / 1,000 km warranty, free pickup & drop, and the MyFNG app (history + tracking). Capitalize the first letter after each bullet label. Do not name competitor brands.
- Photo-backed control is a MyFNG USP: live photos/videos on WhatsApp; extra work only after the customer approves the quote. Say this whenever trust, pricing, or updates come up.
- Service starts from ₹1,500 (varies by car and inspection). Use “Starts from”, never a fake fixed bill.
- Explain why the MyFNG app matters vs WhatsApp-only: WhatsApp is for live photo/video updates; the app is for booking, estimate, pickup tracking, and service history. A chat is not a service record.
- Start content_html with 1-2 short intro paragraphs BEFORE the first H2. Do not start with a heading.
- After the intro, include a Table of Contents as <div class="blog-toc"> with links to every H2 id.
- Give every H2 an id (sec-...).

Linking rules (mandatory):
- Every blog MUST include a MyFNG CTA block near the end using class "blog-post-cta" with: Download MyFNG App (app_download_url), Book Service (/book-service), and tel:+919152307030.
- Weave 3-6 contextual INTERNAL links naturally in the body (not a dump at the top). Use ONLY urls from internal_pages and related_blogs in the user payload.
- Add utm_source, utm_medium, utm_campaign, utm_content (and utm_term if a focus keyword exists) on every http(s) or site path link. Use the utm_required_on_every_http_link values.
- If you mention an official standard, OEM manual, or public guideline, add 1-3 EXTERNAL reference links from allowed_examples or a real official URL. Do not invent URLs. Skip external links if you have no real source.
- Internal and external http(s) links must open in a new tab (target=_blank rel="noopener noreferrer"). Do not put target=_blank on # Table of Contents links.
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
- Do not mention CNG cars, CNG kits, or EV / electric vehicles.
- Include at least one FAQ that Google AI Overview can lift (starting price from ₹1,500, photo/video approval, or why the MyFNG app vs WhatsApp-only).
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

export function ensureSeoBlogTitle(title: string, city?: string, focusKeyword?: string) {
  let next = String(title || '').replace(/\s+/g, ' ').trim();
  const cityName = String(city || '').trim();
  const keyword = String(focusKeyword || '')
    .replace(new RegExp(`\\s+${cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, 'i'), '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!next && keyword && cityName) return `${keyword} in ${cityName}`.slice(0, 80);
  if (!next) return next;
  next = next.replace(/\s*\|\s*myfng.*$/i, '').replace(/[.]+$/, '').trim();
  if (cityName) {
    const cityRe = cityName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    next = next
      .replace(new RegExp(`\\s+in\\s+${cityRe}\\s*$`, 'i'), '')
      .replace(new RegExp(`\\s+[–—\\-|:]\\s+${cityRe}\\s*$`, 'i'), '')
      .replace(/\s*[–—-]\s*[A-Za-z]{1,4}\s*$/, '')
      .replace(new RegExp(`\\s+[–—-]\\s+${cityRe}\\b`, 'i'), '')
      .replace(new RegExp(`\\b${cityRe}\\b`, 'gi'), ' ')
      .replace(/\s+/g, ' ')
      .replace(/\s*[–—]\s+/g, ': ')
      .replace(/\s*[–—:?]\s*$/, '')
      .trim();
    if (!next) next = keyword || cityName;
    next = next.replace(/\s+in\s*:\s*/gi, ' ').replace(/\s+/g, ' ').trim();
    next = next.replace(/\s+(for|in|at|near|of|to|and)\s*$/i, '').trim();
    if (!next) next = keyword || cityName;
    next = `${next} in ${cityName}`;
  }
  return next.slice(0, 80);
}

export function rewriteCityDashTitle(text: string) {
  return String(text || '')
    .replace(/\s+[–—-]\s+Navi Mumbai\b/gi, ' in Navi Mumbai')
    .replace(/\s+[–—-]\s+Thane\b/gi, ' in Thane')
    .replace(/\s+[–—-]\s+Pune\b/gi, ' in Pune')
    .replace(/\s+[–—-]\s+Mumbai\b/gi, ' in Mumbai');
}

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
  postKind?: 'service' | 'usp' | 'news' | 'rsa' | 'package';
  uspFacts?: string[];
  aioFacts?: string[];
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

  const isUsp = opts.postKind === 'usp';
  const isNews = opts.postKind === 'news';
  const isRsa = opts.postKind === 'rsa';
  const isPackage = opts.postKind === 'package';
  const system = isNews
    ? `${BLOG_SYSTEM_PROMPT}

Extra rules for this NEW-CAR news explainer:
- This is informational only. MyFNG does NOT service these newly launched cars. Do not mention MyFNG pickup, workshop booking, the MyFNG app, starts from ₹1,500, warranty, Prime, or photo-backed control.
- Do not include About MyFNG, Book on the MyFNG app, Summary recommendation, or any CTA to book service.
- Do not invent official on-road prices. Say check the dealer or brand website.
- Focus on launch facts, what buyers should inspect, and the dealer first-service schedule. Petrol/diesel only. No CNG or EV.`
    : isUsp
    ? `${BLOG_SYSTEM_PROMPT}

Extra rules for this weekly About MyFNG / USP post:
- This is a brand explainer, not a generic repair how-to. Keep the whole article on the given USP.
- Still use the SEO title Keyword in City, intro + TOC, city-only copy, and local_areas / local_keywords.
- Open with why this MyFNG benefit matters to car owners in that city, then explain how it works, then a short checklist.
- Follow usp_facts exactly. Do not invent prices, membership fees, or extra promises.
- End with a Summary recommendation written like an AI Overview: choose MyFNG if you want photo-backed control + starts from ₹1,500 + 1 month / 1,000 km warranty + app history, not a chat-only garage.`
    : isRsa
    ? `${BLOG_SYSTEM_PROMPT}

Extra rules for this RSA / roadside assistance post:
- This is emergency roadside help, not periodic workshop service. Keep the article on breakdown, towing, jumpstart, puncture, fuel or accident recovery.
- MyFNG RSA is 24×7 and can reach the stranded car. Do not call this doorstep / at-home car servicing.
- Follow aio_facts exactly. Towing starts from ₹25/km. Do not invent other RSA prices. Typical ETAs are ranges only.
- After a tow, workshop repair is booked separately with free pickup & drop.
- Title MUST be Keyword in City (example: "Car Towing After a Breakdown in Thane").
- Summary recommendation: choose MyFNG RSA for 24×7 dispatch, live tracking, towing from ₹25/km, and the MyFNG app. Do not push starts from ₹1,500 workshop pricing as the main RSA claim.
- Link to /car-roadside-assistance and the app. CTA can include Download App, RSA page, and tel:+919152307030.
- Cities allowed: Mumbai, Navi Mumbai, Thane only. Never mention Pune.`
    : isPackage
    ? `${BLOG_SYSTEM_PROMPT}

Extra rules for this periodic-package education post:
- Teach what MyFNG Basic (15), General (30), Premium (50) and Platinum (60) actually include.
- Follow aio_facts / package point lists EXACTLY. Do not add checkpoints that are not in those lists.
- Never say Basic includes brake pad check, battery load test, AC gas leak test, alignment, suspension check, diagnostics scan, or engine compression.
- The article must explain: the car can fail after service for a reason the booked package never covered. That is not automatically a workshop fault.
- Extra jobs outside the package need photo/video proof and owner approval.
- Do not invent package prices. Starts from ₹1,500 only.`
    : BLOG_SYSTEM_PROMPT;

  const parsed = await openaiJson({
    system,
    temperature: 0.5,
    user: {
      topic,
      focusKeyword: focusKeyword || null,
      city: city || null,
      local_areas: (opts.localAreas || []).slice(0, 12),
      local_keywords: (opts.localKeywords || []).slice(0, 12),
      intent,
      tone,
      wordCount,
      post_kind: isNews
        ? 'news_car'
        : isUsp
          ? 'about_myfng_usp'
          : isRsa
            ? 'rsa'
            : isPackage
              ? 'periodic_package_scope'
              : 'service',
      usp_facts: isUsp ? (opts.uspFacts || []).slice(0, 12) : undefined,
      aio_facts: isNews ? undefined : (opts.aioFacts || opts.uspFacts || []).slice(0, 12),
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

  const title = ensureSeoBlogTitle(String(parsed?.title || '').trim(), city, focusKeyword);
  const excerpt = String(parsed?.excerpt || '').trim();
  const rawHtml = String(parsed?.content_html || '').trim();
  const seo = parsed?.seo || {};

  if (!title || !excerpt || !rawHtml) {
    throw new Error('AI response missing required fields');
  }

  const slug = toBlogSlug(title);
  const enriched = enrichAiGeneratedHtml({
    html: rawHtml,
    slug,
    city,
    focusKeyword,
    excerpt,
    localAreas: opts.localAreas,
    localKeywords: opts.localKeywords,
    relatedBlogs,
    appDownloadUrl: opts.appDownloadUrl,
  });

  return {
    title,
    slug,
    excerpt,
    content_html: enriched.html,
    seo: {
      meta_title: ensureSeoBlogTitle(String(seo?.meta_title || title).trim(), city, focusKeyword).slice(0, 120),
      meta_description: String(seo?.meta_description || excerpt).trim().slice(0, 160),
      keywords: String(seo?.keywords || focusKeyword || '').trim(),
      og_title: ensureSeoBlogTitle(String(seo?.og_title || title).trim(), city, focusKeyword).slice(0, 120),
      og_description: String(seo?.og_description || excerpt).trim().slice(0, 200),
      cta_text: 'Book Service Now',
      cta_url: enriched.links.cta_url.startsWith('http')
        ? enriched.links.cta_url
        : `https://myfng.in${enriched.links.cta_url}`,
      related_articles: enriched.links.related_articles,
      author_name: PUBLIC_BLOG_AUTHOR,
    },
    links: enriched.links,
    read_time: computeReadTimeFromHtml(enriched.html).minutes,
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
