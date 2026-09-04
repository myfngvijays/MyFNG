'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY, formatTime12h, formatDateTime } from '@/lib/utils';
import {
  PlayCircle, CheckCircle, Camera, ArrowLeft, User, Car, 
  MapPin, Phone, Clock, Shield, Navigation, AlertCircle, FileText
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import BeforeInspectionUpload from '@/components/mechanic/BeforeInspectionUpload';
import {
  WorkshopPageHeader,
  WorkshopPageShell,
  WorkshopCard,
} from '@/components/workshop/WorkshopUi';
import { isDeliveryJob } from '@/lib/workshop/pickupTaskFlow';

export default function PickupTaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  
  // Modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showObservationModal, setShowObservationModal] = useState(false);
  
  // Form states
  const [otpInput, setOtpInput] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [beforePhotos, setBeforePhotos] = useState<any[]>([]);
  const [observationText, setObservationText] = useState('');
  const [odometerReading, setOdometerReading] = useState<string>('');

  useEffect(() => {
    fetchTaskDetails();
  }, [taskId]);

  async function fetchTaskDetails() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', taskId)
        .single();

      if (leadError || !leadData) {
        toast.error('Task not found');
        router.push('/dashboard/workshop_pickup_boy/tasks');
        return;
      }

      const { data: pickupTracking } = await supabase
        .from('pickup_tracking')
        .select(
          'pickup_time_slot, drop_time_slot, drop_status, drop_otp, drop_otp_verified_at, drop_assigned_to, drop_assigned_at, drop_start_time, drop_out_for_delivery_at, drop_completed_time'
        )
        .eq('lead_id', taskId)
        .maybeSingle();

      const isDelivery = isDeliveryJob({
        ...leadData,
        drop_assigned_to: pickupTracking?.drop_assigned_to,
        drop_status: pickupTracking?.drop_status,
        drop_otp_verified_at: pickupTracking?.drop_otp_verified_at,
        drop_completed_time: pickupTracking?.drop_completed_time,
      });
      const desiredOtpType = isDelivery ? 'DROP' : 'PICKUP';

      // Determine OTP verified status from the correct source:
      // - For PICKUP: service_leads.pickup_otp_verified_at OR pickup_otps(PICKUP).is_verified
      // - For DROP: pickup_tracking.drop_otp_verified_at OR pickup_otps(DROP).is_verified
      let isOtpVerified = false;

      // Always check pickup_otps table for OTP (primary source)
      const { data: pickupOtpData } = await supabase
        .from('pickup_otps')
        .select('otp_code, is_verified, created_at')
        .eq('lead_id', taskId)
        .eq('otp_type', desiredOtpType)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (isDelivery) {
        isOtpVerified = !!pickupTracking?.drop_otp_verified_at || !!pickupOtpData?.is_verified;
      } else {
        isOtpVerified = !!leadData.pickup_otp_verified_at || !!pickupOtpData?.is_verified;
      }
      setOtpVerified(isOtpVerified);

      // Merge OTP data from pickup_otps table (prefer this over service_leads.pickup_otp)
      const finalOtpData = {
        ...leadData,
        // Reuse pickup_otp field for display in UI; for delivery it will contain DROP OTP.
        pickup_otp: pickupOtpData?.otp_code || leadData.pickup_otp,
        pickup_otp_verified_at: pickupOtpData?.is_verified
          ? leadData.pickup_otp_verified_at || new Date().toISOString()
          : leadData.pickup_otp_verified_at,
        otp_type: desiredOtpType,
      };

      if (pickupOtpData?.is_verified) {
        isOtpVerified = true;
        setOtpVerified(true);
      }

      setTask(finalOtpData);
      setObservationText(String((finalOtpData as any)?.pickup_observation || ''));
      // Prefill odometer if already present on lead
      setOdometerReading((prev) => (prev && prev.trim().length > 0 ? prev : String((leadData as any)?.vehicle_odometer ?? '')));

      // Fetch photos
      const { data: photos } = await supabase
        .from('lead_media')
        .select('*')
        .eq('lead_id', taskId)
        .order('created_at', { ascending: false })
        .limit(200);

      // Keep for warnings / legacy; actual upload UI uses BeforeInspectionUpload (mode=LEAD_MEDIA)
      setBeforePhotos(
        (photos || []).filter((p: any) => {
          const pc = String(p?.photo_category || '').toLowerCase();
          const cat = String(p?.category || '').toUpperCase();
          return pc === 'before' || cat.startsWith('BEFORE_') || cat === 'BEFORE_PICKUP';
        })
      );

      // Merge pickup tracking data if available
      if (pickupTracking) {
        setTask((prev: any) => ({
          ...prev,
          pickup_time_slot: pickupTracking.pickup_time_slot,
          drop_time_slot: pickupTracking.drop_time_slot,
          drop_status: pickupTracking.drop_status,
          drop_otp: pickupTracking.drop_otp,
          drop_otp_verified_at: pickupTracking.drop_otp_verified_at,
          drop_assigned_to: pickupTracking.drop_assigned_to,
          drop_assigned_at: pickupTracking.drop_assigned_at,
          drop_start_time: pickupTracking.drop_start_time,
          drop_out_for_delivery_at: pickupTracking.drop_out_for_delivery_at,
          drop_completed_time: pickupTracking.drop_completed_time,
          // Ensure we display DROP OTP even if pickup_otps table isn't readable
          ...(isDelivery && pickupTracking.drop_otp ? { pickup_otp: pickupTracking.drop_otp } : null),
        }));
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load task details');
    } finally {
      setLoading(false);
    }
  }

  async function handleStartPickup() {
    setProcessing(true);

    try {
      const response = await fetch(`/api/pickup/${taskId}/navigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(data.error || data.details || 'Failed to start pickup');
      }

      const otp = data.otp || '123456';
      toast.success(`✅ Pickup started! OTP: ${otp}`);
      setShowStartModal(false);
      setShowOTPModal(true);
      fetchTaskDetails();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(`Failed to start pickup: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }

  async function handleVerifyOTP() {
    if (!otpInput || otpInput.length !== 6) {
      toast.error('Please enter a valid 6-digit OTP');
      return;
    }

    setProcessing(true);

    try {
      const otpType = (task?.status === 'READY_FOR_DELIVERY' || task?.status === 'COD_PENDING') ? 'DROP' : 'PICKUP';
      // Use API endpoint to verify OTP
      const response = await fetch(`/api/pickup/tasks/${taskId}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          otp: otpInput,
          otp_type: otpType
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify OTP');
      }

      toast.success(
        otpType === 'DROP'
          ? '✅ Delivery OTP verified! Status updated to DELIVERED'
          : '✅ OTP verified successfully! Status updated to VEHICLE_IN_TRANSIT'
      );
      setShowOTPModal(false);
      setOtpVerified(true);
      await fetchTaskDetails();

      // For delivery: OTP verification completes delivery; send user back to tasks list.
      if (otpType === 'DROP') {
        router.push('/dashboard/workshop_pickup_boy/tasks');
      }
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(`Failed to verify OTP: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }

  async function handleCompleteDelivery() {
    // Warning if no photos (but allow to proceed)
    const hasPickupVisit = beforePhotos.some((p: any) => {
      const pc = String(p?.photo_category || '').toLowerCase();
      const cat = String(p?.category || '').toUpperCase();
      return pc === 'before' || cat.startsWith('BEFORE_') || cat === 'BEFORE_PICKUP';
    });
    if (!hasPickupVisit) {
      toast('⚠️ Warning: No pickup/visit photos uploaded', { icon: '⚠️' });
    }

    setProcessing(true);

    try {
      const isDelivery = task?.status === 'READY_FOR_DELIVERY' || task?.status === 'COD_PENDING';
      if (!isDelivery) {
        const v = (odometerReading || '').trim();
        const n = v === '' ? NaN : Number(v);
        if (!Number.isFinite(n) || n <= 0) {
          toast.error('Please enter a valid odometer reading');
          setProcessing(false);
          return;
        }
      }

      // Delivery completion uses drop API; pickup completion uses pickup API.
      const response = await fetch(isDelivery ? `/api/pickup/tasks/${taskId}/drop/complete` : `/api/pickup/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          isDelivery
            ? { notes: 'Vehicle delivered to customer' }
            : {
                notes: 'Vehicle delivered to workshop',
                odometer_reading: Number((odometerReading || '').trim()),
                fuel_level: null,
              }
        ),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete pickup');
      }

      toast.success(isDelivery ? '✅ Vehicle delivered to customer successfully!' : '✅ Vehicle delivered to workshop successfully!');
      setShowCompleteModal(false);
      router.push('/dashboard/workshop_pickup_boy/tasks');
    } catch (error: any) {
      console.error('Error completing delivery:', error);
      toast.error(`Failed to complete delivery: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }

  // Upload handled by BeforeInspectionUpload (mode=LEAD_MEDIA)

  const openGoogleMaps = async () => {
    if (!task) return;
    
    try {
      const isDelivery = task.status === 'READY_FOR_DELIVERY' || task.status === 'COD_PENDING';
      const ok = window.confirm(
        isDelivery
          ? 'Navigate:\n\nKya aap DELIVERY karne ja rahe ho?\n\nOK = Delivery start (status change)\nCancel = Sirf location dekhna'
          : 'Navigate:\n\nKya aap PICKUP karne ja rahe ho?\n\nOK = Pickup start (status change)\nCancel = Sirf location dekhna'
      );

      // Open maps in both cases (pickup start OR just viewing location)
      const address = task.address || task.customer_address || task.pickup_address || '';
      const city = task.city || '';
      const pincode = task.pincode || '';
      const fullAddress = `${address}, ${city}, ${pincode}`.trim();
      if (!fullAddress) {
        toast.error('No address available for navigation');
        return;
      }
      const encodedAddress = encodeURIComponent(fullAddress);
      window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');

      // Only update status / generate OTP when user confirms they are actually starting pickup/delivery
      if (!ok) return;

      // For delivery-ready leads, start delivery (DROP) OTP; for pickup leads, start pickup navigation.
      const response = await fetch(isDelivery ? `/api/pickup/tasks/${taskId}/drop/start` : `/api/pickup/${taskId}/navigate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({})
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update status');
      }

      // Refresh task details to get the updated OTP
      fetchTaskDetails();
      
      toast.success(isDelivery ? '✅ Delivery started! DROP OTP generated. You can now verify OTP.' : '✅ Navigation started! OTP generated. You can now verify OTP.');
    } catch (error: any) {
      console.error('Error starting navigation:', error);
      toast.error(`Failed to start navigation: ${error.message}`);
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

  if (!task) {
    return (
      <DashboardLayout role="workshop_pickup_boy">
        <WorkshopCard className="text-center py-8 sm:py-10 md:py-12">
          <AlertCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-red-500 mx-auto mb-2 sm:mb-3 md:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-slate-700">Task not found</h3>
        </WorkshopCard>
      </DashboardLayout>
    );
  }

  const isDeliveryTask = isDeliveryJob(task);

  // Show Start Pickup button only if status is ACCEPTED or ASSIGNED_TO_WORKSHOP and OTP not generated
  // Don't show if status is ON_THE_WAY (OTP will be auto-generated on navigate)
  const canStart = !isDeliveryTask && (
    (task.status === 'ACCEPTED' || task.status === 'ASSIGNED_TO_WORKSHOP') 
    && !task.pickup_otp
  );
  
  // Show Verify OTP button if:
  // 1. Status is ON_THE_WAY, ACCEPTED, ASSIGNED_TO_WORKSHOP, or VEHICLE_IN_TRANSIT
  // 2. OTP exists (either in service_leads.pickup_otp or pickup_otps table - already merged in fetchTaskDetails)
  // 3. OTP is not yet verified
  const hasOTP = !!task.pickup_otp;
  const canVerifyOTP = !isDeliveryTask && (
    task.status === 'ON_THE_WAY' || 
    task.status === 'ACCEPTED' || 
    task.status === 'ASSIGNED_TO_WORKSHOP' ||
    task.status === 'VEHICLE_IN_TRANSIT'
  ) && hasOTP && !otpVerified;
  const canVerifyDeliveryOtp = isDeliveryTask && hasOTP && !otpVerified;
  const isInProgress = task.status === 'IN_PROGRESS' || task.status === 'VEHICLE_IN_TRANSIT';
  const canMarkArrived = !isDeliveryTask && task.status === 'VEHICLE_IN_TRANSIT' && otpVerified;
  // For delivery, require DELIVERY OTP verified (drop_otp_verified_at is the source of truth; we sync otpVerified from it).
  const deliveryDone =
    isDeliveryTask &&
    (!!task.drop_otp_verified_at ||
      String(task.drop_status || '').toUpperCase() === 'DELIVERED' ||
      String(task.status || '').toUpperCase() === 'DELIVERED' ||
      !!task.drop_completed_time);
  const canComplete = isDeliveryTask
    ? otpVerified && !deliveryDone
    : (task.status === 'VEHICLE_DROPPED_AT_WORKSHOP' || task.status === 'VEHICLE_IN_TRANSIT') && otpVerified;
  const canWriteObservation = !isDeliveryTask && otpVerified && (task.status === 'VEHICLE_IN_TRANSIT' || task.status === 'VEHICLE_DROPPED_AT_WORKSHOP');

  async function handleSaveObservation() {
    const text = observationText.trim();
    if (!text) {
      toast.error('Please enter an observation');
      return;
    }
    setProcessing(true);
    try {
      const res = await fetch(`/api/pickup/tasks/${taskId}/observation`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ observation: text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || data?.details || 'Failed to save observation');
      toast.success('✅ Observation saved');
      setShowObservationModal(false);
      fetchTaskDetails();
    } catch (e: any) {
      toast.error(`Failed to save observation: ${e?.message || 'Unknown error'}`);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <DashboardLayout role="workshop_pickup_boy">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Pickupboy / Driver"
          title={isDeliveryTask ? 'Delivery Task' : 'Pickup Task'}
          subtitle={`Lead #${task.lead_number}`}
        />
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
          >
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            Back
          </button>
          <div className="flex flex-wrap gap-2 w-full sm:w-auto">
            {canStart && (
              <button
                onClick={() => setShowStartModal(true)}
                className="btn-primary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-1 sm:flex-initial"
              >
                <PlayCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Start Pickup</span>
                <span className="sm:hidden">Start</span>
              </button>
            )}
            {canVerifyOTP && (
              <button
                onClick={() => setShowOTPModal(true)}
                className="btn-secondary bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-1 sm:flex-initial"
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Verify OTP</span>
                <span className="sm:hidden">Verify</span>
              </button>
            )}
            {canVerifyDeliveryOtp && (
              <button
                onClick={() => setShowOTPModal(true)}
                className="btn-secondary bg-orange-600 hover:bg-orange-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-1 sm:flex-initial"
              >
                <Shield className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Verify Delivery OTP</span>
                <span className="sm:hidden">Verify</span>
              </button>
            )}
            {canMarkArrived && (
              <button
                onClick={async () => {
                  setProcessing(true);
                  try {
                    const response = await fetch(`/api/pickup/tasks/${taskId}/arrived`, {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      }
                    });

                    const data = await response.json();

                    if (!response.ok) {
                      throw new Error(data.error || 'Failed to mark as arrived');
                    }

                    toast.success('✅ Vehicle marked as arrived at workshop!');
                    fetchTaskDetails();
                  } catch (error: any) {
                    console.error('Error marking as arrived:', error);
                    toast.error(`Failed to mark as arrived: ${error.message}`);
                  } finally {
                    setProcessing(false);
                  }
                }}
                disabled={processing}
                className="btn-secondary bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-1 sm:flex-initial"
              >
                <MapPin className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">{processing ? 'Marking...' : 'Arrived at Workshop'}</span>
                <span className="sm:hidden">{processing ? 'Marking...' : 'Arrived'}</span>
              </button>
            )}
            {canWriteObservation && (
              <button
                type="button"
                onClick={() => setShowObservationModal(true)}
                disabled={processing}
                className="btn-secondary bg-slate-700 hover:bg-slate-800 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-1 sm:flex-initial"
              >
                <FileText className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Observation</span>
                <span className="sm:hidden">Obs</span>
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="btn-primary bg-green-600 hover:bg-green-700 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-1 sm:flex-initial"
              >
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">{isDeliveryTask ? 'Complete Delivery to Customer' : 'Complete Delivery'}</span>
                <span className="sm:hidden">Complete</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <div className={`p-3 sm:p-4 rounded-2xl border border-slate-200 border-l-4 ${}
          task.status === 'ON_THE_WAY' ? 'bg-blue-50 border-blue-500' :
          task.status === 'VEHICLE_IN_TRANSIT' ? 'bg-purple-50 border-purple-500' :
          task.status === 'VEHICLE_DROPPED_AT_WORKSHOP' ? 'bg-green-50 border-green-500' :
          task.status === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-500' :
          task.status === 'ACCEPTED' || task.status === 'ASSIGNED_TO_WORKSHOP' ? 'bg-yellow-50 border-yellow-500' :
          'bg-green-50 border-green-500'
        }`}>
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 sm:gap-3">
            <div className="min-w-0 flex-1">
              <p className="text-xs sm:text-sm text-gray-600">Lead Status</p>
              <p className="text-lg sm:text-xl font-bold">{task.status.replace(/_/g, ' ')}</p>
              {deliveryDone && (
                <p className="text-xs sm:text-sm text-green-600 font-semibold mt-0.5 sm:mt-1">
                  ✓ Delivered to customer
                </p>
              )}
              {otpVerified && !deliveryDone && (
                <p className="text-xs sm:text-sm text-green-600 font-semibold mt-0.5 sm:mt-1">
                  ✓ {isDeliveryTask ? 'Delivery OTP Verified' : 'OTP Verified'}
                </p>
              )}
              {task.pickup_otp && !otpVerified && (
                <p className="text-xs sm:text-sm text-orange-600 font-semibold mt-0.5 sm:mt-1">
                  ⚠️ {isDeliveryTask ? 'Delivery OTP Not Verified' : 'OTP Not Verified'}
                </p>
              )}
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <p className="text-xs sm:text-sm text-gray-600">Lead Number</p>
              <p className="text-lg sm:text-xl font-bold">{task.lead_number}</p>
            </div>
          </div>
        </div>

        {/* Task Details Table */}
        <WorkshopCard>
          <h3 className="text-base sm:text-lg font-semibold text-[#023D95] mb-3 sm:mb-4">Task Details</h3>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <tbody className="bg-white divide-y divide-gray-200">
                {/* Customer Name */}
                <tr className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500 w-1/3">
                    <div className="flex items-center gap-2">
                      <User className="w-4 h-4 text-gray-400" />
                      Customer Name
              </div>
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm text-gray-900">
                    {task.customer_name}
                  </td>
                </tr>

                {/* Phone */}
                <tr className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                    <div className="flex items-center gap-2">
                      <Phone className="w-4 h-4 text-gray-400" />
                      Phone
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                    <a href={`tel:${task.customer_phone}`} className="text-brand-primary hover:underline font-medium">
                  {task.customer_phone}
                </a>
              {task.customer_alternate_phone && (
                      <span className="text-gray-500 ml-2">
                        / <a href={`tel:${task.customer_alternate_phone}`} className="text-brand-primary hover:underline">{task.customer_alternate_phone}</a>
                      </span>
              )}
                  </td>
                </tr>

                {/* Vehicle Number */}
                <tr className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                    <div className="flex items-center gap-2">
                      <Car className="w-4 h-4 text-gray-400" />
                      Vehicle Number
              </div>
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm font-semibold text-gray-900">
                    {task.vehicle_number}
                  </td>
                </tr>

                {/* Make/Model */}
                <tr className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                    Make/Model
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm text-gray-900">
                    {task.vehicle_make} {task.vehicle_model}
                  </td>
                </tr>

        {/* Pickup Location */}
                <tr className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                    <div className="flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-gray-400" />
            {isDeliveryTask ? 'Delivery Location' : 'Pickup Location'}
            </div>
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                    <div className="flex flex-col gap-2 min-w-0">
                      <span className="font-medium text-gray-900 break-words">
                        {task.address || task.customer_address || task.pickup_address || 'Address not provided'}
                      </span>
                      {(task.city || task.pincode) && (
                        <span className="text-gray-600">
                          {task.city || ''}{task.pincode ? `, ${task.pincode}` : ''}
                        </span>
                      )}
                      <button
                        onClick={openGoogleMaps}
                        className="btn-secondary bg-green-600 hover:bg-green-700 text-white inline-flex items-center justify-center gap-1.5 text-xs px-3 py-1.5 rounded-full w-fit mt-1 shrink-0"
                      >
                        <Navigation className="w-3 h-3" />
                        Directions
                      </button>
                    </div>
                  </td>
                </tr>

        {/* Schedule */}
                <tr className="hover:bg-gray-50">
                  <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm font-medium text-gray-500">
                    <div className="flex items-center gap-2">
                      <Clock className="w-4 h-4 text-gray-400" />
            Schedule
                    </div>
                  </td>
                  <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
            {(() => {
                      // Priority 1: Check pickup_tracking.pickup_time_slot
              if (task.pickup_time_slot) {
                const date = task.preferred_date 
                  ? new Date(task.preferred_date) 
                  : task.preferred_slot_start 
                    ? new Date(task.preferred_slot_start) 
                    : new Date();
                
                return (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-900">
                              Date: {formatDateDMY(date)}
                            </span>
                            <span className="text-gray-600">
                              Time: {task.pickup_time_slot}
                            </span>
                    </div>
                );
              }
              
                      // Priority 2: Check preferred_time_slot
              if (task.preferred_time_slot) {
                const date = task.preferred_date 
                  ? new Date(task.preferred_date) 
                  : task.preferred_slot_start 
                    ? new Date(task.preferred_slot_start) 
                    : new Date();
                
                return (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-900">
                              Date: {formatDateDMY(date)}
                            </span>
                            <span className="text-gray-600">
                              Time: {task.preferred_time_slot}
                            </span>
                    </div>
                );
              }
              
                      // Priority 3: Check preferred_slot_start
              if (task.preferred_slot_start) {
                const startDate = new Date(task.preferred_slot_start);
                const endDate = task.preferred_slot_end ? new Date(task.preferred_slot_end) : null;
                
                const formatTimeIST = (date: Date) => {
                  return formatTime12h(date);
                };
                
                return (
                          <div className="flex flex-col gap-1">
                            <span className="font-medium text-gray-900">
                              Date: {formatDateDMY(startDate)}
                            </span>
                            <span className="text-gray-600">
                              Time: {formatTimeIST(startDate)}
                        {endDate && ` - ${formatTimeIST(endDate)}`}
                            </span>
                    </div>
                );
              }
              
                      // Priority 4: Check preferred_date only
              if (task.preferred_date) {
                const date = new Date(task.preferred_date);
                return (
                          <span className="font-medium text-gray-900">
                            Date: {formatDateDMY(date)}
                          </span>
                );
              }
              
                      return <span className="text-gray-500">No schedule information available</span>;
            })()}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </WorkshopCard>

        <WorkshopCard>
          <h3 className="text-base sm:text-lg font-semibold text-[#023D95] mb-3 sm:mb-4">Timeline</h3>
          {isDeliveryTask ? (
            <ol className="space-y-3 text-sm">
              {[
                {
                  title: 'Delivery assigned',
                  done: !!(task.drop_assigned_to || task.drop_assigned_at),
                  at: task.drop_assigned_at,
                },
                {
                  title: 'Out for delivery',
                  done: !!(task.drop_start_time || task.drop_status),
                  at: task.drop_start_time || task.drop_out_for_delivery_at,
                },
                {
                  title: 'Delivery OTP verified',
                  done: !!task.drop_otp_verified_at,
                  at: task.drop_otp_verified_at,
                },
                {
                  title: 'Delivered to customer',
                  done: deliveryDone,
                  at: task.drop_completed_time || task.drop_otp_verified_at || task.delivered_at,
                },
              ].map((step) => (
                <li key={step.title} className={`flex gap-3 ${step.done ? 'text-slate-900' : 'text-slate-400'}`}>
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${step.done ? 'bg-[#023D95]' : 'bg-slate-300'}`}
                  />
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    {step.at ? <p className="text-xs text-slate-500">{formatDateTime(step.at)}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          ) : (
            <ol className="space-y-3 text-sm">
              {[
                { title: 'Assigned', done: !!task.assigned_pickup_boy_id, at: task.pickup_assigned_at },
                { title: 'Pickup started', done: !!task.pickup_start_time, at: task.pickup_start_time },
                { title: 'Pickup OTP verified', done: !!task.pickup_otp_verified_at, at: task.pickup_otp_verified_at },
                { title: 'Vehicle picked', done: !!task.pickup_picked_time, at: task.pickup_picked_time },
                { title: 'Arrived at workshop', done: !!task.pickup_arrival_time, at: task.pickup_arrival_time },
              ].map((step) => (
                <li key={step.title} className={`flex gap-3 ${step.done ? 'text-slate-900' : 'text-slate-400'}`}>
                  <span
                    className={`mt-1.5 h-2.5 w-2.5 rounded-full shrink-0 ${step.done ? 'bg-[#023D95]' : 'bg-slate-300'}`}
                  />
                  <div>
                    <p className="font-semibold">{step.title}</p>
                    {step.at ? <p className="text-xs text-slate-500">{formatDateTime(step.at)}</p> : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </WorkshopCard>

        {/* Observations Section */}
        <WorkshopCard>
          <h3 className="text-base sm:text-lg font-semibold text-[#023D95] mb-3 sm:mb-4">Observations</h3>
          
          {/* Pickup Boy Observation */}
          <div className="mb-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-blue-700" />
                Your Observation
              </p>
              {canWriteObservation && (
                <button
                  type="button"
                  onClick={() => {
                    setObservationText(String((task as any)?.pickup_observation || ''));
                    setShowObservationModal(true);
                  }}
                  className="btn btn-outline text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {String((task as any)?.pickup_observation || '').trim() ? 'Edit' : 'Add'}
                </button>
              )}
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap break-words">
                {String((task as any)?.pickup_observation || '').trim() ? (task as any).pickup_observation : 'No observation added yet.'}
              </p>
              {(task as any)?.pickup_observation_updated_at && (
                <p className="text-[11px] text-gray-500 mt-1">
                  Last updated: {formatDateTime((task as any).pickup_observation_updated_at)}
                </p>
              )}
            </div>
          </div>

          {/* Supervisor Observation (Read-only for pickup boy) */}
          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-start justify-between gap-3 mb-2">
              <p className="text-xs sm:text-sm font-semibold text-gray-800 flex items-center gap-2">
                <FileText className="w-4 h-4 text-orange-700" />
                Supervisor/Advisor Observation
              </p>
            </div>
            <div className="min-w-0">
              <p className="text-xs sm:text-sm text-gray-700 whitespace-pre-wrap break-words">
                {String((task as any)?.supervisor_observation || '').trim() ? (task as any).supervisor_observation : 'No observation from supervisor yet.'}
              </p>
              {(task as any)?.supervisor_observation_updated_at && (
                <p className="text-[11px] text-gray-500 mt-1">
                  Last updated: {formatDateTime((task as any).supervisor_observation_updated_at)}
                </p>
              )}
            </div>
          </div>
        </WorkshopCard>

        {/* Pickup/Visit Photos (syncs with supervisor) */}
        <WorkshopCard>
          <div className="flex items-start justify-between gap-3 mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold text-[#023D95] flex items-center gap-1.5 sm:gap-2">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
              Pickup/Visit Photos
            </h3>
            <div className="text-[10px] sm:text-xs text-gray-500 text-right">
              Upload here → Supervisor automatically sees it
            </div>
          </div>

          <BeforeInspectionUpload
            leadId={taskId}
            jobId=""
            mode="LEAD_MEDIA"
            onUploadComplete={() => {
              fetchTaskDetails();
            }}
          />
        </WorkshopCard>

        {/* Start Pickup Modal */}
        {showStartModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-blue-600">Start Pickup</h3>
              <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">
                You are about to start the pickup for <strong>{task.customer_name}</strong>.
              </p>
              <p className="text-xs sm:text-sm text-gray-600 mb-3 sm:mb-4">
                Make sure you have reached the pickup location before starting.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={handleStartPickup}
                  disabled={processing}
                  className="btn-primary flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {processing ? 'Starting...' : 'Start Pickup'}
                </button>
                <button
                  onClick={() => setShowStartModal(false)}
                  disabled={processing}
                  className="btn-secondary flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OTP Verification Modal */}
        {showOTPModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-orange-600">Verify OTP</h3>
              <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">
                Ask the customer for the 6-digit OTP to verify vehicle handover.
              </p>
              
              {task?.pickup_otp && (
                <div className="mb-3 sm:mb-4 p-2.5 sm:p-3 bg-green-50 border border-green-200 rounded-lg">
                  {task.pickup_otp === '123456' ? (
                    <>
                      <p className="text-xs sm:text-sm text-green-800 text-center font-semibold mb-1.5 sm:mb-2">
                        ✅ Testing Mode - OTP Bypass Active
                      </p>
                      <p className="text-[10px] sm:text-xs text-green-700 text-center">
                        Enter <strong className="text-base sm:text-lg">123456</strong> to verify
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1 text-center">
                        (Production: Customer receives OTP via SMS)
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-xs sm:text-sm text-green-800 text-center font-semibold mb-1.5 sm:mb-2">
                        OTP generated
                      </p>
                      <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1 text-center">
                        Ask customer for OTP (do not share OTP in production UI)
                      </p>
                    </>
                  )}
                </div>
              )}

              <div className="mb-3 sm:mb-4">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Enter OTP <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input w-full text-center text-xl sm:text-2xl font-bold tracking-widest px-2 sm:px-3 py-1.5 sm:py-2"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={handleVerifyOTP}
                  disabled={processing || otpInput.length !== 6}
                  className="btn-secondary bg-orange-600 hover:bg-orange-700 text-white flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {processing ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button
                  onClick={() => {
                    setShowOTPModal(false);
                    setOtpInput('');
                  }}
                  disabled={processing}
                  className="btn-secondary flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete Delivery Modal */}
        {showCompleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-green-600">
                {isDeliveryTask ? 'Deliver Vehicle to Customer' : 'Deliver Vehicle to Workshop'}
              </h3>
              <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">
                {isDeliveryTask
                  ? 'Confirm that you have successfully delivered the vehicle to the customer.'
                  : 'Confirm that you have successfully delivered the vehicle to the workshop.'}
              </p>

              {!beforePhotos.some((p: any) => {
                const pc = String(p?.photo_category || '').toLowerCase();
                const cat = String(p?.category || '').toUpperCase();
                return pc === 'before' || cat.startsWith('BEFORE_') || cat === 'BEFORE_PICKUP';
              }) && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2.5 sm:p-3 mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-yellow-700">⚠️ Recommendation: Upload pickup/visit photos for documentation</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded p-2.5 sm:p-3 mb-3 sm:mb-4">
                <p className="text-xs sm:text-sm text-blue-700">
                  ✓ Vehicle will be marked as {isDeliveryTask ? 'delivered to customer' : 'delivered to workshop'}
                </p>
                <p className="text-xs sm:text-sm text-blue-700">✓ Team will be notified</p>
              </div>

              {!isDeliveryTask && (
                <div className="mb-3 sm:mb-4">
                  <label className="block text-xs sm:text-sm font-semibold text-gray-700 mb-1.5">
                    Odometer Reading (km) <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    step="1"
                    value={odometerReading}
                    onChange={(e) => setOdometerReading(e.target.value)}
                    className="input w-full"
                    placeholder="e.g. 12345"
                  />
                  <p className="mt-1 text-[10px] sm:text-xs text-gray-500">
                    This will be visible to advisor/supervisor in the lead.
                  </p>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
                <button
                  onClick={handleCompleteDelivery}
                  disabled={processing}
                  className="btn-primary bg-green-600 hover:bg-green-700 flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {processing ? 'Processing...' : 'Confirm Delivery'}
                </button>
                <button
                  onClick={() => setShowCompleteModal(false)}
                  disabled={processing}
                  className="btn-secondary flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Observation Modal */}
        {showObservationModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-slate-700">
                {observationText.trim() ? 'Edit Your Observation' : 'Add Your Observation'}
              </h3>
              <p className="text-xs sm:text-sm text-gray-600 mb-3">
                Add notes/observations (e.g. scratches, dents, missing items, fuel level, etc.). This is separate from supervisor observation.
              </p>
              <textarea
                value={observationText}
                onChange={(e) => setObservationText(e.target.value)}
                className="input w-full min-h-[120px] text-sm"
                placeholder="Write observation..."
              />
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4">
                <button
                  type="button"
                  onClick={handleSaveObservation}
                  disabled={processing || !observationText.trim()}
                  className="btn-primary bg-slate-700 hover:bg-slate-800 flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {processing ? 'Saving...' : 'Save'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowObservationModal(false)}
                  disabled={processing}
                  className="btn-secondary flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Photo upload handled inline above */}
      </WorkshopPageShell>
    </DashboardLayout>
  );
}

