import sharp from 'sharp';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { toBlogSlug } from '@/lib/blog/generateAiDraft';
import { istDateString } from '@/lib/blog/dailyTopics';
import { computeReadTimeFromHtml } from '@/lib/blog/text';
import { mediaPathFromStorage } from '@/lib/media/public-url';
import { PUBLIC_BLOG_AUTHOR } from '@/lib/blog/publicAuthor';
import { stripMyFngServiceHtml } from '@/lib/blog/newsCarBlog';
import { revalidateBlogSeo } from '@/lib/seo/revalidate';
import { currentAutomobileNewsSlot } from '@/lib/blog/automobileNewsSlots';

export const AUTOMOBILE_NEWS_PER_DAY = 10;

const RSS_URL =
  'https://news.google.com/rss/search?q=(car%20OR%20automobile%20OR%20SUV%20OR%20sedan%20OR%20%22petrol%20price%22%20OR%20%22diesel%20price%22%20OR%20FASTag%20OR%20RTO)%20(India%20OR%20Mumbai%20OR%20Pune%20OR%20Delhi)&hl=en-IN&gl=IN&ceid=IN:en';

const COMMONS_UA = 'MyFNG/1.0 (editorial; attribution; automobile-news)';

type RssItem = {
  title: string;
  link: string;
  sourceName: string;
  sourceUrl: string;
};

export type AutomobileNewsRunResult = {
  success: boolean;
  skipped?: boolean;
  reason?: string;
  posted_today?: number;
  quota?: number;
  blog_id?: string;
  slug?: string;
  title?: string;
  headline?: string;
  error?: string;
};

function istWallClock(now = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value || '00';
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}:${get('minute')}:${get('second')}`;
}

function plainText(value: string) {
  return String(value || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function headlineKey(title: string) {
  return plainText(title)
    .toLowerCase()
    .replace(/\s+-\s+[^-\n]{2,40}$/, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .slice(0, 180);
}

function decodeXml(value: string) {
  return plainText(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1'),
  );
}

function tag(block: string, name: string) {
  const match = block.match(new RegExp(`<${name}[^>]*>([\\s\\S]*?)</${name}>`, 'i'));
  return match ? decodeXml(match[1]) : '';
}

function parseRss(xml: string): RssItem[] {
  const items: RssItem[] = [];
  const blocks = xml.match(/<item\b[\s\S]*?<\/item>/gi) || [];
  for (const block of blocks) {
    const title = tag(block, 'title');
    const link = tag(block, 'link');
    const sourceMatch = block.match(/<source\b([^>]*)>([\s\S]*?)<\/source>/i);
    const sourceUrl = sourceMatch?.[1]?.match(/\burl=["']([^"']+)["']/i)?.[1] || '';
    const sourceName = sourceMatch ? decodeXml(sourceMatch[2]) : '';
    if (!title || !link) continue;
    items.push({ title, link, sourceName, sourceUrl });
  }
  return items;
}

async function fetchHeadlines(): Promise<RssItem[]> {
  const response = await fetch(RSS_URL, {
    headers: { 'User-Agent': COMMONS_UA, Accept: 'application/rss+xml, application/xml, text/xml' },
    cache: 'no-store',
  });
  if (!response.ok) throw new Error(`News feed returned HTTP ${response.status}`);
  const xml = await response.text();
  const items = parseRss(xml);
  if (!items.length) throw new Error('News feed returned no headlines');
  return items;
}

async function openaiNews(item: RssItem) {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';
  if (!apiKey) throw new Error('OPENAI_API_KEY not set');

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature: 0.4,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You write original automobile news briefs for MYFNG Automobile News.
Rules:
- Do not copy sentences from any article. Paraphrase.
- Use only facts that are explicit in the supplied headline and source name. You may explain what that fact means for car owners in Mumbai, Navi Mumbai, Thane, Palghar and Pune.
- Do not invent prices, percentages, dates, fines, mileage, or statistics.
- Do not mention MyFNG pickup, the MyFNG app, booking a service, fuel delivery, Prime, or "download the app".
- Write 450-700 words in HTML: one intro paragraph, then h2 sections, then a short "What to check" list.
- Include exactly one external link to source_url using source_name as the anchor.
- Include one internal link to https://myfng.in/automobile-news.
- image_query is 2-5 words naming a visible car, brand, showroom, traffic, or petrol pump from the headline. Example: "Mahindra XUV700" or "Mumbai cars traffic". Never a person, bank, keyboard, aircraft, or logo. If the headline has no car, use "cars on road India".
Return JSON: {"title":"","excerpt":"","content_html":"","image_query":""}`,
        },
        {
          role: 'user',
          content: JSON.stringify({
            headline: item.title,
            source_name: item.sourceName || 'the original report',
            source_url: item.sourceUrl || item.link,
            google_news_url: item.link,
          }),
        },
      ],
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => '');
    throw new Error(`OpenAI request failed: ${errText.slice(0, 240)}`);
  }
  const json = await response.json();
  const content = json?.choices?.[0]?.message?.content;
  if (!content || typeof content !== 'string') throw new Error('OpenAI returned empty response');
  const parsed = JSON.parse(content);
  const title = String(parsed?.title || '').trim();
  const excerpt = String(parsed?.excerpt || '').trim();
  const html = stripMyFngServiceHtml(String(parsed?.content_html || ''));
  const imageQuery = String(parsed?.image_query || '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!title || !excerpt || !html) throw new Error('AI response missing required fields');
  return { title, excerpt, html, imageQuery: imageQuery || 'indian car' };
}

