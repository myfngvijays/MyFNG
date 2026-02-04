'use client';

import DashboardLayout from '@/components/DashboardLayout';
import { RSALeadCreateForm } from '@/components/telecaller/RSALeadCreateForm';

export default function CreateRSAComplaintPage() {
  return (
    <DashboardLayout role="telecaller">
      <div className="max-w-5xl mx-auto space-y-4 sm:space-y-5 md:space-y-6 px-3 sm:px-4">
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">Create RSA Complaint</h1>
          <p className="text-text-body text-xs sm:text-sm mt-1 sm:mt-2">
            Fill the details below to register an RSA complaint.
          </p>
        </div>
        <RSALeadCreateForm />
      </div>
    </DashboardLayout>
  );
}

