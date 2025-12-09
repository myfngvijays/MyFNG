'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  TrendingUp, 
  Users,
  Award,
  Target,
  Loader2,
  RefreshCw,
  BarChart3
} from 'lucide-react';
import toast from 'react-hot-toast';

function SubAdminPerformanceContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [performanceData, setPerformanceData] = useState<any[]>([]);
  const [department, setDepartment] = useState<string | null>(null);
  const [selectedMember, setSelectedMember] = useState<string | null>(
    searchParams.get('member') || null
  );

  useEffect(() => {
    fetchDepartment();
  }, []);

  useEffect(() => {
    if (department) {
      fetchPerformance();
    }
  }, [department]);

  const fetchDepartment = async () => {
    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: profile } = await supabase
      .from('users_login')
      .select('department')
      .eq('id', user.id)
      .single();

    setDepartment(profile?.department || null);
  };

  const fetchPerformance = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/subadmin/team/performance');
      if (!response.ok) {
        throw new Error('Failed to fetch performance data');
      }

      const data = await response.json();
      setPerformanceData(data.team_performance || []);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching performance:', error);
      toast.error('Failed to load performance data');
      setLoading(false);
    }
  };

  if (!department) {
    return (
      <DashboardLayout role="sub_admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  const getPerformanceMetrics = (member: any) => {
    if (department === 'CSE') {
      return {
        primary: member.avg_satisfaction_score || 0,
        primaryLabel: 'Avg Satisfaction',
        metrics: [
          { label: 'Followups Completed', value: member.total_followups_completed || 0 },
          { label: 'Tickets Resolved', value: member.complaints_resolved || 0 },
          { label: 'Escalations Handled', value: member.escalations_handled || 0 },
        ],
      };
    } else if (department === 'TELECALLER') {
      return {
        primary: member.accuracy_score || 0,
        primaryLabel: 'Accuracy Score',
        metrics: [
          { label: 'Leads Created', value: member.leads_created || 0 },
          { label: 'Leads Completed', value: member.leads_completed || 0 },
          { label: 'Conversion Rate', value: `${member.call_to_lead_conversion_rate || 0}%` },
        ],
      };
    } else {
      return {
        primary: member.completion_rate || 0,
        primaryLabel: 'Completion Rate',
        metrics: [
          { label: 'Audits Completed', value: member.audits_completed || 0 },
          { label: 'Workshops Passed', value: member.workshops_passed || 0 },
          { label: 'Critical Issues', value: member.critical_issues_identified || 0 },
        ],
      };
    }
  };

  return (
    <DashboardLayout role="sub_admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <TrendingUp className="w-6 h-6" />
                Team Performance
              </h1>
              <p className="text-gray-600 mt-1">Performance metrics for {department} team</p>
            </div>
            <button
              onClick={fetchPerformance}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Performance Cards */}
        {loading ? (
          <div className="flex items-center justify-center h-64">
            <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : performanceData.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-12 text-center">
            <BarChart3 className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600">No performance data available</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            {performanceData.map((member) => {
              const metrics = getPerformanceMetrics(member);
              return (
                <div key={member.member_id} className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
                  <div className="flex items-center justify-between mb-3 sm:mb-4">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">{member.member_name}</h3>
                        <p className="text-xs sm:text-sm text-gray-500 truncate">{member.member_email}</p>
                      </div>
                    </div>
                    <Award className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500 flex-shrink-0" />
                  </div>

                  <div className="mb-3 sm:mb-4">
                    <div className="flex items-end gap-1.5 sm:gap-2 mb-1.5 sm:mb-2">
                      <span className="text-2xl sm:text-3xl font-bold text-blue-600">
                        {metrics.primary.toFixed(1)}
                      </span>
                      <span className="text-xs sm:text-sm text-gray-500 mb-0.5 sm:mb-1">{metrics.primaryLabel}</span>
                    </div>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2 border-t pt-3 sm:pt-4">
                    {metrics.metrics.map((metric, index) => (
                      <div key={index} className="flex items-center justify-between">
                        <span className="text-xs sm:text-sm text-gray-600">{metric.label}</span>
                        <span className="text-xs sm:text-sm font-semibold text-gray-900">{metric.value}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t">
                    <Link
                      href={`/dashboard/sub_admin/performance/${member.member_id}`}
                      className="text-xs sm:text-sm text-blue-600 hover:text-blue-800 font-medium"
                    >
                      View Detailed Report →
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

export default function SubAdminPerformancePage() {
  return (
    <Suspense fallback={
      <DashboardLayout role="sub_admin">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    }>
      <SubAdminPerformanceContent />
    </Suspense>
  );
}
