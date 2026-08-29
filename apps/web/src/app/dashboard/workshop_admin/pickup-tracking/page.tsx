'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import type { PickupTracking, ServiceLead, User, PickupIncident } from '@/shared/types';
import { formatDateTime } from "@/lib/utils";
import DashboardLayout from '@/components/DashboardLayout';
import {
  WorkshopPageHeader,
  WorkshopPageShell,
  WorkshopFilterPill,
  WorkshopEmpty,
} from '@/components/workshop/WorkshopUi';

export default function PickupTrackingPage() {
  const router = useRouter();
  const supabase = createClient();
  
  const [pickups, setPickups] = useState<PickupTracking[]>([]);
  const [incidents, setIncidents] = useState<PickupIncident[]>([]);
  const [selectedTab, setSelectedTab] = useState<'active' | 'completed' | 'incidents'>('active');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchPickupTracking();
    fetchIncidents();
    
    // Subscribe to real-time updates
    const subscription = supabase
      .channel('pickup_tracking_changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_tracking' }, () => {
        fetchPickupTracking();
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pickup_incidents' }, () => {
        fetchIncidents();
      })
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, [selectedTab]);

  const fetchPickupTracking = async () => {
    try {
      let query = supabase
        .from('pickup_tracking')
        .select(`
          *,
          lead:service_leads(*),
          pickup_assigned_to_user:users_login!pickup_assigned_to(*),
          drop_assigned_to_user:users_login!drop_assigned_to(*)
        `);

      if (selectedTab === 'active') {
        query = query.in('pickup_status', ['PENDING', 'OTP_VERIFIED', 'PICKED', 'IN_TRANSIT']);
      } else if (selectedTab === 'completed') {
        query = query.in('pickup_status', ['ARRIVED_AT_WORKSHOP', 'DROPPED']);
      }

      const { data, error } = await query.order('created_at', { ascending: false });

      if (error) throw error;
      setPickups(data || []);
    } catch (error) {
      console.error('Error fetching pickup tracking:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchIncidents = async () => {
    try {
      const { data, error } = await supabase
        .from('pickup_incidents')
        .select(`
          *,
          lead:service_leads(*),
          reported_by_user:users_login!reported_by(*)
        `)
        .eq('status', 'OPEN')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setIncidents(data || []);
    } catch (error) {
      console.error('Error fetching incidents:', error);
    }
  };

  const getStatusColor = (status: string) => {
    const statusMap: Record<string, string> = {
      PENDING: 'bg-yellow-100 text-yellow-800',
      OTP_VERIFIED: 'bg-blue-100 text-blue-800',
      PICKED: 'bg-indigo-100 text-indigo-800',
      IN_TRANSIT: 'bg-purple-100 text-purple-800',
      ARRIVED_AT_WORKSHOP: 'bg-green-100 text-green-800',
      DROPPED: 'bg-green-100 text-green-800',
      FAILED_PICKUP: 'bg-red-100 text-red-800',
    };
    return statusMap[status] || 'bg-gray-100 text-gray-800';
  };

  const getStatusLabel = (status: string) => {
    const labelMap: Record<string, string> = {
      NOT_ASSIGNED: 'Not Assigned',
      PENDING: 'Pickup Pending',
      OTP_VERIFIED: 'OTP Verified',
      PICKED: 'Vehicle Picked',
      IN_TRANSIT: 'In Transit',
      ARRIVED_AT_WORKSHOP: 'Arrived',
      DROPPED: 'Dropped',
      FAILED_PICKUP: 'Failed',
    };
    return labelMap[status] || status;
  };

  const getSeverityColor = (severity: string) => {
    const colorMap: Record<string, string> = {
      LOW: 'bg-blue-100 text-blue-800',
      MEDIUM: 'bg-yellow-100 text-yellow-800',
      HIGH: 'bg-orange-100 text-orange-800',
      CRITICAL: 'bg-red-100 text-red-800',
    };
    return colorMap[severity] || 'bg-gray-100 text-gray-800';
  };

  const filteredPickups = pickups.filter((pickup) => {
    if (!searchTerm) return true;
    const lead = pickup.lead as ServiceLead;
    return (
      lead?.lead_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead?.customer_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      lead?.vehicle_number?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  if (loading) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#004AAD]"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_admin">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Workshop Owner"
          title="Pickup & Drop Tracking"
          subtitle="Monitor real-time pickup boy operations"
          right={
            <button
              onClick={() => router.push('/dashboard/workshop_admin')}
              className="inline-flex w-full min-h-11 items-center justify-center rounded-xl bg-[#023D95] px-4 py-2 text-sm font-bold text-white shadow-sm hover:bg-[#012f73] min-[900px]:w-auto"
            >
              Back to Dashboard
            </button>
          }
        />

        <div className="flex flex-wrap gap-2 overflow-x-auto pb-1">
          <WorkshopFilterPill active={selectedTab === 'active'} onClick={() => setSelectedTab('active')}>
            Active Pickups ({pickups.filter((p) => ['PENDING', 'OTP_VERIFIED', 'PICKED', 'IN_TRANSIT'].includes(p.pickup_status)).length})
          </WorkshopFilterPill>
          <WorkshopFilterPill active={selectedTab === 'completed'} onClick={() => setSelectedTab('completed')}>
            Completed
          </WorkshopFilterPill>
          <WorkshopFilterPill active={selectedTab === 'incidents'} onClick={() => setSelectedTab('incidents')}>
            Incidents{incidents.length > 0 ? ` (${incidents.length})` : ''}
          </WorkshopFilterPill>
        </div>

        {selectedTab !== 'incidents' && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <input
              type="text"
              placeholder="Search by lead number, customer name, or vehicle number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-4 py-2 border border-slate-200 rounded-xl focus:ring-2 focus:ring-[#004AAD] focus:border-transparent"
            />
          </div>
        )}

        {selectedTab === 'incidents' ? (
          <div className="space-y-4">
            {incidents.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <WorkshopEmpty>No open incidents</WorkshopEmpty>
              </div>
            ) : (
              incidents.map((incident) => {
                const lead = incident.lead as ServiceLead;
                const reportedBy = incident.reported_by_user as User;
                
                return (
                  <div key={incident.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getSeverityColor(incident.severity)}`}>
                            {incident.severity}
                          </span>
                          <span className="text-sm text-gray-500">
                            {formatDateTime(incident.created_at)}
                          </span>
                        </div>
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {incident.incident_type.replace('_', ' ')}
                        </h3>
                        <p className="text-sm text-gray-600">
                          Lead: {lead?.lead_number} | {lead?.vehicle_number}
                        </p>
                      </div>
                      <button className="inline-flex min-h-11 items-center justify-center rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-bold text-white hover:bg-[#023D95]">
                        View Details
                      </button>
                    </div>

                    <p className="text-gray-700 mb-4">{incident.description}</p>

                    <div className="flex items-center gap-4 text-sm">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-500">Reported by:</span>
                        <span className="font-medium">{reportedBy?.full_name}</span>
                      </div>
                      {incident.location_address && (
                        <div className="flex items-center gap-2">
                          <span className="text-gray-500">Location:</span>
                          <span className="font-medium">{incident.location_address}</span>
                        </div>
                      )}
                    </div>

                    {incident.photo_urls && incident.photo_urls.length > 0 && (
                      <div className="mt-4 flex gap-2">
                        {incident.photo_urls.slice(0, 3).map((url, index) => (
                          <img
                            key={index}
                            src={url}
                            alt="Incident"
                            className="w-20 h-20 object-cover rounded-lg"
                          />
                        ))}
                        {incident.photo_urls.length > 3 && (
                          <div className="w-20 h-20 bg-gray-100 rounded-lg flex items-center justify-center text-gray-600 text-sm">
                            +{incident.photo_urls.length - 3}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            {filteredPickups.length === 0 ? (
              <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                <WorkshopEmpty>No pickup tasks found</WorkshopEmpty>
              </div>
            ) : (
              filteredPickups.map((tracking) => {
                const lead = tracking.lead as ServiceLead;
                const pickupBoy = tracking.pickup_assigned_to_user as User;
                
                return (
                  <div key={tracking.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold text-gray-900">
                            Lead #{lead?.lead_number}
                          </h3>
                          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${getStatusColor(tracking.pickup_status)}`}>
                            {getStatusLabel(tracking.pickup_status)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-gray-500">Customer:</span>
                            <span className="ml-2 font-medium">{lead?.customer_name}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Vehicle:</span>
                            <span className="ml-2 font-medium">{lead?.vehicle_number}</span>
                          </div>
                          <div>
                            <span className="text-gray-500">Pickup Boy:</span>
                            <span className="ml-2 font-medium">{pickupBoy?.full_name || 'Not assigned'}</span>
                          </div>
                          {tracking.pickup_distance && (
                            <div>
                              <span className="text-gray-500">Distance:</span>
                              <span className="ml-2 font-medium">{tracking.pickup_distance.toFixed(1)} km</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="flex items-center gap-2 text-xs text-gray-600 bg-gray-50 rounded-lg p-4">
                      <div className={`flex items-center gap-1 ${tracking.pickup_assigned_at ? 'text-blue-600' : ''}`}>
                        <div className="w-2 h-2 rounded-full bg-blue-600"></div>
                        <span>Assigned</span>
                      </div>
                      <div className="flex-1 h-px bg-gray-300"></div>
                      <div className={`flex items-center gap-1 ${tracking.pickup_start_time ? 'text-blue-600' : ''}`}>
                        <div className={`w-2 h-2 rounded-full ${tracking.pickup_start_time ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                        <span>Started</span>
                      </div>
                      <div className="flex-1 h-px bg-gray-300"></div>
                      <div className={`flex items-center gap-1 ${tracking.pickup_otp_verified_at ? 'text-blue-600' : ''}`}>
                        <div className={`w-2 h-2 rounded-full ${tracking.pickup_otp_verified_at ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                        <span>OTP</span>
                      </div>
                      <div className="flex-1 h-px bg-gray-300"></div>
                      <div className={`flex items-center gap-1 ${tracking.pickup_picked_time ? 'text-blue-600' : ''}`}>
                        <div className={`w-2 h-2 rounded-full ${tracking.pickup_picked_time ? 'bg-blue-600' : 'bg-gray-300'}`}></div>
                        <span>Picked</span>
                      </div>
                      <div className="flex-1 h-px bg-gray-300"></div>
                      <div className={`flex items-center gap-1 ${tracking.pickup_arrival_time ? 'text-green-600' : ''}`}>
                        <div className={`w-2 h-2 rounded-full ${tracking.pickup_arrival_time ? 'bg-green-600' : 'bg-gray-300'}`}></div>
                        <span>Arrived</span>
                      </div>
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-2 mt-4">
                      <button
                        onClick={() => router.push(`/dashboard/workshop_admin/leads/${lead?.id}`)}
                        className="flex-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#004AAD] px-4 py-2 text-sm font-bold text-white hover:bg-[#023D95]"
                      >
                        View Lead Details
                      </button>
                      {tracking.pickup_latitude && tracking.pickup_longitude && (
                        <button
                          onClick={() => window.open(`https://www.google.com/maps/search/?api=1&query=${tracking.pickup_latitude},${tracking.pickup_longitude}`, '_blank')}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
                        >
                          View on Map
                        </button>
                      )}
                      {pickupBoy?.phone && (
                        <button
                          onClick={() => window.open(`tel:${pickupBoy.phone}`, '_blank')}
                          className="inline-flex min-h-11 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700"
                        >
                          Call
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        )}
      </WorkshopPageShell>
    </DashboardLayout>
  );
}

