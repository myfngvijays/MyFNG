export function stripHtmlToText(html: string): string {
  const s = String(html || '');
  // Remove scripts/styles
  const noScripts = s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, ' ');
  const noStyles = noScripts.replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, ' ');
  // Remove tags
  const noTags = noStyles.replace(/<[^>]+>/g, ' ');
  // Decode minimal entities (enough for word counting)
  const decoded = noTags
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'");
  return decoded.replace(/\s+/g, ' ').trim();
}

export function countWords(text: string): number {
  const t = String(text || '').trim();
  if (!t) return 0;
  return t.split(/\s+/).filter(Boolean).length;
}

// Spec: 100 words per minute (e.g. 500 words => 5 min read)
export function computeReadTimeFromHtml(html: string): { words: number; minutes: number } {
  const words = countWords(stripHtmlToText(html));
  const minutes = Math.max(1, Math.ceil(words / 100));
  return { words, minutes };
}

type ImgAltCheck = { ok: true } | { ok: false; error: string };

function extractAltFromImgTag(tag: string): string | null {
  // Handles alt="...", alt='...', alt=unquoted
  const m = tag.match(/\balt\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
  const alt = (m?.[1] ?? m?.[2] ?? m?.[3] ?? null) as string | null;
  if (alt == null) return null;
  // Remove surrounding quotes for unquoted cases (already handled), trim whitespace.
  return String(alt).trim();
}

export function validateAllImgHaveAlt(html: string, maxAltChars = 125): ImgAltCheck {
  const s = String(html || '');
  const imgTags = s.match(/<img\b[^>]*>/gi) || [];
  for (const tag of imgTags) {
    const alt = extractAltFromImgTag(tag);
    if (!alt) {
      return { ok: false, error: 'Every image must have an ALT tag (missing alt="" on an <img>).' };
    }
    if (alt.length > maxAltChars) {
      return { ok: false, error: `ALT tag too long (max ${maxAltChars} chars).` };
    }
  }
  return { ok: true };
}

export function collectHeadingWordWarnings(html: string, maxWords = 10): string[] {
  const s = String(html || '');
  const warnings: string[] = [];
  const re = /<(h2|h3)\b[^>]*>([\s\S]*?)<\/\1>/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(s))) {
    const headingText = stripHtmlToText(match[2] || '');
    const wc = countWords(headingText);
    if (wc > maxWords) {
      warnings.push(`Heading too long (${wc} words). Recommended max ${maxWords} words for H2/H3.`);
    }
  }
  return warnings;
}


