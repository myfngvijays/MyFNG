'use client';

/**
 * Customer Lead Tracking Page
 * Phase 4 - Task WA-405
 * 
 * Features:
 * - Real-time status updates
 * - Timeline view
 * - Progress tracking
 * - Mechanic details
 * - Photos/updates
 * - Estimated completion
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  User,
  Phone,
  MapPin,
  Calendar,
  Wrench,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';

export default function TrackLeadPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLeadDetails();
    
    // Setup real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('lead_updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads',
          filter: `id=eq.${leadId}`,
        },
        (payload) => {
          console.log('Lead updated:', payload);
          fetchLeadDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [leadId]);

  async function fetchLeadDetails() {
    const supabase = createClient();

    try {
      // Fetch lead
      const { data: leadData } = await supabase
        .from('service_leads')
        .select(`
          *,
          assigned_mechanic:users_login!service_leads_assigned_mechanic_id_fkey(full_name, phone),
          workshop:workshops!workshop_id(name, address, phone)
        `)
        .eq('id', leadId)
        .single();

      setLead(leadData);

      // Fetch events
      const { data: eventsData } = await supabase
        .from('lead_events')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      setEvents(eventsData || []);

      // Fetch media
      const { data: mediaData } = await supabase
        .from('lead_media')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false });

      setMedia(mediaData || []);

    } catch (error) {
      console.error('Error fetching lead:', error);
    } finally {
      setLoading(false);
    }
  }

  function getStatusInfo(status: string) {
    const statusMap: any = {
      'NEW': { label: 'New Request', color: 'blue', icon: Clock },
      'ACCEPTED': { label: 'Accepted', color: 'green', icon: CheckCircle },
      'ASSIGNED': { label: 'Mechanic Assigned', color: 'purple', icon: User },
      'IN_PROGRESS': { label: 'Work in Progress', color: 'yellow', icon: Wrench },
      'READY_FOR_DELIVERY': { label: 'Ready for Delivery', color: 'green', icon: CheckCircle },
      'DELIVERED': { label: 'Delivered', color: 'green', icon: CheckCircle },
      'CLOSED': { label: 'Completed', color: 'gray', icon: CheckCircle },
      'REJECTED': { label: 'Rejected', color: 'red', icon: Clock },
    };

    return statusMap[status] || { label: status, color: 'gray', icon: Clock };
  }

  function getStatusProgress(status: string) {
    const steps = ['NEW', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'];
    const currentIndex = steps.indexOf(status);
    return ((currentIndex + 1) / steps.length) * 100;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-4">Service request not found</p>
          <Link href="/customer/dashboard" className="text-brand-primary hover:underline">
                Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  const statusInfo = getStatusInfo(lead.status);
  const StatusIcon = statusInfo.icon;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-5xl mx-auto px-4">
        {/* Header */}
        <div className="mb-8">
          <Link href="/customer/dashboard" className="text-brand-primary hover:underline flex items-center gap-2 mb-4">
            <ArrowLeft className="w-4 h-4" />
            Back to Dashboard
          </Link>
          <h1 className="text-3xl font-bold text-gray-900">Track Service Request</h1>
          <p className="text-gray-600 mt-1">Lead Number: {lead.lead_number}</p>
        </div>

        {/* Status Card */}
        <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`w-12 h-12 rounded-full bg-${statusInfo.color}-100 flex items-center justify-center`}>
                <StatusIcon className={`w-6 h-6 text-${statusInfo.color}-600`} />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{statusInfo.label}</h2>
                <p className="text-sm text-gray-600">Current Status</p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Created</p>
              <p className="font-medium">{new Date(lead.created_at).toLocaleDateString()}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="relative pt-4">
            <div className="flex mb-2 items-center justify-between">
              <div>
                <span className="text-xs font-semibold inline-block text-brand-primary">
                  Progress
                </span>
              </div>
              <div className="text-right">
                <span className="text-xs font-semibold inline-block text-brand-primary">
                  {Math.round(getStatusProgress(lead.status))}%
                </span>
              </div>
            </div>
            <div className="overflow-hidden h-2 mb-4 text-xs flex rounded bg-gray-200">
              <div
                style={{ width: `${getStatusProgress(lead.status)}%` }}
                className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-brand-primary transition-all duration-500"
              ></div>
            </div>
          </div>
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Vehicle & Service Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Details</h3>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Vehicle:</span>
                  <span className="font-medium">
                    {lead.vehicle_make} {lead.vehicle_model} ({lead.vehicle_number})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Service Type:</span>
                  <span className="font-medium">{lead.service_type}</span>
                </div>
                {lead.problem_description && (
                  <div>
                    <span className="text-gray-600 block mb-1">Problem:</span>
                    <p className="text-sm bg-gray-50 p-3 rounded">{lead.problem_description}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Activity Timeline</h3>
              <div className="space-y-4">
                {events.map((event, index) => (
                  <div key={event.id} className="flex gap-3">
                    <div className="relative">
                      <div className="w-8 h-8 rounded-full bg-brand-primary flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                      {index < events.length - 1 && (
                        <div className="absolute top-8 left-4 w-0.5 h-full bg-gray-200 -ml-px" />
                      )}
                    </div>
                    <div className="flex-1 pb-4">
                      <p className="font-medium text-gray-900">{event.event_description}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {new Date(event.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Media */}
            {media.length > 0 && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <ImageIcon className="w-5 h-5" />
                  Photos & Updates
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  {media.map((item) => (
                    <div key={item.id} className="relative group">
                      <img
                        src={item.media_url}
                        alt="Service photo"
                        className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => window.open(item.media_url, '_blank')}
                      />
                      <span className="absolute bottom-1 left-1 text-xs bg-black bg-opacity-50 text-white px-2 py-0.5 rounded">
                        {item.media_category}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Right Column */}
          <div className="space-y-6">
            {/* Workshop Info */}
            {lead.workshop && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Workshop</h3>
                <div className="space-y-3">
                  <div>
                    <p className="font-medium text-gray-900">{lead.workshop.name}</p>
                    <p className="text-sm text-gray-600 mt-1 flex items-start gap-2">
                      <MapPin className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      {lead.workshop.address}
                    </p>
                  </div>
                  <a
                    href={`tel:${lead.workshop.phone}`}
                    className="flex items-center gap-2 text-brand-primary hover:underline"
                  >
                    <Phone className="w-4 h-4" />
                    {lead.workshop.phone}
                  </a>
                </div>
              </div>
            )}

            {/* Mechanic Info */}
            {lead.assigned_mechanic && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Assigned Mechanic</h3>
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{lead.assigned_mechanic.full_name}</p>
                      <p className="text-sm text-gray-600">Mechanic</p>
                    </div>
                  </div>
                  {lead.assigned_mechanic.phone && (
                    <a
                      href={`tel:${lead.assigned_mechanic.phone}`}
                      className="flex items-center gap-2 text-brand-primary hover:underline text-sm"
                    >
                      <Phone className="w-4 h-4" />
                      Call Mechanic
                    </a>
                  )}
                </div>
              </div>
            )}

            {/* Pickup Info */}
            {lead.pickup_required && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-semibold text-blue-900 mb-2">Pickup Service</h4>
                <p className="text-sm text-blue-800">
                  Our team will pick up your vehicle from your location.
                </p>
                {lead.pickup_address && (
                  <p className="text-xs text-blue-700 mt-2">
                    Pickup Address: {lead.pickup_address}
                  </p>
                )}
              </div>
            )}

            {/* Estimated Completion */}
            {lead.preferred_service_slot && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                  <Calendar className="w-5 h-5" />
                  Scheduled For
                </h3>
                <p className="text-gray-900 font-medium">{lead.preferred_service_slot}</p>
              </div>
            )}

            {/* Invoice */}
            {lead.final_amount && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-green-900 mb-2 flex items-center gap-2">
                  <FileText className="w-5 h-5" />
                  Total Amount
                </h3>
                <p className="text-3xl font-bold text-green-900">₹{lead.final_amount.toFixed(2)}</p>
                <Link
                  href={`/customer/invoices/${lead.id}`}
                  className="inline-block mt-3 text-green-800 hover:underline text-sm font-medium"
                >
                  View Invoice →
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

