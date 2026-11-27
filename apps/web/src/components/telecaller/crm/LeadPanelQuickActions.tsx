'use client';

import { CheckSquare, ChevronDown, Loader2, PhoneCall } from 'lucide-react';
import WhatsAppIcon from '@/components/icons/WhatsAppIcon';

export default function LeadPanelQuickActions({
  onCall,
  onWhatsApp,
  onTask,
  onSendPricing,
  calling = false,
  sendingPricing = false,
  sendPricingReady = true,
  phone,
  sticky = true,
}: {
  onCall: () => void;
  onWhatsApp: () => void;
  onTask: () => void;
  onSendPricing: () => void;
  calling?: boolean;
  sendingPricing?: boolean;
  /** Pincode + car model filled — required before send pricing */
  sendPricingReady?: boolean;
  phone?: string | null;
  sticky?: boolean;
}) {
  const hasPhone = Boolean(String(phone || '').replace(/\D/g, '').length >= 10);
  const pricingOk = sendPricingReady && hasPhone;

  const btn =
    'flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 transition hover:bg-white/10 disabled:opacity-45';

  return (
    <div
      className={`shrink-0 bg-[#023D95] shadow-[0_-8px_28px_rgba(15,23,42,0.4)] ${
        sticky ? 'sticky bottom-0 z-50' : ''
      }`}
    >
      <div className="h-px w-full bg-white/35" aria-hidden />
      <div
        className={`flex items-stretch px-2 pb-[max(0.85rem,env(safe-area-inset-bottom,0px))] pt-2.5 ${
          sticky ? '' : ''
        }`}
      >
      <button type="button" className={btn} disabled={!hasPhone || calling} onClick={onCall} title="Call">
        <PhoneCall
          className={`h-5 w-5 text-white ${calling ? 'animate-pulse text-emerald-300' : ''}`}
        />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/95">Call</span>
      </button>
      <button type="button" className={btn} onClick={onTask} title="Task / reminder">
        <span className="inline-flex items-center gap-0.5 text-white">
          <CheckSquare className="h-5 w-5" />
          <ChevronDown className="h-3 w-3 text-white/70" aria-hidden />
        </span>
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/95">Task</span>
      </button>
      <button type="button" className={btn} disabled={!hasPhone} onClick={onWhatsApp} title="WhatsApp chat">
        <WhatsAppIcon className="h-5 w-5 text-[#7dffb0]" />
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/95">WhatsApp</span>
      </button>
      <button
        type="button"
        className={`${btn} ${!pricingOk ? 'opacity-75' : ''}`}
        disabled={!hasPhone || sendingPricing}
        onClick={onSendPricing}
        title={
          pricingOk
            ? 'Send pricing on WhatsApp'
            : 'Fill 6-digit pincode and car model first'
        }
      >
        {sendingPricing ? (
          <Loader2 className="h-5 w-5 animate-spin text-white" />
        ) : (
          <span className="relative flex h-5 w-5 items-center justify-center">
            <WhatsAppIcon className="h-5 w-5 text-[#7dffb0]" />
          </span>
        )}
        <span className="max-w-[4.5rem] text-center text-[9px] font-bold uppercase leading-tight tracking-wide text-white/95">
          Send pricing
        </span>
      </button>
      </div>
      <div className="h-[3px] w-full bg-white" aria-hidden />
    </div>
  );
}