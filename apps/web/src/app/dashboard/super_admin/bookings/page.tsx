'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Car, ClipboardList, Loader2, Search, UserRound, Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet, Smartphone, Globe, Ticket, Pencil, Trash2, CheckSquare, Square, MinusSquare } from 'lucide-react';
import toast from 'react-hot-toast';
import { filterBookingLeads, enrichBookingLead } from '@/lib/booking-lead-utils';
import { LEAD_SOURCES } from '@/lib/enquiry/createLead';

type ServiceLead = Record<string, any>;
type ChatbotBooking = Record<string, any>;
type CsvRow = Record<string, string>;
type ActiveTab = 'service_leads' | 'chatbot_bookings' | 'upload_crm';

const STATUS_OPTIONS = ['ALL', 'NEW', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;
const SOURCE_OPTIONS = ['ALL', 'APP', 'WEBSITE', 'OTHER'] as const;
const COUPON_OPTIONS = ['ALL', 'YES', 'NO'] as const;

function formatDateTime(value?: string | null) {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCurrency(value?: number | string | null) {
  if (value === null || value === undefined || value === '') return '-';
  const num = Number(value);
  if (!Number.isFinite(num)) return '-';
  return `Rs ${num.toLocaleString('en-IN')}`;
}

function SourceBadge({ label, source }: { label: string; source: string }) {
  const styles =
    source === 'APP'
      ? 'bg-emerald-100 text-emerald-800'
      : source === 'WEBSITE'
        ? 'bg-blue-100 text-blue-800'
        : 'bg-gray-100 text-gray-700';
  const Icon = source === 'APP' ? Smartphone : source === 'WEBSITE' ? Globe : UserRound;
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap shrink-0 ${styles}`}>
      <Icon className="w-3 h-3 shrink-0" />
      {label}
    </span>
  );
}

function CouponBadge({ code, discount }: { code?: string | null; discount?: number | null }) {
  if (!code && !discount) return <span className="text-gray-400 text-xs">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs whitespace-nowrap">
      {code ? (
        <span className="inline-flex items-center gap-1 font-semibold text-orange-700">
          <Ticket className="w-3 h-3 shrink-0" />
          {code}
        </span>
      ) : null}
      {discount ? (
        <span className="text-emerald-700 font-medium">-Rs {Number(discount).toLocaleString('en-IN')}</span>
      ) : null}
    </span>
  );
}

function getLeadDisplayAmount(lead: ServiceLead) {
  const display = lead.amount_display;
  const estimated = Number(lead.estimated_amount || lead.actual_amount || 0);
  const meta = lead.meta && typeof lead.meta === 'object' ? (lead.meta as Record<string, unknown>) : {};
  const subtotal = Number(meta.service_subtotal || 0);
  const wallet = meta.wallet_applied ? Number(meta.wallet_deduction || 0) : 0;

  if (display !== null && display !== undefined && display !== '') {
    const num = Number(display);
    if (Number.isFinite(num)) {
      if (wallet > 0 && subtotal > 0 && num >= subtotal - 0.01 && estimated > 0 && estimated < num) {
        return estimated;
      }
      return num;
    }
  }

  if (wallet > 0 && subtotal > 0) {
    return Math.max(0, subtotal - wallet);
  }

  return lead.estimated_amount;
}

function getServiceLabel(lead: ServiceLead) {
  if (lead.service_display) return String(lead.service_display);
  if (lead.service_type) {
    return String(lead.service_type)
      .replace(/_/g, ' ')
      .split(' ')
      .map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
      .join(' ');
  }
  return '-';
}

function prettifyKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function SuperAdminBookingsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('service_leads');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [sourceFilter, setSourceFilter] = useState<(typeof SOURCE_OPTIONS)[number]>('ALL');
  const [couponFilter, setCouponFilter] = useState<(typeof COUPON_OPTIONS)[number]>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [serviceLeads, setServiceLeads] = useState<ServiceLead[]>([]);
  const [chatbotBookings, setChatbotBookings] = useState<ChatbotBooking[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Record<string, any> | null>(null);
  const [detailTitle, setDetailTitle] = useState('');

  const [editOpen, setEditOpen] = useState(false);
  const [editLead, setEditLead] = useState<ServiceLead | null>(null);
  const [editForm, setEditForm] = useState({
    customer_name: '',
    customer_phone: '',
    vehicle_number: '',
    city: '',
    status: 'NEW',
    lead_source: 'Website',
    estimated_amount: '',
    coupon_code: '',
    discount_amount: '',
    service_type: '',
  });
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  // CSV upload state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [csvFileName, setCsvFileName] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ inserted: number; skipped: number; total: number; errors?: string[] } | null>(null);

  const CSV_COLUMNS = ['phone_no', 'name', 'address', 'regdate', 'car_number', 'make', 'model'] as const;

  const splitCsvLine = (line: string, sep: string): string[] => {
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"' && line[i + 1] === '"') {
          current += '"';
          i++;
        } else if (ch === '"') {
          inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') {
          inQuotes = true;
        } else if (ch === sep) {
          fields.push(current);
          current = '';
        } else {
          current += ch;
        }
      }
    }
    fields.push(current);
    return fields;
  };

  const parseCsv = (text: string): CsvRow[] => {
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) return [];
    const headerLine = lines[0];
    const sep = headerLine.includes('\t') ? '\t' : ',';
    const headers = splitCsvLine(headerLine, sep).map((h) => h.trim().toLowerCase().replace(/[^a-z0-9_]/g, '_'));
    const expectedCols = headers.length;

    return lines.slice(1).map((line) => {
      let values = splitCsvLine(line, sep);

      // If there are extra columns (unquoted commas in data), merge overflow into the last known text column
      if (sep === ',' && values.length > expectedCols) {
        const phoneIdx = headers.indexOf('phone_no');
        const nameIdx = headers.indexOf('name');
        const addressIdx = headers.indexOf('address');
        const mergeIdx = addressIdx >= 0 ? addressIdx : nameIdx >= 0 ? nameIdx : phoneIdx >= 0 ? phoneIdx + 1 : 1;
        const overflow = values.length - expectedCols;
        const merged = values.slice(mergeIdx, mergeIdx + overflow + 1).join(', ');
        values = [...values.slice(0, mergeIdx), merged, ...values.slice(mergeIdx + overflow + 1)];
      }

      const row: CsvRow = {};
      headers.forEach((h, i) => {
        row[h] = (values[i] || '').trim();
      });
      return row;
    });
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadResult(null);
    setCsvFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      setCsvRows(rows);
      if (rows.length === 0) toast.error('No data rows found in the file');
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  const handleUpload = async () => {
    if (csvRows.length === 0) return;
    setUploading(true);
    setUploadResult(null);

    const CHUNK = 2000;
    let totalInserted = 0;
    let totalSkipped = 0;
    const allErrors: string[] = [];

    try {
      for (let i = 0; i < csvRows.length; i += CHUNK) {
        const chunk = csvRows.slice(i, i + CHUNK);
        const res = await fetch('/api/crm/enquiries/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ rows: chunk }),
        });
        const json = await res.json();
        if (!res.ok) throw new Error(json.error || 'Upload failed');
        totalInserted += json.inserted || 0;
        totalSkipped += json.skipped || 0;
        if (json.errors) allErrors.push(...json.errors);
      }

      const result = { inserted: totalInserted, skipped: totalSkipped, total: csvRows.length, errors: allErrors.length > 0 ? allErrors : undefined };
      setUploadResult(result);
      toast.success(`${totalInserted} records uploaded successfully!`);
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const clearCsv = () => {
    setCsvRows([]);
    setCsvFileName('');
    setUploadResult(null);
  };

  const displayedChatbotBookings = useMemo(() => {
    if (!searchTerm.trim()) return chatbotBookings;
    const q = searchTerm.trim().toLowerCase();
    return chatbotBookings.filter((b) =>
      [b.customer_name, b.phone_number, b.city, b.service_name, b.car_model, b.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(q),
    );
  }, [chatbotBookings, searchTerm]);

  const displayedServiceLeads = useMemo(
    () =>
      filterBookingLeads(serviceLeads, {
        source: sourceFilter,
        hasCoupon: couponFilter,
        search: searchTerm,
      }),
    [serviceLeads, sourceFilter, couponFilter, searchTerm],
  );

  const activeData = useMemo(
    () => (activeTab === 'service_leads' ? displayedServiceLeads : displayedChatbotBookings),
    [activeTab, displayedServiceLeads, displayedChatbotBookings],
  );

  const fetchData = useCallback(async () => {
    if (activeTab === 'upload_crm') return;
    setLoading(true);
    setError(null);

    try {
      const endpoint =
        activeTab === 'service_leads' ? '/api/super_admin/leads' : '/api/super_admin/chatbot-bookings';

      const query = new URLSearchParams();
      query.set('limit', '500');
      if (statusFilter !== 'ALL') query.set('status', statusFilter);

      const res = await fetch(`${endpoint}?${query.toString()}`);
      const text = await res.text();
      const payload = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to load bookings data');
      }

      if (activeTab === 'service_leads') {
        const rows = Array.isArray(payload?.leads) ? payload.leads : [];
        setServiceLeads(rows.map((lead: ServiceLead) => enrichBookingLead(lead)));
      } else {
        const rows = Array.isArray(payload?.bookings) ? payload.bookings : [];
        setChatbotBookings(rows);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [activeTab, statusFilter]);

  useEffect(() => {
    setSelectedIds(new Set());
    const timer = setTimeout(() => {
      fetchData();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchData]);

  const openDetail = (title: string, item: Record<string, any>) => {
    setDetailTitle(title);
    setDetailItem(item);
    setDetailOpen(true);
  };

  const openEdit = (lead: ServiceLead, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditLead(lead);
    setEditForm({
      customer_name: lead.customer_name || '',
      customer_phone: lead.customer_phone || '',
      vehicle_number: lead.vehicle_number || '',
      city: lead.city || '',
      status: lead.status || 'NEW',
      lead_source: lead.lead_source || 'Website',
      estimated_amount: lead.estimated_amount != null ? String(lead.estimated_amount) : '',
      coupon_code: lead.coupon_code || lead.coupon_display_code || '',
      discount_amount: lead.discount_amount != null ? String(lead.discount_amount) : '',
      service_type: lead.service_display || lead.service_type || '',
    });
    setEditOpen(true);
  };

  const saveEdit = async () => {
    if (!editLead?.id) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/super_admin/leads/${editLead.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...editForm,
          estimated_amount: editForm.estimated_amount === '' ? null : Number(editForm.estimated_amount),
          discount_amount: editForm.discount_amount === '' ? 0 : Number(editForm.discount_amount),
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      toast.success('Lead updated');
      setEditOpen(false);
      setEditLead(null);
      fetchData();
    } catch (err: any) {
      toast.error(err?.message || 'Update failed');
    } finally {
      setSaving(false);
    }
  };

  const deleteLead = async (lead: ServiceLead, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (!lead?.id) return;
    if (!window.confirm(`Delete lead ${lead.lead_number || lead.id}? This cannot be undone.`)) return;
    setDeletingId(String(lead.id));
    try {
      const res = await fetch(`/api/super_admin/leads/${lead.id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      toast.success('Lead deleted');
      setServiceLeads((prev) => prev.filter((row) => row.id !== lead.id));
      if (detailOpen && detailItem?.id === lead.id) setDetailOpen(false);
    } catch (err: any) {
      toast.error(err?.message || 'Delete failed');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === displayedServiceLeads.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayedServiceLeads.map((l) => String(l.id)).filter(Boolean)));
    }
  };

  const bulkDelete = async () => {
    if (selectedIds.size === 0) return;
    const count = selectedIds.size;
    if (!window.confirm(`Delete ${count} selected lead${count > 1 ? 's' : ''}? This cannot be undone.`)) return;
    setBulkDeleting(true);
    let deleted = 0;
    let failed = 0;
    const ids = Array.from(selectedIds);

    const BATCH = 5;
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH);
      const results = await Promise.allSettled(
        batch.map((id) => fetch(`/api/super_admin/leads/${id}`, { method: 'DELETE' }).then((r) => {
          if (!r.ok) throw new Error('fail');
          return id;
        })),
      );
      for (const r of results) {
        if (r.status === 'fulfilled') deleted++; else failed++;
      }
    }

    setServiceLeads((prev) => prev.filter((l) => !selectedIds.has(String(l.id))));
    setSelectedIds(new Set());
    setBulkDeleting(false);

    if (failed > 0) {
      toast.error(`${deleted} deleted, ${failed} failed (may be linked to jobs/invoices)`);
    } else {
      toast.success(`${deleted} lead${deleted > 1 ? 's' : ''} deleted`);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <ClipboardList className="w-6 h-6 text-brand-primary" />
                Bookings & Leads
              </h1>
              <p className="text-sm text-gray-600 mt-1">Website, App & AI bookings — filter by source and coupon.</p>
            </div>

            <div className="w-full lg:w-[420px] relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="bookings-search"
                name="bookings-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, phone, vehicle, city, coupon..."
                className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('service_leads')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                activeTab === 'service_leads'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <UserRound className="w-4 h-4" />
              Service Leads
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('chatbot_bookings')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                activeTab === 'chatbot_bookings'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Bot className="w-4 h-4" />
              AI Bookings
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('upload_crm')}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-semibold transition ${
                activeTab === 'upload_crm'
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
              }`}
            >
              <Upload className="w-4 h-4" />
              Upload CRM Data
            </button>
          </div>

          {activeTab === 'service_leads' ? (
            <div className="mt-4 rounded-xl border-2 border-emerald-200 bg-gradient-to-r from-emerald-50 via-white to-orange-50 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-gray-700 mb-3">
                Filter bookings — App vs Website & Coupon
              </p>
              <div className="flex flex-col lg:flex-row lg:items-center gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600">Source:</span>
                  {SOURCE_OPTIONS.map((source) => (
                    <button
                      key={source}
                      type="button"
                      onClick={() => setSourceFilter(source)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition ${
                        sourceFilter === source
                          ? source === 'APP'
                            ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                            : source === 'WEBSITE'
                              ? 'bg-blue-600 text-white border-blue-600 shadow-sm'
                              : 'bg-gray-800 text-white border-gray-800 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {source === 'APP' ? <Smartphone className="w-3.5 h-3.5" /> : null}
                      {source === 'WEBSITE' ? <Globe className="w-3.5 h-3.5" /> : null}
                      {source === 'ALL' ? 'All Sources' : source === 'APP' ? 'App Booking' : source === 'WEBSITE' ? 'Website' : 'Other'}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold text-gray-600">Coupon:</span>
                  {COUPON_OPTIONS.map((coupon) => (
                    <button
                      key={coupon}
                      type="button"
                      onClick={() => setCouponFilter(coupon)}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-bold border transition ${
                        couponFilter === coupon
                          ? 'bg-orange-600 text-white border-orange-600 shadow-sm'
                          : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      {coupon === 'YES' ? <Ticket className="w-3.5 h-3.5" /> : null}
                      {coupon === 'ALL' ? 'All' : coupon === 'YES' ? 'With Coupon' : 'No Coupon'}
                    </button>
                  ))}
                </div>
              </div>
              {serviceLeads.length > 0 ? (
                <p className="mt-3 text-xs text-gray-600">
                  Showing <strong className="text-emerald-700">{displayedServiceLeads.length}</strong> of{' '}
                  <strong>{serviceLeads.length}</strong> leads
                  {sourceFilter !== 'ALL' || couponFilter !== 'ALL' || searchTerm.trim() ? ' · filtered' : ''}
                </p>
              ) : null}
            </div>
          ) : null}

          {activeTab !== 'upload_crm' && (
            <>
            <div className="mt-4 flex flex-wrap gap-2">
              {STATUS_OPTIONS.map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setStatusFilter(status)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
                    statusFilter === status
                      ? 'bg-brand-primary text-white border-brand-primary'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>

            </>
          )}
        </div>
      </div>

      {/* Bulk action bar */}
      {activeTab === 'service_leads' && selectedIds.size > 0 ? (
        <div className="sticky top-[200px] z-10 mx-4 sm:mx-6 lg:mx-8 mt-2 rounded-2xl bg-gradient-to-r from-rose-600 to-red-600 text-white px-5 py-3 shadow-lg flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <CheckSquare className="w-5 h-5" />
            <span className="text-sm font-bold">{selectedIds.size} lead{selectedIds.size > 1 ? 's' : ''} selected</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSelectedIds(new Set())}
              className="px-3 py-1.5 rounded-lg border border-white/30 text-xs font-semibold hover:bg-white/10 transition"
            >
              Clear Selection
            </button>
            <button
              type="button"
              disabled={bulkDeleting}
              onClick={bulkDelete}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-lg bg-white text-rose-700 text-xs font-bold hover:bg-rose-50 transition disabled:opacity-60"
            >
              {bulkDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
              {bulkDeleting ? 'Deleting...' : `Delete ${selectedIds.size} Lead${selectedIds.size > 1 ? 's' : ''}`}
            </button>
          </div>
        </div>
      ) : null}

      <div className="px-4 sm:px-6 lg:px-8 py-5">
        {activeTab === 'upload_crm' ? (
          <div className="space-y-5">
            {/* Upload Area */}
            <div className="bg-white border border-gray-200 rounded-2xl p-6 sm:p-8">
              <input ref={fileInputRef} type="file" accept=".csv,.tsv,.txt" onChange={handleFileChange} className="hidden" />

              {csvRows.length === 0 ? (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full border-2 border-dashed border-gray-300 rounded-xl p-10 flex flex-col items-center gap-3 hover:border-brand-primary hover:bg-blue-50/30 transition cursor-pointer"
                >
                  <FileSpreadsheet className="w-10 h-10 text-gray-400" />
                  <div className="text-center">
                    <p className="text-sm font-semibold text-gray-700">Click to upload CSV file</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Columns: phone_no, name, address, regdate, car_number, make, model
                    </p>
                  </div>
                </button>
              ) : (
                <>
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                    <div className="flex items-center gap-2">
                      <FileSpreadsheet className="w-5 h-5 text-brand-primary" />
                      <span className="text-sm font-semibold text-gray-800">{csvFileName}</span>
                      <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{csvRows.length} rows</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button type="button" onClick={clearCsv} className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                        Clear
                      </button>
                      <button type="button" onClick={() => fileInputRef.current?.click()} className="px-3 py-1.5 text-xs font-semibold text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50 transition">
                        Change File
                      </button>
                      <button
                        type="button"
                        onClick={handleUpload}
                        disabled={uploading}
                        className="inline-flex items-center gap-2 px-4 py-1.5 text-sm font-semibold text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
                        {uploading ? 'Uploading...' : 'Upload to Database'}
                      </button>
                    </div>
                  </div>

                  {uploadResult && (
                    <div className={`flex items-start gap-3 p-4 rounded-xl mb-4 ${uploadResult.errors ? 'bg-yellow-50 border border-yellow-200' : 'bg-green-50 border border-green-200'}`}>
                      {uploadResult.errors ? (
                        <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5 shrink-0" />
                      ) : (
                        <CheckCircle2 className="w-5 h-5 text-green-600 mt-0.5 shrink-0" />
                      )}
                      <div className="text-sm">
                        <p className="font-semibold text-gray-800">
                          {uploadResult.inserted} / {uploadResult.total} records inserted
                          {uploadResult.skipped > 0 && <span className="text-yellow-700"> ({uploadResult.skipped} skipped — missing phone_no)</span>}
                        </p>
                        {uploadResult.errors?.map((err, i) => (
                          <p key={i} className="text-red-600 text-xs mt-1">{err}</p>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Preview Table */}
                  <div className="overflow-x-auto border border-gray-200 rounded-xl">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50 border-b border-gray-200">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">#</th>
                          {CSV_COLUMNS.map((col) => (
                            <th key={col} className="px-3 py-2 text-left text-xs font-semibold text-gray-500 uppercase">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {csvRows.slice(0, 100).map((row, idx) => (
                          <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                            <td className="px-3 py-2 text-gray-400 text-xs">{idx + 1}</td>
                            {CSV_COLUMNS.map((col) => (
                              <td key={col} className="px-3 py-2 text-gray-700 whitespace-nowrap max-w-[200px] truncate">
                                {row[col] || <span className="text-gray-300">-</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {csvRows.length > 100 && (
                      <div className="text-center py-2 text-xs text-gray-500 bg-gray-50 border-t border-gray-200">
                        Showing first 100 of {csvRows.length} rows
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 flex flex-col items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-brand-primary" />
            <p className="text-sm text-gray-600 mt-3">Loading records...</p>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-4 text-sm">{error}</div>
        ) : activeData.length === 0 ? (
          <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
            <p className="text-gray-700 font-semibold">No records found</p>
            <p className="text-sm text-gray-500 mt-1">Try changing search or status filters.</p>
          </div>
        ) : (
          <>
            <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
              {activeTab === 'service_leads' ? (
                <table className="w-full min-w-[1280px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <th className="px-3 py-3 w-10">
                        <button type="button" onClick={toggleSelectAll} className="p-0.5 rounded hover:bg-gray-200 transition">
                          {selectedIds.size === 0 ? (
                            <Square className="w-4.5 h-4.5 text-gray-400" />
                          ) : selectedIds.size === displayedServiceLeads.length ? (
                            <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                          ) : (
                            <MinusSquare className="w-4.5 h-4.5 text-blue-600" />
                          )}
                        </button>
                      </th>
                      <th className="px-4 py-3 whitespace-nowrap">Lead #</th>
                      <th className="px-4 py-3 whitespace-nowrap">Source</th>
                      <th className="px-4 py-3 whitespace-nowrap">Customer</th>
                      <th className="px-4 py-3 whitespace-nowrap">Phone</th>
                      <th className="px-4 py-3 whitespace-nowrap">Vehicle</th>
                      <th className="px-4 py-3 whitespace-nowrap">City</th>
                      <th className="px-4 py-3 min-w-[180px]">Service</th>
                      <th className="px-4 py-3 whitespace-nowrap">Coupon</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">Amount</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedServiceLeads.map((lead) => {
                      const serviceLabel = getServiceLabel(lead);
                      const leadId = String(lead.id || '');
                      const isSelected = leadId ? selectedIds.has(leadId) : false;
                      return (
                      <tr
                        key={String(lead.id || `${lead.lead_number}-${lead.created_at}`)}
                        onClick={() => openDetail('Service Lead Details', lead)}
                        className={`border-b border-gray-100 cursor-pointer transition ${isSelected ? 'bg-blue-50 hover:bg-blue-100/60' : 'hover:bg-blue-50/50'}`}
                      >
                        <td className="px-3 py-3 w-10">
                          {leadId ? (
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); toggleSelect(leadId); }}
                              className="p-0.5 rounded hover:bg-gray-200 transition"
                            >
                              {isSelected ? (
                                <CheckSquare className="w-4.5 h-4.5 text-blue-600" />
                              ) : (
                                <Square className="w-4.5 h-4.5 text-gray-400" />
                              )}
                            </button>
                          ) : null}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900 whitespace-nowrap">{lead.lead_number || '-'}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <SourceBadge label={lead.booking_source_label || 'Website'} source={lead.booking_source || 'WEBSITE'} />
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-800 max-w-[140px]">
                          <span className="block truncate" title={lead.customer_name || ''}>{lead.customer_name || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{lead.customer_phone || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{lead.vehicle_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{lead.city || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-[220px]">
                          <span className="block truncate" title={serviceLabel}>{serviceLabel}</span>
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <CouponBadge code={lead.coupon_display_code} discount={lead.coupon_display_discount} />
                        </td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold whitespace-nowrap">
                            {lead.status || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatCurrency(getLeadDisplayAmount(lead))}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDateTime(lead.created_at)}</td>
                        <td className="px-4 py-3 text-sm text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              title="Edit lead"
                              onClick={(e) => openEdit(lead, e)}
                              className="p-1.5 rounded-lg border border-gray-200 hover:bg-blue-50 text-blue-600"
                            >
                              <Pencil className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              title="Delete lead"
                              disabled={deletingId === String(lead.id)}
                              onClick={(e) => deleteLead(lead, e)}
                              className="p-1.5 rounded-lg border border-rose-200 hover:bg-rose-50 text-rose-600 disabled:opacity-50"
                            >
                              {deletingId === String(lead.id) ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <Trash2 className="w-4 h-4" />
                              )}
                            </button>
                          </div>
                        </td>
                      </tr>
                    );})}
                  </tbody>
                </table>
              ) : (
                <table className="w-full min-w-[960px]">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <th className="px-4 py-3 whitespace-nowrap">Customer</th>
                      <th className="px-4 py-3 whitespace-nowrap">Phone</th>
                      <th className="px-4 py-3 whitespace-nowrap">Car Model</th>
                      <th className="px-4 py-3 whitespace-nowrap">City</th>
                      <th className="px-4 py-3 min-w-[160px]">Service</th>
                      <th className="px-4 py-3 whitespace-nowrap">Price</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedChatbotBookings.map((booking) => (
                      <tr
                        key={String(booking.id || `${booking.session_id}-${booking.created_at}`)}
                        onClick={() => openDetail('AI Booking Details', booking)}
                        className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition"
                      >
                        <td className="px-4 py-3 text-sm text-gray-800 max-w-[140px]">
                          <span className="block truncate" title={booking.customer_name || ''}>{booking.customer_name || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{booking.phone_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{booking.car_model || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{booking.city || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700 max-w-[200px]">
                          <span className="block truncate" title={booking.service_name || ''}>{booking.service_name || '-'}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatCurrency(booking.quoted_price)}</td>
                        <td className="px-4 py-3 text-sm whitespace-nowrap">
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold whitespace-nowrap">
                            {booking.status || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 whitespace-nowrap">{formatDateTime(booking.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:hidden">
              {activeData.map((item) => {
                const itemId = String(item.id || '');
                const isItemSelected = activeTab === 'service_leads' && itemId ? selectedIds.has(itemId) : false;
                return (
                <div
                  key={String(item.id || `${item.session_id || item.lead_number}-${item.created_at}`)}
                  className={`bg-white border rounded-xl p-4 shadow-sm ${isItemSelected ? 'border-blue-400 bg-blue-50/30' : 'border-gray-200'}`}
                >
                  {activeTab === 'service_leads' && itemId ? (
                    <div className="flex items-center gap-2 mb-3">
                      <button
                        type="button"
                        onClick={() => toggleSelect(itemId)}
                        className="p-0.5 rounded"
                      >
                        {isItemSelected ? (
                          <CheckSquare className="w-5 h-5 text-blue-600" />
                        ) : (
                          <Square className="w-5 h-5 text-gray-400" />
                        )}
                      </button>
                      <span className="text-xs text-gray-500">Select</span>
                    </div>
                  ) : null}
                  <button
                    type="button"
                    onClick={() =>
                      openDetail(activeTab === 'service_leads' ? 'Service Lead Details' : 'AI Booking Details', item)
                    }
                    className="text-left w-full"
                  >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-sm font-bold text-gray-900">
                        {activeTab === 'service_leads'
                          ? item.customer_name || item.lead_number || '-'
                          : item.customer_name || '-'}
                      </p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {activeTab === 'service_leads' ? item.customer_phone || '-' : item.phone_number || '-'}
                      </p>
                      {activeTab === 'service_leads' ? (
                        <div className="mt-2 flex flex-wrap gap-2">
                          <SourceBadge label={item.booking_source_label || 'Website'} source={item.booking_source || 'WEBSITE'} />
                          {item.has_coupon_applied ? (
                            <CouponBadge code={item.coupon_display_code} discount={item.coupon_display_discount} />
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                    <span className="inline-flex px-2 py-1 rounded-full bg-blue-100 text-blue-700 text-[11px] font-semibold">
                      {item.status || '-'}
                    </span>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>
                      <p className="text-gray-500">City</p>
                      <p className="font-medium text-gray-800">{item.city || '-'}</p>
                    </div>
                    <div>
                      <p className="text-gray-500">{activeTab === 'service_leads' ? 'Vehicle' : 'Car Model'}</p>
                      <p className="font-medium text-gray-800">
                        {activeTab === 'service_leads' ? item.vehicle_number || '-' : item.car_model || '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">{activeTab === 'service_leads' ? 'Amount' : 'Price'}</p>
                      <p className="font-medium text-gray-800">
                        {activeTab === 'service_leads'
                          ? formatCurrency(getLeadDisplayAmount(item))
                          : formatCurrency(item.quoted_price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p className="font-medium text-gray-800">{formatDateTime(item.created_at)}</p>
                    </div>
                  </div>
                  </button>
                  {activeTab === 'service_leads' && item.id ? (
                    <div className="mt-3 pt-3 border-t border-gray-100 flex gap-2">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg border border-blue-200 text-blue-700 text-xs font-semibold"
                      >
                        <Pencil className="w-3.5 h-3.5" /> Edit
                      </button>
                      <button
                        type="button"
                        disabled={deletingId === String(item.id)}
                        onClick={() => deleteLead(item)}
                        className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded-lg border border-rose-200 text-rose-700 text-xs font-semibold disabled:opacity-50"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </button>
                    </div>
                  ) : null}
                </div>
              );})}
            </div>
          </>
        )}
      </div>

      {editOpen && editLead ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-xl max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900">Edit Lead {editLead.lead_number || ''}</h3>
              <button type="button" onClick={() => setEditOpen(false)} className="p-2 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 overflow-y-auto max-h-[calc(90vh-140px)] space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500">Customer Name</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.customer_name} onChange={(e) => setEditForm((f) => ({ ...f, customer_name: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Phone</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.customer_phone} onChange={(e) => setEditForm((f) => ({ ...f, customer_phone: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Vehicle</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.vehicle_number} onChange={(e) => setEditForm((f) => ({ ...f, vehicle_number: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">City</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.city} onChange={(e) => setEditForm((f) => ({ ...f, city: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Status</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.status} onChange={(e) => setEditForm((f) => ({ ...f, status: e.target.value }))}>
                    {STATUS_OPTIONS.filter((s) => s !== 'ALL').map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Lead Source</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.lead_source} onChange={(e) => setEditForm((f) => ({ ...f, lead_source: e.target.value }))}>
                    {LEAD_SOURCES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-gray-500">Service</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.service_type} onChange={(e) => setEditForm((f) => ({ ...f, service_type: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Amount (Rs)</label>
                  <input type="number" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.estimated_amount} onChange={(e) => setEditForm((f) => ({ ...f, estimated_amount: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Coupon Code</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.coupon_code} onChange={(e) => setEditForm((f) => ({ ...f, coupon_code: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-gray-500">Discount (Rs)</label>
                  <input type="number" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={editForm.discount_amount} onChange={(e) => setEditForm((f) => ({ ...f, discount_amount: e.target.value }))} />
                </div>
              </div>
            </div>
            <div className="px-5 py-4 border-t border-gray-200 flex justify-end gap-2">
              <button type="button" className="px-4 py-2 rounded-lg border text-sm" onClick={() => setEditOpen(false)}>Cancel</button>
              <button
                type="button"
                disabled={saving}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold disabled:opacity-50"
                onClick={saveEdit}
              >
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {detailOpen && detailItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Car className="w-5 h-5 text-brand-primary" />
                {detailTitle}
              </h3>
              <div className="flex items-center gap-2">
                {detailItem.id && detailTitle.includes('Service Lead') ? (
                  <>
                    <button type="button" onClick={() => { setDetailOpen(false); openEdit(detailItem); }} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-blue-200 text-blue-700">
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteLead(detailItem)} className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-rose-200 text-rose-700">
                      Delete
                    </button>
                  </>
                ) : null}
                <button
                  type="button"
                  onClick={() => setDetailOpen(false)}
                  className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(85vh-72px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(detailItem).map(([key, value]) => {
                  const displayValue =
                    (key === 'estimated_amount' || key === 'actual_amount') &&
                    detailTitle.includes('Service Lead')
                      ? getLeadDisplayAmount(detailItem)
                      : value;
                  return (
                  <div key={key} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{prettifyKey(key)}</p>
                    <p className="text-sm text-gray-900 mt-1 break-words">
                      {displayValue === null || displayValue === undefined || displayValue === ''
                        ? '-'
                        : typeof displayValue === 'object'
                          ? JSON.stringify(displayValue, null, 2)
                          : String(displayValue)}
                    </p>
                  </div>
                );})}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

