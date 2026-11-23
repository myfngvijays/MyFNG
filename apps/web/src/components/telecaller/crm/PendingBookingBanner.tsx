'use client';

import { useState } from 'react';
import { Bell, CheckCircle2, PhoneCall } from 'lucide-react';
import toast from 'react-hot-toast';
import { createClient } from '@/lib/supabase/client';
import { formatDateTimeIST } from '@/lib/utils';
import { isPendingBookingLead } from '@/lib/telecaller/leadSourceTag';
import { useCrmPermissions } from '@/lib/telecaller/useCrmPermissions';

const BOOKING_EVENTS = new Set(['NEW_BOOKING', 'REBOOK', 'REBOOK_FROM_LOST', 'OTP_BOOKING_COMPLETED']);

/** "booking (App Booking)" → "App Booking" */
function channelFromMeta(meta: Record<string, any>): string {
  const raw = String(meta.priority_booking_source || '').trim();
  const m = raw.match(/\(([^)]+)\)/);
  return (m?.[1] || '').trim();
}

/**
 * Lead detail: yellow banner while a customer's App / Website / MISA booking is not called yet.
 * Goes away after a call, a status change from Fresh, or "Mark as called".
 */
export default function PendingBookingBanner({
  lead,
  calling,
  onCall,
  onUpdated,
}: {
  lead: any;
  calling?: boolean;
  onCall: () => void;
  onUpdated: () => void;
}) {
  const { permissions } = useCrmPermissions();
  const [saving, setSaving] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (hidden || !isPendingBookingLead(lead)) return null;

  const meta = lead?.coupon_meta && typeof lead.coupon_meta === 'object' ? lead.coupon_meta : {};
  const channel = permissions.view_lead_source ? channelFromMeta(meta) : '';
  const history: any[] = Array.isArray(meta.profile_history) ? meta.profile_history : [];
  const bookingEntry = history.find((h) => BOOKING_EVENTS.has(String(h?.event || '')));
  const prevLabel = String(bookingEntry?.previous_label || '').trim();
  const slot = lead?.preferred_slot_start ? formatDateTimeIST(lead.preferred_slot_start) : '';

  async function markCalled() {
    if (saving) return;
    setSaving(true);
    try {
      const supabase = createClient();
      // Re-read: the lead in state may be redacted for telecallers — never write that back.
      const { data, error } = await supabase
        .from('service_leads')
        .select('coupon_meta')
        .eq('id', lead.id)
        .single();
      if (error) throw error;
      const fresh = data?.coupon_meta && typeof data.coupon_meta === 'object' ? data.coupon_meta : {};
      const { error: upErr } = await supabase
        .from('service_leads')
        .update({ coupon_meta: { ...fresh, priority_booking_acked_at: new Date().toISOString() } })
        .eq('id', lead.id);
      if (upErr) throw upErr;
      setHidden(true);
      toast.success('Marked as called');
      onUpdated();
    } catch (err: any) {
      toast.error(err?.message || 'Could not update the lead');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-amber-400 bg-amber-50 px-4 py-3">
      <Bell className="h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
      <div className="min-w-[220px] flex-1 leading-snug">
        <p className="text-sm font-black text-amber-900">
          Customer ne {channel ? `${channel} se ` : ''}booking ki hai
          {meta.priority_booking_at ? ` · ${formatDateTimeIST(meta.priority_booking_at)}` : ''}
        </p>
        <p className="text-xs font-semibold text-amber-800">
          {prevLabel && !/^fresh$/i.test(prevLabel) ? `Pehle "${prevLabel}" tha. ` : ''}
          {slot ? `Slot: ${slot}. ` : ''}
          Call karke pickup confirm karo.
        </p>
      </div>
      <div className="flex shrink-0 gap-2">
        <button
          type="button"
          disabled={calling || !lead?.customer_phone}
          onClick={onCall}
          className="inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          <PhoneCall className="h-4 w-4" /> Call now
        </button>
        <button
          type="button"
          disabled={saving}
          onClick={() => void markCalled()}
          className="inline-flex items-center gap-1.5 rounded-lg border border-amber-500 bg-white px-3 py-2 text-xs font-bold text-amber-900 hover:bg-amber-100 disabled:opacity-60"
        >
          <CheckCircle2 className="h-4 w-4" /> Mark as called
        </button>
      </div>
    </div>
  );
}
