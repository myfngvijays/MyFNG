/** Surface style for MyFNG blog copy. Structure and SEO rules stay in the generator. */
export const MYFNG_SURFACE_STYLE = `
Surface style (mandatory):
- Write "car" or "cars". Never write "vehicle" or "vehicles".
- Do not use em dashes (—) or en dashes (–). Join the sentence with a comma or a full stop. Number ranges use a hyphen: 10-15 minutes.
- Do not use Furthermore, Moreover, Additionally, In conclusion, or "It's important to note".
- Do not open with "In today's world", "When it comes to", or "Are you looking for".
- Do not use delve, robust, seamless, comprehensive, or landscape.
`.trim();

function matchWordCase(source: string, replacement: string) {
  if (source === source.toUpperCase()) return replacement.toUpperCase();
  if (source[0] === source[0].toUpperCase()) {
    return replacement[0].toUpperCase() + replacement.slice(1);
  }
  return replacement;
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function applyOutsidePhrases(text: string, phrases: string[], fn: (part: string) => string) {
  const unique = [...new Set(phrases.map((p) => p.trim()).filter((p) => p.length >= 2))];
  if (!unique.length) return fn(text);
  unique.sort((a, b) => b.length - a.length);
  const re = new RegExp(unique.map(escapeRegExp).join('|'), 'g');
  let out = '';
  let last = 0;
  for (const match of text.matchAll(re)) {
    const index = match.index ?? 0;
    out += fn(text.slice(last, index));
    out += match[0];
    last = index + match[0].length;
  }
  out += fn(text.slice(last));
  return out;
}

function flattenDashes(text: string) {
  return text
    .replace(/&mdash;|&#8212;|&#x2014;/gi, '—')
    .replace(/&ndash;|&#8211;|&#x2013;/gi, '–')
    .replace(/(\d)\s*[—–]\s*(\d)/g, '$1-$2')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+--\s+/g, ', ')
    .replace(/,\s*,+/g, ',')
    .replace(/\s+,/g, ',')
    .replace(/([.!?]),/g, '$1')
    .replace(/,\s+\./g, '.')
    .replace(/[ \t]{2,}/g, ' ');
}

function stripStockTransitions(text: string) {
  return text.replace(
    /(^|[.!?]\s+)(?:Furthermore|Moreover|Additionally|In conclusion),\s+([a-z])?/gi,
    (_full, lead: string, letter?: string) => `${lead}${letter ? letter.toUpperCase() : ''}`,
  );
}

function carsForVehicles(text: string) {
  return text
    .replace(/\bvehicles\b/gi, (word) => matchWordCase(word, 'cars'))
    .replace(/\bvehicle\b/gi, (word) => matchWordCase(word, 'car'));
}

export function polishAiProse(
  text: string,
  opts?: { replaceVehicle?: boolean; protectPhrases?: string[] },
) {
  const replaceVehicle = opts?.replaceVehicle !== false;
  const protect = opts?.protectPhrases || [];
  return applyOutsidePhrases(String(text || ''), protect, (part) => {
    let next = flattenDashes(part);
    next = stripStockTransitions(next);
    if (replaceVehicle) next = carsForVehicles(next);
    return next;
  }).replace(/[ \t]{2,}/g, ' ');
}

/** Edits visible text only. Leaves tags, hrefs, and other attributes unchanged. */
export function polishAiHtml(
  html: string,
  opts?: { replaceVehicle?: boolean; protectPhrases?: string[] },
) {
  return String(html || '').replace(/>([^<]*)</g, (full, inner: string) => {
    if (!inner) return full;
    return `>${polishAiProse(inner, opts)}<`;
  });
}