type CommonsPhoto = {
  url: string;
  artist: string;
  license: string;
  title: string;
};

function licenseAllowed(name: string) {
  const value = name.toLowerCase();
  if (/nc|nd|non-?commercial|no derivatives/.test(value)) return false;
  return /cc0|cc by|cc-by|public domain|pd\b/.test(value);
}

const CAR_TITLE = /\b(car|cars|automobile|sedan|suv|hatchback|mpv|vehicle|showroom|dealership|traffic|maruti|suzuki|hyundai|tata|mahindra|honda|toyota|skoda|kia|volkswagen|bmw|mercedes|audi|ferrari|porsche|lamborghini|mclaren|bugatti|ambassador|creta|nexon|xuv|scorpio|thar|brezza|swift|elevate|slavia|bolero|huracan|huracán|aventador)\b/i;
const BAD_TITLE = /\b(navy|aircraft|air[- ]traffic|carrier|keyboard|warship|helicopter|fighter|soldier|sailor|cockpit|radar|missile|portrait|logo|diagram|uniform|submarine|taxi|geograph\.org\.uk)\b/i;

type PhotoSubject = 'supercar' | 'used' | 'showroom' | 'brand' | 'traffic' | 'general';

function photoSubject(title: string): PhotoSubject {
  if (/supercar|\bimports?\b|classic/i.test(title)) return 'supercar';
  if (/used car|resale|second[- ]hand|pre-owned/i.test(title)) return 'used';
  if (/loan|repo|\brbi\b|\bemi\b|interest/i.test(title)) return 'showroom';
  if (/mahindra|\btata\b|hyundai|honda|skoda|maruti|\bkia\b|toyota/i.test(title)) return 'brand';
  if (/mumbai|petrol|diesel|fuel|traffic/i.test(title)) return 'traffic';
  return 'general';
}

function photoQueries(title: string, imageQuery: string) {
  const queries: string[] = [];
  const add = (value: string) => {
    const next = value.replace(/[^\w\s:-]/g, ' ').replace(/\s+/g, ' ').trim();
    if (next && !queries.some((item) => item.toLowerCase() === next.toLowerCase())) queries.push(next);
  };
  const subject = photoSubject(title);
  if (subject === 'supercar') {
    add('Lamborghini Huracan');
    add('Ferrari supercar');
    add('Porsche 911');
  } else   if (subject === 'used') {
    add('intitle:used cars');
  } else if (subject === 'showroom') {
    add('Maruti Suzuki showroom India');
    add('car showroom India');
  } else if (subject === 'brand') {
    if (/mahindra/i.test(title)) add('Mahindra XUV700 India');
    if (/\btata\b/i.test(title)) add('Tata Nexon car India');
    if (/hyundai/i.test(title)) add('Hyundai Creta India');
    if (/honda/i.test(title)) add('Honda car India');
    if (/skoda/i.test(title)) add('Skoda Slavia car');
  } else if (subject === 'traffic') {
    if (/petrol|diesel|fuel/i.test(title)) add('Indian oil petrol station');
    else add('cars on road India');
  } else if (imageQuery && !BAD_TITLE.test(imageQuery)) {
    add(imageQuery);
  }
  if (!queries.length) add('cars on road India');
  return queries.slice(0, 3);
}

