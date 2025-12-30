'use client';

import { useEffect, useState } from 'react';

export default function ViewCounter({ slug, initialViews }: { slug: string; initialViews: number }) {
  const [views, setViews] = useState<number>(Number(initialViews || 0));

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        const res = await fetch('/api/blogs/track-view', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ slug }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const next = Number(data?.views || 0);
        if (!cancelled && Number.isFinite(next) && next >= 0) setViews(next);
      } catch {
        // ignore
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  return <span>{views.toLocaleString('en-IN')}</span>;
}


