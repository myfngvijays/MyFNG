'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CustomerSupportPageV2() {
  const router = useRouter();
  const [tickets, setTickets] = useState<any[]>([]);
  const [form, setForm] = useState({ subject: '', description: '', category: 'GENERAL' });

  async function load() {
    const res = await fetch('/api/customer/support/tickets', { credentials: 'include' });
    if (res.status === 401) return router.push('/customer/login');
    const json = await res.json();
    setTickets(json.tickets || []);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createTicket() {
    await fetch('/api/customer/support/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form),
    });
    setForm({ subject: '', description: '', category: 'GENERAL' });
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Help & Support</h1>
          <Link href="/customer/dashboard" className="text-blue-600">Back</Link>
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          <input className="w-full border rounded px-3 py-2" placeholder="Subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
          <textarea className="w-full border rounded px-3 py-2" placeholder="Describe your issue" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          <button onClick={createTicket} className="px-4 py-2 bg-blue-600 text-white rounded">Create Ticket</button>
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          {tickets.map((t) => (
            <div key={t.id} className="border-b pb-2">
              <div className="font-medium">{t.ticket_number || t.id}</div>
              <div>{t.subject}</div>
              <div className="text-sm text-gray-500">{t.status}</div>
            </div>
          ))}
          {tickets.length === 0 && <div className="text-gray-500">No tickets yet.</div>}
        </div>
      </div>
    </div>
  );
}

