'use client';

import { Suspense, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Loader2 } from 'lucide-react';

const emptyForm = {
  invoice_number: '',
  invoice_date: '',
  due_date: '',
  customer_name: '',
  customer_phone: '',
  customer_email: '',
  customer_address: '',
  customer_city: '',
  customer_state: '',
  customer_pincode: '',
  customer_gstin: '',
  customer_tax_type: '',
  place_of_supply: '',
  car_number: '',
  car_model: '',
  payment_mode: 'UPI',
  payment_reference: '',
  payment_notes: '',
  items: [{ item_name: '', item_description: '', hsn_sac_code: '', qty: 1, unit_price: 0, tax_percent: 0, discount: 0 }],
};

function invoiceToForm(inv: any): typeof emptyForm {
  const lineItems = Array.isArray(inv?.line_items) ? inv.line_items : [];
  const items = lineItems.length
    ? lineItems.map((it: any) => ({
        item_name: it?.item_name ?? '',
        item_description: it?.item_description ?? '',
        hsn_sac_code: it?.hsn_sac_code ?? '',
        qty: Number(it?.qty ?? 1),
        unit_price: Number(it?.unit_price ?? 0),
        tax_percent: Number(it?.tax_percent ?? 0),
        discount: Number(it?.discount ?? 0),
      }))
    : [{ item_name: '', item_description: '', hsn_sac_code: '', qty: 1, unit_price: 0, tax_percent: 0, discount: 0 }];
  return {
    invoice_number: inv?.invoice_number ?? '',
    invoice_date: inv?.invoice_date ?? '',
    due_date: inv?.due_date ?? '',
    customer_name: inv?.customer_name ?? '',
    customer_phone: inv?.customer_phone ?? '',
    customer_email: inv?.customer_email ?? '',
    customer_address: inv?.customer_address ?? '',
    customer_city: inv?.customer_city ?? '',
    customer_state: inv?.customer_state ?? '',
    customer_pincode: inv?.customer_pincode ?? '',
    customer_gstin: inv?.customer_gstin ?? '',
    customer_tax_type: inv?.customer_tax_type ?? '',
    place_of_supply: inv?.place_of_supply ?? '',
    car_number: inv?.car_number ?? '',
    car_model: inv?.car_model ?? '',
    payment_mode: inv?.payment_mode ?? 'UPI',
    payment_reference: inv?.payment_reference ?? '',
    payment_notes: inv?.payment_notes ?? '',
    items,
  };
}

export default function EditManualInvoicePage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-[40vh] flex items-center justify-center text-sm text-gray-500">
          Loading invoice…
        </div>
      }
    >
      <EditManualInvoicePageContent />
    </Suspense>
  );
}

