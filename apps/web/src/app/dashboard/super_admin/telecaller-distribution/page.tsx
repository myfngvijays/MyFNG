'use client';

import { useEffect, useMemo, useState } from 'react';
import { Save, Plus, AlertTriangle, Link2, Copy } from 'lucide-react';

type Telecaller = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
};

type AllocationRow = {
  telecaller_id: string;
  allocation_percent: number;
  allocation_status: 'ACTIVE' | 'INACTIVE';
  daily_limit: number | null;
};

export default function TelecallerDistributionPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [rows, setRows] = useState<AllocationRow[]>([]);
  const [apiOpen, setApiOpen] = useState(false);
  const [copiedSlug, setCopiedSlug] = useState<string | null>(null);
  const [selectedOptionalFields, setSelectedOptionalFields] = useState<string[]>([]);
  const [selectedSourceSlug, setSelectedSourceSlug] = useState('google-ads');

  const leadSourceApis = [
    { label: 'Google Ads', slug: 'google-ads' },
    { label: 'Instagram Ads', slug: 'instagram-ads' },
    { label: 'WhatsApp', slug: 'whatsapp' },
    { label: 'Website', slug: 'website' },
    { label: 'App Booking', slug: 'app-booking' },
    { label: 'Banner/Offline', slug: 'banner-offline' },
    { label: 'Reference', slug: 'reference' },
    { label: 'Partner', slug: 'partner' },
    { label: 'Other', slug: 'other' },
  ];
  const optionalFields = [
    'lead_priority',
    'lead_source_other_note',
    'customer_name',
    'customer_alt_phone',
    'customer_email',
    'customer_address',
    'customer_city',
    'customer_pincode',
    'customer_lat',
    'customer_lng',
    'vehicle_number',
    'vehicle_make',
    'vehicle_model',
    'vehicle_variant',
    'vehicle_fuel_type',
    'problem_description',
    'pickup_required',
    'preferred_slot_start',
    'preferred_slot_end',
  ];

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const res = await fetch('/api/admin/telecaller-distribution');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load settings');

      const list = (json.telecallers || []).map((t: any) => ({
        id: String(t.id),
        full_name: t.full_name ? String(t.full_name) : null,
        email: t.email ? String(t.email) : null,
        phone: t.phone ? String(t.phone) : null,
        is_active: Boolean(t.is_active),
      }));
      const allocs = (json.allocations || []).map((r: any) => ({
        telecaller_id: String(r.telecaller_id),
        allocation_percent: Number(r.allocation_percent || 0),
        allocation_status: (String(r.allocation_status || 'ACTIVE').toUpperCase() === 'INACTIVE') ? 'INACTIVE' : 'ACTIVE',
        daily_limit: r.daily_limit == null ? null : Number(r.daily_limit),
      }));

      setTelecallers(list);
      setRows(allocs.length > 0 ? allocs : list.map((t: any) => ({
        telecaller_id: t.id,
        allocation_percent: 0,
        allocation_status: 'INACTIVE',
        daily_limit: null,
      })));
    } catch (e) {
      console.error('Failed to load telecaller distribution settings:', e);
    } finally {
      setLoading(false);
    }
  }

  const activeTotal = useMemo(() => {
    return rows
      .filter((r) => r.allocation_status === 'ACTIVE')
      .reduce((sum, r) => sum + Number(r.allocation_percent || 0), 0);
  }, [rows]);

  function updateRow(index: number, patch: Partial<AllocationRow>) {
    setRows((prev) => prev.map((r, i) => (i === index ? { ...r, ...patch } : r)));
  }

  function addRow() {
    setRows((prev) => [
      ...prev,
      { telecaller_id: '', allocation_percent: 0, allocation_status: 'INACTIVE', daily_limit: null },
    ]);
  }

  function getLeadApiUrl(slug: string) {
    if (typeof window === 'undefined') return `/api/enquiry-leads/by-source/${slug}`;
    return `${window.location.origin}/api/enquiry-leads/by-source/${slug}`;
  }

  async function copyLeadApi(slug: string) {
    const url = getLeadApiUrl(slug);
    try {
      await navigator.clipboard.writeText(url);
      setCopiedSlug(slug);
      setTimeout(() => setCopiedSlug(null), 1500);
    } catch (e) {
      console.error('Failed to copy API URL:', e);
    }
  }

  function toggleOptionalField(field: string) {
    setSelectedOptionalFields((prev) =>
      prev.includes(field) ? prev.filter((f) => f !== field) : [...prev, field]
    );
  }

  function buildSamplePayload() {
    const base: Record<string, any> = {
      lead_type: 'NORMAL',
      customer_phone: '9999999999',
    };
    const optional: Record<string, any> = {
      lead_priority: 'NORMAL',
      lead_source_other_note: 'Sample note',
      customer_name: 'Rahul Sharma',
      customer_alt_phone: '8888888888',
      customer_email: 'rahul@example.com',
      customer_address: 'Andheri West',
      customer_city: 'Mumbai',
      customer_pincode: '400053',
      customer_lat: 19.1364,
      customer_lng: 72.8296,
      vehicle_number: 'MH01AB1234',
      vehicle_make: 'Maruti',
      vehicle_model: 'Swift',
      vehicle_variant: 'VXI',
      vehicle_fuel_type: 'Petrol',
      problem_description: 'Engine noise',
      pickup_required: true,
      preferred_slot_start: '2026-01-21T10:00:00.000Z',
      preferred_slot_end: '2026-01-21T12:00:00.000Z',
    };
    for (const key of selectedOptionalFields) {
      base[key] = optional[key];
    }
    return base;
  }

  async function handleSave() {
    setSaving(true);
    try {
      const res = await fetch('/api/admin/telecaller-distribution', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allocations: rows }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to save settings');
      await fetchData();
      alert('Telecaller distribution settings saved.');
    } catch (e: any) {
      alert(e?.message || 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  }

  async function handleBackfill() {
    const confirmed = window.confirm('Backfill unassigned leads now? This will auto-assign existing leads.');
    if (!confirmed) return;

    setBackfilling(true);
    try {
      const res = await fetch('/api/admin/telecaller-distribution/backfill', { method: 'POST' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to backfill leads');
      alert(`Backfill complete. Assigned: ${json.assignedCount}, Skipped: ${json.skippedCount}`);
    } catch (e: any) {
      alert(e?.message || 'Failed to backfill leads');
    } finally {
      setBackfilling(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-6 md:py-8 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-text-heading">Telecaller Distribution Settings</h1>
          <p className="text-xs sm:text-sm text-gray-600 mt-1">
            Configure % allocation and daily limits for auto-assignment.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={handleBackfill}
            disabled={backfilling}
            className="btn btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
          >
            {backfilling ? 'Backfilling...' : 'Backfill Leads'}
          </button>
          <button
            onClick={() => setApiOpen((prev) => !prev)}
            className="btn btn-secondary flex items-center gap-2 px-3 py-2 text-sm"
          >
            <Link2 className="w-4 h-4" />
            API Manage/Create
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="btn btn-primary flex items-center gap-2 px-3 py-2 text-sm"
          >
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Settings'}
          </button>
        </div>
      </div>

      {apiOpen && (
        <div className="bg-white rounded-lg border p-4 space-y-4">
          <div>
            <div className="text-sm font-semibold">Lead Source API URLs</div>
            <div className="text-xs text-gray-600 mt-1">
              Use these POST endpoints to create leads with fixed lead_source.
            </div>
          </div>

          <div className="text-xs text-gray-600">
            Base URL: <span className="font-medium text-gray-900">{typeof window === 'undefined' ? 'https://your-domain.com' : window.location.origin}</span>
          </div>

          <div className="rounded-md border bg-gray-50 p-3 flex flex-col gap-3">
            <div className="grid gap-2 sm:grid-cols-[200px_1fr] sm:items-center">
              <div className="text-sm font-semibold">Lead Source</div>
              <select
                className="border rounded-md px-2 py-1.5 text-sm"
                value={selectedSourceSlug}
                onChange={(e) => setSelectedSourceSlug(e.target.value)}
              >
                {leadSourceApis.map((item) => (
                  <option key={item.slug} value={item.slug}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
              <code className="text-xs sm:text-sm text-gray-700 break-all bg-white border rounded px-2 py-1">
                {getLeadApiUrl(selectedSourceSlug)}
              </code>
              <div className="flex items-center gap-2">
                <a
                  className="btn btn-secondary text-xs flex items-center gap-1"
                  href={getLeadApiUrl(selectedSourceSlug)}
                  target="_blank"
                  rel="noreferrer"
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Open
                </a>
                <button
                  onClick={() => copyLeadApi(selectedSourceSlug)}
                  className="btn btn-secondary text-xs flex items-center gap-1"
                >
                  <Copy className="w-3.5 h-3.5" />
                  {copiedSlug === selectedSourceSlug ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          </div>

          <div className="text-xs text-gray-600">
            Required fields: lead_type, customer_phone. For source "Other", pass lead_source_other_note.
          </div>
          <div className="text-xs text-gray-600">
            Optional fields:
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            {optionalFields.map((field) => {
              const active = selectedOptionalFields.includes(field);
              return (
                <button
                  key={field}
                  type="button"
                  onClick={() => toggleOptionalField(field)}
                  className={`px-2 py-1 rounded-full border ${active ? 'bg-brand-primary text-white border-brand-primary' : 'bg-gray-100 text-gray-700'}`}
                >
                  {field}
                </button>
              );
            })}
          </div>

          <pre className="text-xs bg-gray-50 border rounded-md p-3 overflow-x-auto">
{`curl -X POST "${getLeadApiUrl(selectedSourceSlug)}" \\
  -H "Content-Type: application/json" \\
  -d '${JSON.stringify(buildSamplePayload(), null, 2)}'`}
          </pre>
        </div>
      )}

      <div className="bg-white rounded-lg border shadow-sm">
        <div className="px-4 py-3 border-b flex items-center justify-between">
          <div className="font-semibold text-sm sm:text-base">Telecaller Allocation Panel</div>
          <button
            onClick={addRow}
            className="btn btn-secondary flex items-center gap-1 text-xs sm:text-sm"
          >
            <Plus className="w-4 h-4" />
            Add Row
          </button>
        </div>

        <div className="px-4 py-3 border-b flex flex-col sm:flex-row gap-2 sm:items-center sm:justify-between text-xs sm:text-sm">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-orange-500" />
            % total must = 100 (Active rows only).
          </div>
          <div className={`font-semibold ${Math.abs(activeTotal - 100) < 0.001 ? 'text-green-600' : 'text-red-600'}`}>
            Active Total: {activeTotal.toFixed(2)}%
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr className="text-left">
                <th className="px-4 py-3">Telecaller Name</th>
                <th className="px-4 py-3">% Allocation</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Daily Limit</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <tr key={`${row.telecaller_id}-${index}`} className="border-t">
                  <td className="px-4 py-3">
                    <select
                      className="border rounded-md px-2 py-1.5 text-sm w-full"
                      value={row.telecaller_id}
                      onChange={(e) => updateRow(index, { telecaller_id: e.target.value })}
                    >
                      <option value="">Select telecaller</option>
                      {telecallers.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.full_name || t.email || t.phone || t.id}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      className="border rounded-md px-2 py-1.5 text-sm w-28"
                      value={row.allocation_percent}
                      min={0}
                      max={100}
                      step="0.01"
                      onChange={(e) => updateRow(index, { allocation_percent: Number(e.target.value) })}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <select
                      className="border rounded-md px-2 py-1.5 text-sm w-32"
                      value={row.allocation_status}
                      onChange={(e) =>
                        updateRow(index, {
                          allocation_status: e.target.value === 'INACTIVE' ? 'INACTIVE' : 'ACTIVE',
                        })
                      }
                    >
                      <option value="ACTIVE">Active</option>
                      <option value="INACTIVE">Inactive</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <input
                      type="number"
                      className="border rounded-md px-2 py-1.5 text-sm w-32"
                      placeholder="Unlimited"
                      value={row.daily_limit ?? ''}
                      min={0}
                      onChange={(e) =>
                        updateRow(index, { daily_limit: e.target.value ? Number(e.target.value) : null })
                      }
                    />
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-gray-500">
                    No allocation rows. Add a row to begin.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

