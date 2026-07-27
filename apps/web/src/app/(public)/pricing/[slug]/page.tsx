'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { CheckCircle, Droplets, Shield, X } from 'lucide-react';
import Navbar from '@/components/landing/Navbar';

type ChecklistItem = { name: string; category?: string };

type PlanCard = {
  id?: string | null;
  name: string;
  tier: string;
  points?: number | null;
  pointsLabel?: string | null;
  badge?: string | null;
  price: number;
  oil?: string;
  checklist?: Array<string | ChecklistItem>;
};

type Block =
  | {
      category: string;
      isPeriodic: true;
      semi: PlanCard[];
      full: PlanCard[];
      other: PlanCard[];
    }
  | {
      category: string;
      isPeriodic: false;
      plans: PlanCard[];
    };

type SharePayload = {
  expired?: boolean;
  error?: string;
  customerName?: string | null;
  customerPhone?: string | null;
  carModel?: string;
  pincode?: string;
  city?: string | null;
  expiresAt?: string;
  blocks?: Block[];
  categoryTabs?: Array<{ id: string; label: string; count: number }>;
  preselectedIds?: string[];
  bookUrl?: string;
};

type SelectedItem = {
  key: string;
  id: string;
  name: string;
  category: string;
  price: number;
  pointsLabel?: string | null;
};

type DetailsPlan = {
  plan: PlanCard;
  category: string;
};

function inr(n: number) {
  return `₹${Math.round(n || 0).toLocaleString('en-IN')}`;
}

function formatExpiry(iso?: string) {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  } catch {
    return '';
  }
}

/** Pricing share — Send selection on WhatsApp */
const MYFNG_WHATSAPP = '919594996161';

function planKey(plan: PlanCard, category: string) {
  return `${category}::${plan.id || plan.name}::${plan.oil || 'x'}::${plan.price}`;
}

/** Small 128px icons (~6–13KB) — full /icon-*-service.png are ~1MB each and load slowly */
const ICON_SM = '/icons-sm';

function categoryIcon(label: string): { src: string; bg: string } {
  const cat = label.toLowerCase();
  if (cat.includes('periodic'))
    return { src: `${ICON_SM}/icon-periodic-service.png`, bg: 'bg-blue-50' };
  if (cat.includes('ac')) return { src: `${ICON_SM}/icon-ac-service.png`, bg: 'bg-cyan-50' };
  if (cat.includes('battery') || cat.includes('electrical'))
    return { src: `${ICON_SM}/icon-electrical-service.png`, bg: 'bg-amber-50' };
  if (cat.includes('brake')) return { src: `${ICON_SM}/icon-brake-service.png`, bg: 'bg-red-50' };
  if (cat.includes('clutch')) return { src: `${ICON_SM}/icon-clutch-service.png`, bg: 'bg-purple-50' };
  if (cat.includes('tyre') || cat.includes('wheel'))
    return { src: `${ICON_SM}/icon-tyre-service.png`, bg: 'bg-gray-100' };
  if (cat.includes('detailing'))
    return { src: `${ICON_SM}/icon-detailing-service.png`, bg: 'bg-pink-50' };
  if (cat.includes('denting') || cat.includes('painting'))
    return { src: `${ICON_SM}/icon-denting-service.png`, bg: 'bg-green-50' };
  if (cat.includes('engine'))
    return { src: `${ICON_SM}/icon-engine-service.png`, bg: 'bg-orange-50' };
  if (cat.includes('suspension') || cat.includes('steering'))
    return { src: `${ICON_SM}/icon-suspension-service.png`, bg: 'bg-indigo-50' };
  return { src: `${ICON_SM}/icon-periodic-service.png`, bg: 'bg-gray-50' };
}

