import { normalizeBlogHtmlMedia } from '@/lib/blog/normalizeBlogMedia';

const LEGACY_PHONE_REPLACEMENTS: Array<[RegExp, string]> = [
  [/\+91[-\s]?9772215095/gi, '+91-9152307030'],
  [/\+91[-\s]?9610448949/gi, '+91-9152307030'],
  [/9772215095/g, '9152307030'],
  [/9610448949/g, '9152307030'],
];

function fixInternalHref(href: string): string {
  const raw = String(href || '').trim();
  if (!raw || raw.startsWith('#') || raw.startsWith('mailto:') || raw.startsWith('tel:')) return raw;
  if (/^https?:\/\//i.test(raw)) return raw;

  const withoutParents = raw.replace(/^(?:\.\.\/)+/, '').replace(/^\/+/, '');
  if (!withoutParents) return raw;
  return `/${withoutParents}`;
}

function isContactOrTaglineLine(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (/^contact\s+my\s*fng/i.test(t)) return true;
  if (/^(website|support\s*\/\s*inquiry|rsa|email)\b/i.test(t)) return true;
  if (/friendly neighbourhood garage/i.test(t)) return true;
  if (/multi-brand car servicing/i.test(t)) return true;
  if (/^\+91[-\s]?\d{10}$/.test(t.replace(/\s/g, ''))) return true;
  return false;
}

/** Remove AI/Word boilerplate contact footer pasted at end of blog posts (page already has site footer). */
function stripTrailingContactBoilerplate(html: string): string {
  const markers = [
    /(?:<h2>\s*Contact\s+My\s*FNG\s*<\/h2>|<p[^>]*data-blog-contact-start[^>]*>\s*<strong>\s*Contact\s+My\s*FNG)/i,
    /<p[^>]*>\s*<strong>\s*Website\s*:\s*<\/strong>/i,
    /<p[^>]*>\s*<strong>\s*Support\s*\/\s*Inquiry\s*:/i,
    /<p[^>]*>\s*<strong>\s*MyFNG[^<]*Friendly Neighbourhood Garage[^<]*<\/strong>\s*<\/p>/i,
  ];

  let cutAt: number | null = null;
  for (const marker of markers) {
    const match = html.match(marker);
    if (match?.index != null && match.index >= html.length * 0.25) {
      cutAt = cutAt == null ? match.index : Math.min(cutAt, match.index);
    }
  }

  let s = cutAt != null ? html.slice(0, cutAt).trim() : html;
  s = s.replace(
    /<p[^>]*>\s*<strong>\s*MyFNG[^<]*Friendly Neighbourhood Garage[^<]*<\/strong>\s*<\/p>\s*(?:<p[^>]*>\s*<strong>\s*Multi-Brand[^<]*<\/strong>\s*<\/p>\s*)+$/i,
    '',
  );
  s = s.replace(/<p[^>]*>\s*<strong>\s*Multi-Brand Car Servicing[^<]*<\/strong>\s*<\/p>\s*$/i, '');
  return s.trim();
}

/** Normalize blog HTML from Word paste or rich editor — safe for storage and public display. */
export function normalizeBlogContent(html: string): string {
  let s = normalizeBlogHtmlMedia(String(html || ''));
  if (!s.trim()) return s;

  for (const [pattern, replacement] of LEGACY_PHONE_REPLACEMENTS) {
    s = s.replace(pattern, replacement);
  }

  // Microsoft Word export noise.
  s = s.replace(/<\/?span[^>]*>/gi, '');
  s = s.replace(/\sclass="MsoNormal"/gi, '');
  s = s.replace(/\sstyle="[^"]*"/gi, '');
  s = s.replace(/\stype="disc"/gi, '');
  s = s.replace(/\stype="1"/gi, '');

  // Normalize list containers/items (Word adds classes that break Tailwind list styling).
  s = s.replace(/<ul[^>]*>/gi, '<ul>');
  s = s.replace(/<ol[^>]*>/gi, '<ol>');
  s = s.replace(/<li[^>]*>/gi, '<li>');

  // Fix broken relative links from Word exports.
  s = s.replace(/\shref="([^"]+)"/gi, (full, href: string) => {
    const next = fixInternalHref(href);
    return next === href ? full : ` href="${next}"`;
  });

  // Word often uses bold paragraphs instead of semantic headings.
  s = s.replace(/<p>\s*<strong>([^<]{4,180})<\/strong>\s*<\/p>/gi, (_full, rawTitle: string) => {
    const title = rawTitle.trim();
    if (!title) return '';
    if (/^contact\s+my\s*fng/i.test(title)) return `<p data-blog-contact-start="1"><strong>${title}</strong></p>`;
    if (isContactOrTaglineLine(title)) return '';
    if (/^(website|support\s*\/\s*inquiry|rsa|email)\b/i.test(title)) {
      return `<p class="blog-meta-line"><strong>${title}</strong></p>`;
    }
    if (/^\d+\.\s/.test(title)) return `<h3>${title}</h3>`;
    if (title.length <= 90 && !/[.!?]$/.test(title) && !title.includes(':')) return `<h2>${title}</h2>`;
    return `<p><strong>${title}</strong></p>`;
  });

  s = s.replace(/<p>\s*<\/p>/gi, '');
  s = stripTrailingContactBoilerplate(s);
  return s;
}

/** @deprecated use normalizeBlogContent */
export const normalizeBlogContentForDisplay = normalizeBlogContent;
