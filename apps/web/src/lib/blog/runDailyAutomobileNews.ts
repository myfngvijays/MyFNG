import sharp from 'sharp';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { toBlogSlug } from '@/lib/blog/generateAiDraft';
import { istDateString } from '@/lib/blog/dailyTopics';
import { computeReadTimeFromHtml } from '@/lib/blog/text';
import { mediaPathFromStorage } from '@/lib/media/public-url';
import { PUBLIC_BLOG_AUTHOR } from '@/lib/blog/publicAuthor';
import { stripMyFngServiceHtml } from '@/lib/blog/newsCarBlog';
import { revalidateBlogSeo } from '@/lib/seo/revalidate';
import { earliestUnfilledAutomobileNewsSlot } from '@/lib/blog/automobileNewsSlots';
import { isEvBikeServiceText, isEvBikeText, resolveNewsTopic } from '@/lib/blog/newsTopic';
import { buildNewsPhotoCover, findNewsWebPhoto } from '@/lib/blog/newsFallbackCover';
import { isAutomobileIndustryHeadline, isSameAutomobileStory } from '@/lib/blog/automobileHeadline';
import { polishAiHtml, polishAiProse } from '@/lib/blog/aiWritingStyle';

export const AUTOMOBILE_NEWS_PER_DAY = 10;

const RSS_FEEDS = [
  'https://news.google.com/rss/search?q=(car%20OR%20automobile%20OR%20SUV%20OR%20sedan%20OR%20%22petrol%20price%22%20OR%20%22diesel%20price%22%20OR%20FASTag%20OR%20RTO)%20(India%20OR%20Mumbai%20OR%20Pune%20OR%20Delhi)&hl=en-IN&gl=IN&ceid=IN:en',
  'https://news.google.com/rss/search?q=(%22electric%20scooter%22%20OR%20%22EV%20scooter%22%20OR%20Ather%20OR%20%22Ola%20Electric%22%20OR%20%22TVS%20iQube%22%20OR%20Chetak%20OR%20%22electric%20bike%22)%20(India%20OR%20Mumbai%20OR%20Pune)&hl=en-IN&gl=IN&ceid=IN:en',
  'https://news.google.com/rss/search?q=(%22electric%20scooter%22%20OR%20Ather%20OR%20%22Ola%20Electric%22%20OR%20iQube%20OR%20Chetak)%20(service%20OR%20servicing%20OR%20maintenance%20OR%20warranty%20OR%20workshop%20OR%20battery)%20(India%20OR%20Mumbai)&hl=en-IN&gl=IN&ceid=IN:en',
];

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

