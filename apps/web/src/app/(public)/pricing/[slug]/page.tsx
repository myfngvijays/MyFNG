'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type PlanCard = {
  id?: string | null;
  name: string;
  tier: string;
  points?: number | null;
  pointsLabel?: string | null;
  badge?: string | null;
  price: number;
  oil?: string;
  checklist?: string[];
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

function planKey(plan: PlanCard, category: string) {
  return `${category}::${plan.id || plan.name}::${plan.oil || 'x'}::${plan.price}`;
}

export default function PricingSharePage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharePayload | null>(null);
  const [activeCategory, setActiveCategory] = useState('');
  const [oil, setOil] = useState<'semi' | 'full'>('semi');
  const [openPoints, setOpenPoints] = useState<string | null>(null);
  const [selected, setSelected] = useState<Record<string, SelectedItem>>({});

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
        // Preselect telecaller-picked plan ids (one card per id)
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

  // View-only: block context menu, copy, print shortcuts (screenshot cannot be fully blocked on web)
  useEffect(() => {
    const blockContext = (e: Event) => e.preventDefault();
    const blockCopy = (e: ClipboardEvent) => e.preventDefault();
    const blockKeys = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if ((e.ctrlKey || e.metaKey) && ['c', 's', 'p', 'u', 'a'].includes(key)) {
        e.preventDefault();
      }
      if (key === 'printscreen') e.preventDefault();
    };
    document.addEventListener('contextmenu', blockContext);
    document.addEventListener('copy', blockCopy);
    document.addEventListener('cut', blockCopy);
    document.addEventListener('keydown', blockKeys);
    return () => {
      document.removeEventListener('contextmenu', blockContext);
      document.removeEventListener('copy', blockCopy);
      document.removeEventListener('cut', blockCopy);
      document.removeEventListener('keydown', blockKeys);
    };
  }, []);

  const activeBlock = useMemo(
    () => (data?.blocks || []).find((b) => b.category === activeCategory) || null,
    [data?.blocks, activeCategory],
  );

  const visiblePlans: PlanCard[] = useMemo(() => {
    if (!activeBlock) return [];
    if (activeBlock.isPeriodic) {
      return oil === 'semi' ? activeBlock.semi : activeBlock.full;
    }
    return activeBlock.plans;
  }, [activeBlock, oil]);

  const selectedList = useMemo(() => Object.values(selected), [selected]);
  const selectedTotal = useMemo(
    () => selectedList.reduce((sum, s) => sum + (Number(s.price) || 0), 0),
    [selectedList],
  );

  const togglePlan = useCallback(
    (plan: PlanCard, category: string) => {
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
            name: plan.tier && plan.tier !== plan.name ? `${plan.tier} · ${plan.name}` : plan.name,
            category,
            price: plan.price,
            pointsLabel: plan.pointsLabel,
          },
        };
      });
    },
    [],
  );

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
    // Open WhatsApp with pre-filled selection (user sends to MyFNG chat)
    const url = `https://wa.me/?text=${encodeURIComponent(lines.join('\n'))}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const expired = Boolean(data?.expired);

  return (
    <div
      className="pricing-share-view min-h-screen bg-[#F4F7FB] select-none"
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

      <header className="sticky top-0 z-20 border-b border-[#E5EAF2] bg-white/95 px-4 py-3 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-wide text-[#004AAD]">
              Service &amp; Price
            </p>
            <h1 className="text-[17px] font-extrabold text-[#0F172A]">
              {data?.carModel || 'MyFNG Pricing'}
            </h1>
          </div>
          <Link href="/" className="text-[12px] font-semibold text-[#64748B]">
            MY FNG
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-4 pb-36">
        {loading ? (
          <div className="rounded-2xl bg-white p-8 text-center text-[#64748B] shadow-sm">
            Loading pricing…
          </div>
        ) : expired || data?.error ? (
          <div className="rounded-2xl border border-[#FECACA] bg-white p-8 text-center shadow-sm">
            <p className="text-[18px] font-bold text-[#991B1B]">
              {expired ? 'Link expired' : 'Unavailable'}
            </p>
            <p className="mt-2 text-[14px] text-[#64748B]">
              {data?.error ||
                'This pricing link is no longer valid. Please contact MyFNG for updated prices.'}
            </p>
            <Link
              href="/book-service"
              className="mt-6 inline-flex rounded-xl bg-[#004AAD] px-5 py-3 text-[14px] font-bold text-white"
            >
              Book service
            </Link>
          </div>
        ) : (
          <>
            {/* High-contrast info card */}
            <div className="mb-4 rounded-2xl bg-[#004AAD] p-4 text-white shadow-md">
              <p className="text-[13px] font-semibold text-white">
                {[data?.city, data?.pincode ? `PIN ${data.pincode}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              <p className="mt-1 text-[12px] text-white/85">
                Link valid until {formatExpiry(data?.expiresAt)} · View only
              </p>
            </div>

            <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[#64748B]">
              Packages
            </p>
            <div className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
              {(data?.categoryTabs || []).map((tab) => {
                const active = tab.id === activeCategory;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setActiveCategory(tab.id);
                      setOpenPoints(null);
                    }}
                    className={`shrink-0 rounded-xl border px-3 py-2.5 text-left ${
                      active
                        ? 'border-[#004AAD] bg-[#EAF2FF]'
                        : 'border-[#E5EAF2] bg-white'
                    }`}
                  >
                    <p
                      className={`text-[13px] font-bold ${
                        active ? 'text-[#004AAD]' : 'text-[#0F172A]'
                      }`}
                    >
                      {tab.label}
                    </p>
                    <p className="text-[11px] text-[#64748B]">{tab.count} plans</p>
                  </button>
                );
              })}
            </div>

            {activeBlock?.isPeriodic ? (
              <div className="mb-4 flex gap-2 rounded-xl bg-white p-1 shadow-sm">
                <button
                  type="button"
                  onClick={() => setOil('semi')}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-[13px] font-bold ${
                    oil === 'semi' ? 'bg-[#004AAD] text-white' : 'text-[#004AAD]'
                  }`}
                >
                  Semi Synthetic
                </button>
                <button
                  type="button"
                  onClick={() => setOil('full')}
                  className={`flex-1 rounded-lg px-3 py-2.5 text-[13px] font-bold ${
                    oil === 'full' ? 'bg-[#004AAD] text-white' : 'text-[#004AAD]'
                  }`}
                >
                  Fully Synthetic
                </button>
              </div>
            ) : null}

            {selectedList.length > 0 ? (
              <div className="mb-4 rounded-2xl border border-[#BFDBFE] bg-[#EFF6FF] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[13px] font-bold text-[#0F172A]">
                    {selectedList.length} selected
                  </p>
                  <p className="text-[15px] font-extrabold text-[#004AAD]">
                    {inr(selectedTotal)}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedList.map((s) => (
                    <button
                      key={s.key}
                      type="button"
                      onClick={() => removeSelected(s.key)}
                      className="inline-flex items-center gap-1 rounded-full bg-white px-2.5 py-1 text-[12px] font-semibold text-[#004AAD] shadow-sm"
                    >
                      {s.name}
                      <span className="text-[#94A3B8]">×</span>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <h2 className="mb-3 text-[15px] font-extrabold uppercase tracking-wide text-[#0F172A]">
              {activeBlock?.category || 'Services'}
            </h2>

            <div className="grid grid-cols-2 gap-3">
              {visiblePlans.map((plan) => {
                const key = planKey(plan, activeCategory);
                const isOn = Boolean(selected[key]);
                const pointsOpen = openPoints === key;
                return (
                  <div
                    key={key}
                    className={`rounded-2xl border bg-white p-3 shadow-sm ${
                      isOn ? 'border-[#004AAD] ring-1 ring-[#004AAD]/40' : 'border-[#E5EAF2]'
                    }`}
                  >
                    <button
                      type="button"
                      className="w-full text-left"
                      onClick={() => togglePlan(plan, activeCategory)}
                    >
                      <div className="mb-1 flex items-start justify-between gap-1">
                        <p
                          className={`text-[13px] font-bold leading-snug ${
                            isOn ? 'text-[#004AAD]' : 'text-[#0F172A]'
                          }`}
                        >
                          {plan.tier || plan.name}
                        </p>
                        <span
                          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[11px] ${
                            isOn
                              ? 'border-[#16A34A] bg-[#16A34A] text-white'
                              : 'border-[#CBD5E1] text-transparent'
                          }`}
                        >
                          ✓
                        </span>
                      </div>
                      {plan.pointsLabel ? (
                        <p className="text-[11px] text-[#64748B]">{plan.pointsLabel}</p>
                      ) : null}
                      <p className="mt-2 text-[16px] font-extrabold text-[#0F172A]">
                        {inr(plan.price)}
                      </p>
                      {isOn ? (
                        <p className="mt-1 text-[11px] font-semibold text-[#16A34A]">Added</p>
                      ) : (
                        <p className="mt-1 text-[11px] font-semibold text-[#004AAD]">+ Add</p>
                      )}
                    </button>
                    {plan.checklist?.length ? (
                      <button
                        type="button"
                        className="mt-2 text-[11px] font-semibold text-[#004AAD]"
                        onClick={() => setOpenPoints(pointsOpen ? null : key)}
                      >
                        Points ({plan.checklist.length}) {pointsOpen ? '▴' : '›'}
                      </button>
                    ) : null}
                    {pointsOpen && plan.checklist?.length ? (
                      <ol className="mt-2 max-h-40 space-y-1 overflow-y-auto border-t border-[#EEF2F7] pt-2 text-[11px] text-[#334155]">
                        {plan.checklist.map((item, idx) => (
                          <li key={`${key}-pt-${idx}`}>
                            {idx + 1}. {item}
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                );
              })}
            </div>

            {!visiblePlans.length ? (
              <p className="mt-4 text-center text-[13px] text-[#64748B]">
                No plans in this category for this pincode / car.
              </p>
            ) : null}
          </>
        )}
      </main>

      {!loading && !expired && !data?.error ? (
        <div className="fixed bottom-0 left-0 right-0 z-30 border-t border-[#E5EAF2] bg-white px-4 py-3 shadow-[0_-8px_24px_rgba(15,23,42,0.08)]">
          <div className="mx-auto flex max-w-3xl flex-col gap-2 sm:flex-row">
            <button
              type="button"
              disabled={!selectedList.length}
              onClick={sendSelectionWhatsApp}
              className="flex-1 rounded-2xl bg-[#16A34A] px-4 py-3.5 text-[14px] font-extrabold text-white disabled:opacity-40"
            >
              Send selection on WhatsApp
              {selectedList.length ? ` (${selectedList.length})` : ''}
            </button>
            <Link
              href={data?.bookUrl || '/book-service'}
              className="flex flex-1 items-center justify-center rounded-2xl bg-[#004AAD] px-4 py-3.5 text-[14px] font-extrabold text-white"
            >
              Book service
            </Link>
          </div>
        </div>
      ) : null}
    </div>
  );
}
