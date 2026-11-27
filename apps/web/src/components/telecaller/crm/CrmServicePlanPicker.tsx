'use client';

import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, Loader2, Search, X, ListChecks } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type CrmServiceItem = {
  id: string;
  name: string;
  description?: string | null;
  category: string;
};

type ChecklistTpl = {
  title?: string;
  points?: number;
  items: string[];
};

type Props = {
  selectedIds: string[];
  onChange: (ids: string[]) => void;
  /** Telecaller drawer — tighter chips, list, search */
  compact?: boolean;
  title?: string;
  subtitle?: string;
  cityId?: string | null;
  workshopId?: string | null;
  vehicleClass?: string | null;
  modelId?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  /** Checked coupon. Card keeps the list price; the message uses the price after this discount. */
  couponCode?: string | null;
};

function inr(n: number) {
  return `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
}

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
  'CUSTOM',
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

function normalizeChecklistItems(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((it) => {
      if (typeof it === 'string') return it.trim();
      if (it && typeof it === 'object') {
        const o = it as Record<string, unknown>;
        return String(o.title || o.name || o.label || o.item || '').trim();
      }
      return '';
    })
    .filter(Boolean);
}

export default function CrmServicePlanPicker({
  selectedIds,
  onChange,
  compact = false,
  title = 'Service Types',
  subtitle = 'Pick by category — Periodic, AC, Brake, Engine, etc.',
  cityId,
  workshopId,
  vehicleClass,
  modelId,
  vehicleMake,
  vehicleModel,
  couponCode,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [allServices, setAllServices] = useState<CrmServiceItem[]>([]);
  const [checklists, setChecklists] = useState<Record<string, ChecklistTpl>>({});
  const [selectedCategory, setSelectedCategory] = useState('');
  const [oilType, setOilType] = useState<'semi' | 'full'>('semi');
  const [search, setSearch] = useState('');
  const [pointsModal, setPointsModal] = useState<{
    name: string;
    title?: string;
    items: string[];
  } | null>(null);
  const [mounted, setMounted] = useState(false);
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [priceLoading, setPriceLoading] = useState(false);
  const [couponPayable, setCouponPayable] = useState<{ total: number; subtotal: number } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

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
        const services = (rows || []).map((s: any) => ({
          id: String(s.id),
          name: String(s.name || ''),
          description: s.description,
          category: s.category_uuid
            ? categoryMap[String(s.category_uuid)] || 'OTHER SERVICES'
            : 'OTHER SERVICES',
        }));
        setAllServices(services);

        try {
          const ids = services.map((s) => s.id).filter(Boolean);
          if (ids.length) {
            const { data: tplRows, error: tplError } = await supabase
              .from('service_type_checklist_templates')
              .select('service_type_id, title, points, checklist_items')
              .in('service_type_id', ids);
            if (!cancelled && !tplError && tplRows) {
              const map: Record<string, ChecklistTpl> = {};
              (tplRows as any[]).forEach((r) => {
                const sid = String(r?.service_type_id || '');
                const items = normalizeChecklistItems(r?.checklist_items);
                if (sid && items.length) {
                  map[sid] = {
                    title: r?.title ? String(r.title) : undefined,
                    points: typeof r?.points === 'number' ? r.points : items.length,
                    items,
                  };
                }
              });
              setChecklists(map);
            }
          }
        } catch {
          /* checklist table optional */
        }
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

  // Only auto-jump to a selected service's category when no tab is chosen yet
  useEffect(() => {
    if (selectedCategory) return;
    if (!selectedIds.length || !categories.length) return;
    const preferred = categories.find((c) =>
      allServices.some((s) => selectedIds.includes(s.id) && s.category === c),
    );
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

  const priceIdsKey = servicesInCategory.map((s) => s.id).join(',');
  const canPrice = Boolean(
    cityId || workshopId || vehicleClass || modelId || (vehicleMake && vehicleModel),
  );

  useEffect(() => {
    const ids = priceIdsKey.split(',').filter(Boolean);
    if (!canPrice || ids.length === 0) {
      setPriceMap({});
      return;
    }
    let cancelled = false;
    (async () => {
      setPriceLoading(true);
      try {
        const res = await fetch('/api/telecaller/crm/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_type_ids: ids,
            city_id: cityId || null,
            workshop_id: workshopId || null,
            vehicle_class: vehicleClass || null,
            model_id: modelId || null,
            vehicle_make: vehicleMake || null,
            vehicle_model: vehicleModel || null,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const next: Record<string, number> = {};
        const items = Array.isArray(json?.quote?.line_items) ? json.quote.line_items : [];
        items.forEach((item: { id?: string; price?: number }) => {
          const price = Number(item?.price || 0);
          if (item?.id && price > 0) next[String(item.id)] = price;
        });
        setPriceMap(next);
      } catch {
        if (!cancelled) setPriceMap({});
      } finally {
        if (!cancelled) setPriceLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [priceIdsKey, canPrice, cityId, workshopId, vehicleClass, modelId, vehicleMake, vehicleModel]);

  const selectedKey = selectedIds.join(',');
  useEffect(() => {
    const code = String(couponCode || '').trim();
    const ids = selectedKey.split(',').filter(Boolean);
    if (!code || !canPrice || ids.length === 0) {
      setCouponPayable(null);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/telecaller/crm/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_type_ids: ids,
            city_id: cityId || null,
            workshop_id: workshopId || null,
            vehicle_class: vehicleClass || null,
            model_id: modelId || null,
            vehicle_make: vehicleMake || null,
            vehicle_model: vehicleModel || null,
            coupon_code: code,
          }),
        });
        const json = await res.json().catch(() => ({}));
        if (cancelled) return;
        const subtotal = Number(json?.quote?.subtotal || 0);
        const total = Number(json?.quote?.total || 0);
        const discount = Number(json?.quote?.discount || 0);
        if (discount > 0 && total >= 0 && subtotal > 0) setCouponPayable({ total, subtotal });
        else setCouponPayable(null);
      } catch {
        if (!cancelled) setCouponPayable(null);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedKey, couponCode, canPrice, cityId, workshopId, vehicleClass, modelId, vehicleMake, vehicleModel]);

  const payableFor = (id: string, listPrice: number) => {
    if (!couponPayable || !selectedIds.includes(id) || listPrice <= 0 || couponPayable.subtotal <= 0) {
      return null;
    }
    if (selectedIds.length === 1) return couponPayable.total;
    return Math.max(0, Math.round(listPrice * (couponPayable.total / couponPayable.subtotal)));
  };

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

  const openPoints = (service: CrmServiceItem, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const tpl = checklists[service.id];
    if (!tpl?.items?.length) return;
    setPointsModal({
      name: service.name,
      title: tpl.title,
      items: tpl.items,
    });
  };

  const selectedChips = useMemo(() => {
    return selectedIds
      .map((id) => allServices.find((s) => s.id === id))
      .filter(Boolean) as CrmServiceItem[];
  }, [selectedIds, allServices]);

  return (
    <div className={compact ? 'space-y-1.5' : 'space-y-2'}>
      {title ? (
        <div>
          <label className="block text-xs sm:text-sm font-medium text-text-body">
            {title}
          </label>
          {subtitle ? <p className="mt-0.5 text-[11px] sm:text-xs text-gray-500">{subtitle}</p> : null}
        </div>
      ) : null}

      {selectedChips.length > 0 && !compact ? (
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
            {couponPayable && String(couponCode || '').trim() ? (
              <p className="text-[11px] font-bold text-[#023D95]">
                WhatsApp amount after {String(couponCode).trim().toUpperCase()}: {inr(couponPayable.total)}
              </p>
            ) : null}
          </div>
      ) : !compact ? (
        <p className="text-[11px] text-gray-500">No services selected</p>
      ) : null}

      {loading ? (
        <div className={`flex justify-center ${compact ? 'py-3' : 'py-8'}`}>
          <Loader2 className={`animate-spin text-brand-primary ${compact ? 'h-5 w-5' : 'h-6 w-6'}`} />
        </div>
      ) : (
        <>
          {categories.length > 0 ? (
            <div
              className={`flex flex-wrap items-center gap-1.5 ${compact ? 'justify-between pb-0.5' : 'pb-1 -mx-1 px-1'}`}
            >
              <div className={`flex min-w-0 flex-1 overflow-x-auto ${compact ? 'gap-1' : 'gap-2'}`}>
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
                    className={`shrink-0 rounded-full border font-semibold transition ${
                      compact ? 'px-2 py-1 text-[11px]' : 'px-3 py-1.5 text-xs sm:text-sm'
                    } ${
                      active
                        ? 'border-brand-primary bg-brand-primary text-white'
                        : 'border-gray-300 bg-white text-gray-700 hover:border-brand-primary/40'
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
              {compact && selectedChips.length > 0 ? (
                <div className="flex max-w-[46%] shrink-0 flex-wrap items-center justify-end gap-0.5">
                  {selectedChips.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => toggle(s.id)}
                      className="inline-flex max-w-[7.5rem] items-center gap-0.5 truncate rounded-full border border-teal-500 bg-teal-600 px-1.5 py-0.5 text-[10px] font-semibold text-white shadow-sm hover:bg-teal-700"
                      title="Remove"
                    >
                      <span className="truncate">{s.name}</span>
                      <X className="h-2.5 w-2.5 shrink-0 opacity-70" />
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

          {!compact ? (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search in ${titleCaseCat(selectedCategory) || 'services'}…`}
              className="input w-full text-xs sm:text-sm pl-9"
            />
          </div>
          ) : null}

          {isPeriodicCategory ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-gray-600">Engine Oil:</span>
              <div className="inline-flex rounded-lg border border-gray-300 bg-white p-0.5">
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

          <div
            className={`overflow-y-auto rounded-lg border-2 border-gray-300 bg-white ${
              compact ? 'max-h-36' : 'max-h-56'
            }`}
          >
          <div
            className={`grid gap-1.5 p-1.5 ${
              compact
                ? 'grid-cols-2 md:grid-cols-3 xl:grid-cols-4'
                : 'grid-cols-1 sm:grid-cols-2'
            }`}
          >
            {servicesInCategory.length === 0 ? (
              <p className="text-xs sm:text-sm text-gray-500 sm:col-span-2 py-4 text-center">
                No plans in this category
              </p>
            ) : (
              servicesInCategory.map((service) => {
                const selected = selectedIds.includes(service.id);
                const tpl = checklists[service.id];
                const pointsCount = tpl?.points || tpl?.items?.length || 0;
                const listPrice = Number(priceMap[service.id] || 0);
                const payable = payableFor(service.id, listPrice);
                const showDeal = payable != null && payable < listPrice;
                return (
                  <div
                    key={service.id}
                    className={`flex flex-col gap-1.5 rounded-lg border p-2.5 transition ${
                      selected
                        ? 'border-brand-primary bg-blue-50/50'
                        : 'border-gray-300 hover:bg-gray-50'
                    }`}
                  >
                    <label className="flex cursor-pointer items-start gap-2 sm:gap-3">
                      <input
                        type="checkbox"
                        checked={selected}
                        onChange={() => toggle(service.id)}
                        className="mt-0.5 shrink-0 sm:mt-1"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex min-w-0 items-center gap-1.5 text-xs font-medium text-text-heading sm:text-sm">
                            <span className="min-w-0">{service.name}</span>
                            {selected ? (
                              <Check className="h-3.5 w-3.5 shrink-0 text-brand-primary" />
                            ) : null}
                          </div>
                          <div className="shrink-0 text-right leading-tight">
                            {priceLoading && !listPrice ? (
                              <span className="text-[11px] font-semibold text-slate-400">…</span>
                            ) : listPrice > 0 ? (
                              <>
                                <div className="text-sm font-black text-[#023D95]">
                                  {inr(showDeal ? payable : listPrice)}
                                </div>
                                {showDeal ? (
                                  <div className="text-[10px] font-semibold text-slate-400 line-through">
                                    {inr(listPrice)}
                                  </div>
                                ) : null}
                              </>
                            ) : null}
                          </div>
                        </div>
                        {service.description ? (
                          <div className="mt-0.5 line-clamp-2 pr-2 text-xs text-text-body sm:text-sm">
                            {service.description}
                          </div>
                        ) : null}
                      </div>
                    </label>
                    {tpl?.items?.length ? (
                      <button
                        type="button"
                        onClick={(e) => openPoints(service, e)}
                        className="inline-flex items-center justify-center gap-1.5 self-start rounded-lg border border-[#023D95]/25 bg-white px-2.5 py-1.5 text-[11px] font-bold text-[#023D95] hover:bg-blue-50"
                      >
                        <ListChecks className="h-3.5 w-3.5" />
                        View all points{pointsCount ? ` (${pointsCount})` : ''}
                      </button>
                    ) : null}
                  </div>
                );
              })
            )}
          </div>
          </div>
        </>
      )}

      {mounted &&
        pointsModal &&
        createPortal(
          <div className="fixed inset-0 z-[11000] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <button
              type="button"
              className="absolute inset-0 bg-black/50"
              aria-label="Close points"
              onClick={() => setPointsModal(null)}
            />
            <div className="relative z-10 flex max-h-[80vh] w-full sm:max-w-xl flex-col overflow-hidden rounded-t-2xl sm:rounded-2xl bg-white shadow-2xl">
              <div className="flex items-start justify-between gap-3 border-b px-4 py-3 sm:px-5">
                <div className="min-w-0">
                  <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">
                    Checkpoints
                  </p>
                  <h3 className="text-base font-black text-[#023D95] truncate">
                    {pointsModal.title || pointsModal.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {pointsModal.items.length} points included
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setPointsModal(null)}
                  className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3 sm:px-5">
                <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {pointsModal.items.map((item, idx) => (
                    <li
                      key={`${idx}-${item.slice(0, 24)}`}
                      className="flex items-start gap-2 rounded-lg bg-emerald-50/60 px-2.5 py-1.5 text-xs sm:text-sm text-slate-800"
                    >
                      <span className="mt-0.5 shrink-0 font-bold text-emerald-700">✔</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
