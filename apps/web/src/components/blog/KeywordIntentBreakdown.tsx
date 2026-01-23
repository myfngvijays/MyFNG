import { useMemo } from 'react';
import { stripHtmlToText } from '@/lib/blog/text';

type Breakdown = {
  informational: number;
  transactional: number;
  navigational: number;
  branded: number;
  total: number;
};

function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function normalizeKeywordList(input: string): string[] {
  const raw = String(input || '')
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean);
  return Array.from(new Set(raw));
}

function countOccurrences(haystack: string, needle: string): number {
  const n = String(needle || '').trim();
  if (!n) return 0;

  // Allow flexible whitespace inside phrases.
  const parts = n.split(/\s+/).filter(Boolean).map(escapeRegExp);
  const pattern = parts.join('\\s+');
  const re = new RegExp(`\\b${pattern}\\b`, 'gi');
  const matches = haystack.match(re);
  return matches ? matches.length : 0;
}

function classifyIntent(keyword: string): keyof Breakdown {
  const k = String(keyword || '').toLowerCase();

  // Branded (MyFNG)
  if (k.includes('myfng') || k.includes('my fng') || k.includes('myfng.in') || k.includes('myfng.cloud') || /\bfng\b/.test(k)) {
    return 'branded';
  }

  // Navigational
  if (
    /(login|dashboard|contact|address|phone|helpline|support|map|directions|route|website|app|download|official|portal)\b/.test(k) ||
    /https?:\/\//.test(k)
  ) {
    return 'navigational';
  }

  // Transactional
  if (/(price|cost|quote|estimate|offer|discount|deal|book|booking|appointment|buy|order|subscribe)\b/.test(k)) {
    return 'transactional';
  }

  // Informational triggers (default)
  if (/(how|what|why|when|where|guide|tips|meaning|symptoms|causes|benefits|vs|difference|checklist)\b/.test(k)) {
    return 'informational';
  }

  return 'informational';
}

export default function KeywordIntentBreakdown({
  title,
  excerpt,
  contentHtml,
  focusKeywords,
}: {
  title?: string;
  excerpt?: string;
  contentHtml?: string;
  focusKeywords?: string;
}) {
  const breakdown = useMemo((): Breakdown => {
    const text = [title, excerpt, stripHtmlToText(String(contentHtml || ''))]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const keywords = normalizeKeywordList(String(focusKeywords || ''));

    const acc: Breakdown = { informational: 0, transactional: 0, navigational: 0, branded: 0, total: 0 };
    for (const kw of keywords) {
      const count = countOccurrences(text, kw);
      if (!count) continue;
      const bucket = classifyIntent(kw);
      acc[bucket] += count;
      acc.total += count;
    }
    return acc;
  }, [title, excerpt, contentHtml, focusKeywords]);

  return (
    <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <div className="text-xs font-semibold text-slate-800">Keyword Intent Breakdown (Total Occurrences)</div>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-700">
        <div>Informational: {breakdown.informational}</div>
        <div>Transactional: {breakdown.transactional}</div>
        <div>Navigational: {breakdown.navigational}</div>
        <div>Branded: {breakdown.branded}</div>
      </div>
      <div className="mt-2 text-[11px] text-slate-600">
        ये numbers blog article में मौजूद keywords की count दिखाते हैं। Keyword intent का article की length से कोई लेना-देना नहीं है, यह केवल keyword
        occurrences पर आधारित होता है।
      </div>
      {breakdown.total === 0 ? (
        <div className="mt-1 text-[11px] text-amber-700">Tip: Focus Keyword field में comma-separated keywords डालें, फिर counts auto दिखेंगे.</div>
      ) : null}
    </div>
  );
}

