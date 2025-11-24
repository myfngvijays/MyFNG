'use client';

import { useEffect, useState } from 'react';
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
  delivery_status: string;
  job_status: string;
  pickup_boy: any;
  assigned_mechanic: any;
  pickup_scheduled_time: string | null;
  delivery_scheduled_time: string | null;
  special_instructions: string | null;
  is_invoice_ready: boolean;
  is_car_washed: boolean;
  paperwork_complete: boolean;
}

export default function PickupDeliveryCoordinationPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<PickupDeliveryJob[]>([]);
  const [pickupBoys, setPickupBoys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready_for_pickup' | 'ready_for_delivery'>('all');

  useEffect(() => {
    fetchData();

    // Real-time subscription
    const supabase = createClient();
    const channel = supabase
      .channel('pickup-delivery-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads'
        },
        () => {
          fetchData();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [filterStatus]);

  async function fetchData() {
    try {
      setLoading(true);
      const supabase = createClient();

      // Get user's workshop
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) return;

      // Build query based on filter
      let query = supabase
        .from('service_leads')
        .select(`
          id,
          lead_number,
          customer_name,
          customer_phone,
          customer_address,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          pickup_status,
          delivery_status,
          status,
          pickup_scheduled_time,
          delivery_scheduled_time,
          special_instructions,
          pickup_required,
          pickup_boy:assigned_pickup_boy_id(id, full_name, phone_number, profile_image),
          mechanic:assigned_mechanic_id(id, full_name)
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .eq('pickup_required', true);

      if (filterStatus === 'ready_for_pickup') {
        query = query.in('pickup_status', ['PENDING', 'ASSIGNED']);
      } else if (filterStatus === 'ready_for_delivery') {
        query = query.in('status', ['READY_FOR_DELIVERY', 'QC_APPROVED'])
          .eq('pickup_status', 'COMPLETED');
      }

      const { data: jobsData } = await query.order('created_at', { ascending: false });

      // Enhance with additional status checks
      const enhancedJobs = await Promise.all(
        (jobsData || []).map(async (job) => {
          // Check if invoice is ready
          const { data: invoiceData } = await supabase
            .from('invoices')
            .select('id, status')
            .eq('lead_id', job.id)
            .single();

          // Check if paperwork is complete
          const { data: documentsData } = await supabase
            .from('lead_media')
            .select('id')
            .eq('lead_id', job.id)
            .eq('media_type', 'DOCUMENT');

          return {
            ...job,
            job_status: job.status,
            assigned_mechanic: job.mechanic,
            is_invoice_ready: invoiceData?.status === 'PAID' || invoiceData?.status === 'GENERATED',
            paperwork_complete: (documentsData?.length || 0) > 0,
            is_car_washed: job.status === 'READY_FOR_DELIVERY' // Assume washed if ready
          };
        })
      );

      setJobs(enhancedJobs);

      // Fetch pickup boys
      const { data: pickupBoysData } = await supabase
        .from('users_login')
        .select(`
          id,
          full_name,
          phone_number,
          profile_image,
          roles!inner(role_code)
        `)
        .eq('workshop_id', userProfile.workshop_id)
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

          const { count: activeDeliveries } = await supabase
            .from('service_leads')
            .select('*', { count: 'exact', head: true })
            .eq('assigned_pickup_boy_id', boy.id)
            .in('delivery_status', ['ASSIGNED', 'EN_ROUTE', 'AT_LOCATION']);

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
      setLoading(false);
    }
  }

  async function assignPickupBoy(jobId: string, pickupBoyId: string) {
    try {
      const supabase = createClient();
      
      const { error } = await supabase
        .from('service_leads')
        .update({
          assigned_pickup_boy_id: pickupBoyId,
          pickup_status: 'ASSIGNED',
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) throw error;

      // Create supervisor action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userProfile } = await supabase
          .from('users_login')
          .select('id')
          .eq('email', user.email)
          .single();

        await supabase
          .from('supervisor_actions')
          .insert({
            supervisor_id: userProfile?.id,
            lead_id: jobId,
            action_type: 'PICKUP_BOY_ASSIGNED',
            action_description: 'Assigned pickup boy for vehicle collection'
          });
      }

      alert('Pickup boy assigned successfully');
      fetchData();
    } catch (error) {
      console.error('Error assigning pickup boy:', error);
      alert('Failed to assign pickup boy');
    }
  }

  async function markReadyForDelivery(jobId: string) {
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('service_leads')
        .update({
          status: 'READY_FOR_DELIVERY',
          delivery_status: 'PENDING',
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

  async function updateSpecialInstructions(jobId: string, instructions: string) {
    try {
      const supabase = createClient();

      const { error } = await supabase
        .from('service_leads')
        .update({
          special_instructions: instructions,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) throw error;
      fetchData();
    } catch (error) {
      console.error('Error updating instructions:', error);
    }
  }

  const getPickupStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'PENDING': 'bg-gray-100 text-gray-700',
      'ASSIGNED': 'bg-blue-100 text-blue-700',
      'EN_ROUTE': 'bg-yellow-100 text-yellow-700',
      'AT_LOCATION': 'bg-orange-100 text-orange-700',
      'COMPLETED': 'bg-green-100 text-green-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  const readyForPickup = jobs.filter(j => j.pickup_status === 'PENDING' || j.pickup_status === 'ASSIGNED');
  const readyForDelivery = jobs.filter(j => j.job_status === 'READY_FOR_DELIVERY' && j.pickup_status === 'COMPLETED');

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-heading flex items-center gap-3">
              <Truck className="w-8 h-8" />
              Pickup & Delivery Coordination
            </h1>
            <p className="text-text-body mt-2">
              Manage vehicle collection and delivery schedules
            </p>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="card bg-blue-50 border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ready for Pickup</p>
                <p className="text-3xl font-bold text-blue-600">{readyForPickup.length}</p>
              </div>
              <MapPin className="w-8 h-8 text-blue-600" />
            </div>
          </div>

          <div className="card bg-green-50 border-green-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Ready for Delivery</p>
                <p className="text-3xl font-bold text-green-600">{readyForDelivery.length}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-600" />
            </div>
          </div>

          <div className="card bg-purple-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Pickup Boys</p>
                <p className="text-3xl font-bold text-purple-600">{pickupBoys.length}</p>
              </div>
              <User className="w-8 h-8 text-purple-600" />
            </div>
          </div>
        </div>

        {/* Pickup Boys Overview */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <User className="w-5 h-5" />
            Available Pickup Boys ({pickupBoys.length})
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {pickupBoys.map((boy) => (
              <div 
                key={boy.id}
                className={`p-3 rounded-lg border-2 ${
                  boy.activeTasks === 0 ? 'bg-green-50 border-green-300' :
                  boy.activeTasks <= 2 ? 'bg-yellow-50 border-yellow-300' :
                  'bg-red-50 border-red-300'
                }`}
              >
                <div className="flex items-center gap-3">
                  {boy.profile_image ? (
                    <img 
                      src={boy.profile_image} 
                      alt={boy.full_name}
                      className="w-10 h-10 rounded-full"
                    />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center">
                      <User className="w-5 h-5 text-white" />
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="font-semibold text-sm">{boy.full_name}</p>
                    <div className="flex items-center gap-2 text-xs text-gray-600 mt-1">
                      <Phone className="w-3 h-3" />
                      <span>{boy.phone_number}</span>
                    </div>
                    <p className="text-xs text-gray-600 mt-1">
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
          <div className="flex gap-3">
            <button
              onClick={() => setFilterStatus('all')}
              className={`btn ${filterStatus === 'all' ? 'btn-primary' : 'btn-outline'}`}
            >
              All Jobs ({jobs.length})
            </button>
            <button
              onClick={() => setFilterStatus('ready_for_pickup')}
              className={`btn ${filterStatus === 'ready_for_pickup' ? 'btn-primary' : 'btn-outline'}`}
            >
              Ready for Pickup ({readyForPickup.length})
            </button>
            <button
              onClick={() => setFilterStatus('ready_for_delivery')}
              className={`btn ${filterStatus === 'ready_for_delivery' ? 'btn-primary' : 'btn-outline'}`}
            >
              Ready for Delivery ({readyForDelivery.length})
            </button>
          </div>
        </div>

        {/* Jobs List */}
        <div className="space-y-4">
          {jobs.map((job) => (
            <div key={job.id} className="card">
              <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                {/* Column 1: Customer & Vehicle */}
                <div>
                  <p className="text-xs text-gray-600 mb-1">#{job.lead_number}</p>
                  <p className="font-bold">{job.customer_name}</p>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <Phone className="w-3 h-3" />
                    <span>{job.customer_phone}</span>
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-600 mt-1">
                    <Car className="w-3 h-3" />
                    <span>{job.vehicle_number}</span>
                  </div>
                </div>

                {/* Column 2: Status */}
                <div>
                  <p className="text-xs text-gray-600 mb-2">Pickup Status</p>
                  <span className={`inline-block px-2 py-1 rounded-full text-xs font-semibold ${getPickupStatusColor(job.pickup_status)}`}>
                    {job.pickup_status.replace(/_/g, ' ')}
                  </span>
                  <p className="text-xs text-gray-600 mt-3 mb-1">Job Status</p>
                  <span className="text-xs font-semibold">{job.job_status}</span>
                </div>

                {/* Column 3: Pickup Boy */}
                <div>
                  <p className="text-xs text-gray-600 mb-2">Pickup Boy</p>
                  {job.pickup_boy ? (
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      <span className="text-sm font-semibold">{job.pickup_boy.full_name}</span>
                    </div>
                  ) : (
                    <select
                      onChange={(e) => e.target.value && assignPickupBoy(job.id, e.target.value)}
                      className="input input-sm w-full"
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
                  
                  {job.assigned_mechanic && (
                    <div className="mt-2">
                      <p className="text-xs text-gray-600">Mechanic</p>
                      <p className="text-sm">{job.assigned_mechanic.full_name}</p>
                    </div>
                  )}
                </div>

                {/* Column 4: Checklist */}
                <div>
                  <p className="text-xs text-gray-600 mb-2">Delivery Checklist</p>
                  <div className="space-y-1 text-xs">
                    <div className="flex items-center gap-2">
                      {job.is_invoice_ready ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                      )}
                      <span>Invoice Ready</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.is_car_washed ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                      )}
                      <span>Car Washed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.paperwork_complete ? (
                        <CheckCircle className="w-4 h-4 text-green-600" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-orange-600" />
                      )}
                      <span>Paperwork Complete</span>
                    </div>
                  </div>
                </div>

                {/* Column 5: Actions */}
                <div>
                  <textarea
                    placeholder="Special instructions..."
                    value={job.special_instructions || ''}
                    onChange={(e) => updateSpecialInstructions(job.id, e.target.value)}
                    className="input input-sm w-full mb-2"
                    rows={2}
                  />
                  
                  {job.job_status === 'QC_APPROVED' && (
                    <button
                      onClick={() => markReadyForDelivery(job.id)}
                      className="btn btn-primary btn-sm w-full"
                    >
                      Mark Ready for Delivery
                    </button>
                  )}
                  
                  <button
                    onClick={() => router.push(`/dashboard/workshop_supervisor/jobs/${job.id}`)}
                    className="btn btn-outline btn-sm w-full mt-2"
                  >
                    View Details
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {jobs.length === 0 && (
          <div className="card text-center py-12">
            <Truck className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-xl font-semibold text-gray-700">No Pickup/Delivery Jobs</p>
            <p className="text-gray-600 mt-2">All vehicles are either in workshop or delivered</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

