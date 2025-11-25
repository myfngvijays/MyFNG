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
}

export default function PickupDeliveryCoordinationPage() {
  const router = useRouter();
  const [jobs, setJobs] = useState<PickupDeliveryJob[]>([]);
  const [pickupBoys, setPickupBoys] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<'all' | 'ready_for_pickup' | 'ready_for_delivery'>('all');
  const [instructionsEdit, setInstructionsEdit] = useState<Record<string, string>>({});
  const [savingInstructions, setSavingInstructions] = useState<Record<string, boolean>>({});

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
          address,
          vehicle_number,
          vehicle_make,
          vehicle_model,
          pickup_status,
          status,
          pickup_required,
          customer_special_notes,
          pickup_boy:assigned_pickup_boy_id(id, full_name, phone, profile_image),
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
            customer_address: job.address,
            delivery_status: null,
            pickup_scheduled_time: null,
            delivery_scheduled_time: null,
            special_instructions: job.customer_special_notes,
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
          phone,
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
                      <span>{boy.phone}</span>
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
              <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
                {/* Column 1: Customer & Vehicle */}
                <div className="space-y-2">
                  <p className="text-xs text-gray-600">#{job.lead_number}</p>
                  <p className="font-bold text-lg">{job.customer_name}</p>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Phone className="w-4 h-4 flex-shrink-0" />
                    <span>{job.customer_phone}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Car className="w-4 h-4 flex-shrink-0" />
                    <span>{job.vehicle_number}</span>
                  </div>
                  <p className="text-sm text-gray-700">{job.vehicle_make} {job.vehicle_model}</p>
                </div>

                {/* Column 2: Status */}
                <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 mb-2">Pickup Status</p>
                    <span className={`inline-block px-3 py-1 rounded-full text-xs font-semibold ${getPickupStatusColor(job.pickup_status)}`}>
                    {job.pickup_status.replace(/_/g, ' ')}
                  </span>
                  </div>
                  <div>
                    <p className="text-xs text-gray-600 mb-2">Job Status</p>
                    <span className="text-sm font-semibold text-gray-800">{job.job_status.replace(/_/g, ' ')}</span>
                  </div>
                </div>

                {/* Column 3: Assignment */}
                <div className="space-y-3">
                <div>
                  <p className="text-xs text-gray-600 mb-2">Pickup Boy</p>
                  {job.pickup_boy ? (
                    <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-brand-primary flex-shrink-0" />
                      <span className="text-sm font-semibold">{job.pickup_boy.full_name}</span>
                    </div>
                  ) : (
                    <select
                      onChange={(e) => e.target.value && assignPickupBoy(job.id, e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent"
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
                      <p className="text-xs text-gray-600 mb-1">Mechanic</p>
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-green-600 flex-shrink-0" />
                        <span className="text-sm font-medium">{job.assigned_mechanic.full_name}</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Column 4: Checklist */}
                <div>
                  <p className="text-xs text-gray-600 mb-3 font-semibold">Delivery Checklist</p>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      {job.is_invoice_ready ? (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                      )}
                      <span className="text-sm">Invoice Ready</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.is_car_washed ? (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                      )}
                      <span className="text-sm">Car Washed</span>
                    </div>
                    <div className="flex items-center gap-2">
                      {job.paperwork_complete ? (
                        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                      )}
                      <span className="text-sm">Paperwork Complete</span>
                    </div>
                  </div>
                </div>

                {/* Column 5: Actions */}
                <div className="space-y-2">
                <div>
                  <textarea
                      placeholder="Special instructions for pickup/delivery..."
                      value={instructionsEdit[job.id] !== undefined ? instructionsEdit[job.id] : (job.special_instructions || '')}
                      onChange={(e) => setInstructionsEdit(prev => ({ ...prev, [job.id]: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                      rows={3}
                    />
                    {instructionsEdit[job.id] !== undefined && instructionsEdit[job.id] !== job.special_instructions && (
                      <button
                        onClick={() => updateSpecialInstructions(job.id)}
                        disabled={savingInstructions[job.id]}
                        className="btn bg-green-600 hover:bg-green-700 text-white w-full text-sm py-2 mt-2 flex items-center justify-center gap-2"
                      >
                        {savingInstructions[job.id] ? (
                          <>
                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                            Saving...
                          </>
                        ) : (
                          <>
                            <MessageCircle className="w-4 h-4" />
                            Send Instructions
                          </>
                        )}
                      </button>
                    )}
                  </div>
                  
                  {job.job_status === 'QC_APPROVED' && (
                    <button
                      onClick={() => markReadyForDelivery(job.id)}
                      className="btn btn-primary w-full text-sm py-2"
                    >
                      Mark Ready for Delivery
                    </button>
                  )}
                  
                  <button
                    onClick={() => router.push(`/dashboard/workshop_supervisor/jobs/${job.id}`)}
                    className="btn btn-outline w-full text-sm py-2"
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

