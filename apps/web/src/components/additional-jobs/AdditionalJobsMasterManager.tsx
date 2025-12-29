'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, Download, Upload, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

type WorkshopOption = { id: string; name: string; city?: string | null };

type Item = {
  id: string;
  workshop_id: string | null;
  name: string;
  description?: string | null;
  category?: string | null;
  hsn_sac_code?: string | null;
  unit?: string | null;
  oem_price?: number | null;
  oes_price?: number | null;
  labour_price?: number | null;
  tax_rate?: number | null;
  is_active?: boolean | null;
  created_at?: string | null;
  deleted_at?: string | null;
};

export default function AdditionalJobsMasterManager({
  mode,
}: {
  mode: 'SUPER_ADMIN' | 'WORKSHOP_ADMIN' | 'WORKSHOP_SUPERVISOR';
}) {
  const isSuperAdmin = mode === 'SUPER_ADMIN';
  const [viewerWorkshopId, setViewerWorkshopId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [items, setItems] = useState<Item[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeGlobal, setIncludeGlobal] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string>(''); // '' = all

  // CSV Import/Export
  const [showCsvModal, setShowCsvModal] = useState(false);
  const [csvBusy, setCsvBusy] = useState(false);
  const [csvError, setCsvError] = useState<string>('');
  const [csvInfo, setCsvInfo] = useState<string>('');
  const [csvImportSummary, setCsvImportSummary] = useState<{
    total: number;
    created: number;
    updated: number;
    skipped: number;
    failed: number;
  } | null>(null);

  // Workshop users: bulk-add selection for global catalog
  const [selectedGlobalIds, setSelectedGlobalIds] = useState<Record<string, boolean>>({});

  // workshop selector (super admin)
  const [workshops, setWorkshops] = useState<WorkshopOption[]>([]);
  const [selectedWorkshopId, setSelectedWorkshopId] = useState<string>(''); // '' = all
  const [loadingWorkshops, setLoadingWorkshops] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  const [form, setForm] = useState({
    workshop_id: '' as string, // super admin only ('' = global)
    name: '',
    description: '',
    category: '',
    hsn_sac_code: '',
    unit: 'job',
    oem_price: '',
    oes_price: '',
    labour_price: '',
    tax_rate: '18.00',
    is_active: true,
  });

  const workshopNameSet = useMemo(() => {
    // Track all workshop-specific items (active/inactive) for the current workshop (excluding deleted)
    const set = new Set<string>();
    if (!viewerWorkshopId) return set;
    for (const it of items) {
      if (it.deleted_at) continue;
      if (it.workshop_id && it.workshop_id === viewerWorkshopId) {
        set.add((it.name || '').trim().toLowerCase());
      }
    }
    return set;
  }, [items, viewerWorkshopId]);

  const visibleItems = useMemo(() => {
    // For workshop users: hide global rows if already added (until deleted)
    if (isSuperAdmin) return items;
    return items.filter((it) => {
      if (it.deleted_at) return false;
      if (!it.workshop_id) {
        const key = (it.name || '').trim().toLowerCase();
        return !workshopNameSet.has(key);
      }
      return true;
    });
  }, [isSuperAdmin, items, workshopNameSet]);

  const displayedItems = useMemo(() => {
    // Client-side active/inactive filter for workshop users (we fetch include_inactive=1 for mapping)
    const base = isSuperAdmin ? items : visibleItems;
    const activeFiltered = includeInactive ? base : base.filter((it) => it.is_active !== false);
    const catFiltered = selectedCategory
      ? activeFiltered.filter((it) => (it.category || '').trim() === selectedCategory)
      : activeFiltered;
    const q = searchTerm.trim().toLowerCase();
    if (!q) return catFiltered;
    return catFiltered.filter((it) => {
      return (
        (it.name || '').toLowerCase().includes(q) ||
        (it.category || '').toLowerCase().includes(q) ||
        (it.hsn_sac_code || '').toLowerCase().includes(q)
      );
    });
  }, [includeInactive, isSuperAdmin, items, searchTerm, selectedCategory, visibleItems]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    const base = isSuperAdmin ? items : visibleItems;
    const activeFiltered = includeInactive ? base : base.filter((it) => it.is_active !== false);
    for (const it of activeFiltered) {
      const c = (it.category || '').trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [includeInactive, isSuperAdmin, items, visibleItems]);

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive, includeGlobal, selectedWorkshopId]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchWorkshops();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  async function fetchWorkshops() {
    try {
      setLoadingWorkshops(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workshops')
        .select('id, name, city')
        .order('name', { ascending: true })
        .limit(500);
      if (error) throw error;
      setWorkshops((data || []) as any);
    } catch (e) {
      console.error('Error fetching workshops:', e);
      setWorkshops([]);
    } finally {
      setLoadingWorkshops(false);
    }
  }

  async function fetchItems() {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (isSuperAdmin && selectedWorkshopId) params.set('workshop_id', selectedWorkshopId);
      params.set('include_global', includeGlobal ? '1' : '0');
      // Workshop users: always fetch inactive too (for "already added" mapping).
      // UI will hide inactive unless includeInactive is enabled.
      params.set('include_inactive', isSuperAdmin ? (includeInactive ? '1' : '0') : '1');
      if (searchTerm.trim()) params.set('q', searchTerm.trim());

      const res = await fetch(`/api/additional-jobs-master?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to fetch');
      setItems((data?.items || []) as Item[]);
      setViewerWorkshopId((data?.viewer?.workshop_id as string | null) ?? null);
    } catch (e) {
      console.error('Error fetching additional jobs master:', e);
      setItems([]);
    } finally {
      setLoading(false);
    }
  }

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

  const exportAdditionalJobsCsv = () => {
    setCsvError('');
    setCsvInfo('');
    setCsvImportSummary(null);

    const headers = [
      'id',
      'workshop_id',
      'name',
      'description',
      'category',
      'hsn_sac_code',
      'unit',
      'oem_price',
      'oes_price',
      'labour_price',
      'tax_rate',
      'is_active',
    ];

    const rows = (displayedItems || []).map((it) => [
      it.id,
      it.workshop_id || '',
      it.name || '',
      it.description || '',
      it.category || '',
      it.hsn_sac_code || '',
      it.unit || 'job',
      it.oem_price ?? 0,
      it.oes_price ?? 0,
      it.labour_price ?? 0,
      it.tax_rate ?? 18,
      it.is_active !== false ? 'true' : 'false',
    ]);

    const csv = buildCsv(headers, rows);
    const date = new Date().toISOString().slice(0, 10);
    const scope =
      isSuperAdmin && selectedWorkshopId
        ? `workshop-${selectedWorkshopId}`
        : isSuperAdmin
          ? 'all'
          : viewerWorkshopId
            ? `workshop-${viewerWorkshopId}`
            : 'workshop';
    const filename = `additional-jobs-master-${scope}-${date}.csv`.replace(/[^a-zA-Z0-9._-]/g, '');
    downloadTextFile(csv, filename);
    setCsvInfo(`Downloaded ${rows.length} rows.`);
  };

  const runWithConcurrency = async <T,>(tasks: Array<() => Promise<T>>, concurrency = 5): Promise<T[]> => {
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

  const applyImportedAdditionalJobsCsv = async (file: File) => {
    setCsvBusy(true);
    setCsvError('');
    setCsvInfo('');
    setCsvImportSummary(null);
    try {
      const text = await file.text();
      const grid = parseCsv(text);
      if (!grid.length) throw new Error('CSV is empty.');

      const header = grid[0].map((h) => (h || '').trim().toLowerCase());
      const col = (name: string) => header.indexOf(name);

      const idxName = col('name');
      if (idxName === -1) throw new Error('CSV must contain header: name');

      const idxId = col('id');
      const idxWorkshopId = col('workshop_id');
      const idxDescription = col('description');
      const idxCategory = col('category');
      const idxHsn = col('hsn_sac_code');
      const idxUnit = col('unit');
      const idxOem = col('oem_price');
      const idxOes = col('oes_price');
      const idxLabour = col('labour_price');
      const idxTax = col('tax_rate');
      const idxActive = col('is_active');

      const errors: string[] = [];
      const rows = grid.slice(1).filter((r) => r.some((x) => (x || '').trim() !== ''));
      if (!rows.length) throw new Error('CSV has no data rows.');

      const tasks: Array<() => Promise<{ ok: boolean; kind: 'created' | 'updated' | 'skipped' | 'failed'; error?: string }>> = [];

      for (let i = 0; i < rows.length; i++) {
        const r = rows[i];
        const rowNum = i + 2;
        const name = (r[idxName] || '').trim();
        if (!name) {
          errors.push(`Row ${rowNum}: name is required`);
          continue;
        }

        const id = idxId !== -1 ? (r[idxId] || '').trim() : '';
        const workshopIdRaw = idxWorkshopId !== -1 ? (r[idxWorkshopId] || '').trim() : '';
        const workshopIdForCreate = isSuperAdmin
          ? (idxWorkshopId !== -1 ? (workshopIdRaw || null) : (selectedWorkshopId ? selectedWorkshopId : null))
          : null; // workshop users: API will force to viewer workshop

        const payload: any = {
          name,
        };
        if (idxDescription !== -1) payload.description = (r[idxDescription] || '').trim() || null;
        if (idxCategory !== -1) payload.category = (r[idxCategory] || '').trim() || null;
        if (idxHsn !== -1) payload.hsn_sac_code = (r[idxHsn] || '').trim() || null;
        if (idxUnit !== -1) payload.unit = (r[idxUnit] || '').trim() || 'job';
        if (idxOem !== -1 && (r[idxOem] || '').trim() !== '') payload.oem_price = Number((r[idxOem] || '').trim() || 0);
        if (idxOes !== -1 && (r[idxOes] || '').trim() !== '') payload.oes_price = Number((r[idxOes] || '').trim() || 0);
        if (idxLabour !== -1 && (r[idxLabour] || '').trim() !== '') payload.labour_price = Number((r[idxLabour] || '').trim() || 0);
        if (idxTax !== -1 && (r[idxTax] || '').trim() !== '') payload.tax_rate = Number((r[idxTax] || '').trim() || 18);
        if (idxActive !== -1 && (r[idxActive] || '').trim() !== '') {
          const v = (r[idxActive] || '').trim().toLowerCase();
          payload.is_active = v === 'true' || v === '1' || v === 'yes';
        }

        // basic numeric validation
        const numericFields: Array<[string, any]> = [
          ['oem_price', payload.oem_price],
          ['oes_price', payload.oes_price],
          ['labour_price', payload.labour_price],
          ['tax_rate', payload.tax_rate],
        ];
        for (const [k, v] of numericFields) {
          if (v === undefined) continue;
          if (!Number.isFinite(Number(v)) || Number(v) < 0) {
            errors.push(`Row ${rowNum}: invalid ${k} "${v}"`);
          }
        }

        if (id) {
          // update existing
          if (isSuperAdmin && idxWorkshopId !== -1) {
            payload.workshop_id = workshopIdRaw ? workshopIdRaw : null;
          }
          tasks.push(async () => {
            try {
              const res = await fetch(`/api/additional-jobs-master/${id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) return { ok: false, kind: 'failed', error: body?.error || `Row ${rowNum}: failed to update` };
              return { ok: true, kind: 'updated' };
            } catch (e: any) {
              return { ok: false, kind: 'failed', error: e?.message || `Row ${rowNum}: failed to update` };
            }
          });
        } else {
          // create new
          if (isSuperAdmin) payload.workshop_id = workshopIdForCreate;
          tasks.push(async () => {
            try {
              const res = await fetch('/api/additional-jobs-master', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
              });
              const body = await res.json().catch(() => ({}));
              if (!res.ok) return { ok: false, kind: 'failed', error: body?.error || `Row ${rowNum}: failed to create` };
              if (body?.existed) return { ok: true, kind: 'skipped' };
              return { ok: true, kind: 'created' };
            } catch (e: any) {
              return { ok: false, kind: 'failed', error: e?.message || `Row ${rowNum}: failed to create` };
            }
          });
        }
      }

      if (errors.length) {
        throw new Error(errors.slice(0, 8).join('\n') + (errors.length > 8 ? `\n...and ${errors.length - 8} more` : ''));
      }

      const results = await runWithConcurrency(tasks, 6);
      const summary = { total: tasks.length, created: 0, updated: 0, skipped: 0, failed: 0 };
      const failedMessages: string[] = [];
      for (const r of results) {
        if (!r.ok) {
          summary.failed++;
          if (r.error) failedMessages.push(r.error);
          continue;
        }
        if (r.kind === 'created') summary.created++;
        else if (r.kind === 'updated') summary.updated++;
        else if (r.kind === 'skipped') summary.skipped++;
      }
      setCsvImportSummary(summary);
      if (failedMessages.length) {
        setCsvError(failedMessages.slice(0, 6).join('\n') + (failedMessages.length > 6 ? `\n...and ${failedMessages.length - 6} more` : ''));
      } else {
        setCsvInfo('Import completed successfully.');
      }

      await fetchItems();
    } catch (e: any) {
      setCsvError(e?.message || 'Failed to import CSV.');
    } finally {
      setCsvBusy(false);
    }
  };

  function canManage(it: Item) {
    if (isSuperAdmin) return true;
    if (!viewerWorkshopId) return false;
    return it.workshop_id === viewerWorkshopId;
  }

  async function createWorkshopCopyFromGlobal(it: Item) {
    try {
      setSubmitting(true);
      const payload: any = {
        name: (it.name || '').trim(),
        description: it.description ?? null,
        category: it.category ?? null,
        hsn_sac_code: it.hsn_sac_code ?? null,
        unit: it.unit ?? 'job',
        oem_price: Number(it.oem_price || 0),
        oes_price: Number(it.oes_price || 0),
        labour_price: Number(it.labour_price || 0),
        tax_rate: Number(it.tax_rate || 18),
        is_active: it.is_active !== false,
      };

      const res = await fetch('/api/additional-jobs-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create workshop copy');

      // Open edit modal for newly created workshop item
      openEdit(data.item as Item);
      fetchItems();
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed'}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function bulkAddSelectedToWorkshop() {
    try {
      const ids = Object.keys(selectedGlobalIds).filter((id) => selectedGlobalIds[id]);
      if (ids.length === 0) return alert('Select at least 1 item to add.');

      const globals = visibleItems.filter((it) => !it.workshop_id && ids.includes(it.id));
      if (globals.length === 0) return alert('No global items selected.');

      setSubmitting(true);
      const results = await Promise.all(
        globals.map((it) =>
          fetch('/api/additional-jobs-master', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: (it.name || '').trim(),
              description: it.description ?? null,
              category: it.category ?? null,
              hsn_sac_code: it.hsn_sac_code ?? null,
              unit: it.unit ?? 'job',
              oem_price: Number(it.oem_price || 0),
              oes_price: Number(it.oes_price || 0),
              labour_price: Number(it.labour_price || 0),
              tax_rate: Number(it.tax_rate || 18),
              is_active: it.is_active !== false,
            }),
          })
            .then(async (r) => ({ ok: r.ok, body: await r.json().catch(() => ({})) }))
            .catch((e) => ({ ok: false, body: { error: e?.message || 'Failed' } }))
        )
      );

      const failed = results.filter((r) => !r.ok);
      if (failed.length) {
        const msg = failed[0]?.body?.error || `Failed to add ${failed.length} item(s)`;
        alert(`Bulk add completed with some errors: ${msg}`);
      }

      setSelectedGlobalIds({});
      fetchItems();
    } finally {
      setSubmitting(false);
    }
  }

  function openAdd() {
    setForm({
      workshop_id: '',
      name: '',
      description: '',
      category: '',
      hsn_sac_code: '',
      unit: 'job',
      oem_price: '',
      oes_price: '',
      labour_price: '',
      tax_rate: '18.00',
      is_active: true,
    });
    setShowAddModal(true);
  }

  function openEdit(item: Item) {
    setEditing(item);
    setForm({
      workshop_id: item.workshop_id || '',
      name: item.name || '',
      description: item.description || '',
      category: item.category || '',
      hsn_sac_code: item.hsn_sac_code || '',
      unit: item.unit || 'job',
      oem_price: (item.oem_price ?? 0).toString(),
      oes_price: (item.oes_price ?? 0).toString(),
      labour_price: (item.labour_price ?? 0).toString(),
      tax_rate: (item.tax_rate ?? 18).toString(),
      is_active: item.is_active !== false,
    });
    setShowEditModal(true);
  }

  async function addItem(e: React.FormEvent) {
    e.preventDefault();
    const name = form.name.trim();
    if (!name) return alert('Name is required');

    try {
      setSubmitting(true);
      const payload: any = {
        name,
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        hsn_sac_code: form.hsn_sac_code.trim() || null,
        unit: form.unit.trim() || 'job',
        oem_price: Number(form.oem_price || 0),
        oes_price: Number(form.oes_price || 0),
        labour_price: Number(form.labour_price || 0),
        tax_rate: Number(form.tax_rate || 18),
        is_active: Boolean(form.is_active),
      };

      if (isSuperAdmin) {
        payload.workshop_id = form.workshop_id ? form.workshop_id : null;
      }

      const res = await fetch('/api/additional-jobs-master', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to create');

      setShowAddModal(false);
      fetchItems();
      alert('Additional job added successfully!');
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to add'}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function updateItem(e: React.FormEvent) {
    e.preventDefault();
    if (!editing) return;

    const name = form.name.trim();
    if (!name) return alert('Name is required');

    try {
      setSubmitting(true);
      const payload: any = {
        name,
        description: form.description.trim() || null,
        category: form.category.trim() || null,
        hsn_sac_code: form.hsn_sac_code.trim() || null,
        unit: form.unit.trim() || 'job',
        oem_price: Number(form.oem_price || 0),
        oes_price: Number(form.oes_price || 0),
        labour_price: Number(form.labour_price || 0),
        tax_rate: Number(form.tax_rate || 18),
        is_active: Boolean(form.is_active),
      };
      if (isSuperAdmin) payload.workshop_id = form.workshop_id ? form.workshop_id : null;

      const res = await fetch(`/api/additional-jobs-master/${editing.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed to update');

      setShowEditModal(false);
      setEditing(null);
      fetchItems();
      alert('Additional job updated successfully!');
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to update'}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(item: Item) {
    try {
      const nextActive = !(item.is_active !== false);
      const res = await fetch(`/api/additional-jobs-master/${item.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: nextActive }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      fetchItems();
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed'}`);
    }
  }

  async function deleteItem(item: Item) {
    if (!confirm(`Delete "${item.name}"?`)) return;
    try {
      const res = await fetch(`/api/additional-jobs-master/${item.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Failed');
      fetchItems();
      alert('Deleted');
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed'}`);
    }
  }

  function workshopLabel(it: Item) {
    if (!it.workshop_id) return 'Global';
    const w = workshops.find((x) => x.id === it.workshop_id);
    return w ? `${w.name}${w.city ? ` (${w.city})` : ''}` : 'Workshop';
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-5 gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Additional Jobs Master</h1>
          <p className="text-gray-500">
            Create reusable additional jobs list (workshop-wise) for faster approvals & billing.
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => {
              setCsvError('');
              setCsvInfo('');
              setCsvImportSummary(null);
              setShowCsvModal(true);
            }}
            className="btn btn-outline bg-white flex items-center gap-2"
            title="Export or Import additional jobs via CSV"
          >
            <Download className="w-4 h-4" />
            Import/Export CSV
          </button>
          <button onClick={openAdd} className="btn btn-primary flex items-center gap-2">
            <Plus className="w-4 h-4" />
            Add Additional Job
          </button>
        </div>
      </div>

      {/* CSV Import/Export Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-gray-900">Import / Export Additional Jobs (CSV)</div>
                <div className="text-sm text-gray-500 mt-1">
                  Export will download the <span className="font-medium">currently visible list</span> (filters applied).
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

            <div className="p-5 space-y-4">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <div className="text-sm text-gray-600">
                  Rows: <span className="font-medium text-gray-800">{displayedItems.length}</span>
                  {isSuperAdmin && selectedWorkshopId ? (
                    <span className="ml-2 text-xs text-gray-500">(Filtered by selected workshop)</span>
                  ) : null}
                </div>
                <button
                  onClick={exportAdditionalJobsCsv}
                  disabled={csvBusy}
                  className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <Download className="w-4 h-4" />
                  Download CSV
                </button>
              </div>

              <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4">
                <div className="text-sm font-medium text-gray-800 mb-1">Upload CSV to create/update</div>
                <div className="text-xs text-gray-500 mb-2">
                  Required header: <span className="font-mono">name</span>. If <span className="font-mono">id</span> is provided, the row updates that record; otherwise it creates new.
                  {isSuperAdmin ? (
                    <span> For scope, include <span className="font-mono">workshop_id</span> (blank = Global). If omitted, import uses selected workshop (if any) else Global.</span>
                  ) : (
                    <span> Workshop users can only create/update their own workshop items.</span>
                  )}
                </div>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <input
                    type="file"
                    accept=".csv,text/csv"
                    disabled={csvBusy}
                    onChange={(e) => {
                      const f = e.target.files?.[0];
                      if (f) applyImportedAdditionalJobsCsv(f);
                      e.currentTarget.value = '';
                    }}
                    className="block w-full text-sm file:mr-3 file:py-2 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-medium file:bg-white file:text-gray-700 hover:file:bg-gray-100"
                  />
                  <div className="text-xs text-gray-500 flex items-center gap-2">
                    <Upload className="w-4 h-4" />
                    {csvBusy ? 'Importing…' : 'Select CSV file'}
                  </div>
                </div>
              </div>

              {csvImportSummary && (
                <div className="text-sm text-gray-700 bg-white border border-gray-200 rounded-lg p-3">
                  <div className="font-medium text-gray-900 mb-1">Import Summary</div>
                  <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                    <div><span className="text-gray-500">Total</span>: {csvImportSummary.total}</div>
                    <div><span className="text-gray-500">Created</span>: {csvImportSummary.created}</div>
                    <div><span className="text-gray-500">Updated</span>: {csvImportSummary.updated}</div>
                    <div><span className="text-gray-500">Skipped</span>: {csvImportSummary.skipped}</div>
                    <div><span className="text-gray-500">Failed</span>: {csvImportSummary.failed}</div>
                  </div>
                </div>
              )}

              {csvError && (
                <div className="text-sm whitespace-pre-line text-red-700 bg-red-50 border border-red-200 rounded-lg p-3">
                  {csvError}
                </div>
              )}
              {csvInfo && (
                <div className="text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg p-3">
                  {csvInfo}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex flex-col lg:flex-row gap-3 mb-5 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input
            type="text"
            placeholder="Search by name/category/HSN..."
            className="w-full pl-10 p-2 border rounded-lg bg-gray-50 focus:bg-white transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') fetchItems();
            }}
          />
        </div>

        {isSuperAdmin && (
          <select
            className="p-2 border rounded-lg bg-gray-50 min-w-[240px]"
            value={selectedWorkshopId}
            onChange={(e) => setSelectedWorkshopId(e.target.value)}
            disabled={loadingWorkshops}
          >
            <option value="">All Workshops</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}{w.city ? ` (${w.city})` : ''}
              </option>
            ))}
          </select>
        )}

        <select
          className="p-2 border rounded-lg bg-gray-50 min-w-[200px]"
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value)}
          title="Category filter"
        >
          <option value="">All Categories</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
          <input
            type="checkbox"
            checked={includeGlobal}
            onChange={(e) => setIncludeGlobal(e.target.checked)}
          />
          Include Global
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
          <input
            type="checkbox"
            checked={includeInactive}
            onChange={(e) => setIncludeInactive(e.target.checked)}
          />
          Show Inactive
        </label>

        {!isSuperAdmin && (
          <button
            type="button"
            onClick={bulkAddSelectedToWorkshop}
            className="btn btn-primary"
            disabled={submitting}
            title="Bulk add selected global items to your workshop"
          >
            Bulk Add to Workshop
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                {!isSuperAdmin && (
                  <th className="p-4 font-medium text-gray-600 w-12">
                    <input
                      type="checkbox"
                      aria-label="Select all visible global items"
                      checked={
                        displayedItems.filter((it) => !it.workshop_id).length > 0 &&
                        displayedItems.filter((it) => !it.workshop_id).every((it) => selectedGlobalIds[it.id])
                      }
                      onChange={(e) => {
                        const checked = e.target.checked;
                        const next: Record<string, boolean> = { ...selectedGlobalIds };
                        for (const it of displayedItems) {
                          if (!it.workshop_id) next[it.id] = checked;
                        }
                        setSelectedGlobalIds(next);
                      }}
                    />
                  </th>
                )}
                <th className="p-4 font-medium text-gray-600">Name</th>
                {isSuperAdmin && <th className="p-4 font-medium text-gray-600">Scope</th>}
                <th className="p-4 font-medium text-gray-600">Category</th>
                <th className="p-4 font-medium text-gray-600">HSN/SAC</th>
                <th className="p-4 font-medium text-gray-600 text-right">OEM</th>
                <th className="p-4 font-medium text-gray-600 text-right">OES</th>
                <th className="p-4 font-medium text-gray-600 text-right">Labour</th>
                <th className="p-4 font-medium text-gray-600 text-center">Tax %</th>
                <th className="p-4 font-medium text-gray-600 text-center">Unit</th>
                <th className="p-4 font-medium text-gray-600 text-center">Status</th>
                <th className="p-4 font-medium text-gray-600 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-500">
                    <div className="inline-flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Loading...
                    </div>
                  </td>
                </tr>
              ) : displayedItems.length === 0 ? (
                <tr>
                  <td colSpan={11} className="p-8 text-center text-gray-500">
                    No additional jobs found.
                  </td>
                </tr>
              ) : (
                displayedItems.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50 transition-colors">
                    {!isSuperAdmin && (
                      <td className="p-4">
                        {!it.workshop_id ? (
                          <input
                            type="checkbox"
                            aria-label={`Select ${it.name}`}
                            checked={Boolean(selectedGlobalIds[it.id])}
                            onChange={(e) => setSelectedGlobalIds((p) => ({ ...p, [it.id]: e.target.checked }))}
                          />
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        )}
                      </td>
                    )}
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{it.name}</div>
                      {it.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{it.description}</div>}
                    </td>
                    {isSuperAdmin && <td className="p-4 text-gray-600">{workshopLabel(it)}</td>}
                    <td className="p-4 text-gray-600">{it.category || '-'}</td>
                    <td className="p-4 font-mono text-xs bg-gray-50 rounded w-fit">{it.hsn_sac_code || '-'}</td>
                    <td className="p-4 text-right font-medium">₹{Number(it.oem_price || 0).toFixed(0)}</td>
                    <td className="p-4 text-right font-medium">₹{Number(it.oes_price || 0).toFixed(0)}</td>
                    <td className="p-4 text-right font-medium">₹{Number(it.labour_price || 0).toFixed(0)}</td>
                    <td className="p-4 text-center">{Number(it.tax_rate || 0).toFixed(0)}%</td>
                    <td className="p-4 text-center text-gray-500">{it.unit || 'job'}</td>
                    <td className="p-4 text-center">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${it.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {it.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <div className="flex items-center justify-center gap-2">
                        {canManage(it) ? (
                          <>
                            <button
                              onClick={() => toggleActive(it)}
                              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title={it.is_active !== false ? 'Disable' : 'Enable'}
                            >
                              {it.is_active !== false ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() => openEdit(it)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => deleteItem(it)}
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        ) : (
                          <>
                            {/* Workshop users: global items are read-only; allow creating a workshop copy */}
                            {!isSuperAdmin && !it.workshop_id && (
                              <button
                                onClick={() => createWorkshopCopyFromGlobal(it)}
                                className="px-3 py-1.5 text-xs font-semibold bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                                title="Create workshop copy"
                                disabled={submitting}
                              >
                                Add to Workshop
                              </button>
                            )}
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-5">
            <h3 className="text-lg font-bold mb-4">Add Additional Job</h3>
            <form onSubmit={addItem} className="space-y-3">
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                  <select
                    className="input w-full"
                    value={form.workshop_id}
                    onChange={(e) => setForm((p) => ({ ...p, workshop_id: e.target.value }))}
                  >
                    <option value="">Global</option>
                    {workshops.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}{w.city ? ` (${w.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  className="input w-full"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Denting - Door"
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    className="input w-full"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                    placeholder="e.g. Denting"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN/SAC</label>
                  <input
                    className="input w-full"
                    value={form.hsn_sac_code}
                    onChange={(e) => setForm((p) => ({ ...p, hsn_sac_code: e.target.value }))}
                    placeholder="e.g. 998719"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="input w-full"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                  placeholder="Optional notes"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OEM Price</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={form.oem_price}
                    onChange={(e) => setForm((p) => ({ ...p, oem_price: e.target.value }))}
                    min="0"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OES Price</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={form.oes_price}
                    onChange={(e) => setForm((p) => ({ ...p, oes_price: e.target.value }))}
                    min="0"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Labour Price</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={form.labour_price}
                    onChange={(e) => setForm((p) => ({ ...p, labour_price: e.target.value }))}
                    min="0"
                    step="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax %</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={form.tax_rate}
                    onChange={(e) => setForm((p) => ({ ...p, tax_rate: e.target.value }))}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    className="input w-full"
                    value={form.unit}
                    onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                    placeholder="job"
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                Active
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn btn-outline flex-1" onClick={() => setShowAddModal(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={submitting}>
                  {submitting ? (
                    <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Saving…</span>
                  ) : (
                    'Save'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editing && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl w-full max-w-lg p-5">
            <h3 className="text-lg font-bold mb-4">Edit Additional Job</h3>
            <form onSubmit={updateItem} className="space-y-3">
              {isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Scope</label>
                  <select
                    className="input w-full"
                    value={form.workshop_id}
                    onChange={(e) => setForm((p) => ({ ...p, workshop_id: e.target.value }))}
                  >
                    <option value="">Global</option>
                    {workshops.map((w) => (
                      <option key={w.id} value={w.id}>
                        {w.name}{w.city ? ` (${w.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                <input
                  className="input w-full"
                  value={form.name}
                  onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                  required
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    className="input w-full"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN/SAC</label>
                  <input
                    className="input w-full"
                    value={form.hsn_sac_code}
                    onChange={(e) => setForm((p) => ({ ...p, hsn_sac_code: e.target.value }))}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  className="input w-full"
                  value={form.description}
                  onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OEM Price</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={form.oem_price}
                    onChange={(e) => setForm((p) => ({ ...p, oem_price: e.target.value }))}
                    min="0"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">OES Price</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={form.oes_price}
                    onChange={(e) => setForm((p) => ({ ...p, oes_price: e.target.value }))}
                    min="0"
                    step="1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Labour Price</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={form.labour_price}
                    onChange={(e) => setForm((p) => ({ ...p, labour_price: e.target.value }))}
                    min="0"
                    step="1"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax %</label>
                  <input
                    type="number"
                    className="input w-full"
                    value={form.tax_rate}
                    onChange={(e) => setForm((p) => ({ ...p, tax_rate: e.target.value }))}
                    min="0"
                    step="0.01"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <input
                    className="input w-full"
                    value={form.unit}
                    onChange={(e) => setForm((p) => ({ ...p, unit: e.target.value }))}
                  />
                </div>
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                />
                Active
              </label>

              <div className="flex gap-3 pt-2">
                <button type="button" className="btn btn-outline flex-1" onClick={() => setShowEditModal(false)} disabled={submitting}>
                  Cancel
                </button>
                <button type="submit" className="btn btn-primary flex-1" disabled={submitting}>
                  {submitting ? (
                    <span className="inline-flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" />Saving…</span>
                  ) : (
                    'Update'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

