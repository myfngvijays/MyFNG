const STOPWORDS = new Set([
  'a','an','and','are','as','at','be','by','for','from','has','have','how','i','in','is','it','its','of','on','or','that','the','this','to','was','were','what','when','where','which','who','why','with',
  // common filler words (en/hinglish)
  'your','you','we','our','myfng','car','cars','service','services','best','near','nearby','in','at',
]);

function normalizeWord(w: string) {
  return String(w || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '')
    .trim();
}

export function extractKeywordsFromSummary(summary: string, max = 10): string {
  const text = String(summary || '').trim();
  if (!text) return '';

  const words = text
    .split(/\s+/)
    .map((w) => normalizeWord(w))
    .filter((w) => w.length >= 4 && !STOPWORDS.has(w));

  const freq = new Map<string, number>();
  for (const w of words) freq.set(w, (freq.get(w) || 0) + 1);

  const ranked = Array.from(freq.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([w]) => w)
    .slice(0, max);

  return ranked.join(', ');
}

export function autoFillSeoFromSummary(
  excerpt: string | null | undefined,
  seoData: any
): any {
  const seo = { ...(seoData || {}) };
  const summary = String(excerpt || '').trim();
  if (!summary) return seo;

  const metaDesc = String(seo.meta_description || '').trim();
  if (!metaDesc) seo.meta_description = summary.slice(0, 155);

  const kw = String(seo.keywords || '').trim();
  if (!kw) seo.keywords = extractKeywordsFromSummary(summary, 10);

  return seo;
}


