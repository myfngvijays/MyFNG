'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { MapPin, User, Car, Navigation, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { formatDateDMY, formatTime12h } from "@/lib/utils";
import {
  WorkshopPageHeader,
  WorkshopPageShell,
  WorkshopFilterPill,
  WorkshopEmpty,
  WorkshopCard,
  WorkshopStatusPill,
} from '@/components/workshop/WorkshopUi';
import {
  isActivePickupBoyTask,
  isActiveDeliveryBoyTask,
  isPickupInTransit,
  isPickupScheduled,
  isPickupLegComplete,
} from '@/lib/workshop/pickupTaskFlow';

interface PickupTask {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  address: string;
  city: string;
  pincode: string;
  status: string;
  preferred_date?: string | null;
  preferred_time_slot?: string | null;
  preferred_slot_start?: string | null;
  preferred_slot_end?: string | null;
  pickup_otp: string;
  pickup_otp_verified_at: string;
}

export default function PickupTasksPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [tasks, setTasks] = useState<PickupTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'scheduled' | 'in_transit' | 'delivery_ready' | 'completed'>('all');
  const [filterCounts, setFilterCounts] = useState({
    all: 0,
    scheduled: 0,
    in_transit: 0,
    delivery_ready: 0,
    completed: 0
  });

  useEffect(() => {
    const q = searchParams.get('filter');
    if (q === 'scheduled' || q === 'in_transit' || q === 'delivery_ready' || q === 'completed' || q === 'all') {
      setFilter(q);
    }
  }, [searchParams]);

  useEffect(() => {
    fetchTasks();

    // Setup real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('pickup-boy-tasks')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads'
        },
        (payload) => {
          console.log('Pickup tasks updated:', payload);
          fetchTasks();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [filter]);

  async function fetchTasks() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) {
        toast.error('User profile not found');
        return;
      }

      // Fetch all assigned leads once; filter open tasks client-side
      const { data: allRows, error } = await supabase
        .from('service_leads')
        .select('*')
        .eq('assigned_pickup_boy_id', userProfile.id)
        .not('status', 'in', '(REJECTED,CANCELLED)')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching tasks:', error);
        toast.error('Failed to fetch tasks');
        return;
      }

      const openTasks = (allRows || []).filter(
        (t) => isActivePickupBoyTask(t) || isActiveDeliveryBoyTask(t),
      );

      let visible = openTasks;
      if (filter === 'scheduled') {
        visible = openTasks.filter((t) => isPickupScheduled(t));
      } else if (filter === 'in_transit') {
        visible = openTasks.filter((t) => isPickupInTransit(t));
      } else if (filter === 'delivery_ready') {
        visible = openTasks.filter((t) => isActiveDeliveryBoyTask(t));
      } else if (filter === 'completed') {
        visible = (allRows || []).filter(
          (t) =>
            isPickupLegComplete(t) ||
            ['DELIVERED', 'DELIVERED_TO_CUSTOMER', 'CLOSED', 'COMPLETED'].includes(String(t.status || '').toUpperCase()),
        );
      }

      setTasks(visible);

      if (allRows) {
        setFilterCounts({
          all: openTasks.length,
          scheduled: openTasks.filter((t) => isPickupScheduled(t)).length,
          in_transit: openTasks.filter((t) => isPickupInTransit(t)).length,
          delivery_ready: openTasks.filter((t) => isActiveDeliveryBoyTask(t)).length,
          completed: allRows.filter(
            (t) =>
              isPickupLegComplete(t) ||
              ['DELIVERED', 'DELIVERED_TO_CUSTOMER', 'CLOSED', 'COMPLETED'].includes(String(t.status || '').toUpperCase()),
          ).length,
        });
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load tasks');
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string, hasOtp: boolean, otpVerified: boolean) => {
    if (status === 'ACCEPTED' || status === 'ASSIGNED_TO_WORKSHOP') {
      if (!hasOtp) return { tone: 'yellow' as const, text: 'Ready to Start' };
      if (!otpVerified) return { tone: 'yellow' as const, text: 'OTP Pending' };
      return { tone: 'blue' as const, text: 'In Transit' };
    }
    if (status === 'ON_THE_WAY') return { tone: 'blue' as const, text: 'On The Way' };
    if (status === 'VEHICLE_IN_TRANSIT') return { tone: 'purple' as const, text: 'In Transit' };
    if (status === 'VEHICLE_DROPPED_AT_WORKSHOP') return { tone: 'green' as const, text: 'At Workshop' };
    if (status === 'IN_PROGRESS') return { tone: 'blue' as const, text: 'In Progress' };
    if (status === 'READY_FOR_DELIVERY') return { tone: 'green' as const, text: 'Delivery Ready' };
    if (status === 'COD_PENDING') return { tone: 'yellow' as const, text: 'COD Delivery' };
    if (status === 'COMPLETED' || status === 'DELIVERED' || status === 'CLOSED') return { tone: 'green' as const, text: 'Completed' };
    return { tone: 'slate' as const, text: status.replace(/_/g, ' ') };
  };

  const renderSchedule = (task: PickupTask) => {
    if (task.preferred_date) {
      const date = new Date(task.preferred_date);
      return (
        <div className="text-xs sm:text-sm">
          <div className="font-semibold text-slate-900">{formatDateDMY(date)}</div>
          {task.preferred_time_slot && <div className="text-slate-600">{task.preferred_time_slot}</div>}
        </div>
      );
    }
    if (task.preferred_slot_start) {
      const startDate = new Date(task.preferred_slot_start);
      const endDate = task.preferred_slot_end ? new Date(task.preferred_slot_end) : null;
      return (
        <div className="text-xs sm:text-sm">
          <div className="font-semibold text-slate-900">{formatDateDMY(startDate)}</div>
          <div className="text-slate-600">
            {formatTime12h(startDate)}
            {endDate && ` - ${formatTime12h(endDate)}`}
          </div>
        </div>
      );
    }
    return <span className="text-xs text-slate-400">Not specified</span>;
  };

  const openGoogleMaps = async (task: PickupTask) => {
    const isDeliveryReady = task.status === 'READY_FOR_DELIVERY' || task.status === 'COD_PENDING';
    const ok = window.confirm(
      isDeliveryReady
        ? 'Navigate:\n\nKya aap DELIVERY karne ja rahe ho?\n\nOK = Delivery start (status change)\nCancel = Sirf location dekhna'
        : 'Navigate:\n\nKya aap PICKUP karne ja rahe ho?\n\nOK = Pickup start (status change)\nCancel = Sirf location dekhna'
    );

    // Build address string from available fields
    const addressParts = [];
    if (task.address) addressParts.push(task.address);
    if (task.city) addressParts.push(task.city);
    if (task.pincode) addressParts.push(task.pincode);
    const fullAddress = addressParts.join(', ');
    
    if (!fullAddress) {
      toast.error('No address available for navigation');
      return;
    }
    
    const encodedAddress = encodeURIComponent(fullAddress);
    
    // Open Google Maps
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
    
    // Only update status if user confirmed they are actually starting pickup/delivery
    if (!ok) return;

    // Update status / tracking via API
    try {
      const response = await fetch(isDeliveryReady ? `/api/pickup/tasks/${task.id}/drop/start` : `/api/pickup/${task.id}/navigate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: null, // Can be added if available
          longitude: null
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        toast.success(data.message || (isDeliveryReady ? 'Delivery started' : 'Status updated to ON_THE_WAY'));
        fetchTasks(); // Refresh tasks
      } else {
        const data = await response.json();
        console.error('Failed to update status:', data);
        toast.error(data.error || 'Failed to update status');
      }
    } catch (error: any) {
      console.error('Error updating status:', error);
      toast.error('Failed to update status: ' + (error.message || 'Unknown error'));
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_pickup_boy">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_pickup_boy">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Pickupboy / Driver"
          title="My Pickup Tasks"
          subtitle="Vehicle pickup and delivery assignments"
        />

        <WorkshopCard>
          <div className="flex flex-wrap gap-2">
            <WorkshopFilterPill active={filter === 'all'} onClick={() => setFilter('all')}>
              All Active ({filterCounts.all})
            </WorkshopFilterPill>
            <WorkshopFilterPill active={filter === 'scheduled'} onClick={() => setFilter('scheduled')}>
              Scheduled ({filterCounts.scheduled})
            </WorkshopFilterPill>
            <WorkshopFilterPill active={filter === 'in_transit'} onClick={() => setFilter('in_transit')}>
              In Transit ({filterCounts.in_transit})
            </WorkshopFilterPill>
            <WorkshopFilterPill active={filter === 'delivery_ready'} onClick={() => setFilter('delivery_ready')}>
              Delivery Ready ({filterCounts.delivery_ready})
            </WorkshopFilterPill>
            <WorkshopFilterPill active={filter === 'completed'} onClick={() => setFilter('completed')}>
              Completed ({filterCounts.completed})
            </WorkshopFilterPill>
          </div>
        </WorkshopCard>

        {tasks.length === 0 ? (
          <WorkshopCard>
            <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-center text-base font-semibold text-slate-700 mb-1">No Tasks</h3>
            <WorkshopEmpty>
              {filter === 'all'
                ? 'You have no active pickup tasks.'
                : `No tasks with status: ${filter}`}
            </WorkshopEmpty>
          </WorkshopCard>
        ) : (
          <WorkshopCard>
            <div className="space-y-2 lg:hidden">
              {tasks.map((task) => {
                const statusBadge = getStatusBadge(task.status, !!task.pickup_otp, !!task.pickup_otp_verified_at);
                return (
                  <div key={task.id} className="rounded-2xl border border-slate-200 bg-slate-50 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#023D95]">{task.customer_name || 'Customer'}</p>
                        <p className="text-xs text-slate-500 truncate">{task.vehicle_number}</p>
                      </div>
                      <WorkshopStatusPill tone={statusBadge.tone}>{statusBadge.text}</WorkshopStatusPill>
                    </div>
                    <p className="mt-1 truncate text-xs text-slate-500">
                      {task.address || 'Address not provided'}
                      {task.city ? ` · ${task.city}${task.pincode ? `, ${task.pincode}` : ''}` : ''}
                    </p>
                    <div className="mt-1">{renderSchedule(task)}</div>
                    <div className="mt-3 grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => openGoogleMaps(task)}
                        disabled={!task.address && !task.city}
                        className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl bg-emerald-600 text-xs font-bold text-white disabled:opacity-50"
                      >
                        <Navigation className="w-3.5 h-3.5" />
                        Navigate
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push(`/dashboard/workshop_pickup_boy/tasks/${task.id}`)}
                        className="inline-flex min-h-10 items-center justify-center rounded-xl bg-[#004AAD] text-xs font-bold text-white"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="hidden overflow-x-auto lg:block">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50">
                  <tr>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Vehicle</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Address</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Preferred Date & Time</th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-200">
                  {tasks.map((task) => {
                    const statusBadge = getStatusBadge(task.status, !!task.pickup_otp, !!task.pickup_otp_verified_at);
                    return (
                      <tr key={task.id} className="hover:bg-slate-50">
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-sm font-medium text-[#023D95]">{task.customer_name || 'Customer'}</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex items-center gap-2">
                            <User className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-slate-900 truncate max-w-[150px]">
                                {task.customer_name}
                              </div>
                              <a href={`tel:${task.customer_phone}`} className="text-xs text-[#004AAD] hover:underline">
                                {task.customer_phone}
                              </a>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex items-center gap-2">
                            <Car className="w-4 h-4 text-slate-500 flex-shrink-0" />
                            <div>
                              <div className="text-sm font-medium text-slate-900 truncate max-w-[150px]">
                                {task.vehicle_number}
                              </div>
                              <div className="text-xs text-slate-500 truncate max-w-[150px]">
                                {task.vehicle_make} {task.vehicle_model}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex items-start gap-2">
                            <MapPin className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                            <div className="min-w-0">
                              <div className="text-sm text-slate-900 truncate max-w-[200px]">
                                {task.address || 'Address not provided'}
                              </div>
                              {task.city && (
                                <div className="text-xs text-slate-500 truncate max-w-[200px]">
                                  {task.city}{task.pincode ? `, ${task.pincode}` : ''}
                                </div>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <WorkshopStatusPill tone={statusBadge.tone}>{statusBadge.text}</WorkshopStatusPill>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">{renderSchedule(task)}</td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-sm font-medium">
                          <div className="flex flex-col gap-2">
                            <button
                              onClick={() => openGoogleMaps(task)}
                              disabled={!task.address && !task.city}
                              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                              <Navigation className="w-3.5 h-3.5" />
                              Navigate
                            </button>
                            <button
                              onClick={() => router.push(`/dashboard/workshop_pickup_boy/tasks/${task.id}`)}
                              className="inline-flex items-center justify-center rounded-xl bg-[#004AAD] px-3 py-1.5 text-xs font-bold text-white"
                            >
                              View Details
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </WorkshopCard>
        )}
      </WorkshopPageShell>
    </DashboardLayout>
  );
}
