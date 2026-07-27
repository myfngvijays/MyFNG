'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

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
  carModel?: string;
  pincode?: string;
  city?: string | null;
  categories?: string[];
  expiresAt?: string;
  blocks?: Block[];
  bookUrl?: string;
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

function PlanRow({
  plan,
  openId,
  setOpenId,
}: {
  plan: PlanCard;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const key = `${plan.oil || 'x'}-${plan.tier}-${plan.price}`;
  const open = openId === key;
  const hasChecklist = Array.isArray(plan.checklist) && plan.checklist.length > 0;

  return (
    <div className="rounded-2xl border border-[#E5EAF2] bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="text-[16px] font-bold text-[#0F172A]">{plan.tier || plan.name}</h3>
            {plan.badge === 'Most Popular' ? (
              <span className="rounded-full bg-[#FEF3C7] px-2 py-0.5 text-[11px] font-semibold text-[#B45309]">
                Popular
              </span>
            ) : null}
          </div>
          {plan.pointsLabel ? (
            <p className="mt-1 text-[13px] text-[#64748B]">{plan.pointsLabel}</p>
          ) : null}
        </div>
        <div className="text-right">
          <p className="text-[18px] font-extrabold text-[#004AAD]">{inr(plan.price)}</p>
        </div>
      </div>
      {hasChecklist ? (
        <button
          type="button"
          className="mt-3 text-[13px] font-semibold text-[#004AAD]"
          onClick={() => setOpenId(open ? null : key)}
        >
          {open ? 'Hide points' : `What's included (${plan.checklist!.length})`}
        </button>
      ) : null}
      {open && hasChecklist ? (
        <ol className="mt-3 space-y-1.5 border-t border-[#EEF2F7] pt-3 text-[13px] text-[#334155]">
          {plan.checklist!.map((item, idx) => (
            <li key={`${key}-${idx}`} className="flex gap-2">
              <span className="w-5 shrink-0 font-semibold text-[#94A3B8]">{idx + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

export default function PricingSharePage() {
  const params = useParams();
  const slug = String(params?.slug || '');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<SharePayload | null>(null);
  const [oil, setOil] = useState<'semi' | 'full'>('semi');
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    if (!slug) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/public/pricing-share/${encodeURIComponent(slug)}`);
        const json = (await res.json().catch(() => ({}))) as SharePayload;
        if (!cancelled) setData(json);
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

  const expired = Boolean(data?.expired);
  const blocks = data?.blocks || [];

  return (
    <div className="min-h-screen bg-[#F4F7FB]">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
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
            <div className="mb-6 rounded-2xl bg-gradient-to-br from-[#004AAD] to-[#0B6BCB] p-6 text-white shadow-md">
              <p className="text-[13px] font-medium text-white/80">MyFNG pricing</p>
              <h1 className="mt-1 text-[24px] font-extrabold tracking-tight">
                {data?.carModel || 'Your car'}
              </h1>
              <p className="mt-2 text-[14px] text-white/90">
                {[data?.city, data?.pincode ? `PIN ${data.pincode}` : null]
                  .filter(Boolean)
                  .join(' · ')}
              </p>
              {data?.expiresAt ? (
                <p className="mt-3 text-[12px] text-white/75">
                  Link valid until {formatExpiry(data.expiresAt)}
                </p>
              ) : null}
            </div>

            {blocks.map((block) => (
              <section key={block.category} className="mb-8">
                <h2 className="mb-3 text-[15px] font-bold uppercase tracking-wide text-[#64748B]">
                  {block.category}
                </h2>

                {block.isPeriodic ? (
                  <>
                    <div className="mb-4 flex gap-2 rounded-xl bg-white p-1 shadow-sm">
                      <button
                        type="button"
                        onClick={() => setOil('semi')}
                        className={`flex-1 rounded-lg px-3 py-2.5 text-[13px] font-bold ${
                          oil === 'semi'
                            ? 'bg-[#004AAD] text-white'
                            : 'text-[#004AAD]'
                        }`}
                      >
                        Semi Synthetic
                      </button>
                      <button
                        type="button"
                        onClick={() => setOil('full')}
                        className={`flex-1 rounded-lg px-3 py-2.5 text-[13px] font-bold ${
                          oil === 'full'
                            ? 'bg-[#004AAD] text-white'
                            : 'text-[#004AAD]'
                        }`}
                      >
                        Fully Synthetic
                      </button>
                    </div>
                    <div className="space-y-3">
                      {(oil === 'semi' ? block.semi : block.full).map((plan) => (
                        <PlanRow
                          key={`${plan.oil}-${plan.tier}-${plan.price}`}
                          plan={plan}
                          openId={openId}
                          setOpenId={setOpenId}
                        />
                      ))}
                      {oil === 'semi' && !block.semi.length ? (
                        <p className="text-[13px] text-[#64748B]">No Semi Synthetic plans for this pin.</p>
                      ) : null}
                      {oil === 'full' && !block.full.length ? (
                        <p className="text-[13px] text-[#64748B]">No Fully Synthetic plans for this pin.</p>
                      ) : null}
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    {block.plans.map((plan) => (
                      <div
                        key={`${plan.id || plan.name}-${plan.price}`}
                        className="flex items-center justify-between gap-3 rounded-2xl border border-[#E5EAF2] bg-white p-4 shadow-sm"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-[15px] font-bold text-[#0F172A]">
                            {plan.name}
                          </p>
                          {plan.pointsLabel ? (
                            <p className="text-[12px] text-[#64748B]">{plan.pointsLabel}</p>
                          ) : null}
                        </div>
                        <p className="text-[16px] font-extrabold text-[#004AAD]">
                          {inr(plan.price)}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </section>
            ))}

            <div className="sticky bottom-4 z-10">
              <Link
                href={data?.bookUrl || '/book-service'}
                className="flex w-full items-center justify-center rounded-2xl bg-[#004AAD] px-5 py-4 text-[15px] font-extrabold text-white shadow-lg"
              >
                Book this service
              </Link>
            </div>
          </>
        )}
      </main>
      <Footer />
    </div>
  );
}
