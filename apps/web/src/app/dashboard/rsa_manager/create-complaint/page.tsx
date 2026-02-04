'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { RSALeadCreateForm } from '@/components/telecaller/RSALeadCreateForm';

export default function RSAManagerCreateComplaintPage() {
  return (
    <DashboardLayout role="rsa_manager">
      <div className="max-w-4xl mx-auto space-y-4 sm:space-y-5 md:space-y-6 px-3 sm:px-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">Create RSA Complaint</h1>
          <p className="text-text-body text-xs sm:text-sm mt-1 sm:mt-2">
            Register a new RSA complaint directly.
          </p>
        </div>
        <RSALeadCreateForm />
      </div>
    </DashboardLayout>
  );
}
