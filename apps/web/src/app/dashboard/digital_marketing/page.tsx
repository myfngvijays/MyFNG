'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  TrendingUp, Users, Eye, MousePointerClick, DollarSign, 
  Calendar, BarChart3, FileText, Megaphone, Target,
  Share2, Image, Video, Link as LinkIcon
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function DigitalMarketingDashboard() {
  const [stats, setStats] = useState({
    totalLeads: 0,
    leadsToday: 0,
    conversionRate: 0,
    activeCampaigns: 0,
    totalImpressions: 0,
    totalClicks: 0,
    clickThroughRate: 0,
    totalSpent: 0,
    loading: true
  });

  const [recentCampaigns, setRecentCampaigns] = useState<any[]>([]);
  const [topPerforming, setTopPerforming] = useState<any[]>([]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  async function fetchDashboardData() {
    const supabase = createClient();

    try {
      const today = new Date().toISOString().split('T')[0];
      const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString();

      // Total leads (all time)
      const { count: totalLeadsCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true });

      // Leads today
      const { count: leadsTodayCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', `${today}T00:00:00`);

      // Leads this month
      const { count: leadsThisMonth } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', startOfMonth);

      // Calculate conversion rate (booked leads / total leads)
      const { count: bookedLeads } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .in('status', ['ACCEPTED', 'IN_PROGRESS', 'COMPLETED']);

      const conversionRate = totalLeadsCount && totalLeadsCount > 0 
        ? ((bookedLeads || 0) / totalLeadsCount * 100).toFixed(1)
        : 0;

      // Mock campaign data (can be replaced with actual campaigns table later)
      const mockCampaigns = [
        { id: 1, name: 'Summer Service Campaign', status: 'ACTIVE', impressions: 12500, clicks: 320, ctr: 2.56, spent: 15000 },
        { id: 2, name: 'New User Promotion', status: 'ACTIVE', impressions: 8900, clicks: 245, ctr: 2.75, spent: 12000 },
        { id: 3, name: 'Referral Program', status: 'PAUSED', impressions: 15600, clicks: 410, ctr: 2.63, spent: 18000 },
      ];

      setStats({
        totalLeads: totalLeadsCount || 0,
        leadsToday: leadsTodayCount || 0,
        conversionRate: parseFloat(conversionRate as string),
        activeCampaigns: mockCampaigns.filter(c => c.status === 'ACTIVE').length,
        totalImpressions: mockCampaigns.reduce((sum, c) => sum + c.impressions, 0),
        totalClicks: mockCampaigns.reduce((sum, c) => sum + c.clicks, 0),
        clickThroughRate: mockCampaigns.length > 0 
          ? parseFloat((mockCampaigns.reduce((sum, c) => sum + c.clicks, 0) / mockCampaigns.reduce((sum, c) => sum + c.impressions, 0) * 100).toFixed(2))
          : 0,
        totalSpent: mockCampaigns.reduce((sum, c) => sum + c.spent, 0),
        loading: false
      });

      setRecentCampaigns(mockCampaigns);
      setTopPerforming(mockCampaigns.sort((a, b) => b.ctr - a.ctr).slice(0, 3));

    } catch (error) {
      console.error('Error fetching dashboard data:', error);
      setStats(prev => ({ ...prev, loading: false }));
    }
  }

  if (stats.loading) {
    return (
      <DashboardLayout role="digital_marketing">
        <div className="flex items-center justify-center h-64">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading dashboard...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="digital_marketing">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-pink-600 text-white p-6 rounded-lg shadow-lg -mx-6 -mt-6 mb-6">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">📱 Digital Marketing Dashboard</h1>
          <p className="text-white font-medium mt-1">Manage campaigns, track analytics, and generate leads</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard
            title="Total Leads"
            value={stats.totalLeads.toLocaleString()}
            icon={<Users className="w-8 h-8 text-blue-600" />}
            bgColor="bg-blue-50"
            textColor="text-blue-600"
            subtitle={`${stats.leadsToday} today`}
          />
          
          <StatCard
            title="Conversion Rate"
            value={`${stats.conversionRate}%`}
            icon={<Target className="w-8 h-8 text-green-600" />}
            bgColor="bg-green-50"
            textColor="text-green-600"
          />

          <StatCard
            title="Active Campaigns"
            value={stats.activeCampaigns.toString()}
            icon={<Megaphone className="w-8 h-8 text-purple-600" />}
            bgColor="bg-purple-50"
            textColor="text-purple-600"
          />

          <StatCard
            title="Total Impressions"
            value={stats.totalImpressions.toLocaleString()}
            icon={<Eye className="w-8 h-8 text-indigo-600" />}
            bgColor="bg-indigo-50"
            textColor="text-indigo-600"
          />

          <StatCard
            title="Total Clicks"
            value={stats.totalClicks.toLocaleString()}
            icon={<MousePointerClick className="w-8 h-8 text-orange-600" />}
            bgColor="bg-orange-50"
            textColor="text-orange-600"
          />

          <StatCard
            title="Click-Through Rate"
            value={`${stats.clickThroughRate}%`}
            icon={<TrendingUp className="w-8 h-8 text-brand-secondary" />}
            bgColor="bg-blue-50"
            textColor="text-brand-secondary"
          />

          <StatCard
            title="Total Spent"
            value={`₹${(stats.totalSpent / 1000).toFixed(1)}K`}
            icon={<DollarSign className="w-8 h-8 text-red-600" />}
            bgColor="bg-red-50"
            textColor="text-red-600"
          />

          <StatCard
            title="Cost Per Lead"
            value={stats.totalLeads > 0 ? `₹${Math.round(stats.totalSpent / stats.totalLeads)}` : '₹0'}
            icon={<BarChart3 className="w-8 h-8 text-brand-primary" />}
            bgColor="bg-blue-50"
            textColor="text-brand-primary"
          />
        </div>

        {/* Quick Actions */}
        <div className="card">
          <h2 className="text-xl font-bold text-text-heading mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Link href="/dashboard/digital_marketing/campaigns/create">
              <button className="btn btn-primary w-full">
                <Megaphone className="w-5 h-5 mr-2" />
                Create Campaign
              </button>
            </Link>
            <Link href="/dashboard/digital_marketing/analytics">
              <button className="btn btn-outline w-full">
                <BarChart3 className="w-5 h-5 mr-2" />
                View Analytics
              </button>
            </Link>
            <Link href="/dashboard/digital_marketing/content">
              <button className="btn btn-outline w-full">
                <FileText className="w-5 h-5 mr-2" />
                Manage Content
              </button>
            </Link>
            <Link href="/dashboard/digital_marketing/leads">
              <button className="btn btn-outline w-full">
                <Users className="w-5 h-5 mr-2" />
                View Leads
              </button>
            </Link>
          </div>
        </div>

        {/* Two Column Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Campaigns */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-heading">Recent Campaigns</h2>
              <Link href="/dashboard/digital_marketing/campaigns" className="text-brand-primary hover:underline text-sm">
                View All →
              </Link>
            </div>
            
            {recentCampaigns.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No campaigns yet</p>
            ) : (
              <div className="space-y-3">
                {recentCampaigns.map((campaign) => (
                  <div 
                    key={campaign.id}
                    className="p-4 border border-gray-200 rounded-lg hover:border-brand-primary hover:shadow-md transition"
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="font-semibold text-text-heading">{campaign.name}</h3>
                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-600">
                          <span className="flex items-center gap-1">
                            <Eye className="w-4 h-4" />
                            {campaign.impressions.toLocaleString()}
                          </span>
                          <span className="flex items-center gap-1">
                            <MousePointerClick className="w-4 h-4" />
                            {campaign.clicks}
                          </span>
                          <span className="flex items-center gap-1">
                            <TrendingUp className="w-4 h-4" />
                            {campaign.ctr}%
                          </span>
                        </div>
                      </div>
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        campaign.status === 'ACTIVE' ? 'bg-green-100 text-green-700' :
                        campaign.status === 'PAUSED' ? 'bg-yellow-100 text-yellow-700' :
                        'bg-gray-100 text-gray-700'
                      }`}>
                        {campaign.status}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center justify-between text-sm">
                      <span className="text-gray-600">Spent: ₹{(campaign.spent / 1000).toFixed(1)}K</span>
                      <Link href={`/dashboard/digital_marketing/campaigns/${campaign.id}`} className="text-brand-primary hover:underline">
                        View Details →
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Top Performing Campaigns */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-text-heading">Top Performing</h2>
              <Link href="/dashboard/digital_marketing/analytics" className="text-brand-primary hover:underline text-sm">
                View Analytics →
              </Link>
            </div>
            
            {topPerforming.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No performance data yet</p>
            ) : (
              <div className="space-y-4">
                {topPerforming.map((campaign, index) => (
                  <div 
                    key={campaign.id}
                    className="p-4 border border-gray-200 rounded-lg"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-100 text-gray-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {index + 1}
                      </div>
                      <h3 className="font-semibold text-text-heading flex-1">{campaign.name}</h3>
                    </div>
                    <div className="grid grid-cols-3 gap-4 mt-3 text-sm">
                      <div>
                        <p className="text-gray-600">CTR</p>
                        <p className="font-bold text-brand-primary">{campaign.ctr}%</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Clicks</p>
                        <p className="font-bold">{campaign.clicks}</p>
                      </div>
                      <div>
                        <p className="text-gray-600">Impressions</p>
                        <p className="font-bold">{campaign.impressions.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

interface StatCardProps {
  title: string;
  value: string;
  icon: React.ReactNode;
  bgColor?: string;
  textColor?: string;
  subtitle?: string;
}

function StatCard({ title, value, icon, bgColor = 'bg-gray-50', textColor = 'text-text-body', subtitle }: StatCardProps) {
  return (
    <div className="card hover:shadow-lg transition">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm text-text-body mb-1">{title}</p>
          <p className={`text-3xl font-bold ${textColor}`}>{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${bgColor}`}>
          {icon}
        </div>
      </div>
    </div>
  );
}
