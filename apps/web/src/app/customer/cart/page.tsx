'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { restorePendingMembershipCart } from '@/lib/membership-cart-web';

export default function CustomerCartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ service_type: '', unit_price: '' });
  const [vehicleNumber, setVehicleNumber] = useState('');
  const [useWallet, setUseWallet] = useState(true);
  const [checkoutMsg, setCheckoutMsg] = useState('');
  const pendingRestored = useRef(false);

  async function load() {
    const res = await fetch('/api/customer/cart', { credentials: 'include' });
    if (res.status === 401) return router.push('/customer/login');
    const json = await res.json();
    setCart(json.cart || null);
    setItems(json.items || []);
  }

  useEffect(() => {
    (async () => {
      if (!pendingRestored.current) {
        pendingRestored.current = true;
        const result = await restorePendingMembershipCart();
        if (!result.ok && result.error) setCheckoutMsg(result.error);
      }
      await load();
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function addItem() {
    await fetch('/api/customer/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ service_type: form.service_type, unit_price: Number(form.unit_price || 0), quantity: 1 }),
    });
    setForm({ service_type: '', unit_price: '' });
    load();
  }

  async function removeItem(id: string) {
    await fetch(`/api/customer/cart?item_id=${id}`, { method: 'DELETE', credentials: 'include' });
    load();
  }

  async function checkout() {
    setCheckoutMsg('');
    const res = await fetch('/api/customer/cart/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ use_wallet: useWallet, vehicle_number: vehicleNumber }),
    });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) setCheckoutMsg(json?.error || 'Checkout failed');
    else setCheckoutMsg(`Order created: ${json?.lead?.lead_number || json?.lead?.id}`);
    load();
  }

  const subtotal = useMemo(() => items.reduce((sum, x) => sum + Number(x.total_price || 0), 0), [items]);

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold">Cart</h1>
          <Link href="/customer/dashboard" className="text-blue-600">Back</Link>
        </div>
        <div className="bg-white rounded-lg shadow p-4 grid md:grid-cols-3 gap-2">
          <input className="border rounded px-3 py-2" placeholder="Service type" value={form.service_type} onChange={(e) => setForm({ ...form, service_type: e.target.value })} />
          <input className="border rounded px-3 py-2" placeholder="Unit price" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          <button className="px-4 py-2 bg-blue-600 text-white rounded" onClick={addItem}>Add Item</button>
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          {items.map((i) => (
            <div key={i.id} className="flex items-center justify-between border-b pb-2">
              <div>{i.service_type}</div>
              <div className="flex items-center gap-3">
                <span>₹{Number(i.total_price || 0).toFixed(2)}</span>
                <button className="text-red-600" onClick={() => removeItem(i.id)}>Remove</button>
              </div>
            </div>
          ))}
          {items.length === 0 && <div className="text-gray-500">Cart is empty.</div>}
        </div>
        <div className="bg-white rounded-lg shadow p-4 space-y-2">
          <div className="font-semibold">Subtotal: ₹{subtotal.toFixed(2)}</div>
          <input className="w-full border rounded px-3 py-2" placeholder="Vehicle number (optional)" value={vehicleNumber} onChange={(e) => setVehicleNumber(e.target.value)} />
          <label className="flex items-center gap-2">
            <input type="checkbox" checked={useWallet} onChange={(e) => setUseWallet(e.target.checked)} />
            Use wallet balance
          </label>
          <button onClick={checkout} className="px-4 py-2 bg-green-600 text-white rounded">Checkout</button>
          {checkoutMsg && <div className="text-sm text-gray-700">{checkoutMsg}</div>}
          {cart && <div className="text-xs text-gray-500">Cart Status: {cart.status}</div>}
        </div>
      </div>
    </div>
  );
}

