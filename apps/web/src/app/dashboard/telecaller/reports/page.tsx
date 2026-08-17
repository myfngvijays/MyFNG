'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CrmReportsNav } from '@/components/telecaller/crm/CrmReportsNav';
import { getCrmDashboardBase } from '@/lib/telecaller/crmRoles';
import { personalLeaderboardLabel } from '@/lib/telecaller/crmPermissions';
import { useCrmPermissions } from '@/lib/telecaller/useCrmPermissions';
import { useAuthStore } from '@/store/authStore';
import { Trophy, Phone, Download, GitMerge, BarChart3, ChevronRight } from 'lucide-react';

export default function CrmReportsHubPage() {
  const pathname = usePathname();
  const { base, layoutRole, isLeadManager } = getCrmDashboardBase(pathname);
  const { permissions, loading: permLoading } = useCrmPermissions();
  const fullName = useAuthStore((s) => s.userProfile?.full_name);
  const teamMode = Boolean(isLeadManager || permissions.reports_team_leaderboard);
  const boardTitle = teamMode ? 'Team leaderboard' : personalLeaderboardLabel(fullName);

  const cards = [
    {
      id: 'leaderboard',
      title: boardTitle,
      blurb: teamMode
        ? 'Rank telecallers by calls, talk time, and bookings for any period.'
        : 'Your calls, talk time, and bookings for any period.',
      icon: Trophy,
      accent: 'bg-amber-50 text-amber-800 border-amber-100',
      show: permissions.reports,
    },
    {
      id: 'calls',
      title: 'Call activity',
      blurb: 'Hourly call volume, connected vs missed, and the leads behind each call.',
      icon: Phone,
      accent: 'bg-sky-50 text-sky-800 border-sky-100',
      show: permissions.reports,
    },
    {
      id: 'exports',
      title: 'Exports',
      blurb: 'Download CSV snapshots of leads or call logs for the selected range.',
      icon: Download,
      accent: 'bg-emerald-50 text-emerald-800 border-emerald-100',
      // Never flash export for callers while permissions load
      show: Boolean(isLeadManager || (!permLoading && permissions.reports_export)),
    },
    {
      id: 'duplicates',
      title: 'Duplicate phones',
      blurb: 'Find numbers that appear on more than one lead so you can clean the queue.',
      icon: GitMerge,
      accent: 'bg-rose-50 text-rose-800 border-rose-100',
      show: Boolean(isLeadManager || (!permLoading && permissions.reports_duplicates)),
    },
  ].filter((c) => c.show);

  return (
    <DashboardLayout role={layoutRole}>
      <div className="mx-auto w-full max-w-6xl space-y-6 pb-10 px-1 sm:px-0">
        <CrmReportsNav
          title="Reports"
          subtitle={
            isLeadManager
              ? 'Team performance, exports, and duplicate cleanup. Manage telecaller access from Team.'
              : 'Your performance and call activity — scoped to your CRM access.'
          }
        />

        <div className="grid gap-3 sm:gap-4 sm:grid-cols-2">
          {cards.map((card) => {
            const Icon = card.icon;
            return (
              <Link
                key={card.id}
                href={`${base}/reports/${card.id}`}
                className="group rounded-2xl border border-slate-200 bg-white p-4 sm:p-5 shadow-sm transition hover:border-[#004AAD]/40 hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-3">
                  <div
                    className={`inline-flex h-10 w-10 sm:h-11 sm:w-11 items-center justify-center rounded-xl border ${card.accent}`}
                  >
                    <Icon className="h-5 w-5" />
                  </div>
                  <ChevronRight className="h-5 w-5 text-slate-300 transition group-hover:text-[#004AAD]" />
                </div>
                <h2 className="mt-3 sm:mt-4 text-base sm:text-lg font-extrabold text-[#023D95]">{card.title}</h2>
                <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{card.blurb}</p>
              </Link>
            );
          })}
        </div>

        {isLeadManager ? (
          <Link
            href={`${base}/reports/pipeline`}
            className="flex items-center gap-3 rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-4 sm:px-5 py-4 transition hover:border-[#004AAD]/50 hover:bg-white"
          >
            <BarChart3 className="h-5 w-5 text-[#004AAD] shrink-0" />
            <div className="min-w-0 flex-1">
              <p className="font-bold text-slate-900">Pipeline analytics</p>
              <p className="text-sm text-slate-500">
                Validation rates, workshop mix, city split, and SLA.
              </p>
            </div>
            <ChevronRight className="h-5 w-5 text-slate-400 shrink-0" />
          </Link>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
