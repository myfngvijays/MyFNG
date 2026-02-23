'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function ReferAndEarnPage() {
  const router = useRouter();
  const [data, setData] = useState<any>({ code: null, events: [], rewards: [] });
  const [inputCode, setInputCode] = useState('');
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState('');

  async function load() {
    const res = await fetch('/api/customer/referral', { credentials: 'include' });
    if (res.status === 401) return router.push('/customer/login');
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function applyCode() {
    setMsg('');
    const res = await fetch('/api/customer/referral', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ referral_code: inputCode }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setMsg(json?.error || 'Failed');
    else {
      setMsg('Referral applied successfully');
      setInputCode('');
      load();
    }
  }

  if (loading) return <div className="p-6">Loading referral...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Refer & Earn</h1>
          <Link href="/customer/dashboard" className="text-blue-600">Back</Link>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <div className="text-sm text-gray-600">Your Referral Code</div>
          <div className="text-2xl font-bold tracking-wide">{data.code?.code || 'Generating...'}</div>
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          <div className="font-semibold">Apply Referral Code</div>
          <input value={inputCode} onChange={(e) => setInputCode(e.target.value.toUpperCase())} className="w-full border rounded px-3 py-2" />
          <button onClick={applyCode} className="px-4 py-2 bg-blue-600 text-white rounded">Apply</button>
          {msg && <div className="text-sm text-gray-700">{msg}</div>}
        </div>
      </div>
    </div>
  );
}

