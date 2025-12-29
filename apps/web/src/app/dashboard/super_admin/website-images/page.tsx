'use client';

import React from 'react';
import Link from 'next/link';
import { Image as ImageIcon, Car, ChevronRight } from 'lucide-react';

function Tile({
  title,
  subtitle,
  href,
  Icon,
}: {
  title: string;
  subtitle: string;
  href: string;
  Icon: any;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-2xl border border-white/20 bg-white/10 p-5 shadow-lg backdrop-blur transition hover:bg-white/15"
    >
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white text-blue-700 shadow">
          <Icon className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-lg font-bold text-white">{title}</div>
          <div className="text-sm font-semibold text-blue-100">{subtitle}</div>
        </div>
        <ChevronRight className="h-5 w-5 text-blue-100 transition group-hover:translate-x-0.5" />
      </div>
    </Link>
  );
}

export default function WebsiteImagesHubPage() {
  return (
    <div className="min-h-[calc(100vh-64px)] bg-gradient-to-b from-blue-600 via-blue-700 to-blue-900 p-4 sm:p-6">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 rounded-2xl bg-white/10 p-5 shadow-lg backdrop-blur">
          <div className="text-2xl font-extrabold text-white">Website Images</div>
          <div className="mt-1 text-sm font-semibold text-blue-100">
            Upload and manage images used across the web dashboard and mobile app.
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Tile
            title="Car Brand Images"
            subtitle="Manage Car Brand Logos"
            href="/dashboard/super_admin/brands"
            Icon={Car}
          />
          <Tile
            title="Home Carousel Images"
            subtitle="Manage top 3 app hero carousel banners"
            href="/dashboard/super_admin/website-images/home-carousel"
            Icon={ImageIcon}
          />
        </div>
      </div>
    </div>
  );
}


