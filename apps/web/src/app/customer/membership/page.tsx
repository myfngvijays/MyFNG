'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function MembershipPage() {
  const router = useRouter();
  const [plans, setPlans] = useState<any[]>([]);
  const [benefits, setBenefits] = useState<any[]>([]);
  const [membership, setMembership] = useState<any>(null);

  async function load() {
    const [plansRes, currentRes] = await Promise.all([
      fetch('/api/customer/membership/plans', { credentials: 'include' }),
      fetch('/api/customer/membership', { credentials: 'include' }),
    ]);
    if (plansRes.status === 401 || currentRes.status === 401) return router.push('/customer/login');
    const plansJson = await plansRes.json();
    const currentJson = await currentRes.json();
    setPlans(plansJson.plans || []);
    setBenefits(plansJson.benefits || []);
    setMembership(currentJson.membership || null);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function subscribe(planId: string) {
    await fetch('/api/customer/membership/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ plan_id: planId }),
    });
    load();
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Membership</h1>
          <Link href="/customer/dashboard" className="text-blue-600">Back</Link>
        </div>
        {membership && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            Active Membership: <b>{membership.plan?.name || membership.plan_id}</b>
          </div>
        )}
        <div className="grid md:grid-cols-2 gap-4">
          {plans.map((p) => (
            <div key={p.id} className="bg-white rounded-lg shadow p-4 space-y-2">
              <div className="text-xl font-bold">{p.name}</div>
              <div className="text-gray-600">{p.description}</div>
              <div className="text-lg font-semibold">₹{Number(p.price || 0).toFixed(2)}</div>
              <ul className="text-sm text-gray-700 list-disc ml-5">
                {benefits.filter((b) => b.plan_id === p.id).map((b) => <li key={b.id}>{b.title}</li>)}
              </ul>
              <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={() => subscribe(p.id)}>
                Subscribe
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

