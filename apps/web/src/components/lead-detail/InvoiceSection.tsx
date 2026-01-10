'use client';

import { formatDateDMY, formatDateTime } from "@/lib/utils";
/**
 * Invoice Section Component
 * Generate and display invoice for completed leads
 * Task: WA-702
 */

import { useState, useEffect, useMemo } from 'react';
import React from 'react';
import { FileText, Download, Printer, Send, CheckCircle, Clock, RefreshCw, CreditCard, DollarSign } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface InvoiceSectionProps {
  lead: any;
  onUpdate?: () => void;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type?: 'ORDER_SUMMARY' | 'CUSTOMER_INVOICE' | 'TAX_INVOICE' | string;
  visible_to_customer?: boolean;
  show_gst_breakup?: boolean;
  base_amount: number;
  parts_cost?: number;
  parts_amount?: number;
  extra_charges?: number;
  extra_charges_amount?: number;
  discount_amount?: number;
  subtotal: number;
  sub_total?: number;
  cgst?: number;
  cgst_amount?: number;
  sgst?: number;
  sgst_amount?: number;
  igst?: number;
  igst_amount?: number;
  total_tax?: number;
  round_off_amount?: number;
  total_amount: number;
  final_amount?: number;
  amount_in_words?: string;
  invoice_date: string;
  due_date: string;
  payment_status: 'PENDING' | 'PAID' | 'PARTIAL' | 'PARTIALLY_PAID' | 'OVERDUE';
  payment_mode?: string;
  payment_txn_id?: string;
  payment_remarks?: string;
  paid_amount?: number;
  old_parts_handed_over?: boolean;
  old_parts_handed_over_notes?: string;
  warranty_info?: {
    labour_warranty?: string;
    parts_warranty?: string;
    notes?: string;
  };
  recommended_future_work?: string;
  invoice_notes?: string;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  document_url?: string;
  document_type?: string;
  created_at: string;
  status?: string;
  line_items?: Array<{
    description?: string;
    qty?: number;
    rate?: number;
    amount?: number;
    category?: string;
  }>;
}

