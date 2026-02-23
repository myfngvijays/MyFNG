'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CustomerProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>({});
  const [form, setForm] = useState({ full_name: '', email: '' });
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/customer/profile', { credentials: 'include' });
    if (res.status === 401) {
      router.push('/customer/login');
      return;
    }
    const json = await res.json();
    setProfile(json.customer || {});
    setForm({
      full_name: json.customer?.full_name || '',
      email: json.customer?.email || '',
    });
    setLoading(false);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveProfile() {
    setSaving(true);
    await fetch('/api/customer/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(form),
    });
    setSaving(false);
    load();
  }

  if (loading) return <div className="p-6">Loading profile...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">My Profile</h1>
          <Link href="/customer/dashboard" className="text-blue-600">Back to Dashboard</Link>
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          <div>
            <label className="text-sm text-gray-600">Name</label>
            <input className="w-full border rounded px-3 py-2" value={form.full_name} onChange={(e) => setForm((s) => ({ ...s, full_name: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-gray-600">Email</label>
            <input className="w-full border rounded px-3 py-2" value={form.email} onChange={(e) => setForm((s) => ({ ...s, email: e.target.value }))} />
          </div>
          <div>
            <label className="text-sm text-gray-600">Phone</label>
            <input className="w-full border rounded px-3 py-2 bg-gray-100" value={profile.phone || ''} disabled />
          </div>
          <button onClick={saveProfile} disabled={saving} className="px-4 py-2 bg-blue-600 text-white rounded">
            {saving ? 'Saving...' : 'Save Profile'}
          </button>
        </div>
      </div>
    </div>
  );
}

