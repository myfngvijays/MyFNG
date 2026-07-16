'use client';

import Image from 'next/image';
import { Car, ChevronLeft, Clock, Crown, Wrench } from 'lucide-react';
import { DEFAULT_APP_STORE_URL, DEFAULT_PLAY_STORE_URL } from '@/lib/mobile-app-version-config';

export const OTHER_SERVICES = [
  { name: 'AC Service', message: 'AC service chahiye', icon: '/icon-ac-service.png' },
  { name: 'Battery', message: 'Battery service chahiye', icon: '/icon-battery-service.png' },
  { name: 'Brake', message: 'Brake service chahiye', icon: '/icon-brake-service.png' },
  { name: 'Engine', message: 'Engine service chahiye', icon: '/icon-engine-service.png' },
  { name: 'Clutch', message: 'Clutch service chahiye', icon: '/icon-clutch-service.png' },
  { name: 'Tyre & Wheel', message: 'Tyre and wheel care chahiye', icon: '/icon-tyre-service.png' },
  { name: 'Detailing', message: 'Car detailing chahiye', icon: '/icon-detailing-service.png' },
  { name: 'Denting', message: 'Denting painting chahiye', icon: '/icon-denting-service.png' },
  { name: 'Electrical', message: 'Electrical service chahiye', icon: '/icon-electrical-service.png' },
  { name: 'Suspension', message: 'Suspension service chahiye', icon: '/icon-suspension-service.png' },
] as const;

export function assistantMessageShowsServiceList(text: string): boolean {
  const lines = String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const bullets = lines.filter((l) => /^[-•*]\s/.test(l) || /^\d+[.)]\s/.test(l));
  const serviceHits = bullets.filter((l) => /service|tyre|wheel|detailing|denting|electrical|suspension|battery|brake|clutch|engine|ac/i.test(l));
  return serviceHits.length >= 3;
}

type CategoryCardsProps = {
  onPrime: () => void;
  onPeriodic: () => void;
  onOther: () => void;
};

export function MisaCategoryCards({ onPrime, onPeriodic, onOther }: CategoryCardsProps) {
  return (
    <div className="mt-4">
      <p className="mb-2.5 text-xs font-semibold text-gray-500">Choose a category</p>
      <div className="grid grid-cols-3 gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={onPrime}
          className="rounded-2xl border border-brand-secondary/20 bg-white p-3 text-center shadow-sm transition hover:border-brand-secondary/40 hover:shadow-md sm:p-3.5"
        >
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-secondary to-brand-primary">
            <Crown className="h-5 w-5 text-white" />
          </div>
          <div className="text-xs font-semibold text-gray-900 sm:text-sm">Prime</div>
          <div className="text-[10px] text-gray-500 sm:text-[11px]">Membership</div>
        </button>
        <button
          type="button"
          onClick={onPeriodic}
          className="rounded-2xl border border-brand-primary/25 bg-white p-3 text-center shadow-sm transition hover:border-brand-primary/50 hover:shadow-md sm:p-3.5"
        >
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-brand-primary to-sky-400">
            <Wrench className="h-5 w-5 text-white" />
          </div>
          <div className="text-xs font-semibold text-gray-900 sm:text-sm">Periodic</div>
          <div className="text-[10px] text-gray-500 sm:text-[11px]">Service</div>
        </button>
        <button
          type="button"
          onClick={onOther}
          className="rounded-2xl border border-emerald-200 bg-white p-3 text-center shadow-sm transition hover:border-emerald-300 hover:shadow-md sm:p-3.5"
        >
          <div className="mx-auto mb-2 flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500 to-teal-500">
            <Car className="h-5 w-5 text-white" />
          </div>
          <div className="text-xs font-semibold text-gray-900 sm:text-sm">Other</div>
          <div className="text-[10px] text-gray-500 sm:text-[11px]">Services</div>
        </button>
      </div>
    </div>
  );
}

type ServiceGridProps = {
  onBack: () => void;
  onSelect: (message: string, label: string) => void;
};

