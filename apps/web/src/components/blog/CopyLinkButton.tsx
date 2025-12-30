'use client';

import { useState } from 'react';
import { Link2 } from 'lucide-react';

export default function CopyLinkButton({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  return (
    <button
      type="button"
      className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-full transition text-gray-700 text-xs sm:text-sm font-semibold"
      title={copied ? 'Copied!' : 'Copy link'}
      onClick={() => {
        const shareUrl = String(url || '').trim();
        if (!shareUrl) return;
        if (typeof navigator !== 'undefined' && navigator.clipboard) {
          navigator.clipboard
            .writeText(shareUrl)
            .then(() => {
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            })
            .catch(() => null);
        }
      }}
    >
      <Link2 className="w-4 h-4" />
      {copied ? 'Copied' : 'Copy Link'}
    </button>
  );
}


