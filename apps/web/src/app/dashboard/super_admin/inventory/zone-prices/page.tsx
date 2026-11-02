'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Download, Loader2, RefreshCw, Search } from 'lucide-react';
import { toast } from 'react-hot-toast';

type ZonePrice = { price: number; varies: boolean };
type ZoneInfo = { id: string; name: string; key: 'prime' | 'urban' };
type CategoryInfo = { name: string; icon: string };
type ServiceRow = {
  id: string;
  name: string;
  category: string;
  prices: Record<string, Record<string, ZonePrice>>;
};
type PlanRow = { label: string; semi?: ZonePrice; full?: ZonePrice; other?: ZonePrice };
type PriceSection = { name: string; periodic: boolean; plans: PlanRow[] };
const SHOW_ALL = '__all__';
type CarHit = { id: string; make: string; model: string; variant: string | null; vehicleClass: string | null };

function shortCategory(name: string) {
  return name.replace(/^car\s+/i, '').replace(/\s+service$/i, '').trim() || name;
}

function zoneLabel(zone: ZoneInfo) {
  return zone.key === 'prime' ? 'Prime zone' : 'Urban zone';
}

function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
}

function matchClassName(value: string | null, choices: string[]) {
  const raw = String(value || '').trim().toLowerCase();
  if (!raw) return '';
  const exact = choices.find((name) => name.toLowerCase() === raw);
  if (exact) return exact;
  if (raw === 'sedan' || raw === 'sedans') return choices.find((name) => name.toUpperCase() === 'SEDANS') || '';
  return choices.find((name) => name.toLowerCase().includes(raw) || raw.includes(name.toLowerCase())) || '';
}

function classMeta(name: string): { label: string; image: string } {
  const key = name.toUpperCase();
  if (key.includes('LUXURY')) return { label: 'Luxury', image: '/media/car-classes/luxury.png' };
  if (key.includes('COMPACT')) return { label: 'Compact SUV', image: '/media/car-classes/compact-suv.png' };
  if (key.includes('HATCH') && key.includes('PREMIUM')) return { label: 'Premium Hatchback', image: '/media/car-classes/premium-hatchback.png' };
  if (key.includes('HATCH')) return { label: 'Hatchback', image: '/media/car-classes/hatchback.png' };
  if (key.includes('SUV') || key.includes('MUV')) {
    return {
      label: key.includes('PREMIUM') ? 'Premium SUV' : 'SUV / MUV',
      image: key.includes('PREMIUM') ? '/media/car-classes/premium-suv.png' : '/media/car-classes/suv-muv.png',
    };
  }
  if (key.includes('SEDAN')) return { label: 'Sedan', image: '/media/car-classes/sedan.png' };
  return { label: name === 'DEFAULT' ? 'All classes' : name, image: '/media/car-classes/sedan.png' };
}

function planRank(label: string) {
  const key = label.toLowerCase();
  if (key.startsWith('basic')) return 0;
  if (key.startsWith('standard')) return 1;
  if (key.startsWith('general')) return 2;
  if (key.startsWith('premium')) return 3;
  return 4;
}

function splitPlan(name: string) {
  const semi = /semi\s*synthetic/i.test(name);
  const full = /fully\s*synthetic/i.test(name);
  const label = name.replace(/\s*\((semi|fully)\s*synthetic\)/i, '').trim() || name;
  return { group: semi ? 'semi' as const : full ? 'full' as const : 'other' as const, label };
}

function PriceCell({ cell }: { cell?: ZonePrice }) {
  if (!cell) return <span className="whitespace-nowrap text-gray-300">—</span>;
  return <span className={`whitespace-nowrap ${cell.varies ? 'text-orange-600' : ''}`}>{money(cell.price)}</span>;
}

type ExportLine = {
  zone: string;
  zoneKey: string;
  carClass: string;
  category: string;
  service: string;
  semi?: ZonePrice;
  full?: ZonePrice;
  other?: ZonePrice;
};

const EXPORT_HEADERS = ['Zone', 'Car class', 'Category', 'Service', 'Semi Synthetic (INR)', 'Fully Synthetic (INR)', 'Price (INR)', 'Note'];

