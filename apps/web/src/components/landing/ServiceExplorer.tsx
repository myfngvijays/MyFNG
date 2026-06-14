'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  CheckCircle,
  Clock,
  IndianRupee,
  Shield,
  Sparkles,
  X,
} from 'lucide-react';
import AIFeatureBadge from './AIFeatureBadge';

export type ServiceExplorerItem = {
  slug: string;
  title: string;
  desc: string;
  icon: LucideIcon;
  iconImage?: string;
  color: string;
  bg: string;
  ring?: string;
  priceFrom: string;
  eta: string;
  warranty: string;
  highlights: string[];
};

import { INTERNAL_SLUG_TO_MARKETING as INTERNAL_SLUG_TO_CAR_SERVICES } from '@/lib/services/catalog';

function cx(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

function useBodyScrollLock(locked: boolean) {
  useEffect(() => {
    if (!locked) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [locked]);
}

function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const closeBtnRef = useRef<HTMLButtonElement | null>(null);
  useBodyScrollLock(open);

  useEffect(() => {
    if (!open) return;
    closeBtnRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  return (
    <div
      className={cx('fixed inset-0 z-[60] lg:hidden', open ? 'pointer-events-auto' : 'pointer-events-none')}
      aria-hidden={!open}
    >
      <button
        type="button"
        className={cx('absolute inset-0 bg-black/40 transition-opacity', open ? 'opacity-100' : 'opacity-0')}
        onClick={onClose}
        tabIndex={open ? 0 : -1}
        aria-label="Close"
      />

      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx(
          'absolute inset-x-0 bottom-0 rounded-t-3xl bg-white shadow-2xl border border-gray-100',
          'transition-transform duration-300 will-change-transform',
          open ? 'translate-y-0' : 'translate-y-full'
        )}
      >
        <div className="px-4 pt-3 pb-2 border-b border-gray-100">
          <div className="mx-auto h-1.5 w-12 rounded-full bg-gray-200" />
          <div className="mt-2 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Preview</div>
              <div className="text-sm sm:text-base font-bold text-gray-900 leading-tight line-clamp-2 break-words">{title}</div>
            </div>
            <button
              ref={closeBtnRef}
              type="button"
              onClick={onClose}
              className="inline-flex items-center justify-center rounded-xl border border-gray-200 bg-white p-2 text-gray-700 hover:border-gray-300"
              aria-label="Close sheet"
            >
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="max-h-[75vh] overflow-y-auto px-4 py-4">{children}</div>
      </div>
    </div>
  );
}

export default function ServiceExplorer({
  services,
  onAskAI,
  onQuickBook,
  popularSlugs,
  className,
}: {
  services: ServiceExplorerItem[];
  onAskAI: () => void;
  onQuickBook: () => void;
  popularSlugs?: string[];
  className?: string;
}) {
  const list = services ?? [];
  const bySlug = useMemo(() => new Map(list.map((s) => [s.slug, s] as const)), [list]);

  const initialActive = useMemo(() => {
    const firstPopular = popularSlugs?.find((slug) => bySlug.has(slug));
    return firstPopular ?? list[0]?.slug ?? '';
  }, [bySlug, popularSlugs, list]);

  const [activeSlug, setActiveSlug] = useState<string>('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSlug, setSheetSlug] = useState<string | null>(null);

  // Initialize selection once we have data (and keep it in sync if the preferred default changes).
  useEffect(() => {
    if (!list.length) return;
    setActiveSlug((prev) => (prev ? prev : initialActive));
  }, [initialActive, list.length]);

  // Keep selection valid.
  useEffect(() => {
    if (!list.length) return;
    if (!list.some((s) => s.slug === activeSlug)) {
      setActiveSlug(list[0].slug);
    }
  }, [activeSlug, list]);

  if (!list.length) return null;

  const active = (bySlug.get(activeSlug) ?? list[0] ?? services[0]) as ServiceExplorerItem | undefined;
  const ActiveIcon = active?.icon;

  const sheetService = (sheetSlug ? bySlug.get(sheetSlug) : null) ?? active ?? services[0];
  const SheetIcon = sheetService?.icon;

  function openSheet(slug: string) {
    setSheetSlug(slug);
    setActiveSlug(slug);
    setSheetOpen(true);
  }

  return (
    <section className={cx('relative overflow-hidden bg-gradient-to-br from-blue-50 via-white to-purple-50', className)}>
      <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20" />
      <div className="absolute -top-40 -right-40 h-[520px] w-[520px] rounded-full bg-blue-400/10 blur-3xl" />
      <div className="absolute -bottom-40 -left-40 h-[520px] w-[520px] rounded-full bg-purple-400/10 blur-3xl" />

      <div className="container mx-auto px-4 sm:px-6 py-16 sm:py-20 md:py-24 relative z-10">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="text-center">
            <AIFeatureBadge text="Our Services" />
            <h2 className="text-3xl sm:text-4xl md:text-5xl font-bold mt-3 mb-4 text-gray-900">
              Everything your car needs, in one place.
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Verified services. Clear pricing. One simple booking.
            </p>

            <div className="mt-8 mx-auto grid w-full max-w-xl grid-cols-2 gap-3 sm:flex sm:w-auto sm:max-w-none sm:items-center sm:justify-center">
              <button
                type="button"
                onClick={onQuickBook}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-blue-100/80 bg-white/55 px-6 py-3 text-brand-primary font-semibold shadow-lg shadow-blue-500/20 backdrop-blur-md hover:bg-white/70 transition-all"
              >
                Quick Book <ArrowRight className="w-5 h-5" />
              </button>
              <button
                type="button"
                onClick={onAskAI}
                className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/80 px-6 py-3 text-gray-900 font-semibold backdrop-blur hover:border-blue-200 hover:text-blue-700 transition-all"
              >
                Ask MISA AI <Sparkles className="w-5 h-5" />
              </button>
              <Link
                href="/car-services"
                className="col-span-2 w-full sm:col-span-1 sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl border border-gray-200 bg-white/70 px-6 py-3 text-gray-900 font-semibold hover:border-gray-300 transition-all"
              >
                Explore All Services <ArrowRight className="w-5 h-5" />
              </Link>
            </div>
          </div>

          {/* Results */}
          <div className="mt-10">
            {list.length ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5 gap-3 sm:gap-4">
                  {/* Featured tile */}
                  {active ? (
                    <div className="col-span-2 md:col-span-2 lg:col-span-2 row-span-1 lg:row-span-2">
                      <div className="relative h-full overflow-hidden rounded-[28px] border border-white/60 bg-white/70 backdrop-blur shadow-2xl shadow-blue-900/10">
                        <div className={cx('absolute inset-0 opacity-60', active.bg)} />
                        <div className="absolute inset-0 bg-gradient-to-br from-white/70 via-white/40 to-white/70" />
                        <div className="relative z-10 p-5 sm:p-6 h-full flex flex-col">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={cx(
                                  'w-12 h-12 rounded-2xl flex items-center justify-center ring-1',
                                  active.bg,
                                  active.color,
                                  active.ring ?? 'ring-black/5'
                                )}
                              >
                                {active?.iconImage ? (
                                  <img src={active.iconImage} alt={active.title} className="w-[70%] h-[70%] object-contain" style={{ mixBlendMode: 'darken' }} />
                                ) : ActiveIcon ? <ActiveIcon className="w-6 h-6" /> : null}
                              </div>
                              <div className="min-w-0">
                                <div className="text-xs font-bold uppercase tracking-wider text-gray-400">Featured</div>
                                <div className="text-lg sm:text-2xl font-extrabold text-gray-900 leading-tight line-clamp-2 break-words">
                                  {active.title}
                                </div>
                              </div>
                            </div>
                            <span className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white/70 px-3 py-1.5 text-xs font-bold text-gray-900">
                              <IndianRupee className="w-3.5 h-3.5 text-gray-500" />
                              {active.priceFrom}
                            </span>
                          </div>

                          <p className="mt-4 text-sm sm:text-base text-gray-700 leading-relaxed line-clamp-3">
                            {active.slug === 'periodic-service'
                              ? 'Guided service booking with transparent inspection and documentation.'
                              : active.desc}
                          </p>

                          <div className="mt-5 grid grid-cols-3 gap-2">
                            <div className="rounded-2xl bg-white/70 border border-gray-100 p-3">
                              <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">From</div>
                              <div className="mt-1 text-sm font-bold text-gray-900">{active.priceFrom}</div>
                            </div>
                            <div className="rounded-2xl bg-white/70 border border-gray-100 p-3">
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">ETA</div>
                                <Clock className="w-4 h-4 text-gray-400" />
                              </div>
                              <div className="mt-1 text-sm font-bold text-gray-900">{active.eta}</div>
                            </div>
                            <div className="rounded-2xl bg-white/70 border border-gray-100 p-3">
                              <div className="flex items-center justify-between">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                                  Warranty
                                </div>
                                <Shield className="w-4 h-4 text-gray-400" />
                              </div>
                              <div className="mt-1 text-sm font-bold text-gray-900">
                                {active.warranty}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 rounded-2xl bg-white/60 border border-gray-100 p-4 flex-1">
                            <div className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
                              <CheckCircle className="w-5 h-5 text-green-500" />
                              What you get
                            </div>
                            <div className="flex flex-wrap gap-2">
                              {active.highlights.slice(0, 6).map((h) => (
                                <span
                                  key={`feat-${h}`}
                                  className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-white/80 px-3 py-1.5 text-xs font-semibold text-gray-700"
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                                  {h}
                                </span>
                              ))}
                            </div>
                          </div>

                          <div className="mt-4 flex flex-col sm:flex-row gap-3">
                            <button
                              type="button"
                              onClick={onQuickBook}
                              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-white font-semibold shadow-lg shadow-blue-600/20"
                            >
                              Quick Book <ArrowRight className="w-5 h-5" />
                            </button>
                            <Link
                              href={`/car-services/${INTERNAL_SLUG_TO_CAR_SERVICES[active.slug] ?? active.slug}`}
                              className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-900 font-semibold"
                            >
                              Know More
                            </Link>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}

                  {/* Service tiles */}
                  {list.map((s) => {
                    const Icon = s.icon;
                    const selected = s.slug === activeSlug;
                    return (
                      <button
                        key={s.slug}
                        type="button"
                        onClick={() => {
                          setActiveSlug(s.slug);
                          if (window.innerWidth < 1024) openSheet(s.slug);
                        }}
                        className={cx(
                          'group text-left rounded-3xl border bg-white/80 backdrop-blur overflow-hidden transition-all',
                          selected
                            ? 'border-blue-200 ring-2 ring-blue-200/30 shadow-lg shadow-blue-900/10'
                            : 'border-gray-100 hover:border-gray-200 hover:shadow-md'
                        )}
                        aria-pressed={selected}
                      >
                        <div className={cx('p-4', s.bg)}>
                          <div className="flex items-start justify-between gap-3">
                            <div
                              className={cx(
                                'w-11 h-11 rounded-2xl bg-white/80 ring-1 ring-black/5 flex items-center justify-center',
                                s.color
                              )}
                            >
                              {s.iconImage ? (
                                <img src={s.iconImage} alt={s.title} className="w-[70%] h-[70%] object-contain" style={{ mixBlendMode: 'darken' }} />
                              ) : (
                                <Icon className="w-6 h-6" />
                              )}
                            </div>
                            <span className="text-[11px] font-bold text-gray-700 bg-white/80 px-2.5 py-1 rounded-full border border-white/60">
                              {s.priceFrom}
                            </span>
                          </div>
                        </div>

                        <div className="p-4">
                          <div className="font-extrabold text-sm sm:text-base text-gray-900 leading-tight line-clamp-2 break-words min-h-[2.4rem]">{s.title}</div>
                          <div className="mt-1 text-xs sm:text-sm text-gray-600 line-clamp-2">{s.desc}</div>

                          <div className="mt-3 flex items-center justify-between text-xs text-gray-500">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="w-3.5 h-3.5" /> {s.eta}
                            </span>
                            <span className="inline-flex items-center gap-1">
                              <Shield className="w-3.5 h-3.5" /> {s.warranty}
                            </span>
                          </div>

                          <div className="mt-3 inline-flex items-center gap-2 text-xs font-bold text-blue-700">
                            Preview <ArrowRight className="w-4 h-4" />
                          </div>
                        </div>
                      </button>
                    );
                  })}
              </div>
            ) : null}
            <p className="mt-6 text-sm text-gray-600 text-center">
              All services are delivered by MY FNG-verified workshops with pricing approval, photo & video proof, and customer support.
            </p>
          </div>
        </div>
      </div>

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title={sheetService?.title ?? 'Service'}>
        {sheetService && (
          <div>
            <div className="flex items-start gap-4">
              <div
                className={cx(
                  'w-14 h-14 rounded-2xl flex items-center justify-center ring-1',
                  sheetService.bg,
                  sheetService.color,
                  sheetService.ring ?? 'ring-black/5'
                )}
              >
                {sheetService?.iconImage ? (
                  <img src={sheetService.iconImage} alt={sheetService.title} className="w-[70%] h-[70%] object-contain" style={{ mixBlendMode: 'darken' }} />
                ) : SheetIcon ? <SheetIcon className="w-7 h-7" /> : null}
              </div>
              <div className="min-w-0">
                <div className="text-sm font-bold text-gray-900">{sheetService.title}</div>
                <div className="mt-1 text-sm text-gray-600 leading-relaxed">{sheetService.desc}</div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2">
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">From</div>
                <div className="mt-1 text-sm font-bold text-gray-900">{sheetService.priceFrom}</div>
              </div>
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Time</div>
                <div className="mt-1 text-sm font-bold text-gray-900">{sheetService.eta}</div>
              </div>
              <div className="rounded-2xl bg-gray-50 border border-gray-100 p-3">
                <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Warranty</div>
                <div className="mt-1 text-sm font-bold text-gray-900">{sheetService.warranty}</div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-white border border-gray-100 p-4">
              <div className="flex items-center gap-2 text-sm font-bold text-gray-900 mb-3">
                <CheckCircle className="w-5 h-5 text-green-500" />
                What you get
              </div>
              <div className="flex flex-wrap gap-2">
                {sheetService.highlights.map((h) => (
                  <span
                    key={`sh-${h}`}
                    className="inline-flex items-center gap-2 rounded-full border border-gray-100 bg-gray-50 px-3 py-1.5 text-xs font-semibold text-gray-700"
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
                    {h}
                  </span>
                ))}
              </div>
            </div>

            <div className="mt-5 flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setSheetOpen(false);
                  onQuickBook();
                }}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-blue-600 to-purple-600 px-5 py-3 text-white font-semibold shadow-lg shadow-blue-600/20"
              >
                Quick Book <ArrowRight className="w-5 h-5" />
              </button>
              <Link
                href={`/car-services/${INTERNAL_SLUG_TO_CAR_SERVICES[sheetService.slug] ?? sheetService.slug}`}
                onClick={() => setSheetOpen(false)}
                className="flex-1 inline-flex items-center justify-center gap-2 rounded-2xl border border-gray-200 bg-white px-5 py-3 text-gray-900 font-semibold"
              >
                Know More
              </Link>
            </div>
          </div>
        )}
      </BottomSheet>
    </section>
  );
}


