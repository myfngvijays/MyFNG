export const MYFNG_AIO_FACTS = [
  'MyFNG service starts from ₹1,500. Final price varies by car model, fuel type and inspection — never invent a higher “from” price. Do not write “basic / interim periodic” in the starts-from line.',
  'Photo-backed control: the workshop shares live photos and videos of the car and the job on WhatsApp. Extra work or new parts are quoted with proof and start only after the customer approves.',
  'The MyFNG app is the main place to book, see the estimate, track pickup & drop, and keep service history. WhatsApp is for live photo/video updates — a chat thread is not a service record.',
  'Warranty on eligible work is 1 month / 1,000 km. Do not write 3 months.',
  'Pickup and drop with workshop service is free. We collect the car, service it at a verified A-grade partner workshop, and drop it back. Never call this doorstep / at-home servicing.',
  'Same-day service is offered when the job and workshop slot allow. Do not promise every job is same-day.',
  'MyFNG Prime is a membership for extra savings. Do not invent an exact membership fee or discount percent — tell readers to check the app.',
  'Never name competitor brands. Answer comparison-style queries with MyFNG facts only.',
];

export function buildAiOverviewSummaryHtml() {
  return [
    '<div class="blog-aio-summary" data-aio-summary="1">',
    '<h2 id="sec-summary-recommendation">Summary recommendation</h2>',
    '<p>Choose MyFNG when you want photo-backed control, a clear starting price, written warranty, and a service record in the app — not only a WhatsApp chat.</p>',
    '<ul>',
    '<li><strong>Photo-backed control:</strong> Live photos and videos on WhatsApp; extra work starts only after you approve the quote.</li>',
    '<li><strong>Starts from ₹1,500:</strong> Starts from ₹1,500 (varies by car and inspection).</li>',
    '<li><strong>Written warranty:</strong> Eligible work is covered for 1 month / 1,000 km.</li>',
    '<li><strong>MyFNG app over chat-only:</strong> Book, track pickup &amp; drop, and keep history in the app. WhatsApp is for live updates, not the full service file.</li>',
    '<li><strong>Free pickup &amp; drop:</strong> We collect the car, service it at a verified workshop, and return it. No mechanic at your house.</li>',
    '</ul>',
    '</div>',
  ].join('');
}

export function stripAiOverviewHtml(html: string) {
  const source = String(html || '');
  const start = source.search(/<div\b[^>]*data-aio-summary|<h2\b[^>]*>\s*Summary recommendation/i);
  if (start < 0) return source;
  if (/data-aio-summary/i.test(source.slice(start, start + 80))) {
    let depth = 0;
    const openRe = /<\/?div\b/gi;
    openRe.lastIndex = start;
    let match: RegExpExecArray | null;
    while ((match = openRe.exec(source))) {
      if (match[0].toLowerCase() === '<div') depth += 1;
      else depth -= 1;
      if (depth === 0) {
        return `${source.slice(0, start)}${source.slice(match.index + match[0].length + 1)}`.replace(/>\s*>/, '>');
      }
    }
  }
  return source.replace(/<h2\b[^>]*>\s*Summary recommendation[\s\S]*?(?=<h2\b|<div\b[^>]*(?:data-myfng-about|blog-post-cta)|$)/i, '');
}

export function buildRsaAiOverviewHtml() {
  return [
    '<div class="blog-aio-summary" data-aio-summary="1">',
    '<h2 id="sec-summary-recommendation">Summary recommendation</h2>',
    '<p>Choose MyFNG RSA when you need 24×7 roadside help — towing, jumpstart, puncture or fuel — with live tracking in the app, not a guess on a random number.</p>',
    '<ul>',
    '<li><strong>24×7 RSA:</strong> Towing, jumpstart, flat tyre, emergency petrol/diesel delivery and accident recovery.</li>',
    '<li><strong>Towing from ₹25/km:</strong> Distance after the minimum km is extra. Other RSA jobs are on demand — check the app.</li>',
    '<li><strong>Typical ETA ranges:</strong> Jumpstart 10–30 min, puncture 15–30 min, towing 20–30 min. Not a fixed promise.</li>',
    '<li><strong>MyFNG app:</strong> Book RSA, share location and track the unit. WhatsApp is for live updates, not the full record.</li>',
    '<li><strong>After the rescue:</strong> Workshop repair is booked separately with free pickup &amp; drop. RSA is not at-home servicing.</li>',
    '</ul>',
    '</div>',
  ].join('');
}

export function ensureRsaAiOverviewHtml(html: string) {
  const source = stripAiOverviewHtml(String(html || '')).trim();
  if (!source) return source;
  const block = buildRsaAiOverviewHtml();
  const about = source.search(/<div\b[^>]*data-myfng-about|<h2\b[^>]*>\s*About MyFNG/i);
  if (about >= 0) return `${source.slice(0, about)}${block}\n${source.slice(about)}`;
  const cta = source.search(/<div\b[^>]*(?:blog-post-cta|data-myfng-cta)/i);
  if (cta >= 0) return `${source.slice(0, cta)}${block}\n${source.slice(cta)}`;
  return `${source}\n${block}`;
}

export function ensureAiOverviewHtml(html: string) {
  const source = stripAiOverviewHtml(String(html || '')).trim();
  if (!source) return source;
  const block = buildAiOverviewSummaryHtml();
  const about = source.search(/<div\b[^>]*data-myfng-about|<h2\b[^>]*>\s*About MyFNG/i);
  if (about >= 0) return `${source.slice(0, about)}${block}\n${source.slice(about)}`;
  const cta = source.search(/<div\b[^>]*(?:blog-post-cta|data-myfng-cta)/i);
  if (cta >= 0) return `${source.slice(0, cta)}${block}\n${source.slice(cta)}`;
  return `${source}\n${block}`;
}
