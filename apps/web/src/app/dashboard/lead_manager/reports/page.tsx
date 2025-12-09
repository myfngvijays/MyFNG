'use client';

import { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import DashboardLayout from '@/components/DashboardLayout';
import {
  TrendingUp, TrendingDown, Users, Building, CheckCircle, XCircle,
  Clock, AlertTriangle, BarChart3, PieChart, Calendar, Download,
  Filter, Search, Loader2, ArrowUpRight, ArrowDownRight
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function LeadManagerReportsPage() {
  const supabase = createClientComponentClient();

  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });

  // Summary Stats
  const [stats, setStats] = useState({
    total_leads: 0,
    validated_leads: 0,
    incomplete_leads: 0,
    assigned_leads: 0,
    validation_rate: 0,
    avg_validation_time: 0
  });

  // Lead Status Breakdown
  const [statusBreakdown, setStatusBreakdown] = useState<any[]>([]);

  // Workshop Performance
  const [workshopPerformance, setWorkshopPerformance] = useState<any[]>([]);

  // City-wise Distribution
  const [cityDistribution, setCityDistribution] = useState<any[]>([]);

  // Daily Trends
  const [dailyTrends, setDailyTrends] = useState<any[]>([]);

  // Priority Distribution
  const [priorityDistribution, setPriorityDistribution] = useState<any[]>([]);

  // SLA Tracking
  const [slaStats, setSlaStats] = useState({
    on_time: 0,
    at_risk: 0,
    breached: 0,
    on_time_percentage: 0,
    at_risk_percentage: 0,
    breached_percentage: 0
  });

  useEffect(() => {
    fetchReports();
  }, [dateRange]);

  async function fetchReports() {
    setLoading(true);
    try {
      await Promise.all([
        fetchSummaryStats(),
        fetchStatusBreakdown(),
        fetchWorkshopPerformance(),
        fetchCityDistribution(),
        fetchDailyTrends(),
        fetchPriorityDistribution(),
        fetchSLAStats()
      ]);
    } catch (error) {
      console.error('Error fetching reports:', error);
      toast.error('Failed to load reports');
    } finally {
      setLoading(false);
    }
  }

  async function fetchSummaryStats() {
    const { count: totalLeads } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    const { count: validatedLeads } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'VALIDATED')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    const { count: incompleteLeads } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .eq('is_incomplete', true)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    const { count: assignedLeads } = await supabase
      .from('service_leads')
      .select('*', { count: 'exact', head: true })
      .in('status', ['ASSIGNED_TO_WORKSHOP', 'ACCEPTED', 'IN_PROGRESS'])
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    const validationRate = totalLeads ? ((validatedLeads || 0) / totalLeads) * 100 : 0;

    setStats({
      total_leads: totalLeads || 0,
      validated_leads: validatedLeads || 0,
      incomplete_leads: incompleteLeads || 0,
      assigned_leads: assignedLeads || 0,
      validation_rate: Math.round(validationRate),
      avg_validation_time: 0 // Calculate if needed
    });
  }

  async function fetchStatusBreakdown() {
    const { data, error } = await supabase
      .from('service_leads')
      .select('status')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    if (error) {
      console.error('Status breakdown error:', error);
      return;
    }

    // Count by status
    const statusCounts: Record<string, number> = {};
    data.forEach(lead => {
      statusCounts[lead.status] = (statusCounts[lead.status] || 0) + 1;
    });

    const breakdown = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      count,
      percentage: ((count / data.length) * 100).toFixed(1)
    }));

    setStatusBreakdown(breakdown);
  }

  async function fetchWorkshopPerformance() {
    const { data, error } = await supabase
      .from('service_leads')
      .select(`
        workshop_id,
        status,
        workshops(name, city)
      `)
      .not('workshop_id', 'is', null)
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    if (error) {
      console.error('Workshop performance error:', error);
      return;
    }

    // Group by workshop
    const workshopStats: Record<string, any> = {};
    data.forEach((lead: any) => {
      const workshopId = lead.workshop_id;
      if (!workshopStats[workshopId]) {
        workshopStats[workshopId] = {
          workshop_name: lead.workshops?.name || 'Unknown',
          city: lead.workshops?.city || 'N/A',
          total: 0,
          accepted: 0,
          completed: 0,
          rejected: 0
        };
      }
      workshopStats[workshopId].total++;
      if (lead.status === 'ACCEPTED') workshopStats[workshopId].accepted++;
      if (lead.status === 'COMPLETED') workshopStats[workshopId].completed++;
      if (lead.status === 'REJECTED') workshopStats[workshopId].rejected++;
    });

    const performance = Object.entries(workshopStats)
      .map(([id, stats]: [string, any]) => ({
        workshop_id: id,
        workshop_name: stats.workshop_name,
        city: stats.city,
        total: stats.total,
        accepted: stats.accepted,
        completed: stats.completed,
        rejected: stats.rejected,
        acceptance_rate: stats.total > 0 ? ((stats.accepted / stats.total) * 100).toFixed(1) : 0,
        completion_rate: stats.total > 0 ? ((stats.completed / stats.total) * 100).toFixed(1) : 0
      }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);

    setWorkshopPerformance(performance);
  }

  async function fetchCityDistribution() {
    const { data, error } = await supabase
      .from('service_leads')
      .select('city')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    if (error) {
      console.error('City distribution error:', error);
      return;
    }

    // Count by city
    const cityCounts: Record<string, number> = {};
    data.forEach(lead => {
      const city = lead.city || 'Unknown';
      cityCounts[city] = (cityCounts[city] || 0) + 1;
    });

    const distribution = Object.entries(cityCounts)
      .map(([city, count]) => ({
        city,
        count,
        percentage: ((count / data.length) * 100).toFixed(1)
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    setCityDistribution(distribution);
  }

  async function fetchDailyTrends() {
    const { data, error } = await supabase
      .from('service_leads')
      .select('created_at, status')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end)
      .order('created_at');

    if (error) {
      console.error('Daily trends error:', error);
      return;
    }

    // Group by date
    const dailyData: Record<string, any> = {};
    data.forEach(lead => {
      const date = new Date(lead.created_at).toISOString().split('T')[0];
      if (!dailyData[date]) {
        dailyData[date] = { date, total: 0, validated: 0, assigned: 0 };
      }
      dailyData[date].total++;
      if (lead.status === 'VALIDATED') dailyData[date].validated++;
      if (['ASSIGNED_TO_WORKSHOP', 'ACCEPTED', 'IN_PROGRESS'].includes(lead.status)) {
        dailyData[date].assigned++;
      }
    });

    const trends = Object.values(dailyData).slice(-14); // Last 14 days
    setDailyTrends(trends);
  }

  async function fetchPriorityDistribution() {
    const { data, error } = await supabase
      .from('service_leads')
      .select('priority')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    if (error) {
      console.error('Priority distribution error:', error);
      return;
    }

    // Count by priority
    const priorityCounts: Record<string, number> = {};
    data.forEach(lead => {
      const priority = lead.priority || 'MEDIUM';
      priorityCounts[priority] = (priorityCounts[priority] || 0) + 1;
    });

    const distribution = Object.entries(priorityCounts).map(([priority, count]) => ({
      priority,
      count,
      percentage: ((count / data.length) * 100).toFixed(1)
    }));

    setPriorityDistribution(distribution);
  }

  async function fetchSLAStats() {
    const { data, error } = await supabase
      .from('service_leads')
      .select('sla_state, sla_status')
      .gte('created_at', dateRange.start)
      .lte('created_at', dateRange.end);

    if (error) {
      console.error('SLA stats error:', error);
      return;
    }

    let onTime = 0;
    let atRisk = 0;
    let breached = 0;

    data.forEach(lead => {
      const slaState = lead.sla_state || lead.sla_status || 'ON_TIME';
      if (slaState === 'ON_TIME') onTime++;
      else if (slaState === 'AT_RISK') atRisk++;
      else if (slaState === 'BREACHED') breached++;
    });

    const total = data.length || 1;

    setSlaStats({
      on_time: onTime,
      at_risk: atRisk,
      breached: breached,
      on_time_percentage: Math.round((onTime / total) * 100),
      at_risk_percentage: Math.round((atRisk / total) * 100),
      breached_percentage: Math.round((breached / total) * 100)
    });
  }

  const exportReport = () => {
    toast.success('Export feature coming soon!', { icon: '📊' });
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'NEW': 'bg-blue-100 text-blue-800',
      'VALIDATED': 'bg-green-100 text-green-800',
      'ASSIGNED_TO_WORKSHOP': 'bg-purple-100 text-purple-800',
      'ACCEPTED': 'bg-green-100 text-green-800',
      'IN_PROGRESS': 'bg-yellow-100 text-yellow-800',
      'COMPLETED': 'bg-green-100 text-green-800',
      'REJECTED': 'bg-red-100 text-red-800',
      'INCOMPLETE': 'bg-orange-100 text-orange-800'
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getPriorityColor = (priority: string) => {
    const colors: Record<string, string> = {
      'LOW': 'bg-gray-100 text-gray-800',
      'MEDIUM': 'bg-blue-100 text-blue-800',
      'HIGH': 'bg-orange-100 text-orange-800',
      'URGENT': 'bg-red-100 text-red-800',
      'CRITICAL': 'bg-red-200 text-red-900'
    };
    return colors[priority] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <DashboardLayout role="lead_manager">
        <div className="flex items-center justify-center h-48 sm:h-64 md:h-screen">
          <Loader2 className="w-10 w-10 sm:w-11 sm:h-11 md:w-12 md:h-12 animate-spin text-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="lead_manager">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-4 sm:mb-5 md:mb-8">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">📊 Reports & Analytics</h1>
              <p className="text-white font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Comprehensive lead management insights</p>
            </div>
            <button
              onClick={exportReport}
              className="bg-white text-brand-primary px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium flex items-center gap-1.5 sm:gap-2 hover:bg-yellow-50 transition w-full sm:w-auto justify-center"
            >
              <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Export Report
            </button>
          </div>
        </div>

        {/* Date Range Filter */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 mb-4 sm:mb-5 md:mb-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 md:gap-4">
            <Calendar className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500 flex-shrink-0" />
            <label className="text-xs sm:text-sm font-medium text-gray-700">Date Range:</label>
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2 sm:gap-3 flex-1 w-full sm:w-auto">
              <input
                type="date"
                value={dateRange.start}
                onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
                className="border border-gray-300 rounded px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm w-full sm:w-auto"
              />
              <span className="text-gray-500 text-xs sm:text-sm">to</span>
              <input
                type="date"
                value={dateRange.end}
                onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
                className="border border-gray-300 rounded px-2 sm:px-3 py-1 sm:py-1.5 text-xs sm:text-sm w-full sm:w-auto"
              />
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 md:gap-6 mb-4 sm:mb-5 md:mb-8">
          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Total Leads</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 mt-0.5 sm:mt-1">{stats.total_leads}</p>
              </div>
              <div className="bg-blue-100 p-2 sm:p-2.5 md:p-3 rounded-full flex-shrink-0">
                <Users className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Validated</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-green-600 mt-0.5 sm:mt-1">{stats.validated_leads}</p>
                <div className="flex items-center gap-1 mt-1 sm:mt-2">
                  <ArrowUpRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                  <span className="text-[10px] sm:text-xs text-green-600 font-medium">{stats.validation_rate}%</span>
                </div>
              </div>
              <div className="bg-green-100 p-2 sm:p-2.5 md:p-3 rounded-full flex-shrink-0">
                <CheckCircle className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Incomplete</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-orange-600 mt-0.5 sm:mt-1">{stats.incomplete_leads}</p>
              </div>
              <div className="bg-orange-100 p-2 sm:p-2.5 md:p-3 rounded-full flex-shrink-0">
                <AlertTriangle className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-orange-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Assigned</p>
                <p className="text-xl sm:text-2xl md:text-3xl font-bold text-purple-600 mt-0.5 sm:mt-1">{stats.assigned_leads}</p>
              </div>
              <div className="bg-purple-100 p-2 sm:p-2.5 md:p-3 rounded-full flex-shrink-0">
                <Building className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Daily Trends Chart */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 mb-4 sm:mb-5 md:mb-8">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
            <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
            <span>Daily Lead Trends (Last 14 Days)</span>
          </h3>
          {dailyTrends.length > 0 ? (
            <div className="overflow-x-auto">
              <div className="min-w-full">
                {/* Line Chart Visualization */}
                <div className="relative h-48 sm:h-56 md:h-64 mb-3 sm:mb-4">
                  {/* Y-axis labels */}
                  <div className="absolute left-0 top-0 bottom-0 w-8 sm:w-10 md:w-12 flex flex-col justify-between text-[10px] sm:text-xs text-gray-500">
                    {[...Array(5)].map((_, i) => {
                      const maxValue = Math.max(...dailyTrends.map(d => d.total));
                      const value = Math.round(maxValue * (4 - i) / 4);
                      return <span key={i}>{value}</span>;
                    })}
                  </div>
                  
                  {/* Chart area */}
                  <div className="ml-8 sm:ml-10 md:ml-12 h-full border-l border-b border-gray-300 relative">
                    {/* Grid lines */}
                    {[...Array(4)].map((_, i) => (
                      <div 
                        key={i} 
                        className="absolute w-full border-t border-gray-100"
                        style={{ top: `${(i + 1) * 25}%` }}
                      />
                    ))}
                    
                    {/* Data points and lines */}
                    <svg className="w-full h-full" preserveAspectRatio="none">
                      {/* Total leads line (blue) */}
                      <polyline
                        fill="none"
                        stroke="#3B82F6"
                        strokeWidth="2"
                        points={dailyTrends.map((day, i) => {
                          const x = (i / (dailyTrends.length - 1)) * 100;
                          const maxValue = Math.max(...dailyTrends.map(d => d.total));
                          const y = 100 - ((day.total / maxValue) * 95);
                          return `${x}%,${y}%`;
                        }).join(' ')}
                      />
                      
                      {/* Validated leads line (green) */}
                      <polyline
                        fill="none"
                        stroke="#10B981"
                        strokeWidth="2"
                        points={dailyTrends.map((day, i) => {
                          const x = (i / (dailyTrends.length - 1)) * 100;
                          const maxValue = Math.max(...dailyTrends.map(d => d.total));
                          const y = 100 - ((day.validated / maxValue) * 95);
                          return `${x}%,${y}%`;
                        }).join(' ')}
                      />
                      
                      {/* Assigned leads line (purple) */}
                      <polyline
                        fill="none"
                        stroke="#8B5CF6"
                        strokeWidth="2"
                        points={dailyTrends.map((day, i) => {
                          const x = (i / (dailyTrends.length - 1)) * 100;
                          const maxValue = Math.max(...dailyTrends.map(d => d.total));
                          const y = 100 - ((day.assigned / maxValue) * 95);
                          return `${x}%,${y}%`;
                        }).join(' ')}
                      />
                    </svg>
                  </div>
                </div>
                
                {/* X-axis labels */}
                <div className="ml-8 sm:ml-10 md:ml-12 flex justify-between text-[10px] sm:text-xs text-gray-500">
                  {dailyTrends.map((day, i) => (
                    i % 2 === 0 && (
                      <span key={i}>{new Date(day.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                    )
                  ))}
                </div>
                
                {/* Legend */}
                <div className="flex flex-wrap items-center justify-center gap-3 sm:gap-4 md:gap-6 mt-4 sm:mt-5 md:mt-6">
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-3 h-0.5 sm:w-4 sm:h-1 bg-blue-500" />
                    <span className="text-xs sm:text-sm text-gray-700">Total Leads</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-3 h-0.5 sm:w-4 sm:h-1 bg-green-500" />
                    <span className="text-xs sm:text-sm text-gray-700">Validated</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <div className="w-3 h-0.5 sm:w-4 sm:h-1 bg-purple-500" />
                    <span className="text-xs sm:text-sm text-gray-700">Assigned</span>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-gray-500 text-xs sm:text-sm py-6 sm:py-8">No trend data available for the selected period</p>
          )}
        </div>

        {/* SLA Tracking */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 mb-4 sm:mb-5 md:mb-8">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-4 sm:mb-5 md:mb-6 flex items-center gap-1.5 sm:gap-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
            <span>SLA Performance Tracking</span>
          </h3>
          
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-5 md:gap-6 mb-4 sm:mb-5 md:mb-6">
            {/* On Time */}
            <div className="bg-green-50 rounded-lg p-4 sm:p-5 md:p-6 border-2 border-green-200">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-green-900">On Time</h4>
                <CheckCircle className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-green-600 flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-green-600 mb-1.5 sm:mb-2">{slaStats.on_time}</p>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex-1 bg-green-200 rounded-full h-1.5 sm:h-2">
                  <div 
                    className="bg-green-600 h-1.5 sm:h-2 rounded-full"
                    style={{ width: `${slaStats.on_time_percentage}%` }}
                  />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-green-700">{slaStats.on_time_percentage}%</span>
              </div>
              <p className="text-[10px] sm:text-xs text-green-700 mt-1.5 sm:mt-2">✓ Meeting all SLA requirements</p>
            </div>

            {/* At Risk */}
            <div className="bg-yellow-50 rounded-lg p-4 sm:p-5 md:p-6 border-2 border-yellow-200">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-yellow-900">At Risk</h4>
                <AlertTriangle className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-yellow-600 flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-yellow-600 mb-1.5 sm:mb-2">{slaStats.at_risk}</p>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex-1 bg-yellow-200 rounded-full h-1.5 sm:h-2">
                  <div 
                    className="bg-yellow-600 h-1.5 sm:h-2 rounded-full"
                    style={{ width: `${slaStats.at_risk_percentage}%` }}
                  />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-yellow-700">{slaStats.at_risk_percentage}%</span>
              </div>
              <p className="text-[10px] sm:text-xs text-yellow-700 mt-1.5 sm:mt-2">⚠ Approaching SLA deadline</p>
            </div>

            {/* Breached */}
            <div className="bg-red-50 rounded-lg p-4 sm:p-5 md:p-6 border-2 border-red-200">
              <div className="flex items-center justify-between mb-2 sm:mb-3">
                <h4 className="text-xs sm:text-sm font-semibold text-red-900">Breached</h4>
                <XCircle className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 text-red-600 flex-shrink-0" />
              </div>
              <p className="text-2xl sm:text-3xl md:text-4xl font-bold text-red-600 mb-1.5 sm:mb-2">{slaStats.breached}</p>
              <div className="flex items-center gap-1.5 sm:gap-2">
                <div className="flex-1 bg-red-200 rounded-full h-1.5 sm:h-2">
                  <div 
                    className="bg-red-600 h-1.5 sm:h-2 rounded-full"
                    style={{ width: `${slaStats.breached_percentage}%` }}
                  />
                </div>
                <span className="text-xs sm:text-sm font-semibold text-red-700">{slaStats.breached_percentage}%</span>
              </div>
              <p className="text-[10px] sm:text-xs text-red-700 mt-1.5 sm:mt-2">✗ Exceeded SLA deadline</p>
            </div>
          </div>

          {/* SLA Summary */}
          <div className="bg-gray-50 rounded-lg p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-xs sm:text-sm font-medium text-gray-700">Overall SLA Compliance</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">
                  {slaStats.on_time_percentage >= 90 ? '🎉 Excellent performance!' :
                   slaStats.on_time_percentage >= 75 ? '👍 Good performance' :
                   slaStats.on_time_percentage >= 50 ? '⚠️ Needs improvement' :
                   '🚨 Critical - Immediate action required'}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-2xl sm:text-2.5xl md:text-3xl font-bold text-brand-primary">{slaStats.on_time_percentage}%</p>
                <p className="text-[10px] sm:text-xs text-gray-500">On-time rate</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 md:gap-6 mb-4 sm:mb-5 md:mb-8">
          {/* Status Breakdown */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <PieChart className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
              <span>Lead Status Distribution</span>
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {statusBreakdown.map((item) => (
                <div key={item.status} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 w-full sm:w-auto">
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${getStatusColor(item.status)} flex-shrink-0`}>
                      {item.status}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 sm:h-2 min-w-0">
                      <div
                        className="bg-brand-primary h-1.5 sm:h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gray-700 ml-0 sm:ml-3 flex-shrink-0">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Priority Distribution */}
          <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
            <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
              <span>Priority Distribution</span>
            </h3>
            <div className="space-y-2 sm:space-y-3">
              {priorityDistribution.map((item) => (
                <div key={item.priority} className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-0">
                  <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0 w-full sm:w-auto">
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${getPriorityColor(item.priority)} flex-shrink-0`}>
                      {item.priority}
                    </span>
                    <div className="flex-1 bg-gray-200 rounded-full h-1.5 sm:h-2 min-w-0">
                      <div
                        className="bg-brand-secondary h-1.5 sm:h-2 rounded-full"
                        style={{ width: `${item.percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs sm:text-sm font-semibold text-gray-700 ml-0 sm:ml-3 flex-shrink-0">
                    {item.count} ({item.percentage}%)
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Workshop Performance */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6 mb-4 sm:mb-5 md:mb-8">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
            <Building className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
            <span>Top Workshop Performance</span>
          </h3>
          <div className="overflow-x-auto">
            {/* Desktop Table */}
            <div className="hidden lg:block">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Workshop</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-left text-[10px] sm:text-xs font-medium text-gray-500 uppercase">City</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Total</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Accepted</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Completed</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Acceptance %</th>
                    <th className="px-3 sm:px-4 py-2 sm:py-3 text-center text-[10px] sm:text-xs font-medium text-gray-500 uppercase">Completion %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {workshopPerformance.map((workshop, idx) => (
                    <tr key={workshop.workshop_id} className="hover:bg-gray-50">
                      <td className="px-3 sm:px-4 py-2 sm:py-3">
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <span className="text-xs sm:text-sm font-medium text-gray-900">#{idx + 1}</span>
                          <span className="text-xs sm:text-sm text-gray-900 truncate">{workshop.workshop_name}</span>
                        </div>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm text-gray-600">{workshop.city}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm font-medium">{workshop.total}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm text-green-600">{workshop.accepted}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-center text-xs sm:text-sm text-blue-600">{workshop.completed}</td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-semibold ${
                          parseFloat(workshop.acceptance_rate) >= 80 ? 'bg-green-100 text-green-800' :
                          parseFloat(workshop.acceptance_rate) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {workshop.acceptance_rate}%
                        </span>
                      </td>
                      <td className="px-3 sm:px-4 py-2 sm:py-3 text-center">
                        <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] sm:text-xs font-semibold ${
                          parseFloat(workshop.completion_rate) >= 80 ? 'bg-green-100 text-green-800' :
                          parseFloat(workshop.completion_rate) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                          'bg-red-100 text-red-800'
                        }`}>
                          {workshop.completion_rate}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-200">
              {workshopPerformance.map((workshop, idx) => (
                <div key={workshop.workshop_id} className="p-3 sm:p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 sm:gap-2 mb-1">
                        <span className="text-xs sm:text-sm font-medium text-gray-900">#{idx + 1}</span>
                        <span className="text-xs sm:text-sm text-gray-900 truncate">{workshop.workshop_name}</span>
                      </div>
                      <div className="text-[10px] sm:text-xs text-gray-500">{workshop.city}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <div>
                      <div className="text-[10px] sm:text-xs text-gray-500">Total</div>
                      <div className="text-xs sm:text-sm font-medium">{workshop.total}</div>
                    </div>
                    <div>
                      <div className="text-[10px] sm:text-xs text-gray-500">Accepted</div>
                      <div className="text-xs sm:text-sm font-medium text-green-600">{workshop.accepted}</div>
                    </div>
                    <div>
                      <div className="text-[10px] sm:text-xs text-gray-500">Completed</div>
                      <div className="text-xs sm:text-sm font-medium text-blue-600">{workshop.completed}</div>
                    </div>
                    <div>
                      <div className="text-[10px] sm:text-xs text-gray-500">Completion %</div>
                      <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold ${
                        parseFloat(workshop.completion_rate) >= 80 ? 'bg-green-100 text-green-800' :
                        parseFloat(workshop.completion_rate) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {workshop.completion_rate}%
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] sm:text-xs text-gray-500 mb-1">Acceptance Rate</div>
                    <span className={`inline-block px-1.5 sm:px-2 py-0.5 rounded text-[10px] sm:text-xs font-semibold ${
                      parseFloat(workshop.acceptance_rate) >= 80 ? 'bg-green-100 text-green-800' :
                      parseFloat(workshop.acceptance_rate) >= 50 ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {workshop.acceptance_rate}%
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* City Distribution */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
          <h3 className="text-base sm:text-lg font-bold text-gray-900 mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
            <BarChart3 className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
            <span>Top Cities by Lead Volume</span>
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
            {cityDistribution.map((item, idx) => (
              <div key={item.city} className="text-center p-3 sm:p-4 bg-gray-50 rounded-lg">
                <p className="text-xl sm:text-2xl font-bold text-brand-primary">{item.count}</p>
                <p className="text-xs sm:text-sm font-medium text-gray-900 mt-0.5 sm:mt-1 truncate">{item.city}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">{item.percentage}%</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

