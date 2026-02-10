'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Upload, Loader2, FileText } from 'lucide-react';
import Link from 'next/link';

export default function ManualInvoicesPage() {
  const [csvText, setCsvText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [autoLoading, setAutoLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [form, setForm] = useState<any>({
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
  });

  async function fillNextInvoiceNumber(force = false) {
    // Don't overwrite user-entered invoice numbers unless forced
    if (!force && String(form.invoice_number || '').trim()) return;
    setAutoLoading(true);
    try {
      const params = new URLSearchParams();
      if (form.invoice_date) params.set('invoice_date', form.invoice_date);
      params.set('prefix', 'RA');
      const res = await fetch(`/api/admin/manual-invoices/next-invoice-number?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to get next invoice number');
      const nextNo = String(json?.invoice_number || '').trim();
      if (nextNo) setForm((prev: any) => ({ ...prev, invoice_number: nextNo }));
    } catch (e: any) {
      // Non-blocking; user can still type manually
      setMessage(e?.message || 'Failed to auto-generate invoice number');
    } finally {
      setAutoLoading(false);
    }
  }

  useEffect(() => {
    fillNextInvoiceNumber(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // This page is focused on creating/importing invoices.
  // Use the "View Created Invoice" button to see all created invoices.

  const templateCsv = useMemo(() => {
    return [
      'invoice_number,invoice_date,due_date,customer_name,customer_phone,customer_email,customer_address,customer_city,customer_state,customer_pincode,customer_gstin,customer_tax_type,place_of_supply,car_number,car_model,item_name,item_description,hsn_sac_code,qty,unit_price,tax_percent,discount,payment_mode,payment_reference,payment_notes,paid_at',
      'INV-1001,2026-01-20,2026-01-27,John Doe,9999999999,john@example.com,Andheri West,Mumbai,Maharashtra,400053,27ABCDE1234F1Z5,registered,Maharashtra,MH12AB1234,Hyundai i20,Engine Service,Full engine service,998729,1,2000,18,0,UPI,UPI123,Received full payment,2026-01-20',
      'INV-1001,2026-01-20,2026-01-27,John Doe,9999999999,john@example.com,Andheri West,Mumbai,Maharashtra,400053,27ABCDE1234F1Z5,registered,Maharashtra,MH12AB1234,Hyundai i20,Oil Change,Premium oil,998729,1,500,18,0,UPI,UPI123,Received full payment,2026-01-20',
      'INV-1002,2026-01-20,2026-01-27,Jane Doe,8888888888,jane@example.com,Bandra East,Mumbai,Maharashtra,400051,,unregistered,Maharashtra,MH01CD5678,Maruti Swift,Brake Pads,Front pads,870899,1,1500,18,100,CASH,CASH-01,Counter payment,2026-01-20',
    ].join('\n');
  }, []);

  function downloadTemplate() {
    const blob = new Blob([templateCsv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'manual_invoice_template.csv';
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  async function handleUpload(explicitCsv?: string) {
    const payloadText = explicitCsv ?? csvText;
    if (!payloadText.trim()) {
      setMessage('Paste CSV data first.');
      return;
    }
    setUploading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/manual-invoices/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv: payloadText }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Upload failed');
      setMessage(`Imported ${json.count || 0} invoices.`);
      setCsvText('');
    } catch (e: any) {
      setMessage(e?.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    await handleUpload(text);
    e.target.value = '';
  }

  function updateItem(idx: number, patch: any) {
    setForm((prev: any) => {
      const items = [...prev.items];
      items[idx] = { ...items[idx], ...patch };
      return { ...prev, items };
    });
  }

  async function handleSingleCreate() {
    setMessage(null);
    try {
      // If invoice_number is empty, auto-fill before create (best effort)
      if (!String(form.invoice_number || '').trim()) {
        await fillNextInvoiceNumber(true);
      }
      const res = await fetch('/api/admin/manual-invoices/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          line_items: form.items,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Create failed');
      setMessage('Manual invoice created.');
      // Move to next number for the next invoice
      setForm((prev: any) => ({ ...prev, invoice_number: '' }));
      await fillNextInvoiceNumber(true);
    } catch (e: any) {
      setMessage(e?.message || 'Create failed');
    }
  }

  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-6 md:py-8 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-heading">Manual Invoices</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Upload CSV to generate invoices in MyFNG format.
          </p>
        </div>
        <Link
          href="/dashboard/super_admin/manual-invoices/created"
          className="btn btn-secondary flex items-center gap-2 text-sm w-fit"
        >
          <FileText className="w-4 h-4" />
          View Created Invoice
        </Link>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-4">
        <div className="text-sm font-semibold">Create Single Invoice (Paid)</div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Invoice Number
            <input className="border rounded-md px-2 py-2 text-sm" placeholder="INV-1001"
              value={form.invoice_number} onChange={(e) => setForm({ ...form, invoice_number: e.target.value })} />
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Invoice Date
            <input className="border rounded-md px-2 py-2 text-sm" placeholder="YYYY-MM-DD"
              value={form.invoice_date} onChange={(e) => {
                const v = e.target.value;
                setForm({ ...form, invoice_date: v });
                // If user hasn't typed invoice number, refresh auto number for that FY
                if (!String(form.invoice_number || '').trim()) {
                  setTimeout(() => fillNextInvoiceNumber(true), 0);
                }
              }} />
            {autoLoading ? <span className="text-[11px] text-gray-500 mt-1">Generating…</span> : null}
          </label>
          <label className="text-xs text-gray-600 flex flex-col gap-1">
            Due Date
            <input className="border rounded-md px-2 py-2 text-sm" placeholder="YYYY-MM-DD"
              value={form.due_date} onChange={(e) => setForm({ ...form, due_date: e.target.value })} />
          </label>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">Customer Details</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Customer Name
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="Name"
                value={form.customer_name} onChange={(e) => setForm({ ...form, customer_name: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Customer Phone
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="Phone"
                value={form.customer_phone} onChange={(e) => setForm({ ...form, customer_phone: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Customer Email
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="Email"
                value={form.customer_email} onChange={(e) => setForm({ ...form, customer_email: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1 sm:col-span-2">
              Address
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="Street / Area"
                value={form.customer_address} onChange={(e) => setForm({ ...form, customer_address: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              City
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="City"
                value={form.customer_city} onChange={(e) => setForm({ ...form, customer_city: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              State
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="State"
                value={form.customer_state} onChange={(e) => setForm({ ...form, customer_state: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Pincode
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="Pincode"
                value={form.customer_pincode} onChange={(e) => setForm({ ...form, customer_pincode: e.target.value })} />
            </label>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">GST & Compliance</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Customer GSTIN
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="27ABCDE1234F1Z5"
                value={form.customer_gstin} onChange={(e) => setForm({ ...form, customer_gstin: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Customer Tax Type
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="registered/unregistered"
                value={form.customer_tax_type} onChange={(e) => setForm({ ...form, customer_tax_type: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Place of Supply
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="State"
                value={form.place_of_supply} onChange={(e) => setForm({ ...form, place_of_supply: e.target.value })} />
            </label>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">Vehicle Details</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Car Number
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="MH12AB1234"
                value={form.car_number} onChange={(e) => setForm({ ...form, car_number: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Car Model
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="Hyundai i20"
                value={form.car_model} onChange={(e) => setForm({ ...form, car_model: e.target.value })} />
            </label>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">Payment Details</div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <label className="text-xs text-gray-600 flex flex-col gap-1">
              Payment Mode
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="UPI / CASH"
                value={form.payment_mode} onChange={(e) => setForm({ ...form, payment_mode: e.target.value })} />
            </label>
            <label className="text-xs text-gray-600 flex flex-col gap-1 sm:col-span-2">
              Payment Reference
              <input className="border rounded-md px-2 py-2 text-sm" placeholder="UPI Ref / Receipt No."
                value={form.payment_reference} onChange={(e) => setForm({ ...form, payment_reference: e.target.value })} />
            </label>
          </div>
        </div>

        <div className="border-t pt-3">
          <div className="text-xs font-semibold text-gray-700 mb-2">Line Items</div>
          {form.items.map((it: any, idx: number) => (
            <div key={idx} className="grid grid-cols-1 sm:grid-cols-8 gap-2">
              <label className="text-xs text-gray-600 flex flex-col gap-1 sm:col-span-2">
                Item Name
                <input className="border rounded-md px-2 py-2 text-sm" placeholder="Item Name"
                  value={it.item_name} onChange={(e) => updateItem(idx, { item_name: e.target.value })} />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1 sm:col-span-2">
                Description
                <input className="border rounded-md px-2 py-2 text-sm" placeholder="Description"
                  value={it.item_description} onChange={(e) => updateItem(idx, { item_description: e.target.value })} />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                HSN/SAC
                <input className="border rounded-md px-2 py-2 text-sm" placeholder="HSN/SAC"
                  value={it.hsn_sac_code} onChange={(e) => updateItem(idx, { hsn_sac_code: e.target.value })} />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Qty
                <input className="border rounded-md px-2 py-2 text-sm" placeholder="1" type="number"
                  value={it.qty} onChange={(e) => updateItem(idx, { qty: Number(e.target.value) })} />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Unit Price
                <input className="border rounded-md px-2 py-2 text-sm" placeholder="0" type="number"
                  value={it.unit_price} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) })} />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Tax %
                <input className="border rounded-md px-2 py-2 text-sm" placeholder="0" type="number"
                  value={it.tax_percent} onChange={(e) => updateItem(idx, { tax_percent: Number(e.target.value) })} />
              </label>
              <label className="text-xs text-gray-600 flex flex-col gap-1">
                Discount
                <input className="border rounded-md px-2 py-2 text-sm" placeholder="0" type="number"
                  value={it.discount} onChange={(e) => updateItem(idx, { discount: Number(e.target.value) })} />
              </label>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <button onClick={() => setForm((prev: any) => ({ ...prev, items: [...prev.items, { item_name: '', item_description: '', hsn_sac_code: '', qty: 1, unit_price: 0, tax_percent: 0, discount: 0 }] }))}
              className="btn btn-secondary text-xs">Add Item</button>
            <button onClick={handleSingleCreate} className="btn btn-primary text-sm">Create Paid Invoice</button>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg border p-4 space-y-3">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between">
          <button onClick={downloadTemplate} className="btn btn-secondary flex items-center gap-2 text-sm">
            <Download className="w-4 h-4" />
            Download CSV Template
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn btn-primary flex items-center gap-2 text-sm"
          >
            {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {uploading ? 'Uploading...' : 'Upload CSV'}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleFilePick}
          />
        </div>
        <textarea
          className="w-full min-h-[160px] border rounded-lg p-3 text-xs sm:text-sm"
          placeholder="Paste CSV data here..."
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
        />
        {message && <div className="text-sm text-gray-700">{message}</div>}
      </div>
    </div>
  );
}