function photoMatches(fileTitle: string, subject: PhotoSubject) {
  const title = fileTitle.toLowerCase();
  if (BAD_TITLE.test(title) || /taxi|geograph\.org\.uk|red bull|rallycross/.test(title)) return false;
  if (subject === 'supercar') return /lamborghini|ferrari|porsche|mclaren|bugatti|huracan|huracán|aventador/.test(title);
  if (subject === 'used') return /used car/.test(title);
  if (subject === 'showroom') return /showroom|dealership|motors/.test(title) && CAR_TITLE.test(title);
  if (subject === 'brand') return CAR_TITLE.test(title);
  return CAR_TITLE.test(title);
}

async function searchCommons(query: string): Promise<CommonsPhoto[]> {
  const endpoint = new URL('https://commons.wikimedia.org/w/api.php');
  endpoint.searchParams.set('action', 'query');
  endpoint.searchParams.set('format', 'json');
  endpoint.searchParams.set('generator', 'search');
  endpoint.searchParams.set('gsrsearch', `${query} filetype:bitmap`);
  endpoint.searchParams.set('gsrnamespace', '6');
  endpoint.searchParams.set('gsrlimit', '10');
  endpoint.searchParams.set('prop', 'imageinfo');
  endpoint.searchParams.set('iiprop', 'url|extmetadata|mime|size');
  endpoint.searchParams.set('iiurlwidth', '1400');
  const response = await fetch(endpoint, { headers: { 'User-Agent': COMMONS_UA }, cache: 'no-store' });
  if (!response.ok) return [];
  const json = await response.json();
  const pages = Object.values(json?.query?.pages || {}) as Array<any>;
  pages.sort((a, b) => Number(a?.index || 0) - Number(b?.index || 0));
  const photos: CommonsPhoto[] = [];
  for (const page of pages) {
    const info = page?.imageinfo?.[0];
    const meta = info?.extmetadata || {};
    const license = plainText(String(meta?.LicenseShortName?.value || meta?.License?.value || ''));
    const mime = String(info?.mime || '');
    const title = plainText(String(page?.title || query)).replace(/^File:/i, '');
    const width = Number(info?.width || 0);
    if (!info?.thumburl && !info?.url) continue;
    if (!/^image\/(jpeg|png|webp)/.test(mime)) continue;
    if (width && width < 700) continue;
    if (!licenseAllowed(license)) continue;
    if (BAD_TITLE.test(title) || /taxi|geograph\.org\.uk/i.test(title)) continue;
    photos.push({
      url: String(info.thumburl || info.url),
      artist: plainText(String(meta?.Artist?.value || 'Wikimedia Commons')).slice(0, 180),
      license: license.slice(0, 80),
      title,
    });
  }
  return photos;
}

async function pickNewsPhoto(articleTitle: string, imageQuery: string, usedTitles: Set<string>): Promise<CommonsPhoto | null> {
  const subject = photoSubject(articleTitle);
  for (const query of photoQueries(articleTitle, imageQuery)) {
    const photos = await searchCommons(query);
    for (const photo of photos) {
      const key = photo.title.toLowerCase();
      if (usedTitles.has(key)) continue;
      if (!photoMatches(photo.title, subject)) continue;
      return photo;
    }
  }
  return null;
}

