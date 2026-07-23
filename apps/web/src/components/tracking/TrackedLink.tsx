'use client';

import Link from 'next/link';
import type { ComponentProps } from 'react';

type LinkProps = ComponentProps<typeof Link>;

/** Internal navigation link — UTM attribution is stored silently, not appended to URLs. */
export default function TrackedLink(props: LinkProps) {
  return <Link {...props} />;
}
