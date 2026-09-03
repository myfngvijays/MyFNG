'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import {
  Calendar, TrendingUp, AlertTriangle, Download,
  Wrench, Award, ThumbsUp, ThumbsDown
} from 'lucide-react';
import { AdvisorPageHeader } from '@/components/advisor/AdvisorPageHeader';

interface DailyMetrics {
  date: string;
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  rejectedJobs: number;
  overdueJobs: number;
  qcPassed: number;
  extraPending: number;
  averageCompletionTime: number;
  mechanicPerformance: MechanicPerformance[];
  issuesEncountered: IssueLog[];
  recommendations: string[];
  leads: Array<{
    id: string;
    lead_number?: string;
    customer_name?: string;
    vehicle_number?: string;
    status?: string;
    qc_status?: string;
    qc_passed_today?: boolean;
    completed_today?: boolean;
  }>;
}

interface MechanicPerformance {
  id: string;
  name: string;
  assignedJobs: number;
  completedJobs: number;
  activeJobs: number;
  averageTime: number;
  qualityScore: number;
  status: 'excellent' | 'good' | 'needsImprovement';
}

interface IssueLog {
  type: string;
  count: number;
  description: string;
}

export default function DailyReportPage() {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  const [metrics, setMetrics] = useState<DailyMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchDailyReport();
  }, [selectedDate]);

  async function fetchDailyReport() {
    try {
      setLoading(true);
      const res = await fetch(`/api/supervisor/daily-report?date=${selectedDate}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || 'Failed to load daily report');

      const report = json.report || {};
      const mechanicPerformance: MechanicPerformance[] = (json.mechanics || []).map((m: any) => {
        const assigned = Number(m.assigned || 0);
        const completed = Number(m.completed || 0);
        const qualityScore = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;
        let status: MechanicPerformance['status'] = 'good';
        if (qualityScore >= 90) status = 'excellent';
        else if (qualityScore < 60) status = 'needsImprovement';
        return {
          id: m.id,
          name: m.name,
          assignedJobs: assigned,
          completedJobs: completed,
          activeJobs: Number(m.active || 0),
          averageTime: 0,
          qualityScore,
          status,
        };
      });

      const issuesEncountered: IssueLog[] = [
        { type: 'Overdue Jobs', count: report.overdue || 0, description: 'SLA breached' },
        { type: 'Pending Jobs', count: report.pending || 0, description: 'Still in progress at end of day' },
        { type: 'Extra pending', count: report.extraPending || 0, description: 'Waiting for advisor decision' },
      ];

      const recommendations: string[] = [];
      if ((report.overdue || 0) > 0) {
        recommendations.push(`${report.overdue} job(s) are overdue. Review mechanic workload distribution.`);
      }
      if ((report.qcPassed || 0) > 0) {
        recommendations.push(`${report.qcPassed} QC pass today — billing / payment next.`);
      }
      if ((report.total || 0) > 0 && (report.completed || 0) < (report.total || 0) * 0.5) {
        recommendations.push('Completion rate is low for today. Review hold / unassigned work.');
      }
      if (recommendations.length === 0) {
        recommendations.push('Great performance! All metrics are within acceptable ranges.');
      }

      setMetrics({
        date: selectedDate,
        totalJobs: report.total || 0,
        completedJobs: report.completed || 0,
        pendingJobs: report.pending || 0,
        rejectedJobs: 0,
        overdueJobs: report.overdue || 0,
        qcPassed: report.qcPassed || 0,
        extraPending: report.extraPending || 0,
        averageCompletionTime: 0,
        mechanicPerformance,
        issuesEncountered,
        recommendations,
        leads: Array.isArray(json.leads) ? json.leads : [],
      });
    } catch (error) {
      console.error('Error fetching daily report:', error);
    } finally {
      setLoading(false);
    }
  }

  async function exportReport() {
    if (!metrics) return;

    try {
      setGenerating(true);

      // Create CSV content
      const csvContent = [
        ['Daily Report', metrics.date],
        [],
        ['Overall Metrics'],
        ['Total Jobs', metrics.totalJobs],
        ['Completed Jobs', metrics.completedJobs],
        ['Pending Jobs', metrics.pendingJobs],
        ['Rejected Jobs', metrics.rejectedJobs],
        ['Overdue Jobs', metrics.overdueJobs],
        ['Avg Completion Time (min)', metrics.averageCompletionTime],
        [],
        ['Mechanic Performance'],
        ['Name', 'Assigned', 'Completed', 'Active', 'Avg Time (min)', 'Quality Score', 'Status'],
        ...metrics.mechanicPerformance.map(m => [
          m.name, m.assignedJobs, m.completedJobs, m.activeJobs, m.averageTime, m.qualityScore, m.status
        ]),
        [],
        ['Issues Encountered'],
        ['Type', 'Count', 'Description'],
        ...metrics.issuesEncountered.map(i => [i.type, i.count, i.description]),
        [],
        ['Recommendations'],
        ...metrics.recommendations.map(r => [r])
      ].map(row => row.join(',')).join('\n');

      // Download CSV
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `daily-report-${metrics.date}.csv`;
      a.click();
      URL.revokeObjectURL(url);

      alert('Report downloaded successfully');
    } catch (error) {
      console.error('Error exporting report:', error);
      alert('Failed to export report');
    } finally {
      setGenerating(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="mx-auto w-full max-w-6xl min-w-0 space-y-3 overflow-x-hidden pb-8 sm:space-y-4">
        <AdvisorPageHeader
          title="Daily Report"
          subtitle="End of day summary and insights"
          href="/dashboard/workshop-advisor/daily-report"
          right={
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                max={new Date().toISOString().split('T')[0]}
                className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-800"
              />
              <button
                onClick={exportReport}
                disabled={generating || !metrics}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#023D95] px-3 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#012f73] disabled:opacity-60"
              >
                {generating ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-800" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    Export
                  </>
                )}
              </button>
            </div>
          }
        />

        {!metrics ? (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <Calendar className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-2 sm:mb-3 md:mb-4" />
            <p className="text-lg sm:text-xl font-semibold text-gray-700">No Data Available</p>
            <p className="text-gray-600 mt-1.5 sm:mt-2 text-xs sm:text-sm">No jobs found for selected date</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-3 gap-2 sm:gap-3">
              {[
                { label: 'Total', value: metrics.totalJobs, color: 'text-[#004AAD]', bg: 'bg-white' },
                { label: 'Completed', value: metrics.completedJobs, color: 'text-emerald-600', bg: 'bg-white' },
                { label: 'Pending', value: metrics.pendingJobs, color: 'text-amber-500', bg: 'bg-white' },
                { label: 'Overdue', value: metrics.overdueJobs, color: 'text-red-500', bg: 'bg-white' },
                { label: 'QC Passed', value: metrics.qcPassed, color: 'text-sky-600', bg: 'bg-white' },
                { label: 'Extra pending', value: metrics.extraPending, color: 'text-violet-600', bg: 'bg-white' },
              ].map((tile) => (
                <div
                  key={tile.label}
                  className={`${tile.bg} rounded-xl border border-slate-200 px-2 py-3 sm:px-3 sm:py-4 text-center shadow-sm`}
                >
                  <p className={`text-xl sm:text-2xl font-extrabold ${tile.color}`}>{tile.value}</p>
                  <p className="mt-1 text-[11px] sm:text-sm font-semibold text-slate-500 leading-tight">{tile.label}</p>
                </div>
              ))}
            </div>

            <div className="card p-3 sm:p-4 md:p-5">
              <h3 className="text-base sm:text-lg font-semibold mb-3">Today's leads</h3>
              {metrics.leads.length === 0 ? (
                <p className="text-sm text-slate-500">Is date pe koi lead nahi mili.</p>
              ) : (
                <div className="space-y-2">
                  {metrics.leads.map((lead) => (
                    <button
                      key={lead.id}
                      type="button"
                      onClick={() =>
                        router.push(`/dashboard/workshop-advisor/jobs/${lead.id}`)
                      }
                      className={`w-full text-left rounded-xl border px-3 py-2.5 ${
                        lead.qc_passed_today ? 'border-green-200 bg-green-50' : 'border-slate-200 bg-white'
                      }`}
                    >
                      <p className="text-sm font-semibold text-slate-900">
                        {lead.customer_name || lead.lead_number}
                      </p>
                      <p className="text-xs text-slate-500 mt-0.5">
                        {lead.lead_number}
                        {lead.vehicle_number ? ` · ${lead.vehicle_number}` : ''}
                        {lead.qc_passed_today ? (
                          <span className="mt-1 block text-sm font-extrabold text-green-700">
                            QC Passed · Next: Open Order Summary
                          </span>
                        ) : lead.status ? (
                          <span> · {String(lead.status).replace(/_/g, ' ')}</span>
                        ) : null}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mechanic Performance */}
            <div className="card p-3 sm:p-4 md:p-5">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                <Wrench className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Mechanic Performance Today
              </h3>
              <div className="space-y-2 sm:space-y-3">
                {metrics.mechanicPerformance.map((mechanic) => (
                  <div 
                    key={mechanic.id}
                    className={`p-3 sm:p-4 rounded-lg border-2 ${
                      mechanic.status === 'excellent' ? 'bg-green-50 border-green-300' :
                      mechanic.status === 'good' ? 'bg-blue-50 border-blue-300' :
                      'bg-orange-50 border-orange-300'
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                      <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                        <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          mechanic.status === 'excellent' ? 'bg-green-600' :
                          mechanic.status === 'good' ? 'bg-blue-600' :
                          'bg-orange-600'
                        }`}>
                          {mechanic.status === 'excellent' ? (
                            <Award className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          ) : mechanic.status === 'good' ? (
                            <ThumbsUp className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          ) : (
                            <ThumbsDown className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                          )}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm sm:text-base truncate">{mechanic.name}</p>
                          <p className="text-xs sm:text-sm text-gray-600">
                            Quality Score: {mechanic.qualityScore}%
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 lg:gap-6 text-center w-full sm:w-auto">
                        <div>
                          <p className="text-[10px] sm:text-xs text-gray-600">Assigned</p>
                          <p className="text-base sm:text-lg font-bold">{mechanic.assignedJobs}</p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs text-gray-600">Completed</p>
                          <p className="text-base sm:text-lg font-bold text-green-600">{mechanic.completedJobs}</p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs text-gray-600">Active</p>
                          <p className="text-base sm:text-lg font-bold text-blue-600">{mechanic.activeJobs}</p>
                        </div>
                        <div>
                          <p className="text-[10px] sm:text-xs text-gray-600">Avg Time</p>
                          <p className="text-base sm:text-lg font-bold">{mechanic.averageTime}m</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Issues Encountered */}
            {metrics.issuesEncountered.some(i => i.count > 0) && (
              <div className="card bg-orange-50 border-orange-200 p-3 sm:p-4 md:p-5">
                <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2 text-orange-700">
                  <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                  Issues Encountered
                </h3>
                <div className="space-y-2">
                  {metrics.issuesEncountered.filter(i => i.count > 0).map((issue, index) => (
                    <div key={index} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3 p-2.5 sm:p-3 bg-white rounded-lg">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold text-xs sm:text-sm md:text-base">{issue.type}</p>
                        <p className="text-xs sm:text-sm text-gray-600">{issue.description}</p>
                      </div>
                      <span className="text-xl sm:text-2xl font-bold text-orange-600 flex-shrink-0">{issue.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="card bg-blue-50 border-blue-200 p-3 sm:p-4 md:p-5">
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2 text-blue-700">
                <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                Recommendations & Insights
              </h3>
              <div className="space-y-2">
                {metrics.recommendations.map((rec, index) => (
                  <div key={index} className="p-2.5 sm:p-3 bg-white rounded-lg">
                    <p className="text-xs sm:text-sm">{rec}</p>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