const PRELOAD_ICONS = [
  `${ICON_SM}/icon-periodic-service.png`,
  `${ICON_SM}/icon-engine-service.png`,
  `${ICON_SM}/icon-ac-service.png`,
  `${ICON_SM}/icon-electrical-service.png`,
  `${ICON_SM}/icon-brake-service.png`,
  `${ICON_SM}/icon-clutch-service.png`,
  `${ICON_SM}/icon-denting-service.png`,
  `${ICON_SM}/icon-detailing-service.png`,
  `${ICON_SM}/icon-tyre-service.png`,
  `${ICON_SM}/icon-suspension-service.png`,
];

function normalizeChecklist(items?: Array<string | ChecklistItem>): ChecklistItem[] {
  if (!Array.isArray(items)) return [];
  return items
    .map((it) => {
      if (typeof it === 'string') {
        const name = it.trim();
        return name ? { name, category: 'General' } : null;
      }
      const name = String(it?.name || '').trim();
      if (!name) return null;
      return { name, category: String(it?.category || 'General').trim() || 'General' };
    })
    .filter(Boolean) as ChecklistItem[];
}

/**
 * Segregate by category. Within each category:
 * all short items first as clean 2-col pairs, then long items full-width.
 * Never interleave 2-col and 1-col rows.
 */
function buildChecklistSections(items?: Array<string | ChecklistItem>) {
  const SHORT = 28;
  const normalized = normalizeChecklist(items);
  const byCat = new Map<string, ChecklistItem[]>();
  for (const it of normalized) {
    const key = it.category || 'General';
    if (!byCat.has(key)) byCat.set(key, []);
    byCat.get(key)!.push(it);
  }

  // Prefer known periodic order, then others
  const preferred = [
    'Engine Compartment',
    'Cabin',
    'Wheel & Brakes',
    'Others',
    'General',
  ];
  const catKeys = [
    ...preferred.filter((k) => byCat.has(k)),
    ...Array.from(byCat.keys()).filter((k) => !preferred.includes(k)),
  ];

  return catKeys.map((category) => {
    const list = byCat.get(category) || [];
    const short = list.filter((it) => it.name.length <= SHORT);
    const long = list.filter((it) => it.name.length > SHORT);

    const pairRows: string[][] = [];
    for (let i = 0; i < short.length; i += 2) {
      if (i + 1 < short.length) {
        pairRows.push([short[i].name, short[i + 1].name]);
      } else {
        // leftover short alone → treat as full-width at end of short block
        long.unshift(short[i]);
      }
    }

    return {
      category,
      pairRows,
      fullRows: long.map((it) => it.name),
    };
  });
}

function displayPlanTitle(plan: PlanCard, isPeriodic: boolean) {
  const raw = String(plan.tier || plan.name || '').trim();
  if (!isPeriodic) return raw;
  const lower = raw.toLowerCase();
  if (lower.includes('basic')) return 'Basic Service';
  if (lower.includes('general')) return 'General Service';
  if (lower.includes('premium')) return 'Premium Service';
  if (lower.includes('platinum')) return 'Platinum Service';
  return raw.endsWith('Service') ? raw : `${raw} Service`;
}

