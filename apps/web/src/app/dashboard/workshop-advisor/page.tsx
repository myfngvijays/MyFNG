'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { useAdvisorSession } from '@/lib/dashboard/useAdvisorSession';
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';
import { Users, Wrench, Clock, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react';

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
  });
  const [recentJobs, setRecentJobs] = useState<JobRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!workshopId) {
      if (ready) setLoading(false);
      return;
    }

    let cancelled = false;
    const supabase = createClient();

    async function load() {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const todayIso = today.toISOString();

      const [mechanicsRes, jobsRes, qcRes] = await Promise.all([
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
        completed_today: workshopJobs.filter((job) => {
          if (!job.completed_at) return false;
          return new Date(job.completed_at) >= new Date(todayIso);
        }).length,
        pending_qc: qcRes.count || 0,
        overdue_jobs: workshopJobs.filter(
          (job) => job.sla_remaining_minutes != null && job.sla_remaining_minutes < 0,
        ).length,
      });
      setLoading(false);
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [workshopId, ready]);

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-3 overflow-x-hidden pb-8 sm:space-y-4">
        <AdvisorPageHeader
          title="Dashboard"
          subtitle="Jobs, team, QC, and pickup — all in one place"
          href="/dashboard/workshop-advisor"
        />

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
          <StatTile label="Mechanics" value={stats.total_mechanics} icon={<Users className="w-6 h-6 text-blue-600" />} tone="from-blue-50 to-blue-100" loading={loading} />
          <StatTile label="Active Jobs" value={stats.active_jobs} icon={<Wrench className="w-6 h-6 text-amber-600" />} tone="from-yellow-50 to-yellow-100" loading={loading} />
          <StatTile label="Done Today" value={stats.completed_today} icon={<CheckCircle className="w-6 h-6 text-green-600" />} tone="from-green-50 to-green-100" loading={loading} />
          <StatTile label="Pending QC" value={stats.pending_qc} icon={<Clock className="w-6 h-6 text-purple-600" />} tone="from-purple-50 to-purple-100" loading={loading} />
          <StatTile label="Overdue" value={stats.overdue_jobs} icon={<AlertTriangle className="w-6 h-6 text-red-600" />} tone="from-red-50 to-red-100" loading={loading} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <QuickLink href="/dashboard/workshop-advisor/job-assignments" icon={<Wrench className="w-5 h-5" />} title="Job Assignments" sub="Assign and monitor jobs" onClick={router.push} />
          <QuickLink href="/dashboard/workshop-advisor/team-overview" icon={<Users className="w-5 h-5" />} title="Team" sub="Who is free / on a job" onClick={router.push} />
          <QuickLink href="/dashboard/workshop-advisor/performance" icon={<TrendingUp className="w-5 h-5" />} title="Performance" sub="Team metrics" onClick={router.push} />
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
  tone,
  loading,
}: {
  label: string;
  value: number;
  icon: ReactNode;
  tone: string;
  loading: boolean;
}) {
  const tint = tone.includes('yellow')
    ? 'bg-[#FFFBEB]'
    : tone.includes('green')
      ? 'bg-[#ECFDF5]'
      : tone.includes('red')
        ? 'bg-[#FEF2F2]'
        : tone.includes('purple')
          ? 'bg-[#F5F3FF]'
          : 'bg-[#EFF6FF]';
  return (
    <div className={`rounded-2xl border border-slate-200 ${tint} p-3 shadow-sm sm:p-3.5`}>
      <div className="flex items-center gap-2">
        {icon}
        <div className="min-w-0">
          <p className="text-[10px] font-bold uppercase tracking-wide text-slate-500 sm:text-[11px]">{label}</p>
          <p className="text-xl font-extrabold text-[#023D95] sm:text-2xl">{loading ? '—' : value}</p>
        </div>
      </div>
    </div>
  );
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
