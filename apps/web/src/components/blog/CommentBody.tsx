'use client';

import { useState, type ReactNode } from 'react';

const URL_RE = /https?:\/\/[^\s<]+/g;

function splitTrailing(url: string) {
  const match = url.match(/^(.*?)([),.!?:;]+)$/);
  if (!match) return { href: url, rest: '' };
  return { href: match[1], rest: match[2] };
}

export default function CommentBody({
  text,
  className,
  compact = false,
}: {
  text: string;
  className?: string;
  compact?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const long = compact && (text.length > 180 || text.split('\n').length > 3);
  const parts: ReactNode[] = [];
  let last = 0;
  let index = 0;
  for (const match of text.matchAll(URL_RE)) {
    const start = match.index ?? 0;
    if (start > last) parts.push(text.slice(last, start));
    const { href, rest } = splitTrailing(match[0]);
    parts.push(
      <a
        key={`link-${index}`}
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[#0a4ea3] underline break-all"
      >
        {href}
      </a>,
    );
    if (rest) parts.push(rest);
    last = start + match[0].length;
    index += 1;
  }
  if (last < text.length) parts.push(text.slice(last));

  return (
    <div className={className}>
      <p className={`whitespace-pre-wrap break-words ${long && !open ? 'line-clamp-3' : ''}`}>{parts}</p>
      {long ? (
        <button type="button" onClick={() => setOpen((value) => !value)} className="mt-1 text-xs font-semibold text-[#023D95] hover:underline">
          {open ? 'Show less' : 'Show more'}
        </button>
      ) : null}
    </div>
  );
}
