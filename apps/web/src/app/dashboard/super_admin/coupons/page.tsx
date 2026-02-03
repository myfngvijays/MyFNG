'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Ticket, Search, Loader2 } from 'lucide-react';

type CouponForm = {
  code: string;
  coupon_kind: 'TOTAL_DISCOUNT' | 'FREE_SERVICE';
  discount_mode: 'AMOUNT' | 'PERCENT' | '';
  discount_value: string;
  min_order_value: string;
  target_service_type_id: string;
  target_subservice_id: string;
  target_custom_label: string;
  start_at: string;
  end_at: string;
  usage_limit_total: string;
  usage_limit_per_customer: string;
  is_active: boolean;
  description: string;
};

const emptyForm: CouponForm = {
  code: '',
  coupon_kind: 'TOTAL_DISCOUNT',
  discount_mode: 'AMOUNT',
  discount_value: '',
  min_order_value: '',
  target_service_type_id: '',
  target_subservice_id: '',
  target_custom_label: '',
  start_at: '',
  end_at: '',
  usage_limit_total: '',
  usage_limit_per_customer: '',
  is_active: true,
  description: '',
};

export default function CouponsPage() {
  const [coupons, setCoupons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingCoupon, setEditingCoupon] = useState<any | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);

  useEffect(() => {
    fetchCoupons();
  }, []);

  const fetchCoupons = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/coupons');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load coupons');
      setCoupons(json?.coupons || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load coupons');
    } finally {
      setLoading(false);
    }
  };

  const filteredCoupons = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return coupons;
    return coupons.filter((c) =>
      [c.code, c.description, c.coupon_kind, c.discount_mode].filter(Boolean).some((v: string) =>
        String(v).toLowerCase().includes(term)
      )
    );
  }, [coupons, searchTerm]);

  const openCreate = () => {
    setEditingCoupon(null);
    setForm(emptyForm);
    setShowModal(true);
  };

  const openEdit = (coupon: any) => {
    setEditingCoupon(coupon);
    setForm({
      code: coupon.code || '',
      coupon_kind: coupon.coupon_kind || 'TOTAL_DISCOUNT',
      discount_mode: coupon.discount_mode || '',
      discount_value: coupon.discount_value != null ? String(coupon.discount_value) : '',
      min_order_value: coupon.min_order_value != null ? String(coupon.min_order_value) : '',
      target_service_type_id: coupon.target_service_type_id || '',
      target_subservice_id: coupon.target_subservice_id || '',
      target_custom_label: coupon.target_custom_label || '',
      start_at: coupon.start_at ? String(coupon.start_at).slice(0, 16) : '',
      end_at: coupon.end_at ? String(coupon.end_at).slice(0, 16) : '',
      usage_limit_total: coupon.usage_limit_total != null ? String(coupon.usage_limit_total) : '',
      usage_limit_per_customer: coupon.usage_limit_per_customer != null ? String(coupon.usage_limit_per_customer) : '',
      is_active: Boolean(coupon.is_active),
      description: coupon.description || '',
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const isFreeService = form.coupon_kind === 'FREE_SERVICE';
      const payload: any = {
        code: form.code.trim(),
        coupon_kind: form.coupon_kind,
        discount_mode: form.discount_mode || null,
        discount_value: form.discount_value ? Number(form.discount_value) : null,
        min_order_value: form.min_order_value ? Number(form.min_order_value) : null,
        // For FREE_SERVICE coupons we match by label (free text) rather than IDs.
        target_service_type_id: isFreeService ? null : (form.target_service_type_id || null),
        target_subservice_id: isFreeService ? null : (form.target_subservice_id || null),
        target_custom_label: isFreeService ? (form.target_custom_label || null) : (form.target_custom_label || null),
        start_at: form.start_at ? new Date(form.start_at).toISOString() : null,
        end_at: form.end_at ? new Date(form.end_at).toISOString() : null,
        usage_limit_total: form.usage_limit_total ? Number(form.usage_limit_total) : null,
        usage_limit_per_customer: form.usage_limit_per_customer ? Number(form.usage_limit_per_customer) : null,
        is_active: form.is_active,
        description: form.description || null,
      };

      const res = await fetch(
        editingCoupon ? `/api/admin/coupons/${editingCoupon.id}` : '/api/admin/coupons',
        {
          method: editingCoupon ? 'PUT' : 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        }
      );
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to save coupon');

      setShowModal(false);
      setEditingCoupon(null);
      setForm(emptyForm);
      fetchCoupons();
    } catch (err: any) {
      setError(err?.message || 'Failed to save coupon');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleActive = async (coupon: any) => {
    try {
      const res = await fetch(`/api/admin/coupons/${coupon.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !coupon.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update coupon');
      fetchCoupons();
    } catch (err: any) {
      setError(err?.message || 'Failed to update coupon');
    }
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Coupons</h1>
          <p className="text-gray-500">Create and manage discount and free-service coupons.</p>
        </div>
        <button
          className="btn btn-primary flex items-center gap-2"
          onClick={openCreate}
        >
          <Plus className="w-4 h-4" />
          Add Coupon
        </button>
      </div>

      <div className="bg-white rounded-lg border shadow-sm p-4 mb-4">
        <div className="flex items-center gap-2">
          <Search className="w-4 h-4 text-gray-400" />
          <input
            className="w-full text-sm outline-none"
            placeholder="Search coupons..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {error && (
        <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-200 rounded p-3">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg border shadow-sm overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr className="text-left">
              <th className="px-4 py-3">Code</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Value</th>
              <th className="px-4 py-3">Min Order</th>
              <th className="px-4 py-3">Usage</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Action</th>
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  <Loader2 className="w-4 h-4 inline animate-spin mr-2" />
                  Loading coupons...
                </td>
              </tr>
            )}
            {!loading && filteredCoupons.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                  No coupons found.
                </td>
              </tr>
            )}
            {filteredCoupons.map((coupon) => (
              <tr key={coupon.id} className="border-t">
                <td className="px-4 py-3 font-semibold">{coupon.code}</td>
                <td className="px-4 py-3">{coupon.coupon_kind}</td>
                <td className="px-4 py-3">
                  {coupon.coupon_kind === 'FREE_SERVICE'
                    ? coupon.target_custom_label || coupon.target_service_type_id || 'Free Service'
                    : `${coupon.discount_mode === 'PERCENT' ? `${coupon.discount_value}%` : `₹${coupon.discount_value}`}`}
                </td>
                <td className="px-4 py-3">{coupon.min_order_value ? `₹${coupon.min_order_value}` : '—'}</td>
                <td className="px-4 py-3">{coupon.usage_count ?? 0}</td>
                <td className="px-4 py-3">
                  <span className={coupon.is_active ? 'text-green-700' : 'text-gray-500'}>
                    {coupon.is_active ? 'Active' : 'Inactive'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <button className="btn btn-secondary text-xs" onClick={() => openEdit(coupon)}>
                      Edit
                    </button>
                    <button className="btn btn-secondary text-xs" onClick={() => toggleActive(coupon)}>
                      {coupon.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Ticket className="w-5 h-5 text-brand-primary" />
              <h2 className="text-lg font-bold">{editingCoupon ? 'Edit Coupon' : 'Create Coupon'}</h2>
            </div>

            <form className="space-y-3" onSubmit={handleSubmit}>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="input"
                  placeholder="Coupon Code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })}
                />
                <select
                  className="input"
                  value={form.coupon_kind}
                  onChange={(e) => setForm({ ...form, coupon_kind: e.target.value as CouponForm['coupon_kind'] })}
                >
                  <option value="TOTAL_DISCOUNT">Total Discount</option>
                  <option value="FREE_SERVICE">Free Service</option>
                </select>
              </div>

              {form.coupon_kind === 'TOTAL_DISCOUNT' && (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <select
                    className="input"
                    value={form.discount_mode}
                    onChange={(e) => setForm({ ...form, discount_mode: e.target.value as CouponForm['discount_mode'] })}
                  >
                    <option value="AMOUNT">Amount</option>
                    <option value="PERCENT">Percent</option>
                  </select>
                  <input
                    className="input"
                    placeholder="Discount Value"
                    value={form.discount_value}
                    onChange={(e) => setForm({ ...form, discount_value: e.target.value })}
                  />
                  <input
                    className="input"
                    placeholder="Min Order Value"
                    value={form.min_order_value}
                    onChange={(e) => setForm({ ...form, min_order_value: e.target.value })}
                  />
                </div>
              )}

              {form.coupon_kind === 'FREE_SERVICE' && (
                <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
                  <input
                    className="input"
                    value={form.target_custom_label}
                    onChange={(e) => setForm({ ...form, target_custom_label: e.target.value })}
                    placeholder="Service Name (free text) e.g. Free car service"
                  />
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="input"
                  type="datetime-local"
                  value={form.start_at}
                  onChange={(e) => setForm({ ...form, start_at: e.target.value })}
                />
                <input
                  className="input"
                  type="datetime-local"
                  value={form.end_at}
                  onChange={(e) => setForm({ ...form, end_at: e.target.value })}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <input
                  className="input"
                  placeholder="Usage Limit (Total)"
                  value={form.usage_limit_total}
                  onChange={(e) => setForm({ ...form, usage_limit_total: e.target.value })}
                />
                <input
                  className="input"
                  placeholder="Usage Limit (Per Customer)"
                  value={form.usage_limit_per_customer}
                  onChange={(e) => setForm({ ...form, usage_limit_per_customer: e.target.value })}
                />
              </div>

              <textarea
                className="input"
                placeholder="Description"
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />

              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                />
                Active
              </label>

              <div className="flex items-center justify-end gap-3 pt-2">
                <button type="button" className="btn btn-secondary" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