export default function InvoiceSection({ lead, onUpdate }: InvoiceSectionProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [invoiceList, setInvoiceList] = useState<Invoice[]>([]);
  const [selectedInvoiceType, setSelectedInvoiceType] = useState<'ORDER_SUMMARY' | 'CUSTOMER_INVOICE' | 'TAX_INVOICE' | null>(null);
  const [loading, setLoading] = useState(false);
  const [includedByServiceTypeId, setIncludedByServiceTypeId] = useState<Record<string, any[]>>({});
  const [includedByServiceNameKey, setIncludedByServiceNameKey] = useState<Record<string, any[]>>({});
  const [editingIncludedFor, setEditingIncludedFor] = useState<string | null>(null);
  const [includedRateDraft, setIncludedRateDraft] = useState<Record<string, string>>({});
  const [finalizing, setFinalizing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'POS' | 'UPI' | 'CARD'>('CASH');
  const [staffName, setStaffName] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [lead.id]);

  const normalizeName = (s: string) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  async function fetchInvoice() {
    setLoading(true);
    try {
      // Fetch invoice using the existing API route
      const response = await fetch(`/api/leads/${lead.id}/invoice`, { cache: 'no-store' });
      
      if (response.ok) {
        const data = await response.json();
        const invoiceData = data.invoice as Invoice | null;
        const list = Array.isArray(data?.invoices) ? (data.invoices as Invoice[]) : [];
        const included = Array.isArray(data?.included_service_items) ? data.included_service_items : [];
        const byId: Record<string, any[]> = {};
        const byName: Record<string, any[]> = {};
        for (const s of included) {
          const sid = String(s?.service_type_id || '').trim();
          const sname = String(s?.service_name || '').trim();
          const items = Array.isArray(s?.items) ? s.items : [];
          if (sid) byId[sid] = items;
          if (sname) byName[normalizeName(sname)] = items;
        }
        setIncludedByServiceTypeId(byId);
        setIncludedByServiceNameKey(byName);
        setInvoiceList(list);

        // Keep current selected type if user chose; otherwise default to best invoice returned.
        const desiredType = selectedInvoiceType || ((invoiceData as any)?.invoice_type as any) || null;
        if (desiredType) {
          const match = list.find((i: any) => String(i?.invoice_type || '').toUpperCase() === String(desiredType).toUpperCase());
          setInvoice(match || invoiceData || null);
          if (!selectedInvoiceType && (invoiceData as any)?.invoice_type) {
            setSelectedInvoiceType((invoiceData as any).invoice_type);
          }
        } else {
          setInvoice(invoiceData || null);
        }
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  }

  const buildIncludedDraft = (includedItems: any[]) => {
    const next: Record<string, string> = {};
    for (const it of includedItems || []) {
      const pid = String(it?.product_id || '').trim();
      if (!pid) continue;
      const p = it?.unit_price != null ? Number(it.unit_price) : 0;
      next[pid] = Number.isFinite(p) ? String(p) : '';
    }
    setIncludedRateDraft(next);
  };

  async function saveIncludedRates(serviceDescription: string, includedItems: any[]) {
    if (!invoice?.id) return;
    try {
      const items = (includedItems || [])
        .map((it: any) => {
          const pid = String(it?.product_id || '').trim();
          if (!pid) return null;
          const raw = includedRateDraft[pid];
          const unit_price = raw === '' || raw == null ? 0 : Number(raw);
          return Number.isFinite(unit_price) ? { product_id: pid, unit_price } : null;
        })
        .filter(Boolean);

      const res = await fetch(`/api/billing/invoices/${invoice.id}/included-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_description: serviceDescription, items }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error || 'Failed to save included item rates');
      setEditingIncludedFor(null);
      await fetchInvoice();
    } catch (e: any) {
      alert(e?.message || 'Failed to save');
    }
  }

  async function finalizeBill() {
    setFinalizing(true);
    try {
      const res = await fetch(`/api/billing/leads/${lead.id}/finalize-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) {
        const parts = [
          data?.error || 'Failed to finalize bill',
          data?.details ? `Details: ${data.details}` : null,
          data?.code ? `Code: ${data.code}` : null,
        ].filter(Boolean);
        throw new Error(parts.join(' | '));
      }
      alert(`✅ Bill finalized. Customer Invoice: ${data?.invoice?.invoice_number || ''}`);
      await fetchInvoice();
      onUpdate?.();
    } catch (e: any) {
      alert(`Failed to finalize bill: ${e?.message || 'Unknown error'}`);
    } finally {
      setFinalizing(false);
    }
  }

  async function activateCustomerInvoice() {
    if (!invoice) return;
    setActivating(true);
    try {
      const res = await fetch(`/api/billing/invoices/${invoice.id}/activate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to activate invoice');
      alert('✅ Customer invoice activated for payment');
      await fetchInvoice();
      onUpdate?.();
    } catch (e: any) {
      alert(`Failed to activate: ${e?.message || 'Unknown error'}`);
    } finally {
      setActivating(false);
    }
  }

  async function recordOfflinePayment() {
    if (!invoice) return;
    const remaining = ((invoice.final_amount || invoice.total_amount) || 0) - (invoice.paid_amount || 0);
    if (remaining <= 0) {
      alert('No balance due');
      return;
    }
    if (!staffName.trim()) {
      alert('Staff name is required');
      return;
    }
    if (!paymentRemarks.trim()) {
      alert('Payment remarks are required');
      return;
    }
    setPaying(true);
    try {
      const res = await fetch(`/api/payments/invoices/${invoice.id}/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_mode: paymentMode,
          paid_amount: remaining,
          payment_reference: paymentRef || undefined,
          payment_remarks: paymentRemarks,
          staff_name: staffName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');
      alert('✅ Payment recorded');
      setShowPaymentForm(false);
      setPaymentRef('');
      setPaymentRemarks('');
      await fetchInvoice();
      if (data?.tax_invoice?.invoice_number) {
        // Best-effort: help supervisor jump to TI
        alert(`✅ Tax Invoice generated: ${data.tax_invoice.invoice_number}`);
      }
      onUpdate?.();
    } catch (e: any) {
      alert(`Failed to record payment: ${e?.message || 'Unknown error'}`);
    } finally {
      setPaying(false);
    }
  }

  async function ensureTaxInvoice() {
    try {
      const res = await fetch(`/api/billing/leads/${lead.id}/ensure-tax-invoice`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) {
        const parts = [
          data?.error || 'Failed to generate Tax Invoice',
          data?.details ? `Details: ${data.details}` : null,
          data?.code ? `Code: ${data.code}` : null,
        ].filter(Boolean);
        throw new Error(parts.join(' | '));
      }
      const tiNo = data?.tax_invoice?.invoice_number;
      await fetchInvoice(); // should switch view to TI automatically (API prioritizes TI)
      if (tiNo) {
        window.open(`/invoice/${tiNo}`, '_blank');
      }
    } catch (e: any) {
      alert(`Failed to generate Tax Invoice: ${e?.message || 'Unknown error'}`);
    }
  }

  async function printInvoice() {
    if (!invoice) {
      alert('Invoice not found');
      return;
    }

    try {
      // Prefer persisted document URL (stable); otherwise generate/persist first
      let printUrl = invoice.document_url;

      if (!printUrl) {
        const persistRes = await fetch(`/api/billing/invoices/${invoice.id}/persist-document`, {
          method: 'POST',
        });
        if (persistRes.ok) {
          const persisted = await persistRes.json();
          printUrl = persisted.document_url;
        }
      }

      if (!printUrl) {
        printUrl = `/api/billing/invoices/${invoice.id}/generate-pdf`;
      }

      const printWindow = window.open(printUrl, '_blank');
      
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500); // Small delay to ensure content is loaded
        };
      } else {
        // Fallback: if popup blocked, open in same window
        window.location.href = printUrl;
        setTimeout(() => {
          window.print();
        }, 1000);
      }

      // Refresh invoice to capture document_url if it was generated
      await fetchInvoice();
    } catch (error: any) {
      console.error('Error printing invoice:', error);
      alert(`Failed to print invoice: ${error.message}`);
    }
  }

  async function downloadInvoice() {
    if (!invoice) {
      alert('Invoice not found');
      return;
    }

    try {
      // Prefer persisted document URL (stable)
      let urlToDownload = invoice.document_url;

      // If not persisted yet, persist first (best-effort)
      if (!urlToDownload) {
        const persistRes = await fetch(`/api/billing/invoices/${invoice.id}/persist-document`, {
          method: 'POST',
        });
        if (persistRes.ok) {
          const persisted = await persistRes.json();
          urlToDownload = persisted.document_url;
        }
      }

      // Fallback to generator endpoint (HTML)
      if (!urlToDownload) {
        urlToDownload = `/api/billing/invoices/${invoice.id}/generate-pdf`;
      }

      const link = document.createElement('a');
      link.href = urlToDownload;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = `Invoice-${invoice.invoice_number}.${(invoice.document_type || 'HTML').toLowerCase()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Refresh invoice to capture document_url if it was generated
      await fetchInvoice();
      alert('✅ Invoice download started!');
    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      alert(`Failed to download invoice: ${error.message}`);
    }
  }

  async function sendInvoice() {
    if (!invoice) {
      alert('Invoice not found');
      return;
    }

    try {
      const methods = [];
      const hasEmail = lead.customer_email;
      const hasPhone = lead.customer_phone;

      if (hasEmail) methods.push('EMAIL');
      if (hasPhone) methods.push('SMS');
      if (hasPhone) methods.push('WHATSAPP');
      methods.push('IN_APP');

      const response = await fetch(`/api/billing/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ methods }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invoice');
      }

      const successMethods = Object.entries(data.results || {})
        .filter(([_, result]: [string, any]) => result.success)
        .map(([method]) => method);

      if (successMethods.length > 0) {
        alert(`✅ Invoice sent successfully via: ${successMethods.join(', ')}`);
        onUpdate?.();
      } else {
        alert('⚠️ Failed to send invoice. Please check customer contact details.');
      }
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      alert(`Failed to send invoice: ${error.message}`);
    }
  }

  const invoiceType = (invoice as any)?.invoice_type || 'TAX_INVOICE';
  const showGst = (invoice as any)?.show_gst_breakup !== false && invoiceType === 'TAX_INVOICE';
  const isOS = invoiceType === 'ORDER_SUMMARY';
  const isCI = invoiceType === 'CUSTOMER_INVOICE';
  const isTI = invoiceType === 'TAX_INVOICE';

  const lineItems = (Array.isArray((invoice as any)?.line_items) ? ((invoice as any).line_items as any[]) : []) as any[];
  const hasLineItems = lineItems.length > 0;

  const money = (n: any) => {
    const v = typeof n === 'number' ? n : parseFloat(String(n || '0'));
    return `₹${(Number.isFinite(v) ? v : 0).toFixed(2)}`;
  };

  const normalizeCategory = (c: any) => String(c || '').trim().toUpperCase();
  const categoryLabel = (c: string) => {
    if (c === 'SERVICE') return 'Service Items';
    if (c === 'ADDON' || c === 'ADD-ON' || c === 'ADD_ON') return 'Add-ons';
    if (c === 'PART' || c === 'PARTS') return 'Additional Parts';
    if (c === 'LABOUR' || c === 'LABOR') return 'Labour';
    if (c === 'EXTRA') return 'Additional Charges';
    return c ? c : 'Items';
  };

  const categoryOrder = ['SERVICE', 'ADDON', 'PART', 'LABOUR', 'EXTRA'];
  const grouped = (() => {
    const map: Record<string, any[]> = {};
    for (const it of lineItems) {
      const cat = normalizeCategory(it?.category) || 'ITEMS';
      if (!map[cat]) map[cat] = [];
      map[cat].push(it);
    }
    // Stable ordering: known categories first, then the rest
    const keys = Object.keys(map);
    keys.sort((a, b) => {
      const ia = categoryOrder.indexOf(a);
      const ib = categoryOrder.indexOf(b);
      if (ia === -1 && ib === -1) return a.localeCompare(b);
      if (ia === -1) return 1;
      if (ib === -1) return -1;
      return ia - ib;
    });
    return keys.map((k) => ({ key: k, items: map[k] }));
  })();

  const byType = useMemo(() => {
    const map: Record<string, Invoice> = {};
    for (const inv of invoiceList || []) {
      const t = String((inv as any)?.invoice_type || '').toUpperCase();
      if (!t) continue;
      if (!map[t]) map[t] = inv;
    }
    return map;
  }, [invoiceList]);

  const typeTabs: Array<{ key: 'ORDER_SUMMARY' | 'CUSTOMER_INVOICE' | 'TAX_INVOICE'; label: string }> = [
    { key: 'ORDER_SUMMARY', label: 'Order Summary (OS)' },
    { key: 'CUSTOMER_INVOICE', label: 'Customer Invoice (CI)' },
    { key: 'TAX_INVOICE', label: 'Tax Invoice (TI)' },
  ];

  const activeTypeKey = (String(invoiceType || '') as any).toUpperCase() as 'ORDER_SUMMARY' | 'CUSTOMER_INVOICE' | 'TAX_INVOICE';

  const invoiceTabBtn = (t: string) => {
    const base = 'btn text-xs sm:text-sm px-3 py-2';
    return activeTypeKey === t ? `${base} btn-primary` : `${base} btn-outline bg-white`;
  };

  const switchToType = (t: 'ORDER_SUMMARY' | 'CUSTOMER_INVOICE' | 'TAX_INVOICE') => {
    setSelectedInvoiceType(t);
    const match = byType[t];
    if (match) setInvoice(match);
  };

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-primary" />
        Invoice
      </h2>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading invoice...</div>
      ) : !invoice ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500 mb-4">No invoice generated yet</p>
          <p className="text-sm text-gray-500">
            In the new flow, Order Summary is generated automatically when Supervisor approves QC.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Invoice Type Tabs (OS/CI/TI) */}
          {invoiceList.length > 0 && (
            <div className="flex flex-wrap items-center gap-2">
              {typeTabs.map((t) => {
                const exists = Boolean(byType[t.key]);
                return (
                  <button
                    key={t.key}
                    type="button"
                    className={invoiceTabBtn(t.key)}
                    onClick={() => exists && switchToType(t.key)}
                    disabled={!exists}
                    title={exists ? '' : 'Not generated yet'}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          )}
          {/* Invoice Header */}
          <div className="flex justify-between items-start p-4 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-lg text-white">
            <div>
              <h3 className="text-2xl font-bold">{invoice.invoice_number}</h3>
              <p className="text-sm opacity-90">Invoice Date: {formatDateDMY(invoice.invoice_date)}</p>
              <p className="text-sm opacity-90">Due Date: {formatDateDMY(invoice.due_date)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">Total Amount</p>
              <p className="text-3xl font-bold">₹{((invoice.final_amount || invoice.total_amount) || 0).toFixed(2)}</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-2 ${
                  invoice.payment_status === 'PAID'
                    ? 'bg-green-100 text-green-800'
                    : invoice.payment_status === 'OVERDUE'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {invoice.payment_status === 'PAID' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                {invoice.payment_status === 'PENDING' && <Clock className="w-3 h-3 inline mr-1" />}
                {invoice.payment_status}
              </span>
            </div>
          </div>

          {/* Invoice Breakdown */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              {hasLineItems ? (
                <>
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold w-12">Sr</th>
                      <th className="px-4 py-3 text-left font-semibold">Item</th>
                      <th className="px-4 py-3 text-right font-semibold w-20">Qty</th>
                      <th className="px-4 py-3 text-right font-semibold w-28">Rate</th>
                      <th className="px-4 py-3 text-right font-semibold w-32">Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {grouped.map((g) => (
                      <React.Fragment key={g.key}>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-xs font-bold text-gray-700" colSpan={5}>
                            {categoryLabel(g.key)}
                          </td>
                        </tr>
                        {g.items.map((it: any, idx: number) => {
                          const qty = Number(it?.qty ?? 1) || 1;
                          const rate = it?.rate != null ? Number(it.rate) : qty ? Number(it?.amount || 0) / qty : Number(it?.amount || 0);
                          const amt = Number(it?.amount ?? 0) || 0;
                          const sr = idx + 1;
                          const cat = String(it?.category || '').toUpperCase();
                          const includedItems =
                            cat === 'SERVICE'
                              ? (it?.service_type_id && includedByServiceTypeId[String(it.service_type_id)])
                                ? includedByServiceTypeId[String(it.service_type_id)]
                                : includedByServiceNameKey[normalizeName(String(it?.description || ''))]
                              : [];
                          const canEditIncluded = isOS && cat === 'SERVICE' && Array.isArray(includedItems) && includedItems.length > 0;
                          const isEditingThis = canEditIncluded && editingIncludedFor === String(it?.description || '');
                          return (
                            <tr key={`${g.key}-${idx}`}>
                              <td className="px-4 py-3 text-gray-600">{sr}</td>
                              <td className="px-4 py-3">
                                <div>{it?.description || '-'}</div>
                                {Array.isArray(includedItems) && includedItems.length > 0 && (
                                  <div className="mt-1 text-[11px] text-gray-500">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="font-semibold">Included:</div>
                                      {canEditIncluded && (
                                        <button
                                          type="button"
                                          className="text-[11px] text-blue-700 hover:underline"
                                          onClick={() => {
                                            const desc = String(it?.description || '');
                                            if (editingIncludedFor === desc) {
                                              setEditingIncludedFor(null);
                                              return;
                                            }
                                            setEditingIncludedFor(desc);
                                            buildIncludedDraft(includedItems);
                                          }}
                                        >
                                          {isEditingThis ? 'Cancel' : 'Edit rates'}
                                        </button>
                                      )}
                                    </div>

                                    <div className="mt-1 overflow-x-auto">
                                      <table className="min-w-[520px] w-full text-[11px]">
                                        <thead>
                                          <tr className="text-gray-500">
                                            <th className="text-left pr-2 py-1 font-semibold">Item</th>
                                            <th className="text-left pr-2 py-1 font-semibold">Type</th>
                                            <th className="text-right pr-2 py-1 font-semibold">Qty</th>
                                            <th className="text-right pr-2 py-1 font-semibold">Rate</th>
                                            <th className="text-right py-1 font-semibold">Amount</th>
                                          </tr>
                                        </thead>
                                        <tbody className="divide-y">
                                          {(includedItems || []).slice(0, 12).map((p: any, i: number) => {
                                            const qtyI = Number(p?.quantity || 1) || 1;
                                            const unitPrice = Number(p?.unit_price || 0) || 0;
                                            const amtI = Number(p?.amount ?? unitPrice * qtyI) || 0;
                                            const pid = String(p?.product_id || i);
                                            return (
                                              <tr key={pid} className="text-gray-700">
                                                <td className="pr-2 py-1">
                                                  {String(p?.name || 'Item')}
                                                  {p?.part_number ? ` (${String(p.part_number)})` : ''}
                                                </td>
                                                <td className="pr-2 py-1">{String(p?.type || '—')}</td>
                                                <td className="pr-2 py-1 text-right">{qtyI}</td>
                                                <td className="pr-2 py-1 text-right">
                                                  {isEditingThis ? (
                                                    <input
                                                      className="w-20 rounded border border-gray-200 px-2 py-0.5 text-right"
                                                      value={includedRateDraft[String(p?.product_id || '')] ?? String(unitPrice || '')}
                                                      onChange={(e) =>
                                                        setIncludedRateDraft((prev) => ({
                                                          ...prev,
                                                          [String(p?.product_id || '')]: e.target.value,
                                                        }))
                                                      }
                                                    />
                                                  ) : (
                                                    money(unitPrice)
                                                  )}
                                                </td>
                                                <td className="py-1 text-right font-medium">{money(amtI)}</td>
                                              </tr>
                                            );
                                          })}
                                        </tbody>
                                      </table>
                                      {includedItems.length > 12 && (
                                        <div className="mt-1 text-gray-400">+{includedItems.length - 12} more</div>
                                      )}
                                    </div>

                                    {isEditingThis && (
                                      <div className="mt-2 flex items-center gap-2">
                                        <button
                                          type="button"
                                          className="px-2 py-1 rounded bg-blue-600 text-white text-[11px]"
                                          onClick={() => saveIncludedRates(String(it?.description || ''), includedItems)}
                                        >
                                          Save
                                        </button>
                                        <span className="text-gray-400 text-[11px]">Saved only for this OS invoice</span>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </td>
                              <td className="px-4 py-3 text-right">{qty}</td>
                              <td className="px-4 py-3 text-right">{money(rate)}</td>
                              <td className="px-4 py-3 text-right font-medium">{money(amt)}</td>
                            </tr>
                          );
                        })}
                      </React.Fragment>
                    ))}
                  </tbody>
                </>
              ) : (
                <>
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold">Description</th>
                      <th className="px-4 py-3 text-right font-semibold">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    <tr>
                      <td className="px-4 py-3">Base Service Charges</td>
                      <td className="px-4 py-3 text-right font-medium">₹{(invoice.base_amount || 0).toFixed(2)}</td>
                    </tr>
                    {(invoice.parts_amount || invoice.parts_cost || 0) > 0 && (
                      <tr>
                        <td className="px-4 py-3">Parts & Materials</td>
                        <td className="px-4 py-3 text-right font-medium">₹{((invoice.parts_amount || invoice.parts_cost) || 0).toFixed(2)}</td>
                      </tr>
                    )}
                    {(invoice.extra_charges_amount || invoice.extra_charges || 0) > 0 && (
                      <tr>
                        <td className="px-4 py-3">Additional Charges</td>
                        <td className="px-4 py-3 text-right font-medium">₹{((invoice.extra_charges_amount || invoice.extra_charges) || 0).toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </>
              )}
            </table>

            {/* Totals */}
            <table className="w-full text-sm border-t border-gray-200">
              <tbody className="divide-y divide-gray-200">
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 font-semibold">Sub-Total (without taxes)</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{((invoice.subtotal || invoice.sub_total) || 0).toFixed(2)}</td>
                </tr>
                {(invoice.discount_amount || 0) > 0 && (
                <tr>
                    <td className="px-4 py-3">Discount / Coupon</td>
                    <td className="px-4 py-3 text-right text-red-600">-₹{(invoice.discount_amount || 0).toFixed(2)}</td>
                  </tr>
                )}
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 font-semibold">{showGst ? 'Net Taxable Value' : 'Sub-Total (No GST)'}</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{((invoice.subtotal || invoice.sub_total || 0) - (invoice.discount_amount || 0)).toFixed(2)}</td>
                </tr>
                {showGst && (invoice.cgst_amount || invoice.cgst || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3">CGST @ 9%</td>
                    <td className="px-4 py-3 text-right">₹{((invoice.cgst_amount || invoice.cgst) || 0).toFixed(2)}</td>
                  </tr>
                )}
                {showGst && (invoice.sgst_amount || invoice.sgst || 0) > 0 && (
                <tr>
                  <td className="px-4 py-3">SGST @ 9%</td>
                    <td className="px-4 py-3 text-right">₹{((invoice.sgst_amount || invoice.sgst) || 0).toFixed(2)}</td>
                  </tr>
                )}
                {showGst && (invoice.igst_amount || invoice.igst || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3">IGST @ 18%</td>
                    <td className="px-4 py-3 text-right">₹{((invoice.igst_amount || invoice.igst) || 0).toFixed(2)}</td>
                  </tr>
                )}
                {showGst && (invoice.total_tax || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3 font-semibold">Total GST</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{(invoice.total_tax || 0).toFixed(2)}</td>
                  </tr>
                )}
                {(invoice.round_off_amount || 0) !== 0 && (
                  <tr>
                    <td className="px-4 py-3">Round Off</td>
                    <td className="px-4 py-3 text-right">{(invoice.round_off_amount || 0) > 0 ? '+' : ''}₹{(invoice.round_off_amount || 0).toFixed(2)}</td>
                </tr>
                )}
                <tr className="bg-brand-primary bg-opacity-10 font-bold text-lg">
                  <td className="px-4 py-3">
                    {isOS ? 'Gross Total (No GST)' : isCI ? 'Total to Pay (No GST)' : 'Amount Payable (INR)'}
                  </td>
                  <td className="px-4 py-3 text-right">₹{((invoice.final_amount || invoice.total_amount) || 0).toFixed(2)}</td>
                </tr>
                {invoice.amount_in_words && (
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-center italic text-gray-600 bg-gray-50">
                      <strong>Amount in Words:</strong> {invoice.amount_in_words}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Payment Status */}
          {invoice.paid_amount && invoice.paid_amount > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-green-700">Amount Paid</p>
                  <p className="text-2xl font-bold text-green-800">₹{invoice.paid_amount.toFixed(2)}</p>
                  {invoice.payment_mode && (
                    <p className="text-xs text-green-600 mt-1">Via: {invoice.payment_mode}</p>
                  )}
                  {invoice.payment_txn_id && (
                    <p className="text-xs text-green-600">Txn Ref: {invoice.payment_txn_id}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-700">Balance Due</p>
                  <p className="text-2xl font-bold text-green-800">
                    ₹{(((invoice.final_amount || invoice.total_amount) || 0) - invoice.paid_amount).toFixed(2)}
                  </p>
                </div>
              </div>
              {invoice.payment_remarks && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-xs text-green-700"><strong>Payment Remarks:</strong> {invoice.payment_remarks}</p>
                </div>
              )}
            </div>
          )}

          {/* Additional Invoice Details */}
          {(invoice.old_parts_handed_over !== undefined || invoice.warranty_info || invoice.recommended_future_work || invoice.invoice_notes) && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-semibold mb-3">Additional Information</h4>
              {invoice.old_parts_handed_over !== undefined && (
                <p className="text-sm mb-2">
                  <strong>Old parts handed over:</strong> {invoice.old_parts_handed_over ? 'Yes' : 'No'}
                  {invoice.old_parts_handed_over_notes && ` - ${invoice.old_parts_handed_over_notes}`}
                </p>
              )}
              {invoice.warranty_info && (
                <div className="text-sm mb-2">
                  <strong>Warranty:</strong>
                  {invoice.warranty_info.labour_warranty && (
                    <p className="ml-4">Labour: {invoice.warranty_info.labour_warranty}</p>
                  )}
                  {invoice.warranty_info.parts_warranty && (
                    <p className="ml-4">Parts: {invoice.warranty_info.parts_warranty}</p>
                  )}
                  {invoice.warranty_info.notes && (
                    <p className="ml-4 text-gray-600">{invoice.warranty_info.notes}</p>
                  )}
                </div>
              )}
              {invoice.recommended_future_work && (
                <p className="text-sm mb-2">
                  <strong>Recommended future work:</strong> {invoice.recommended_future_work}
                </p>
              )}
              {invoice.invoice_notes && (
                <p className="text-sm">
                  <strong>Notes:</strong> {invoice.invoice_notes}
                </p>
              )}
            </div>
          )}

          {/* Bank Details */}
          {(invoice.bank_name || invoice.bank_account_number) && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold mb-2">Bank Details (NEFT/RTGS)</h4>
              <div className="text-sm space-y-1">
                {invoice.bank_name && <p><strong>Bank:</strong> {invoice.bank_name}</p>}
                {invoice.bank_account_name && <p><strong>Account Name:</strong> {invoice.bank_account_name}</p>}
                {invoice.bank_account_number && <p><strong>Account No:</strong> {invoice.bank_account_number}</p>}
                {invoice.bank_ifsc && <p><strong>IFSC:</strong> {invoice.bank_ifsc}</p>}
                {invoice.bank_branch && <p><strong>Branch:</strong> {invoice.bank_branch}</p>}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {isOS && (
              <button
                onClick={finalizeBill}
                disabled={finalizing}
                className="btn btn-secondary flex-1"
              >
                <RefreshCw className={`w-4 h-4 ${finalizing ? 'animate-spin' : ''}`} />
                {finalizing ? 'Finalizing...' : 'Finalize Bill (Create CI)'}
              </button>
            )}
            {isCI && (
              <button
                onClick={finalizeBill}
                disabled={finalizing}
                className="btn btn-secondary flex-1"
              >
                <RefreshCw className={`w-4 h-4 ${finalizing ? 'animate-spin' : ''}`} />
                {finalizing ? 'Recalculating...' : 'Recalculate Bill'}
              </button>
            )}
            <button
              onClick={printInvoice}
              className="btn btn-outline flex-1"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={downloadInvoice}
              className="btn btn-outline flex-1"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            {!isTI && (
              <button
                onClick={sendInvoice}
                className="btn btn-primary flex-1"
              >
                <Send className="w-4 h-4" />
                Send to Customer
              </button>
            )}
          </div>

          {/* CI activation + payment collection (Supervisor-managed) */}
          {isCI && (
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <p className="font-semibold">Customer Invoice</p>
                  <p className="text-xs text-gray-600">
                    Status: {(invoice.visible_to_customer ? 'VISIBLE' : 'NOT_VISIBLE')} • Payment: {invoice.payment_status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {String(invoice.payment_status).toUpperCase() === 'PAID' && (
                    <button onClick={ensureTaxInvoice} className="btn btn-primary">
                      View Tax Invoice
                    </button>
                  )}
                  {!invoice.visible_to_customer && (
                    <button
                      onClick={activateCustomerInvoice}
                      disabled={activating}
                      className="btn btn-outline"
                    >
                      <CreditCard className="w-4 h-4" />
                      {activating ? 'Activating...' : 'Activate for Payment'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowPaymentForm((v) => !v)}
                    className="btn btn-outline"
                  >
                    <DollarSign className="w-4 h-4" />
                    Record Offline Payment
                  </button>
                </div>
              </div>

              {showPaymentForm && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Payment Mode</label>
                    <select
                      className="w-full border rounded-md p-2"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                    >
                      <option value="CASH">CASH</option>
                      <option value="POS">POS</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">CARD</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Reference (optional)</label>
                    <input
                      className="w-full border rounded-md p-2"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="UPI Ref / POS Slip / Txn ID"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Staff Name</label>
                    <input
                      className="w-full border rounded-md p-2"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="e.g. Rahul (Supervisor)"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Payment Remarks</label>
                    <input
                      className="w-full border rounded-md p-2"
                      value={paymentRemarks}
                      onChange={(e) => setPaymentRemarks(e.target.value)}
                      placeholder="e.g. Cash received at counter"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      onClick={recordOfflinePayment}
                      disabled={paying}
                      className="btn btn-primary w-full"
                    >
                      {paying ? 'Recording...' : 'Confirm Payment Received'}
                    </button>
                    <p className="text-[11px] text-gray-500 mt-2">
                      Note: This records full remaining amount as paid and triggers Tax Invoice creation on full payment.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Invoice Footer */}
          <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
            <p>Invoice created on {formatDateTime(invoice.created_at)}</p>
            <p className="mt-1">Thank you for your business!</p>
          </div>
        </div>
      )}
    </div>
  );
}

