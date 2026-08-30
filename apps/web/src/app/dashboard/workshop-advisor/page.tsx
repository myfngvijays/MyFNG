'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { useAdvisorSession } from '@/lib/dashboard/useAdvisorSession';
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';
import {
  Users,
  Wrench,
  Clock,
  CheckCircle,
  AlertTriangle,
  Car,
  Banknote,
  CalendarDays,
  UserPlus,
} from 'lucide-react';
import WorkshopDateFilter, { isoInRange } from '@/components/workshop/WorkshopDateFilter';
import { istYmd, resolveCrmDateRange, type CrmDatePreset } from '@/lib/telecaller/crmDateRange';

type JobRow = {
  id: string;
  mechanic_status?: string;
  completed_at?: string | null;
  sla_remaining_minutes?: number | null;
  service_leads?: { lead_number?: string; customer_name?: string } | null;
  mechanic?: { full_name?: string; workshop_id?: string } | null;
};

export default function WorkshopAdvisorDashboard() {
  const router = useRouter();
  const { workshopId, ready } = useAdvisorSession();
  const [stats, setStats] = useState({
    total_mechanics: 0,
    active_jobs: 0,
    completed_today: 0,
    pending_qc: 0,
    overdue_jobs: 0,
    pending_leads: 0,
    unassigned: 0,
    pickup_active: 0,
  });
  const [recentJobs, setRecentJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [datePreset, setDatePreset] = useState<CrmDatePreset>('today');
  const [customStart, setCustomStart] = useState(istYmd());
  const [customEnd, setCustomEnd] = useState(istYmd());
  const dateRange = useMemo(
    () => resolveCrmDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd],
  );

  useEffect(() => {
    if (!workshopId) {
      if (ready) setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const [mechanicsRes, jobsRes, qcRes, pendingRes, unassignedRes, pickupRes, doneRes] = await Promise.all([
        supabase
          .from('users_login')
          .select('id, role:role_id(role_code)', { count: 'exact' })
          .eq('workshop_id', workshopId)
          .eq('is_active', true),
        supabase
          .from('mechanic_jobs')
          .select(
            'id, mechanic_status, completed_at, sla_remaining_minutes, service_leads:lead_id(lead_number, customer_name), mechanic:mechanic_id(full_name, workshop_id)',
          )
          .in('mechanic_status', ['ASSIGNED', 'IN_PROGRESS', 'HOLD'])
          .order('assigned_at', { ascending: false })
          .limit(40),
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('workshop_id', workshopId)
          .eq('qc_status', 'PENDING'),
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('workshop_id', workshopId)
          .in('status', ['ASSIGNED_TO_WORKSHOP', 'ASSIGNED']),
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('workshop_id', workshopId)
          .eq('status', 'ACCEPTED')
          .is('assigned_mechanic_id', null),
        supabase
          .from('service_leads')
          .select('id', { count: 'exact', head: true })
          .eq('workshop_id', workshopId)
          .in('pickup_status', ['ASSIGNED', 'IN_TRANSIT', 'PICKED_UP', 'EN_ROUTE']),
        supabase
          .from('mechanic_jobs')
          .select('id, completed_at, mechanic:mechanic_id(workshop_id)')
          .not('completed_at', 'is', null)
          .gte('completed_at', dateRange.allTime ? '2020-01-01' : dateRange.start)
          .lte('completed_at', dateRange.end)
          .limit(400),
      ]);

      if (cancelled) return;

      const mechanics = (mechanicsRes.data || []).filter(
        (u: any) => u.role?.role_code === 'WORKSHOP_MECHANIC',
      );
      const workshopJobs = (jobsRes.data || []).filter(
        (job: any) => job.mechanic?.workshop_id === workshopId,
      ) as JobRow[];

      setRecentJobs(workshopJobs.slice(0, 8));
      setStats({
        total_mechanics: mechanics.length,
        active_jobs: workshopJobs.length,
        completed_today: ((doneRes.data || []) as any[]).filter(
          (job) =>
            job.mechanic?.workshop_id === workshopId &&
            isoInRange(job.completed_at, dateRange.start, dateRange.end, dateRange.allTime),
        ).length,
        pending_qc: qcRes.count || 0,
        overdue_jobs: workshopJobs.filter(
          (job) => job.sla_remaining_minutes != null && job.sla_remaining_minutes < 0,
        ).length,
        pending_leads: pendingRes.count || 0,
        unassigned: unassignedRes.count || 0,
        pickup_active: pickupRes.count || 0,
      });
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [workshopId, ready, dateRange.start, dateRange.end, dateRange.allTime]);

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-3 overflow-x-hidden pb-8 sm:space-y-4">
        <AdvisorPageHeader
          title="Dashboard"
          subtitle="Jobs, team, QC, and pickup — all in one place"
          href="/dashboard/workshop-advisor"
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

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          <StatTile label="Mechanics" value={stats.total_mechanics} accent="#004AAD" icon={<Users className="w-5 h-5" />} loading={loading} href="/dashboard/workshop-advisor/team-overview" onClick={router.push} />
          <StatTile label="Active Jobs" value={stats.active_jobs} accent="#D97706" icon={<Wrench className="w-5 h-5" />} loading={loading} href="/dashboard/workshop-advisor/jobs" onClick={router.push} />
          <StatTile label="To Assign" value={stats.unassigned} accent="#EA580C" icon={<UserPlus className="w-5 h-5" />} loading={loading} href="/dashboard/workshop-advisor/job-assignments" onClick={router.push} />
          <StatTile label="Pending Leads" value={stats.pending_leads} accent="#0284C7" icon={<Clock className="w-5 h-5" />} loading={loading} href="/dashboard/workshop-advisor/pending-leads" onClick={router.push} />
          <StatTile label="Completed" value={stats.completed_today} accent="#059669" icon={<CheckCircle className="w-5 h-5" />} loading={loading} href="/dashboard/workshop-advisor/daily-report" onClick={router.push} />
          <StatTile label="Pending QC" value={stats.pending_qc} accent="#6D28D9" icon={<Clock className="w-5 h-5" />} loading={loading} href="/dashboard/workshop-advisor/qc-queue" onClick={router.push} />
          <StatTile label="Pickup Active" value={stats.pickup_active} accent="#4338CA" icon={<Car className="w-5 h-5" />} loading={loading} href="/dashboard/workshop-advisor/pickup-delivery" onClick={router.push} />
          <StatTile label="Overdue" value={stats.overdue_jobs} accent="#DC2626" icon={<AlertTriangle className="w-5 h-5" />} loading={loading} href="/dashboard/workshop-advisor/jobs" onClick={router.push} />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <QuickLink href="/dashboard/workshop-advisor/pending-leads" icon={<Clock className="w-5 h-5" />} title="Pending Leads" sub="Accept incoming jobs" onClick={router.push} />
          <QuickLink href="/dashboard/workshop-advisor/job-assignments" icon={<Wrench className="w-5 h-5" />} title="Assign Mechanic" sub="Assign and monitor jobs" onClick={router.push} />
          <QuickLink href="/dashboard/workshop-advisor/qc-queue" icon={<CheckCircle className="w-5 h-5" />} title="QC Queue" sub="Approve completed work" onClick={router.push} />
          <QuickLink href="/dashboard/workshop-advisor/pickup-delivery" icon={<Car className="w-5 h-5" />} title="Pickup & Delivery" sub="Track pickup boys" onClick={router.push} />
          <QuickLink href="/dashboard/workshop-advisor/extra-work" icon={<Banknote className="w-5 h-5" />} title="Extra Jobs" sub="Approve additional work" onClick={router.push} />
          <QuickLink href="/dashboard/workshop-advisor/day-planning" icon={<CalendarDays className="w-5 h-5" />} title="Day Planning" sub="Plan today's jobs" onClick={router.push} />
        </div>

        <div className="rounded-2xl bg-[#004AAD] p-3.5 shadow-sm sm:p-4">
          <div className="mb-2.5 flex items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold text-white">Recent Jobs</h2>
            <button
              type="button"
              onClick={() => router.push('/dashboard/workshop-advisor/jobs')}
              className="text-xs font-bold text-white/85"
            >
              View all →
            </button>
          </div>
          <div className="space-y-2">
            {loading && recentJobs.length === 0 ? (
              <p className="text-sm text-white/70 py-6 text-center">Loading jobs…</p>
            ) : null}
            {recentJobs.map((job) => (
              <button
                key={job.id}
                type="button"
                onClick={() => router.push(`/dashboard/workshop-advisor/jobs/${job.id}`)}
                className="w-full max-w-full min-w-0 flex items-center gap-2 rounded-xl bg-white p-3 text-left overflow-hidden"
              >
                <div className="min-w-0 flex-1 overflow-hidden">
                  <p className="font-semibold text-sm truncate">{job.service_leads?.lead_number || 'Job'}</p>
                  <p className="text-xs text-slate-500 truncate">
                    {job.mechanic?.full_name || 'Unassigned'} · {job.service_leads?.customer_name || ''}
                  </p>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold shrink-0 whitespace-nowrap ${
                    job.mechanic_status === 'IN_PROGRESS'
                      ? 'bg-blue-100 text-blue-700'
                      : job.mechanic_status === 'ASSIGNED'
                        ? 'bg-green-100 text-green-700'
                        : 'bg-yellow-100 text-yellow-700'
                  }`}
                >
                  {job.mechanic_status === 'IN_PROGRESS'
                    ? 'IN PROG'
                    : job.mechanic_status === 'ASSIGNED'
                      ? 'ASSIGNED'
                      : job.mechanic_status === 'HOLD'
                        ? 'HOLD'
                        : job.mechanic_status}
                </span>
              </button>
            ))}
            {!loading && recentJobs.length === 0 ? (
              <p className="text-center text-white/70 py-6 text-sm">No active jobs</p>
            ) : null}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

function StatTile({
  label,
  value,
  icon,
  accent,
  loading,
  href,
  onClick,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  accent: string;
  loading: boolean;
  href?: string;
  onClick?: (href: string) => void;
}) {
  const inner = (
    <div className="flex items-center gap-2">
      <span className="shrink-0" style={{ color: accent }}>{icon}</span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:text-[11px]">{label}</p>
        <p className="text-xl font-extrabold sm:text-2xl" style={{ color: accent }}>{loading ? '—' : value}</p>
      </div>
    </div>
  );
  const className = 'rounded-2xl border border-slate-200 bg-white p-3 shadow-sm sm:p-3.5 w-full text-left border-l-4';
  if (href && onClick) {
    return (
      <button type="button" className={className} style={{ borderLeftColor: accent }} onClick={() => onClick(href)}>
        {inner}
      </button>
    );
  }
  return <div className={className} style={{ borderLeftColor: accent }}>{inner}</div>;
}

function QuickLink({
  href,
  icon,
  title,
  sub,
  onClick,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  sub: string;
  onClick: (href: string) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onClick(href)}
      className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm hover:shadow-md"
    >
      <span className="text-blue-700 shrink-0">{icon}</span>
      <span>
        <span className="block font-semibold text-sm text-slate-900">{title}</span>
        <span className="block text-xs text-slate-500">{sub}</span>
      </span>
    </button>
  );
}
