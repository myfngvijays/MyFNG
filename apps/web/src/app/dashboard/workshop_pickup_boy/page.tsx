'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { Camera, CheckCircle, Navigation, Truck } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import PickupLeadCard from '@/components/workshop/PickupLeadCard';
import {
  WorkshopPageHeader,
  WorkshopPageShell,
  WorkshopStatTile,
} from '@/components/workshop/WorkshopUi';
import WorkshopDateFilter, { isoInRange } from '@/components/workshop/WorkshopDateFilter';
import { istYmd, resolveCrmDateRange, type CrmDatePreset } from '@/lib/telecaller/crmDateRange';
import { formatDateTime } from '@/lib/utils';
import {
  classifyPickupBoyDashboardTask,
  formatPickupStatusLabel,
  getPickupHistoryCompletedAt,
  isActiveDeliveryBoyTask,
  isActivePickupBoyTask,
  isHistoryTaskCompleted,
  pickupStatusColor,
} from '@/lib/workshop/pickupTaskFlow';

function taskTypeForLead(lead: any): 'PICKUP' | 'DELIVERY' {
  const isDelivery =
    !lead.pickup_required ||
    lead.status === 'READY_FOR_DELIVERY' ||
    lead.status === 'COD_PENDING';
  return isDelivery ? 'DELIVERY' : 'PICKUP';
}

function JobSection({
  title,
  viewAllHref,
  tasks,
  emptyTitle,
  emptySub,
  isCompleted = false,
}: {
  title: string;
  viewAllHref: string;
  tasks: any[];
  emptyTitle: string;
  emptySub: string;
  isCompleted?: boolean;
}) {
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[15px] font-extrabold text-[#023D95]">{title}</h2>
        <Link href={viewAllHref} className="text-xs font-bold text-[#004AAD] hover:underline">
          View all →
        </Link>
      </div>
      {tasks.length > 0 ? (
        <div className="space-y-3">
          {tasks.map((task) => {
            const status = String(task.pickup_status || task.status || 'ASSIGNED');
            const completedAt = getPickupHistoryCompletedAt(task);
            return (
              <PickupLeadCard
                key={task.id}
                leadNumber={task.lead_number}
                customerName={task.customer_name}
                customerPhone={task.customer_phone}
                vehicleNumber={task.vehicle_number}
                vehicleMake={task.vehicle_make}
                vehicleModel={task.vehicle_model}
                taskType={taskTypeForLead(task)}
                statusLabel={formatPickupStatusLabel(status)}
                statusColor={pickupStatusColor(status)}
                address={task.customer_address || task.pickup_address || task.address}
                footerText={
                  isCompleted && completedAt
                    ? `Completed · ${formatDateTime(completedAt)}`
                    : task.preferred_date
                      ? `Scheduled · ${formatDateTime(task.preferred_date)}`
                      : undefined
                }
                href={`/dashboard/workshop_pickup_boy/tasks/${task.id}`}
              />
            );
          })}
        </div>
      ) : (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-8 text-center shadow-sm">
          <p className="text-sm font-extrabold text-[#023D95]">{emptyTitle}</p>
          <p className="mt-1 text-xs font-semibold text-slate-500">{emptySub}</p>
        </div>
      )}
    </section>
  );
}

