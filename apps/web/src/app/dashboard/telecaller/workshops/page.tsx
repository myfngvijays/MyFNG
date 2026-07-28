'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { MapPin } from 'lucide-react';

/**
 * Telecaller Workshops tab — same public workshop locator as mobile CRM tab.
 */
export default function TelecallerWorkshopsPage() {
  return (
    <DashboardLayout role="telecaller">
      <div className="mb-3 flex items-start gap-2">
        <MapPin className="mt-0.5 h-5 w-5 shrink-0 text-[#004AAD]" />
        <div>
          <h1 className="text-xl font-extrabold text-gray-900">Workshops</h1>
          <p className="text-sm text-gray-500">Find nearby MyFNG workshops (same as mobile)</p>
        </div>
      </div>
      <div
        className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
        style={{ height: 'calc(100vh - 180px)', minHeight: 480 }}
      >
        <iframe
          src="/workshop-locator"
          className="h-full w-full border-0"
          title="Workshop locator"
          allow="geolocation"
        />
      </div>
    </DashboardLayout>
  );
}
