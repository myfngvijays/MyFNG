'use client';

import { Sparkles } from 'lucide-react';

export default function AIFeatureBadge({ text }: { text: string }) {
  return (
    <div className="inline-flex max-w-full items-center gap-2 rounded-full border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-purple-500/10 px-3 py-1.5 sm:px-4 sm:py-2">
      <Sparkles className="h-4 w-4 flex-shrink-0 text-blue-500" />
      <span className="text-xs sm:text-sm font-semibold leading-snug bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
        {text}
      </span>
    </div>
  );
}

