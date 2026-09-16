import { stripAiOverviewHtml } from '@/lib/blog/dailyAiOverview';
import { stripExistingCta } from '@/lib/blog/aiLinks';

function stripDivByAttr(html: string, pattern: RegExp) {
  const source = String(html || '');
  const start = source.search(pattern);
  if (start < 0) return source;
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
  return source;
}

function stripHeadingSection(html: string, headingRe: RegExp) {
  return String(html || '').replace(
    new RegExp(`<h2\\b[^>]*>\\s*(?:${headingRe.source})[\\s\\S]*?(?=<h2\\b|$)`, 'gi'),
    '',
  );
}

export function isNewsCarBlog(seo?: Record<string, unknown> | null) {
  return Boolean(seo && (seo as any).ai_news_car);
}

export function isMyFngServiceFaq(question: string, answer = '') {
  return /myfng|pickup and drop|book (a |your )?(car )?service|starts from|₹\s*1,?500|whatsapp-only|workshop pickup|download the (myfng )?app/i.test(
    `${question} ${answer}`,
  );
}

export function stripMyFngServiceHtml(html: string) {
  let source = stripExistingCta(String(html || ''));
  source = stripAiOverviewHtml(source);
  source = stripDivByAttr(source, /<div\b[^>]*(?:data-myfng-about|blog-about-myfng)/i);
  source = stripDivByAttr(source, /<div\b[^>]*(?:blog-post-cta|data-myfng-cta)/i);
  source = source.replace(/<p\b[^>]*data-local-seo[\s\S]*?<\/p>/gi, '');
  source = stripHeadingSection(source, /About MyFNG|Book on the MyFNG(?: app)?|Summary recommendation/);
  source = source.replace(/\bDownload the MyFNG app\b/gi, 'check the official dealer');
  source = source.replace(/\bBook on the MyFNG app[^.<]*/gi, 'Ask the dealer for the first-service schedule');
  return source.replace(/\n{3,}/g, '\n\n').trim();
}
