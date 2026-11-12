'use client';

import { useState } from 'react';
import WhatsAppTemplateManager from '@/components/shared/WhatsAppTemplateManager';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';

export default function SuperAdminWhatsAppTemplatesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-[1400px] space-y-4 px-4 py-5 sm:px-6">
        <div className="flex items-center justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-2xl font-bold text-gray-900">WhatsApp Templates</h1>
            <p className="mt-1 text-sm text-gray-600">
              Create and manage reusable WhatsApp template messages.
            </p>
          </div>
          <AdminPageRefresh onClick={() => setRefreshKey((key) => key + 1)} className="shrink-0" />
        </div>
        <WhatsAppTemplateManager key={refreshKey} />
      </div>
    </div>
  );
}
