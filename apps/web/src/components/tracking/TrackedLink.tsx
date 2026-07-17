'use client';

import Link from 'next/link';
import { useEffect, useState, type ComponentProps } from 'react';
import { appendUtmToHref } from '@/lib/utm';

type LinkProps = ComponentProps<typeof Link>;

function trackHref(href: LinkProps['href']): LinkProps['href'] {
  if (typeof href === 'string') return appendUtmToHref(href);
  if (href && typeof href === 'object' && 'pathname' in href && typeof href.pathname === 'string') {
    const query =
      href.query && typeof href.query === 'object'
        ? (href.query as Record<string, string>)
        : undefined;
    const search = query
      ? `?${new URLSearchParams(query).toString()}`
      : typeof href.search === 'string'
        ? href.search
        : '';
    const tracked = appendUtmToHref(`${href.pathname}${search}`);
    const [pathname, searchPart = ''] = tracked.split('?');
    return { ...href, pathname, search: searchPart ? `?${searchPart}` : '' };
  }
  return href;
}

/** UTM is read from browser storage — apply after mount to avoid SSR/client href mismatch. */
export default function TrackedLink({ href, ...props }: LinkProps) {
  const [resolvedHref, setResolvedHref] = useState(href);

  useEffect(() => {
    setResolvedHref(trackHref(href));
  }, [href]);

  return <Link href={resolvedHref} {...props} />;
}