export function MisaServiceGrid({ onBack, onSelect }: ServiceGridProps) {
  return (
    <div className="mt-4 rounded-2xl border border-brand-primary/10 bg-white p-3 shadow-sm sm:p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-brand-secondary">Select a service</p>
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 hover:text-brand-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          Back
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2 sm:gap-2.5">
        {OTHER_SERVICES.map((s) => (
          <button
            key={s.name}
            type="button"
            onClick={() => onSelect(s.message, s.name)}
            className="rounded-xl border border-gray-100 bg-white p-2.5 text-center transition hover:border-brand-primary/30 hover:bg-brand-primary/5 sm:p-3"
          >
            <div className="relative mx-auto mb-1.5 h-11 w-11 sm:h-12 sm:w-12">
              <Image src={s.icon} alt={s.name} fill className="object-contain" sizes="48px" />
            </div>
            <div className="text-[10px] font-semibold leading-tight text-gray-800 sm:text-[11px]">{s.name}</div>
          </button>
        ))}
      </div>
    </div>
  );
}

type PrimePanelProps = {
  onBack: () => void;
};

export function MisaPrimePanel({ onBack }: PrimePanelProps) {
  return (
    <div className="mt-4 overflow-hidden rounded-2xl border border-brand-secondary/15 shadow-sm">
      <div className="bg-gradient-to-br from-brand-secondary via-brand-primary to-purple-700 p-4 text-white sm:p-5">
        <h3 className="text-base font-bold text-yellow-300 sm:text-lg">
          Get MyFNG <span className="text-white">Prime</span> Membership
        </h3>
        <p className="mt-1 text-lg font-bold text-yellow-300">@ just ₹699/year!</p>

        <div className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/15 px-2.5 py-1 text-xs font-semibold">
          <Clock className="h-3 w-3" />
          LIMITED TIME OFFER
        </div>

        <div className="mt-4 grid grid-cols-1 gap-1.5">
          {[
            { icon: '%', text: '10% Off Periodic Packages' },
            { icon: '💰', text: '5% Cashback to Wallet' },
            { icon: '🔧', text: 'Free Top-Up & Inspection (2x)' },
            { icon: '🔍', text: 'Free Car Scanning (2x)' },
            { icon: '📋', text: 'Free Insurance Claim Help' },
            { icon: '💬', text: 'Prime Personal WhatsApp Group' },
            { icon: '⏰', text: 'Priority Slot Booking' },
            { icon: '🛡️', text: '6-Month Extended Warranty' },
          ].map((item) => (
            <div key={item.text} className="flex items-center gap-2 text-sm">
              <span className="text-yellow-300">{item.icon}</span>
              <span>{item.text}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex gap-2">
          <a
            href={DEFAULT_PLAY_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-black px-3 py-2.5 text-white transition hover:bg-gray-900"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M3.609 1.814L13.792 12 3.61 22.186a.996.996 0 0 1-.61-.92V2.734a1 1 0 0 1 .609-.92zm10.89 10.893l2.302 2.302-10.937 6.333 8.635-8.635zm3.199-3.199l2.302 2.302a1 1 0 0 1 0 1.38l-2.302 2.302L15.396 13l2.302-2.492zM5.864 2.658L16.8 8.99l-2.302 2.302L5.864 2.658z" />
            </svg>
            <div className="text-left">
              <div className="text-[8px] leading-tight opacity-70">GET IT ON</div>
              <div className="text-xs font-semibold leading-tight">Google Play</div>
            </div>
          </a>
          <a
            href={DEFAULT_APP_STORE_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-black px-3 py-2.5 text-white transition hover:bg-gray-900"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.8-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
            </svg>
            <div className="text-left">
              <div className="text-[8px] leading-tight opacity-70">DOWNLOAD ON THE</div>
              <div className="text-xs font-semibold leading-tight">App Store</div>
            </div>
          </a>
        </div>
      </div>
      <button
        type="button"
        onClick={onBack}
        className="w-full border-t border-gray-100 bg-white py-2.5 text-xs font-medium text-gray-500 hover:text-brand-primary"
      >
        ← Back to options
      </button>
    </div>
  );
}
