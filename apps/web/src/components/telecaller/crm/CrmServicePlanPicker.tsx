'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, Loader2, Search, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type CrmServiceItem = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
};

type Props = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  title?: string;
  subtitle?: string;
};

const CATEGORY_ORDER = [
  'PERIODIC',
  'ENGINE',
  'AC',
  'BATTERY',
  'BRAKE',
  'CLUTCH',
  'TYRE',
  'WHEEL',
  'DETAILING',
  'DENTING',
  'PAINTING',
  'ELECTRICAL',
  'SUSPENSION',
  'STEERING',
];

function titleCaseCat(c: string) {
  return String(c || '')
    .replace(/^CAR\s+/i, '')
    .replace(/\s+SERVICE$/i, '')
    .replace(/\s+SERVICES$/i, '')
    .split(' ')
    .map((w) => (w ? w.charAt(0) + w.slice(1).toLowerCase() : ''))
    .join(' ')
    .trim();
}

function getOilTypeForPlan(name: string, description = ''): 'semi' | 'full' | 'unknown' {
  const text = `${String(name || '')} ${String(description || '')}`.toLowerCase();
  const hasSemi =
    text.includes('semi synthetic') ||
    text.includes('semi-synthetic') ||
    text.includes('(semi)') ||
    /\bsemi\b/.test(text);
  const hasFull =
    text.includes('fully synthetic') ||
    text.includes('full synthetic') ||
    text.includes('(fully)') ||
    text.includes('(full)') ||
    /\bfully\b/.test(text);
  if (hasSemi && hasFull) return 'unknown';
  if (hasFull) return 'full';
  if (hasSemi) return 'semi';
  return 'unknown';
}

