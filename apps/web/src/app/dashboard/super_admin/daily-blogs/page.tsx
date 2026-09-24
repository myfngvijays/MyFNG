'use client';

import Link from 'next/link';
import DailyBlogScheduleCard from '@/components/blog/DailyBlogScheduleCard';
import DailyBlogActivityLog from '@/components/blog/DailyBlogActivityLog';

export default function SuperAdminDailyBlogsPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-5xl mx-auto p-4 md:p-6 space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Shared Content</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Daily auto-blogs</h1>
          <p className="mt-1 text-sm text-gray-600">
            Set how many blogs post each day and the IST time for every slot. Same schedule Digital Marketing uses.
          </p>
        </div>

        <DailyBlogScheduleCard />
        <DailyBlogActivityLog />

        <div className="flex flex-wrap gap-2">
          <Link
            href="/dashboard/digital_marketing/blogs"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Open blogs list
          </Link>
          <Link
            href="/dashboard/super_admin/site-seo"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            Advanced SEO
          </Link>
          <Link
            href="/dashboard/super_admin/system-monitor"
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700"
          >
            System Monitor
          </Link>
        </div>
      </div>
    </div>
  );
}
