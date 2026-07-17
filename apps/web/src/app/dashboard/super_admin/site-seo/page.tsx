'use client';

import dynamic from 'next/dynamic';

const SiteSeoAdminApp = dynamic(() => import('@/components/admin/site-seo/SiteSeoAdminApp'), {
  ssr: false,
  loading: () => (
    <div className="flex min-h-full w-full items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50/60 to-indigo-50/40 text-sm text-slate-500">
      Loading Advanced SEO…
    </div>
  ),
});

export default function SiteSeoAdminPage() {
  return (
    <div className="min-h-full w-full bg-gradient-to-br from-slate-50 via-blue-50/60 to-indigo-50/40">
      <SiteSeoAdminApp />
    </div>
  );
}
