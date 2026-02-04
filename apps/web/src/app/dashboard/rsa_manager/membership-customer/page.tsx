'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { Users } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default function RSAManagerMembershipCustomerPage() {
  return (
    <DashboardLayout role="rsa_manager">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5 md:space-y-6">
        <div className="card">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-primary" />
            <h1 className="text-lg sm:text-xl font-bold text-text-heading">Membership Customer</h1>
          </div>
          <p className="text-sm text-text-body mt-2">
            This section will be added here (membership customer lookup / management).
          </p>
        </div>
      </div>
    </DashboardLayout>
  );
}

