'use client';

import { Sparkles } from 'lucide-react';

export default function AIFeatureBadge({ text }: { text: string }) {
  return (
    <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-purple-500/10 border border-blue-500/20 rounded-full px-4 py-2 animate-pulse-glow">
      <Sparkles className="w-4 h-4 text-blue-500 animate-float" />
      <span className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
        {text}
      </span>
    </div>
  );
}

