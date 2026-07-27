'use client';

import { useState } from 'react';
import WhatsAppTemplateManager from '@/components/shared/WhatsAppTemplateManager';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';

export default function SuperAdminWhatsAppTemplatesPage() {
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">WhatsApp Templates</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create and manage reusable WhatsApp template messages.
          </p>
        </div>
        <AdminPageRefresh onClick={() => setRefreshKey((key) => key + 1)} />
      </div>
      <WhatsAppTemplateManager key={refreshKey} />
    </div>
  );
}