function headlineRank(item: RssItem, posted: { bike: boolean; service: boolean }) {
  if (!posted.service && isEvBikeServiceText(item.title)) return 0;
  if (!posted.bike && isEvBikeText(item.title)) return 1;
  return 2;
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

async function fetchFeed(url: string): Promise<RssItem[]> {
  const response = await fetch(url, {
    headers: { 'User-Agent': COMMONS_UA, Accept: 'application/rss+xml, application/xml, text/xml' },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
  if (!response.ok) return [];
  return parseRss(await response.text());
}

async function fetchHeadlines(): Promise<RssItem[]> {
  const batches = await Promise.all(RSS_FEEDS.map((url) => fetchFeed(url).catch(() => [] as RssItem[])));
  const seen = new Set<string>();
  const items: RssItem[] = [];
  for (const item of batches.flat()) {
    const key = headlineKey(item.title);
    if (!key || seen.has(key)) continue;
    if (!isAutomobileIndustryHeadline(item.title)) continue;
    seen.add(key);
    items.push(item);
  }
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
- Use only facts that are explicit in the supplied headline and source name. You may explain what that fact means for car and electric-scooter owners in Mumbai, Navi Mumbai, Thane, Palghar and Pune.
- Do not invent prices, percentages, dates, fines, mileage, or statistics.
- Do not use em dashes or en dashes. Use a comma, a full stop, or a hyphen in a number range (10-15).
- Do not mention MyFNG pickup, the MyFNG app, booking a service, fuel delivery, Prime, or "download the app".
- Write 450-700 words in HTML: one intro paragraph, then h2 sections, then a short "What to check" list.
- Include exactly one external link to source_url using source_name as the anchor.
- Include one internal link to https://myfng.in/automobile-news.
- image_query is 2-5 words naming a visible car, electric scooter, brand, showroom, workshop, traffic, or petrol pump from the headline. Example: "Mahindra XUV700", "Ather 450X", or "Ola electric scooter". Never a person, bank, keyboard, aircraft, or logo. If the headline has no vehicle, use "cars on road India" for cars and "electric scooter India" for scooters or bikes.
- The supplied headline is already confirmed automobile news. Always write the story. Do not return {"skip":true}.
- topic is exactly one of New Launch, EV News, Sales, Market, Industry. New Launch = a new car, price reveal, unveil, or facelift. EV News = an electric or hybrid car, an electric scooter or bike, or service, battery, warranty, and workshop news for an electric scooter or bike. Sales = monthly sales, volumes, or market share. Market = loans, rates, used cars, or resale. Industry = automakers, vehicle policy, and auto-industry news.
Return JSON: {"title":"","excerpt":"","content_html":"","image_query":"","topic":"New Launch"}`,
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
  if (parsed?.skip === true && !isAutomobileIndustryHeadline(item.title)) {
    throw new Error('Headline is not automobile news');
  }
  const newsStyle = { replaceVehicle: false as const };
  const title = polishAiProse(String(parsed?.title || '').trim(), newsStyle);
  const excerpt = polishAiProse(String(parsed?.excerpt || '').trim(), newsStyle);
  const html = polishAiHtml(stripMyFngServiceHtml(String(parsed?.content_html || '')), newsStyle);
  const topic = resolveNewsTopic(parsed?.topic, title, excerpt);
  const imageQuery = String(parsed?.image_query || '').replace(/[^\w\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!title || !excerpt || !html) throw new Error('AI response missing required fields');
  if (!isAutomobileIndustryHeadline(title) && !isAutomobileIndustryHeadline(item.title)) {
    throw new Error('Generated story is not automobile news');
  }
      if (/\b(protest|activist|police|arrest|murder|cricket|election)\b/i.test(title)) {
    throw new Error('Generated story is not automobile news');
  }
  const fallbackQuery = isEvBikeText(`${title} ${excerpt}`) ? 'electric scooter India' : 'indian car';
  return {
    title,
    excerpt,
    html,
    imageQuery: imageQuery || fallbackQuery,
    topic,
  };
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
const BAD_TITLE = /\b(navy|aircraft|air[- ]traffic|carrier|keyboard|warship|helicopter|fighter|soldier|sailor|cockpit|radar|missile|portrait|logo|diagram|uniform|submarine|taxi|geograph\.org\.uk|rally|raid|expedition|convoy|asean|numaligarh|emblem|badge|grille|lettering|crashed|waymo|robotaxi|interior|dashboard)\b/i;
const GENERIC_QUERY = /^(indian car|cars on road india|car|cars|automobile|new cars?|luxury cars?|suv|electric car)$/i;

const NAMED_BIKES: Array<{ test: RegExp; queries: string[]; file: RegExp }> = [
  { test: /ather/i, queries: ['Ather 450X', 'Ather scooter'], file: /ather/i },
  { test: /ola electric|ola s1|\bola\b/i, queries: ['Ola S1 Pro', 'Ola electric scooter'], file: /\bola\b/i },
  { test: /iqube/i, queries: ['TVS iQube'], file: /iqube/i },
  { test: /chetak/i, queries: ['Bajaj Chetak'], file: /chetak/i },
  { test: /\bvida\b/i, queries: ['Hero Vida electric scooter'], file: /vida/i },
  { test: /simple one|simple energy/i, queries: ['Simple One electric scooter'], file: /simple one|simple energy/i },
  { test: /vinfast/i, queries: ['VinFast Klara S on display', 'VinFast Vento S'], file: /vinfast/i },
];

const NAMED_CARS: Array<{ test: RegExp; queries: string[]; file: RegExp }> = [
  { test: /type\s*0[01]/i, queries: ['intitle:Jaguar Type 00'], file: /type 00/i },
  { test: /bigster/i, queries: ['intitle:Dacia Bigster', 'intitle:Renault Boreal'], file: /bigster|boreal/i },
  { test: /boreal/i, queries: ['intitle:Renault Boreal'], file: /boreal/i },
  { test: /elevate/i, queries: ['intitle:Honda Elevate'], file: /elevate/i },
  { test: /creta/i, queries: ['intitle:Hyundai Creta'], file: /creta/i },
  { test: /nexon/i, queries: ['intitle:Tata Nexon'], file: /nexon/i },
  { test: /xuv\s?7/i, queries: ['intitle:Mahindra XUV700'], file: /xuv\s?700/i },
  { test: /scorpio/i, queries: ['intitle:Mahindra Scorpio'], file: /scorpio/i },
  { test: /\bthar\b/i, queries: ['intitle:Mahindra Thar'], file: /\bthar\b/i },
  { test: /brezza/i, queries: ['intitle:Brezza'], file: /brezza/i },
  { test: /slavia/i, queries: ['intitle:Skoda Slavia'], file: /slavia/i },
  { test: /seltos/i, queries: ['intitle:Kia Seltos'], file: /seltos/i },
  { test: /virtus/i, queries: ['intitle:Virtus'], file: /virtus/i },
  { test: /kushaq/i, queries: ['intitle:Kushaq'], file: /kushaq/i },
  { test: /harrier/i, queries: ['intitle:Tata Harrier'], file: /harrier/i },
  { test: /innova/i, queries: ['intitle:Toyota Innova'], file: /innova/i },
  { test: /fortuner/i, queries: ['intitle:Fortuner'], file: /fortuner/i },
  { test: /\bpunch\b/i, queries: ['intitle:Tata Punch'], file: /\bpunch\b/i },
  { test: /fronx/i, queries: ['intitle:Fronx'], file: /fronx/i },
  { test: /\bexter\b/i, queries: ['intitle:Hyundai Exter'], file: /\bexter\b/i },
  { test: /\bvenue\b/i, queries: ['intitle:Hyundai Venue'], file: /\bvenue\b/i },
  { test: /alcazar/i, queries: ['intitle:Alcazar'], file: /alcazar/i },
  { test: /hector/i, queries: ['intitle:MG Hector'], file: /hector/i },
  { test: /kiger/i, queries: ['intitle:Renault Kiger'], file: /kiger/i },
  { test: /duster/i, queries: ['intitle:Renault Duster'], file: /duster/i },
];

const BRANDS: Array<{ test: RegExp; queries: string[]; file: RegExp }> = [
  { test: /\bbmw\b/i, queries: ['BMW iX', 'BMW i4'], file: /\bbmw\b/i },
  { test: /mercedes|\bbenz\b/i, queries: ['Mercedes-Benz W223', 'Mercedes-Benz S-Class'], file: /mercedes/i },
  { test: /\baudi\b/i, queries: ['Audi e-tron', 'Audi Q8'], file: /\baudi\b/i },
  { test: /jaguar/i, queries: ['Jaguar I-Pace', 'Jaguar F-Pace'], file: /i-pace|f-pace/i },
  { test: /lexus/i, queries: ['Lexus LX', 'Lexus ES'], file: /lexus/i },
  { test: /volvo/i, queries: ['Volvo XC90', 'Volvo XC60'], file: /volvo/i },
  { test: /porsche/i, queries: ['Porsche 911', 'Porsche Cayenne'], file: /porsche/i },
  { test: /land rover|range rover/i, queries: ['Range Rover'], file: /range rover|land rover/i },
  { test: /mahindra/i, queries: ['Mahindra XUV700 India'], file: /xuv\s?700|scorpio|\bthar\b/i },
  { test: /\btata\b/i, queries: ['Tata Nexon car India'], file: /nexon|harrier|\bpunch\b/i },
  { test: /hyundai/i, queries: ['Hyundai Creta India'], file: /creta|venue|alcazar/i },
  { test: /honda/i, queries: ['Honda Elevate', 'Honda City'], file: /elevate|\bcity\b/i },
  { test: /skoda/i, queries: ['Skoda Slavia car'], file: /slavia|kushaq/i },
  { test: /maruti/i, queries: ['Maruti Suzuki Brezza'], file: /brezza|swift|baleno/i },
  { test: /\bkia\b/i, queries: ['Kia Seltos'], file: /seltos/i },
  { test: /toyota/i, queries: ['Toyota Innova'], file: /innova|fortuner/i },
];

type PhotoSubject = 'supercar' | 'used' | 'showroom' | 'brand' | 'traffic' | 'luxury' | 'launch' | 'general';

function photoSubject(title: string): PhotoSubject {
  if (/supercar|\bimports?\b|classic/i.test(title)) return 'supercar';
  if (/used car|resale|second[- ]hand|pre-owned/i.test(title)) return 'used';
  if (/loan|repo|\brbi\b|\bemi\b|interest/i.test(title)) return 'showroom';
  if (BRANDS.some((brand) => brand.test.test(title))) return 'brand';
  if (/luxury/i.test(title)) return 'luxury';
  if (/launch|unveil|new cars|facelift/i.test(title)) return 'launch';
  if (/mumbai|petrol|diesel|fuel|traffic/i.test(title)) return 'traffic';
  return 'general';
}

function bikePhotoQueries(title: string, imageQuery: string) {
  const blob = `${title} ${imageQuery}`;
  if (!isEvBikeText(blob)) return null;
  const named = NAMED_BIKES.find((bike) => bike.test.test(blob));
  if (isEvBikeServiceText(blob)) {
    return named ? [...named.queries, 'electric scooter workshop'] : ['electric scooter workshop', 'Ather 450X', 'Ola electric scooter'];
  }
  return named ? named.queries : ['Ather 450X', 'Ola electric scooter', 'TVS iQube'];
}

function photoQueries(title: string, imageQuery: string) {
  const bikes = bikePhotoQueries(title, imageQuery);
  if (bikes) return bikes;
  const named = NAMED_CARS.find((car) => car.test.test(title) || car.test.test(imageQuery));
  if (named) return named.queries;
  const brand = BRANDS.find((item) => item.test.test(title) || item.test.test(imageQuery));
  if (brand) return brand.queries;
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
  } else if (subject === 'luxury') {
    add('Mercedes-Benz W223');
    add('BMW 7 Series');
  } else if (subject === 'launch') {
    add('Hyundai Creta India');
    add('Tata Nexon');
    add('Mahindra XUV700');
  } else if (subject === 'used') {
    if (/delhi/i.test(title)) add('Maruti Esteem Chandni Chowk Delhi');
    else if (/mumbai/i.test(title)) add('cars Mumbai India');
    else add('used cars India');
  } else if (subject === 'showroom') {
    add('Maruti Suzuki showroom India');
    add('car showroom India');
  } else if (subject === 'traffic') {
    if (/petrol|diesel|fuel/i.test(title)) add('Indian oil petrol station');
    else add('cars on road India');
  }
  if (!queries.length && imageQuery && !BAD_TITLE.test(imageQuery) && !GENERIC_QUERY.test(imageQuery)) add(imageQuery);
  if (!queries.length) {
    if (/delhi|traffic|grap|accident|crash|hit\b/i.test(title)) add('cars on road India');
    else if (/market|buyer|sales|share/i.test(title)) add('Maruti Suzuki Swift car');
    else add('Hyundai Creta India');
    add('Tata Nexon car');
  }
  return queries.slice(0, 3);
}

function photoMatches(fileTitle: string, articleTitle: string) {
  const title = fileTitle.toLowerCase();
  if (BAD_TITLE.test(title) || /taxi|geograph\.org\.uk|red bull|rallycross/.test(title)) return false;
  if (isEvBikeText(articleTitle)) {
    const named = NAMED_BIKES.find((bike) => bike.test.test(articleTitle));
    if (named) {
      if (!named.file.test(fileTitle)) return false;
      if (/battery/i.test(title) && !/battery/i.test(articleTitle)) return false;
      return true;
    }
    if (/\bola\b/i.test(title) && !/\bola\b/i.test(articleTitle)) return false;
    return /\b(scooter|ather|ola|iqube|chetak|vida|vinfast|motorcycle|workshop)\b/.test(title);
  }
  const named = NAMED_CARS.find((car) => car.test.test(articleTitle));
  if (named) return named.file.test(fileTitle);
  const brand = BRANDS.find((item) => item.test.test(articleTitle));
  if (brand) return brand.file.test(fileTitle);
  const subject = photoSubject(articleTitle);
  if (subject === 'supercar') return /lamborghini|ferrari|porsche|mclaren|bugatti|huracan|huracán|aventador/.test(title);
  if (subject === 'luxury') return /mercedes|bmw|audi|jaguar|lexus|porsche|bentley|rolls/.test(title);
  if (subject === 'launch') return /creta|nexon|xuv\s?700|harrier|seltos|venue|punch|innova/.test(title);
  if (subject === 'used') {
    if (/delhi/i.test(articleTitle)) return /delhi|chandni/.test(title) && /car|maruti|esteem|hyundai|honda/.test(title);
    return /used car|india/.test(title) && !/cairo|stallings|geograph|taxi/.test(title);
  }
  if (subject === 'showroom') return /showroom|dealership|motors/.test(title) && CAR_TITLE.test(title);
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
  const response = await fetch(endpoint, {
    headers: { 'User-Agent': COMMONS_UA },
    cache: 'no-store',
    signal: AbortSignal.timeout(20000),
  });
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
  const namedBrand = NAMED_BIKES.find((bike) => bike.test.test(articleTitle))
    || NAMED_CARS.find((car) => car.test.test(articleTitle))
    || BRANDS.find((brand) => brand.test.test(articleTitle));
  let loose: CommonsPhoto | null = null;
  for (const query of photoQueries(articleTitle, imageQuery)) {
    const photos = await searchCommons(query);
    for (const photo of photos) {
      const key = photo.title.toLowerCase();
      if (usedTitles.has(key)) continue;
      if (photoMatches(photo.title, articleTitle)) return photo;
      if (namedBrand) continue;
      if (!loose && CAR_TITLE.test(photo.title) && !BAD_TITLE.test(photo.title)) loose = photo;
    }
  }
  return loose;
}

async function uploadNewsWebp(supabaseAdmin: any, slug: string, webp: Buffer) {
  const storagePath = `blog-images/news-${slug}-${Date.now()}.webp`;
  const { error } = await supabaseAdmin.storage.from('service-media').upload(storagePath, webp, {
    contentType: 'image/webp',
    upsert: true,
    cacheControl: '3600',
  });
  if (error) throw new Error(error.message || 'Failed to upload news photo');
  return mediaPathFromStorage('service-media', storagePath);
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
  return uploadNewsWebp(supabaseAdmin, slug, webp);
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

async function listTodayAutomobileNews(supabaseAdmin: any, runDate: string) {
  const { data, error } = await supabaseAdmin
    .from('blogs')
    .select('id, seo_data')
    .eq('status', 'published')
    .filter('seo_data->>ai_daily_news_date', 'eq', runDate)
    .order('published_at', { ascending: false })
    .limit(20);
  if (error) throw new Error(error.message || 'Could not count today\'s news');
  return (data || []).filter((row: any) => {
    const seo = row?.seo_data || {};
    return seo.ai_daily_news === true && String(seo.ai_daily_news_date || '') === runDate;
  });
}

export async function countAutomobileNewsPostedToday(supabaseAdmin: any, runDate = istDateString()) {
  const rows = await listTodayAutomobileNews(supabaseAdmin, runDate);
  return rows.length;
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

  const slotRows = await listTodayAutomobileNews(supabaseAdmin, runDate);
  const filledSlots = slotRows
    .map((row: any) => row?.seo_data || {})
    .map((seo: any) => String(seo.ai_daily_news_slot || ''))
    .filter((slot: string) => /^\d{2}:\d{2}$/.test(slot));
  const openSlot = earliestUnfilledAutomobileNewsSlot(filledSlots);
  const slot = openSlot || (opts?.force || opts?.ignorePause ? 'manual' : null);
  if (!slot) {
    return {
      success: true,
      skipped: true,
      reason: filledSlots.length ? 'slot_filled' : 'outside_slot',
      posted_today: postedToday,
      quota: AUTOMOBILE_NEWS_PER_DAY,
    };
  }

  const { data: recent } = await supabaseAdmin
    .from('blogs')
    .select('title, seo_data, content')
    .eq('status', 'published')
    .order('published_at', { ascending: false })
    .limit(200);
  const used = new Set<string>();
  const usedTitles: string[] = [];
  const usedPhotos = new Set<string>();
  const postedEv = { bike: false, service: false };
  for (const row of recent || []) {
    const seo = (row as any)?.seo_data || {};
    if (seo.ai_daily_news === true && String(seo.ai_daily_news_date || '') === runDate) {
      const title = String((row as any)?.title || '');
      if (isEvBikeServiceText(title)) postedEv.service = true;
      else if (isEvBikeText(title)) postedEv.bike = true;
    }
    if (seo.news_headline_key) {
      used.add(String(seo.news_headline_key));
      usedTitles.push(String(seo.news_headline_key));
    }
    const commonsTitle = String(seo.news_commons_title || '').trim()
      || (String((row as any)?.content || '').match(/Reference photo:\s*([^.]{3,180}?\.(?:jpg|jpeg|png|webp))/i)?.[1] || '');
    if (commonsTitle) usedPhotos.add(commonsTitle.toLowerCase());
    const rowTitle = String((row as any)?.title || '');
    used.add(headlineKey(rowTitle));
    if (rowTitle) usedTitles.push(rowTitle);
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

  const ranked = headlines
    .filter((item) => !used.has(headlineKey(item.title)))
    .filter((item) => !usedTitles.some((title) => isSameAutomobileStory(item.title, title)))
    .sort((a, b) => headlineRank(a, postedEv) - headlineRank(b, postedEv));
  const fresh: RssItem[] = [];
  for (const item of ranked) {
    if (fresh.some((previous) => isSameAutomobileStory(item.title, previous.title))) continue;
    fresh.push(item);
  }
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
  for (const item of fresh.slice(0, 12)) {
    try {
      const draft = await openaiNews(item);
      if (usedTitles.some((previous) => isSameAutomobileStory(draft.title, previous) || isSameAutomobileStory(item.title, previous))) {
        throw new Error('Story already posted');
      }
      const photo = await pickNewsPhoto(draft.title, draft.imageQuery, usedPhotos);
      const slug = await uniqueSlug(supabaseAdmin, draft.title);
      let imageUrl = '';
      const html = ensureSourceLink(draft.html, item);
      let caption = '';
      try {
        if (photo) {
          imageUrl = await uploadPhoto(supabaseAdmin, slug, photo);
          caption = `Reference photo: ${photo.title}. ${photo.artist}. ${photo.license}. Via Wikimedia Commons.`;
          usedPhotos.add(photo.title.toLowerCase());
        } else {
          const webPhoto = await findNewsWebPhoto(draft.imageQuery || draft.title);
          if (webPhoto) {
            imageUrl = await uploadNewsWebp(supabaseAdmin, slug, await buildNewsPhotoCover(webPhoto, draft.title));
          }
        }
      } catch {
        imageUrl = '';
        caption = '';
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
        news_topic: draft.topic,
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
        published_at: /^\d{2}:\d{2}$/.test(slot) ? `${runDate}T${slot}:00` : istWallClock(),
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

      try {
        revalidateBlogSeo(String(blog.slug || slug));
      } catch {
        // Publishing still stands when this runs outside a Next.js request.
      }

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
      const message = String(error?.message || error || lastError);
      lastError = `${item.title}: ${message}`.slice(0, 500);
    }
  }

  return {
    success: false,
    error: lastError,
    posted_today: postedToday,
    quota: AUTOMOBILE_NEWS_PER_DAY,
  };
}