function pointsCount(plan: PlanCard) {
  if (typeof plan.points === 'number' && plan.points > 0) return plan.points;
  const n = normalizeChecklist(plan.checklist).length;
  if (n > 0) return n;
  const m = String(plan.pointsLabel || '').match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

function checklistLabels(plan: PlanCard): string[] {
  return normalizeChecklist(plan.checklist).map((it) => it.name);
}

export default function PricingSharePage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharePayload | null>(null);
  const [activeCategory, setActiveCategory] = useState('');
  const [oil, setOil] = useState<'semi' | 'full'>('semi');
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});
  const [details, setDetails] = useState<DetailsPlan | null>(null);
  const [shieldBlur, setShieldBlur] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/pricing-share/${encodeURIComponent(slug)}`);
        const json = (await res.json().catch(() => ({}))) as SharePayload;
        if (cancelled) return;
        setData(json);
        const firstTab = json.categoryTabs?.[0]?.id || json.blocks?.[0]?.category || '';
        setActiveCategory(firstTab);
        if (Array.isArray(json.preselectedIds) && json.preselectedIds.length && json.blocks) {
          const next: Record<string, SelectedItem> = {};
          for (const block of json.blocks) {
            const plans = block.isPeriodic
              ? [...block.semi, ...block.full, ...(block.other || [])]
              : block.plans;
            for (const plan of plans) {
              if (plan.id && json.preselectedIds.includes(String(plan.id))) {
                const key = planKey(plan, block.category);
                next[key] = {
                  key,
                  id: String(plan.id),
                  name: plan.tier || plan.name,
                  category: block.category,
                  price: plan.price,
                  pointsLabel: plan.pointsLabel,
                };
              }
            }
          }
          setSelected(next);
        }
      } catch {
        if (!cancelled) setData({ error: 'Could not load pricing.' });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [slug]);

  // Preload tiny category icons so the strip appears instantly
  useEffect(() => {
    PRELOAD_ICONS.forEach((src) => {
      const img = new window.Image();
      img.src = src;
    });
  }, []);

  // View-only shields (web cannot fully block OS screenshots; we deter + blur on leave)
  useEffect(() => {
    const blockContext = (e: Event) => e.preventDefault();
    const blockCopy = (e: ClipboardEvent) => e.preventDefault();
    const blockDrag = (e: Event) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['c', 's', 'p', 'u', 'a'].includes(key)) {
        e.preventDefault();
      }
      if (key === 'printscreen' || e.key === 'PrintScreen') {
        e.preventDefault();
        setShieldBlur(true);
        window.setTimeout(() => setShieldBlur(false), 2500);
      }
    };
    const onVisibility = () => {
      // Blur while app is backgrounded (common screenshot / recents flow)
      if (document.visibilityState === 'hidden') {
        setShieldBlur(true);
      } else {
        window.setTimeout(() => setShieldBlur(false), 800);
      }
    };
    document.addEventListener('contextmenu', blockContext);
    document.addEventListener('copy', blockCopy);
    document.addEventListener('cut', blockCopy);
    document.addEventListener('dragstart', blockDrag);
    document.addEventListener('keydown', blockKeys);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('contextmenu', blockContext);
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('cut', blockCopy);
      document.removeEventListener('dragstart', blockDrag);
      document.removeEventListener('keydown', blockKeys);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  const activeBlock = useMemo(
    () => (data?.blocks || []).find((b) => b.category === activeCategory) || null,
    [data?.blocks, activeCategory],
  );

  const visiblePlans: PlanCard[] = useMemo(() => {
    if (!activeBlock) return [];
    if (activeBlock.isPeriodic && /periodic/i.test(activeCategory)) {
      const bucket = oil === 'semi' ? activeBlock.semi : activeBlock.full;
      const other = activeBlock.other || [];
      return bucket.length ? bucket : other;
    }
    if (activeBlock.isPeriodic) {
      // Legacy bad payload: treat as flat list
      return [
        ...(activeBlock.semi || []),
        ...(activeBlock.full || []),
        ...(activeBlock.other || []),
      ];
    }
    return activeBlock.plans;
  }, [activeBlock, activeCategory, oil]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const selectedTotal = useMemo(
    () => selectedList.reduce((sum, s) => sum + (Number(s.price) || 0), 0),
    [selectedList],
  );

  const togglePlan = useCallback((plan: PlanCard, category: string) => {
    const key = planKey(plan, category);
    setSelected((prev) => {
      if (prev[key]) {
        const next = { ...prev };
        delete next[key];
        return next;
      }
      return {
        ...prev,
        [key]: {
          key,
          id: String(plan.id || key),
          name: displayPlanTitle(plan, /periodic/i.test(category)),
          category,
          price: plan.price,
          pointsLabel: plan.pointsLabel,
        },
      };
    });
  }, []);

  const removeSelected = (key: string) => {
    setSelected((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const sendSelectionWhatsApp = () => {
    if (!selectedList.length) return;
    const lines = [
      `Hi MyFNG,`,
      '',
      `I'm interested in these services for *${data?.carModel || 'my car'}* (PIN ${data?.pincode || ''}):`,
      '',
      ...selectedList.map(
        (s, i) =>
          `${i + 1}. ${s.name}${s.pointsLabel ? ` · ${s.pointsLabel}` : ''} · ${inr(s.price)}`,
      ),
      '',
      `*Total: ${inr(selectedTotal)}*`,
      '',
      `Pricing link: ${typeof window !== 'undefined' ? window.location.href : ''}`,
    ];
    window.open(
      `https://wa.me/${MYFNG_WHATSAPP}?text=${encodeURIComponent(lines.join('\n'))}`,
      '_blank',
      'noopener,noreferrer',
    );
  };

  const expired = Boolean(data?.expired);
  // Oil toggle ONLY for true Periodic category (never Denting "Full Body Paint")
  const isPeriodic =
    Boolean(activeBlock?.isPeriodic) && /periodic/i.test(activeCategory || '');
  const carLabel = (data?.carModel || 'Your car').trim();
  const cityLabel = data?.city || 'selected city';

  return (
    <div
      className="pricing-share-view min-h-screen bg-gray-50 select-none"
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitUserSelect: 'none', userSelect: 'none' } as React.CSSProperties}
    >
      <style jsx global>{`
        .pricing-share-view,
        .pricing-share-view * {
          -webkit-user-select: none !important;
          user-select: none !important;
          -webkit-touch-callout: none !important;
        }
        .pricing-share-view img {
          pointer-events: none;
          -webkit-user-drag: none;
        }
        @media print {
          body * {
            display: none !important;
          }
          body::after {
            content: 'Printing this pricing page is not allowed.';
            display: block !important;
            padding: 40px;
            font-size: 18px;
          }
        }
      `}</style>

      {shieldBlur ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/95 px-8 text-center backdrop-blur-md">
          <div>
            <p className="text-lg font-extrabold text-gray-900">View only</p>
            <p className="mt-2 text-sm text-gray-600">
              Screenshots &amp; copying are not allowed on this pricing link.
            </p>
          </div>
        </div>
      ) : null}

      <Navbar hideAppBanner />

      {/* Slim header only (no promo banners) */}
      <main className="mx-auto max-w-3xl px-5 pb-36 pt-20 sm:px-8 sm:pt-24">
        {loading ? (
          <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center text-gray-500 shadow-sm">
            Loading pricing…
          </div>
        ) : expired || data?.error ? (
          <div className="rounded-2xl border border-red-200 bg-white p-8 text-center shadow-sm">
            <p className="text-lg font-bold text-red-800">
              {expired ? 'Link expired' : 'Unavailable'}
            </p>
            <p className="mt-2 text-sm text-gray-600">
              {data?.error ||
                'This pricing link is no longer valid. Please contact MyFNG for updated prices.'}
            </p>
            <Link
              href="/book-service"
              className="mt-6 inline-flex rounded-xl bg-brand-primary px-5 py-3 text-sm font-bold text-white"
            >
              Book service
            </Link>
          </div>
        ) : (
          <>
            {/* Choose your plan — blue info box */}
            <div className="mb-4 rounded-2xl bg-[#004AAD] px-4 py-3.5 text-white shadow-md">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-extrabold text-white sm:text-base">
                    Choose your plan
                    {data?.customerName ? (
                      <span className="font-semibold text-white/95">
                        {' '}
                        · {String(data.customerName).trim()}
                      </span>
                    ) : null}
                  </div>
                  <div className="mt-0.5 text-xs text-white/90 sm:text-sm">
                    {carLabel} in {cityLabel}
                    {data?.pincode ? ` · PIN ${data.pincode}` : ''}
                  </div>
                </div>
                <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-white/85">
                  View only
                </span>
              </div>
              <p className="mt-1.5 text-[11px] text-white/80">
                Link valid until {formatExpiry(data?.expiresAt)}
              </p>
            </div>

            {/* Category icons — padding so rings aren't clipped */}
            <div className="mb-3">
              <div className="scrollbar-hide flex gap-3 overflow-x-auto px-0.5 pb-2 pt-2 sm:gap-4">
                {(data?.categoryTabs || []).map((tab) => {
                  const isSelected = tab.id === activeCategory;
                  const { src } = categoryIcon(tab.label || tab.id);
                  const displayName = String(tab.label || tab.id).replace(/^car\s+/i, '');
                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => {
                        setActiveCategory(tab.id);
                        setDetails(null);
                      }}
                      className={`flex w-[5rem] flex-shrink-0 flex-col items-center gap-1.5 transition-all sm:w-[5.5rem] ${
                        isSelected ? '' : 'opacity-75 hover:opacity-100'
                      }`}
                    >
                      <div
                        className={`flex h-14 w-14 items-center justify-center rounded-2xl transition-all sm:h-16 sm:w-16 ${
                          isSelected
                            ? 'border-2 border-blue-500 bg-white shadow-lg ring-2 ring-blue-100'
                            : 'border border-gray-100 bg-white hover:shadow-md'
                        }`}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={src}
                          alt={displayName}
                          width={56}
                          height={56}
                          decoding="async"
                          loading="eager"
                          fetchPriority="high"
                          className="h-[70%] w-[70%] object-contain mix-blend-darken"
                        />
                      </div>
                      <span
                        className={`max-w-full line-clamp-2 text-center text-[9px] font-semibold leading-tight sm:text-[10px] ${
                          isSelected ? 'font-bold text-gray-900' : 'text-gray-600'
                        }`}
                      >
                        {displayName}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Oil toggle sits under category icons (replaces Semi Synthetic Oil pill) */}
            {isPeriodic ? (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 py-2">
                <Droplets className="h-3.5 w-3.5 flex-shrink-0 text-brand-primary" />
                <span
                  className={`text-xs font-semibold ${
                    oil === 'semi' ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  Semi
                </span>
                <button
                  type="button"
                  onClick={() => setOil(oil === 'semi' ? 'full' : 'semi')}
                  className="relative h-6 w-11 flex-shrink-0 rounded-full bg-brand-primary transition-all"
                  aria-label="Toggle oil type"
                >
                  <div
                    className={`absolute top-[3px] flex h-[18px] w-[18px] items-center justify-center rounded-full bg-white shadow transition-all ${
                      oil === 'full' ? 'left-[23px]' : 'left-[3px]'
                    }`}
                  >
                    <Droplets className="h-2.5 w-2.5 text-brand-primary" />
                  </div>
                </button>
                <span
                  className={`text-xs font-semibold ${
                    oil === 'full' ? 'text-gray-900' : 'text-gray-400'
                  }`}
                >
                  Fully
                </span>
                <span className="ml-1 text-[10px] text-gray-400">
                  {oil === 'semi' ? 'Semi Synthetic Oil' : 'Fully Synthetic Oil'}
                </span>
              </div>
            ) : null}

            {selectedList.length > 0 ? (
              <div className="mb-3 rounded-2xl border border-blue-200 bg-blue-50 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm font-bold text-gray-900">
                    {selectedList.length} selected
                  </p>
                  <p className="text-base font-extrabold text-brand-primary">
                    {inr(selectedTotal)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedList.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => removeSelected(s.key)}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-brand-primary shadow-sm"
                    >
                      {s.name}
                      <span className="text-gray-400">×</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            {/* One card per row (mobile book-service style) */}
            <div className="grid grid-cols-1 gap-3">
              {visiblePlans.map((plan, idx) => {
                const key = planKey(plan, activeCategory);
                const isOn = Boolean(selected[key]);
                const title = displayPlanTitle(plan, isPeriodic);
                const titleFormatted = isPeriodic ? title.replace(' ', '\n') : title;
                const pts = pointsCount(plan);
                const preview = checklistLabels(plan).slice(0, 5);
                return (
                  <div
                    key={key}
                    className={`relative flex h-full flex-col rounded-3xl border-2 bg-white p-3 shadow-sm transition-all sm:p-4 ${
                      isOn
                        ? 'border-brand-primary shadow-lg'
                        : 'border-gray-200 hover:border-brand-primary/50 hover:shadow-md'
                    }`}
                  >
                    {isPeriodic && idx === 1 ? (
                      <div className="absolute -top-3 left-3 right-3">
                        <div className="mx-auto w-fit rounded-full bg-gradient-to-r from-brand-primary to-brand-secondary px-3 py-1 text-[10px] font-extrabold text-white shadow">
                          MyFNG RECOMMENDED
                        </div>
                      </div>
                    ) : null}

                    <div className="flex items-start justify-between gap-2">
                      <div className="min-h-[3.5rem] min-w-0">
                        <div className="whitespace-pre-wrap break-words text-lg font-extrabold leading-[1.15] text-gray-900 sm:text-xl">
                          {titleFormatted}
                        </div>
                        <div className="mt-1 text-xs font-bold text-brand-primary sm:text-sm">
                          {pts > 0 ? `${pts} Activity Points` : 'Activity Points Included'}
                        </div>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <div className="text-lg font-extrabold text-gray-900 sm:text-xl">
                          {plan.price > 0 ? inr(plan.price) : ''}
                        </div>
                      </div>
                    </div>

                    <div className="mt-2 flex flex-col">
                      {preview.length > 0 ? (
                        <div className="space-y-2">
                          {preview.map((item, i) => (
                            <div
                              key={`${key}-pt-${i}`}
                              className="flex items-start gap-2 text-[13px] text-gray-700"
                            >
                              <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                              <span className="line-clamp-1 break-words">{item}</span>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-600">
                          Standard maintenance & inspection included.
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => setDetails({ plan, category: activeCategory })}
                        className="pt-1 text-left text-[13px] font-bold text-brand-primary hover:text-brand-secondary"
                      >
                        View all points
                        {pts > 0 ? ` (${pts})` : ''}
                      </button>
                    </div>

                    <div className="mt-2 flex items-center pt-2">
                      <button
                        type="button"
                        onClick={() => togglePlan(plan, activeCategory)}
                        className="self-start rounded-full bg-brand-primary px-5 py-2.5 text-sm font-extrabold text-white transition-all hover:bg-brand-secondary"
                      >
                        {isOn ? 'Added ✓' : 'Select Package'}
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            {!visiblePlans.length ? (
              <div className="rounded-2xl border border-gray-200 bg-white py-10 text-center">
                <p className="font-semibold text-gray-700">No packages found</p>
                <p className="mt-1 text-xs text-gray-500">
                  {isPeriodic
                    ? 'Selected oil type me service available nahi hai. Switch change karke dekhiye.'
                    : 'Try a different category'}
                </p>
              </div>
            ) : null}
          </>
        )}
      </main>

      {!loading && !expired && !data?.error ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-gray-200 bg-white px-5 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)] sm:px-8">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!selectedList.length}
              onClick={sendSelectionWhatsApp}
              className="flex-1 rounded-2xl bg-green-600 px-4 py-3.5 text-sm font-extrabold text-white disabled:opacity-40"
            >
              Send selection on WhatsApp
              {selectedList.length ? ` (${selectedList.length})` : ''}
            </button>
            <Link
              href={data?.bookUrl || '/book-service'}
              className="flex flex-1 items-center justify-center rounded-2xl bg-brand-primary px-4 py-3.5 text-sm font-extrabold text-white"
            >
              Book service
            </Link>
          </div>
        </div>
      ) : null}

      {/* Points bottom sheet — opens from bottom, half screen max */}
      {details ? (
        <div className="fixed inset-0 z-[70] flex items-end justify-center">
          <div className="absolute inset-0 bg-black/40" onClick={() => setDetails(null)} />
          <div
            className="relative flex w-full max-w-lg flex-col overflow-hidden rounded-t-3xl bg-white shadow-2xl animate-in slide-in-from-bottom duration-200"
            style={{ height: '62vh', maxHeight: '62vh' }}
          >
            <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-gray-300" />
            <div className="flex shrink-0 items-start justify-between gap-2 border-b border-gray-200 px-5 pb-2.5 pt-2 sm:px-6">
              <div className="min-w-0">
                <div className="truncate text-[15px] font-extrabold text-gray-900">
                  {displayPlanTitle(details.plan, /periodic/i.test(details.category))}
                  {details.plan.oil
                    ? ` (${details.plan.oil === 'full' ? 'Fully Synthetic' : 'Semi Synthetic'})`
                    : ''}
                </div>
                <div className="mt-0.5 flex flex-wrap items-center gap-1.5 text-xs text-gray-600">
                  <span>Checklist</span>
                  {pointsCount(details.plan) > 0 ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-700">
                      <CheckCircle className="h-3 w-3 text-green-600" />
                      {pointsCount(details.plan)} pts
                    </span>
                  ) : null}
                  <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-[10px] font-bold text-green-700">
                    Official
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDetails(null)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-700 hover:bg-gray-50"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-2 sm:px-6">
              <div className="mb-2 flex items-center justify-between gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2.5">
                <div>
                  <div className="text-base font-extrabold text-gray-900">
                    {details.plan.price > 0 ? inr(details.plan.price) : '—'}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1 text-[10px] text-emerald-800">
                    <Shield className="h-3 w-3 text-green-600" />
                    <span>
                      {/periodic/i.test(details.category) ? '1000 kms / 1 Month' : 'NA'}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    togglePlan(details.plan, details.category);
                    setDetails(null);
                  }}
                  className="inline-flex items-center justify-center rounded-lg bg-green-600 px-3 py-2 text-xs font-extrabold text-white shadow hover:bg-green-700"
                >
                  {selected[planKey(details.plan, details.category)]
                    ? 'Added ✓'
                    : 'Select Package'}
                </button>
              </div>

              {(() => {
                const sections = buildChecklistSections(details.plan.checklist);
                const multiCat = sections.length > 1;
                if (!sections.length) {
                  return (
                    <p className="py-4 text-center text-sm text-gray-600">
                      No checklist available for this service.
                    </p>
                  );
                }
                return (
                  <div className="space-y-4">
                    {sections.map((section) => (
                      <div key={section.category}>
                        {multiCat && section.category !== 'General' ? (
                          <p className="mb-1.5 text-[11px] font-extrabold uppercase tracking-wide text-gray-500">
                            {section.category}
                          </p>
                        ) : null}

                        {/* All 2-col pairs first — never mixed with singles */}
                        {section.pairRows.length > 0 ? (
                          <div className="grid grid-cols-2 gap-x-3">
                            {section.pairRows.flatMap((pair, pIdx) =>
                              pair.map((item, j) => (
                                <div
                                  key={`${section.category}-p-${pIdx}-${j}`}
                                  className="flex items-start gap-1.5 border-b border-gray-100 py-1.5 text-[12px] text-gray-700"
                                >
                                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-green-600" />
                                  <span className="min-w-0 break-words leading-snug">
                                    {item}
                                  </span>
                                </div>
                              )),
                            )}
                          </div>
                        ) : null}

                        {/* Then full-width long lines */}
                        {section.fullRows.length > 0 ? (
                          <div className={section.pairRows.length ? 'mt-0.5' : ''}>
                            {section.fullRows.map((item, fIdx) => (
                              <div
                                key={`${section.category}-f-${fIdx}`}
                                className="flex items-start gap-2 border-b border-gray-100 py-1.5 text-[13px] text-gray-700"
                              >
                                <CheckCircle className="mt-0.5 h-4 w-4 flex-shrink-0 text-green-600" />
                                <span className="flex-1 break-words leading-snug">{item}</span>
                              </div>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>
                );
              })()}

              {/periodic/i.test(details.category) ? (
                <p className="mt-2 pb-2 text-[10px] italic text-red-600">
                  * Spare part replacements charged at actual cost. Service packages use
                  company-recommended oil and filters.
                </p>
              ) : (
                <p className="mt-2 pb-2 text-[10px] italic text-red-600">
                  * This includes only labor charges. Additional parts billed at actual cost.
                </p>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
