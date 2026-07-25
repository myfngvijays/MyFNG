'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Check, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export type CrmCatalogSelection = {
  service_type_ids: string[];
  pickup_required?: boolean;
  membership_plan_id?: string;
  membership_plan_name?: string;
  membership_plan_price?: number;
  rsa_service?: string;
  problem_description?: string;
  package_label?: string;
};

type ServiceTypeRow = {
  id: string;
  name: string;
  description?: string | null;
  category?: string;
};

const RSA_SERVICES = [
  { name: 'Car Towing Services', desc: 'Safe towing to nearest workshop.' },
  { name: 'Battery Jumpstart', desc: 'Instant battery start at your location.' },
  { name: 'Flat Tyre Assistance', desc: 'Tyre change or puncture fix instantly.' },
  { name: 'Fuel Delivery', desc: 'Emergency petrol/diesel delivery.' },
  { name: 'Lockout Assistance', desc: 'Help when keys are locked inside the car.' },
  { name: 'Accidental Car Towing', desc: 'Accident vehicle recovery & transport.' },
];

function inr(n: number) {
  return `₹${Math.round(Number(n || 0)).toLocaleString('en-IN')}`;
}

function isPackageLike(name: string) {
  const n = String(name || '').toLowerCase();
  return (
    n.includes('package') ||
    /\b(basic|general|premium|platinum)\s+service\b/.test(n) ||
    n.includes('tune up') ||
    n.includes('wheel care')
  );
}

type Props = {
  bookingType: string;
  selectedIds: string[];
  onChangeIds: (ids: string[]) => void;
  cityId?: string | null;
  vehicleClass?: string | null;
  modelId?: string | null;
  notes: string;
  onNotesChange: (v: string) => void;
  selectionMeta: CrmCatalogSelection;
  onMetaChange: (patch: Partial<CrmCatalogSelection>) => void;
  /** When true, fetch quote prices on service select */
  showQuotePrices?: boolean;
};

