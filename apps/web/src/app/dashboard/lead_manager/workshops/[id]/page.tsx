'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY } from '@/lib/utils';
import {
  Building, MapPin, Phone, Mail, Star, CheckCircle, XCircle,
  ArrowLeft, Calendar, TrendingUp, Users, Wrench, Clock,
  AlertCircle, DollarSign, Award, FileText, Loader2
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

export default function WorkshopDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = getBrowserClient();
  
  const [workshop, setWorkshop] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    total_jobs: 0,
    active_jobs: 0,
    completed_jobs: 0,
    avg_completion_time: 0
  });
  const [recentLeads, setRecentLeads] = useState<any[]>([]);

  useEffect(() => {
    if (params.id) {
      fetchWorkshopDetails();
    }
  }, [params.id]);

  const fetchWorkshopDetails = async () => {
    setLoading(true);
    try {
      // Fetch workshop details
      const { data: workshopData, error: workshopError } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', params.id)
        .single();

      if (workshopError) throw workshopError;
      setWorkshop(workshopData);

      // Fetch workshop statistics
      const { count: totalJobs } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', params.id);

      const { count: activeJobs } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', params.id)
        .in('status', ['ACCEPTED', 'IN_PROGRESS', 'TEAM_ASSIGNED', 'PICKUP_SCHEDULED']);

      const { count: completedJobs } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .eq('workshop_id', params.id)
        .eq('status', 'COMPLETED');

      setStats({
        total_jobs: totalJobs || 0,
        active_jobs: activeJobs || 0,
        completed_jobs: completedJobs || 0,
        avg_completion_time: 0 // Calculate if needed
      });

      // Fetch recent leads
      const { data: leadsData } = await supabase
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          customer_phone,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          status,
          created_at,
          updated_at
        `)
        .eq('workshop_id', params.id)
        .order('created_at', { ascending: false })
        .limit(10);

      setRecentLeads(leadsData || []);

    } catch (error) {
      console.error('Error fetching workshop details:', error);
      toast.error('Failed to load workshop details');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const badges: Record<string, { bg: string; text: string; label: string }> = {
      'NEW': { bg: 'bg-blue-100', text: 'text-blue-800', label: 'New' },
      'ACCEPTED': { bg: 'bg-green-100', text: 'text-green-800', label: 'Accepted' },
      'IN_PROGRESS': { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'In Progress' },
      'COMPLETED': { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
      'REJECTED': { bg: 'bg-red-100', text: 'text-red-800', label: 'Rejected' },
    };
    
    const badge = badges[status] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status };
    return (
      <span className={`px-2 py-1 text-xs font-semibold rounded-full ${badge.bg} ${badge.text}`}>
        {badge.label}
      </span>
    );
  };

  if (loading) {
    return (
      <DashboardLayout role="lead_manager">
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-12 h-12 animate-spin text-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!workshop) {
    return (
      <DashboardLayout role="lead_manager">
        <div className="p-6 text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Workshop Not Found</h2>
          <button
            onClick={() => router.push('/dashboard/lead_manager/workshops')}
            className="btn-primary mt-4"
          >
            Back to Workshops
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="lead_manager">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex-1">
            <h1 className="text-3xl font-bold text-gray-900">{workshop.name}</h1>
            <div className="flex items-center gap-3 mt-2">
              {workshop.is_verified ? (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-green-100 text-green-800 text-sm font-semibold rounded-full">
                  <CheckCircle className="w-4 h-4" />
                  Verified Workshop
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 px-3 py-1 bg-yellow-100 text-yellow-800 text-sm font-semibold rounded-full">
                  <AlertCircle className="w-4 h-4" />
                  Unverified
                </span>
              )}
              {workshop.audit_score && (
                <div className="flex items-center gap-1 bg-yellow-50 px-3 py-1 rounded-full">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-semibold text-yellow-700">
                    {parseFloat(workshop.audit_score).toFixed(1)} Rating
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Jobs</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total_jobs}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Wrench className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Jobs</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.active_jobs}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <Clock className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Completed</p>
                <p className="text-3xl font-bold text-green-600">{stats.completed_jobs}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Success Rate</p>
                <p className="text-3xl font-bold text-purple-600">
                  {stats.total_jobs > 0 
                    ? Math.round((stats.completed_jobs / stats.total_jobs) * 100)
                    : 0}%
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workshop Information */}
          <div className="lg:col-span-1 space-y-6">
            {/* Basic Info */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Building className="w-5 h-5 text-brand-primary" />
                Workshop Information
              </h2>
              <div className="space-y-4">
                <div>
                  <label className="text-sm text-gray-600 font-medium">Address</label>
                  <div className="flex items-start gap-2 mt-1">
                    <MapPin className="w-4 h-4 text-gray-400 mt-1 flex-shrink-0" />
                    <p className="text-sm text-gray-900">
                      {workshop.address}<br />
                      {workshop.city}, {workshop.state}<br />
                      {workshop.pincode}
                    </p>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-600 font-medium">Contact Person</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Users className="w-4 h-4 text-gray-400" />
                    <p className="text-sm text-gray-900">{workshop.contact_person}</p>
                  </div>
                </div>

                <div>
                  <label className="text-sm text-gray-600 font-medium">Phone</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Phone className="w-4 h-4 text-gray-400" />
                    <a 
                      href={`tel:${workshop.phone}`} 
                      className="text-sm text-brand-primary hover:underline"
                    >
                      {workshop.phone}
                    </a>
                  </div>
                </div>

                {workshop.email && (
                  <div>
                    <label className="text-sm text-gray-600 font-medium">Email</label>
                    <div className="flex items-center gap-2 mt-1">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <a 
                        href={`mailto:${workshop.email}`} 
                        className="text-sm text-brand-primary hover:underline truncate"
                      >
                        {workshop.email}
                      </a>
                    </div>
                  </div>
                )}

                {workshop.gst_number && (
                  <div>
                    <label className="text-sm text-gray-600 font-medium">GST Number</label>
                    <div className="flex items-center gap-2 mt-1">
                      <FileText className="w-4 h-4 text-gray-400" />
                      <p className="text-sm text-gray-900 font-mono">{workshop.gst_number}</p>
                    </div>
                  </div>
                )}

                <div>
                  <label className="text-sm text-gray-600 font-medium">Registered On</label>
                  <div className="flex items-center gap-2 mt-1">
                    <Calendar className="w-4 h-4 text-gray-400" />
                    <p className="text-sm text-gray-900">
                      {formatDateDMY(workshop.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Quick Actions</h3>
              <div className="space-y-2">
                <button
                  onClick={() => {
                    // Assign lead to this workshop
                    toast('Lead assignment feature coming soon!', { icon: '📋' });
                  }}
                  className="w-full btn-primary text-sm py-2"
                >
                  Assign Lead
                </button>
                <button
                  onClick={() => {
                    // View all jobs
                    toast('View all jobs feature coming soon!', { icon: '📊' });
                  }}
                  className="w-full btn-outline text-sm py-2"
                >
                  View All Jobs
                </button>
              </div>
            </div>
          </div>

          {/* Recent Leads */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-lg shadow">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Wrench className="w-5 h-5 text-brand-primary" />
                  Recent Jobs
                </h2>
              </div>
              
              {recentLeads.length === 0 ? (
                <div className="p-12 text-center">
                  <Wrench className="w-16 h-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-xl text-gray-600">No jobs yet</p>
                  <p className="text-gray-500 mt-2">This workshop hasn't received any jobs</p>
                </div>
              ) : (
                <div className="divide-y divide-gray-200">
                  {recentLeads.map((lead) => (
                    <div key={lead.id} className="p-6 hover:bg-gray-50 transition">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-brand-primary">
                              {lead.lead_number}
                            </h3>
                            {getStatusBadge(lead.status)}
                          </div>
                          <div className="grid grid-cols-2 gap-4 mt-3">
                            <div>
                              <label className="text-xs text-gray-500">Customer</label>
                              <p className="text-sm font-medium text-gray-900">{lead.customer_name}</p>
                              <p className="text-xs text-gray-600">{lead.customer_phone}</p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Vehicle</label>
                              <p className="text-sm font-medium text-gray-900">{lead.vehicle_number}</p>
                              <p className="text-xs text-gray-600">
                                {lead.vehicle_make} {lead.vehicle_model}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Created</label>
                              <p className="text-sm text-gray-900">
                                {formatDateDMY(lead.created_at)}
                              </p>
                            </div>
                            <div>
                              <label className="text-xs text-gray-500">Last Updated</label>
                              <p className="text-sm text-gray-900">
                                {formatDateDMY(lead.updated_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                        <Link
                          href={`/dashboard/lead_manager/leads/${lead.id}`}
                          className="ml-4 text-brand-primary hover:text-brand-secondary font-medium text-sm"
                        >
                          View →
                        </Link>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

