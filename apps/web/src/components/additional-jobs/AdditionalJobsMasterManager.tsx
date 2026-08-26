'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Search, Edit2, Trash2, ToggleLeft, ToggleRight, Loader2, Download, Upload, X, Save, Copy, MapPin, Car } from 'lucide-react';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import { createClient } from '@/lib/supabase/client';

type WorkshopOption = { id: string; name: string; city?: string | null; zone_id?: string | null };
type ZoneOption = { id: string; name: string };

type FuelType = 'PETROL' | 'DIESEL' | 'CNG';
const FUEL_TYPES: FuelType[] = ['PETROL', 'DIESEL', 'CNG'];

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
  hideHeading = false,
}: {
  mode: 'SUPER_ADMIN' | 'WORKSHOP_ADMIN' | 'WORKSHOP_SUPERVISOR';
  hideHeading?: boolean;
}) {
  const isSuperAdmin = mode === 'SUPER_ADMIN';
  const isSupervisor = mode === 'WORKSHOP_SUPERVISOR';
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

  // Zone list (super admin) - used for zone-wise apply in labour matrix
  const [zones, setZones] = useState<ZoneOption[]>([]);
  const [loadingZones, setLoadingZones] = useState(false);

  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editing, setEditing] = useState<Item | null>(null);

  // Labour Pricing (Workshop Pricing style) - Super Admin only
  const [labourZoneId, setLabourZoneId] = useState<string>('');
  const [labourWorkshopId, setLabourWorkshopId] = useState<string>(''); // '' none, 'ALL' bulk mode
  const [labourClass, setLabourClass] = useState<string>('DEFAULT');
  const [labourClasses, setLabourClasses] = useState<string[]>(['DEFAULT']);
  const [labourJobs, setLabourJobs] = useState<
    Array<{
      id: string;
      name: string;
      description: string | null;
      category: string | null;
      hsn_sac_code: string | null;
      oem_price: number;
      oes_price: number;
      tax_rate: number;
      unit: string;
      is_active: boolean;
      labour_price: number; // default fallback
    }>
  >([]);
  const [labourRates, setLabourRates] = useState<Record<string, Record<FuelType, string>>>({});
  const [labourLoading, setLabourLoading] = useState(false);
  const [labourSaving, setLabourSaving] = useState(false);
  const [labourBulkSaving, setLabourBulkSaving] = useState(false);

  const isLabourBulkMode = useMemo(() => labourWorkshopId === 'ALL' && Boolean(labourZoneId), [labourWorkshopId, labourZoneId]);

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

  const labourDisplayedJobs = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return labourJobs;
    return labourJobs.filter((j) => (j.name || '').toLowerCase().includes(q) || (j.category || '').toLowerCase().includes(q));
  }, [labourJobs, searchTerm]);

  useEffect(() => {
    fetchItems();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [includeInactive, includeGlobal, selectedWorkshopId]);

  useEffect(() => {
    if (isSuperAdmin) {
      fetchWorkshops();
      fetchZones();
      fetchLabourCarClasses();
    }
    if (isSupervisor) {
      fetchCarClassesForMatrix().then((classes) => {
        setLabourClasses(['DEFAULT', ...classes]);
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  async function fetchWorkshops() {
    try {
      setLoadingWorkshops(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('workshops')
        .select('id, name, city, zone_id')
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

  async function fetchZones() {
    try {
      setLoadingZones(true);
      const supabase = createClient();
      const { data, error } = await supabase
        .from('zones')
        .select('id, name')
        .eq('is_active', true)
        .order('name', { ascending: true })
        .limit(500);
      if (error) throw error;
      setZones((data || []) as any);
    } catch (e) {
      console.error('Error fetching zones:', e);
      setZones([]);
    } finally {
      setLoadingZones(false);
    }
  }

  async function fetchCarClassesForMatrix(): Promise<string[]> {
    try {
      const supabase = createClient();
      const { data, error } = await supabase.from('car_models').select('class').eq('is_active', true).limit(5000);
      if (error) throw error;
      const unique = Array.from(
        new Set(
          (data || [])
            .map((r: any) => String(r?.class || '').trim())
            .filter((v: string) => v && v.toLowerCase() !== 'null')
        )
      ).sort((a, b) => a.localeCompare(b));
      return unique;
    } catch (e) {
      console.error('Error fetching car classes:', e);
      // conservative fallback
      return ['Hatchback', 'Sedan', 'SUV', 'MUV', 'Luxury'];
    }
  }

  async function fetchLabourCarClasses() {
    const classes = await fetchCarClassesForMatrix();
    setLabourClasses(['DEFAULT', ...classes]);
  }

  const labourWorkshopsInZone = useMemo(() => {
    if (!labourZoneId) return [];
    return workshops.filter((w) => String(w.zone_id || '') === labourZoneId);
  }, [labourZoneId, workshops]);

  const labourPricingActive = useMemo(() => {
    if (isSuperAdmin) {
      return Boolean(labourZoneId && labourWorkshopId && labourClass);
    }
    if (isSupervisor) {
      return Boolean(viewerWorkshopId && labourClass);
    }
    return false;
  }, [isSuperAdmin, isSupervisor, labourZoneId, labourWorkshopId, labourClass, viewerWorkshopId]);

  useEffect(() => {
    if (!isSuperAdmin) return;
    // Reset on zone change
    setLabourWorkshopId('');
    setLabourJobs([]);
    setLabourRates({});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [labourZoneId]);

  useEffect(() => {
    if (isSuperAdmin) {
      if (!labourZoneId || !labourWorkshopId || !labourClass) {
        setLabourJobs([]);
        setLabourRates({});
        return;
      }
      fetchLabourPricing();
    } else if (isSupervisor) {
      if (!viewerWorkshopId || !labourClass) {
        setLabourJobs([]);
        setLabourRates({});
        return;
      }
      fetchLabourPricing();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin, isSupervisor, labourZoneId, labourWorkshopId, labourClass, viewerWorkshopId]);

  async function fetchLabourPricing() {
    setLabourLoading(true);
    try {
      const supabase = createClient();
      const classKey = labourClass || 'DEFAULT';

      let q = supabase
        .from('additional_jobs_master')
        .select('id, name, description, category, hsn_sac_code, oem_price, oes_price, tax_rate, unit, is_active, labour_price')
        .is('deleted_at', null)
        .order('name', { ascending: true })
        .limit(5000);

      if (isSupervisor) {
        // Supervisor: only their workshop
        q = q.eq('workshop_id', viewerWorkshopId);
      } else if (labourWorkshopId === 'ALL') {
        q = q.is('workshop_id', null);
      } else {
        q = q.eq('workshop_id', labourWorkshopId);
      }

      const { data: jobs, error: jobErr } = await q;
      if (jobErr) throw jobErr;

      const list = (jobs || []).map((j: any) => ({
        id: String(j.id),
        name: String(j.name || ''),
        description: (j.description ?? null) as string | null,
        category: (j.category ?? null) as string | null,
        hsn_sac_code: (j.hsn_sac_code ?? null) as string | null,
        oem_price: Number(j.oem_price ?? 0),
        oes_price: Number(j.oes_price ?? 0),
        tax_rate: Number(j.tax_rate ?? 18),
        unit: String(j.unit || 'job'),
        is_active: j.is_active !== false,
        labour_price: Number(j.labour_price ?? 0),
      }));
      setLabourJobs(list);

      const ids = list.map((x) => x.id);
      const nextRates: Record<string, Record<FuelType, string>> = {};
      for (const id of ids) nextRates[id] = { PETROL: '', DIESEL: '', CNG: '' };

      if (ids.length) {
        const { data: lr, error: lrErr } = await supabase
          .from('additional_jobs_master_labour_rates')
          .select('additional_job_id, fuel_type, car_class, labour_price')
          .in('additional_job_id', ids)
          .eq('car_class', classKey);
        if (lrErr) throw lrErr;

        for (const r of lr || []) {
          const jobId = String((r as any).additional_job_id || '').trim();
          const fuel = String((r as any).fuel_type || '').trim().toUpperCase() as FuelType;
          const price = Number((r as any).labour_price ?? 0);
          if (!jobId || !FUEL_TYPES.includes(fuel)) continue;
          nextRates[jobId] = nextRates[jobId] || { PETROL: '', DIESEL: '', CNG: '' };
          nextRates[jobId][fuel] = Number.isFinite(price) ? String(price) : '';
        }
      }

      setLabourRates(nextRates);
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to load labour pricing'}`);
      setLabourJobs([]);
      setLabourRates({});
    } finally {
      setLabourLoading(false);
    }
  }

  function setLabourCell(jobId: string, fuel: FuelType, value: string) {
    setLabourRates((prev) => ({
      ...prev,
      [jobId]: {
        ...(prev[jobId] || { PETROL: '', DIESEL: '', CNG: '' }),
        [fuel]: value,
      },
    }));
  }

  function buildLabourUpserts(jobIds: string[]) {
    const classKey = labourClass || 'DEFAULT';
    const rows: Array<{ additional_job_id: string; fuel_type: FuelType; car_class: string; labour_price: number }> = [];
    for (const jobId of jobIds) {
      const row = labourRates[jobId];
      if (!row) continue;
      for (const fuel of FUEL_TYPES) {
        const raw = (row[fuel] ?? '').toString().trim();
        if (raw === '') continue;
        const n = Number(raw);
        if (!Number.isFinite(n) || n < 0) throw new Error(`Invalid labour for ${fuel}`);
        rows.push({ additional_job_id: jobId, fuel_type: fuel, car_class: classKey, labour_price: n });
      }
    }
    return rows;
  }

  async function updateDefaultLabourFromPetrol(jobIds: string[]) {
    // Rule: default labour = petrol labour (when provided)
    const tasks: Array<() => Promise<{ ok: boolean; id: string; error?: string }>> = [];
    for (const id of jobIds) {
      const raw = (labourRates?.[id]?.PETROL ?? '').toString().trim();
      if (raw === '') continue;
      const n = Number(raw);
      if (!Number.isFinite(n) || n < 0) continue;
      tasks.push(async () => {
        try {
          const res = await fetch(`/api/additional-jobs-master/${id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ labour_price: n }),
          });
          const body = await res.json().catch(() => ({}));
          if (!res.ok) return { ok: false, id, error: body?.error || 'Failed to update default labour' };
          return { ok: true, id };
        } catch (e: any) {
          return { ok: false, id, error: e?.message || 'Failed to update default labour' };
        }
      });
    }
    if (!tasks.length) return;
    const results = await runWithConcurrency(tasks, 6);
    const failed = results.filter((r) => !r.ok);
    if (failed.length) {
      console.warn('Some default labour updates failed:', failed.slice(0, 3));
    }
  }

  async function saveLabourPricingForWorkshop() {
    if (!labourPricingActive) return;
    if (labourWorkshopId === 'ALL') return;
    try {
      setLabourSaving(true);
      const upserts = buildLabourUpserts(labourJobs.map((j) => j.id));
      if (!upserts.length) return alert('No values to save. Enter at least one rate.');
      const supabase = createClient();
      const { error } = await supabase
        .from('additional_jobs_master_labour_rates')
        .upsert(upserts as any, { onConflict: 'additional_job_id,fuel_type,car_class' });
      if (error) throw error;
      await updateDefaultLabourFromPetrol(labourJobs.map((j) => j.id));
      alert('Labour pricing saved.');
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to save'}`);
    } finally {
      setLabourSaving(false);
    }
  }

  async function applyLabourPricingToAllWorkshopsInZone(opts?: { skipConfirm?: boolean; mode?: 'OVERWRITE' | 'FILL_MISSING' }) {
    if (!labourPricingActive) return;
    if (labourWorkshopId !== 'ALL') return;
    if (!labourJobs.length) return;

    if (!opts?.skipConfirm) {
      const confirmed = confirm(`Apply these labour rates to ALL ${labourWorkshopsInZone.length} workshops in this zone?`);
      if (!confirmed) return;
    }

    const mode =
      opts?.mode ??
      (confirm('Overwrite existing workshop labour matrix rates?\n\nOK = Overwrite all\nCancel = Fill missing only') ? 'OVERWRITE' : 'FILL_MISSING');

    try {
      setLabourBulkSaving(true);
      // First persist template to global rows so server can read source matrix
      const upserts = buildLabourUpserts(labourJobs.map((j) => j.id));
      if (!upserts.length) {
        alert('No values to apply. Enter at least one rate.');
        return;
      }
      const supabase = createClient();
      const { error: upErr } = await supabase
        .from('additional_jobs_master_labour_rates')
        .upsert(upserts as any, { onConflict: 'additional_job_id,fuel_type,car_class' });
      if (upErr) throw upErr;
      await updateDefaultLabourFromPetrol(labourJobs.map((j) => j.id));

      // Single-call bulk apply to avoid long loading & failed fetch
      const payloadItems = labourJobs.map((j) => ({
        source_additional_job_id: j.id,
        name: j.name,
        description: j.description ?? null,
        category: j.category ?? null,
        hsn_sac_code: j.hsn_sac_code ?? null,
        unit: j.unit ?? 'job',
        oem_price: j.oem_price ?? 0,
        oes_price: j.oes_price ?? 0,
        tax_rate: j.tax_rate ?? 18,
        is_active: j.is_active !== false,
        default_labour: j.labour_price ?? 0,
        petrol_labour: (labourRates?.[j.id]?.PETROL ?? '').toString(),
        diesel_labour: (labourRates?.[j.id]?.DIESEL ?? '').toString(),
        cng_labour: (labourRates?.[j.id]?.CNG ?? '').toString(),
      }));

      const res = await fetch('/api/additional-jobs-master/labour-rates/apply-zone-bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          zone_id: labourZoneId,
          car_class: labourClass,
          mode,
          items: payloadItems,
        }),
      });

      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(body?.error || body?.details || 'Failed to apply to zone');
      }

      alert(
        `Applied to zone.\nInserted job rows: ${body?.result?.inserted_job_rows ?? 0}\nUpdated job rows: ${
          body?.result?.updated_job_rows ?? 0
        }\nLabour rate rows: ${body?.result?.labour_rate_rows ?? 0}`
      );
    } catch (e: any) {
      alert(`Error: ${e?.message || 'Failed to apply'}`);
    } finally {
      setLabourBulkSaving(false);
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

    // If using the labour pricing panel (zone/workshop/class selected for super admin, or class selected for supervisor),
    // export labour rates CSV (PETROL/DIESEL/CNG) for the currently loaded rate list.
    if (labourPricingActive) {
      const headers = [
        'zone_id',
        'workshop_id',
        'car_class',
        'additional_job_id',
        'name',
        'description',
        'category',
        'hsn_sac_code',
        'unit',
        'oem_price',
        'oes_price',
        'tax_rate',
        'is_active',
        'default_labour',
        'petrol_labour',
        'diesel_labour',
        'cng_labour',
      ];

      const rows = (labourJobs || []).map((j) => [
        labourZoneId,
        labourWorkshopId,
        labourClass,
        j.id,
        j.name,
        j.description || '',
        j.category || '',
        j.hsn_sac_code || '',
        j.unit || 'job',
        j.oem_price ?? 0,
        j.oes_price ?? 0,
        j.tax_rate ?? 18,
        (j.is_active !== false ? 'true' : 'false'),
        j.labour_price ?? 0,
        (labourRates?.[j.id]?.PETROL ?? '').toString(),
        (labourRates?.[j.id]?.DIESEL ?? '').toString(),
        (labourRates?.[j.id]?.CNG ?? '').toString(),
      ]);

      const csv = buildCsv(headers, rows);
      const date = new Date().toISOString().slice(0, 10);
      let filename: string;
      if (isSuperAdmin) {
        const zoneName = zones.find((z) => z.id === labourZoneId)?.name || 'zone';
        const workshopLabel =
          labourWorkshopId === 'ALL'
            ? 'all-workshops'
            : workshops.find((w) => w.id === labourWorkshopId)?.name || 'workshop';
        const className = labourClass === 'DEFAULT' ? 'default' : labourClass;
        filename = `additional-jobs-labour-${zoneName}-${className}-${workshopLabel}-${date}.csv`;
      } else {
        const className = labourClass === 'DEFAULT' ? 'default' : labourClass;
        filename = `additional-jobs-labour-${className}-${date}.csv`;
      }
      filename = filename.replace(/\s+/g, '-').replace(/[^a-zA-Z0-9._-]/g, '');
      downloadTextFile(csv, filename);
      setCsvInfo(`Downloaded ${rows.length} rows.`);
      return;
    }

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
      // Labour pricing CSV import (context-aware, no separate option)
      if (labourPricingActive) {
        const text = await file.text();
        const grid = parseCsv(text);
        if (!grid.length) throw new Error('CSV is empty.');

        const header = grid[0].map((h) => (h || '').trim().toLowerCase());
        const col = (name: string) => header.indexOf(name);

        const idxZone = col('zone_id');
        const idxWorkshop = col('workshop_id');
        const idxClass = col('car_class');
        const idxJobId = col('additional_job_id');
        const idxName = col('name');
        const idxDescription = col('description');
        const idxCategory = col('category');
        const idxHsn = col('hsn_sac_code');
        const idxUnit = col('unit');
        const idxOem = col('oem_price');
        const idxOes = col('oes_price');
        const idxTax = col('tax_rate');
        const idxActive = col('is_active');
        const idxDefaultLabour = col('default_labour');
        const idxPetrol = col('petrol_labour');
        const idxDiesel = col('diesel_labour');
        const idxCng = col('cng_labour');

        if (idxJobId === -1) throw new Error('CSV must contain header: additional_job_id');
        if (idxPetrol === -1 && idxDiesel === -1 && idxCng === -1 && idxDefaultLabour === -1) {
          throw new Error('CSV must contain at least one header: petrol_labour, diesel_labour, cng_labour, default_labour');
        }

        const expectedZone = isSuperAdmin ? (labourZoneId || '') : '';
        const expectedWorkshop = isSuperAdmin ? (labourWorkshopId || '') : (viewerWorkshopId || '');
        const expectedClass = labourClass || 'DEFAULT';

        const rows = grid.slice(1).filter((r) => r.some((x) => (x || '').trim() !== ''));
        if (!rows.length) throw new Error('CSV has no data rows.');

        const allowedJobIds = new Set((labourJobs || []).map((j) => j.id));
        const nextRates: Record<string, Record<FuelType, string>> = { ...labourRates };
        const errors: string[] = [];
        const jobUpdatePayloadById = new Map<string, any>();

        for (let i = 0; i < rows.length; i++) {
          const r = rows[i];
          const rowNum = i + 2;

          if (isSuperAdmin && idxZone !== -1) {
            const z = (r[idxZone] || '').trim();
            if (z && z !== expectedZone) errors.push(`Row ${rowNum}: zone_id mismatch (file "${z}" vs selected "${expectedZone}")`);
          }
          if (idxWorkshop !== -1) {
            const w = (r[idxWorkshop] || '').trim();
            if (w && w !== expectedWorkshop) errors.push(`Row ${rowNum}: workshop_id mismatch (file "${w}" vs selected "${expectedWorkshop}")`);
          }
          if (idxClass !== -1) {
            const c = (r[idxClass] || '').trim();
            if (c && c !== expectedClass) errors.push(`Row ${rowNum}: car_class mismatch (file "${c}" vs selected "${expectedClass}")`);
          }

          const jobId = (r[idxJobId] || '').trim();
          if (!jobId) continue;
          if (!allowedJobIds.has(jobId)) {
            errors.push(`Row ${rowNum}: Unknown additional_job_id "${jobId}" for current selection`);
            continue;
          }

          const ensure = () => {
            if (!nextRates[jobId]) nextRates[jobId] = { PETROL: '', DIESEL: '', CNG: '' };
          };
          ensure();

          const parseCell = (raw: any) => {
            const s = (raw ?? '').toString().trim();
            if (s === '') return '';
            const n = Number(s);
            if (!Number.isFinite(n) || n < 0) return null;
            return String(n);
          };

          const patch: any = {};
          // Job details update (optional)
          if (idxName !== -1 && (r[idxName] || '').trim() !== '') patch.name = (r[idxName] || '').trim();
          if (idxDescription !== -1) {
            const v = (r[idxDescription] || '').trim();
            if (v !== '') patch.description = v;
          }
          if (idxCategory !== -1) {
            const v = (r[idxCategory] || '').trim();
            if (v !== '') patch.category = v;
          }
          if (idxHsn !== -1) {
            const v = (r[idxHsn] || '').trim();
            if (v !== '') patch.hsn_sac_code = v;
          }
          if (idxUnit !== -1) {
            const v = (r[idxUnit] || '').trim();
            if (v !== '') patch.unit = v;
          }
          const parseNumOpt = (raw: any) => {
            const s = (raw ?? '').toString().trim();
            if (s === '') return undefined;
            const n = Number(s);
            if (!Number.isFinite(n) || n < 0) return null;
            return n;
          };
          if (idxOem !== -1) {
            const v = parseNumOpt(r[idxOem]);
            if (v === null) errors.push(`Row ${rowNum}: invalid oem_price "${r[idxOem] || ''}"`);
            else if (v !== undefined) patch.oem_price = v;
          }
          if (idxOes !== -1) {
            const v = parseNumOpt(r[idxOes]);
            if (v === null) errors.push(`Row ${rowNum}: invalid oes_price "${r[idxOes] || ''}"`);
            else if (v !== undefined) patch.oes_price = v;
          }
          if (idxTax !== -1) {
            const v = parseNumOpt(r[idxTax]);
            if (v === null) errors.push(`Row ${rowNum}: invalid tax_rate "${r[idxTax] || ''}"`);
            else if (v !== undefined) patch.tax_rate = v;
          }
          if (idxActive !== -1 && (r[idxActive] || '').trim() !== '') {
            const v = (r[idxActive] || '').trim().toLowerCase();
            patch.is_active = v === 'true' || v === '1' || v === 'yes';
          }

          if (idxPetrol !== -1) {
            const v = parseCell(r[idxPetrol]);
            if (v === null) errors.push(`Row ${rowNum}: invalid petrol_labour "${r[idxPetrol] || ''}"`);
            else nextRates[jobId].PETROL = v;
          }
          if (idxDiesel !== -1) {
            const v = parseCell(r[idxDiesel]);
            if (v === null) errors.push(`Row ${rowNum}: invalid diesel_labour "${r[idxDiesel] || ''}"`);
            else nextRates[jobId].DIESEL = v;
          }
          if (idxCng !== -1) {
            const v = parseCell(r[idxCng]);
            if (v === null) errors.push(`Row ${rowNum}: invalid cng_labour "${r[idxCng] || ''}"`);
            else nextRates[jobId].CNG = v;
          }

          // Default labour rule: if petrol provided, default labour = petrol; else allow default_labour column
          if (idxPetrol !== -1) {
            const rawPetrol = (r[idxPetrol] ?? '').toString().trim();
            if (rawPetrol !== '') {
              const pn = Number(rawPetrol);
              if (Number.isFinite(pn) && pn >= 0) patch.labour_price = pn;
            }
          }
          if (patch.labour_price === undefined && idxDefaultLabour !== -1) {
            const v = parseNumOpt(r[idxDefaultLabour]);
            if (v === null) errors.push(`Row ${rowNum}: invalid default_labour "${r[idxDefaultLabour] || ''}"`);
            else if (v !== undefined) patch.labour_price = v;
          }

          if (Object.keys(patch).length) {
            const existing = jobUpdatePayloadById.get(jobId) || {};
            jobUpdatePayloadById.set(jobId, { ...existing, ...patch });
          }
        }

        if (errors.length) {
          throw new Error(errors.slice(0, 10).join('\n') + (errors.length > 10 ? `\n...and ${errors.length - 10} more` : ''));
        }

        // Apply additional job detail updates first (best-effort)
        if (jobUpdatePayloadById.size) {
          const tasks: Array<() => Promise<{ ok: boolean; id: string; error?: string }>> = [];
          for (const [id, payload] of jobUpdatePayloadById.entries()) {
            tasks.push(async () => {
              try {
                const res = await fetch(`/api/additional-jobs-master/${id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(payload),
                });
                const body = await res.json().catch(() => ({}));
                if (!res.ok) return { ok: false, id, error: body?.error || 'Failed to update job' };
                return { ok: true, id };
              } catch (e: any) {
                return { ok: false, id, error: e?.message || 'Failed to update job' };
              }
            });
          }
          const results = await runWithConcurrency(tasks, 6);
          const failed = results.filter((r) => !r.ok);
          if (failed.length) {
            throw new Error(failed[0]?.error || `Failed to update ${failed.length} job(s)`);
          }
        }

        setLabourRates(nextRates);

        // Persist immediately (like Workshop Pricing) for current scope
        if (isSuperAdmin && labourWorkshopId === 'ALL') {
          const confirmed = confirm(`Apply imported labour rates to ALL ${labourWorkshopsInZone.length} workshops in this zone?`);
          if (!confirmed) {
            setCsvInfo('Imported labour rates loaded. Click "Apply to All Workshops" when ready.');
            return;
          }
          const mode = confirm('Overwrite existing workshop labour matrix rates?\n\nOK = Overwrite all\nCancel = Fill missing only')
            ? 'OVERWRITE'
            : 'FILL_MISSING';
          await applyLabourPricingToAllWorkshopsInZone({ skipConfirm: true, mode });
        } else {
          await saveLabourPricingForWorkshop();
        }

        setCsvInfo('Import completed successfully.');
        return;
      }

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
    <div className={hideHeading ? 'w-full max-w-full min-w-0' : 'p-4 sm:p-6'}>
      <div className={`flex flex-col md:flex-row items-start md:items-center mb-5 gap-3 ${hideHeading ? 'justify-end' : 'justify-between'}`}>
        {!hideHeading ? (
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Additional Jobs Master</h1>
          <p className="text-gray-500">
            Create reusable additional jobs list (workshop-wise) for faster approvals & billing.
          </p>
        </div>
        ) : null}
        <div className="flex gap-2">
          <AdminPageRefresh
            onClick={() => {
              void fetchItems();
              if (isSuperAdmin) {
                void fetchWorkshops();
                void fetchZones();
              }
              if (labourPricingActive) void fetchLabourPricing();
            }}
            loading={loading || labourLoading}
          />
          {labourPricingActive && (
            <>
              {isSuperAdmin && isLabourBulkMode ? (
                <button
                  type="button"
                  onClick={() => applyLabourPricingToAllWorkshopsInZone()}
                  className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
                  disabled={labourBulkSaving || labourLoading || labourDisplayedJobs.length === 0}
                  title="Apply labour rates to all workshops in selected zone"
                >
                  {labourBulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
                  Apply to All ({labourWorkshopsInZone.length})
                </button>
              ) : (
                <button
                  type="button"
                  onClick={saveLabourPricingForWorkshop}
                  className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
                  disabled={labourSaving || labourLoading || labourDisplayedJobs.length === 0}
                  title="Save labour rates for selected workshop"
                >
                  {labourSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Changes
                </button>
              )}
            </>
          )}
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

      {/* Labour Pricing (Zone -> Workshop/ALL -> Car Class) for Super Admin, (Car Class) for Supervisor */}
      {(isSuperAdmin || isSupervisor) && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 sm:p-5 mb-5">
          <div className="flex flex-col lg:flex-row lg:items-end gap-3 lg:gap-4 justify-between">
            <div className={`grid grid-cols-1 ${isSuperAdmin ? 'md:grid-cols-3' : 'md:grid-cols-1'} gap-3 flex-1`}>
              {isSuperAdmin && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Zone</label>
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
                      <select
                        className="input w-full"
                        value={labourZoneId}
                        onChange={(e) => setLabourZoneId(e.target.value)}
                        disabled={loadingZones}
                      >
                        <option value="">{loadingZones ? 'Loading zones…' : '-- Select Zone --'}</option>
                        {zones.map((z) => (
                          <option key={z.id} value={z.id}>
                            {z.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Workshop</label>
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-gray-400" />
                      <select
                        className="input w-full"
                        value={labourWorkshopId}
                        onChange={(e) => setLabourWorkshopId(e.target.value)}
                        disabled={!labourZoneId}
                      >
                        <option value="">{labourZoneId ? '-- Select Workshop --' : '-- Select Zone First --'}</option>
                        {labourZoneId ? <option value="ALL">All Workshops (Zone)</option> : null}
                        {labourWorkshopsInZone.map((w) => (
                          <option key={w.id} value={w.id}>
                            {w.name}
                            {w.city ? ` (${w.city})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Car Class</label>
                <select
                  className="input w-full"
                  value={labourClass}
                  onChange={(e) => setLabourClass(e.target.value)}
                  disabled={isSuperAdmin ? !labourZoneId : false}
                >
                  {labourClasses.map((c) => (
                    <option key={c} value={c}>
                      {c === 'DEFAULT' ? 'Default (Base Class)' : c}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* buttons moved to header, to match Workshop Pricing look */}
          </div>

          {/* Rate List */}
          <div className="mt-4 border border-gray-100 rounded-lg overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="p-3 font-medium text-gray-600">Category</th>
                    <th className="p-3 font-medium text-gray-600">HSN/SAC</th>
                    <th className="p-3 font-medium text-gray-600 text-right">OEM</th>
                    <th className="p-3 font-medium text-gray-600 text-right">OES</th>
                    <th className="p-3 font-medium text-gray-600 text-right">Petrol Labour</th>
                    <th className="p-3 font-medium text-gray-600 text-right">Diesel Labour</th>
                    <th className="p-3 font-medium text-gray-600 text-right">CNG Labour</th>
                    <th className="p-3 font-medium text-gray-600 text-center">Tax %</th>
                    <th className="p-3 font-medium text-gray-600 text-center">Unit</th>
                    <th className="p-3 font-medium text-gray-600 text-center">Status</th>
                    <th className="p-3 font-medium text-gray-600 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(isSuperAdmin && (!labourZoneId || !labourWorkshopId)) || (isSupervisor && !viewerWorkshopId) ? (
                    <tr>
                      <td colSpan={12} className="p-6 text-center text-gray-500">
                        {isSuperAdmin ? 'Select Zone and Workshop to load rates.' : 'Select Car Class to load rates.'}
                      </td>
                    </tr>
                  ) : labourLoading ? (
                    <tr>
                      <td colSpan={12} className="p-6 text-center text-gray-500">
                        <span className="inline-flex items-center gap-2">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Loading…
                        </span>
                      </td>
                    </tr>
                  ) : labourDisplayedJobs.length === 0 ? (
                    <tr>
                      <td colSpan={12} className="p-6 text-center text-gray-500">
                        No jobs found for this selection.
                      </td>
                    </tr>
                  ) : (
                    labourDisplayedJobs.map((j) => (
                      <tr key={j.id} className="hover:bg-gray-50">
                        <td className="p-3">
                          <div className="font-semibold text-gray-900">{j.name}</div>
                          <div className="text-xs text-gray-500">{j.category || '-'}</div>
                        </td>
                        <td className="p-3 font-mono text-xs bg-gray-50 rounded w-fit">{j.hsn_sac_code || '-'}</td>
                        <td className="p-3 text-right font-medium">₹{Number(j.oem_price || 0).toFixed(0)}</td>
                        <td className="p-3 text-right font-medium">₹{Number(j.oes_price || 0).toFixed(0)}</td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            className="input w-28 text-right"
                            min="0"
                            step="1"
                            value={(labourRates?.[j.id]?.PETROL ?? '').toString()}
                            onChange={(e) => setLabourCell(j.id, 'PETROL', e.target.value)}
                            placeholder="—"
                            disabled={labourSaving || labourBulkSaving}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            className="input w-28 text-right"
                            min="0"
                            step="1"
                            value={(labourRates?.[j.id]?.DIESEL ?? '').toString()}
                            onChange={(e) => setLabourCell(j.id, 'DIESEL', e.target.value)}
                            placeholder="—"
                            disabled={labourSaving || labourBulkSaving}
                          />
                        </td>
                        <td className="p-3 text-right">
                          <input
                            type="number"
                            className="input w-28 text-right"
                            min="0"
                            step="1"
                            value={(labourRates?.[j.id]?.CNG ?? '').toString()}
                            onChange={(e) => setLabourCell(j.id, 'CNG', e.target.value)}
                            placeholder="—"
                            disabled={labourSaving || labourBulkSaving}
                          />
                        </td>
                        <td className="p-3 text-center">{Number(j.tax_rate || 0).toFixed(0)}%</td>
                        <td className="p-3 text-center text-gray-500">{j.unit || 'job'}</td>
                        <td className="p-3 text-center">
                          <span
                            className={`px-2 py-1 rounded-md text-xs font-medium ${
                              j.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}
                          >
                            {j.is_active !== false ? 'ACTIVE' : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {/* In bulk mode (global template), allow edit/toggle/delete; bulk apply will create workshop copies */}
                            <button
                              onClick={() =>
                                toggleActive({
                                  id: j.id,
                                  workshop_id: isSuperAdmin ? (labourWorkshopId === 'ALL' ? null : labourWorkshopId) : viewerWorkshopId,
                                  name: j.name,
                                  category: j.category,
                                  hsn_sac_code: j.hsn_sac_code,
                                  unit: j.unit,
                                  oem_price: j.oem_price,
                                  oes_price: j.oes_price,
                                  labour_price: j.labour_price,
                                  tax_rate: j.tax_rate,
                                  is_active: j.is_active,
                                } as any)
                              }
                              className="p-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                              title={j.is_active !== false ? 'Disable' : 'Enable'}
                            >
                              {j.is_active !== false ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                            </button>
                            <button
                              onClick={() =>
                                openEdit({
                                  id: j.id,
                                  workshop_id: isSuperAdmin ? (labourWorkshopId === 'ALL' ? null : labourWorkshopId) : viewerWorkshopId,
                                  name: j.name,
                                  description: null,
                                  category: j.category,
                                  hsn_sac_code: j.hsn_sac_code,
                                  unit: j.unit,
                                  oem_price: j.oem_price,
                                  oes_price: j.oes_price,
                                  labour_price: j.labour_price,
                                  tax_rate: j.tax_rate,
                                  is_active: j.is_active,
                                } as any)
                              }
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() =>
                                deleteItem({
                                  id: j.id,
                                  workshop_id: isSuperAdmin ? (labourWorkshopId === 'ALL' ? null : labourWorkshopId) : viewerWorkshopId,
                                  name: j.name,
                                  category: j.category,
                                  hsn_sac_code: j.hsn_sac_code,
                                  unit: j.unit,
                                  oem_price: j.oem_price,
                                  oes_price: j.oes_price,
                                  labour_price: j.labour_price,
                                  tax_rate: j.tax_rate,
                                  is_active: j.is_active,
                                } as any)
                              }
                              className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="text-xs text-gray-500 mt-2">
            CSV: Use <span className="font-medium">Import/Export CSV</span> button above — when Zone/Workshop/Class is selected, it exports/imports this fuel-wise labour table.
          </div>
        </div>
      )}

      {/* CSV Import/Export Modal */}
      {showCsvModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="p-5 border-b border-gray-100 flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-lg font-semibold text-gray-900">
                  {labourPricingActive ? 'Import / Export Labour Rates (CSV)' : 'Import / Export Additional Jobs (CSV)'}
                </div>
                <div className="text-sm text-gray-500 mt-1">
                  {labourPricingActive ? (
                    <>
                      {isSuperAdmin && (
                        <>
                          Scope: <span className="font-medium text-gray-700">{zones.find((z) => z.id === labourZoneId)?.name || 'Zone'}</span>
                          {' / '}
                          <span className="font-medium text-gray-700">
                            {labourWorkshopId === 'ALL'
                              ? `All Workshops (${labourWorkshopsInZone.length})`
                              : workshops.find((w) => w.id === labourWorkshopId)?.name || 'Workshop'}
                          </span>
                          {' / '}
                        </>
                      )}
                      <span className="font-medium text-gray-700">{labourClass}</span>
                    </>
                  ) : (
                    <>
                  Export will download the <span className="font-medium">currently visible list</span> (filters applied).
                    </>
                  )}
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
                  Rows:{' '}
                  <span className="font-medium text-gray-800">
                    {labourPricingActive ? labourDisplayedJobs.length : displayedItems.length}
                  </span>
                  {!(isSuperAdmin && labourPricingActive) && isSuperAdmin && selectedWorkshopId ? (
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
                <div className="text-sm font-medium text-gray-800 mb-1">
                  {labourPricingActive ? 'Upload CSV to set fuel-wise labour rates' : 'Upload CSV to create/update'}
                </div>
                <div className="text-xs text-gray-500 mb-2">
                  {labourPricingActive ? (
                    <>
                      Required header: <span className="font-mono">additional_job_id</span>. Use any of:{' '}
                      <span className="font-mono">petrol_labour</span>, <span className="font-mono">diesel_labour</span>,{' '}
                      <span className="font-mono">cng_labour</span>. (Blank cell = no change/empty override.)<br />
                      Tip: export first to get the exact IDs for this selection.
                    </>
                  ) : (
                    <>
                  Required header: <span className="font-mono">name</span>. If <span className="font-mono">id</span> is provided, the row updates that record; otherwise it creates new.
                  {isSuperAdmin ? (
                        <span>
                          {' '}
                          For scope, include <span className="font-mono">workshop_id</span> (blank = Global). If omitted, import uses selected workshop (if any) else Global.
                        </span>
                  ) : (
                    <span> Workshop users can only create/update their own workshop items.</span>
                      )}
                    </>
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

      {/* Filters (workshop roles only) */}
      {!isSuperAdmin && (
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
            <input type="checkbox" checked={includeGlobal} onChange={(e) => setIncludeGlobal(e.target.checked)} />
          Include Global
        </label>

        <label className="flex items-center gap-2 text-sm text-gray-700 select-none">
            <input type="checkbox" checked={includeInactive} onChange={(e) => setIncludeInactive(e.target.checked)} />
          Show Inactive
        </label>

          <button
            type="button"
            onClick={bulkAddSelectedToWorkshop}
            className="btn btn-primary"
            disabled={submitting}
            title="Bulk add selected global items to your workshop"
          >
            Bulk Add to Workshop
          </button>
      </div>
      )}

      {/* Table (workshop roles only, but hide if labour pricing is active) */}
      {!isSuperAdmin && !labourPricingActive && (
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
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
                <th className="p-4 font-medium text-gray-600">Name</th>
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
                    <td className="p-4">
                      <div className="font-semibold text-gray-900">{it.name}</div>
                      {it.description && <div className="text-xs text-gray-500 mt-0.5 line-clamp-1">{it.description}</div>}
                    </td>
                    <td className="p-4 text-gray-600">{it.category || '-'}</td>
                    <td className="p-4 font-mono text-xs bg-gray-50 rounded w-fit">{it.hsn_sac_code || '-'}</td>
                    <td className="p-4 text-right font-medium">₹{Number(it.oem_price || 0).toFixed(0)}</td>
                    <td className="p-4 text-right font-medium">₹{Number(it.oes_price || 0).toFixed(0)}</td>
                    <td className="p-4 text-right font-medium">₹{Number(it.labour_price || 0).toFixed(0)}</td>
                    <td className="p-4 text-center">{Number(it.tax_rate || 0).toFixed(0)}%</td>
                    <td className="p-4 text-center text-gray-500">{it.unit || 'job'}</td>
                    <td className="p-4 text-center">
                        <span
                          className={`px-2 py-1 rounded-md text-xs font-medium ${
                            it.is_active !== false ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                          }`}
                        >
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
                              {!it.workshop_id && (
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
      )}

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

