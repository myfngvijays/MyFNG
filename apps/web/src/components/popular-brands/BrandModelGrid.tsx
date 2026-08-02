'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Car } from 'lucide-react';
import type { BrandModelCard } from '@/lib/popular-brand-models';

type Props = {
  brandName: string;
  models: BrandModelCard[];
};

function ModelImage({ candidates, alt }: { candidates: string[]; alt: string }) {
  const [index, setIndex] = useState(0);
  const src = candidates[index] || candidates[candidates.length - 1];

  useEffect(() => {
    setIndex(0);
  }, [candidates.join('|')]);

  return (
    <img
      src={src}
      alt={alt}
      className="max-h-full max-w-full object-contain transition duration-300 group-hover:scale-105"
      onError={() => {
        if (index < candidates.length - 1) {
          setIndex((prev) => prev + 1);
        }
      }}
    />
  );
}

export default function BrandModelGrid({ brandName, models }: Props) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 md:grid-cols-4 lg:grid-cols-6">
      {models.map((model) => (
        <Link
          key={model.id}
          href={model.bookUrl}
          className="group flex flex-col overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm transition-all duration-300 hover:-translate-y-1 hover:border-brand-primary/40 hover:shadow-lg"
        >
          <div className="flex h-24 items-center justify-center bg-gradient-to-b from-slate-50 to-white p-2.5 sm:h-28 sm:p-3 md:h-32">
            <ModelImage
              candidates={model.imageCandidates}
              alt={model.fullDisplayName || `${brandName} ${model.displayName}`}
            />
          </div>
          <div className="flex min-h-[44px] items-start justify-between gap-1 border-t border-gray-100 px-2 py-2 sm:min-h-[48px] sm:px-3 sm:py-2.5">
            <span className="line-clamp-2 text-[10px] font-bold leading-tight text-brand-secondary group-hover:text-brand-primary sm:text-xs md:text-sm">
              {model.fullDisplayName || `${brandName} ${model.displayName}`}
            </span>
            <Car className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand-primary opacity-0 transition group-hover:opacity-100 sm:h-4 sm:w-4" />
          </div>
        </Link>
      ))}
    </div>
  );
}
