import type { ReactNode } from 'react';
import { buildManagedPageMetadata } from '@/lib/site-page-seo';

export async function generateMetadata() {
  return buildManagedPageMetadata('/data-rights');
}

export default function DataRightsLayout({ children }: { children: ReactNode }) {
  return children;
}
