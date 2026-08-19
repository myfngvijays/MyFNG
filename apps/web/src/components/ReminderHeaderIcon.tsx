'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { istDayBounds, istYmd } from '@/lib/telecaller/crmDateRange';

/**
 * Header reminder shortcut (next to notification bell) — every dashboard page.
 */
export default function ReminderHeaderIcon() {
  const pathname = usePathname() || '';
  const [count, setCount] = useState(0);

  const isCrm = pathname.includes('/telecaller') || pathname.includes('/lead_manager');
  const isLeadManager = pathname.includes('/lead_manager');

  const href = (() => {
    if (pathname.includes('/lead_manager')) return '/dashboard/lead_manager/followups';
    if (pathname.includes('/telecaller')) return '/dashboard/telecaller/followups';
    const m = pathname.match(/^\/dashboard\/([^/]+)/);
    return m ? `/dashboard/${m[1]}` : '/dashboard';
  })();

  const loadCount = useCallback(async () => {
    if (!isCrm) {
      setCount(0);
      return;
    }
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const email = (user.email || '').trim();
      let profileId: string | null = null;
      if (email) {
        const { data } = await supabase
          .from('users_login')
          .select('id')
          .ilike('email', email)
          .maybeSingle();
        profileId = data?.id ? String(data.id) : null;
      }
      if (!profileId) {
        const { data } = await supabase
          .from('users_login')
          .select('id')
          .eq('id', user.id)
          .maybeSingle();
        profileId = data?.id ? String(data.id) : null;
      }
      if (!profileId) return;

      const todayBounds = istDayBounds(istYmd());
      let q = supabase
        .from('telecaller_follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING')
        .lte('scheduled_time', todayBounds.end);

      if (!isLeadManager) {
        q = q.eq('telecaller_id', profileId);
      }

      const { count: c } = await q;
      setCount(Number(c || 0));
    } catch {
      setCount(0);
    }
  }, [isCrm, isLeadManager]);

  useEffect(() => {
    void loadCount();
    const t = window.setInterval(() => void loadCount(), 60_000);
    return () => window.clearInterval(t);
  }, [loadCount]);

  return (
    <Link
      href={href}
      title="Reminders / Follow-ups"
      aria-label="Reminders"
      className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors"
    >
      <Clock className="w-6 h-6 text-gray-700" />
      {count > 0 ? (
        <span className="absolute -top-1 -right-1 bg-sky-600 text-white text-[10px] font-bold rounded-full min-w-[1.25rem] h-5 px-1 flex items-center justify-center">
          {count > 9 ? '9+' : count}
        </span>
      ) : null}
    </Link>
  );
}
