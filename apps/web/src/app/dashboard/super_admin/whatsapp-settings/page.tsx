'use client';

import AgentEnvSettingsPanel from '@/app/dashboard/super_admin/bot-flow/components/AgentEnvSettingsPanel';

export default function WhatsAppSettingsPage() {
  return (
    <div className="mx-auto max-w-5xl space-y-4 px-3 py-5 sm:px-4 md:px-6 md:py-8">
      <div>
        <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">WhatsApp Settings</h1>
        <p className="mt-1 text-sm text-gray-600">
          Meta Cloud API credentials — WABA, Phone Number ID, Access Token, App Secret, Verify Token.
          Same pattern as Firebase Settings under Advance Notifications.
        </p>
      </div>
      <AgentEnvSettingsPanel />
    </div>
  );
}
