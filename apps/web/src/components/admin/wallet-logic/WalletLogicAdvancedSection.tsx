'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Check, Layers, Plus, Search, Trash2, Wrench } from 'lucide-react';
import type { WalletCoreRules, WalletLogicFullSettings, WalletServiceOverride } from '@/lib/wallet-config';
import { computeUsageCapFromRules, formatUsageLimitLabel } from '@/lib/wallet-config';

type ServiceOption = {
  id: string;
  name: string;
  base_price: number;
  category_id: string;
  category_name: string;
  category_sequence: number;
};

type CategoryOption = {
  id: string;
  name: string;
  count: number;
  sequence: number;
};

type ServiceGroup = {
  category_id: string;
  category_name: string;
  category_sequence: number;
  services: ServiceOption[];
};

type Props = {
  settings: WalletLogicFullSettings;
  onChange: (next: WalletLogicFullSettings) => void;
  globalRules: WalletCoreRules;
};

function ToggleMini({
  label,
  checked,
  onChange,
  disabled,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const id = React.useId();
  return (
    <label
      htmlFor={id}
      className={`flex items-center justify-between gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2 ${disabled ? 'opacity-50' : ''}`}
    >
      <span className="text-xs font-semibold text-gray-700">{label}</span>
      <span className="relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center">
        <input
          id={id}
          type="checkbox"
          className="peer sr-only"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="absolute inset-0 rounded-full bg-gray-300 transition-colors peer-checked:bg-violet-600" />
        <span className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform peer-checked:translate-x-4" />
      </span>
    </label>
  );
}

export default function WalletLogicAdvancedSection({ settings, onChange, globalRules }: Props) {
  const [services, setServices] = useState<ServiceOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loadingServices, setLoadingServices] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState('');
  const [selectedServiceIds, setSelectedServiceIds] = useState<string[]>([]);

  const loadServices = React.useCallback(async () => {
    setLoadingServices(true);
    setLoadError(null);
    try {
      const res = await fetch('/api/super_admin/wallet-logic/service-types');
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Services load nahi ho payi');
      setServices(json.services || []);
      setCategories(json.categories || []);
      if (!(json.services || []).length) {
        setLoadError('Koi active service nahi mili. Pehle Service Packages / service_types check karo.');
      }
    } catch (e: any) {
      setServices([]);
      setCategories([]);
      setLoadError(e?.message || 'Services load nahi ho payi');
    } finally {
      setLoadingServices(false);
    }
  }, []);

  useEffect(() => {
    void loadServices();
  }, [loadServices]);

  const overrides = settings.service_overrides || [];

  const availableServices = useMemo(() => {
    const used = new Set(overrides.map((row) => row.service_type_id));
    const q = search.trim().toLowerCase();
    return services.filter((svc) => {
      if (used.has(svc.id)) return false;
      if (selectedCategoryId && svc.category_id !== selectedCategoryId) return false;
      if (!q) return true;
      return (
        svc.name.toLowerCase().includes(q) ||
        svc.category_name.toLowerCase().includes(q)
      );
    });
  }, [services, overrides, search, selectedCategoryId]);

  const groupedAvailableServices = useMemo(() => {
    const map = new Map<string, ServiceGroup>();
    for (const svc of availableServices) {
      const existing = map.get(svc.category_id);
      if (existing) {
        existing.services.push(svc);
      } else {
        map.set(svc.category_id, {
          category_id: svc.category_id,
          category_name: svc.category_name,
          category_sequence: svc.category_sequence,
          services: [svc],
        });
      }
    }
    return Array.from(map.values()).sort((a, b) => {
      if (a.category_sequence !== b.category_sequence) return a.category_sequence - b.category_sequence;
      return a.category_name.localeCompare(b.category_name);
    });
  }, [availableServices]);

  const groupedOverrides = useMemo(() => {
    const serviceById = new Map(services.map((svc) => [svc.id, svc]));
    const map = new Map<string, { category_name: string; category_sequence: number; rows: WalletServiceOverride[] }>();

    for (const row of overrides) {
      const svc = serviceById.get(row.service_type_id);
      const categoryId = svc?.category_id || 'other-services';
      const categoryName = svc?.category_name || 'Other Services';
      const categorySequence = svc?.category_sequence ?? 9999;
      const bucket = map.get(categoryId) || { category_name: categoryName, category_sequence: categorySequence, rows: [] };
      bucket.rows.push(row);
      map.set(categoryId, bucket);
    }

    return Array.from(map.entries())
      .sort((a, b) => {
        if (a[1].category_sequence !== b[1].category_sequence) {
          return a[1].category_sequence - b[1].category_sequence;
        }
        return a[1].category_name.localeCompare(b[1].category_name);
      })
      .map(([categoryId, value]) => ({
        category_id: categoryId,
        category_name: value.category_name,
        rows: value.rows.sort((a, b) => a.service_name.localeCompare(b.service_name)),
      }));
  }, [overrides, services]);

  const selectedServices = useMemo(
    () => services.filter((svc) => selectedServiceIds.includes(svc.id)),
    [services, selectedServiceIds],
  );

  const patchSettings = (patch: Partial<WalletLogicFullSettings>) => {
    onChange({ ...settings, ...patch });
  };

  const patchOverride = (id: string, patch: Partial<WalletServiceOverride>) => {
    patchSettings({
      service_overrides: overrides.map((row) => (row.id === id ? { ...row, ...patch } : row)),
    });
  };

  const toggleServiceSelection = (serviceId: string) => {
    setSelectedServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId],
    );
  };

  const selectAllVisible = () => {
    setSelectedServiceIds(availableServices.map((svc) => svc.id));
  };

  const selectGroupServices = (group: ServiceGroup) => {
    const ids = group.services.map((svc) => svc.id);
    setSelectedServiceIds((prev) => Array.from(new Set([...prev, ...ids])));
  };

  const clearSelection = () => {
    setSelectedServiceIds([]);
  };

  const addSelectedOverrides = () => {
    if (!selectedServices.length) return;
    const base = Date.now();
    const newRows: WalletServiceOverride[] = selectedServices.map((svc, index) => ({
      id: `svc-${base}-${index}`,
      service_type_id: svc.id,
      service_name: svc.name,
      active: true,
      use_global: false,
      wallet_allowed: true,
      service_usage_mode: globalRules.service_usage_mode,
      service_usage_percent: globalRules.service_usage_percent,
      service_usage_amount: globalRules.service_usage_amount,
      membership_cashback_rate_percent: settings.global.membership_cashback_rate_percent,
      membership_cashback_max: settings.global.membership_cashback_max,
    }));
    patchSettings({
      service_overrides: [...overrides, ...newRows],
    });
    setSelectedServiceIds([]);
    setSearch('');
    setSelectedCategoryId('');
  };

  const removeOverride = (id: string) => {
    patchSettings({ service_overrides: overrides.filter((row) => row.id !== id) });
  };

  return (
    <div className="space-y-5">
      <section className="rounded-3xl border bg-white p-5 sm:p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 rounded-2xl bg-indigo-100 text-indigo-700 flex items-center justify-center">
              <Layers className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-bold !text-gray-900 text-lg">Advanced — Per Service Rules</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                Har service ke liye alag wallet %, cashback aur allow/block set karo. Default rules ke upar apply hoga.
              </p>
            </div>
          </div>
          <ToggleMini
            label="Enable advanced rules"
            checked={Boolean(settings.advanced_enabled)}
            onChange={(v) => patchSettings({ advanced_enabled: v })}
          />
        </div>

        {!settings.advanced_enabled ? (
          <div className="rounded-2xl border border-dashed border-indigo-200 bg-indigo-50/60 px-4 py-6 text-sm text-indigo-900">
            Advanced mode band hai — sab services par Default (Web) wale rules lagenge. Upar toggle ON karke shuru karo.
          </div>
        ) : (
          <>
            <div className="rounded-2xl border border-gray-100 bg-gray-50/80 p-4 mb-5">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
                <p className="text-sm font-semibold text-gray-900">Nayi service rule add karo</p>
                <div className="flex items-center gap-2">
                  {!loadingServices ? (
                    <span className="text-xs font-semibold text-gray-500">{services.length} services loaded</span>
                  ) : null}
                  <button
                    type="button"
                    onClick={() => void loadServices()}
                    className="text-xs font-semibold text-indigo-600 hover:text-indigo-800"
                  >
                    Reload
                  </button>
                </div>
              </div>

              {loadError ? (
                <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  {loadError}
                </div>
              ) : null}

              <div className="relative mb-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Service ya category search karo — Periodic, AC, Detailing..."
                  className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm"
                />
              </div>

              {categories.length > 0 ? (
                <div className="mb-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedCategoryId('')}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                      !selectedCategoryId
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-200'
                    }`}
                  >
                    All ({services.length})
                  </button>
                  {categories.map((cat) => (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => setSelectedCategoryId(cat.id === selectedCategoryId ? '' : cat.id)}
                      className={`rounded-full px-3 py-1.5 text-xs font-bold border transition ${
                        selectedCategoryId === cat.id
                          ? 'bg-indigo-600 text-white border-indigo-600'
                          : 'bg-white text-gray-700 border-gray-200 hover:border-indigo-200'
                      }`}
                    >
                      {cat.name} ({cat.count})
                    </button>
                  ))}
                </div>
              ) : null}

              {availableServices.length > 0 ? (
                <div className="mb-3 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={selectAllVisible}
                    className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                  >
                    Select all visible ({availableServices.length})
                  </button>
                  {selectedServiceIds.length > 0 ? (
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-500 hover:bg-gray-50"
                    >
                      Clear selection
                    </button>
                  ) : null}
                  {selectedServiceIds.length > 0 ? (
                    <span className="text-xs font-bold text-indigo-700">
                      {selectedServiceIds.length} selected
                    </span>
                  ) : null}
                </div>
              ) : null}

              <div className="rounded-xl border border-gray-200 bg-white max-h-72 overflow-y-auto mb-3">
                {loadingServices ? (
                  <div className="px-4 py-6 text-sm text-gray-500 text-center">Services load ho rahi hain…</div>
                ) : groupedAvailableServices.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-gray-500 text-center">
                    {search.trim() || selectedCategoryId
                      ? 'Is filter ke liye koi service nahi mili.'
                      : 'Sab services par rule lag chuka hai ya list khali hai.'}
                  </div>
                ) : (
                  groupedAvailableServices.map((group) => (
                    <div key={group.category_id}>
                      <div className="sticky top-0 z-10 flex items-center justify-between gap-2 border-b border-indigo-100 bg-indigo-50/95 px-4 py-2">
                        <span className="text-[11px] font-black uppercase tracking-wider text-indigo-800">
                          {group.category_name}
                        </span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => selectGroupServices(group)}
                            className="text-[10px] font-bold text-indigo-700 hover:text-indigo-900"
                          >
                            Select all
                          </button>
                          <span className="text-[10px] font-semibold text-indigo-600">{group.services.length}</span>
                        </div>
                      </div>
                      {group.services.map((svc) => {
                        const selected = selectedServiceIds.includes(svc.id);
                        return (
                          <button
                            key={svc.id}
                            type="button"
                            onClick={() => toggleServiceSelection(svc.id)}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left border-b border-gray-50 transition ${
                              selected ? 'bg-indigo-50 text-indigo-900' : 'hover:bg-gray-50 text-gray-800'
                            }`}
                          >
                            <span
                              className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border ${
                                selected
                                  ? 'border-indigo-600 bg-indigo-600 text-white'
                                  : 'border-gray-300 bg-white text-transparent'
                              }`}
                            >
                              <Check className="h-3.5 w-3.5" strokeWidth={3} />
                            </span>
                            <span className="text-sm font-medium truncate flex-1">{svc.name}</span>
                            {svc.base_price > 0 ? (
                              <span className="text-xs text-gray-500 shrink-0">₹{svc.base_price.toLocaleString('en-IN')}</span>
                            ) : null}
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {selectedServices.length > 0 ? (
                <div className="mb-3 rounded-xl border border-indigo-100 bg-indigo-50/70 px-3 py-3">
                  <p className="text-xs font-semibold text-indigo-900 mb-2">
                    {selectedServices.length} service(s) selected
                  </p>
                  <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                    {selectedServices.map((svc) => (
                      <span
                        key={svc.id}
                        className="inline-flex items-center gap-1 rounded-full bg-white border border-indigo-100 px-2.5 py-1 text-[11px] font-medium text-indigo-900"
                      >
                        {svc.name}
                        <button
                          type="button"
                          onClick={() => toggleServiceSelection(svc.id)}
                          className="text-indigo-400 hover:text-indigo-700"
                          aria-label={`Remove ${svc.name}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                onClick={addSelectedOverrides}
                disabled={selectedServiceIds.length === 0 || loadingServices}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-50"
              >
                <Plus className="h-4 w-4" />
                {selectedServiceIds.length > 1
                  ? `Add ${selectedServiceIds.length} Rules`
                  : selectedServiceIds.length === 1
                    ? 'Add 1 Rule'
                    : 'Add Rule'}
              </button>
            </div>

            {overrides.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-gray-200 px-4 py-8 text-center text-sm text-gray-500">
                Abhi koi service rule nahi. Upar se ek ya multiple services select karke Add Rule dabao.
              </div>
            ) : (
              <div className="space-y-6">
                {groupedOverrides.map((group) => (
                  <div key={group.category_id}>
                    <div className="mb-3 flex items-center gap-2">
                      <span className="rounded-full bg-indigo-100 px-3 py-1 text-[11px] font-black uppercase tracking-wider text-indigo-800">
                        {group.category_name}
                      </span>
                      <span className="text-xs text-gray-500">{group.rows.length} rule(s)</span>
                    </div>
                    <div className="space-y-4">
                      {group.rows.map((row) => (
                  <div key={row.id} className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
                      <div className="flex items-center gap-2 min-w-0">
                        <div className="h-9 w-9 rounded-xl bg-violet-100 text-violet-700 flex items-center justify-center shrink-0">
                          <Wrench className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-gray-900 truncate">{row.service_name}</p>
                          <p className="text-[11px] text-gray-400 truncate">ID: {row.service_type_id}</p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOverride(row.id)}
                        className="rounded-lg p-2 text-red-500 hover:bg-red-50"
                        title="Remove rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4 mb-4">
                      <ToggleMini
                        label="Rule active"
                        checked={row.active}
                        onChange={(v) => patchOverride(row.id, { active: v })}
                      />
                      <ToggleMini
                        label="Wallet allowed"
                        checked={row.wallet_allowed}
                        onChange={(v) => patchOverride(row.id, { wallet_allowed: v })}
                      />
                      <ToggleMini
                        label="Use default %"
                        checked={row.use_global}
                        onChange={(v) => patchOverride(row.id, { use_global: v })}
                      />
                    </div>

                    {!row.wallet_allowed ? (
                      <div className="rounded-xl bg-red-50 border border-red-100 px-3 py-2 text-xs text-red-700 mb-3">
                        Is service par wallet bilkul use nahi ho sakta.
                      </div>
                    ) : null}

                    <div className={`grid gap-4 md:grid-cols-3 ${row.use_global ? 'opacity-50 pointer-events-none' : ''}`}>
                      <div className="block md:col-span-1">
                        <span className="text-xs font-semibold text-gray-700">Max wallet on service bill</span>
                        <div className="mt-2 flex gap-1">
                          <button
                            type="button"
                            onClick={() => patchOverride(row.id, { service_usage_mode: 'PERCENT' })}
                            className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold ${
                              (row.service_usage_mode || 'PERCENT') === 'PERCENT'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-600 border-gray-200'
                            }`}
                          >
                            %
                          </button>
                          <button
                            type="button"
                            onClick={() => patchOverride(row.id, { service_usage_mode: 'AMOUNT' })}
                            className={`flex-1 rounded-lg border px-2 py-1.5 text-[10px] font-bold ${
                              row.service_usage_mode === 'AMOUNT'
                                ? 'bg-indigo-600 text-white border-indigo-600'
                                : 'bg-white text-gray-600 border-gray-200'
                            }`}
                          >
                            ₹ Fixed
                          </button>
                        </div>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={(row.service_usage_mode || 'PERCENT') === 'PERCENT' ? 100 : 100000}
                            value={
                              (row.service_usage_mode || 'PERCENT') === 'PERCENT'
                                ? row.service_usage_percent
                                : row.service_usage_amount
                            }
                            onChange={(e) =>
                              patchOverride(
                                row.id,
                                (row.service_usage_mode || 'PERCENT') === 'PERCENT'
                                  ? { service_usage_percent: Number(e.target.value) }
                                  : { service_usage_amount: Number(e.target.value) },
                              )
                            }
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                          />
                          <span className="text-xs font-bold text-gray-500 shrink-0">
                            {(row.service_usage_mode || 'PERCENT') === 'PERCENT' ? '%' : 'INR'}
                          </span>
                        </div>
                      </div>
                      <label className="block">
                        <span className="text-xs font-semibold text-gray-700">Cashback rate (Prime)</span>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100}
                            value={row.membership_cashback_rate_percent}
                            onChange={(e) =>
                              patchOverride(row.id, {
                                membership_cashback_rate_percent: Number(e.target.value),
                              })
                            }
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                          />
                          <span className="text-xs font-bold text-gray-500">%</span>
                        </div>
                      </label>
                      <label className="block">
                        <span className="text-xs font-semibold text-gray-700">Max cashback / bill</span>
                        <div className="mt-1 flex items-center gap-2">
                          <input
                            type="number"
                            min={0}
                            max={100000}
                            value={row.membership_cashback_max}
                            onChange={(e) =>
                              patchOverride(row.id, { membership_cashback_max: Number(e.target.value) })
                            }
                            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
                          />
                          <span className="text-xs font-bold text-gray-500">INR</span>
                        </div>
                      </label>
                    </div>

                    {row.use_global ? (
                      <p className="text-xs text-gray-500 mt-3">
                        Default rule use ho raha hai — abhi global service cap{' '}
                        {formatUsageLimitLabel(globalRules, 'SERVICE')} hai.
                      </p>
                    ) : (
                      <p className="text-xs text-violet-700 mt-3 font-semibold">
                        Example ₹5,000 bill → max wallet ₹
                        {Math.round(
                          computeUsageCapFromRules(5000, 'SERVICE', {
                            service_usage_mode: row.service_usage_mode || 'PERCENT',
                            service_usage_percent: row.service_usage_percent,
                            service_usage_amount: row.service_usage_amount,
                            membership_usage_mode: 'PERCENT',
                            membership_usage_percent: 0,
                            membership_usage_amount: 0,
                          }),
                        ).toLocaleString('en-IN')}
                      </p>
                    )}
                  </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}
