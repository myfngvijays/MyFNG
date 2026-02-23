'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

const toggles = [
  'push_enabled',
  'sms_enabled',
  'email_enabled',
  'order_updates',
  'offers',
  'wallet_credits',
  'referral_updates',
  'support_updates',
] as const;

export default function NotificationPreferencesPage() {
  const router = useRouter();
  const [prefs, setPrefs] = useState<any>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/customer/notifications/preferences', { credentials: 'include' });
      if (res.status === 401) return router.push('/customer/login');
      const json = await res.json();
      setPrefs(json.preferences || {});
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save(next: any) {
    setPrefs(next);
    await fetch('/api/customer/notifications/preferences', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(next),
    });
  }

  if (loading) return <div className="p-6">Loading preferences...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Notification Preferences</h1>
          <Link href="/customer/dashboard" className="text-blue-600">Back</Link>
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-3">
          {toggles.map((key) => (
            <label key={key} className="flex items-center justify-between border-b pb-2">
              <span className="capitalize">{key.replace(/_/g, ' ')}</span>
              <input
                type="checkbox"
                checked={Boolean(prefs[key])}
                onChange={(e) => save({ ...prefs, [key]: e.target.checked })}
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
}

