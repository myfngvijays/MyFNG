'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LeadHistoryIndexPage() {
  const router = useRouter();
  const [leadId, setLeadId] = useState('');

  function handleOpen() {
    if (!leadId.trim()) return;
    router.push(`/dashboard/super_admin/lead-history/${leadId.trim()}`);
  }

  return (
    <div className="space-y-4 max-w-xl">
      <div>
        <h1 className="text-2xl font-bold text-text-heading">Lead History</h1>
        <p className="text-sm text-gray-600 mt-1">Enter a lead ID to view full history.</p>
      </div>
      <div className="card p-4 space-y-3">
        <input
          className="input w-full"
          placeholder="Lead ID"
          value={leadId}
          onChange={(e) => setLeadId(e.target.value)}
        />
        <button className="btn btn-primary" onClick={handleOpen}>
          View History
        </button>
      </div>
    </div>
  );
}
