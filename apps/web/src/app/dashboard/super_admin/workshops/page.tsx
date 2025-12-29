'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Store, Search, Plus, MapPin, Edit2, X, Building, Globe, Download, Upload } from 'lucide-react';

export default function WorkshopManagementPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]); // For Zone Dropdown
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  
  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  // CSV Import/Export (Bulk Add Workshops)
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string>('');
  const [csvInfo, setCsvInfo] = useState<string>('');
  const [csvSummary, setCsvSummary] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  } | null>(null);

  useEffect(() => {
    fetchWorkshops();
    fetchZones();
  }, [filterStatus]);

  const fetchZones = async () => {
    const { data } = await supabase.from('zones').select('id, name');
    setZones(data || []);
  };

  const fetchWorkshops = async () => {
    try {
      let query = supabase
        .from('workshops')
        .select('*, zones(name)') // Fetch zone name too
        .order('created_at', { ascending: false });

      if (filterStatus === 'active') {
        query = query.eq('is_verified', true);
      } else if (filterStatus === 'inactive') {
        query = query.eq('is_verified', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (workshop: any) => {
    setEditingWorkshop({ ...workshop }); // Create a copy
    setShowEditModal(true);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkshop) return;
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('workshops')
        .update({
          name: editingWorkshop.name,
          contact_person: editingWorkshop.contact_person,
          phone: editingWorkshop.phone,
          email: editingWorkshop.email,
          
          // Address
          address: editingWorkshop.address,
          city: editingWorkshop.city,
          state: editingWorkshop.state,
          pincode: editingWorkshop.pincode,
          map_link: editingWorkshop.map_link || null,
          
          // Zone & Tax
          zone_id: editingWorkshop.zone_id,
          gst_number: editingWorkshop.gst_number,
          
          // Bank Details
          bank_account_number: editingWorkshop.bank_account_number,
          ifsc_code: editingWorkshop.ifsc_code,
          upi_id: editingWorkshop.upi_id,
          commission_percentage:
            editingWorkshop.commission_percentage === '' || editingWorkshop.commission_percentage == null
              ? null
              : Number(editingWorkshop.commission_percentage),
        })
        .eq('id', editingWorkshop.id);

      if (error) throw error;
      
      alert('Workshop updated successfully!');
      setShowEditModal(false);
        fetchWorkshops();
    } catch (error: any) {
      alert('Error updating workshop: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (workshopId: string) => {
    if (!confirm('Approve this workshop?')) return;
    try {
      const { error } = await supabase.from('workshops').update({ is_verified: true }).eq('id', workshopId);
      if (!error) { alert('Approved!'); fetchWorkshops(); }
    } catch { alert('Failed'); }
  };

  const handleDisable = async (workshopId: string) => {
    if (!confirm('Disable this workshop?')) return;
    try {
      const { error } = await supabase.from('workshops').update({ is_verified: false }).eq('id', workshopId);
      if (!error) { alert('Disabled!'); fetchWorkshops(); }
    } catch { alert('Failed'); }
  };

  const handleEnable = async (workshopId: string) => {
    try {
      const { error } = await supabase.from('workshops').update({ is_verified: true }).eq('id', workshopId);
      if (!error) { alert('Enabled!'); fetchWorkshops(); }
    } catch { alert('Failed'); }
  };

  const escapeCsv = (value: any) => {
    const s = value === null || value === undefined ? '' : String(value);
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const buildCsv = (headers: string[], rows: any[][]) => {
    const headerLine = headers.map(escapeCsv).join(',');
    const body = rows.map((r) => r.map(escapeCsv).join(',')).join('\n');
    return `${headerLine}\n${body}\n`;
  };

  const downloadTextFile = (content: string, filename: string, mime = 'text/csv') => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Minimal CSV parser (supports quoted fields + escaped quotes)
  const parseCsv = (text: string): string[][] => {
    const rows: string[][] = [];
    let row: string[] = [];
    let field = '';
    let inQuotes = false;

    const pushField = () => {
      row.push(field);
      field = '';
    };
    const pushRow = () => {
      if (row.length === 1 && row[0].trim() === '') {
        row = [];
        return;
      }
      rows.push(row);
      row = [];
    };

    for (let i = 0; i < text.length; i++) {
      const c = text[i];
      const next = text[i + 1];

      if (inQuotes) {
        if (c === '"' && next === '"') {
          field += '"';
          i++;
        } else if (c === '"') {
          inQuotes = false;
        } else {
          field += c;
        }
        continue;
      }

      if (c === '"') inQuotes = true;
      else if (c === ',') pushField();
      else if (c === '\n') {
        pushField();
        pushRow();
      } else if (c === '\r') {
        // ignore
      } else field += c;
    }
    pushField();
    if (row.length) pushRow();
    return rows;
  };

  const runWithConcurrency = async <T,>(tasks: Array<() => Promise<T>>, concurrency = 6): Promise<T[]> => {
    const results: T[] = [];
    let idx = 0;
    const workers = Array.from({ length: Math.max(1, concurrency) }).map(async () => {
      while (idx < tasks.length) {
        const current = idx++;
        results[current] = await tasks[current]();
      }
    });
    await Promise.all(workers);
    return results;
  };

  const downloadWorkshopCsvTemplate = () => {
    setCsvError('');
    setCsvInfo('');
    setCsvSummary(null);

    const headers = [
      // If id is provided -> update; else -> create
      'id',
      // Required (for create)
      'name',
      'contact_person',
      'phone',
      'email',
      'address',
      'city',
      'state',
      'pincode',
      // Optional
      'zone_id',
      'zone_name',
      'gst_number',
      'map_link',
      'latitude',
      'longitude',
      'bank_account_number',
      'ifsc_code',
      'upi_id',
      'commission_percentage',
      'is_verified',
    ];

    const exampleZoneId = zones?.[0]?.id || '';
    const exampleZoneName = zones?.[0]?.name || '';
    const rows = [
      [
        '',
        'Aman Workshop',
        'Aman',
        '9999999999',
        'aman@example.com',
        '123 Main Road, Near Landmark',
        'Delhi',
        'Delhi',
        '110001',
        exampleZoneId,
        exampleZoneName,
        '',
        'https://maps.google.com/?q=...',
        '',
        '',
        '',
        '',
        '',
        '',
        'true',
      ],
    ];

    const csv = buildCsv(headers, rows);
    downloadTextFile(csv, `workshops-import-template-${new Date().toISOString().slice(0, 10)}.csv`);
    setCsvInfo('Template downloaded. Fill rows and upload to create/update workshops.');
  };

  const applyWorkshopCsv = async (file: File) => {
    setCsvBusy(true);
    setCsvError('');
    setCsvInfo('');
    setCsvSummary(null);
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (!grid.length) throw new Error('CSV is empty.');

      const header = grid[0].map((h) => (h || '').trim().toLowerCase());
      const col = (name: string) => header.indexOf(name);

      const idxName = col('name');
      const idxContact = col('contact_person');
      const idxPhone = col('phone');
      const idxEmail = col('email');
      const idxAddress = col('address');
      const idxCity = col('city');
      const idxState = col('state');
      const idxPincode = col('pincode');

      if ([idxName, idxContact, idxPhone, idxEmail, idxAddress, idxCity, idxState, idxPincode].some((i) => i === -1)) {
        throw new Error(
          'CSV must include required headers: name, contact_person, phone, email, address, city, state, pincode'
        );
      }

      const idxId = col('id');
      const idxZoneId = col('zone_id');
      const idxZoneName = col('zone_name');
      const idxGst = col('gst_number');
      const idxMap = col('map_link');
      const idxLat = col('latitude');
      const idxLng = col('longitude');
      const idxBank = col('bank_account_number');
      const idxIfsc = col('ifsc_code');
      const idxUpi = col('upi_id');
      const idxComm = col('commission_percentage');
      const idxVerified = col('is_verified');

      const rows = grid.slice(1).filter((r) => r.some((x) => (x || '').trim() !== ''));
      if (!rows.length) throw new Error('CSV has no data rows.');

      // Zone name -> id map
      const zoneNameToId = new Map<string, string>();
      for (const z of zones) {
        if (z?.name && z?.id) zoneNameToId.set(String(z.name).trim().toLowerCase(), String(z.id));
      }

      const errors: string[] = [];
      const tasks: Array<() => Promise<{ ok: boolean; kind: 'created' | 'updated' | 'skipped' | 'failed'; error?: string }>> = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 2;

        const id = idxId !== -1 ? (r[idxId] || '').trim() : '';
        const name = (r[idxName] || '').trim();
        const contact_person = (r[idxContact] || '').trim();
        const phone = (r[idxPhone] || '').trim();
        const email = (r[idxEmail] || '').trim();
        const address = (r[idxAddress] || '').trim();
        const city = (r[idxCity] || '').trim();
        const state = (r[idxState] || '').trim();
        const pincode = (r[idxPincode] || '').trim();

        if (!name) errors.push(`Row ${rowNum}: name is required`);
        if (!contact_person) errors.push(`Row ${rowNum}: contact_person is required`);
        if (!phone) errors.push(`Row ${rowNum}: phone is required`);
        if (!email) errors.push(`Row ${rowNum}: email is required`);
        if (!address) errors.push(`Row ${rowNum}: address is required`);
        if (!city) errors.push(`Row ${rowNum}: city is required`);
        if (!state) errors.push(`Row ${rowNum}: state is required`);
        if (!pincode) errors.push(`Row ${rowNum}: pincode is required`);

        const zoneIdRaw = idxZoneId !== -1 ? (r[idxZoneId] || '').trim() : '';
        const zoneNameRaw = idxZoneName !== -1 ? (r[idxZoneName] || '').trim() : '';
        const resolvedZoneId =
          zoneIdRaw ||
          (zoneNameRaw ? zoneNameToId.get(zoneNameRaw.trim().toLowerCase()) || '' : '');

        if (zoneNameRaw && !zoneIdRaw && !resolvedZoneId) {
          errors.push(`Row ${rowNum}: zone_name "${zoneNameRaw}" not found`);
        }

        const parseOptionalNumber = (val: string) => {
          const t = (val || '').trim();
          if (!t) return null;
          const n = Number(t);
          if (!Number.isFinite(n)) return NaN;
          return n;
        };

        const lat = idxLat !== -1 ? parseOptionalNumber(r[idxLat] || '') : null;
        const lng = idxLng !== -1 ? parseOptionalNumber(r[idxLng] || '') : null;
        const comm = idxComm !== -1 ? parseOptionalNumber(r[idxComm] || '') : null;

        if (lat !== null && Number.isNaN(lat)) errors.push(`Row ${rowNum}: invalid latitude "${r[idxLat] || ''}"`);
        if (lng !== null && Number.isNaN(lng)) errors.push(`Row ${rowNum}: invalid longitude "${r[idxLng] || ''}"`);
        if (comm !== null && Number.isNaN(comm)) errors.push(`Row ${rowNum}: invalid commission_percentage "${r[idxComm] || ''}"`);

        const is_verified =
          idxVerified !== -1 && (r[idxVerified] || '').trim() !== ''
            ? ['true', '1', 'yes', 'y'].includes((r[idxVerified] || '').trim().toLowerCase())
            : true; // default true for bulk add

        const payload: any = {
          name,
          contact_person,
          phone,
          email,
          address,
          city,
          state,
          pincode,
          gst_number: idxGst !== -1 ? ((r[idxGst] || '').trim() || null) : null,
          map_link: idxMap !== -1 ? ((r[idxMap] || '').trim() || null) : null,
          latitude: lat === null ? null : lat,
          longitude: lng === null ? null : lng,
          zone_id: resolvedZoneId || null,
          bank_account_number: idxBank !== -1 ? ((r[idxBank] || '').trim() || null) : null,
          ifsc_code: idxIfsc !== -1 ? ((r[idxIfsc] || '').trim() || null) : null,
          upi_id: idxUpi !== -1 ? ((r[idxUpi] || '').trim() || null) : null,
          commission_percentage: comm === null ? null : comm,
          is_verified,
        };

        if (id) {
          tasks.push(async () => {
            try {
              const { error } = await supabase.from('workshops').update(payload).eq('id', id);
              if (error) return { ok: false, kind: 'failed', error: `Row ${rowNum}: ${error.message}` };
              return { ok: true, kind: 'updated' };
            } catch (e: any) {
              return { ok: false, kind: 'failed', error: `Row ${rowNum}: ${e?.message || 'Failed to update'}` };
            }
          });
        } else {
          tasks.push(async () => {
            try {
              const { error } = await supabase.from('workshops').insert([payload]);
              if (error) return { ok: false, kind: 'failed', error: `Row ${rowNum}: ${error.message}` };
              return { ok: true, kind: 'created' };
            } catch (e: any) {
              return { ok: false, kind: 'failed', error: `Row ${rowNum}: ${e?.message || 'Failed to create'}` };
            }
          });
        }
      }

      if (errors.length) {
        throw new Error(errors.slice(0, 10).join('\n') + (errors.length > 10 ? `\n...and ${errors.length - 10} more` : ''));
      }

      const confirmed = confirm(`Upload will process ${tasks.length} row(s). Continue?`);
      if (!confirmed) return;

      const results = await runWithConcurrency(tasks, 6);
      const summary = { total: tasks.length, created: 0, updated: 0, skipped: 0, failed: 0 };
      const failedMsgs: string[] = [];
      for (const r of results) {
        if (!r?.ok) {
          summary.failed++;
          if (r?.error) failedMsgs.push(r.error);
          continue;
        }
        if (r.kind === 'created') summary.created++;
        else if (r.kind === 'updated') summary.updated++;
        else if (r.kind === 'skipped') summary.skipped++;
      }
      setCsvSummary(summary);
      if (failedMsgs.length) {
        setCsvError(failedMsgs.slice(0, 8).join('\n') + (failedMsgs.length > 8 ? `\n...and ${failedMsgs.length - 8} more` : ''));
      } else {
        setCsvInfo('Import completed successfully.');
      }

      await fetchWorkshops();
    } catch (e: any) {
      setCsvError(e?.message || 'Failed to import CSV.');
    } finally {
      setCsvBusy(false);
    }
  };

  const filteredWorkshops = workshops.filter((w) =>
    searchTerm === '' ||
    w.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.phone?.includes(searchTerm)
  );

  if (loading) return <div className="p-8 sm:p-10 md:p-12 text-center text-sm sm:text-base text-gray-500">Loading workshops...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                <Store className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 flex-shrink-0" />
                <span className="truncate">Workshop Management</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Manage workshops, approvals, and zones</p>
            </div>
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <button 
                onClick={() => router.push('/dashboard/super_admin/workshops/public-pages')}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto justify-center"
              >
                <Globe className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Public Pages</span>
                <span className="sm:hidden">Public</span>
              </button>
              <button
                onClick={() => {
                  setCsvError('');
                  setCsvInfo('');
                  setCsvSummary(null);
                  setShowCsvModal(true);
                }}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-white border border-gray-300 text-gray-800 rounded-lg hover:bg-gray-50 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto justify-center"
                title="Bulk add/update workshops via CSV"
              >
                <Download className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Import/Export CSV</span>
                <span className="sm:hidden">CSV</span>
              </button>
              <button 
                onClick={() => router.push('/dashboard/super_admin/workshops/add')}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto justify-center"
              >
                <Plus className="w-4 h-4 flex-shrink-0" />
                <span className="hidden sm:inline">Add Workshop</span>
                <span className="sm:hidden">Add</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* CSV Import/Export Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-base sm:text-lg font-semibold text-gray-900">Import / Export Workshops (CSV)</div>
                <div className="text-xs sm:text-sm text-gray-500 mt-1">
                  Download template → fill rows → upload to create/update in bulk.
                </div>
              </div>
              <button
                onClick={() => setShowCsvModal(false)}
                className="p-2 rounded-lg hover:bg-gray-50 text-gray-500"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-4 sm:p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2">
                <div className="text-xs sm:text-sm text-gray-600">
                  Zones loaded: <span className="font-medium text-gray-800">{zones.length}</span>
                  <span className="text-gray-400"> • </span>
                  Tip: provide <span className="font-mono">zone_id</span> (preferred) or <span className="font-mono">zone_name</span>.
                </div>
                <button
                  onClick={downloadWorkshopCsvTemplate}
                  disabled={csvBusy}
                  className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download Template
                </button>
              </div>

              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-3 sm:p-4">
                <div className="text-xs sm:text-sm font-medium text-gray-800 mb-1">Upload CSV</div>
                <div className="text-[10px] sm:text-xs text-gray-500 mb-2">
                  Required columns: <span className="font-mono">name, contact_person, phone, email, address, city, state, pincode</span>.
                  If <span className="font-mono">id</span> is provided, that row will be updated; otherwise a new workshop will be created.
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={csvBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) applyWorkshopCsv(f);
                      e.currentTarget.value = '';
                    }}
                    className="block w-full text-xs sm:text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-100"
                  />
                  <div className="text-[10px] sm:text-xs text-gray-500 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {csvBusy ? 'Importing…' : 'Select CSV file'}
                  </div>
                </div>
              </div>

              {csvSummary && (
                <div className="text-xs sm:text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-3">
                  <div className="font-medium text-gray-900 mb-1">Import Summary</div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-[11px] sm:text-xs">
                    <div><span className="text-gray-500">Total</span>: {csvSummary.total}</div>
                    <div><span className="text-gray-500">Created</span>: {csvSummary.created}</div>
                    <div><span className="text-gray-500">Updated</span>: {csvSummary.updated}</div>
                    <div><span className="text-gray-500">Skipped</span>: {csvSummary.skipped}</div>
                    <div><span className="text-gray-500">Failed</span>: {csvSummary.failed}</div>
                  </div>
                </div>
              )}

              {csvError && (
                <div className="text-xs sm:text-sm whitespace-pre-line text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {csvError}
                </div>
              )}
              {csvInfo && (
                <div className="text-xs sm:text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                  {csvInfo}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search by name, city, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm border rounded-lg"
                />
              </div>
            <div className="flex gap-2 overflow-x-auto">
            {['all', 'active', 'inactive', 'pending'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg capitalize text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Workshops Table - Desktop */}
        <div className="bg-white rounded-lg shadow overflow-hidden hidden lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 md:px-6 py-2 md:py-3">Workshop</th>
                  <th className="px-4 md:px-6 py-2 md:py-3">Contact</th>
                  <th className="px-4 md:px-6 py-2 md:py-3">Location / Zone</th>
                  <th className="px-4 md:px-6 py-2 md:py-3">Status</th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkshops.map((workshop) => (
                  <tr key={workshop.id} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="font-medium text-sm sm:text-base text-gray-900">{workshop.name}</div>
                        <div className="text-xs sm:text-sm text-gray-500">{workshop.contact_person || 'N/A'}</div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                        <div className="text-gray-900 truncate max-w-[200px]">{workshop.phone}</div>
                        <div className="text-gray-500 truncate">{workshop.email}</div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                      <div className="text-gray-900">{workshop.city}, {workshop.state}</div>
                      {workshop.zones?.name ? (
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-blue-600 mt-1">
                          <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" /> {workshop.zones.name}
                        </div>
                      ) : (
                        <div className="text-[10px] sm:text-xs text-orange-500 mt-1">No Zone Assigned</div>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <span className={`px-2 py-0.5 sm:py-1 text-xs font-semibold rounded-full ${workshop.is_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {workshop.is_verified ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right text-xs sm:text-sm font-medium">
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2">
                        <button onClick={() => handleEditClick(workshop)} className="text-blue-600 hover:text-blue-900 whitespace-nowrap">
                          Edit
                        </button>
                        {workshop.is_verified ? (
                          <button onClick={() => handleDisable(workshop.id)} className="text-red-600 hover:text-red-900 whitespace-nowrap">Disable</button>
                        ) : (
                          <button onClick={() => handleApprove(workshop.id)} className="text-green-600 hover:text-green-900 whitespace-nowrap">Approve</button>
                        )}
                        <button onClick={() => router.push(`/dashboard/super_admin/inventory/pricing`)} className="text-purple-600 hover:text-purple-900 whitespace-nowrap">
                          Manage Rate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredWorkshops.length === 0 && (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <Building className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No workshops found</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">
                {searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your filters'}
              </p>
            </div>
          )}
        </div>

        {/* Workshops Cards - Mobile/Tablet */}
        <div className="lg:hidden space-y-3 sm:space-y-4">
          {filteredWorkshops.map((workshop) => (
            <div key={workshop.id} className="bg-white rounded-lg shadow p-3 sm:p-4 border border-gray-100">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm sm:text-base text-gray-900 mb-1">{workshop.name}</div>
                  <div className="text-xs text-gray-500">{workshop.contact_person || 'N/A'}</div>
                </div>
                <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full flex-shrink-0 ${workshop.is_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {workshop.is_verified ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Phone:</span>
                  <span className="text-gray-900">{workshop.phone}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Email:</span>
                  <span className="text-gray-900 truncate max-w-[200px]">{workshop.email}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Location:</span>
                  <span className="text-gray-900">{workshop.city}, {workshop.state}</span>
                </div>
                {workshop.zones?.name && (
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-500">Zone:</span>
                    <div className="flex items-center gap-1 text-blue-600 font-semibold">
                      <MapPin className="w-3 h-3 flex-shrink-0" /> {workshop.zones.name}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => handleEditClick(workshop)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-blue-600 hover:text-blue-900 border border-blue-200 rounded-lg hover:bg-blue-50">
                  Edit
                </button>
                {workshop.is_verified ? (
                  <button onClick={() => handleDisable(workshop.id)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-red-600 hover:text-red-900 border border-red-200 rounded-lg hover:bg-red-50">
                    Disable
                  </button>
                ) : (
                  <button onClick={() => handleApprove(workshop.id)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-green-600 hover:text-green-900 border border-green-200 rounded-lg hover:bg-green-50">
                    Approve
                  </button>
                )}
                <button onClick={() => router.push(`/dashboard/super_admin/inventory/pricing`)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-purple-600 hover:text-purple-900 border border-purple-200 rounded-lg hover:bg-purple-50">
                  Manage Rate
                </button>
              </div>
            </div>
          ))}

          {filteredWorkshops.length === 0 && (
            <div className="text-center py-8 sm:py-10 md:py-12 bg-white rounded-lg shadow">
              <Building className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No workshops found</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">
                {searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your filters'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal (Full Details) */}
      {showEditModal && editingWorkshop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg sm:rounded-xl max-w-3xl w-full p-4 sm:p-5 md:p-6 m-2 sm:m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-5 md:mb-6 border-b pb-3 sm:pb-4">
              <h2 className="text-lg sm:text-xl font-bold">Edit Workshop Details</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSaveChanges} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              {/* Basic Info */}
              <div className="col-span-2">
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase mb-2 sm:mb-3">Basic Information</h3>
              </div>
              
              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Workshop Name *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.name} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.contact_person} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, contact_person: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.phone} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, phone: e.target.value})} 
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input type="email" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.email} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, email: e.target.value})} 
                />
              </div>

              {/* Address */}
              <div className="col-span-2 pt-2 border-t">
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase mb-2 sm:mb-3">Location & Address</h3>
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Full Address *</label>
                <textarea required className="w-full px-3 py-2 text-sm border rounded-lg" rows={2}
                  value={editingWorkshop.address} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, address: e.target.value})} 
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Map Link</label>
                <div className="relative">
                  <Globe className="absolute left-2.5 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-4.5 sm:h-4.5" />
                  <input
                    type="url"
                    placeholder="Paste Google Maps link (https://maps.google.com/...)"
                    className="w-full pl-9 sm:pl-10 pr-3 py-2 text-sm border rounded-lg"
                    value={editingWorkshop.map_link || ''}
                    onChange={(e) => setEditingWorkshop({ ...editingWorkshop, map_link: e.target.value })}
                  />
                </div>
                {!!editingWorkshop.map_link && (
                  <a
                    href={editingWorkshop.map_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800"
                  >
                    Open link
                  </a>
                )}
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">City *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.city} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, city: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">State *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.state} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, state: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.pincode} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, pincode: e.target.value})} 
                />
              </div>

              {/* Zone Selector */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-blue-800 mb-1">Assign Zone *</label>
                <div className="relative">
                  <MapPin className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-blue-500 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <select 
                    className="w-full pl-8 sm:pl-10 px-3 py-2 text-sm border rounded-lg bg-blue-50 focus:bg-white border-blue-200"
                    value={editingWorkshop.zone_id || ''}
                    onChange={e => setEditingWorkshop({...editingWorkshop, zone_id: e.target.value || null})}
                  >
                    <option value="">-- No Zone Assigned --</option>
                    {zones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bank Details */}
              <div className="col-span-2 pt-2 border-t">
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase mb-2 sm:mb-3">Bank & Financial Details</h3>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">GST Number</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg uppercase"
                  value={editingWorkshop.gst_number || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, gst_number: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Commission (%)</label>
                <input type="number" step="0.01" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.commission_percentage || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, commission_percentage: e.target.value})} 
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Bank Account Number</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.bank_account_number || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, bank_account_number: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg uppercase"
                  value={editingWorkshop.ifsc_code || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, ifsc_code: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">UPI ID</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.upi_id || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, upi_id: e.target.value})} 
                />
              </div>

              <div className="col-span-2 flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6 pt-3 sm:pt-4 border-t">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 sm:py-3 text-sm sm:text-base border rounded-lg hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 sm:py-3 text-sm sm:text-base bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 font-medium">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
