'use client';

import { Check, ClipboardList, X } from 'lucide-react';

export type BookingSummaryData = {
  service?: string;
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

  const data: BookingSummaryData = {
    service: pick([/🔧\s*Service:\s*(.+)/i, /Service:\s*(.+)/i]),
    price: pick([/💰\s*Price:\s*(.+)/i, /Price:\s*(.+)/i]),
    car: pick([/🚗\s*Car:\s*(.+)/i, /Car:\s*(.+)/i]),
    vehicleNo: pick([/🚘\s*Vehicle No:\s*(.+)/i, /Vehicle No:\s*(.+)/i]),
    pinCode: pick([/📍\s*PIN Code:\s*(.+)/i, /PIN Code:\s*(.+)/i]),
    name: pick([/👤\s*Name:\s*(.+)/i, /Name:\s*(.+)/i]),
    phone: pick([/📞\s*Phone:\s*(.+)/i, /Phone:\s*(.+)/i]),
    address: pick([/🏠\s*Address:\s*(.+)/i, /Address:\s*(.+)/i]),
    date: pick([/📅\s*Date:\s*(.+)/i, /Date:\s*(.+)/i]),
    time: pick([/🕐\s*Time:\s*(.+)/i, /Time:\s*(.+)/i]),
  };

  const hasContent = Object.values(data).some(Boolean);
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
  return (
    <div className="mt-2 overflow-hidden rounded-xl border border-brand-primary/20 bg-white shadow-sm">
      <div className="flex items-center gap-2 bg-gradient-to-r from-brand-secondary to-brand-primary px-3 py-2 text-white">
        <ClipboardList className="h-4 w-4" />
        <span className="text-xs font-bold tracking-wide">Booking Summary</span>
      </div>

      <div className="space-y-2 p-3">
        <div className="grid grid-cols-2 gap-2 rounded-lg bg-gray-50 p-2.5">
          <Cell label="Service" value={summary.service} />
          <Cell label="Price" value={summary.price} />
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
