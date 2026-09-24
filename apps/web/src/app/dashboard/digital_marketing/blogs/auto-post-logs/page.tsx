'use client';

import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import DailyBlogScheduleCard from '@/components/blog/DailyBlogScheduleCard';
import DailyBlogActivityLog from '@/components/blog/DailyBlogActivityLog';

export default function DigitalMarketingAutoPostLogsPage() {
  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">Blogs</p>
          <h1 className="mt-1 text-2xl font-bold text-gray-900">Auto-post logs</h1>
          <p className="mt-1 text-sm text-gray-600">
            Why a day posted 3, 1, or 0 — every cron tick, skip, fail, and Post now.
          </p>
        </div>
        <DailyBlogScheduleCard compact />
        <DailyBlogActivityLog />
        <Link href="/dashboard/digital_marketing/blogs" className="inline-block text-xs font-semibold text-[#004AAD]">
          ← Back to blogs
        </Link>
      </div>
    </DashboardLayout>
  );
}
