'use client';

import DashboardLayout from '@/components/DashboardLayout';
import WhatsAppTemplateManager from '@/components/shared/WhatsAppTemplateManager';

export default function SubAdminWhatsAppTemplatesPage() {
  return (
    <DashboardLayout role="sub_admin">
      <div className="space-y-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">WhatsApp Templates</h1>
          <p className="text-sm text-gray-600 mt-1">
            Create and manage reusable WhatsApp template messages.
          </p>
        </div>
        <WhatsAppTemplateManager />
      </div>
    </DashboardLayout>
  );
}
