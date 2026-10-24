'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Calendar } from 'lucide-react';

const UTM_KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'] as const;

export default function ServiceBookButton({ href, title }: { href: string; title: string }) {
  const params = useSearchParams();
  const url = new URL(href, 'https://myfng.in');
  for (const key of UTM_KEYS) {
    const value = params.get(key);
    if (value && !url.searchParams.get(key)) url.searchParams.set(key, value);
  }

  return (
    <Link
      href={`${url.pathname}${url.search}`}
      className="btn btn-primary inline-flex items-center gap-2 px-6 py-3 text-sm sm:px-8 sm:py-4 sm:text-base"
    >
      Book {title}
      <Calendar className="h-4 w-4 sm:h-5 sm:w-5" />
    </Link>
  );
}