async function uploadPhoto(supabaseAdmin: any, slug: string, photo: CommonsPhoto) {
  const response = await fetch(photo.url, { headers: { 'User-Agent': COMMONS_UA } });
  if (!response.ok) throw new Error(`Photo download failed (${response.status})`);
  const input = Buffer.from(await response.arrayBuffer());
  const webp = await sharp(input)
    .rotate()
    .resize({ width: 1400, withoutEnlargement: true })
    .webp({ quality: 72 })
    .toBuffer();
  const storagePath = `blog-images/news-${slug}-${Date.now()}.webp`;
  const { error } = await supabaseAdmin.storage.from('service-media').upload(storagePath, webp, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw new Error(error.message || 'Failed to upload news photo');
  return mediaPathFromStorage('service-media', storagePath);
}

function ensureSourceLink(html: string, item: RssItem) {
  const href = item.sourceUrl || item.link;
  if (html.includes(href) || html.includes(item.link)) return html;
  const name = item.sourceName || 'the original report';
  return `${html}\n<p>Source: <a href="${href}" rel="noopener noreferrer">${name}</a>.</p>`;
}

async function uniqueSlug(supabaseAdmin: any, base: string) {
  const root = toBlogSlug(base).slice(0, 80) || 'automobile-news';
  for (let n = 0; n < 20; n += 1) {
    const candidate = n === 0 ? root : `${root}-${n + 1}`;
    const { data } = await supabaseAdmin.from('blogs').select('id').eq('slug', candidate).maybeSingle();
    if (!data?.id) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function countAutomobileNewsPostedToday(supabaseAdmin: any, runDate = istDateString()) {
  const { data, error } = await supabaseAdmin
    .from('blogs')
    .select('id, seo_data')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(80);
  if (error) throw new Error(error.message || 'Could not count today\'s news');
  return (data || []).filter((row: any) => {
    const seo = row?.seo_data || {};
    return seo.ai_daily_news === true && String(seo.ai_daily_news_date || '') === runDate;
  }).length;
}

export async function runDailyAutomobileNews(opts?: { force?: boolean; ignorePause?: boolean }): Promise<AutomobileNewsRunResult> {
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return { success: false, error: adminError || 'Admin client not configured' };
  }

  const runDate = istDateString();
  if (!opts?.force && !opts?.ignorePause) {
    const { data: settings, error: settingsError } = await (supabaseAdmin as any)
      .from('daily_blog_settings')
      .select('news_enabled')
      .eq('id', 1)
      .maybeSingle();
    const missingColumn = /news_enabled/i.test(String(settingsError?.message || ''));
    if (!settingsError && settings && (settings as { news_enabled?: boolean }).news_enabled === false) {
      return {
        success: true,
        skipped: true,
        reason: 'paused',
        posted_today: 0,
        quota: AUTOMOBILE_NEWS_PER_DAY,
      };
    }
    if (settingsError && !missingColumn) {
      return { success: false, error: settingsError.message, quota: AUTOMOBILE_NEWS_PER_DAY };
    }
  }

  let postedToday = 0;
  try {
    postedToday = await countAutomobileNewsPostedToday(supabaseAdmin, runDate);
  } catch (error: any) {
    return { success: false, error: String(error?.message || error), quota: AUTOMOBILE_NEWS_PER_DAY };
  }

  if (!opts?.force && postedToday >= AUTOMOBILE_NEWS_PER_DAY) {
    return {
      success: true,
      skipped: true,
      reason: 'quota_met',
      posted_today: postedToday,
      quota: AUTOMOBILE_NEWS_PER_DAY,
    };
  }

  const slot = currentAutomobileNewsSlot();
  if (!opts?.force && !opts?.ignorePause && !slot) {
    return {
      success: true,
      skipped: true,
      reason: 'outside_slot',
      posted_today: postedToday,
      quota: AUTOMOBILE_NEWS_PER_DAY,
    };
  }

  if (!opts?.force && !opts?.ignorePause && slot) {
    const { data: slotRows } = await supabaseAdmin
      .from('blogs')
      .select('seo_data')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .limit(40);
    const slotTaken = (slotRows || []).some((row: any) => {
      const seo = row?.seo_data || {};
      return seo.ai_daily_news === true && String(seo.ai_daily_news_date || '') === runDate && String(seo.ai_daily_news_slot || '') === slot;
    });
    if (slotTaken) {
      return {
        success: true,
        skipped: true,
        reason: 'slot_filled',
        posted_today: postedToday,
        quota: AUTOMOBILE_NEWS_PER_DAY,
      };
    }
  }

  const { data: recent } = await supabaseAdmin
    .from('blogs')
    .select('title, seo_data')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(200);
  const used = new Set<string>();
  const usedPhotos = new Set<string>();
  for (const row of recent || []) {
    const seo = (row as any)?.seo_data || {};
    if (seo.news_headline_key) used.add(String(seo.news_headline_key));
    if (seo.news_commons_title) usedPhotos.add(String(seo.news_commons_title).toLowerCase());
    used.add(headlineKey(String((row as any)?.title || '')));
  }

  let headlines: RssItem[];
  try {
    headlines = await fetchHeadlines();
  } catch (error: any) {
    return {
      success: false,
      error: String(error?.message || error),
      posted_today: postedToday,
      quota: AUTOMOBILE_NEWS_PER_DAY,
    };
  }

  const fresh = headlines.filter((item) => !used.has(headlineKey(item.title)));
  if (!fresh.length) {
    return {
      success: true,
      skipped: true,
      reason: 'no_fresh_headlines',
      posted_today: postedToday,
      quota: AUTOMOBILE_NEWS_PER_DAY,
    };
  }

  let lastError = 'No story could be published';
  for (const item of fresh.slice(0, 3)) {
    try {
      const draft = await openaiNews(item);
      const photo = await pickNewsPhoto(draft.title, draft.imageQuery, usedPhotos);
      const slug = await uniqueSlug(supabaseAdmin, draft.title);
      let imageUrl = '';
      const html = ensureSourceLink(draft.html, item);
      let caption = '';
      if (photo) {
        imageUrl = await uploadPhoto(supabaseAdmin, slug, photo);
        caption = `Reference photo: ${photo.title}. ${photo.artist}. ${photo.license}. Via Wikimedia Commons.`;
        usedPhotos.add(photo.title.toLowerCase());
      }

      const { data: category } = await supabaseAdmin
        .from('blog_categories')
        .select('id')
        .eq('slug', 'automobile-news')
        .maybeSingle();
      if (!category?.id) throw new Error('Automobile News category is missing');

      const { data: author } = await supabaseAdmin
        .from('users_login')
        .select('id')
        .ilike('full_name', '%Nikhil%Yelligetti%')
        .limit(1)
        .maybeSingle();
      let authorId = author?.id || null;
      if (!authorId) {
        const { data: existingAuthor } = await supabaseAdmin
          .from('blogs')
          .select('author_id')
          .not('author_id', 'is', null)
          .order('published_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        authorId = existingAuthor?.author_id || null;
      }
      const { minutes } = computeReadTimeFromHtml(html);
      const canonical = `https://myfng.in/automobile-news/${slug}`;
      const seoData = {
        keywords: 'automobile news, car news India, Mumbai, Pune',
        og_image: imageUrl || null,
        og_title: draft.title.slice(0, 120),
        keyphrase: 'automobile news',
        local_city: 'Mumbai',
        meta_title: draft.title.slice(0, 120),
        schema_faq: false,
        ai_news_car: true,
        ai_daily_news: true,
        ai_daily_news_date: runDate,
        ai_daily_news_slot: slot,
        news_headline_key: headlineKey(item.title),
        news_source_name: item.sourceName || null,
        news_source_url: item.sourceUrl || item.link,
        news_commons_title: photo?.title || null,
        news_photo_caption: caption || null,
        author_name: PUBLIC_BLOG_AUTHOR,
        local_areas: ['Mumbai', 'Navi Mumbai', 'Thane', 'Palghar', 'Pune'],
        robots_index: true,
        canonical_url: canonical,
        robots_follow: true,
        search_intent: 'informational',
        og_description: draft.excerpt.slice(0, 200),
        meta_description: draft.excerpt.slice(0, 160),
        featured_image_alt: draft.title.slice(0, 125),
        schema_blogposting: true,
        eligible_ai_overview: true,
        ai_generated: true,
      };

      const payload = {
        title: draft.title,
        slug,
        excerpt: draft.excerpt,
        content: html,
        seo_data: seoData,
        category_id: category.id,
        author_id: authorId,
        created_by: authorId,
        updated_by: authorId,
        read_time: minutes || 4,
        featured_image: imageUrl || null,
        status: 'published',
        is_featured: false,
        is_premium: false,
        published_at: istWallClock(),
      };

      const { data: blog, error: insertError } = await supabaseAdmin
        .from('blogs')
        .insert(payload)
        .select('id, title, slug')
        .single();
      if (insertError || !blog?.id) throw new Error(insertError?.message || 'Failed to insert news');

      await supabaseAdmin.from('blog_category_mapping').insert({
        blog_id: blog.id,
        category_id: category.id,
        is_primary: true,
      }).then(() => undefined, () => undefined);

      revalidateBlogSeo(String(blog.slug || slug));

      return {
        success: true,
        posted_today: postedToday + 1,
        quota: AUTOMOBILE_NEWS_PER_DAY,
        blog_id: blog.id,
        slug: String(blog.slug || slug),
        title: blog.title,
        headline: item.title,
      };
    } catch (error: any) {
      lastError = String(error?.message || error || lastError).slice(0, 500);
    }
  }

  return {
    success: false,
    error: lastError,
    posted_today: postedToday,
    quota: AUTOMOBILE_NEWS_PER_DAY,
  };
}
