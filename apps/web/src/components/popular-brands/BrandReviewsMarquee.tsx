'use client';

import { useLayoutEffect, useRef } from 'react';
import AIFeatureBadge from '@/components/landing/AIFeatureBadge';
import type { BrandTestimonial } from '@/lib/popular-brands';

type Props = {
  brandName: string;
  testimonials: BrandTestimonial[];
};

const KEYFRAMES_ID = 'myfng-brand-reviews-keyframes-v3';

const AVATAR_COLORS = ['#0a3d91', '#0088e8', '#0367C4', '#9334e6', '#15803d', '#b45309', '#0f766e'];

function ensureReviewKeyframes() {
  if (typeof document === 'undefined' || document.getElementById(KEYFRAMES_ID)) return;
  const style = document.createElement('style');
  style.id = KEYFRAMES_ID;
  style.textContent = `
    @keyframes myfngReviewsLeftV3 {
      from { transform: translate3d(0, 0, 0); }
      to { transform: translate3d(-50%, 0, 0); }
    }
    @keyframes myfngReviewsRightV3 {
      from { transform: translate3d(-50%, 0, 0); }
      to { transform: translate3d(0, 0, 0); }
    }
  `;
  document.head.appendChild(style);
}

function StarRow({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((s) => (
        <svg
          key={s}
          className={`h-2.5 w-2.5 sm:h-3.5 sm:w-3.5 ${s <= rating ? 'text-[#f4b400]' : 'text-[#ddd]'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
    </div>
  );
}

function ReviewCard({ review }: { review: BrandTestimonial }) {
  const initial = (review.name || '?')[0].toUpperCase();
  const colorIndex = review.name.charCodeAt(0) % AVATAR_COLORS.length;

  return (
    <div className="w-[calc(33.333vw-14px)] max-w-[112px] shrink-0 rounded-lg border border-[#e8ecf4] bg-[#f8fafc] p-2 sm:w-[300px] sm:max-w-none sm:rounded-xl sm:p-4 md:w-[320px]">
      <div className="mb-1.5 flex items-start gap-1.5 sm:mb-2 sm:gap-2.5">
        {review.authorPhoto ? (
          <img
            src={review.authorPhoto}
            alt=""
            className="h-6 w-6 shrink-0 rounded-full object-cover sm:h-9 sm:w-9"
          />
        ) : (
          <div
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold text-white sm:h-9 sm:w-9 sm:text-[13px]"
            style={{ backgroundColor: AVATAR_COLORS[colorIndex] }}
          >
            {initial}
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[9px] font-semibold leading-tight text-[#202124] sm:text-[13px]">
            <span className="sm:hidden">{review.name.split(' ')[0]}</span>
            <span className="hidden sm:inline">{review.name}</span>
          </p>
          <p className="truncate text-[8px] text-[#70757a] sm:text-[11px]">
            <span className="sm:hidden">{review.relativeTime || 'Recently'}</span>
            <span className="hidden sm:inline">
              {review.relativeTime || 'Recently'}
              {review.location ? ` · ${review.location}` : ''}
            </span>
          </p>
        </div>
      </div>
      <StarRow rating={review.rating} />
      {review.text ? (
        <p className="mt-1 line-clamp-2 text-[8px] leading-snug text-[#3c4043] sm:mt-2 sm:line-clamp-4 sm:text-[13px] sm:leading-[1.55]">
          {review.text}
        </p>
      ) : null}
      {review.vehicle ? (
        <p className="mt-1 line-clamp-2 text-[7px] font-medium leading-tight text-[#70757a] sm:mt-2 sm:line-clamp-none sm:text-[11px]">
          <span className="sm:hidden">{review.vehicle}</span>
          <span className="hidden sm:inline">Serviced: {review.vehicle}</span>
        </p>
      ) : null}
    </div>
  );
}

function getDurationSec(direction: 'left' | 'right', isDesktop: boolean) {
  if (isDesktop) return direction === 'left' ? 60 : 65;
  return direction === 'left' ? 28 : 32;
}

function MarqueeRow({
  items,
  direction = 'left',
}: {
  items: BrandTestimonial[];
  direction?: 'left' | 'right';
}) {
  const trackRef = useRef<HTMLDivElement>(null);
  const doubled = [...items, ...items];

  useLayoutEffect(() => {
    const track = trackRef.current;
    if (!track) return;

    ensureReviewKeyframes();

    const apply = () => {
      const isDesktop = window.matchMedia('(min-width: 640px)').matches;
      const duration = getDurationSec(direction, isDesktop);
      const name = direction === 'left' ? 'myfngReviewsLeftV3' : 'myfngReviewsRightV3';
      track.style.animation = `${name} ${duration}s linear infinite`;
    };

    apply();
    const mq = window.matchMedia('(min-width: 640px)');
    mq.addEventListener('change', apply);
    return () => {
      mq.removeEventListener('change', apply);
      track.style.animation = '';
    };
  }, [items, direction]);

  return (
    <div className="w-full overflow-hidden px-1 sm:px-0">
      <div ref={trackRef} className="flex w-max will-change-transform gap-2 sm:gap-4">
        {doubled.map((review, index) => (
          <ReviewCard key={`${review.name}-${review.vehicle}-${index}`} review={review} />
        ))}
      </div>
    </div>
  );
}

export default function BrandReviewsMarquee({ brandName, testimonials }: Props) {
  if (!testimonials.length) return null;

  const avgRating =
    Math.round((testimonials.reduce((sum, r) => sum + r.rating, 0) / testimonials.length) * 10) / 10;

  const row1 = testimonials.slice(0, Math.ceil(testimonials.length / 2));
  const row2 = testimonials.slice(Math.ceil(testimonials.length / 2));

  return (
    <section className="overflow-hidden bg-gray-50 py-10 pt-8 sm:py-14 md:py-20" data-reviews-marquee="v3">
      <div className="mx-auto mb-5 max-w-6xl px-4 text-center sm:mb-8 md:mb-10">
        <AIFeatureBadge text="Customer Reviews" />
        <h2 className="mt-3 text-xl font-black leading-snug text-brand-secondary sm:text-2xl md:text-4xl">
          What {brandName} Owners Say
        </h2>
        <p className="mx-auto mt-3 hidden max-w-2xl text-sm text-gray-600 sm:block sm:text-base">
          Real feedback from customers who serviced their {brandName} with MYFNG
        </p>
        <div className="mx-auto mt-4 inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-1.5 shadow-sm sm:mt-5 sm:gap-3 sm:px-5 sm:py-2">
          <span className="text-xl font-bold text-brand-secondary sm:text-2xl">{avgRating}</span>
          <div className="text-left">
            <StarRow rating={Math.round(avgRating)} />
            <p className="mt-0.5 text-[10px] text-gray-500 sm:text-xs">{testimonials.length} verified reviews</p>
          </div>
        </div>
      </div>

      <div className="space-y-2 sm:space-y-4">
        <MarqueeRow items={row1} direction="left" />
        <MarqueeRow items={row2.length ? row2 : row1} direction="right" />
      </div>
    </section>
  );
}
