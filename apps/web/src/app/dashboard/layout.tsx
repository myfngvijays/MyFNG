import { Suspense } from 'react';
import { NotificationProvider } from '@/contexts/NotificationContext';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/** Keeps dashboard routes off static prerender (auth pages) and wraps useSearchParams. */
export default function DashboardSegmentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <NotificationProvider>
      <Suspense fallback={null}>{children}</Suspense>
    </NotificationProvider>
  );
}
