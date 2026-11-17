'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Clock, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { istDayBounds, istYmd } from '@/lib/telecaller/crmDateRange';
import { crmLeadClosedForFollowUp } from '@/lib/telecaller/crmFollowUpClose';

const MIN_30 = 30 * 60 * 1000;
const MIN_15 = 15 * 60 * 1000;
const MIN_5 = 5 * 60 * 1000;
const CARD_MS = 30_000;

function playReminderChime() {
  try {
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') void ctx.resume();
    const t = ctx.currentTime;
    const notes = [
      { freq: 740, start: 0, dur: 0.16 },
      { freq: 988, start: 0.11, dur: 0.22 },
    ];
    for (const note of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = note.freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      gain.gain.setValueAtTime(0.0001, t + note.start);
      gain.gain.exponentialRampToValueAtTime(0.16, t + note.start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + note.start + note.dur);
      osc.start(t + note.start);
      osc.stop(t + note.start + note.dur + 0.02);
    }
    window.setTimeout(() => void ctx.close(), 800);
  } catch {
    /* audio blocked until a click */
  }
}

type Slot = 30 | 15 | 5;
type FloatCard = {
  key: string;
  leadId: string;
  name: string;
  phone: string;
  reason: string;
  whenLabel: string;
  title: string;
};

function seenKey(id: string, slot: string) {
  return `myfng-fu-float2:${id}:${slot}`;
}

function alreadySeen(id: string, slot: string) {
  try {
    return sessionStorage.getItem(seenKey(id, slot)) === '1';
  } catch {
    return false;
  }
}

function markSeen(id: string, slot: string) {
  try {
    sessionStorage.setItem(seenKey(id, slot), '1');
  } catch {
    /* private mode */
  }
}

function morningSeen(ymd: string) {
  try {
    return localStorage.getItem(`myfng-fu-morning:${ymd}`) === '1';
  } catch {
    return false;
  }
}

function markMorning(ymd: string) {
  try {
    localStorage.setItem(`myfng-fu-morning:${ymd}`, '1');
  } catch {
    /* private mode */
  }
}

