'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Car, ClipboardList, Loader2, Search, UserRound, Upload, X, CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import toast from 'react-hot-toast';

type ServiceLead = Record<string, any>;
type ChatbotBooking = Record<string, any>;
type CsvRow = Record<string, string>;
type ActiveTab = 'service_leads' | 'chatbot_bookings' | 'upload_crm';

const STATUS_OPTIONS = ['ALL', 'NEW', 'PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED'] as const;

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

function prettifyKey(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, (m) => m.toUpperCase());
}

export default function SuperAdminBookingsPage() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('service_leads');
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<(typeof STATUS_OPTIONS)[number]>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [serviceLeads, setServiceLeads] = useState<ServiceLead[]>([]);
  const [chatbotBookings, setChatbotBookings] = useState<ChatbotBooking[]>([]);

  const [detailOpen, setDetailOpen] = useState(false);
  const [detailItem, setDetailItem] = useState<Record<string, any> | null>(null);
  const [detailTitle, setDetailTitle] = useState('');

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

  const activeData = useMemo(
    () => (activeTab === 'service_leads' ? serviceLeads : chatbotBookings),
    [activeTab, serviceLeads, chatbotBookings]
  );

  const fetchData = useCallback(async () => {
    if (activeTab === 'upload_crm') return;
    setLoading(true);
    setError(null);

    try {
      const endpoint =
        activeTab === 'service_leads' ? '/api/super_admin/leads' : '/api/super_admin/chatbot-bookings';

      const query = new URLSearchParams();
      if (searchTerm.trim()) query.set('search', searchTerm.trim());
      if (statusFilter !== 'ALL') query.set('status', statusFilter);

      const res = await fetch(`${endpoint}?${query.toString()}`);
      const text = await res.text();
      const payload = text ? JSON.parse(text) : {};

      if (!res.ok) {
        throw new Error(payload?.error || 'Failed to load bookings data');
      }

      if (activeTab === 'service_leads') {
        setServiceLeads(Array.isArray(payload?.leads) ? payload.leads : []);
      } else {
        setChatbotBookings(Array.isArray(payload?.bookings) ? payload.bookings : []);
      }
    } catch (err: any) {
      setError(err?.message || 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }, [activeTab, searchTerm, statusFilter]);

  useEffect(() => {
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
              <p className="text-sm text-gray-600 mt-1">View bookings submitted from website form and AI bot.</p>
            </div>

            <div className="w-full lg:w-[420px] relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                id="bookings-search"
                name="bookings-search"
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, phone, vehicle, city..."
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

          {activeTab !== 'upload_crm' && (
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
          )}
        </div>
      </div>

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
            <div className="hidden lg:block bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-sm">
              {activeTab === 'service_leads' ? (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <th className="px-4 py-3">Lead #</th>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Vehicle</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Amount</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {serviceLeads.map((lead) => (
                      <tr
                        key={String(lead.id || `${lead.lead_number}-${lead.created_at}`)}
                        onClick={() => openDetail('Service Lead Details', lead)}
                        className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition"
                      >
                        <td className="px-4 py-3 text-sm font-semibold text-gray-900">{lead.lead_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-800">{lead.customer_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{lead.customer_phone || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{lead.vehicle_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{lead.city || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{lead.service_display || (lead.service_type ? lead.service_type.replace(/_/g, ' ').split(' ').map((w: string) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(' ') : '-')}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-semibold">
                            {lead.status || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(lead.estimated_amount)}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{formatDateTime(lead.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr className="text-left text-xs font-semibold text-gray-600 uppercase tracking-wide">
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Phone</th>
                      <th className="px-4 py-3">Car Model</th>
                      <th className="px-4 py-3">City</th>
                      <th className="px-4 py-3">Service</th>
                      <th className="px-4 py-3">Price</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Date</th>
                    </tr>
                  </thead>
                  <tbody>
                    {chatbotBookings.map((booking) => (
                      <tr
                        key={String(booking.id || `${booking.session_id}-${booking.created_at}`)}
                        onClick={() => openDetail('AI Booking Details', booking)}
                        className="border-b border-gray-100 hover:bg-blue-50/50 cursor-pointer transition"
                      >
                        <td className="px-4 py-3 text-sm text-gray-800">{booking.customer_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{booking.phone_number || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{booking.car_model || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{booking.city || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{booking.service_name || '-'}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{formatCurrency(booking.quoted_price)}</td>
                        <td className="px-4 py-3 text-sm">
                          <span className="inline-flex px-2.5 py-1 rounded-full bg-purple-100 text-purple-700 text-xs font-semibold">
                            {booking.status || '-'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700">{formatDateTime(booking.created_at)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <div className="grid grid-cols-1 gap-3 lg:hidden">
              {activeData.map((item) => (
                <button
                  type="button"
                  key={String(item.id || `${item.session_id || item.lead_number}-${item.created_at}`)}
                  onClick={() =>
                    openDetail(activeTab === 'service_leads' ? 'Service Lead Details' : 'AI Booking Details', item)
                  }
                  className="text-left bg-white border border-gray-200 rounded-xl p-4 shadow-sm"
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
                          ? formatCurrency(item.estimated_amount)
                          : formatCurrency(item.quoted_price)}
                      </p>
                    </div>
                    <div>
                      <p className="text-gray-500">Date</p>
                      <p className="font-medium text-gray-800">{formatDateTime(item.created_at)}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </div>

      {detailOpen && detailItem && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-white rounded-2xl shadow-xl max-h-[85vh] overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
              <h3 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                <Car className="w-5 h-5 text-brand-primary" />
                {detailTitle}
              </h3>
              <button
                type="button"
                onClick={() => setDetailOpen(false)}
                className="p-2 rounded-lg hover:bg-gray-100 text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto max-h-[calc(85vh-72px)]">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {Object.entries(detailItem).map(([key, value]) => (
                  <div key={key} className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                    <p className="text-[11px] uppercase tracking-wide text-gray-500 font-semibold">{prettifyKey(key)}</p>
                    <p className="text-sm text-gray-900 mt-1 break-words">
                      {value === null || value === undefined || value === '' ? '-' : String(value)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

