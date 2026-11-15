'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';

type Job = {
  status?: string;
  total?: number;
  done?: number;
  inserted?: number;
  updated?: number;
  error?: string;
  received?: number;
};

export default function CrmUploadQueueBanner() {
  const [job, setJob] = useState<Job | null>(null);

  useEffect(() => {
    let stop = false;
    const tick = async () => {
      try {
        const res = await fetch('/api/crm/enquiries/upload');
        const json = await res.json();
        if (!stop) setJob(json?.job || null);
      } catch {
        /* ignore */
      }
    };
    const timer = setInterval(() => void tick(), 2000);
    void tick();
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, []);

  if (!job || !job.status || job.status === 'idle') return null;

  if (job.status === 'error') {
    return (
      <div className="border-b border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-800">
        CRM upload failed: {job.error || 'Upload failed'}
      </div>
    );
  }

  if (job.status === 'done') {
    return (
      <div className="border-b border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
        CRM upload complete. {job.inserted || 0} new, {job.updated || 0} updated.
      </div>
    );
  }

  const total = Number(job.total || 0);
  const done = Number(job.done || 0);
  const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
  const label =
    job.status === 'collecting'
      ? `CRM upload queue mein ja raha hai (${job.received || 0} rows)`
      : `CRM upload chal raha hai: ${done} / ${total} (${pct}%)`;

  return (
    <div className="border-b border-blue-200 bg-blue-50 px-4 py-2 text-sm text-blue-950">
      <div className="flex items-center gap-2 font-semibold">
        <Loader2 className="h-4 w-4 animate-spin" />
        {label}
      </div>
      <p className="mt-0.5 text-xs text-blue-800">Doosre menu pe jaoge tab bhi ye server pe chalta rahega.</p>
    </div>
  );
}