function exportAmount(cell?: ZonePrice) {
  return cell ? Math.round(cell.price) : '';
}

function exportNote(line: ExportLine) {
  const parts: string[] = [];
  if (line.semi?.varies) parts.push('Semi: workshops differ');
  if (line.full?.varies) parts.push('Fully: workshops differ');
  if (line.other?.varies) parts.push('workshops differ');
  return parts.join('; ');
}

function exportCells(line: ExportLine): Array<string | number> {
  return [
    line.zone,
    line.carClass,
    line.category,
    line.service,
    exportAmount(line.semi),
    exportAmount(line.full),
    exportAmount(line.other),
    exportNote(line),
  ];
}

function csvEscape(value: string | number) {
  const text = String(value ?? '');
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function downloadBlob(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function pdfSafe(value: string | number) {
  return String(value ?? '').replace(/[^\x20-\x7E]/g, ' ');
}

async function writeZonePriceExport(format: 'csv' | 'xlsx' | 'pdf', filename: string, title: string, lines: ExportLine[]) {
  const rows = lines.map(exportCells);
  if (format === 'csv') {
    const body = [EXPORT_HEADERS, ...rows].map((row) => row.map(csvEscape).join(',')).join('\n');
    downloadBlob(`${filename}.csv`, new Blob([`\uFEFF${body}\n`], { type: 'text/csv;charset=utf-8' }));
    return;
  }
  if (format === 'xlsx') {
    const XLSX = await import('xlsx');
    const sheet = XLSX.utils.aoa_to_sheet([EXPORT_HEADERS, ...rows]);
    sheet['!cols'] = [16, 20, 22, 32, 22, 24, 14, 32].map((wch) => ({ wch }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, 'Zone prices');
    const bytes = XLSX.write(book, { bookType: 'xlsx', type: 'array' }) as ArrayBuffer;
    downloadBlob(
      `${filename}.xlsx`,
      new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    );
    return;
  }
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const columns = [
    { x: 8, w: 28, label: 'Zone' },
    { x: 36, w: 32, label: 'Car class' },
    { x: 68, w: 34, label: 'Category' },
    { x: 102, w: 62, label: 'Service' },
    { x: 164, w: 28, label: 'Semi (INR)' },
    { x: 192, w: 28, label: 'Fully (INR)' },
    { x: 220, w: 22, label: 'Price' },
    { x: 242, w: 46, label: 'Note' },
  ];
  const clip = (value: string | number, width: number) => {
    const text = pdfSafe(value);
    const max = Math.max(4, Math.floor(width / 1.7));
    return text.length > max ? `${text.slice(0, max - 3)}...` : text;
  };
  const drawHeader = () => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(clip(title, 160), 8, 12);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(100);
    doc.text(`${lines.length} rows`, 8, 17);
    doc.setTextColor(20);
    doc.setFont('helvetica', 'bold');
    columns.forEach((column) => doc.text(column.label, column.x, 24));
    doc.setDrawColor(226);
    doc.line(8, 26, 289, 26);
    doc.setFont('helvetica', 'normal');
  };
  let y = 31;
  drawHeader();
  rows.forEach((row) => {
    if (y > 200) {
      doc.addPage();
      drawHeader();
      y = 31;
    }
    row.forEach((value, index) => {
      const column = columns[index];
      doc.text(clip(value, column.w), column.x, y);
    });
    y += 5;
  });
  doc.save(`${filename}.pdf`);
}

export default function ZonePricesPage() {
  const [zones, setZones] = useState<ZoneInfo[]>([]);
  const [classes, setClasses] = useState<string[]>([]);
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [services, setServices] = useState<ServiceRow[]>([]);
  const [availableZones, setAvailableZones] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [carClass, setCarClass] = useState('');
  const [category, setCategory] = useState('');
  const [zoneId, setZoneId] = useState('');
  const [modelQuery, setModelQuery] = useState('');
  const [pickedModel, setPickedModel] = useState('');
  const [modelHits, setModelHits] = useState<CarHit[]>([]);
  const [modelOpen, setModelOpen] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exporting, setExporting] = useState('');
  const modelRef = useRef<HTMLDivElement | null>(null);
  const exportRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/inventory/zone-prices', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Could not load zone prices');
      const nextZones: ZoneInfo[] = json.zones || [];
      setZones(nextZones);
      setClasses(json.classes || []);
      setCategories(json.categories || []);
      setServices(json.services || []);
      setAvailableZones(json.available_zones || []);
      setZoneId((current) => (
        current && nextZones.some((zone) => zone.id === current)
          ? current
          : nextZones.find((zone) => zone.key === 'prime')?.id || nextZones[0]?.id || ''
      ));
    } catch (error: any) {
      toast.error(error?.message || 'Could not load zone prices');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const classChoices = classes.filter((name) => name !== 'DEFAULT');

  useEffect(() => {
    const q = modelQuery.trim();
    if (q.length < 2 || q === pickedModel) {
      if (q.length < 2) setModelHits([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/car-models/search?q=${encodeURIComponent(q)}`);
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const models = Array.isArray(json?.models) ? json.models : [];
        setModelHits(models.map((car: any) => ({
          id: String(car.id),
          make: String(car.make || ''),
          model: String(car.model || car.model_name || ''),
          variant: car.variant ? String(car.variant) : null,
          vehicleClass: car.vehicleClass ?? car.class ?? null,
        })));
        setModelOpen(true);
      } catch {
        if (!cancelled) setModelHits([]);
      }
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [modelQuery, pickedModel]);

  useEffect(() => {
    const onDoc = (event: MouseEvent) => {
      if (modelRef.current && !modelRef.current.contains(event.target as Node)) setModelOpen(false);
      if (exportRef.current && !exportRef.current.contains(event.target as Node)) setExportOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, []);

  const pickModel = (car: CarHit) => {
    const label = [car.make, car.model].filter(Boolean).join(' ');
    setModelQuery(label);
    setPickedModel(label);
    setModelOpen(false);
    const matched = matchClassName(car.vehicleClass, classChoices);
    if (!matched) {
      toast.error(car.vehicleClass ? `No price class for ${car.vehicleClass}` : 'This car has no class');
      return;
    }
    setCarClass(matched);
  };

  useEffect(() => {
    const choices = classes.filter((name) => name !== 'DEFAULT');
    if (!choices.length) return;
    setCarClass((current) => (
      current && choices.includes(current)
        ? current
        : choices.find((name) => name === 'HATCHBACK') || choices[0]
    ));
  }, [classes]);

  const activeZone = zones.find((zone) => zone.id === zoneId) || zones[0];

  const visibleCategories = useMemo(() => {
    if (!activeZone || !carClass) return categories;
    return categories.filter((item) => services.some((service) => (
      service.category === item.name && service.prices?.[activeZone.id]?.[carClass]
    )));
  }, [categories, services, activeZone, carClass]);

  useEffect(() => {
    if (!visibleCategories.length) return;
    setCategory((current) => (
      current === SHOW_ALL || (current && visibleCategories.some((item) => item.name === current))
        ? current
        : visibleCategories.find((item) => /periodic/i.test(item.name))?.name || visibleCategories[0].name
    ));
  }, [visibleCategories]);

  const sections = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!activeZone || !carClass) return [] as PriceSection[];
    const names = category === SHOW_ALL
      ? visibleCategories.map((item) => item.name)
      : category ? [category] : [];
    const next: PriceSection[] = [];
    for (const name of names) {
      const map = new Map<string, PlanRow>();
      for (const service of services) {
        if (service.category !== name) continue;
        if (needle && !service.name.toLowerCase().includes(needle) && !service.category.toLowerCase().includes(needle)) continue;
        const cell = service.prices?.[activeZone.id]?.[carClass];
        if (!cell) continue;
        const split = splitPlan(service.name);
        const row = map.get(split.label) || { label: split.label };
        row[split.group] = cell;
        map.set(split.label, row);
      }
      const plans = [...map.values()].sort((a, b) => planRank(a.label) - planRank(b.label) || a.label.localeCompare(b.label));
      if (!plans.length) continue;
      next.push({
        name,
        periodic: /periodic/i.test(name) && plans.some((row) => row.semi || row.full),
        plans,
      });
    }
    return next;
  }, [services, activeZone, carClass, category, query, visibleCategories]);

  const showAll = category === SHOW_ALL;
  const categoryLabel = showAll ? 'All services' : shortCategory(category || 'Service');
  const selectedClass = classMeta(carClass || 'HATCHBACK');

  const buildExportLines = (scope: 'selection' | 'all') => {
    const zoneList = scope === 'all' ? zones : activeZone ? [activeZone] : [];
    const classList = (scope === 'all' ? classChoices : carClass ? [carClass] : []).filter((name) => name !== 'DEFAULT');
    const categoryName = scope === 'selection' && category && category !== SHOW_ALL ? category : '';
    const needle = scope === 'selection' ? query.trim().toLowerCase() : '';
    const map = new Map<string, ExportLine>();
    for (const service of services) {
      const serviceCategory = service.category || 'Other';
      if (categoryName && serviceCategory !== categoryName) continue;
      if (needle && !service.name.toLowerCase().includes(needle) && !serviceCategory.toLowerCase().includes(needle)) continue;
      const split = splitPlan(service.name);
      for (const zone of zoneList) {
        for (const cls of classList) {
          const cell = service.prices?.[zone.id]?.[cls];
          if (!cell) continue;
          const key = `${zone.id}|${cls}|${serviceCategory}|${split.label}`;
          const row = map.get(key) || {
            zone: zoneLabel(zone),
            zoneKey: zone.key,
            carClass: classMeta(cls).label,
            category: shortCategory(serviceCategory),
            service: split.label,
          };
          row[split.group] = cell;
          map.set(key, row);
        }
      }
    }
    const categoryRank = (name: string) => {
      const index = categories.findIndex((item) => shortCategory(item.name) === name);
      return index < 0 ? 99 : index;
    };
    const classRank = (label: string) => {
      const index = classChoices.findIndex((name) => classMeta(name).label === label);
      return index < 0 ? 99 : index;
    };
    return [...map.values()].sort((a, b) =>
      (a.zoneKey === 'prime' ? 0 : 1) - (b.zoneKey === 'prime' ? 0 : 1)
      || classRank(a.carClass) - classRank(b.carClass)
      || categoryRank(a.category) - categoryRank(b.category)
      || planRank(a.service) - planRank(b.service)
      || a.service.localeCompare(b.service),
    );
  };

  const runExport = async (scope: 'selection' | 'all', format: 'csv' | 'xlsx' | 'pdf') => {
    const lines = buildExportLines(scope);
    if (!lines.length) {
      toast.error(scope === 'selection' ? 'Nothing to export for this selection' : 'No zone prices to export');
      return;
    }
    const stamp = new Date().toISOString().slice(0, 10);
    const selectionName = [
      activeZone ? zoneLabel(activeZone) : 'zone',
      selectedClass.label,
      categoryLabel,
    ].join(' ');
    const title = scope === 'all'
      ? 'Zone prices - all zones, classes and services'
      : `Zone prices - ${selectionName}${query.trim() ? ` - search ${query.trim()}` : ''}`;
    const filename = `zone-prices-${scope === 'all' ? 'all' : selectionName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}-${stamp}`;
    setExporting(`${scope}-${format}`);
    try {
      await writeZonePriceExport(format, filename, title, lines);
      toast.success(`Exported ${lines.length} rows`);
      setExportOpen(false);
    } catch (error: any) {
      toast.error(error?.message || 'Could not export');
    } finally {
      setExporting('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Zone Prices</h1>
            <p className="mt-1 text-sm text-gray-500">Pick a zone, then a car class, then a service.</p>
          </div>
          <button type="button" onClick={() => void load()} className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700">
            <RefreshCw className="h-4 w-4" />
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="flex min-h-[30vh] items-center justify-center gap-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading prices…
          </div>
        ) : zones.length === 0 ? (
          <div className="rounded-xl border bg-white p-6 text-sm text-gray-600">
            Prime or Urban zone was not found.
            {availableZones.length ? ` Zones on file: ${availableZones.join(', ')}.` : ''}
          </div>
        ) : (
          <>
            <section className="mb-3">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Zone</h2>
              <div className="flex items-center gap-3">
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-3">
                  {zones.map((zone) => {
                    const selected = activeZone?.id === zone.id;
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        onClick={() => setZoneId(zone.id)}
                        className={`rounded-xl border px-3 py-2 text-left text-sm font-extrabold ${selected ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-900'}`}
                      >
                        {zoneLabel(zone)}
                      </button>
                    );
                  })}
                </div>
                <div ref={modelRef} className="relative w-52 shrink-0 sm:w-60">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={modelQuery}
                    onChange={(event) => {
                      setModelQuery(event.target.value);
                      setPickedModel('');
                      setModelOpen(true);
                    }}
                    onFocus={() => {
                      if (modelHits.length) setModelOpen(true);
                    }}
                    placeholder="Car model, e.g. Rapid"
                    className="w-full rounded-xl border bg-white py-2 pl-9 pr-3 text-sm"
                  />
                  {modelOpen && modelHits.length > 0 ? (
                    <div className="absolute right-0 z-30 mt-1 max-h-72 w-72 overflow-auto rounded-xl border bg-white py-1 shadow-lg">
                      {modelHits.map((car) => (
                        <button
                          key={`${car.id}-${car.variant || ''}`}
                          type="button"
                          onClick={() => pickModel(car)}
                          className="block w-full px-3 py-2 text-left hover:bg-blue-50"
                        >
                          <div className="text-sm font-semibold text-gray-900">
                            {car.make} {car.model}{car.variant ? ` (${car.variant})` : ''}
                          </div>
                          <div className="text-xs text-gray-500">{car.vehicleClass || 'Class not set'}</div>
                        </button>
                      ))}
                    </div>
                  ) : null}
                </div>
              </div>
            </section>

            <section className="mb-3">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Car class</h2>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7">
                {classChoices.map((name) => {
                  const meta = classMeta(name);
                  const selected = carClass === name;
                  return (
                    <button
                      key={name}
                      type="button"
                      onClick={() => setCarClass(name)}
                      className={`flex flex-col items-center rounded-2xl border bg-white px-2 py-2 text-center text-gray-900 ${selected ? 'border-blue-600 ring-2 ring-blue-200 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}
                    >
                      <img src={meta.image} alt="" className="h-16 w-full object-contain" />
                      <span className="mt-1 text-xs font-extrabold leading-tight">{meta.label}</span>
                    </button>
                  );
                })}
              </div>
            </section>

            <section>
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Service</h2>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 md:grid-cols-6">
                <button
                  type="button"
                  onClick={() => setCategory(SHOW_ALL)}
                  className={`rounded-3xl border bg-white p-3 text-center ${showAll ? 'border-blue-300 ring-2 ring-blue-200/70 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}
                >
                  <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50 text-xs font-extrabold text-blue-700">All</div>
                  <div className="mt-2 text-xs font-extrabold leading-tight text-gray-900">Show all</div>
                </button>
                {visibleCategories.map((item) => {
                  const selected = category === item.name;
                  return (
                    <button
                      key={item.name}
                      type="button"
                      onClick={() => setCategory(item.name)}
                      className={`rounded-3xl border bg-white p-3 text-center ${selected ? 'border-blue-300 ring-2 ring-blue-200/70 shadow-md' : 'border-gray-100 hover:border-gray-200'}`}
                    >
                      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-gray-50">
                        {item.icon ? (
                          <img src={item.icon} alt="" className="h-8 w-8 object-contain" style={{ mixBlendMode: 'darken' }} />
                        ) : (
                          <span className="text-xs font-bold text-gray-500">{shortCategory(item.name).slice(0, 2)}</span>
                        )}
                      </div>
                      <div className="mt-2 line-clamp-2 text-xs font-extrabold leading-tight text-gray-900">{shortCategory(item.name)}</div>
                    </button>
                  );
                })}
              </div>

            <div className="mt-4 rounded-2xl border bg-white">
              <div className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2.5">
                <div>
                  <div className="text-sm font-extrabold text-gray-900">
                    {categoryLabel} · {selectedClass.label}
                  </div>
                  <div className="text-xs text-gray-500">{activeZone ? zoneLabel(activeZone) : ''}</div>
                </div>
                <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
                <div className="relative" ref={exportRef}>
                  <button
                    type="button"
                    onClick={() => setExportOpen((open) => !open)}
                    className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-semibold text-gray-700"
                  >
                    <Download className="h-4 w-4" />
                    Export
                  </button>
                  {exportOpen ? (
                    <div className="absolute left-0 z-30 mt-2 w-72 rounded-xl border bg-white p-3 shadow-lg sm:left-auto sm:right-0">
                      <p className="text-[11px] font-bold uppercase tracking-wide text-gray-500">This selection</p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {activeZone ? zoneLabel(activeZone) : 'Zone'} · {selectedClass.label} · {categoryLabel}
                        {query.trim() ? ` · “${query.trim()}”` : ''}
                      </p>
                      <div className="mt-2 flex gap-2">
                        {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
                          <button
                            key={`selection-${format}`}
                            type="button"
                            disabled={!!exporting}
                            onClick={() => void runExport('selection', format)}
                            className="rounded-lg bg-gray-900 px-2.5 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                          >
                            {exporting === `selection-${format}` ? '…' : format === 'xlsx' ? 'Excel' : format.toUpperCase()}
                          </button>
                        ))}
                      </div>
                      <p className="mt-3 text-[11px] font-bold uppercase tracking-wide text-gray-500">Everything</p>
                      <p className="mt-0.5 text-xs text-gray-500">Prime and Urban, every class and service.</p>
                      <div className="mt-2 flex gap-2">
                        {(['csv', 'xlsx', 'pdf'] as const).map((format) => (
                          <button
                            key={`all-${format}`}
                            type="button"
                            disabled={!!exporting}
                            onClick={() => void runExport('all', format)}
                            className="rounded-lg border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-bold text-gray-800 disabled:opacity-50"
                          >
                            {exporting === `all-${format}` ? '…' : format === 'xlsx' ? 'Excel' : format.toUpperCase()}
                          </button>
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>
                <label className="relative w-full sm:w-56">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="Search service"
                    className="w-full rounded-lg border bg-white py-2 pl-9 pr-3 text-sm"
                  />
                </label>
                </div>
              </div>
              <div className="overflow-hidden rounded-b-2xl text-[12px] leading-4">
              {sections.length === 0 ? (
                <p className="px-4 py-8 text-center text-gray-500">
                  No price for {selectedClass.label} in {categoryLabel.toLowerCase()}.
                </p>
              ) : sections.map((section, index) => (
                <div key={section.name} className={showAll && index > 0 ? 'border-t' : ''}>
                  {showAll && !section.periodic ? (
                    <div className="bg-gray-50 px-3 py-1.5 font-bold uppercase tracking-wide text-gray-500">
                      {shortCategory(section.name)}
                    </div>
                  ) : null}
                  {section.periodic ? (
                    <table className="w-full">
                      <thead className="bg-gray-50 text-left font-bold uppercase tracking-wide text-gray-500">
                        <tr>
                          <th className="px-3 py-1.5">{showAll ? shortCategory(section.name) : 'Service'}</th>
                          <th className="w-40 px-3 py-1.5">Semi Synthetic</th>
                          <th className="w-40 px-3 py-1.5">Fully Synthetic</th>
                        </tr>
                      </thead>
                      <tbody>
                        {section.plans.map((row) => (
                          <tr key={row.label} className="border-t">
                            <td className="px-3 py-1.5 font-semibold text-gray-900">{row.label}</td>
                            <td className="px-3 py-1.5 font-semibold text-gray-900"><PriceCell cell={row.semi} /></td>
                            <td className="px-3 py-1.5 font-semibold text-gray-900"><PriceCell cell={row.full} /></td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  ) : (
                    <div className="divide-y">
                      {section.plans.map((row) => (
                        <div key={row.label} className="flex items-baseline justify-between gap-10 px-3 py-1.5">
                          <div className="font-semibold text-gray-900">{row.label}</div>
                          <div className="font-semibold text-gray-900"><PriceCell cell={row.semi || row.full || row.other} /></div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              </div>
            </div>
            </section>
          </>
        )}
      </div>
    </div>
  );
}