export default function CrmBookingCatalog({
  bookingType,
  selectedIds,
  onChangeIds,
  cityId,
  vehicleClass,
  notes,
  onNotesChange,
  selectionMeta,
  onMetaChange,
  showQuotePrices = false,
}: Props) {
  const type = String(bookingType || 'PERIODIC').toUpperCase();
  const [services, setServices] = useState<ServiceTypeRow[]>([]);
  const [loadingServices, setLoadingServices] = useState(false);
  const [membershipPlans, setMembershipPlans] = useState<any[]>([]);
  const [memLoading, setMemLoading] = useState(false);
  const [priceMap, setPriceMap] = useState<Record<string, number>>({});
  const [quoting, setQuoting] = useState(false);

  useEffect(() => {
    if (type === 'RSA' || type === 'MEMBERSHIP') return;
    let cancelled = false;
    (async () => {
      setLoadingServices(true);
      try {
        const supabase = createClient();
        const [{ data: cats }, { data, error }] = await Promise.all([
          supabase.from('categories').select('uuid, category').order('category'),
          supabase
            .from('service_types')
            .select('id, name, description, category_uuid')
            .eq('is_active', true)
            .order('name'),
        ]);

        if (cancelled) return;
        if (error) {
          setServices([]);
          return;
        }

        const categoryMap: Record<string, string> = {};
        (cats || []).forEach((c: any) => {
          if (c.uuid && c.category) categoryMap[String(c.uuid)] = String(c.category).toUpperCase();
        });

        let rows: ServiceTypeRow[] = (data || []).map((r: any) => ({
          id: String(r.id),
          name: String(r.name || ''),
          description: r.description,
          category: r.category_uuid
            ? categoryMap[String(r.category_uuid)] || 'OTHER SERVICES'
            : 'OTHER SERVICES',
        }));

        if (type === 'PERIODIC') {
          const periodic = rows.filter(
            (s) =>
              String(s.category || '').includes('PERIODIC') ||
              isPackageLike(s.name),
          );
          rows = periodic.length > 0 ? periodic : rows.filter((s) => isPackageLike(s.name));
        } else if (type === 'OTHER_SERVICES') {
          rows = rows.filter(
            (s) =>
              !String(s.category || '').includes('PERIODIC') &&
              !isPackageLike(s.name),
          );
        }

        setServices(rows);
      } catch {
        if (!cancelled) setServices([]);
      } finally {
        if (!cancelled) setLoadingServices(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type]);

  useEffect(() => {
    if (type !== 'MEMBERSHIP') return;
    let cancelled = false;
    (async () => {
      setMemLoading(true);
      try {
        const res = await fetch('/api/public/membership-plans');
        const json = await res.json().catch(() => ({}));
        let plans = Array.isArray(json?.plans) ? json.plans : [];

        if (!res.ok || plans.length === 0) {
          const supabase = createClient();
          const { data } = await supabase
            .from('membership_plans')
            .select('id, name, code, price, tagline, duration_days')
            .eq('active', true)
            .order('created_at', { ascending: true });
          plans = data || [];
        }

        if (!cancelled) setMembershipPlans(plans);
      } catch {
        if (!cancelled) setMembershipPlans([]);
      } finally {
        if (!cancelled) setMemLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [type]);

  const fetchPrices = useCallback(
    async (ids: string[]) => {
      if (!showQuotePrices || ids.length === 0) return;
      setQuoting(true);
      try {
        const res = await fetch('/api/telecaller/crm/quote', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            city_id: cityId || null,
            vehicle_class: vehicleClass || null,
            service_type_ids: ids,
          }),
        });
        const json = await res.json().catch(() => ({}));
        const items = Array.isArray(json?.quote?.line_items) ? json.quote.line_items : [];
        const next: Record<string, number> = {};
        items.forEach((item: any) => {
          if (item?.id) next[String(item.id)] = Number(item.price || 0);
        });
        setPriceMap(next);
      } catch {
        setPriceMap({});
      } finally {
        setQuoting(false);
      }
    },
    [cityId, vehicleClass, showQuotePrices],
  );

  const toggleService = (id: string) => {
    const isPeriodic = type === 'PERIODIC';
    let next: string[];
    if (isPeriodic) {
      next = selectedIds.includes(id) ? [] : [id];
    } else {
      next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id];
    }
    onChangeIds(next);
    onMetaChange({ service_type_ids: next, pickup_required: true });
    if (showQuotePrices) fetchPrices(next);
  };

  const notesField = (
    <div className="mt-4">
      <label className="mb-1.5 block text-xs font-bold uppercase tracking-wide text-gray-500">
        Problem / Notes
      </label>
      <textarea
        value={notes}
        onChange={(e) => onNotesChange(e.target.value)}
        rows={3}
        placeholder="Optional notes for workshop"
        className="w-full rounded-xl border border-gray-200 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-[#004AAD] focus:outline-none focus:ring-2 focus:ring-[#004AAD]/20"
      />
    </div>
  );

  const serviceListTitle = useMemo(() => {
    if (type === 'PERIODIC') return 'Periodic Service plans';
    if (type === 'OTHER_SERVICES') return 'Other Services';
    return 'Services';
  }, [type]);

  if (type === 'RSA') {
    return (
      <div>
        <h3 className="text-base font-extrabold text-gray-900">RSA services</h3>
        <p className="mt-1 text-sm text-gray-500">Pick the roadside issue for this booking.</p>
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          {RSA_SERVICES.map((svc) => {
            const selected = selectionMeta.rsa_service === svc.name;
            return (
              <button
                key={svc.name}
                type="button"
                onClick={() => {
                  onMetaChange({
                    rsa_service: svc.name,
                    service_type_ids: [],
                    problem_description: notes?.trim() ? notes : svc.desc,
                  });
                  if (!notes?.trim()) onNotesChange(svc.desc);
                }}
                className={`rounded-xl border-2 p-3 text-left transition ${
                  selected
                    ? 'border-[#004AAD] bg-[#004AAD]/5'
                    : 'border-gray-200 bg-white hover:border-[#004AAD]/40'
                }`}
              >
                <p className="text-sm font-bold text-gray-900">{svc.name}</p>
                <p className="mt-1 text-xs text-gray-500 line-clamp-2">{svc.desc}</p>
                {selected ? (
                  <Check className="mt-2 h-4 w-4 text-[#004AAD]" />
                ) : null}
              </button>
            );
          })}
        </div>
        {notesField}
      </div>
    );
  }

  if (type === 'MEMBERSHIP') {
    return (
      <div>
        <h3 className="text-base font-extrabold text-gray-900">Membership plans</h3>
        <p className="mt-1 text-sm text-gray-500">Select a membership plan to book.</p>
        {memLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-[#004AAD]" />
          </div>
        ) : membershipPlans.length === 0 ? (
          <p className="mt-4 text-sm text-gray-500">No membership plans available.</p>
        ) : (
          <div className="mt-4 space-y-3">
            {membershipPlans.map((plan) => {
              const planId = String(plan.id || plan.planId || plan.code || '');
              const selected = selectionMeta.membership_plan_id === planId;
              const price = Number(plan.price ?? plan.priceNum ?? 0);
              const benefits = Array.isArray(plan.benefits) ? plan.benefits.slice(0, 4) : [];
              return (
                <button
                  key={planId || plan.name}
                  type="button"
                  onClick={() =>
                    onMetaChange({
                      membership_plan_id: planId,
                      membership_plan_name: String(plan.name || ''),
                      membership_plan_price: price,
                      service_type_ids: [],
                    })
                  }
                  className={`w-full rounded-xl border-2 p-4 text-left transition ${
                    selected
                      ? 'border-[#004AAD] bg-[#004AAD]/5'
                      : 'border-gray-200 bg-white hover:border-[#004AAD]/40'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-base font-extrabold text-gray-900">{plan.name}</p>
                      {plan.tagline ? (
                        <p className="mt-0.5 text-xs text-gray-500">{plan.tagline}</p>
                      ) : null}
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-extrabold text-[#004AAD]">{inr(price)}</p>
                      {plan.duration_days ? (
                        <p className="text-xs text-gray-500">{plan.duration_days} days</p>
                      ) : (
                        <p className="text-xs text-gray-500">/ year</p>
                      )}
                    </div>
                  </div>
                  {benefits.map((b: any, i: number) => (
                    <p key={i} className="mt-1 text-xs text-gray-600">
                      ✓ {b.title || b.description || b.name || ''}
                    </p>
                  ))}
                  {selected ? (
                    <span className="mt-2 inline-flex items-center gap-1 text-xs font-bold text-emerald-600">
                      <Check className="h-3.5 w-3.5" /> Selected
                    </span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}
        {notesField}
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-extrabold text-gray-900">{serviceListTitle}</h3>
          <p className="mt-1 text-sm text-gray-500">
            {type === 'PERIODIC'
              ? 'Select one periodic / package plan.'
              : 'Select one or more services.'}
          </p>
        </div>
        {quoting ? <Loader2 className="h-4 w-4 animate-spin text-[#004AAD]" /> : null}
      </div>

      {loadingServices ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin text-[#004AAD]" />
        </div>
      ) : services.length === 0 ? (
        <p className="mt-4 text-sm text-gray-500">No services found for this category.</p>
      ) : (
        <div className="mt-4 space-y-2">
          {services.map((svc) => {
            const selected = selectedIds.includes(svc.id);
            const price = priceMap[svc.id];
            return (
              <button
                key={svc.id}
                type="button"
                onClick={() => toggleService(svc.id)}
                className={`flex w-full items-center gap-3 rounded-xl border-2 px-4 py-3 text-left transition ${
                  selected
                    ? 'border-[#004AAD] bg-[#004AAD]/5'
                    : 'border-gray-200 bg-white hover:border-[#004AAD]/40'
                }`}
              >
                <div
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md border-2 ${
                    selected ? 'border-[#004AAD] bg-[#004AAD]' : 'border-gray-300 bg-white'
                  }`}
                >
                  {selected ? <Check className="h-3 w-3 text-white" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-gray-900">{svc.name}</p>
                  {svc.description ? (
                    <p className="mt-0.5 text-xs text-gray-500 line-clamp-2">{svc.description}</p>
                  ) : null}
                </div>
                {showQuotePrices && price != null && price > 0 ? (
                  <span className="shrink-0 text-sm font-bold text-[#004AAD]">{inr(price)}</span>
                ) : null}
              </button>
            );
          })}
        </div>
      )}
      {notesField}
    </div>
  );
}
