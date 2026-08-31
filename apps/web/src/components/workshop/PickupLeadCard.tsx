'use client';

import Link from 'next/link';
import { Car, ChevronRight, MapPin, Phone } from 'lucide-react';

type Props = {
  leadNumber?: string | null;
  customerName?: string | null;
  customerPhone?: string | null;
  vehicleNumber?: string | null;
  vehicleMake?: string | null;
  vehicleModel?: string | null;
  taskType: 'PICKUP' | 'DELIVERY';
  statusLabel?: string;
  statusColor?: string;
  address?: string | null;
  footerText?: string | null;
  href: string;
};

export default function PickupLeadCard({
  leadNumber,
  customerName,
  customerPhone,
  vehicleNumber,
  vehicleMake,
  vehicleModel,
  taskType,
  statusLabel,
  statusColor = '#004AAD',
  address,
  footerText,
  href,
}: Props) {
  const vehicleLine = [vehicleNumber, vehicleMake, vehicleModel].filter(Boolean).join(' · ');
  const typeColor = taskType === 'PICKUP' ? '#EA580C' : '#0284C7';
  const label = statusLabel || 'Pending';

  return (
    <Link
      href={href}
      className="block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
    >
      <div className="flex items-center justify-between gap-2 bg-[#004AAD] px-3.5 py-2.5">
        <p className="min-w-0 flex-1 truncate text-[11px] font-extrabold uppercase tracking-wide text-white/90">
          {leadNumber || 'Lead'}
        </p>
        <span
          className="inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wide text-white"
          style={{ backgroundColor: `${typeColor}55` }}
        >
          <Car className="h-3 w-3" />
          {taskType}
        </span>
      </div>

      <div className="px-3.5 py-3">
        <div className="mb-1 flex items-start justify-between gap-3">
          <h3 className="min-w-0 flex-1 truncate text-[17px] font-extrabold tracking-tight text-[#023D95]">
            {customerName || 'Customer'}
          </h3>
          <span
            className="inline-flex max-w-[46%] shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-[10px] font-extrabold"
            style={{ backgroundColor: `${statusColor}18`, color: statusColor }}
          >
            <span className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: statusColor }} />
            <span className="truncate">{label}</span>
          </span>
        </div>

        {vehicleLine ? (
          <p className="mb-2 truncate text-xs font-semibold text-slate-500">{vehicleLine}</p>
        ) : null}

        {address ? (
          <div className="mb-2.5 flex items-start gap-2 rounded-xl bg-[#F0F7FF] px-2.5 py-2">
            <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#004AAD]" />
            <p className="line-clamp-2 text-xs font-semibold leading-5 text-slate-700">{address}</p>
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-2.5">
          {footerText ? (
            <p className="min-w-0 flex-1 truncate text-[11px] font-semibold text-slate-500">{footerText}</p>
          ) : (
            <span className="flex-1" />
          )}
          <div className="flex items-center gap-2">
            {customerPhone ? (
              <a
                href={`tel:${customerPhone}`}
                onClick={(e) => e.stopPropagation()}
                className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#EFF6FF] text-[#004AAD]"
                aria-label="Call customer"
              >
                <Phone className="h-3.5 w-3.5" />
              </a>
            ) : null}
            <ChevronRight className="h-4 w-4 text-slate-400" />
          </div>
        </div>
      </div>
    </Link>
  );
}