function istTime(iso: string) {
  const d = new Date(iso);
  if (!Number.isFinite(d.getTime())) return '';
  return d.toLocaleTimeString('en-IN', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function proximitySlot(remainingMs: number): Slot | null {
  if (remainingMs <= 0 || remainingMs > MIN_30) return null;
  if (remainingMs <= MIN_5) return 5;
  if (remainingMs <= MIN_15) return 15;
  return 30;
}

/**
 * Clock opens reminders.
 * Morning login shows today's remaining follow-ups for 30s.
 * Each one shows again 30, 15, and 5 minutes before, then hides after 30s.
 */
export default function ReminderHeaderIcon() {
  const pathname = usePathname() || '';
  const router = useRouter();
  const [count, setCount] = useState(0);
  const [cards, setCards] = useState<FloatCard[]>([]);

  const isCrm = pathname.includes('/telecaller') || pathname.includes('/lead_manager');
  const isLeadManager = pathname.includes('/lead_manager');
  const base = isLeadManager ? '/dashboard/lead_manager' : '/dashboard/telecaller';
  const href = isCrm
    ? `${base}/followups`
    : (() => {
        const m = pathname.match(/^\/dashboard\/([^/]+)/);
        return m ? `/dashboard/${m[1]}` : '/dashboard';
      })();

  const pushCards = useCallback((next: FloatCard[]) => {
    if (!next.length) return;
    setCards((prev) => {
      const have = new Set(prev.map((card) => card.key));
      const add = next.filter((card) => !have.has(card.key));
      if (!add.length) return prev;
      playReminderChime();
      window.setTimeout(() => {
        const drop = new Set(add.map((card) => card.key));
        setCards((current) => current.filter((card) => !drop.has(card.key)));
      }, CARD_MS);
      return [...add, ...prev].slice(0, 8);
    });
  }, []);

  const tick = useCallback(async () => {
    if (!isCrm) {
      setCount(0);
      return;
    }
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user?.email) return;

      const { data: profile } = await supabase
        .from('users_login')
        .select('id')
        .ilike('email', user.email)
        .maybeSingle();
      const profileId = profile?.id ? String(profile.id) : null;
      if (!profileId) return;

      const ymd = istYmd();
      const bounds = istDayBounds(ymd);
      let q = supabase
        .from('telecaller_follow_ups')
        .select(
          'id, lead_id, reason, scheduled_time, lead:service_leads(customer_name, customer_phone, status, coupon_meta, deleted_at)',
        )
        .eq('status', 'PENDING')
        .gte('scheduled_time', bounds.start)
        .lte('scheduled_time', bounds.end)
        .order('scheduled_time', { ascending: true })
        .limit(60);
      if (!isLeadManager) q = q.eq('telecaller_id', profileId);

      const { data } = await q;
      const now = Date.now();
      const showMorning = !morningSeen(ymd);
      if (showMorning) markMorning(ymd);
      const morning: FloatCard[] = [];
      const soon: FloatCard[] = [];
      let todayPending = 0;

      for (const row of data || []) {
        const lead = (row as { lead?: { deleted_at?: string | null; customer_name?: string; customer_phone?: string; status?: string; coupon_meta?: { last_call_result?: string | null; last_call_label?: string | null } } }).lead;
        if (!lead || lead.deleted_at || crmLeadClosedForFollowUp(lead)) continue;
        const at = String((row as { scheduled_time?: string }).scheduled_time || '');
        const when = new Date(at).getTime();
        if (!Number.isFinite(when)) continue;
        const remaining = when - now;
        if (remaining <= 0) continue;
        todayPending += 1;
        const id = String((row as { id?: string }).id || '');
        const leadId = String((row as { lead_id?: string }).lead_id || '');
        const name = String(lead.customer_name || 'Customer');
        const reason = String((row as { reason?: string }).reason || 'Follow-up');
        const phone = String(lead.customer_phone || '');
        const whenLabel = istTime(at);
        const slot = proximitySlot(remaining);

        if (showMorning && id) {
          morning.push({
            key: `${id}:morning`,
            leadId,
            name,
            phone,
            reason,
            whenLabel,
            title: "Today's follow-up",
          });
          if (slot) markSeen(id, String(slot));
        }

        if (!slot || !id || alreadySeen(id, String(slot))) continue;
        markSeen(id, String(slot));
        soon.push({
          key: `${id}:${slot}`,
          leadId,
          name,
          phone,
          reason,
          whenLabel,
          title: `Follow-up in ${slot} min`,
        });
      }

      pushCards([...morning, ...soon]);
      setCount(todayPending);
    } catch {
      /* keep last count */
    }
  }, [isCrm, isLeadManager, pushCards]);

  useEffect(() => {
    void tick();
    const t = window.setInterval(() => void tick(), 20_000);
    return () => window.clearInterval(t);
  }, [tick]);

  function openLead(leadId: string) {
    if (leadId) router.push(`${base}/leads/${leadId}`);
    else router.push(href);
  }

  return (
    <>
      <Link
        href={href}
        title="Reminders"
        aria-label="Reminders"
        className="relative rounded-lg p-2 transition-colors hover:bg-gray-100"
      >
        <Clock className="h-6 w-6 text-gray-700" />
        {isCrm && count > 0 ? (
          <span className="absolute -right-1 -top-1 flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-sky-600 px-1 text-[10px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        ) : null}
      </Link>
      {cards.length > 0 ? (
        <div className="fixed top-[4.5rem] right-32 z-[90] flex max-h-[70vh] w-[min(22rem,calc(100vw-10rem))] flex-col gap-2 overflow-y-auto">
          {cards.map((card, index) => (
            <div
              key={card.key}
              className="fu-reminder-card relative overflow-hidden rounded-2xl border border-[#eadfc4] bg-[#fffdf8]"
              style={{ animationDelay: `${index * 70}ms` }}
            >
              <span className="absolute inset-y-0 left-0 w-1 bg-gradient-to-b from-[#e7c56a] to-[#b8893a]" />
              <div className="flex items-start gap-3 py-3 pl-4 pr-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#f6efe0] text-[#8a6a2f] shadow-inner">
                  <Clock className="h-4 w-4" />
                </span>
                <button type="button" className="min-w-0 flex-1 text-left" onClick={() => openLead(card.leadId)}>
                  <p className="text-[10px] font-extrabold uppercase tracking-[0.14em] text-[#8a6a2f]">{card.title}</p>
                  <p className="mt-0.5 truncate text-sm font-semibold text-[#1c1917]">{card.name}</p>
                  <p className="truncate text-xs text-[#78716c]">
                    {card.whenLabel}
                    {card.phone ? ` · ${card.phone}` : ''}
                    {card.reason ? ` · ${card.reason}` : ''}
                  </p>
                </button>
                <button
                  type="button"
                  aria-label="Dismiss"
                  className="rounded-full p-1 text-[#a8a29e] hover:bg-[#f6efe0] hover:text-[#1c1917]"
                  onClick={() => setCards((prev) => prev.filter((row) => row.key !== card.key))}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </>
  );
}
