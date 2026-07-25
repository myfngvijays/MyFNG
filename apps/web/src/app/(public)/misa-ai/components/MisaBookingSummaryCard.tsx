'use client';

import { Check, ClipboardList, X } from 'lucide-react';

export type BookingSummaryService = {
  name: string;
  price?: string;
};

export type BookingSummaryData = {
  service?: string;
  services?: BookingSummaryService[];
  price?: string;
  car?: string;
  vehicleNo?: string;
  pinCode?: string;
  name?: string;
  phone?: string;
  address?: string;
  date?: string;
  time?: string;
};

export function assistantShowsBookingSummary(text: string): boolean {
  return /booking summary/i.test(String(text || ''));
}

function parseServiceBulletLines(raw: string): BookingSummaryService[] {
  const services: BookingSummaryService[] = [];
  for (const line of raw.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const bulletMatch = trimmed.match(/^[•\-*]\s*(.+?)(?:\s*[:–-]\s*(?:₹|Rs\.?\s*)?([\d,]+(?:\.\d+)?))?$/i);
    if (!bulletMatch?.[1]) continue;
    services.push({
      name: bulletMatch[1].trim(),
      price: bulletMatch[2] ? `₹${bulletMatch[2]}` : undefined,
    });
  }
  return services;
}

export function parseBookingSummary(text: string): BookingSummaryData | null {
  const raw = String(text || '');
  if (!assistantShowsBookingSummary(raw)) return null;

  const pick = (patterns: RegExp[]) => {
    for (const pattern of patterns) {
      const m = raw.match(pattern);
      if (m?.[1]?.trim()) return m[1].trim();
    }
    return undefined;
  };

  const servicesBlock = pick([/🔧\s*Services:\s*([\s\S]*?)(?:\n\s*\n|💰|🚗|👤|📞|🏠|📅|🕐|━|$)/i]);
  const services = servicesBlock ? parseServiceBulletLines(servicesBlock) : [];

  const data: BookingSummaryData = {
    service: pick([/🔧\s*Service:\s*(.+)/i, /Service:\s*(.+)/i]),
    services: services.length > 0 ? services : undefined,
    price: pick([/💰\s*Price:\s*(.+)/i, /Total(?: Price)?:\s*(.+)/i, /Price:\s*(.+)/i]),
    car: pick([/🚗\s*Car:\s*(.+)/i, /Car:\s*(.+)/i]),
    vehicleNo: pick([/🚘\s*Vehicle No:\s*(.+)/i, /Vehicle No:\s*(.+)/i]),
    pinCode: pick([/📍\s*PIN Code:\s*(.+)/i, /PIN Code:\s*(.+)/i]),
    name: pick([/👤\s*Name:\s*(.+)/i, /Name:\s*(.+)/i]),
    phone: pick([/📞\s*Phone:\s*(.+)/i, /Phone:\s*(.+)/i]),
    address: pick([/🏠\s*Address:\s*(.+)/i, /Address:\s*(.+)/i]),
    date: pick([/📅\s*Date:\s*(.+)/i, /Date:\s*(.+)/i]),
    time: pick([/🕐\s*Time:\s*(.+)/i, /Time:\s*(.+)/i]),
  };

  if (services.length > 0) {
    data.service = services.map((service) => service.name).join(', ');
    if (!data.price) {
      const total = services.reduce((sum, service) => {
        const amount = Number(String(service.price || '').replace(/[^\d.]/g, ''));
        return sum + (Number.isFinite(amount) ? amount : 0);
      }, 0);
      if (total > 0) data.price = `₹${total.toLocaleString('en-IN')}`;
    }
  }

  const hasContent = Object.values(data).some((value) => {
    if (Array.isArray(value)) return value.length > 0;
    return Boolean(value);
  });
  return hasContent ? data : null;
}

export function extractBookingSummaryPrompt(_text: string): string {
  return 'Please review your booking details below';
}

type Props = {
  summary: BookingSummaryData;
  onConfirm: () => void;
  onReject: () => void;
};

function Cell({ label, value }: { label: string; value?: string }) {
  if (!value) return null;
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">{label}</div>
      <div className="mt-0.5 truncate text-sm font-medium text-gray-900" title={value}>
        {value}
      </div>
    </div>
  );
}

export function MisaBookingSummaryCard({ summary, onConfirm, onReject }: Props) {
  const services = summary.services?.length ? summary.services : summary.service ? [{ name: summary.service, price: summary.price }] : [];

  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-brand-primary/20 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-gradient-to-r from-brand-secondary to-brand-primary px-3 py-2 text-white">
        <ClipboardList className="h-4 w-4" />
        <span className="text-xs font-bold tracking-wide">Booking Summary</span>
      </div>

      <div className="space-y-2 p-3">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2.5">
          {services.length > 1 ? (
            <div className="col-span-2 min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Services</div>
              <ul className="mt-1 space-y-1">
                {services.map((service, index) => (
                  <li key={`${service.name}-${index}`} className="flex items-start justify-between gap-2 text-sm">
                    <span className="font-medium text-gray-900">{service.name}</span>
                    {service.price ? <span className="shrink-0 font-semibold text-gray-900">{service.price}</span> : null}
                  </li>
                ))}
              </ul>
              {summary.price ? (
                <div className="mt-2 flex items-center justify-between border-t border-gray-200 pt-2 text-sm">
                  <span className="font-semibold text-gray-700">Total</span>
                  <span className="font-bold text-gray-900">{summary.price}</span>
                </div>
              ) : null}
            </div>
          ) : (
            <>
              <Cell label="Service" value={summary.service} />
              <Cell label="Price" value={summary.price} />
            </>
          )}
          <Cell label="Car" value={summary.car} />
          <Cell label="Vehicle" value={summary.vehicleNo} />
          <Cell label="PIN" value={summary.pinCode} />
          <Cell label="Time" value={summary.time} />
        </div>

        <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2.5">
          <Cell label="Name" value={summary.name} />
          <Cell label="Phone" value={summary.phone} />
          <div className="col-span-2 min-w-0">
            <div className="text-[10px] font-semibold uppercase tracking-wide text-gray-400">Address</div>
            <div className="mt-0.5 line-clamp-2 text-sm font-medium text-gray-900">{summary.address}</div>
          </div>
          <Cell label="Date" value={summary.date} />
        </div>
      </div>

      <div className="flex gap-2 border-t border-gray-100 bg-gray-50/80 p-2.5">
        <button
          type="button"
          onClick={onConfirm}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-brand-primary py-2.5 text-xs font-semibold text-white sm:text-sm"
        >
          <Check className="h-3.5 w-3.5" />
          Yes, confirm
        </button>
        <button
          type="button"
          onClick={onReject}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-gray-200 bg-white py-2.5 text-xs font-semibold text-gray-700 sm:text-sm"
        >
          <X className="h-3.5 w-3.5" />
          No, edit
        </button>
      </div>
    </div>
  );
}
