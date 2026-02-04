'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Settings } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function RSAManagerSettingsPage() {
  return (
    <DashboardLayout role="rsa_manager">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5 md:space-y-6">
        <div className="card">
          <div className="flex items-center gap-2">
            <Settings className="w-5 h-5 text-brand-primary" />
            <h1 className="text-lg sm:text-xl font-bold text-text-heading">Settings</h1>
          </div>
          <p className="text-sm text-text-body mt-2">
            RSA manager settings will be added here.
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