export default function WorkshopPickupBoyDashboard() {
  const [upcomingTasks, setUpcomingTasks] = useState<any[]>([]);
  const [ongoingTasks, setOngoingTasks] = useState<any[]>([]);
  const [completedTasks, setCompletedTasks] = useState<any[]>([]);
  const [stats, setStats] = useState({
    upcoming: 0,
    ongoing: 0,
    completedToday: 0,
    totalCompleted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const dateRange = useMemo(
    () => resolveCrmDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd],
  );

  const freshLeads = useMemo(() => [...ongoingTasks, ...upcomingTasks], [ongoingTasks, upcomingTasks]);
  const recentCompleted = useMemo(() => completedTasks.slice(0, 3), [completedTasks]);

  useEffect(() => {
    void fetchPickupData();

    const supabase = createClient();
    const channel = supabase
      .channel('pickup-boy-dashboard')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'service_leads' }, () => {
        void fetchPickupData();
      })
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [datePreset, customStart, customEnd]);

  async function fetchPickupData() {
    const supabase = createClient();

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) return;

      const { data: allTasks } = await supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', userProfile.id)
        .not('status', 'in', '(REJECTED,CANCELLED)')
        .order('created_at', { ascending: false });

      const rows = allTasks || [];
      const openTasks = rows.filter((t) => isActivePickupBoyTask(t) || isActiveDeliveryBoyTask(t));
      const upcoming = openTasks.filter((t) => classifyPickupBoyDashboardTask(t) === 'upcoming');
      const ongoing = openTasks.filter((t) => classifyPickupBoyDashboardTask(t) === 'ongoing');
      const completed = rows.filter((t) => {
        if (!isHistoryTaskCompleted(t)) return false;
        const stamp = getPickupHistoryCompletedAt(t);
        return isoInRange(stamp, dateRange.start, dateRange.end, dateRange.allTime);
      });

      const totalCompleted = rows.filter((t) => isHistoryTaskCompleted(t));

      setUpcomingTasks(upcoming);
      setOngoingTasks(ongoing);
      setCompletedTasks(completed);
      setStats({
        upcoming: upcoming.length,
        ongoing: ongoing.length,
        completedToday: completed.length,
        totalCompleted: totalCompleted.length,
      });
    } catch (error) {
      console.error('Error fetching pickup data:', error);
    } finally {
      setLoading(false);
    }
  }

  return (
    <DashboardLayout role="workshop_pickup_boy">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Pickupboy / Driver"
          title="Dashboard"
          subtitle="Pickup and delivery tasks in one place"
        />

        <WorkshopDateFilter
          preset={datePreset}
          customStart={customStart}
          customEnd={customEnd}
          onChange={({ datePreset: next, customStart: s, customEnd: e }) => {
            setDatePreset(next);
            setCustomStart(s);
            setCustomEnd(e);
          }}
        />

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-4 sm:gap-4">
          <Link href="/dashboard/workshop_pickup_boy/tasks?filter=scheduled">
            <WorkshopStatTile
              label="Upcoming"
              value={stats.upcoming}
              icon={<Truck className="h-6 w-6 text-amber-600" />}
              tone="from-amber-50 to-amber-100"
              loading={loading}
            />
          </Link>
          <Link href="/dashboard/workshop_pickup_boy/tasks?filter=in_transit">
            <WorkshopStatTile
              label="Ongoing"
              value={stats.ongoing}
              icon={<Navigation className="h-6 w-6 text-blue-600" />}
              tone="from-blue-50 to-blue-100"
              loading={loading}
            />
          </Link>
          <Link href="/dashboard/workshop_pickup_boy/history?filter=completed">
            <WorkshopStatTile
              label="Completed"
              value={stats.completedToday}
              icon={<CheckCircle className="h-6 w-6 text-emerald-600" />}
              tone="from-emerald-50 to-emerald-100"
              loading={loading}
            />
          </Link>
          <Link href="/dashboard/workshop_pickup_boy/history">
            <WorkshopStatTile
              label="Total done"
              value={stats.totalCompleted}
              icon={<CheckCircle className="h-6 w-6 text-orange-600" />}
              tone="from-orange-50 to-orange-100"
              loading={loading}
            />
          </Link>
        </div>

        <JobSection
          title="Fresh leads — to do"
          viewAllHref="/dashboard/workshop_pickup_boy/tasks"
          tasks={freshLeads}
          emptyTitle="No pending jobs"
          emptySub="New pickup/delivery assignments will show here"
        />

        <JobSection
          title="Recently completed"
          viewAllHref="/dashboard/workshop_pickup_boy/history?filter=completed"
          tasks={recentCompleted}
          emptyTitle="No completed jobs"
          emptySub="Finished jobs for selected date range appear here"
          isCompleted
        />

        <div className="rounded-2xl border border-slate-200 bg-blue-50/70 p-4 shadow-sm sm:p-5">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900 sm:mb-3 sm:text-base">
            <Camera className="h-4 w-4 shrink-0 text-[#004AAD] sm:h-5 sm:w-5" />
            Photo Guidelines
          </h3>
          <ul className="space-y-1.5 text-xs text-slate-700 sm:space-y-2 sm:text-sm">
            {[
              'Take clear photos of vehicle before pickup',
              'Capture odometer reading',
              'Document any existing damage',
              'Photo of customer ID/signature',
              'Repeat process during delivery',
            ].map((line) => (
              <li key={line} className="flex items-start gap-2">
                <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600 sm:h-4 sm:w-4" />
                <span>{line}</span>
              </li>
            ))}
          </ul>
        </div>
      </WorkshopPageShell>
    </DashboardLayout>
  );
}
