import { Suspense } from 'react';
import CreatedManualInvoicesClient from './CreatedManualInvoicesClient';

export default function CreatedManualInvoicesPage() {
  return (
    <Suspense
      fallback={
        <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-6 text-sm text-gray-600">
          Loading invoices…
        </div>
      }
    >
      <CreatedManualInvoicesClient />
    </Suspense>
  );
}

