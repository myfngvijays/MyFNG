'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, RefreshCw, Search } from 'lucide-react';
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

function shortCategory(name: string) {
  return name.replace(/^car\s+/i, '').replace(/\s+service$/i, '').trim() || name;
}

function zoneLabel(zone: ZoneInfo) {
  return zone.key === 'prime' ? 'Prime zone' : 'Urban zone';
}

function money(value: number) {
  return `₹${Math.round(value).toLocaleString('en-IN')}`;
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
  if (!cell) return <span className="text-gray-300">—</span>;
  return (
    <span>
      {money(cell.price)}
      {cell.varies ? <span className="ml-1.5 text-[11px] font-medium text-amber-700">workshops differ</span> : null}
    </span>
  );
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
      current && visibleCategories.some((item) => item.name === current)
        ? current
        : visibleCategories.find((item) => /periodic/i.test(item.name))?.name || visibleCategories[0].name
    ));
  }, [visibleCategories]);

  const plans = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const map = new Map<string, PlanRow>();
    if (!activeZone || !carClass || !category) return [];
    for (const service of services) {
      if (service.category !== category) continue;
      if (needle && !service.name.toLowerCase().includes(needle) && !service.category.toLowerCase().includes(needle)) continue;
      const cell = service.prices?.[activeZone.id]?.[carClass];
      if (!cell) continue;
      const split = splitPlan(service.name);
      const row = map.get(split.label) || { label: split.label };
      row[split.group] = cell;
      map.set(split.label, row);
    }
    return [...map.values()].sort((a, b) => planRank(a.label) - planRank(b.label) || a.label.localeCompare(b.label));
  }, [services, activeZone, carClass, category, query]);

  const periodic = /periodic/i.test(category) && plans.some((row) => row.semi || row.full);
  const selectedClass = classMeta(carClass || 'HATCHBACK');

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
            <section className="mb-5">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Zone</h2>
              <div className="grid grid-cols-2 gap-3">
                {zones.map((zone) => {
                  const selected = activeZone?.id === zone.id;
                  return (
                    <button
                      key={zone.id}
                      type="button"
                      onClick={() => setZoneId(zone.id)}
                      className={`rounded-2xl border px-4 py-3 text-left text-base font-extrabold ${selected ? 'border-blue-600 bg-blue-600 text-white shadow-sm' : 'border-gray-200 bg-white text-gray-900'}`}
                    >
                      {zoneLabel(zone)}
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="mb-5">
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

            <section className="mb-5">
              <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Service</h2>
              <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 md:grid-cols-6">
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
            </section>

            <section className="overflow-hidden rounded-2xl border bg-white">
              <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3">
                <div>
                  <div className="text-sm font-extrabold text-gray-900">
                    {shortCategory(category || 'Service')} · {selectedClass.label}
                  </div>
                  <div className="text-xs text-gray-500">{activeZone ? zoneLabel(activeZone) : ''}</div>
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
              {plans.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-gray-500">
                  No price for {selectedClass.label} in {shortCategory(category || 'this service')}.
                </p>
              ) : periodic ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-left text-xs font-bold uppercase tracking-wide text-gray-500">
                      <tr>
                        <th className="px-4 py-3">Service</th>
                        <th className="px-4 py-3">Semi Synthetic</th>
                        <th className="px-4 py-3">Fully Synthetic</th>
                      </tr>
                    </thead>
                    <tbody>
                      {plans.map((row) => (
                        <tr key={row.label} className="border-t">
                          <td className="px-4 py-3 font-semibold text-gray-900">{row.label}</td>
                          <td className="px-4 py-3 font-semibold text-gray-900"><PriceCell cell={row.semi} /></td>
                          <td className="px-4 py-3 font-semibold text-gray-900"><PriceCell cell={row.full} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="divide-y">
                  {plans.map((row) => (
                    <div key={row.label} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="font-semibold text-gray-900">{row.label}</div>
                      <div className="font-semibold text-gray-900"><PriceCell cell={row.semi || row.full || row.other} /></div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </div>
    </div>
  );
}
