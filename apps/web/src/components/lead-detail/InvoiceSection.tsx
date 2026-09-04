'use client';

import { formatDateDMY, formatDateTime } from "@/lib/utils";
/**
 * Invoice Section Component
 * Generate and display invoice for completed leads
 * Task: WA-702
 */

import { useState, useEffect, useMemo, useRef } from 'react';
import React from 'react';
import { FileText, Download, Printer, Send, CheckCircle, Clock, RefreshCw, CreditCard, DollarSign, User, Car } from 'lucide-react';
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
  const [servicePriceByTypeId, setServicePriceByTypeId] = useState<Record<string, number>>({});
  const [servicePriceByNameKey, setServicePriceByNameKey] = useState<Record<string, number>>({});
  const [editingIncludedFor, setEditingIncludedFor] = useState<string | null>(null);
  const [includedRateDraft, setIncludedRateDraft] = useState<Record<string, string>>({});
  const [includedQtyDraft, setIncludedQtyDraft] = useState<Record<string, string>>({});
  const [includedNameDraft, setIncludedNameDraft] = useState<Record<string, string>>({});
  const [lineItemDrafts, setLineItemDrafts] = useState<Record<string, { qty?: string; rate?: string; remark?: string }>>({});
  const [savingLineItems, setSavingLineItems] = useState(false);
  const [extraPartsEditKey, setExtraPartsEditKey] = useState<string | null>(null);
  const [extraPartsDraft, setExtraPartsDraft] = useState<
    Array<{ name: string; qty: string; unit_price: string; kind: 'PART' | 'LABOUR' | 'OTHER' }>
  >([]);
  const [savingExtraParts, setSavingExtraParts] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [ensuringTI, setEnsuringTI] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'POS' | 'UPI' | 'CARD'>('CASH');
  const [staffName, setStaffName] = useState('');
  const [workshopStaff, setWorkshopStaff] = useState<Array<{ id: string; full_name: string; role_code?: string | null }>>([]);
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paying, setPaying] = useState(false);
  const [workshopInfo, setWorkshopInfo] = useState<any>(null);

  const [nextServiceKm, setNextServiceKm] = useState<string>('');
  const [nextServiceDate, setNextServiceDate] = useState<string>(''); // YYYY-MM-DD
  const [savingNextService, setSavingNextService] = useState(false);
  const [gstEnabled, setGstEnabled] = useState(false);
  const [customerGstin, setCustomerGstin] = useState('');
  const [customerLegalName, setCustomerLegalName] = useState('');
  const [customerBillingAddress, setCustomerBillingAddress] = useState('');
  const [customerBillingStateCode, setCustomerBillingStateCode] = useState('');
  const [savingGst, setSavingGst] = useState(false);
  const autoTiAttemptedRef = useRef<Record<string, boolean>>({});

  const [couponBreakdown, setCouponBreakdown] = useState<
    Array<{
      code: string;
      coupon_kind: string | null;
      discount_amount: number;
      free_service_label?: string | null;
      error?: string | null;
    }>
  >([]);
  const [couponBreakdownLoading, setCouponBreakdownLoading] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [lead.id]);

  useEffect(() => {
    setLineItemDrafts({});
    setEditingIncludedFor(null);
    setIncludedRateDraft({});
    setIncludedQtyDraft({});
    setIncludedNameDraft({});
    setExtraPartsEditKey(null);
    setExtraPartsDraft([]);
  }, [invoice?.id]);

  useEffect(() => {
    let isMounted = true;
    const fetchWorkshop = async () => {
      const workshopId = String(lead?.workshop_id || '').trim();
      if (!workshopId) {
        if (isMounted) setWorkshopInfo(null);
        return;
      }
      try {
        const supabase = createClient();
        const { data } = await supabase
          .from('workshops')
          .select('id, name, workshop_name, address, short_address, city, state, pincode, phone, email, gst_number')
          .eq('id', workshopId)
          .maybeSingle();
        if (isMounted) setWorkshopInfo(data || null);
      } catch {
        if (isMounted) setWorkshopInfo(null);
      }
    };
    fetchWorkshop();
    return () => {
      isMounted = false;
    };
  }, [lead?.workshop_id]);

  useEffect(() => {
    let mounted = true;
    const fetchStaff = async () => {
      try {
        const res = await fetch('/api/workshop/staff', { cache: 'no-store' });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) return;
        if (mounted) setWorkshopStaff(Array.isArray(data?.staff) ? data.staff : []);
      } catch {
        // ignore
      }
    };
    fetchStaff();
    return () => {
      mounted = false;
    };
  }, [lead?.workshop_id]);

  const computeNextServiceDefaults = useMemo(() => {
    const odoRaw =
      (lead as any)?.vehicle_odometer ??
      (lead as any)?.vehicle_odometer_reading ??
      (lead as any)?.odometer_km ??
      null;
    const odo = odoRaw == null || odoRaw === '' ? null : Number(odoRaw);
    const baseOdo = Number.isFinite(odo as any) ? (odo as number) : null;

    const leadKm = (lead as any)?.next_service_km;
    const km =
      leadKm != null && leadKm !== ''
        ? Number(leadKm)
        : baseOdo != null
          ? baseOdo + 10000
          : null;

    const leadDateRaw = String((lead as any)?.next_service_date || '').trim();
    const daily = Number((lead as any)?.daily_running_km || 0) || 0;
    let dt = leadDateRaw;
    if (!dt && daily > 0) {
      const days = Math.max(1, Math.ceil(10000 / daily));
      const base = invoice?.created_at ? new Date(invoice.created_at) : new Date();
      const d2 = new Date(base.getTime());
      d2.setDate(d2.getDate() + days);
      // YYYY-MM-DD
      dt = d2.toISOString().slice(0, 10);
    }

    return {
      km: km != null && Number.isFinite(km) ? String(Math.round(km)) : '',
      date: dt || '',
    };
  }, [lead, invoice?.created_at]);

  useEffect(() => {
    // Hydrate drafts from lead (or computed defaults)
    setNextServiceKm((prev) => (prev ? prev : computeNextServiceDefaults.km));
    setNextServiceDate((prev) => (prev ? prev : computeNextServiceDefaults.date));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead?.id, invoice?.id]);

  useEffect(() => {
    const gstin = String((lead as any)?.customer_gstin || '').trim();
    const legal = String((lead as any)?.customer_legal_name || '').trim();
    const addr = String((lead as any)?.customer_billing_address || '').trim();
    const stateCode = String((lead as any)?.customer_billing_state_code || '').trim();
    setCustomerGstin(gstin);
    setCustomerLegalName(legal);
    setCustomerBillingAddress(addr);
    setCustomerBillingStateCode(stateCode);
    setGstEnabled(Boolean(gstin));
  }, [lead?.id]);

  async function saveNextService(updates: { next_service_km?: number | null; next_service_date?: string | null }) {
    if (savingNextService) return;
    setSavingNextService(true);
    try {
      const res = await fetch(`/api/workshop/leads/${lead.id}/update-details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.error || data?.details || 'Failed to save next service details'));
      }
      onUpdate?.();
    } catch (e: any) {
      alert(e?.message || 'Failed to save next service details');
    } finally {
      setSavingNextService(false);
    }
  }

  async function saveCustomerGst(updates: {
    customer_gstin?: string | null;
    customer_legal_name?: string | null;
    customer_billing_address?: string | null;
    customer_billing_state_code?: string | null;
  }) {
    if (savingGst) return;
    setSavingGst(true);
    try {
      const res = await fetch(`/api/workshop/leads/${lead.id}/update-details`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(String(data?.error || data?.details || 'Failed to save GST details'));
      }
      // Avoid page-level refresh/re-fetch loops for simple field edits.
      // These inputs are already controlled locally.
    } catch (e: any) {
      alert(e?.message || 'Failed to save GST details');
    } finally {
      setSavingGst(false);
    }
  }

  const normalizeName = (s: string) =>
    String(s || '')
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  const isUuid = (value: string) =>
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);

  const isCustomServiceName = (s: string) => normalizeName(s) === 'custom service';

  const deriveStateCodeFromGstin = (gstinRaw: string) => {
    const gstin = String(gstinRaw || '').trim().toUpperCase().replace(/\s+/g, '');
    const code = gstin.slice(0, 2);
    return /^[0-9]{2}$/.test(code) ? code : '';
  };

  async function fetchInvoice() {
    const leadId = String(lead?.id || '').trim();
    if (!leadId || !isUuid(leadId)) {
      setInvoice(null);
      setInvoiceList([]);
      return;
    }

    setLoading(true);
    try {
      // Fetch invoice using the existing API route
      const response = await fetch(`/api/leads/${leadId}/invoice`, { cache: 'no-store' });
      
      if (response.ok) {
        const data = await response.json();
        const invoiceData = data.invoice as Invoice | null;
        const list = Array.isArray(data?.invoices) ? (data.invoices as Invoice[]) : [];
        const included = Array.isArray(data?.included_service_items) ? data.included_service_items : [];
        const byId: Record<string, any[]> = {};
        const byName: Record<string, any[]> = {};
        const priceById: Record<string, number> = {};
        const priceByName: Record<string, number> = {};
        for (const s of included) {
          const sid = String(s?.service_type_id || '').trim();
          const sname = String(s?.service_name || '').trim();
          const items = Array.isArray(s?.items) ? s.items : [];
          if (sid) byId[sid] = items;
          if (sname) byName[normalizeName(sname)] = items;
          // Prefer transparent BOM sum (workshop parts) over package sticker price.
          const bomSum = items.reduce((sum: number, p: any) => {
            const qty = Number(p?.quantity || 1) || 1;
            const amt = Number(p?.amount);
            if (Number.isFinite(amt) && amt >= 0) return sum + amt;
            return sum + (Number(p?.unit_price || 0) || 0) * qty;
          }, 0);
          const packageSp = Number(s?.service_price);
          const sp = bomSum > 0.5 ? bomSum : packageSp;
          // IMPORTANT: "Custom Service" amount is editable from OS line-items,
          // so do not lock/override it with included_service_items pricing.
          const isCustom = isCustomServiceName(sname);
          if (!isCustom && sid && Number.isFinite(sp) && sp > 0) priceById[sid] = sp;
          if (!isCustom && sname && Number.isFinite(sp) && sp > 0) priceByName[normalizeName(sname)] = sp;
        }
        setIncludedByServiceTypeId(byId);
        setIncludedByServiceNameKey(byName);
        setServicePriceByTypeId(priceById);
        setServicePriceByNameKey(priceByName);
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
    const nextQty: Record<string, string> = {};
    const nextNames: Record<string, string> = {};
    for (const it of includedItems || []) {
      const pid = String(it?.product_id || '').trim();
      if (!pid) continue;
      const p = it?.unit_price != null ? Number(it.unit_price) : 0;
      const q = it?.quantity != null ? Number(it.quantity) : 1;
      const name = String(it?.name || '').trim();
      next[pid] = Number.isFinite(p) ? String(p) : '';
      nextQty[pid] = Number.isFinite(q) ? String(q) : '';
      nextNames[pid] = name || '';
    }
    setIncludedRateDraft(next);
    setIncludedQtyDraft(nextQty);
    setIncludedNameDraft(nextNames);
  };

  async function saveIncludedRates(serviceDescription: string, includedItems: any[], serviceTypeId?: string | null) {
    if (!invoice?.id) return;
    try {
      const isCustomService = isCustomServiceName(serviceDescription);
      const items = (includedItems || [])
        .map((it: any) => {
          const pid = String(it?.product_id || '').trim();
          if (!pid) return null;
          const qtyRaw = includedQtyDraft[pid];
          const qtyNum = qtyRaw === '' || qtyRaw == null ? Number(it?.quantity || 1) : Number(qtyRaw);
          const qty = Number.isFinite(qtyNum) ? qtyNum : Number(it?.quantity || 1) || 1;
          const base_unit_price = Number(it?.unit_price || 0) || 0;
          const raw = includedRateDraft[pid];
          const unit_price = raw === '' || raw == null ? 0 : Number(raw);
          const nameRaw = includedNameDraft[pid];
          const name =
            isCustomService && nameRaw != null
              ? String(nameRaw || '').trim()
              : String(it?.name || '').trim();
          return Number.isFinite(unit_price)
            ? { product_id: pid, name: name || undefined, unit_price, base_unit_price, quantity: qty }
            : null;
        })
        .filter(Boolean);

      const res = await fetch(`/api/billing/invoices/${invoice.id}/included-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ service_description: serviceDescription, service_type_id: serviceTypeId || undefined, items }),
      });
      const data = await res.json();
      if (!res.ok) {
        const parts = [
          data?.error || 'Failed to save included item rates',
          data?.details ? `Details: ${data.details}` : null,
          data?.code ? `Code: ${data.code}` : null,
          data?.step ? `Step: ${data.step}` : null,
        ].filter(Boolean);
        throw new Error(parts.join(' | '));
      }
      setEditingIncludedFor(null);
      // Refresh OS immediately
      await fetchInvoice();

      // If CI already exists and TI is not generated yet, auto-recalculate CI so the customer invoice reflects latest OS edits.
      // This matches the workflow: edits allowed until TI is generated.
      const hasCI = Boolean(byType['CUSTOMER_INVOICE']);
      const hasTI = Boolean(byType['TAX_INVOICE']);
      if (hasCI && !hasTI) {
        await finalizeBill({ silent: true });
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to save');
    }
  }

  const getDraftValue = (rowIndex: number, field: 'qty' | 'rate', fallback: number) => {
    const key = String(rowIndex);
    const raw = lineItemDrafts[key]?.[field];
    if (raw == null) return fallback;
    const num = Number(raw);
    return Number.isFinite(num) ? num : fallback;
  };

  async function saveLineItems() {
    if (!invoice?.id) return;
    if (savingLineItems) return;
    setSavingLineItems(true);
    try {
      const next = lineItems.map((row: any, idx: number) => {
        const qty = getDraftValue(idx, 'qty', Number(row?.qty ?? 1) || 1);
        const rateFallback =
          Number.isFinite(Number(row?.amount)) && qty ? Number(row.amount) / qty : 0;
        const rate = getDraftValue(idx, 'rate', Number(row?.rate ?? rateFallback) || 0);
        const amount = qty * rate;
        const isCustom = isCustomServiceName(String(row?.description || ''));
        const draftRemark = lineItemDrafts[String(idx)]?.remark;
        const existingRemark =
          row?.custom_remark != null
            ? String(row.custom_remark)
            : row?.remark != null
              ? String(row.remark)
              : row?.notes != null
                ? String(row.notes)
                : '';
        const remark = typeof draftRemark === 'string' ? draftRemark : existingRemark;
        return {
          ...row,
          qty,
          rate,
          amount,
          ...(isCustom ? { custom_remark: remark } : {}),
        };
      });

      const res = await fetch(`/api/billing/invoices/${invoice.id}/update-line-items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ line_items: next }),
      });
      const data = await res.json();
      if (!res.ok) {
        const parts = [
          data?.error || 'Failed to save line items',
          data?.details ? `Details: ${data.details}` : null,
          data?.code ? `Code: ${data.code}` : null,
        ].filter(Boolean);
        throw new Error(parts.join(' | '));
      }

      await fetchInvoice();

      const hasCI = Boolean(byType['CUSTOMER_INVOICE']);
      const hasTI = Boolean(byType['TAX_INVOICE']);
      if (hasCI && !hasTI) {
        await finalizeBill({ silent: true });
      }
    } catch (e: any) {
      alert(e?.message || 'Failed to save');
    } finally {
      setSavingLineItems(false);
    }
  }

  function beginExtraPartsEdit(it: any, includedItems: any[]) {
    const key = String(it?.extra_charge_id || it?.description || '').trim();
    if (!key) return;
    if (extraPartsEditKey === key) {
      setExtraPartsEditKey(null);
      setExtraPartsDraft([]);
      return;
    }
    const rows =
      Array.isArray(includedItems) && includedItems.length > 0
        ? includedItems.map((p: any) => ({
            name: String(p?.name || '').trim(),
            qty: String(Number(p?.quantity || 1) || 1),
            unit_price: String(Number(p?.unit_price || p?.amount || 0) || 0),
            kind: (String(p?.kind || '').toUpperCase() === 'LABOUR'
              ? 'LABOUR'
              : String(p?.kind || '').toUpperCase() === 'OTHER'
                ? 'OTHER'
                : 'PART') as 'PART' | 'LABOUR' | 'OTHER',
          }))
        : [{ name: '', qty: '1', unit_price: '', kind: 'PART' as const }];
    setExtraPartsEditKey(key);
    setExtraPartsDraft(rows);
  }

  async function saveExtraPartsEdit(it: any) {
    const extraId = String(it?.extra_charge_id || '').trim();
    if (!extraId) {
      alert('Extra work id missing. Refresh Order Summary and try again.');
      return;
    }
    const lines = extraPartsDraft
      .map((row) => {
        const name = row.name.trim();
        if (!name) return null;
        const qty = Math.max(0.01, Number(row.qty) || 1);
        const unit_price = Math.max(0, Number(row.unit_price) || 0);
        return { name, qty, unit_price, amount: qty * unit_price, kind: row.kind };
      })
      .filter(Boolean);
    if (lines.length === 0) {
      alert('Add at least one part / labour line.');
      return;
    }
    setSavingExtraParts(true);
    try {
      const res = await fetch(`/api/supervisor/extra-work/${extraId}/parts-breakdown`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parts_breakdown: lines, part_price_type: 'OEM' }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to save parts');
      setExtraPartsEditKey(null);
      setExtraPartsDraft([]);
      await fetchInvoice();
    } catch (e: any) {
      alert(e?.message || 'Failed to save parts');
    } finally {
      setSavingExtraParts(false);
    }
  }

  async function finalizeBill(opts?: { silent?: boolean }) {
    if (hasServiceMismatch) {
      alert('Included items total must match the service price before proceeding.');
      return;
    }
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
      if (!opts?.silent) {
        alert(`✅ Bill finalized. Customer Invoice: ${data?.invoice?.invoice_number || ''}`);
      }
      await fetchInvoice();
      onUpdate?.();
    } catch (e: any) {
      if (!opts?.silent) {
        alert(`Failed to finalize bill: ${e?.message || 'Unknown error'}`);
      } else {
        console.error('Auto finalize (silent) failed:', e);
      }
    } finally {
      setFinalizing(false);
    }
  }

  async function regenerateOS() {
    try {
      const res = await fetch(`/api/billing/leads/${lead.id}/regenerate-os`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const parts = [
          data?.error || 'Failed to regenerate OS',
          data?.details ? `Details: ${data.details}` : null,
          data?.code ? `Code: ${data.code}` : null,
          data?.hint ? `Hint: ${data.hint}` : null,
        ].filter(Boolean);
        throw new Error(parts.join(' | '));
      }
      alert('✅ OS regenerated');
      await fetchInvoice();
      onUpdate?.();
    } catch (e: any) {
      alert(e?.message || 'Failed to regenerate OS');
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
    const remaining = (effectivePayable || 0) - (invoice.paid_amount || 0);
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
      if (!res.ok) {
        const parts = [
          data?.error || 'Failed to record payment',
          data?.current_status ? `Invoice status: ${data.current_status}` : null,
          data?.hint ? `Hint: ${data.hint}` : null,
          data?.balance_due != null ? `Balance due: ${data.balance_due}` : null,
          data?.provided_amount != null ? `Provided: ${data.provided_amount}` : null,
        ].filter(Boolean);
        throw new Error(parts.join(' | '));
      }
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

  async function handleRecalculateBillOrGenerateTI() {
    // If CI is already paid and TI is missing, treat "Recalculate Bill" as "Generate TI now".
    const norm = (t: any) => String(t || '').toUpperCase();
    const ciInv =
      norm((invoice as any)?.invoice_type) === 'CUSTOMER_INVOICE'
        ? invoice
        : invoiceList.find((x: any) => norm(x?.invoice_type) === 'CUSTOMER_INVOICE') || invoice;
    const tiExists = invoiceList.some((x: any) => norm(x?.invoice_type) === 'TAX_INVOICE');
    const ciPaid = isInvoicePaid(ciInv);
    const hasAnyPayment =
      (Number((ciInv as any)?.paid_amount ?? 0) || 0) > 0 ||
      Boolean(String((ciInv as any)?.payment_txn_id || '').trim());

    if (tiExists) {
      // Nothing to do; already generated.
      alert('Tax Invoice already generated.');
      return;
    }

    // If payment exists (even if CI totals are stale and status shows PARTIAL),
    // try generating TI first. Backend will validate payable vs paid.
    if (ciPaid || hasAnyPayment) {
      setEnsuringTI(true);
      try {
        await ensureTaxInvoice();
      } finally {
        setEnsuringTI(false);
      }
      return;
    }

    // Not paid yet: allow recalculation/finalization flow.
    await finalizeBill();
  }

  const isInvoicePaid = (invAny: any) => {
    if (!invAny) return false;
    const ps = String(invAny?.payment_status || '').toUpperCase();
    const st = String(invAny?.status || '').toUpperCase();
    if (ps === 'PAID' || st === 'PAID') return true;
    const finalAmt = Number(invAny?.final_amount ?? invAny?.total_amount ?? 0) || 0;
    const paidAmt = Number(invAny?.paid_amount ?? 0) || 0;
    const bal = invAny?.balance_due != null ? Number(invAny.balance_due) : Math.max(0, finalAmt - paidAmt);
    if (finalAmt > 0 && (paidAmt + 0.01 >= finalAmt)) return true;
    if (finalAmt > 0 && bal <= 0.01) return true;
    return false;
  };

  // NOTE: Do not auto-call ensure-tax-invoice.
  // It can fail when CI isn't paid and creates noisy console errors.

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

      // Fallback to generator endpoint (PDF)
      if (!urlToDownload) {
        urlToDownload = `/api/billing/invoices/${invoice.id}/generate-pdf`;
      }

      const link = document.createElement('a');
      link.href = urlToDownload;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      const downloadExt = urlToDownload.includes('/generate-pdf')
        ? 'pdf'
        : String(invoice.document_type || 'pdf').toLowerCase();
      link.download = `Invoice-${invoice.invoice_number}.${downloadExt}`;
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
  const lineItemsWithIndex = lineItems.map((it: any, idx: number) => ({ ...it, _idx: idx }));
  const hasLineItems = lineItems.length > 0;
  const normalizeCouponCode = (raw: any) => String(raw || '').trim().toUpperCase();
  const parseCouponCodes = (raw: any): string[] => {
    if (!raw) return [];
    const parseMaybe = (value: any) => {
      if (Array.isArray(value)) return value;
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    };
    let next = parseMaybe(raw);
    if (typeof next === 'string') {
      next = parseMaybe(next);
    }
    if (Array.isArray(next)) {
      return next.map((c) => normalizeCouponCode(c)).filter(Boolean);
    }
    if (typeof next === 'string') {
      return next
        .split(',')
        .map((c) => normalizeCouponCode(c))
        .filter(Boolean);
    }
    return [];
  };
  const parseCouponMeta = (raw: any): any => {
    if (!raw) return null;
    const parseMaybe = (value: any) => {
      if (typeof value === 'string') {
        try {
          return JSON.parse(value);
        } catch {
          return value;
        }
      }
      return value;
    };
    const once = parseMaybe(raw);
    const twice = parseMaybe(once);
    return typeof twice === 'string' ? null : twice;
  };
  const invoiceCouponMeta = parseCouponMeta((invoice as any)?.coupon_meta);
  const leadCouponMeta = parseCouponMeta((lead as any)?.coupon_meta);
  const couponCodeForDisplay = String(
    (invoice as any)?.coupon_code ?? (lead as any)?.coupon_code ?? ''
  ).trim();
  const invoiceAppliedCode = String(invoiceCouponMeta?.applied_code || '').trim().toUpperCase();
  const leadAppliedCode = String(leadCouponMeta?.applied_code || '').trim().toUpperCase();
  const couponMetaSelectedCodes = parseCouponCodes(invoiceCouponMeta?.selected_codes);
  const leadMetaSelectedCodes = parseCouponCodes(leadCouponMeta?.selected_codes);
  const allCouponCodesForDisplay = Array.from(
    new Set([
      ...(couponMetaSelectedCodes || []),
      ...(leadMetaSelectedCodes || []),
      ...(invoiceAppliedCode ? [invoiceAppliedCode] : []),
      ...(leadAppliedCode ? [leadAppliedCode] : []),
      ...(couponCodeForDisplay ? [couponCodeForDisplay] : []),
    ])
  ).filter(Boolean);
  const discountAmount = Number((invoice as any)?.discount_amount ?? 0) || 0;
  const storedSubtotal = Number((invoice as any)?.subtotal ?? (invoice as any)?.sub_total ?? 0) || 0;
  const lineItemsSubtotal = lineItems.reduce((sum, it: any) => {
    const qty = Number(it?.qty ?? it?.quantity ?? 1) || 1;
    const rate = Number(it?.rate ?? it?.unit_price ?? 0) || 0;
    const amountRaw = Number(it?.amount ?? 0);
    const originalRaw = Number(it?.original_amount ?? 0);
    const isFreeService = Boolean(it?.free_service);
    const baseLineTotal = isFreeService && originalRaw > 0 ? originalRaw : (amountRaw || qty * rate);
    const cat = String(it?.category || '').toUpperCase();
    const isService = cat === 'SERVICE';
    const isCustomService = isCustomServiceName(String(it?.description || ''));
    const displayServiceAmount = isService
      ? (isOS && isCustomService ? baseLineTotal : getServicePrice(it))
      : baseLineTotal;
    return sum + (Number.isFinite(displayServiceAmount) ? displayServiceAmount : 0);
  }, 0);
  const subTotalBeforeDiscount =
    lineItemsSubtotal > 0 && Math.abs(lineItemsSubtotal - storedSubtotal) > 0.5
      ? lineItemsSubtotal
      : (storedSubtotal || lineItemsSubtotal);
  // Backward-compatible: some older invoices stored sub_total as AFTER discount. If so, don't subtract again.
  const storedFinal = Number((invoice as any)?.final_amount ?? (invoice as any)?.total_amount ?? 0) || 0;
  const candidateAfterDiscount = subTotalBeforeDiscount - discountAmount;
  const grossAfterDiscount =
    discountAmount > 0 &&
    storedFinal > 0 &&
    Math.abs(storedFinal - subTotalBeforeDiscount) < 0.5
      ? subTotalBeforeDiscount
      : candidateAfterDiscount;
  const taxableValue = showGst
    ? Math.max(0, (((invoice?.final_amount ?? invoice?.total_amount ?? 0) - (invoice?.total_tax ?? 0))))
    : grossAfterDiscount;

  const couponMetaKind = String(invoiceCouponMeta?.coupon_kind || '').toUpperCase();
  const couponMetaCode = String(invoiceCouponMeta?.code || '').trim();
  const totalDiscountOnly = couponBreakdown
    .filter((c) => String(c?.coupon_kind || '').toUpperCase() === 'TOTAL_DISCOUNT')
    .reduce((s, c) => s + (Number(c?.discount_amount || 0) || 0), 0);
  const hasTotalDiscountCoupon =
    couponBreakdown.some((c) => String(c?.coupon_kind || '').toUpperCase() === 'TOTAL_DISCOUNT') ||
    couponMetaKind === 'TOTAL_DISCOUNT' ||
    (discountAmount > 0 && Boolean(couponCodeForDisplay || couponMetaCode));
  // Effective payable for display (handles coupon preview + legacy invoices)
  const previewDiscountForTotals =
    discountAmount > 0 && hasTotalDiscountCoupon ? discountAmount : totalDiscountOnly;
  const computedAfterDiscount = Math.max(0, subTotalBeforeDiscount - previewDiscountForTotals);
  const storedPayable = Number((invoice as any)?.final_amount ?? (invoice as any)?.total_amount ?? 0) || 0;
  const storedLooksPreDiscount =
    previewDiscountForTotals > 0 &&
    storedPayable > 0 &&
    Math.abs(storedPayable - subTotalBeforeDiscount) < 0.5;
  const effectivePayable =
    isOS || isCI
      ? computedAfterDiscount
      : storedLooksPreDiscount
        ? computedAfterDiscount
        : storedPayable;

  // If coupon exists but invoice has no discount_amount yet, compute preview discount for display.
  // This is especially useful for OS before CI finalization.
  useEffect(() => {
    let cancelled = false;
    const inv = invoice as any;
    const selectedCodesInv = parseCouponCodes(parseCouponMeta((inv as any)?.coupon_meta)?.selected_codes);
    const selectedCodesLead = parseCouponCodes(leadCouponMeta?.selected_codes);
    const appliedMetaInv = String(parseCouponMeta((inv as any)?.coupon_meta)?.applied_code || '')
      .trim()
      .toUpperCase();
    const appliedMetaLead = String(leadCouponMeta?.applied_code || '').trim().toUpperCase();
    const appliedInv = String((inv as any)?.coupon_code || '').trim().toUpperCase();
    const appliedLead = String((lead as any)?.coupon_code || '').trim().toUpperCase();
    const codes = Array.from(
      new Set(
        [
          ...(selectedCodesInv || []),
          ...(selectedCodesLead || []),
          ...(appliedMetaInv ? [appliedMetaInv] : []),
          ...(appliedMetaLead ? [appliedMetaLead] : []),
          ...(appliedInv ? [appliedInv] : []),
          ...(appliedLead ? [appliedLead] : []),
        ]
          .map((c) => normalizeCouponCode(c))
          .filter(Boolean)
      )
    );

    if (!inv || codes.length === 0) {
      setCouponBreakdown([]);
      return;
    }

    // CI: if discount_amount is stored, use stored breakdown; otherwise validate like OS so UI matches OS behavior.
    if (isCI && discountAmount > 0) {
      const applied = appliedInv || appliedLead || null;
      const invCouponMeta = parseCouponMeta((inv as any)?.coupon_meta) || null;
      const freeMeta = invCouponMeta?.free_service || null;
      const freeLabel =
        freeMeta?.matched_label ||
        freeMeta?.target_custom_label ||
        null;
      const freeServiceOriginalTotal = (Array.isArray(inv?.line_items) ? inv.line_items : [])
        .filter((it: any) => Boolean((it as any)?.free_service) && Number((it as any)?.original_amount ?? 0) > 0)
        .reduce((s: number, it: any) => s + (Number((it as any)?.original_amount ?? 0) || 0), 0);
      const freeServiceMetaOriginal = Number(freeMeta?.original_price ?? 0) || 0;
      const freeServiceValue = Math.max(freeServiceOriginalTotal, freeServiceMetaOriginal);
      const freeServiceCode =
        String(invCouponMeta?.coupon_kind || '').toUpperCase() === 'FREE_SERVICE'
          ? String(invCouponMeta?.code || applied || '').trim().toUpperCase() || null
          : applied || null;
      const discountCodeCandidates = codes.filter((c) => c !== freeServiceCode);
      const discountCode = discountCodeCandidates[0] || (applied && applied !== freeServiceCode ? applied : null);

      const next: any[] = [];
      if (freeLabel || freeServiceValue > 0) {
        next.push({
          code: freeServiceCode || 'FREE_SERVICE',
          coupon_kind: 'FREE_SERVICE',
          discount_amount: freeServiceValue || 0,
          free_service_label: freeLabel,
          error: null,
        });
      }
      if (discountAmount > 0) {
        next.push({
          code: discountCode || 'DISCOUNT',
          coupon_kind: 'TOTAL_DISCOUNT',
          discount_amount: discountAmount,
          error: null,
        });
      } else if (codes.length > 0 && next.length === 0) {
        next.push(...codes.map((c) => ({ code: c, coupon_kind: null, discount_amount: 0, error: null })));
      }
      setCouponBreakdown(next);
      return;
    }

    // If discount is already applied on invoice, avoid noisy revalidations in most flows.
    // But for TI we still validate so FREE_SERVICE label + kinds are resolved consistently like OS.
    if (discountAmount > 0 && !isTI) {
      // Already applied on invoice; still show coupon codes, but don't recompute preview to avoid noisy validations.
      setCouponBreakdown(
        codes.map((c) => ({ code: c, coupon_kind: null, discount_amount: 0, error: null }))
      );
      return;
    }

    (async () => {
      try {
        setCouponBreakdownLoading(true);
        const serviceItems = (Array.isArray(inv?.line_items) ? inv.line_items : [])
          .filter((it: any) => {
            const c = String(it?.category || '').toUpperCase();
            return c === 'SERVICE' || c === 'ADDON' || c === 'ADD-ON' || c === 'ADD_ON';
          })
          .map((it: any) => ({
            service_type_id: it?.service_type_id ?? null,
            subservice_id: it?.subservice_id ?? null,
            label: it?.description ?? null,
            price:
              Number((it as any)?.original_amount ?? 0) > 0
                ? Number((it as any).original_amount)
                : Number(it?.amount ?? 0) || 0,
          }));

        const parseIdArray = (raw: any): string[] => {
          if (!raw) return [];
          if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
          if (typeof raw === 'string') {
            try {
              const parsed = JSON.parse(raw);
              if (Array.isArray(parsed)) return parsed.map(String).map((s) => s.trim()).filter(Boolean);
            } catch {
              // ignore
            }
            return raw.split(',').map((s) => s.trim()).filter(Boolean);
          }
          return [];
        };

        const leadCtx = {
          subtotal: subTotalBeforeDiscount,
          service_type_ids: parseIdArray((lead as any)?.service_type_ids),
          subservice_ids: parseIdArray((lead as any)?.subservice_ids),
          custom_labels: serviceItems.map((x: any) => String(x?.label || '')).filter(Boolean),
          service_items: serviceItems,
          customer_phone: (lead as any)?.customer_phone ?? null,
        };

        const results = await Promise.all(
          codes.map(async (c) => {
            try {
              const res = await fetch(`/api/coupons/validate?code=${encodeURIComponent(c)}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: c, lead_context: leadCtx }),
              });
              const json = await res.json().catch(() => ({}));
              const valid = Boolean(json?.valid);
              const kind = String(json?.coupon?.coupon_kind || '').trim() || null;
              const amt = Number(json?.discount_amount ?? 0) || 0;
              const label =
                String(json?.coupon_meta?.free_service?.matched_label || '').trim() ||
                String(json?.coupon_meta?.free_service?.target_custom_label || '').trim() ||
                String(json?.coupon?.target_custom_label || '').trim() ||
                String(json?.coupon?.description || '').trim() ||
                null;
              return {
                code: c,
                coupon_kind: kind,
                discount_amount: valid ? amt : 0,
                free_service_label: label,
                error: valid ? null : String(json?.error || 'Coupon not applicable'),
              };
            } catch (e: any) {
              return { code: c, coupon_kind: null, discount_amount: 0, error: e?.message || 'Failed to validate coupon' };
            }
          })
        );

        // Best-effort FREE_SERVICE amount fallback from invoice line_items original_amount when validate can't compute.
        const freeServiceOriginalTotal = (Array.isArray(inv?.line_items) ? inv.line_items : [])
          .filter((it: any) => Boolean((it as any)?.free_service) && Number((it as any)?.original_amount ?? 0) > 0)
          .reduce((s: number, it: any) => s + (Number((it as any)?.original_amount ?? 0) || 0), 0);
        const freeServiceMetaOriginal = Number((inv as any)?.coupon_meta?.free_service?.original_price ?? 0) || 0;
        const freeServiceFallbackValue = Math.max(freeServiceOriginalTotal, freeServiceMetaOriginal);
        const next = results.map((r) => {
          const k = String(r?.coupon_kind || '').toUpperCase();
          if (k === 'FREE_SERVICE' && (Number(r.discount_amount || 0) || 0) <= 0 && freeServiceFallbackValue > 0) {
            return { ...r, discount_amount: freeServiceFallbackValue };
          }
          return r;
        });

        if (cancelled) return;
        setCouponBreakdown(next);
      } catch (e: any) {
        if (cancelled) return;
        setCouponBreakdown([]);
      }
      finally {
        if (!cancelled) setCouponBreakdownLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [discountAmount, subTotalBeforeDiscount, (invoice as any)?.id, lead?.id]);

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
    if (c === 'EXTRA') return 'Additional Work';
    return c ? c : 'Items';
  };

  const categoryOrder = ['SERVICE', 'ADDON', 'PART', 'LABOUR', 'EXTRA'];
  const grouped = (() => {
    const map: Record<string, any[]> = {};
    for (const it of lineItemsWithIndex) {
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

  const getIncludedItems = (it: any) => {
    const cat = String(it?.category || '').toUpperCase();
    if (cat === 'EXTRA') {
      return Array.isArray(it?.included_items) ? it.included_items : [];
    }
    if (cat !== 'SERVICE') return [];
    if (Array.isArray(it?.included_items) && it.included_items.length > 0) {
      return it.included_items;
    }
    return (it?.service_type_id && includedByServiceTypeId[String(it.service_type_id)])
      ? includedByServiceTypeId[String(it.service_type_id)]
      : includedByServiceNameKey[normalizeName(String(it?.description || ''))] || [];
  };

  const computeIncludedTotal = (serviceRow: any, includedItems: any[], isEditingThis: boolean) => {
    return (includedItems || []).reduce((s: number, p: any) => {
      const pid = String(p?.product_id || '').trim();
      const qtyBase = Number(p?.quantity || 1) || 1;
      const unitPriceBase = Number(p?.unit_price || 0) || 0;
      const qtyDraftRaw = isEditingThis ? includedQtyDraft[pid] : null;
      const rateDraftRaw = isEditingThis ? includedRateDraft[pid] : null;
      const qty =
        isEditingThis && qtyDraftRaw != null && qtyDraftRaw !== ''
          ? Number(qtyDraftRaw)
          : qtyBase;
      const unitPrice =
        isEditingThis && rateDraftRaw != null && rateDraftRaw !== ''
          ? Number(rateDraftRaw)
          : unitPriceBase;
      const amountDraft = Number(p?.amount);
      const amt =
        Number.isFinite(amountDraft) && !isEditingThis
          ? amountDraft
          : (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0);
      return s + amt;
    }, 0);
  };

  function getServicePrice(it: any) {
    const qty = Number(it?.qty ?? 1) || 1;
    const rate = Number(it?.rate ?? 0) || 0;
    const amount = Number(it?.amount ?? 0) || 0;
    const fromLine = amount > 0 ? amount : qty * rate;

    // Custom Service is editable (do not override from master service pricing maps)
    if (isCustomServiceName(String(it?.description || ''))) {
      return Number.isFinite(fromLine) ? fromLine : 0;
    }
    // Advisor-edited OS lines stay as stored.
    if (it?.os_edited) {
      return Number.isFinite(fromLine) ? fromLine : 0;
    }

    // Transparent pricing: bill = sum of included workshop parts (not package sticker).
    const includedItems = getIncludedItems(it);
    if (Array.isArray(includedItems) && includedItems.length > 0) {
      const isEditingThis = editingIncludedFor === String(it?.description || '');
      const includedTotal = computeIncludedTotal(it, includedItems, isEditingThis);
      if (includedTotal > 0.5) return includedTotal;
    }

    if (String(it?.pricing_mode || '') === 'TRANSPARENT_INCLUDED_SUM' && fromLine > 0) {
      return fromLine;
    }

    const byType = it?.service_type_id ? servicePriceByTypeId[String(it.service_type_id)] : undefined;
    const byName = servicePriceByNameKey[normalizeName(String(it?.description || ''))];
    if (Number.isFinite(fromLine) && fromLine > 0) return fromLine;
    return Number.isFinite(byType) && (byType as number) > 0
      ? (byType as number)
      : Number.isFinite(byName) && (byName as number) > 0
        ? (byName as number)
        : (Number.isFinite(fromLine) ? fromLine : 0);
  }

  const applyProRata = (serviceRow: any, includedItems: any[]) => {
    // Pro-rata still targets package sticker when available; else current service amount.
    const byType = serviceRow?.service_type_id
      ? servicePriceByTypeId[String(serviceRow.service_type_id)]
      : undefined;
    const byName = servicePriceByNameKey[normalizeName(String(serviceRow?.description || ''))];
    const packageOrLine =
      (Number.isFinite(byType) && (byType as number) > 0 ? (byType as number) : 0) ||
      (Number.isFinite(byName) && (byName as number) > 0 ? (byName as number) : 0) ||
      getServicePrice(serviceRow);
    const servicePrice = packageOrLine;
    if (!Number.isFinite(servicePrice) || servicePrice <= 0) {
      alert('Service price is missing or invalid.');
      return;
    }
    const desc = String(serviceRow?.description || '');
    const isEditingThis = editingIncludedFor === desc;
    const currentTotal = computeIncludedTotal(serviceRow, includedItems, isEditingThis);
    if (!Number.isFinite(currentTotal) || currentTotal <= 0) {
      alert('Included items total is zero; cannot apply pro-rata.');
      return;
    }
    const factor = servicePrice / currentTotal;
    const nextRates: Record<string, string> = {};
    const nextQty: Record<string, string> = {};
    for (const p of includedItems || []) {
      const pid = String(p?.product_id || '').trim();
      if (!pid) continue;
      const qtyBase = Number(p?.quantity || 1) || 1;
      const unitPriceBase = Number(p?.unit_price || 0) || 0;
      const qtyDraftRaw = isEditingThis ? includedQtyDraft[pid] : null;
      const rateDraftRaw = isEditingThis ? includedRateDraft[pid] : null;
      const qty =
        isEditingThis && qtyDraftRaw != null && qtyDraftRaw !== ''
          ? Number(qtyDraftRaw)
          : qtyBase;
      const unitPrice =
        isEditingThis && rateDraftRaw != null && rateDraftRaw !== ''
          ? Number(rateDraftRaw)
          : unitPriceBase;
      const amount = (Number.isFinite(qty) ? qty : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0);
      const adjustedAmount = amount * factor;
      const nextRate = (Number.isFinite(qty) && qty > 0) ? adjustedAmount / qty : 0;
      nextRates[pid] = Number.isFinite(nextRate) ? nextRate.toFixed(2) : '0';
      nextQty[pid] = Number.isFinite(qty) ? String(qty) : '1';
    }
    setEditingIncludedFor(desc);
    setIncludedRateDraft(nextRates);
    setIncludedQtyDraft(nextQty);
  };

  const serviceMismatchTotal = useMemo(() => {
    if (!isOS) return 0;
    return lineItemsWithIndex.reduce((sum: number, it: any) => {
      const cat = String(it?.category || '').toUpperCase();
      if (cat !== 'SERVICE') return sum;
      if (isCustomServiceName(String(it?.description || ''))) return sum;
      const includedItems = getIncludedItems(it);
      if (!Array.isArray(includedItems) || includedItems.length === 0) return sum;
      const isEditingThis = editingIncludedFor === String(it?.description || '');
      const includedTotal = computeIncludedTotal(it, includedItems, isEditingThis);
      const serviceAmount = getServicePrice(it);
      const diff = Math.abs(includedTotal - serviceAmount);
      return sum + (diff > 0.5 ? diff : 0);
    }, 0);
  }, [
    isOS,
    lineItemsWithIndex,
    includedByServiceTypeId,
    includedByServiceNameKey,
    includedQtyDraft,
    includedRateDraft,
    editingIncludedFor,
    servicePriceByTypeId,
    servicePriceByNameKey,
  ]);

  const hasServiceMismatch = isOS && serviceMismatchTotal > 0.5;

  const byType = useMemo(() => {
    const map: Record<string, Invoice> = {};
    for (const inv of invoiceList || []) {
      const t = String((inv as any)?.invoice_type || '').toUpperCase();
      if (!t) continue;
      if (!map[t]) map[t] = inv;
    }
    return map;
  }, [invoiceList]);

  const hasOS = Boolean(byType['ORDER_SUMMARY']);
  const hasTI = Boolean(byType['TAX_INVOICE']);
  const ciInv = byType['CUSTOMER_INVOICE'] as any;
  const tiInv = byType['TAX_INVOICE'] as any;
  const ciPaid = isInvoicePaid(ciInv);
  const canGenerateTI = ciPaid && !tiInv;

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
            <div className="mb-4 grid grid-cols-1 sm:grid-cols-2 gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Customer</p>
                <p className="font-bold text-[#023D95]">{lead?.customer_name || '—'}</p>
                <p className="text-slate-600">{lead?.customer_phone || lead?.lead_number || ''}</p>
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">Vehicle / Service</p>
                <p className="font-bold text-[#023D95]">{lead?.vehicle_number || '—'}</p>
                <p className="text-slate-600">
                  {[lead?.vehicle_make, lead?.vehicle_model, lead?.service_type].filter(Boolean).join(' · ') || '—'}
                </p>
              </div>
            </div>

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
              {/* Hide "View Tax Invoice" button (TI tab already exists). Keep only Generate action. */}
              {canGenerateTI && activeTypeKey !== 'CUSTOMER_INVOICE' && (
                <button
                  type="button"
                  onClick={ensureTaxInvoice}
                  className="btn btn-primary text-xs sm:text-sm px-3 py-2"
                  title="Generate Tax Invoice"
                >
                  Generate Tax Invoice
                </button>
              )}
            </div>
          )}

          {/* Invoice Breakdown */}
          <div className="border border-gray-200 rounded-lg overflow-hidden overflow-x-auto">
            <table className="w-full text-sm min-w-[560px]">
              {hasLineItems ? (
                <>
                  <thead className="bg-gray-100">
                    <tr>
                      <th className="px-4 py-3 text-left font-semibold w-12">Sr</th>
                      <th className="px-4 py-3 text-left font-semibold">Item</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {(() => {
                      let runningSr = 0;
                      return grouped.map((g) => {
                      let groupSum = 0;
                      return (
                      <React.Fragment key={g.key}>
                        <tr className="bg-gray-50">
                          <td className="px-4 py-2 text-xs font-bold text-gray-700" colSpan={2}>
                            {categoryLabel(g.key)}
                          </td>
                        </tr>
                        {g.items.map((it: any, idx: number) => {
                          const rowIndex = Number(it?._idx ?? idx);
                          const qtyBase = Number(it?.qty ?? 1) || 1;
                          const rateBase =
                            !isOS && it?.amount != null
                              ? (qtyBase ? Number(it?.amount || 0) / qtyBase : Number(it?.amount || 0))
                              : it?.rate != null
                                ? Number(it.rate)
                                : qtyBase
                                  ? Number(it?.amount || 0) / qtyBase
                                  : Number(it?.amount || 0);
                          const cat = String(it?.category || '').toUpperCase();
                          const isService = cat === 'SERVICE';
                          const isCustomService = isCustomServiceName(String(it?.description || ''));
                          const canEditLineItem = isOS && (!isService || isCustomService);
                          const qty = canEditLineItem ? getDraftValue(rowIndex, 'qty', qtyBase) : qtyBase;
                          const rate = canEditLineItem ? getDraftValue(rowIndex, 'rate', rateBase || 0) : rateBase;
                          const amt = canEditLineItem ? qty * rate : Number(it?.amount ?? 0) || 0;
                          runningSr += 1;
                          const sr = runningSr;
                          const includedItems = getIncludedItems(it);
                          const canEditIncluded = isOS && cat === 'SERVICE' && Array.isArray(includedItems) && includedItems.length > 0;
                          const extraEditKey = String(it?.extra_charge_id || it?.description || '').trim();
                          const canEditExtraParts = isOS && cat === 'EXTRA' && Boolean(it?.extra_charge_id);
                          const isEditingExtra = canEditExtraParts && extraPartsEditKey === extraEditKey;
                          const isEditingThis = canEditIncluded && editingIncludedFor === String(it?.description || '');
                          const includedTotal = computeIncludedTotal(it, includedItems, isEditingThis);
                          const servicePrice = isService
                            ? isOS
                              ? (isCustomService && canEditLineItem ? amt : getServicePrice(it))
                              : getServicePrice(it)
                            : amt;
                          const diffSigned = includedTotal - servicePrice;
                          const mismatch =
                            cat === 'SERVICE' &&
                            Array.isArray(includedItems) &&
                            includedItems.length > 0 &&
                            !isCustomService &&
                            Math.abs(includedTotal - servicePrice) > 0.5;
                          const displayRate =
                            !isOS && isService
                              ? (qty ? servicePrice / qty : servicePrice)
                              : rate;
                          const displayTotal = isService ? servicePrice : amt;
                          return (
                            <tr key={`${g.key}-${idx}`}>
                              <td className="px-4 py-3 text-gray-600">{sr}</td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-2">
                                  <span>{it?.description || '-'}</span>
                                  {isService && (
                                    <span className="text-[11px] text-gray-500">
                                      (Service Price: {money(servicePrice)})
                                    </span>
                                  )}
                                </div>
                                {isCustomService && (
                                  <div className="mt-1">
                                    {isOS ? (
                                      <input
                                        type="text"
                                        className="w-full max-w-md rounded border border-gray-200 px-2 py-1 text-[11px]"
                                        placeholder="Remark (optional)"
                                        value={
                                          lineItemDrafts[String(rowIndex)]?.remark ??
                                          String(it?.custom_remark ?? it?.remark ?? it?.notes ?? '')
                                        }
                                        onChange={(e) =>
                                          setLineItemDrafts((prev) => ({
                                            ...prev,
                                            [String(rowIndex)]: { ...prev[String(rowIndex)], remark: e.target.value },
                                          }))
                                        }
                                        onBlur={saveLineItems}
                                      />
                                    ) : (
                                      (() => {
                                        const r = String(it?.custom_remark ?? it?.remark ?? it?.notes ?? '').trim();
                                        return r ? (
                                          <div className="text-[11px] text-gray-600">
                                            <span className="font-semibold">Remark:</span> {r}
                                          </div>
                                        ) : null;
                                      })()
                                    )}
                                  </div>
                                )}
                                {isOS && mismatch && (
                                  <div className="mt-1 text-[11px] text-red-600">
                                    Included total {money(includedTotal)} does not match service price {money(servicePrice)} (diff {diffSigned >= 0 ? '+' : '-'}{money(Math.abs(diffSigned))})
                                  </div>
                                )}
                                {canEditExtraParts && (
                                  <div className="mt-2">
                                    <button
                                      type="button"
                                      className="text-[11px] font-bold text-blue-700 hover:underline"
                                      onClick={() => beginExtraPartsEdit(it, includedItems)}
                                    >
                                      {isEditingExtra
                                        ? 'Cancel'
                                        : Array.isArray(includedItems) && includedItems.length > 0
                                          ? 'Edit parts / pricing'
                                          : 'Add parts / pricing'}
                                    </button>
                                    {isEditingExtra && (
                                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-2 space-y-2">
                                        <p className="text-[11px] text-slate-600">
                                          Transparent pricing: list every part replaced / used with qty and rate.
                                        </p>
                                        {extraPartsDraft.map((row, ri) => (
                                          <div key={`extra-part-${ri}`} className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                                            <input
                                              className="sm:col-span-5 rounded border border-slate-200 px-2 py-1 text-xs"
                                              placeholder="Part / labour name"
                                              value={row.name}
                                              onChange={(e) =>
                                                setExtraPartsDraft((prev) =>
                                                  prev.map((r, i) => (i === ri ? { ...r, name: e.target.value } : r)),
                                                )
                                              }
                                            />
                                            <input
                                              className="sm:col-span-2 rounded border border-slate-200 px-2 py-1 text-xs"
                                              placeholder="Qty"
                                              value={row.qty}
                                              onChange={(e) =>
                                                setExtraPartsDraft((prev) =>
                                                  prev.map((r, i) => (i === ri ? { ...r, qty: e.target.value } : r)),
                                                )
                                              }
                                            />
                                            <input
                                              className="sm:col-span-2 rounded border border-slate-200 px-2 py-1 text-xs"
                                              placeholder="Rate"
                                              value={row.unit_price}
                                              onChange={(e) =>
                                                setExtraPartsDraft((prev) =>
                                                  prev.map((r, i) => (i === ri ? { ...r, unit_price: e.target.value } : r)),
                                                )
                                              }
                                            />
                                            <select
                                              className="sm:col-span-2 rounded border border-slate-200 px-2 py-1 text-xs"
                                              value={row.kind}
                                              onChange={(e) =>
                                                setExtraPartsDraft((prev) =>
                                                  prev.map((r, i) =>
                                                    i === ri
                                                      ? { ...r, kind: e.target.value as 'PART' | 'LABOUR' | 'OTHER' }
                                                      : r,
                                                  ),
                                                )
                                              }
                                            >
                                              <option value="PART">Part</option>
                                              <option value="LABOUR">Labour</option>
                                              <option value="OTHER">Other</option>
                                            </select>
                                            <button
                                              type="button"
                                              className="sm:col-span-1 text-[11px] text-red-600"
                                              onClick={() =>
                                                setExtraPartsDraft((prev) => prev.filter((_, i) => i !== ri))
                                              }
                                            >
                                              ✕
                                            </button>
                                          </div>
                                        ))}
                                        <div className="flex flex-wrap gap-2">
                                          <button
                                            type="button"
                                            className="text-[11px] font-bold text-blue-700"
                                            onClick={() =>
                                              setExtraPartsDraft((prev) => [
                                                ...prev,
                                                { name: '', qty: '1', unit_price: '', kind: 'PART' },
                                              ])
                                            }
                                          >
                                            + Add line
                                          </button>
                                          <button
                                            type="button"
                                            className="rounded bg-[#004AAD] px-3 py-1 text-[11px] font-bold text-white disabled:opacity-60"
                                            disabled={savingExtraParts}
                                            onClick={() => saveExtraPartsEdit(it)}
                                          >
                                            {savingExtraParts ? 'Saving…' : 'Save pricing'}
                                          </button>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {Array.isArray(includedItems) && includedItems.length > 0 && (
                                  <div className="mt-1 text-[11px] text-gray-500">
                                    <div className="flex items-center justify-between gap-2">
                                      <div className="font-semibold">Included:</div>
                                      {canEditIncluded && (
                                        <div className="flex items-center gap-2">
                                          {mismatch && (
                                            <button
                                              type="button"
                                              className="text-[11px] text-blue-700 hover:underline"
                                              onClick={() => applyProRata(it, includedItems)}
                                            >
                                              Pro-rate match
                                            </button>
                                          )}
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
                                        </div>
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
                                            const qtyBase = Number(p?.quantity || 1) || 1;
                                            const unitPriceBase = Number(p?.unit_price || 0) || 0;
                                            const pid = String(p?.product_id || i);
                                            const qtyDraftRaw = includedQtyDraft[pid];
                                            const rateDraftRaw = includedRateDraft[pid];
                                            const qtyI =
                                              isEditingThis && qtyDraftRaw != null && qtyDraftRaw !== ''
                                                ? Number(qtyDraftRaw)
                                                : qtyBase;
                                            const unitPrice =
                                              isEditingThis && rateDraftRaw != null && rateDraftRaw !== ''
                                                ? Number(rateDraftRaw)
                                                : unitPriceBase;
                                            const amtI = (Number.isFinite(qtyI) ? qtyI : 0) * (Number.isFinite(unitPrice) ? unitPrice : 0);
                                            return (
                                              <tr key={pid} className="text-gray-700">
                                                <td className="pr-2 py-1">
                                                  {isEditingThis && isCustomService ? (
                                                    <input
                                                      type="text"
                                                      className="w-44 rounded border border-gray-200 px-2 py-0.5"
                                                      value={includedNameDraft[pid] ?? String(p?.name || '')}
                                                      onChange={(e) =>
                                                        setIncludedNameDraft((prev) => ({
                                                          ...prev,
                                                          [pid]: e.target.value,
                                                        }))
                                                      }
                                                      placeholder="Item name"
                                                    />
                                                  ) : (
                                                    <>
                                                      {String(p?.name || 'Item')}
                                                      {p?.part_number ? ` (${String(p.part_number)})` : ''}
                                                    </>
                                                  )}
                                                </td>
                                                <td className="pr-2 py-1">{String(p?.type || '—')}</td>
                                                <td className="pr-2 py-1 text-right">
                                                  {isEditingThis ? (
                                                    <input
                                                      type="number"
                                                      step="0.01"
                                                      className="w-16 rounded border border-gray-200 px-2 py-0.5 text-right"
                                                      value={includedQtyDraft[pid] ?? String(qtyBase)}
                                                      onChange={(e) =>
                                                        setIncludedQtyDraft((prev) => ({
                                                          ...prev,
                                                          [pid]: e.target.value,
                                                        }))
                                                      }
                                                    />
                                                  ) : (
                                                    qtyBase
                                                  )}
                                                </td>
                                                <td className="pr-2 py-1 text-right">
                                                  {isEditingThis ? (
                                                    <input
                                                      type="number"
                                                      step="0.01"
                                                      className="w-20 rounded border border-gray-200 px-2 py-0.5 text-right"
                                                      value={includedRateDraft[String(p?.product_id || '')] ?? String(unitPriceBase || '')}
                                                      onChange={(e) =>
                                                        setIncludedRateDraft((prev) => ({
                                                          ...prev,
                                                          [String(p?.product_id || '')]: e.target.value,
                                                        }))
                                                      }
                                                    />
                                                  ) : (
                                                    money(unitPriceBase)
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
                                          onClick={() =>
                                            saveIncludedRates(
                                              String(it?.description || ''),
                                              includedItems,
                                              (it?.service_type_id ? String(it.service_type_id) : null)
                                            )
                                          }
                                        >
                                          Save
                                        </button>
                                        <span className="text-gray-400 text-[11px]">
                                          Saved in OS. CI will update when you click Recalculate/Finalize again.
                                        </span>
                                      </div>
                                    )}
                                  </div>
                                )}
                                {(() => {
                                  groupSum += Number(displayTotal) || 0;
                                  return null;
                                })()}
                                <div className="mt-3 grid grid-cols-3 gap-2 max-w-md">
                                  <div className="rounded-lg bg-slate-100 px-2 py-2 text-center">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Qty</div>
                                    {canEditLineItem ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-right text-sm"
                                        value={lineItemDrafts[String(rowIndex)]?.qty ?? String(qtyBase)}
                                        onChange={(e) =>
                                          setLineItemDrafts((prev) => ({
                                            ...prev,
                                            [String(rowIndex)]: { ...prev[String(rowIndex)], qty: e.target.value },
                                          }))
                                        }
                                        onBlur={saveLineItems}
                                      />
                                    ) : (
                                      <div className="mt-1 text-sm font-semibold text-slate-800">{qty}</div>
                                    )}
                                  </div>
                                  <div className="rounded-lg bg-slate-100 px-2 py-2 text-center">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Rate</div>
                                    {canEditLineItem ? (
                                      <input
                                        type="number"
                                        step="0.01"
                                        className="mt-1 w-full rounded border border-gray-200 px-2 py-1 text-right text-sm"
                                        value={lineItemDrafts[String(rowIndex)]?.rate ?? String(rateBase || 0)}
                                        onChange={(e) =>
                                          setLineItemDrafts((prev) => ({
                                            ...prev,
                                            [String(rowIndex)]: { ...prev[String(rowIndex)], rate: e.target.value },
                                          }))
                                        }
                                        onBlur={saveLineItems}
                                      />
                                    ) : (
                                      <div className="mt-1 text-sm font-semibold text-slate-800">{money(displayRate)}</div>
                                    )}
                                  </div>
                                  <div className="rounded-lg bg-blue-50 px-2 py-2 text-center">
                                    <div className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">Total</div>
                                    <div className="mt-1 text-sm font-bold text-[#004AAD]">{money(displayTotal)}</div>
                                  </div>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                        <tr className="bg-slate-50">
                          <td className="px-4 py-2" />
                          <td className="px-4 py-2">
                            <div className="flex items-center justify-between gap-3">
                              <span className="text-sm font-bold text-slate-700">{categoryLabel(g.key)} total</span>
                              <span className="text-sm font-bold text-[#004AAD]">{money(groupSum)}</span>
                            </div>
                          </td>
                        </tr>
                      </React.Fragment>
                    );
                    });
                  })()}
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
                        <td className="px-4 py-3">Additional Work</td>
                        <td className="px-4 py-3 text-right font-medium">₹{((invoice.extra_charges_amount || invoice.extra_charges) || 0).toFixed(2)}</td>
                      </tr>
                    )}
                  </tbody>
                </>
              )}
            </table>

            {isOS && hasLineItems && (
              <div className="px-4 py-3 border-t border-gray-200 bg-gray-50">
                <span className="text-[11px] text-gray-500">
                  Service price is fixed except Custom service. Edit included items to match the service price. Other rows auto-save on blur.
                </span>
              </div>
            )}

            {/* Totals */}
            <table className="w-full text-sm border-t border-gray-200">
              <tbody className="divide-y divide-gray-200">
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 font-semibold">Sub-Total</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{(subTotalBeforeDiscount || 0).toFixed(2)}</td>
                </tr>
                {(() => {
                  const free = couponBreakdown.find((c) => String(c?.coupon_kind || '').toUpperCase() === 'FREE_SERVICE');
                  const total = couponBreakdown.find((c) => String(c?.coupon_kind || '').toUpperCase() === 'TOTAL_DISCOUNT');
                  const freeLabel =
                    free?.free_service_label ||
                    String(invoiceCouponMeta?.free_service?.matched_label || '').trim() ||
                    String(leadCouponMeta?.free_service?.matched_label || '').trim() ||
                    String(invoiceCouponMeta?.free_service?.target_custom_label || '').trim() ||
                    String(leadCouponMeta?.free_service?.target_custom_label || '').trim() ||
                    null;
                  const freeCode =
                    free?.code ||
                    (couponMetaKind === 'FREE_SERVICE' ? (couponMetaCode || couponCodeForDisplay) : null) ||
                    allCouponCodesForDisplay[0] ||
                    null;
                  const totalDiscountAmount =
                    Number(
                      total?.discount_amount ??
                        (discountAmount > 0 && (hasTotalDiscountCoupon || couponMetaKind === 'TOTAL_DISCOUNT')
                          ? discountAmount
                          : 0)
                    ) || 0;
                  const totalDiscountCode =
                    total?.code ||
                    (couponMetaKind === 'TOTAL_DISCOUNT' ? (couponMetaCode || couponCodeForDisplay) : null) ||
                    (String(leadCouponMeta?.coupon_kind || '').toUpperCase() === 'TOTAL_DISCOUNT'
                      ? String(leadCouponMeta?.code || '').trim()
                      : null) ||
                    allCouponCodesForDisplay.find((c) => c && c !== freeCode) ||
                    null;

                  const hasAny =
                    Boolean(free) ||
                    Boolean(freeCode) ||
                    Boolean(totalDiscountCode) ||
                    couponBreakdownLoading ||
                    couponBreakdown.some((c) => Boolean(c?.error));
                  if (!hasAny) return null;

                  return (
                    <>
                      {(free || freeCode) && (
                        <tr>
                          <td className="px-4 py-3">{freeCode || 'FREE_SERVICE'}</td>
                          <td className="px-4 py-3 text-right font-semibold">{freeLabel || '—'}</td>
                        </tr>
                      )}
                      {totalDiscountCode && (
                        <tr>
                          <td className="px-4 py-3">{totalDiscountCode || 'TOTAL_DISCOUNT'}</td>
                          <td className="px-4 py-3 text-right text-red-600">-₹{totalDiscountAmount.toFixed(2)}</td>
                        </tr>
                      )}
                      {totalDiscountAmount <= 0 && couponBreakdownLoading && (
                        <tr>
                          <td className="px-4 py-3">Discount / Coupon</td>
                          <td className="px-4 py-3 text-right text-gray-500">Calculating…</td>
                        </tr>
                      )}
                      {!couponBreakdownLoading &&
                        isOS &&
                        couponBreakdown.some((c) => c.error) &&
                        totalDiscountAmount <= 0 && (
                          <tr>
                            <td colSpan={2} className="px-4 py-2 text-xs text-red-600 bg-red-50">
                              {(couponBreakdown.filter((c) => c.error).slice(0, 2) as any[])
                                .map((c) => `${c.code}: ${c.error}`)
                                .join(' • ')}
                            </td>
                          </tr>
                        )}
                    </>
                  );
                })()}
                {(() => {
                  const previewDiscount =
                    discountAmount > 0 && hasTotalDiscountCoupon ? discountAmount : totalDiscountOnly;
                  const computedAfter = Math.max(0, subTotalBeforeDiscount - previewDiscount);
                  const effectiveValue = showGst ? taxableValue : computedAfter;
                  return (
                    <tr className="bg-gray-50">
                      <td className="px-4 py-3 font-semibold">{showGst ? 'Taxable Value' : 'Sub-Total after Discount'}</td>
                      <td className="px-4 py-3 text-right font-semibold">₹{effectiveValue.toFixed(2)}</td>
                    </tr>
                  );
                })()}
                {hasServiceMismatch && (
                  <tr>
                    <td className="px-4 py-3 text-red-600 font-semibold">Service items mismatch (fix to proceed)</td>
                    <td className="px-4 py-3 text-right text-red-600 font-semibold">
                      -₹{serviceMismatchTotal.toFixed(2)}
                    </td>
                  </tr>
                )}
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
                    {isOS ? 'Grand Total' : isCI ? 'Total to Pay' : 'Amount Payable (INR)'}
                  </td>
                  <td className="px-4 py-3 text-right">₹{(effectivePayable || 0).toFixed(2)}</td>
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
          {(invoice.paid_amount || 0) > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-green-700">Amount Paid</p>
                  <p className="text-2xl font-bold text-green-800">₹{(invoice.paid_amount || 0).toFixed(2)}</p>
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
                    ₹{(((effectivePayable || 0) - (invoice.paid_amount || 0))).toFixed(2)}
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
            {hasOS && !hasTI && (
              <button onClick={regenerateOS} className="btn btn-outline flex-1">
                <RefreshCw className="w-4 h-4" />
                Regenerate OS
              </button>
            )}
            {isOS && (
              <button
                onClick={() => finalizeBill()}
                disabled={finalizing || hasServiceMismatch}
                className="btn btn-secondary flex-1"
              >
                <RefreshCw className={`w-4 h-4 ${finalizing ? 'animate-spin' : ''}`} />
                {finalizing ? 'Finalizing...' : 'Finalize Bill (Create CI)'}
              </button>
            )}
            {isCI && (
              <button
                onClick={handleRecalculateBillOrGenerateTI}
                disabled={finalizing || ensuringTI || hasServiceMismatch}
                className="btn btn-secondary flex-1"
              >
                <RefreshCw className={`w-4 h-4 ${(finalizing || ensuringTI) ? 'animate-spin' : ''}`} />
                {ensuringTI ? 'Generating TI...' : finalizing ? 'Recalculating...' : 'Recalculate Bill'}
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

              <div className="mt-3 rounded-md border border-gray-200 p-3 bg-gray-50">
                <label className="flex items-center gap-2 text-sm font-semibold text-gray-800">
                  <input
                    type="checkbox"
                    checked={gstEnabled}
                    onChange={(e) => {
                      const checked = e.target.checked;
                      setGstEnabled(checked);
                      if (!checked) {
                        setCustomerGstin('');
                        setCustomerLegalName('');
                        setCustomerBillingAddress('');
                        setCustomerBillingStateCode('');
                        saveCustomerGst({
                          customer_gstin: null,
                          customer_legal_name: null,
                          customer_billing_address: null,
                          customer_billing_state_code: null,
                        });
                      }
                    }}
                  />
                  Customer is GST registered (optional)
                </label>
                {gstEnabled && (
                  <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs text-gray-600">Customer GSTIN</label>
                      <input
                        className="w-full border rounded-md p-2"
                        value={customerGstin}
                        onChange={(e) => {
                          const v = String(e.target.value || '').toUpperCase().replace(/\s+/g, '');
                          setCustomerGstin(v);
                          setCustomerBillingStateCode(deriveStateCodeFromGstin(v));
                        }}
                        onBlur={() => {
                          const v = customerGstin.trim().toUpperCase().replace(/\s+/g, '');
                          const stateCode = deriveStateCodeFromGstin(v);
                          saveCustomerGst({
                            customer_gstin: v === '' ? null : v,
                            customer_billing_state_code: stateCode ? stateCode : null,
                          });
                        }}
                        placeholder="e.g. 27ABCDE1234F1Z5"
                      />
                      {!!deriveStateCodeFromGstin(customerGstin) && (
                        <div className="mt-1 text-[11px] text-gray-500">
                          State code: <span className="font-semibold">{deriveStateCodeFromGstin(customerGstin)}</span> (from GSTIN)
                        </div>
                      )}
                    </div>
                    <div>
                      <label className="text-xs text-gray-600">Legal Name</label>
                      <input
                        className="w-full border rounded-md p-2"
                        value={customerLegalName}
                        onChange={(e) => setCustomerLegalName(e.target.value)}
                        onBlur={() => {
                          const v = customerLegalName.trim();
                          saveCustomerGst({ customer_legal_name: v === '' ? null : v });
                        }}
                        placeholder="Registered business name"
                      />
                    </div>
                    <div className="md:col-span-2">
                      <label className="text-xs text-gray-600">Billing Address</label>
                      <input
                        className="w-full border rounded-md p-2"
                        value={customerBillingAddress}
                        onChange={(e) => setCustomerBillingAddress(e.target.value)}
                        onBlur={() => {
                          const v = customerBillingAddress.trim();
                          saveCustomerGst({ customer_billing_address: v === '' ? null : v });
                        }}
                        placeholder="Billing address for GST invoice"
                      />
                    </div>
                    {savingGst && (
                      <div className="md:col-span-2 text-[11px] text-gray-500">Saving GST details…</div>
                    )}
                  </div>
                )}
              </div>

              {showPaymentForm && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div className="md:col-span-2">
                    <div className="text-xs font-semibold text-gray-700 mb-1">Next Service Due</div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      <div>
                        <label className="text-xs text-gray-600">Next Service KM</label>
                        <input
                          type="number"
                          className="w-full border rounded-md p-2"
                          value={nextServiceKm}
                          onChange={(e) => setNextServiceKm(e.target.value)}
                          onBlur={() => {
                            const v = nextServiceKm.trim();
                            saveNextService({ next_service_km: v === '' ? null : Number(v) });
                          }}
                          placeholder="auto: odometer + 10000"
                        />
                      </div>
                      <div>
                        <label className="text-xs text-gray-600">Next Service Date</label>
                        <input
                          type="date"
                          className="w-full border rounded-md p-2"
                          value={nextServiceDate}
                          onChange={(e) => setNextServiceDate(e.target.value)}
                          onBlur={() => {
                            const v = nextServiceDate.trim();
                            saveNextService({ next_service_date: v === '' ? null : v });
                          }}
                        />
                      </div>
                    </div>
                    <div className="mt-1 text-[11px] text-gray-500">
                      {((lead as any)?.daily_running_km ?? null) != null
                        ? (
                          <>Daily Running: <span className="font-semibold">{String((lead as any)?.daily_running_km)}</span> km/day</>
                        )
                        : (
                          <>Tip: set “Daily Running KM” to auto-calculate next service date.</>
                        )}
                      {savingNextService ? <span> • Saving…</span> : null}
                    </div>
                  </div>
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
                      list="workshop-staff-list"
                      className="w-full border rounded-md p-2"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="e.g. Rahul (Supervisor)"
                    />
                    <datalist id="workshop-staff-list">
                      {(workshopStaff || []).map((s) => (
                        <option key={s.id} value={s.full_name} />
                      ))}
                    </datalist>
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

