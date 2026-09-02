'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

export default function CustomerOrdersPage() {
  const router = useRouter();
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/customer/orders', { credentials: 'include' });
      if (res.status === 401) return router.push('/customer/login');
      const json = await res.json();
      setOrders(json.orders || []);
      setLoading(false);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) return <div className="p-6">Loading order history...</div>;

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Order History</h1>
          <Link href="/customer/dashboard" className="text-blue-600">Back</Link>
        </div>
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left px-4 py-3">Order</th>
                <th className="text-left px-4 py-3">Vehicle</th>
                <th className="text-left px-4 py-3">Service</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Amount</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const items = Array.isArray(o.custom_repair_items) ? o.custom_repair_items : [];
                return (
                <tr key={o.id} className="border-t align-top">
                  <td className="px-4 py-3">{o.lead_number}</td>
                  <td className="px-4 py-3">{o.vehicle_number || '—'}</td>
                  <td className="px-4 py-3">
                    <div>{o.service_display || o.service_type || '—'}</div>
                    {items.length > 0 ? (
                      <ul className="mt-2 space-y-1 text-xs text-gray-600">
                        {items.map((item: any, idx: number) => (
                          <li key={`${item?.name || idx}`} className="flex justify-between gap-3">
                            <span>
                              {item?.name}
                              {Number(item?.qty || 1) > 1 ? ` × ${item.qty}` : ''}
                            </span>
                            <span className="font-semibold text-gray-800">
                              {Number(item?.amount || 0) > 0
                                ? `₹${Math.round(Number(item.amount)).toLocaleString('en-IN')}`
                                : '—'}
                            </span>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                  </td>
                  <td className="px-4 py-3">{o.status}</td>
                  <td className="px-4 py-3">₹{Number(o.actual_amount || 0).toFixed(2)}</td>
                </tr>
                );
              })}
              {orders.length === 0 && (
                <tr><td className="px-4 py-6 text-center text-gray-500" colSpan={5}>No orders found.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