export default function CrmServicePlanPicker({
  selectedIds,
  onChange,
  title = 'Service Types',
  subtitle = 'Pick by category — Periodic, AC, Brake, Engine, etc.',
}: Props) {
  const [loading, setLoading] = useState(true);
  const [allServices, setAllServices] = useState<CrmServiceItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [oilType, setOilType] = useState<'semi' | 'full'>('semi');
  const [search, setSearch] = useState('');

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const supabase = createClient();
        const [{ data: cats }, { data: rows }] = await Promise.all([
          supabase.from('categories').select('uuid, category').order('category'),
          supabase
            .from('service_types')
            .select('id, name, description, category_uuid')
            .eq('is_active', true)
            .order('name'),
        ]);
        if (cancelled) return;
        const categoryMap: Record<string, string> = {};
        (cats || []).forEach((c: any) => {
          if (c.uuid && c.category) categoryMap[String(c.uuid)] = String(c.category).toUpperCase();
        });
        setAllServices(
          (rows || []).map((s: any) => ({
            id: String(s.id),
            name: String(s.name || ''),
            description: s.description,
            category: s.category_uuid
              ? categoryMap[String(s.category_uuid)] || 'OTHER SERVICES'
              : 'OTHER SERVICES',
          })),
        );
      } catch {
        if (!cancelled) setAllServices([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    const set = new Set<string>();
    allServices.forEach((s) => {
      if (s.category) set.add(s.category);
    });
    const arr = Array.from(set);
    arr.sort((a, b) => {
      const ia = CATEGORY_ORDER.findIndex((o) => a.includes(o));
      const ib = CATEGORY_ORDER.findIndex((o) => b.includes(o));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });
    return arr;
  }, [allServices]);

  useEffect(() => {
    if (!selectedCategory && categories.length) setSelectedCategory(categories[0]);
    else if (selectedCategory && categories.length && !categories.includes(selectedCategory)) {
      setSelectedCategory(categories[0]);
    }
  }, [categories, selectedCategory]);

  // Prefer category that already has a selected plan
  useEffect(() => {
    if (!selectedIds.length || !categories.length) return;
    const selectedCats = new Set(
      allServices.filter((s) => selectedIds.includes(s.id)).map((s) => s.category),
    );
    if (selectedCategory && selectedCats.has(selectedCategory)) return;
    const preferred = categories.find((c) => selectedCats.has(c));
    if (preferred) setSelectedCategory(preferred);
  }, [selectedIds, categories, allServices, selectedCategory]);

  const isPeriodicCategory = String(selectedCategory || '').toUpperCase().includes('PERIODIC');

  const servicesInCategory = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = allServices
      .filter((s) => !selectedCategory || s.category === selectedCategory)
      .filter((s) => {
        if (!isPeriodicCategory) return true;
        const oil = getOilTypeForPlan(s.name, s.description || '');
        if (oil === 'unknown') return true;
        return oil === oilType;
      })
      .filter((s) => !q || s.name.toLowerCase().includes(q));
    return [...list].sort((a, b) => {
      const sa = selectedIds.includes(a.id) ? 0 : 1;
      const sb = selectedIds.includes(b.id) ? 0 : 1;
      return sa - sb || a.name.localeCompare(b.name);
    });
  }, [allServices, selectedCategory, isPeriodicCategory, oilType, search, selectedIds]);

  const selectedByCategory = useMemo(() => {
    const map = new Map<string, CrmServiceItem[]>();
    selectedIds.forEach((id) => {
      const s = allServices.find((x) => x.id === id);
      if (!s) return;
      const key = s.category || 'OTHER SERVICES';
      const arr = map.get(key) || [];
      arr.push(s);
      map.set(key, arr);
    });
    return Array.from(map.entries()).sort((a, b) => {
      const ia = CATEGORY_ORDER.findIndex((o) => a[0].includes(o));
      const ib = CATEGORY_ORDER.findIndex((o) => b[0].includes(o));
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
    });
  }, [selectedIds, allServices]);

  const toggle = (id: string) => {
    if (selectedIds.includes(id)) onChange(selectedIds.filter((x) => x !== id));
    else onChange([...selectedIds, id]);
  };

  return (
    <div className="space-y-3 sm:space-y-4">
      {title ? (
        <div>
          <label className="block text-xs sm:text-sm font-medium text-text-body">
            {title} <span className="text-red-500">*</span>
          </label>
          {subtitle ? <p className="mt-0.5 text-[11px] sm:text-xs text-gray-500">{subtitle}</p> : null}
        </div>
      ) : null}

      {selectedByCategory.length > 0 ? (
        <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3 sm:p-4 space-y-2">
          <p className="text-xs sm:text-sm font-medium text-gray-600">
            Selected ({selectedIds.length})
          </p>
          {selectedByCategory.map(([cat, items]) => (
            <div key={cat}>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-blue-800/80 mb-1">
                {titleCaseCat(cat)}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => toggle(s.id)}
                    className="inline-flex items-center gap-1 px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm font-medium hover:bg-blue-200"
                    title="Remove"
                  >
                    {s.name}
                    <X className="w-3 h-3 opacity-70" />
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-500">
          No services selected yet — choose a category below
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-brand-primary" />
        </div>
      ) : (
        <>
          {categories.length > 0 ? (
            <div className="flex gap-2 overflow-x-auto pb-1 -mx-1 px-1">
              {categories.map((c) => {
                const active = c === selectedCategory;
                const count = selectedIds.filter(
                  (id) => allServices.find((s) => s.id === id)?.category === c,
                ).length;
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSelectedCategory(c)}
                    className={`shrink-0 rounded-full px-3 py-1.5 text-xs sm:text-sm font-semibold border transition ${
                      active
                        ? 'border-brand-primary bg-brand-primary text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:border-brand-primary/40'
                    }`}
                  >
                    {titleCaseCat(c)}
                    {count > 0 ? (
                      <span
                        className={`ml-1.5 inline-flex h-4 min-w-[1rem] items-center justify-center rounded-full px-1 text-[10px] ${
                          active ? 'bg-white/25 text-white' : 'bg-blue-100 text-blue-800'
                        }`}
                      >
                        {count}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}

          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search in ${titleCaseCat(selectedCategory) || 'services'}…`}
              className="input text-xs sm:text-sm pl-9"
            />
          </div>

          {isPeriodicCategory ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Engine Oil:</span>
              <div className="inline-flex rounded-lg border border-gray-200 bg-white p-0.5">
                <button
                  type="button"
                  onClick={() => setOilType('semi')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    oilType === 'semi' ? 'bg-brand-primary text-white' : 'text-gray-600'
                  }`}
                >
                  Semi Synthetic
                </button>
                <button
                  type="button"
                  onClick={() => setOilType('full')}
                  className={`rounded-md px-2.5 py-1 text-xs font-semibold ${
                    oilType === 'full' ? 'bg-brand-primary text-white' : 'text-gray-600'
                  }`}
                >
                  Fully Synthetic
                </button>
              </div>
            </div>
          ) : null}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-3">
            {servicesInCategory.length === 0 ? (
              <p className="text-xs sm:text-sm text-gray-500 sm:col-span-2 py-4 text-center">
                No plans in this category
              </p>
            ) : (
              servicesInCategory.map((service) => {
                const selected = selectedIds.includes(service.id);
                return (
                  <label
                    key={service.id}
                    className={`flex items-start gap-2 sm:gap-3 p-3 sm:p-4 border rounded-lg cursor-pointer transition ${
                      selected
                        ? 'border-brand-primary bg-blue-50/50'
                        : 'border-gray-200 hover:bg-gray-50'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selected}
                      onChange={() => toggle(service.id)}
                      className="mt-0.5 sm:mt-1 flex-shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-xs sm:text-sm text-text-heading flex items-center gap-1.5">
                        {service.name}
                        {selected ? <Check className="w-3.5 h-3.5 text-brand-primary shrink-0" /> : null}
                      </div>
                      {service.description ? (
                        <div className="text-xs sm:text-sm text-text-body mt-0.5 line-clamp-2">
                          {service.description}
                        </div>
                      ) : null}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
