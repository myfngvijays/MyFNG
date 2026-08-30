'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import WorkshopStaffProfilePage from '@/components/workshop/WorkshopStaffProfilePage';

export default function PickupBoyProfilePage() {
  const [stats, setStats] = useState({
    totalTasks: 0,
    completedTasks: 0,
    successRate: 0,
  });

  useEffect(() => {
    (async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: userProfile } = await supabase.from('users_login').select('id').eq('email', user.email).single();
      if (!userProfile) return;
      const { data: allTasks } = await supabase
        .from('service_leads')
        .select('pickup_status')
        .eq('assigned_pickup_boy_id', userProfile.id)
        .eq('pickup_required', true);
      const total = allTasks?.length || 0;
      const done = allTasks?.filter((t) => t.pickup_status === 'PICKED_UP' || t.pickup_status === 'DELIVERED').length || 0;
      setStats({
        totalTasks: total,
        completedTasks: done,
        successRate: total > 0 ? Math.round((done / total) * 100) : 0,
      });
    })();
  }, []);

  const tiles = [
    { label: 'Total tasks', value: stats.totalTasks, accent: '#004AAD' },
    { label: 'Completed', value: stats.completedTasks, accent: '#059669' },
    { label: 'Success rate', value: `${stats.successRate}%`, accent: '#EA580C' },
  ];

  return (
    <WorkshopStaffProfilePage
      layoutRole="workshop_pickup_boy"
      roleFallback="Pickupboy / Driver"
      extra={
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <h2 className="mb-3 text-base font-bold text-[#023D95]">Task stats</h2>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {tiles.map((tile) => (
              <div
                key={tile.label}
                className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm border-l-4"
                style={{ borderLeftColor: tile.accent }}
              >
                <p className="text-xl font-extrabold" style={{ color: tile.accent }}>{tile.value}</p>
                <p className="text-[11px] font-bold uppercase tracking-wide text-slate-500">{tile.label}</p>
              </div>
            ))}
          </div>
        </section>
      }
    />
  );
}
