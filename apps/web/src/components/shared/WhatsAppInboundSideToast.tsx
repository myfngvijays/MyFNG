'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';
import { formatPhoneDisplay } from '@/lib/phoneIntl';

type ToastPayload = {
  phone: string;
  preview: string;
  customerName?: string;
};

const AUTO_DISMISS_MS = 14_000;

export default function WhatsAppInboundSideToast({
  enabled,
  onOpenChat,
}: {
  enabled: boolean;
  onOpenChat: (phone: string, preview: string) => void;
}) {
  const [toast, setToast] = useState<ToastPayload | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dismiss = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = null;
    setToast(null);
  }, []);

  useEffect(() => {
    const onToast = (ev: Event) => {
      if (!enabled) return;
      const detail = (ev as CustomEvent<ToastPayload>).detail;
      const phone = String(detail?.phone || '').replace(/\D/g, '');
      if (phone.length < 10) return;
      const preview = String(detail?.preview || '').trim() || 'New WhatsApp message';
      const customerName = String(detail?.customerName || '').trim();
      setToast({ phone, preview, customerName });
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => dismiss(), AUTO_DISMISS_MS);
    };
    window.addEventListener('myfng:wa-inbound-toast', onToast as EventListener);
    return () => {
      window.removeEventListener('myfng:wa-inbound-toast', onToast as EventListener);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [dismiss, enabled]);

  useEffect(() => {
    if (!enabled) dismiss();
  }, [dismiss, enabled]);

  if (!toast) return null;

  const displayPhone = formatPhoneDisplay(toast.phone) || toast.phone;
  const title = toast.customerName || displayPhone;

  return (
    <div
      className="fixed z-[62] w-[min(22rem,calc(100vw-5.5rem))] animate-in slide-in-from-right-4 fade-in duration-300 bottom-[calc(5.25rem+env(safe-area-inset-bottom))] right-[max(1rem,env(safe-area-inset-right))]"
      role="status"
      aria-live="polite"
    >
      <div className="overflow-hidden rounded-2xl border border-emerald-200/80 bg-white shadow-2xl ring-1 ring-black/5">
        <div className="flex items-center gap-2 bg-[#25D366] px-3 py-2 text-white">
          <WhatsAppIcon className="h-5 w-5 shrink-0" />
          <span className="flex-1 text-sm font-bold">WhatsApp</span>
          <button
            type="button"
            onClick={dismiss}
            className="rounded-full p-1 hover:bg-white/20"
            aria-label="Dismiss"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <button
          type="button"
          className="w-full px-3 py-3 text-left hover:bg-slate-50"
          onClick={() => {
            onOpenChat(toast.phone, toast.preview);
            dismiss();
          }}
        >
          <p className="truncate text-sm font-bold text-slate-900">{title}</p>
          {toast.customerName ? (
            <p className="mt-0.5 truncate text-xs text-slate-500">{displayPhone}</p>
          ) : null}
          <p className="mt-2 line-clamp-3 text-[13px] leading-snug text-slate-700">{toast.preview}</p>
          <p className="mt-2 text-xs font-bold text-[#004AAD]">Open chat →</p>
        </button>
      </div>
    </div>
  );
}