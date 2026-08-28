'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { RedeemInstallCouponCard } from '@/components/customer/RedeemInstallCouponCard';

export default function CustomerWalletPage() {
  const router = useRouter();
  const [data, setData] = useState<any>({ wallet: null, transactions: [] });
  const [loading, setLoading] = useState(true);

  async function load() {
    const res = await fetch('/api/customer/wallet', { credentials: 'include' });
    if (res.status === 401) return router.push('/customer/login');
    const json = await res.json();
    setData(json);
    setLoading(false);
  }

  useEffect(() => {
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="p-6">Loading wallet...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Wallet</h1>
          <Link href="/customer/dashboard" className="text-blue-600">Back</Link>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600">Current Balance</p>
          <p className="text-3xl font-bold">₹{Number(data.wallet?.current_balance || 0).toFixed(2)}</p>
        </div>
        <RedeemInstallCouponCard onApplied={() => { void load(); }} />
        <div className="bg-white rounded-lg shadow p-4">
          <h2 className="font-semibold mb-3">Transaction History</h2>
          <div className="space-y-2">
            {(data.transactions || []).map((tx: any) => (
              <div key={tx.id} className="flex items-center justify-between border-b pb-2">
                <div>
                  <div className="font-medium">{tx.source}</div>
                  <div className="text-xs text-gray-500">{new Date(tx.created_at).toLocaleString()}</div>
                </div>
                <div className={tx.transaction_type === 'CREDIT' ? 'text-green-600' : 'text-red-600'}>
                  {tx.transaction_type === 'CREDIT' ? '+' : '-'}₹{Number(tx.amount || 0).toFixed(2)}
                </div>
              </div>
            ))}
            {(!data.transactions || data.transactions.length === 0) && <div className="text-gray-500">No transactions yet.</div>}
          </div>
        </div>
      </div>
    </div>
  );
}

