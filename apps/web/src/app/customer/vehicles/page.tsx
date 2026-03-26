'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CustomerVehiclesPageV2() {
  const router = useRouter();
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [form, setForm] = useState({ vehicle_number: '', make: '', model: '', year: '' });

  async function load() {
    const res = await fetch('/api/customer/vehicles', { credentials: 'include' });
    if (res.status === 401) return router.push('/customer/login');
    const json = await res.json();
    setVehicles(json.vehicles || []);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addVehicle() {
    await fetch('/api/customer/vehicles', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ ...form, year: form.year ? Number(form.year) : null }),
    });
    setForm({ vehicle_number: '', make: '', model: '', year: '' });
    load();
  }

  async function remove(id: string) {
    await fetch(`/api/customer/vehicles/${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Vehicles</h1>
          <Link href="/customer/dashboard" className="text-blue-600">Back</Link>
        </div>
        <div className="bg-white rounded-lg shadow p-4 grid md:grid-cols-4 gap-2">
          <input className="border rounded px-3 py-2" placeholder="Vehicle Number" value={form.vehicle_number} onChange={(e) => setForm({ ...form, vehicle_number: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Make" value={form.make} onChange={(e) => setForm({ ...form, make: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Model" value={form.model} onChange={(e) => setForm({ ...form, model: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Year" value={form.year} onChange={(e) => setForm({ ...form, year: e.target.value })} />
          <button className="md:col-span-4 px-4 py-2 bg-blue-600 text-white rounded" onClick={addVehicle}>Add Vehicle</button>
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          {vehicles.map((v) => (
            <div key={v.id} className="flex items-center justify-between border-b pb-2">
              <div>{v.vehicle_number} - {[v.make, v.model, v.year].filter(Boolean).join(' ')}</div>
              <button onClick={() => remove(v.id)} className="text-red-600">Delete</button>
            </div>
          ))}
          {vehicles.length === 0 && <div className="text-gray-500">No vehicles yet.</div>}
        </div>
      </div>
    </div>
  );
}