function EditManualInvoicePageContent() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = String(params?.id ?? '');
  const returnTo = searchParams.get('returnTo') || '/dashboard/super_admin/manual-invoices/created';
  const safeReturnTo = returnTo.startsWith('/dashboard/') ? returnTo : '/dashboard/super_admin/manual-invoices/created';
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [form, setForm] = useState<typeof emptyForm>(emptyForm);

  const fetchInvoice = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/manual-invoices/${id}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to load invoice');
      setForm(invoiceToForm(data));
    } catch (e: any) {
      setMessage(e?.message || 'Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchInvoice();
  }, [fetchInvoice]);

  function updateItem(idx: number, patch: any) {
    setForm((prev) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], ...patch };
      return { ...prev, items };
    });
  }

  async function handleSave() {
    setMessage(null);
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/manual-invoices/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          line_items: form.items,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Update failed');
      setMessage('Invoice updated.');
      router.refresh();
    } catch (e: any) {
      setMessage(e?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-6 md:py-8 flex items-center justify-center gap-2">
        <Loader2 className="w-5 h-5 animate-spin" />
        <span>Loading invoice...</span>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-6 md:py-8 space-y-4">
      <div className="flex items-center gap-2">
        <Link
          href={safeReturnTo}
          className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </Link>
      </div>
      <h1 className="text-xl sm:text-2xl font-bold text-text-heading">Edit Manual Invoice</h1>
      <p className="text-xs sm:text-sm text-gray-600">Invoice # {form.invoice_number}</p>

      {message && <div className="text-sm text-gray-700">{message}</div>}

      <div className="bg-white rounded-lg border p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Invoice Number
            <input
              className="border rounded-md px-2 py-2 text-sm"
              placeholder="INV-1001"
              value={form.invoice_number}
              onChange={(e) => setForm((p) => ({ ...p, invoice_number: e.target.value }))}
            />
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Invoice Date
            <input
              className="border rounded-md px-2 py-2 text-sm"
              placeholder="YYYY-MM-DD"
              value={form.invoice_date}
              onChange={(e) => setForm((p) => ({ ...p, invoice_date: e.target.value }))}
            />
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Due Date
            <input
              className="border rounded-md px-2 py-2 text-sm"
              placeholder="YYYY-MM-DD"
              value={form.due_date}
              onChange={(e) => setForm((p) => ({ ...p, due_date: e.target.value }))}
            />
          </label>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">Customer Details</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Customer Name
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="Name"
                value={form.customer_name}
                onChange={(e) => setForm((p) => ({ ...p, customer_name: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Customer Phone
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="Phone"
                value={form.customer_phone}
                onChange={(e) => setForm((p) => ({ ...p, customer_phone: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Customer Email
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="Email"
                value={form.customer_email}
                onChange={(e) => setForm((p) => ({ ...p, customer_email: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1 sm:col-span-2">
              Address
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="Street / Area"
                value={form.customer_address}
                onChange={(e) => setForm((p) => ({ ...p, customer_address: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              City
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="City"
                value={form.customer_city}
                onChange={(e) => setForm((p) => ({ ...p, customer_city: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              State
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="State"
                value={form.customer_state}
                onChange={(e) => setForm((p) => ({ ...p, customer_state: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Pincode
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="Pincode"
                value={form.customer_pincode}
                onChange={(e) => setForm((p) => ({ ...p, customer_pincode: e.target.value }))}
              />
            </label>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">GST & Compliance</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Customer GSTIN
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="27ABCDE1234F1Z5"
                value={form.customer_gstin}
                onChange={(e) => setForm((p) => ({ ...p, customer_gstin: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Customer Tax Type
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="registered/unregistered"
                value={form.customer_tax_type}
                onChange={(e) => setForm((p) => ({ ...p, customer_tax_type: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Place of Supply
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="State"
                value={form.place_of_supply}
                onChange={(e) => setForm((p) => ({ ...p, place_of_supply: e.target.value }))}
              />
            </label>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">Vehicle Details</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Car Number
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="MH12AB1234"
                value={form.car_number}
                onChange={(e) => setForm((p) => ({ ...p, car_number: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Car Model
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="Hyundai i20"
                value={form.car_model}
                onChange={(e) => setForm((p) => ({ ...p, car_model: e.target.value }))}
              />
            </label>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">Payment Details</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Payment Mode
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="UPI / CASH"
                value={form.payment_mode}
                onChange={(e) => setForm((p) => ({ ...p, payment_mode: e.target.value }))}
              />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1 sm:col-span-2">
              Payment Reference
              <input
                className="border rounded-md px-2 py-2 text-sm"
                placeholder="UPI Ref / Receipt No."
                value={form.payment_reference}
                onChange={(e) => setForm((p) => ({ ...p, payment_reference: e.target.value }))}
              />
            </label>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">Line Items</div>
          {form.items.map((it, idx) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-8 gap-2">
              <label className="text-xs text-gray-600 flex flex-col gap-1 sm:col-span-2">
                Item Name
                <input
                  className="border rounded-md px-2 py-2 text-sm"
                  placeholder="Item Name"
                  value={it.item_name}
                  onChange={(e) => updateItem(idx, { item_name: e.target.value })}
                />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1 sm:col-span-2">
                Description
                <input
                  className="border rounded-md px-2 py-2 text-sm"
                  placeholder="Description"
                  value={it.item_description}
                  onChange={(e) => updateItem(idx, { item_description: e.target.value })}
                />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                HSN/SAC
                <input
                  className="border rounded-md px-2 py-2 text-sm"
                  placeholder="HSN/SAC"
                  value={it.hsn_sac_code}
                  onChange={(e) => updateItem(idx, { hsn_sac_code: e.target.value })}
                />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Qty
                <input
                  className="border rounded-md px-2 py-2 text-sm"
                  placeholder="1"
                  type="number"
                  value={it.qty}
                  onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Unit Price
                <input
                  className="border rounded-md px-2 py-2 text-sm"
                  placeholder="0"
                  type="number"
                  value={it.unit_price}
                  onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Tax %
                <input
                  className="border rounded-md px-2 py-2 text-sm"
                  placeholder="0"
                  type="number"
                  value={it.tax_percent}
                  onChange={(e) => updateItem(idx, { tax_percent: Number(e.target.value) })}
                />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Discount
                <input
                  className="border rounded-md px-2 py-2 text-sm"
                  placeholder="0"
                  type="number"
                  value={it.discount}
                  onChange={(e) => updateItem(idx, { discount: Number(e.target.value) })}
                />
              </label>
            </div>
          ))}
          <div className="flex flex-wrap gap-2 mt-2">
            <button
              type="button"
              onClick={() =>
                setForm((prev) => ({
                  ...prev,
                  items: [...prev.items, { item_name: '', item_description: '', hsn_sac_code: '', qty: 1, unit_price: 0, tax_percent: 0, discount: 0 }],
                }))
              }
              className="btn btn-secondary text-xs"
            >
              Add Item
            </button>
            <button type="button" onClick={handleSave} className="btn btn-primary text-sm" disabled={saving}>
              {saving ? (
                <span className="inline-flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </span>
              ) : (
                'Save Changes'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
