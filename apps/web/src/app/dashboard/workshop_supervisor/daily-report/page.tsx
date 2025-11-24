'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  FileText, Calendar, TrendingUp, TrendingDown, Users, 
  Clock, CheckCircle, XCircle, AlertTriangle, Download,
  Wrench, User, Award, ThumbsUp, ThumbsDown
} from 'lucide-react';

interface DailyMetrics {
  date: string;
  totalJobs: number;
  completedJobs: number;
  pendingJobs: number;
  rejectedJobs: number;
  overdueJobs: number;
  averageCompletionTime: number;
  mechanicPerformance: MechanicPerformance[];
  issuesEncountered: IssueLog[];
  recommendations: string[];
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
      const supabase = createClient();

      // Get user's workshop
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id, full_name')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) return;

      // Set date range for selected day
      const startOfDay = new Date(selectedDate);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(selectedDate);
      endOfDay.setHours(23, 59, 59, 999);

      // Fetch all jobs for the day
      const { data: allJobs } = await supabase
        .from('service_leads')
        .select(`
          id,
          status,
          assigned_mechanic_id,
          created_at,
          updated_at,
          sla_deadline,
          mechanic:assigned_mechanic_id(id, full_name)
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .gte('created_at', startOfDay.toISOString())
        .lte('created_at', endOfDay.toISOString());

      const totalJobs = allJobs?.length || 0;
      const completedJobs = allJobs?.filter(j => j.status === 'COMPLETED' || j.status === 'CLOSED').length || 0;
      const pendingJobs = allJobs?.filter(j => j.status === 'IN_PROGRESS' || j.status === 'ASSIGNED').length || 0;
      const rejectedJobs = allJobs?.filter(j => j.status === 'REJECTED' || j.status === 'SENT_BACK').length || 0;
      const overdueJobs = allJobs?.filter(j => {
        if (!j.sla_deadline) return false;
        return new Date(j.sla_deadline) < new Date() && j.status !== 'COMPLETED';
      }).length || 0;

      // Calculate average completion time
      const completedJobsWithTime = allJobs?.filter(j => 
        (j.status === 'COMPLETED' || j.status === 'CLOSED') && j.created_at && j.updated_at
      ) || [];
      
      const totalCompletionMinutes = completedJobsWithTime.reduce((sum, job) => {
        const start = new Date(job.created_at).getTime();
        const end = new Date(job.updated_at).getTime();
        return sum + (end - start) / (1000 * 60); // minutes
      }, 0);

      const averageCompletionTime = completedJobsWithTime.length > 0 
        ? Math.round(totalCompletionMinutes / completedJobsWithTime.length) 
        : 0;

      // Get mechanics in this workshop
      const { data: mechanics } = await supabase
        .from('users_login')
        .select(`
          id,
          full_name,
          roles!inner(role_code)
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .eq('roles.role_code', 'WORKSHOP_MECHANIC')
        .eq('is_active', true);

      // Calculate performance for each mechanic
      const mechanicPerformance: MechanicPerformance[] = await Promise.all(
        (mechanics || []).map(async (mechanic) => {
          const { data: mechanicJobs } = await supabase
            .from('service_leads')
            .select('id, status, created_at, updated_at')
            .eq('assigned_mechanic_id', mechanic.id)
            .gte('created_at', startOfDay.toISOString())
            .lte('created_at', endOfDay.toISOString());

          const assigned = mechanicJobs?.length || 0;
          const completed = mechanicJobs?.filter(j => j.status === 'COMPLETED' || j.status === 'CLOSED').length || 0;
          const active = mechanicJobs?.filter(j => j.status === 'IN_PROGRESS' || j.status === 'ASSIGNED').length || 0;

          // Calculate average time for completed jobs
          const completedWithTime = mechanicJobs?.filter(j => 
            (j.status === 'COMPLETED' || j.status === 'CLOSED') && j.created_at && j.updated_at
          ) || [];
          
          const totalTime = completedWithTime.reduce((sum, job) => {
            const start = new Date(job.created_at).getTime();
            const end = new Date(job.updated_at).getTime();
            return sum + (end - start) / (1000 * 60); // minutes
          }, 0);

          const avgTime = completedWithTime.length > 0 ? Math.round(totalTime / completedWithTime.length) : 0;

          // Simple quality score based on completion rate
          const qualityScore = assigned > 0 ? Math.round((completed / assigned) * 100) : 0;

          let status: 'excellent' | 'good' | 'needsImprovement' = 'good';
          if (qualityScore >= 90) status = 'excellent';
          else if (qualityScore < 60) status = 'needsImprovement';

          return {
            id: mechanic.id,
            name: mechanic.full_name,
            assignedJobs: assigned,
            completedJobs: completed,
            activeJobs: active,
            averageTime: avgTime,
            qualityScore,
            status
          };
        })
      );

      // Get issue logs
      const { data: sentBackJobs } = await supabase
        .from('service_leads')
        .select('supervisor_send_back_notes')
        .eq('workshop_id', userProfile.workshop_id)
        .eq('status', 'SENT_BACK')
        .gte('updated_at', startOfDay.toISOString())
        .lte('updated_at', endOfDay.toISOString());

      const issuesEncountered: IssueLog[] = [
        { type: 'Jobs Sent Back', count: sentBackJobs?.length || 0, description: 'Quality issues or incomplete work' },
        { type: 'Overdue Jobs', count: overdueJobs, description: 'SLA breached' },
        { type: 'Pending Jobs', count: pendingJobs, description: 'Still in progress at end of day' }
      ];

      // Generate recommendations
      const recommendations: string[] = [];
      
      if (overdueJobs > 0) {
        recommendations.push(`⚠️ ${overdueJobs} job(s) are overdue. Review mechanic workload distribution.`);
      }
      
      if (rejectedJobs > totalJobs * 0.2) {
        recommendations.push(`📋 High rejection rate (${Math.round((rejectedJobs / totalJobs) * 100)}%). Consider additional training or quality checks.`);
      }

      if (completedJobs < totalJobs * 0.7) {
        recommendations.push(`⏰ Low completion rate (${Math.round((completedJobs / totalJobs) * 100)}%). Review job complexity or mechanic availability.`);
      }

      const lowPerformers = mechanicPerformance.filter(m => m.status === 'needsImprovement');
      if (lowPerformers.length > 0) {
        recommendations.push(`👤 ${lowPerformers.length} mechanic(s) need attention: ${lowPerformers.map(m => m.name).join(', ')}`);
      }

      if (recommendations.length === 0) {
        recommendations.push('✅ Great performance! All metrics are within acceptable ranges.');
      }

      setMetrics({
        date: selectedDate,
        totalJobs,
        completedJobs,
        pendingJobs,
        rejectedJobs,
        overdueJobs,
        averageCompletionTime,
        mechanicPerformance,
        issuesEncountered,
        recommendations
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
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const completionRate = metrics ? Math.round((metrics.completedJobs / metrics.totalJobs) * 100) : 0;

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-heading flex items-center gap-3">
              <FileText className="w-8 h-8" />
              Daily Report
            </h1>
            <p className="text-text-body mt-2">
              End of day summary and insights
            </p>
          </div>
          <div className="flex gap-3">
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              max={new Date().toISOString().split('T')[0]}
              className="input"
            />
            <button
              onClick={exportReport}
              disabled={generating || !metrics}
              className="btn btn-primary flex items-center gap-2"
            >
              {generating ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Generating...
                </>
              ) : (
                <>
                  <Download className="w-4 h-4" />
                  Export Report
                </>
              )}
            </button>
          </div>
        </div>

        {!metrics ? (
          <div className="card text-center py-12">
            <Calendar className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-700">No Data Available</p>
            <p className="text-gray-600 mt-2">No jobs found for selected date</p>
          </div>
        ) : (
          <>
            {/* Overall Metrics */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="card bg-gradient-to-r from-blue-500 to-blue-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Total Jobs</p>
                    <p className="text-4xl font-bold mt-2">{metrics.totalJobs}</p>
                    <p className="text-xs mt-2 opacity-75">For {new Date(selectedDate).toLocaleDateString()}</p>
                  </div>
                  <Users className="w-12 h-12 opacity-75" />
                </div>
              </div>

              <div className="card bg-gradient-to-r from-green-500 to-green-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Completed</p>
                    <p className="text-4xl font-bold mt-2">{metrics.completedJobs}</p>
                    <div className="flex items-center gap-2 mt-2">
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm">{completionRate}% completion rate</span>
                    </div>
                  </div>
                  <CheckCircle className="w-12 h-12 opacity-75" />
                </div>
              </div>

              <div className="card bg-gradient-to-r from-orange-500 to-orange-600 text-white">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm opacity-90">Avg Time</p>
                    <p className="text-4xl font-bold mt-2">{Math.floor(metrics.averageCompletionTime / 60)}h {metrics.averageCompletionTime % 60}m</p>
                    <p className="text-xs mt-2 opacity-75">Per job completion</p>
                  </div>
                  <Clock className="w-12 h-12 opacity-75" />
                </div>
              </div>
            </div>

            {/* Status Breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="card border-2 border-green-300 bg-green-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Completed</p>
                    <p className="text-2xl font-bold text-green-600">{metrics.completedJobs}</p>
                  </div>
                  <CheckCircle className="w-8 h-8 text-green-600" />
                </div>
              </div>

              <div className="card border-2 border-blue-300 bg-blue-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Pending</p>
                    <p className="text-2xl font-bold text-blue-600">{metrics.pendingJobs}</p>
                  </div>
                  <Clock className="w-8 h-8 text-blue-600" />
                </div>
              </div>

              <div className="card border-2 border-red-300 bg-red-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Overdue</p>
                    <p className="text-2xl font-bold text-red-600">{metrics.overdueJobs}</p>
                  </div>
                  <AlertTriangle className="w-8 h-8 text-red-600" />
                </div>
              </div>

              <div className="card border-2 border-orange-300 bg-orange-50">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-gray-600">Rejected</p>
                    <p className="text-2xl font-bold text-orange-600">{metrics.rejectedJobs}</p>
                  </div>
                  <XCircle className="w-8 h-8 text-orange-600" />
                </div>
              </div>
            </div>

            {/* Mechanic Performance */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Wrench className="w-5 h-5" />
                Mechanic Performance Today
              </h3>
              <div className="space-y-3">
                {metrics.mechanicPerformance.map((mechanic) => (
                  <div 
                    key={mechanic.id}
                    className={`p-4 rounded-lg border-2 ${
                      mechanic.status === 'excellent' ? 'bg-green-50 border-green-300' :
                      mechanic.status === 'good' ? 'bg-blue-50 border-blue-300' :
                      'bg-orange-50 border-orange-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                          mechanic.status === 'excellent' ? 'bg-green-600' :
                          mechanic.status === 'good' ? 'bg-blue-600' :
                          'bg-orange-600'
                        }`}>
                          {mechanic.status === 'excellent' ? (
                            <Award className="w-5 h-5 text-white" />
                          ) : mechanic.status === 'good' ? (
                            <ThumbsUp className="w-5 h-5 text-white" />
                          ) : (
                            <ThumbsDown className="w-5 h-5 text-white" />
                          )}
                        </div>
                        <div>
                          <p className="font-semibold">{mechanic.name}</p>
                          <p className="text-sm text-gray-600">
                            Quality Score: {mechanic.qualityScore}%
                          </p>
                        </div>
                      </div>
                      <div className="grid grid-cols-4 gap-6 text-center">
                        <div>
                          <p className="text-xs text-gray-600">Assigned</p>
                          <p className="text-lg font-bold">{mechanic.assignedJobs}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Completed</p>
                          <p className="text-lg font-bold text-green-600">{mechanic.completedJobs}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Active</p>
                          <p className="text-lg font-bold text-blue-600">{mechanic.activeJobs}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-600">Avg Time</p>
                          <p className="text-lg font-bold">{mechanic.averageTime}m</p>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Issues Encountered */}
            {metrics.issuesEncountered.some(i => i.count > 0) && (
              <div className="card bg-orange-50 border-orange-200">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-orange-700">
                  <AlertTriangle className="w-5 h-5" />
                  Issues Encountered
                </h3>
                <div className="space-y-2">
                  {metrics.issuesEncountered.filter(i => i.count > 0).map((issue, index) => (
                    <div key={index} className="flex items-center justify-between p-3 bg-white rounded-lg">
                      <div>
                        <p className="font-semibold">{issue.type}</p>
                        <p className="text-sm text-gray-600">{issue.description}</p>
                      </div>
                      <span className="text-2xl font-bold text-orange-600">{issue.count}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recommendations */}
            <div className="card bg-blue-50 border-blue-200">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2 text-blue-700">
                <TrendingUp className="w-5 h-5" />
                Recommendations & Insights
              </h3>
              <div className="space-y-2">
                {metrics.recommendations.map((rec, index) => (
                  <div key={index} className="p-3 bg-white rounded-lg">
                    <p className="text-sm">{rec}</p>
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

