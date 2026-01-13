'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  Truck, Phone, MapPin, CheckCircle, Clock, AlertTriangle,
  User, Car, Package, FileText, MessageCircle, Navigation
} from 'lucide-react';

interface PickupDeliveryJob {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  customer_address: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  pickup_status: string;
  delivery_status: string | null;
  job_status: string;
  pickup_boy: any;
  assigned_mechanic: any;
  pickup_scheduled_time: string | null;
  delivery_scheduled_time: string | null;
  special_instructions: string | null;
  is_invoice_ready: boolean;
  is_car_washed: boolean;
  paperwork_complete: boolean;
  delivery_invoice_ready: boolean | null;
  delivery_car_washed: boolean | null;
  delivery_paperwork_complete: boolean | null;
}

export default function PickupDeliveryCoordinationPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<PickupDeliveryJob[]>([]);
  const [allJobs, setAllJobs] = useState<PickupDeliveryJob[]>([]);
  const [pickupBoys, setPickupBoys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready_for_pickup' | 'ready_for_delivery'>('all');
  const [instructionsEdit, setInstructionsEdit] = useState<Record<string, string>>({});
  const [savingInstructions, setSavingInstructions] = useState<Record<string, boolean>>({});
  const [checklistState, setChecklistState] = useState<Record<string, {
    delivery_invoice_ready: boolean;
    delivery_car_washed: boolean;
    delivery_paperwork_complete: boolean;
  }>>({});
  const [savingChecklist, setSavingChecklist] = useState<Record<string, boolean>>({});
  const [workshopId, setWorkshopId] = useState<string | null>(null);
  const refreshTimer = useRef<number | null>(null);

  const isReadyForPickup = (j: any) => ['PENDING', 'ASSIGNED'].includes(String(j?.pickup_status || '').toUpperCase());
  const isPickupDone = (j: any) =>
    [
      'COMPLETED',
      'VEHICLE_DROPPED_AT_WORKSHOP',
      'VEHICLE_DROPPED',
      'DROPPED_AT_WORKSHOP',
    ].includes(String(j?.pickup_status || '').toUpperCase());
  const isReadyForDelivery = (j: any) =>
    ['READY_FOR_DELIVERY', 'QC_APPROVED', 'PAYMENT_AWAITING', 'INVOICE_GENERATED'].includes(String(j?.job_status || j?.status || '').toUpperCase()) &&
    isPickupDone(j);

  const applyFilter = (list: PickupDeliveryJob[]) => {
    if (filterStatus === 'ready_for_pickup') return list.filter(isReadyForPickup);
    if (filterStatus === 'ready_for_delivery') return list.filter(isReadyForDelivery);
    return list;
  };

  useEffect(() => {
    // Resolve user's workshop once
    const supabase = createClient();
    let cancelled = false;
    (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;
        const { data: userProfiles } = await supabase
          .from('users_login')
          .select('workshop_id')
          .eq('email', user.email)
          .limit(1);
        const userProfile = (userProfiles || [])[0] as any;
        if (!cancelled) setWorkshopId(userProfile?.workshop_id || null);
      } catch (e) {
        console.error('Failed to resolve workshop:', e);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!workshopId) return;
    fetchData({ silent: false });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]);

  useEffect(() => {
    // Switching tabs should NOT refetch; it should filter already-loaded jobs (keeps counts stable)
    setJobs(applyFilter(allJobs));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filterStatus, allJobs]);

  useEffect(() => {
    if (!workshopId) return;
    const supabase = createClient();

    const scheduleRefresh = () => {
      // Debounce bursts of updates
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = window.setTimeout(() => {
        fetchData({ silent: true });
      }, 500);
    };

    // Create a unique channel per workshop to avoid collisions across pages
    const channel = supabase
      .channel(`pickup-delivery-updates-${workshopId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'service_leads', filter: `workshop_id=eq.${workshopId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'invoices', filter: `workshop_id=eq.${workshopId}` },
        scheduleRefresh
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'lead_media' },
        // lead_media doesn't have workshop_id on all installs; still safe to refresh.
        scheduleRefresh
      )
      .subscribe();

    return () => {
      if (refreshTimer.current) window.clearTimeout(refreshTimer.current);
      refreshTimer.current = null;
      supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workshopId]);

  async function fetchData(opts?: { silent?: boolean }) {
    try {
      if (!opts?.silent) setLoading(true);
      const supabase = createClient();

      const wid = workshopId;
      if (!wid) return;

      // Always fetch ALL pickup-required jobs for the workshop.
      // Filtering is handled client-side so the tab counts don't drop to 0 when switching filters.
      const query = supabase
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          customer_phone,
          address,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          pickup_status,
          status,
          payment_status,
          read_only,
          pickup_required,
          customer_special_notes,
          delivery_invoice_ready,
          delivery_car_washed,
          delivery_paperwork_complete,
          pickup_boy:assigned_pickup_boy_id(id, full_name, phone, profile_image),
          mechanic:assigned_mechanic_id(id, full_name)
        `)
        .eq('workshop_id', wid)
        .eq('pickup_required', true);

      const { data: jobsData } = await query.order('created_at', { ascending: false });

      // Enhance with additional status checks
      const enhancedJobs = await Promise.all(
        (jobsData || []).map(async (job) => {
          // Check if invoice is ready
          // NOTE: use array mode (+limit) so the HTTP response is 200 even when no rows exist
          // (avoids noisy 406 logs in the browser network console).
          const { data: invoiceRows, error: invoiceError } = await supabase
            .from('invoices')
            .select('id, status, payment_status')
            .eq('lead_id', job.id)
            .limit(1);
          if (invoiceError) {
            // Best-effort: don't break the whole dashboard for invoice read issues (RLS/schema).
            // eslint-disable-next-line no-console
            console.warn('Invoice lookup failed (non-blocking):', invoiceError);
          }
          const invoiceData = (invoiceRows || [])[0] as any;

          // Check if paperwork is complete
          const { data: documentsData } = await supabase
            .from('lead_media')
            .select('id')
            .eq('lead_id', job.id)
            .eq('media_type', 'DOCUMENT');

          // Use DB checklist values if available, otherwise compute from invoice state.
          // Some installs store paid state in `payment_status` while `status` remains legacy.
          const invStatus = String(invoiceData?.status || '').toUpperCase();
          const invPayStatus = String((invoiceData as any)?.payment_status || '').toUpperCase();
          const deliveryInvoiceReady =
            job.delivery_invoice_ready !== null
              ? job.delivery_invoice_ready
              : (invPayStatus === 'PAID' || invStatus === 'PAID' || invStatus === 'GENERATED');

          const leadPaymentStatus = String((job as any)?.payment_status || '').toUpperCase();
          const leadStatus = String((job as any)?.status || '').toUpperCase();
          const isPaid = invPayStatus === 'PAID' || invStatus === 'PAID' || leadPaymentStatus === 'PAID';

          // Best-effort auto-bump: if invoice is PAID but lead status is stuck (e.g. READY_FOR_BILLING),
          // update lead status so pickup boy delivery flow becomes available.
          if (
            isPaid &&
            !['READY_FOR_DELIVERY', 'COD_PENDING', 'DELIVERED_TO_CUSTOMER'].includes(leadStatus) &&
            !(job as any)?.read_only
          ) {
            try {
              await supabase
                .from('service_leads')
                .update({ status: 'READY_FOR_DELIVERY', updated_at: new Date().toISOString() } as any)
                .eq('id', job.id);
            } catch (e) {
              // non-blocking
              console.warn('Non-blocking: failed to auto-bump lead status to READY_FOR_DELIVERY:', e);
            }
          }
          const deliveryCarWashed = job.delivery_car_washed !== null ? job.delivery_car_washed : (job.status === 'READY_FOR_DELIVERY');
          const deliveryPaperworkComplete = job.delivery_paperwork_complete !== null ? job.delivery_paperwork_complete : ((documentsData?.length || 0) > 0);

          return {
            ...job,
            job_status: isPaid ? 'READY_FOR_DELIVERY' : job.status,
            assigned_mechanic: job.mechanic,
            customer_address: job.address,
            delivery_status: null,
            pickup_scheduled_time: null,
            delivery_scheduled_time: null,
            special_instructions: job.customer_special_notes,
            is_invoice_ready: deliveryInvoiceReady,
            is_car_washed: deliveryCarWashed,
            paperwork_complete: deliveryPaperworkComplete,
            delivery_invoice_ready: job.delivery_invoice_ready,
            delivery_car_washed: job.delivery_car_washed,
            delivery_paperwork_complete: job.delivery_paperwork_complete,
          };
        })
      );

      // Keep both: all jobs for counts + filtered jobs for list rendering
      setAllJobs(enhancedJobs);
      setJobs(applyFilter(enhancedJobs));

      // Initialize checklist state from loaded jobs
      const initialChecklistState: Record<string, {
        delivery_invoice_ready: boolean;
        delivery_car_washed: boolean;
        delivery_paperwork_complete: boolean;
      }> = {};
      enhancedJobs.forEach(job => {
        initialChecklistState[job.id] = {
          delivery_invoice_ready: job.is_invoice_ready,
          delivery_car_washed: job.is_car_washed,
          delivery_paperwork_complete: job.paperwork_complete,
        };
      });
      setChecklistState(prev => ({ ...prev, ...initialChecklistState }));

      // Fetch pickup boys
      const { data: pickupBoysData } = await supabase
        .from('users_login')
        .select(`
          id,
          full_name,
          phone,
          profile_image,
          roles!inner(role_code)
        `)
        .eq('workshop_id', wid)
        .eq('roles.role_code', 'WORKSHOP_PICKUP_BOY')
        .eq('is_active', true);

      // Get active tasks for each pickup boy
      const pickupBoysWithTasks = await Promise.all(
        (pickupBoysData || []).map(async (boy) => {
          const { count: activePickups } = await supabase
            .from('service_leads')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_pickup_boy_id', boy.id)
            .in('pickup_status', ['ASSIGNED', 'EN_ROUTE', 'AT_LOCATION']);

          // Many DBs don't have `service_leads.delivery_status` (delivery tracking lives in `pickup_tracking.drop_status`).
          // For this dashboard's "active tasks" counter, use lead status as a durable signal for delivery work.
          const { count: activeDeliveries, error: activeDeliveriesError } = await supabase
            .from('service_leads')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_pickup_boy_id', boy.id)
            .in('status', ['READY_FOR_DELIVERY', 'COD_PENDING']);
          if (activeDeliveriesError) {
            // eslint-disable-next-line no-console
            console.warn('Active deliveries count failed (non-blocking):', activeDeliveriesError);
          }

          return {
            ...boy,
            activeTasks: (activePickups || 0) + (activeDeliveries || 0)
          };
        })
      );

      setPickupBoys(pickupBoysWithTasks);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      if (!opts?.silent) setLoading(false);
    }
  }

  async function assignPickupBoy(jobId: string, pickupBoyId: string) {
    // Find pickup boy name for confirmation
    const pickupBoy = pickupBoys.find((boy) => boy.id === pickupBoyId);
    const pickupBoyName = pickupBoy?.full_name || 'selected pickup boy';
    
    // Show confirmation dialog with pickup boy name
    const confirmed = confirm(`Assign this lead to pickup boy: ${pickupBoyName}?`);
    if (!confirmed) {
      // Reset dropdown to empty if user cancels
      const selectElement = document.querySelector(`select[data-job-id="${jobId}"]`) as HTMLSelectElement;
      if (selectElement) {
        selectElement.value = '';
      }
      return;
    }

    try {
      // IMPORTANT: use the server API so notification + push fan-out happens
      const res = await fetch(`/api/workshop/leads/${jobId}/assign-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          pickup_boy_id: pickupBoyId,
        }),
      });

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}));
        throw new Error(payload?.error || `Failed to assign pickup boy (HTTP ${res.status})`);
      }

      alert('Pickup boy assigned successfully');
      fetchData({ silent: true });
    } catch (error) {
      console.error('Error assigning pickup boy:', error);
      alert('Failed to assign pickup boy');
      // Reset dropdown on error
      const selectElement = document.querySelector(`select[data-job-id="${jobId}"]`) as HTMLSelectElement;
      if (selectElement) {
        selectElement.value = '';
      }
    }
  }

  async function markReadyForDelivery(jobId: string) {
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('service_leads')
        .update({
          status: 'READY_FOR_DELIVERY',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) throw error;

      alert('Job marked as ready for delivery');
      fetchData();
    } catch (error) {
      console.error('Error marking ready:', error);
      alert('Failed to mark as ready');
    }
  }

  async function updateDeliveryChecklist(jobId: string, field: 'delivery_invoice_ready' | 'delivery_car_washed' | 'delivery_paperwork_complete', value: boolean) {
    try {
      setSavingChecklist(prev => ({ ...prev, [jobId]: true }));

      const response = await fetch(`/api/workshop/leads/${jobId}/delivery-checklist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ [field]: value }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update checklist');
      }

      // Update local state
      setChecklistState(prev => ({
        ...prev,
        [jobId]: {
          ...prev[jobId],
          [field]: value,
        },
      }));

      // Refresh data to get updated values
      fetchData({ silent: true });
    } catch (error: any) {
      console.error('Error updating checklist:', error);
      alert(`Failed to update checklist: ${error.message}`);
    } finally {
      setSavingChecklist(prev => ({ ...prev, [jobId]: false }));
    }
  }

  async function updateSpecialInstructions(jobId: string) {
    try {
      setSavingInstructions(prev => ({ ...prev, [jobId]: true }));
      const supabase = createClient();

      const { error } = await supabase
        .from('service_leads')
        .update({
          customer_special_notes: instructionsEdit[jobId] || '',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) throw error;
      
      alert('Instructions saved successfully!');
      fetchData();
      
      // Clear the edit state
      setInstructionsEdit(prev => {
        const newState = { ...prev };
        delete newState[jobId];
        return newState;
      });
    } catch (error) {
      console.error('Error updating instructions:', error);
      alert('Failed to save instructions');
    } finally {
      setSavingInstructions(prev => ({ ...prev, [jobId]: false }));
    }
  }

  const getPickupStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'PENDING': 'bg-gray-100 text-gray-700',
      'ASSIGNED': 'bg-blue-100 text-blue-700',
      'EN_ROUTE': 'bg-yellow-100 text-yellow-700',
      'AT_LOCATION': 'bg-orange-100 text-orange-700',
      'COMPLETED': 'bg-green-100 text-green-700',
      'VEHICLE_IN_TRANSIT': 'bg-yellow-100 text-yellow-700',
      'VEHICLE_DROPPED_AT_WORKSHOP': 'bg-green-100 text-green-700',
      'DROPPED_AT_WORKSHOP': 'bg-green-100 text-green-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const readyForPickup = allJobs.filter(isReadyForPickup);
  const readyForDelivery = allJobs.filter(isReadyForDelivery);

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading flex items-center gap-2 sm:gap-3">
              <Truck className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 flex-shrink-0" />
              <span>Pickup & Delivery Coordination</span>
            </h1>
            <p className="text-text-body text-xs sm:text-sm mt-1 sm:mt-2">
              Manage vehicle collection and delivery schedules
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Ready for Pickup</p>
                <p className="text-2xl sm:text-3xl font-bold text-blue-600">{readyForPickup.length}</p>
              </div>
              <MapPin className="w-7 h-7 sm:w-8 sm:h-8 text-blue-600 flex-shrink-0" />
            </div>
          </div>

          <div className="card bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Ready for Delivery</p>
                <p className="text-2xl sm:text-3xl font-bold text-green-600">{readyForDelivery.length}</p>
              </div>
              <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-600 flex-shrink-0" />
            </div>
          </div>

          <div className="card bg-purple-50 border-purple-200 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Active Pickup Boys</p>
                <p className="text-2xl sm:text-3xl font-bold text-purple-600">{pickupBoys.length}</p>
              </div>
              <User className="w-7 h-7 sm:w-8 sm:h-8 text-purple-600 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Pickup Boys Overview */}
        <div className="card">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
            <User className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
            <span>Available Pickup Boys ({pickupBoys.length})</span>
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {pickupBoys.map((boy) => (
              <div 
                key={boy.id}
                className={`p-2.5 sm:p-3 rounded-lg border-2 ${
                  boy.activeTasks === 0 ? 'bg-green-50 border-green-300' :
                  boy.activeTasks <= 2 ? 'bg-yellow-50 border-yellow-300' :
                  'bg-red-50 border-red-300'
                }`}
              >
                <div className="flex items-center gap-2 sm:gap-3">
                  {boy.profile_image ? (
                    <img 
                      src={boy.profile_image} 
                      alt={boy.full_name}
                      className="w-9 h-9 sm:w-10 sm:h-10 rounded-full flex-shrink-0"
                    />
                  ) : (
                    <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-brand-primary flex items-center justify-center flex-shrink-0">
                      <User className="w-4 h-4 sm:w-5 sm:h-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-xs sm:text-sm truncate">{boy.full_name}</p>
                    <div className="flex items-center gap-1.5 sm:gap-2 text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">
                      <Phone className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                      <span className="truncate">{boy.phone}</span>
                    </div>
                    <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1">
                      {boy.activeTasks} active task{boy.activeTasks !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters */}
        <div className="card">
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={() => setFilterStatus('all')}
              className={`btn text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 ${filterStatus === 'all' ? 'btn-primary' : 'btn-outline'}`}
            >
              All Jobs ({allJobs.length})
            </button>
            <button
              onClick={() => setFilterStatus('ready_for_pickup')}
              className={`btn text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 ${filterStatus === 'ready_for_pickup' ? 'btn-primary' : 'btn-outline'}`}
            >
              Ready for Pickup ({readyForPickup.length})
            </button>
            <button
              onClick={() => setFilterStatus('ready_for_delivery')}
              className={`btn text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 ${filterStatus === 'ready_for_delivery' ? 'btn-primary' : 'btn-outline'}`}
            >
              Ready for Delivery ({readyForDelivery.length})
            </button>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-3 sm:space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="card">
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 sm:gap-5 md:gap-6">
                {/* Column 1: Customer & Vehicle */}
                <div className="space-y-1.5 sm:space-y-2">
                  <p className="text-[10px] sm:text-xs text-gray-600">#{job.lead_number}</p>
                  <p className="font-bold text-base sm:text-lg truncate">{job.customer_name}</p>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{job.customer_phone}</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    <span className="truncate">{job.vehicle_number}</span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-700 truncate">{job.vehicle_make} {job.vehicle_model}</p>
                </div>

                {/* Column 2: Status */}
                <div className="space-y-2 sm:space-y-3">
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-600 mb-1 sm:mb-2">Pickup Status</p>
                    <span className={`inline-block px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold ${getPickupStatusColor(job.pickup_status)}`}>
                    {job.pickup_status.replace(/_/g, ' ')}
                  </span>
                  </div>
                  <div>
                    <p className="text-[10px] sm:text-xs text-gray-600 mb-1 sm:mb-2">Job Status</p>
                    <span className="text-xs sm:text-sm font-semibold text-gray-800">{job.job_status.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                {/* Column 3: Assignment */}
                <div className="space-y-2 sm:space-y-3">
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-600 mb-1 sm:mb-2">Pickup Boy</p>
                  {job.pickup_boy ? (
                    <div className="flex items-center gap-1.5 sm:gap-2">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-brand-primary flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-semibold truncate">{job.pickup_boy.full_name}</span>
                    </div>
                  ) : (
                    <select
                      data-job-id={job.id}
                      onChange={(e) => e.target.value && assignPickupBoy(job.id, e.target.value)}
                        className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                      defaultValue=""
                    >
                      <option value="">Assign...</option>
                      {pickupBoys.map((boy) => (
                        <option key={boy.id} value={boy.id}>
                          {boy.full_name} ({boy.activeTasks} tasks)
                        </option>
                      ))}
                    </select>
                  )}
                  </div>
                  
                  {job.assigned_mechanic && (
                    <div>
                      <p className="text-[10px] sm:text-xs text-gray-600 mb-0.5 sm:mb-1">Mechanic</p>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-green-600 flex-shrink-0" />
                        <span className="text-xs sm:text-sm font-medium truncate">{job.assigned_mechanic.full_name}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 4: Checklist */}
                <div>
                  <p className="text-[10px] sm:text-xs text-gray-600 mb-2 sm:mb-3 font-semibold">Delivery Checklist</p>
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checklistState[job.id]?.delivery_invoice_ready ?? job.is_invoice_ready}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          // Update local state immediately for better UX
                          setChecklistState(prev => ({
                            ...prev,
                            [job.id]: {
                              ...(prev[job.id] || {
                                delivery_invoice_ready: job.is_invoice_ready,
                                delivery_car_washed: job.is_car_washed,
                                delivery_paperwork_complete: job.paperwork_complete,
                              }),
                              delivery_invoice_ready: newValue,
                            },
                          }));
                          updateDeliveryChecklist(job.id, 'delivery_invoice_ready', newValue);
                        }}
                        disabled={savingChecklist[job.id]}
                        className="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className="text-xs sm:text-sm">Invoice Ready</span>
                      {savingChecklist[job.id] && (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-brand-primary"></div>
                      )}
                    </label>
                    <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checklistState[job.id]?.delivery_car_washed ?? job.is_car_washed}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setChecklistState(prev => ({
                            ...prev,
                            [job.id]: {
                              ...(prev[job.id] || {
                                delivery_invoice_ready: job.is_invoice_ready,
                                delivery_car_washed: job.is_car_washed,
                                delivery_paperwork_complete: job.paperwork_complete,
                              }),
                              delivery_car_washed: newValue,
                            },
                          }));
                          updateDeliveryChecklist(job.id, 'delivery_car_washed', newValue);
                        }}
                        disabled={savingChecklist[job.id]}
                        className="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className="text-xs sm:text-sm">Car Washed</span>
                      {savingChecklist[job.id] && (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-brand-primary"></div>
                      )}
                    </label>
                    <label className="flex items-center gap-1.5 sm:gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={checklistState[job.id]?.delivery_paperwork_complete ?? job.paperwork_complete}
                        onChange={(e) => {
                          const newValue = e.target.checked;
                          setChecklistState(prev => ({
                            ...prev,
                            [job.id]: {
                              ...(prev[job.id] || {
                                delivery_invoice_ready: job.is_invoice_ready,
                                delivery_car_washed: job.is_car_washed,
                                delivery_paperwork_complete: job.paperwork_complete,
                              }),
                              delivery_paperwork_complete: newValue,
                            },
                          }));
                          updateDeliveryChecklist(job.id, 'delivery_paperwork_complete', newValue);
                        }}
                        disabled={savingChecklist[job.id]}
                        className="w-4 h-4 text-brand-primary border-gray-300 rounded focus:ring-brand-primary cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className="text-xs sm:text-sm">Paperwork Complete</span>
                      {savingChecklist[job.id] && (
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-brand-primary"></div>
                      )}
                    </label>
                  </div>
                </div>

                {/* Column 5: Actions */}
                <div className="space-y-2">
                <div>
                  <textarea
                      placeholder="Special instructions for pickup/delivery..."
                      value={instructionsEdit[job.id] !== undefined ? instructionsEdit[job.id] : (job.special_instructions || '')}
                      onChange={(e) => setInstructionsEdit(prev => ({ ...prev, [job.id]: e.target.value }))}
                      className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border border-gray-300 rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                      rows={3}
                    />
                    {instructionsEdit[job.id] !== undefined && instructionsEdit[job.id] !== job.special_instructions && (
                      <button
                        onClick={() => updateSpecialInstructions(job.id)}
                        disabled={savingInstructions[job.id]}
                        className="btn bg-green-600 hover:bg-green-700 text-white w-full text-xs sm:text-sm py-1.5 sm:py-2 mt-2 flex items-center justify-center gap-1.5 sm:gap-2"
                      >
                        {savingInstructions[job.id] ? (
                          <>
                            <div className="animate-spin rounded-full h-3.5 w-3.5 sm:h-4 sm:w-4 border-b-2 border-white"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Send Instructions
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  
                  {job.job_status === 'QC_APPROVED' && (
                    <button
                      onClick={() => markReadyForDelivery(job.id)}
                      className="btn btn-primary w-full text-xs sm:text-sm py-1.5 sm:py-2"
                    >
                      Mark Ready for Delivery
                    </button>
                  )}

                  {/* When already READY_FOR_DELIVERY, don't show "Mark..." again; show a clear state instead. */}
                  {job.job_status === 'READY_FOR_DELIVERY' && (
                    <div className="w-full rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-xs sm:text-sm text-green-800">
                      <div className="font-semibold">Delivery Ready</div>
                      <div className="text-[11px] sm:text-xs text-green-700 mt-0.5">
                        Pickup boy ke dashboard me “Delivery Ready” tab me aa jayega.
                      </div>
                    </div>
                  )}
                  
                  <button
                    onClick={() => router.push(`/dashboard/workshop_supervisor/jobs/${job.id}`)}
                    className="btn btn-outline w-full text-xs sm:text-sm py-1.5 sm:py-2"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {jobs.length === 0 && (
          <div className="card text-center py-8 sm:py-10 md:py-12">
            <Truck className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <p className="text-lg sm:text-xl font-semibold text-gray-700">No Pickup/Delivery Jobs</p>
            <p className="text-gray-600 text-sm sm:text-base mt-1 sm:mt-2">All vehicles are either in workshop or delivered</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

