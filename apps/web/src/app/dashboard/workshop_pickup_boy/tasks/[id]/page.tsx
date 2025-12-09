'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  PlayCircle, CheckCircle, Camera, Upload, ArrowLeft, User, Car, 
  MapPin, Phone, Clock, Shield, Navigation, AlertCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function PickupTaskDetailPage() {
  const router = useRouter();
  const params = useParams();
  const taskId = params.id as string;

  const [task, setTask] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Modals
  const [showStartModal, setShowStartModal] = useState(false);
  const [showOTPModal, setShowOTPModal] = useState(false);
  const [showCompleteModal, setShowCompleteModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  
  // Form states
  const [otpInput, setOtpInput] = useState('');
  const [otpVerified, setOtpVerified] = useState(false);
  const [beforePhotos, setBeforePhotos] = useState<any[]>([]);
  const [photoCategory, setPhotoCategory] = useState<'BEFORE_PICKUP' | 'AFTER_DELIVERY'>('BEFORE_PICKUP');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

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

      // Check if OTP is already verified
      let isOtpVerified = false;
      if (leadData.pickup_otp_verified_at) {
        isOtpVerified = true;
        setOtpVerified(true);
      }

      // Always check pickup_otps table for OTP (this is the primary source)
      const { data: pickupOtpData } = await supabase
        .from('pickup_otps')
        .select('otp_code, is_verified, created_at')
        .eq('lead_id', taskId)
        .eq('otp_type', 'PICKUP')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      // Merge OTP data from pickup_otps table (prefer this over service_leads.pickup_otp)
      const finalOtpData = {
        ...leadData,
        pickup_otp: pickupOtpData?.otp_code || leadData.pickup_otp,
        pickup_otp_verified_at: pickupOtpData?.is_verified ? (leadData.pickup_otp_verified_at || new Date().toISOString()) : leadData.pickup_otp_verified_at
      };

      if (pickupOtpData?.is_verified) {
        isOtpVerified = true;
        setOtpVerified(true);
      }

      setTask(finalOtpData);

      // Fetch photos
      const { data: photos } = await supabase
        .from('lead_media')
        .select('*')
        .eq('lead_id', taskId)
        .in('category', ['BEFORE_PICKUP', 'AFTER_DELIVERY']);

      setBeforePhotos(photos || []);

      // Fetch pickup tracking for time slot
      const { data: pickupTracking } = await supabase
        .from('pickup_tracking')
        .select('pickup_time_slot, drop_time_slot')
        .eq('lead_id', taskId)
        .single();

      // Merge pickup tracking data if available
      if (pickupTracking) {
        setTask((prev: any) => ({
          ...prev,
          pickup_time_slot: pickupTracking.pickup_time_slot,
          drop_time_slot: pickupTracking.drop_time_slot,
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
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Fixed OTP for testing (bypass mode)
      const otp = '123456';

      // Update lead status - don't change status if already ON_THE_WAY
      const updateData: any = {
          pickup_otp: otp,
          updated_at: new Date().toISOString()
      };

      // Only update status if not already ON_THE_WAY
      if (task.status !== 'ON_THE_WAY') {
        updateData.status = 'ACCEPTED';
      }

      const { error: updateError } = await supabase
        .from('service_leads')
        .update(updateData)
        .eq('id', taskId);

      if (updateError) throw updateError;

      // Create lead event (don't fail request if this fails)
      try {
        await supabase.from('lead_events').insert({
          lead_id: taskId,
          event_type: 'PICKUP_STARTED',
          event_description: `Pickup boy started pickup process. OTP sent to customer.`,
          created_by: user.id,
        });
      } catch (eventError) {
        // Log but don't fail the request
        console.error('Error creating lead event (non-critical):', eventError);
      }

      toast.success(`✅ Pickup started! OTP: ${otp} (testing mode)`);
      console.log('🔐 Testing OTP:', otp);
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
      // Use API endpoint to verify OTP (this will update status to VEHICLE_IN_TRANSIT)
      const response = await fetch(`/api/pickup/tasks/${taskId}/verify-otp`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          otp: otpInput
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to verify OTP');
      }

      toast.success('✅ OTP verified successfully! Status updated to VEHICLE_IN_TRANSIT');
      setShowOTPModal(false);
      setOtpVerified(true);
      fetchTaskDetails();
    } catch (error: any) {
      console.error('Error:', error);
      toast.error(`Failed to verify OTP: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }

  async function handleCompleteDelivery() {
    // Warning if no photos (but allow to proceed)
    if (beforePhotos.filter(p => p.category === 'BEFORE_PICKUP').length === 0) {
      toast('⚠️ Warning: No before pickup photos uploaded', { icon: '⚠️' });
    }

    setProcessing(true);

    try {
      // If status is not VEHICLE_DROPPED_AT_WORKSHOP, mark as arrived first
      if (task?.status !== 'VEHICLE_DROPPED_AT_WORKSHOP' && task?.pickup_status !== 'VEHICLE_DROPPED_AT_WORKSHOP') {
        const arrivedResponse = await fetch(`/api/pickup/tasks/${taskId}/arrived`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          }
        });

        if (!arrivedResponse.ok) {
          const arrivedData = await arrivedResponse.json();
          throw new Error(arrivedData.error || 'Failed to mark as arrived');
        }
      }

      // Use the proper API endpoint to complete pickup task
      const response = await fetch(`/api/pickup/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          notes: 'Vehicle delivered to workshop',
          odometer_reading: null, // Can be added if needed
          fuel_level: null, // Can be added if needed
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to complete pickup');
      }

      toast.success('✅ Vehicle delivered to workshop successfully!');
      setShowCompleteModal(false);
      router.push('/dashboard/workshop_pickup_boy/tasks');
    } catch (error: any) {
      console.error('Error completing delivery:', error);
      toast.error(`Failed to complete delivery: ${error.message}`);
    } finally {
      setProcessing(false);
    }
  }

  async function handleUploadPhotos() {
    if (selectedFiles.length === 0) {
      toast.error('Please select files to upload');
      return;
    }

    setUploading(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      let successCount = 0;
      let failCount = 0;

      // Upload each file
      for (const file of selectedFiles) {
        try {
          // Upload to Supabase Storage
          const fileExt = file.name.split('.').pop();
          const fileName = `${taskId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const filePath = `lead-media/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from('service-media')
            .upload(filePath, file);

          if (uploadError) throw uploadError;

          // Get public URL
          const { data: { publicUrl } } = supabase.storage
            .from('service-media')
            .getPublicUrl(filePath);

          // Save media record
          const { error: insertError } = await supabase.from('lead_media').insert({
            lead_id: taskId,
            file_url: publicUrl,
            media_type: 'IMAGE',
          category: photoCategory,
            description: `${photoCategory} photo taken by pickup boy`,
            file_name: file.name,
            file_size: file.size,
            mime_type: file.type,
            uploaded_by: user.id,
          });

          if (insertError) throw insertError;

          successCount++;
        } catch (error) {
          console.error(`Error uploading ${file.name}:`, error);
          failCount++;
      }
      }

      if (successCount > 0) {
        toast.success(`✅ ${successCount} photo(s) uploaded!${failCount > 0 ? ` (${failCount} failed)` : ''}`);
      setShowUploadModal(false);
        setSelectedFiles([]);
      fetchTaskDetails();
      } else {
        toast.error('All uploads failed. Please try again.');
      }
    } catch (error: any) {
      console.error('Error uploading photos:', error);
      toast.error(`Failed to upload: ${error.message}`);
    } finally {
      setUploading(false);
    }
  }

  const openGoogleMaps = async () => {
    if (!task) return;
    
    // Call navigate API to update status to ON_THE_WAY and auto-generate OTP
    try {
      const response = await fetch(`/api/pickup/${taskId}/navigate`, {
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

      // Status updated and OTP generated, now open maps
    const address = task.address || task.customer_address || task.pickup_address || '';
    const city = task.city || '';
    const pincode = task.pincode || '';
    const fullAddress = `${address}, ${city}, ${pincode}`.trim();
    const encodedAddress = encodeURIComponent(fullAddress);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
      
      // Refresh task details to get the updated OTP
      fetchTaskDetails();
      
      toast.success('✅ Navigation started! OTP generated. You can now verify OTP.');
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
        <div className="card text-center py-8 sm:py-10 md:py-12">
          <AlertCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-red-500 mx-auto mb-2 sm:mb-3 md:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-gray-700">Task not found</h3>
        </div>
      </DashboardLayout>
    );
  }

  // Show Start Pickup button only if status is ACCEPTED or ASSIGNED_TO_WORKSHOP and OTP not generated
  // Don't show if status is ON_THE_WAY (OTP will be auto-generated on navigate)
  const canStart = (
    (task.status === 'ACCEPTED' || task.status === 'ASSIGNED_TO_WORKSHOP') 
    && !task.pickup_otp
  );
  
  // Show Verify OTP button if:
  // 1. Status is ON_THE_WAY, ACCEPTED, ASSIGNED_TO_WORKSHOP, or VEHICLE_IN_TRANSIT
  // 2. OTP exists (either in service_leads.pickup_otp or pickup_otps table - already merged in fetchTaskDetails)
  // 3. OTP is not yet verified
  const hasOTP = !!task.pickup_otp;
  const canVerifyOTP = (
    task.status === 'ON_THE_WAY' || 
    task.status === 'ACCEPTED' || 
    task.status === 'ASSIGNED_TO_WORKSHOP' ||
    task.status === 'VEHICLE_IN_TRANSIT'
  ) && hasOTP && !otpVerified;
  const isInProgress = task.status === 'IN_PROGRESS' || task.status === 'VEHICLE_IN_TRANSIT';
  const canMarkArrived = task.status === 'VEHICLE_IN_TRANSIT' && otpVerified;
  const canComplete = (task.status === 'VEHICLE_DROPPED_AT_WORKSHOP' || task.status === 'VEHICLE_IN_TRANSIT') && otpVerified;

  return (
    <DashboardLayout role="workshop_pickup_boy">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
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
            {canComplete && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="btn-primary bg-green-600 hover:bg-green-700 flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex-1 sm:flex-initial"
              >
                <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                <span className="hidden sm:inline">Complete Delivery</span>
                <span className="sm:hidden">Complete</span>
              </button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <div className={`p-3 sm:p-4 rounded-lg border-l-4 ${
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
              {otpVerified && (
                <p className="text-xs sm:text-sm text-green-600 font-semibold mt-0.5 sm:mt-1">✓ OTP Verified</p>
              )}
              {task.pickup_otp && !otpVerified && (
                <p className="text-xs sm:text-sm text-orange-600 font-semibold mt-0.5 sm:mt-1">⚠️ OTP Not Verified</p>
              )}
            </div>
            <div className="text-left sm:text-right flex-shrink-0">
              <p className="text-xs sm:text-sm text-gray-600">Lead Number</p>
              <p className="text-lg sm:text-xl font-bold">{task.lead_number}</p>
            </div>
          </div>
        </div>

        {/* Task Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
          {/* Customer Info */}
          <div className="card p-3 sm:p-4 md:p-5">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
              Customer Information
            </h3>
            <div className="space-y-2 sm:space-y-3">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Name</p>
                <p className="font-semibold text-sm sm:text-base">{task.customer_name}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Phone</p>
                <a href={`tel:${task.customer_phone}`} className="font-semibold text-brand-primary hover:underline text-sm sm:text-base">
                  {task.customer_phone}
                </a>
              </div>
              {task.customer_alternate_phone && (
                <div>
                  <p className="text-xs sm:text-sm text-gray-600">Alternate Phone</p>
                  <a href={`tel:${task.customer_alternate_phone}`} className="font-semibold text-brand-primary hover:underline text-sm sm:text-base">
                    {task.customer_alternate_phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="card p-3 sm:p-4 md:p-5">
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <Car className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
              Vehicle Information
            </h3>
            <div className="space-y-2 sm:space-y-3">
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Number</p>
                <p className="font-semibold text-lg sm:text-xl">{task.vehicle_number}</p>
              </div>
              <div>
                <p className="text-xs sm:text-sm text-gray-600">Make/Model</p>
                <p className="font-semibold text-sm sm:text-base">{task.vehicle_make} {task.vehicle_model}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pickup Location */}
        <div className="card p-3 sm:p-4 md:p-5">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
            <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
            Pickup Location
          </h3>
          <div className="space-y-2 sm:space-y-3">
            <div>
              <p className="font-semibold text-sm sm:text-base">{task.address || task.customer_address || task.pickup_address || 'Address not provided'}</p>
              <p className="text-gray-600 text-xs sm:text-sm">{task.city || ''}{task.pincode ? `, ${task.pincode}` : ''}</p>
            </div>
            <button
              onClick={openGoogleMaps}
              className="btn-secondary bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
            >
              <Navigation className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Open in Google Maps</span>
              <span className="sm:hidden">Open Maps</span>
            </button>
          </div>
        </div>

        {/* Schedule */}
        <div className="card p-3 sm:p-4 md:p-5">
          <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
            <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
            Schedule
          </h3>
          <div className="space-y-2 sm:space-y-3">
            {(() => {
              // Priority 1: Check pickup_tracking.pickup_time_slot (formatted text like "10:00 AM - 12:00 PM")
              if (task.pickup_time_slot) {
                const date = task.preferred_date 
                  ? new Date(task.preferred_date) 
                  : task.preferred_slot_start 
                    ? new Date(task.preferred_slot_start) 
                    : new Date();
                
                return (
                  <>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Preferred Date</p>
                      <p className="font-semibold text-sm sm:text-base">
                        {date.toLocaleDateString('en-IN', { 
                          weekday: 'long',
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Time Slot</p>
                      <p className="font-semibold text-sm sm:text-base">{task.pickup_time_slot}</p>
                    </div>
                  </>
                );
              }
              
              // Priority 2: Check preferred_time_slot (formatted text)
              if (task.preferred_time_slot) {
                const date = task.preferred_date 
                  ? new Date(task.preferred_date) 
                  : task.preferred_slot_start 
                    ? new Date(task.preferred_slot_start) 
                    : new Date();
                
                return (
                  <>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Preferred Date</p>
                      <p className="font-semibold text-sm sm:text-base">
                        {date.toLocaleDateString('en-IN', { 
                          weekday: 'long',
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Time Slot</p>
                        <p className="font-semibold text-sm sm:text-base">{task.preferred_time_slot}</p>
                      </div>
                  </>
                );
              }
              
              // Priority 3: Check for preferred_slot_start (TIMESTAMP column) - Convert UTC to IST properly
              if (task.preferred_slot_start) {
                // Convert UTC to IST (UTC+5:30)
                const startDate = new Date(task.preferred_slot_start);
                const endDate = task.preferred_slot_end ? new Date(task.preferred_slot_end) : null;
                
                // Format in IST timezone
                const formatTimeIST = (date: Date) => {
                  return date.toLocaleTimeString('en-IN', { 
                    timeZone: 'Asia/Kolkata', // ✨ FIX: Explicitly use IST timezone
                    hour: '2-digit', 
                    minute: '2-digit',
                    hour12: true 
                  });
                };
                
                return (
                  <>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Preferred Date</p>
                      <p className="font-semibold text-sm sm:text-base">
                        {startDate.toLocaleDateString('en-IN', { 
                          timeZone: 'Asia/Kolkata', // ✨ FIX: Use IST timezone
                          weekday: 'long',
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Time Slot</p>
                      <p className="font-semibold text-sm sm:text-base">
                        {formatTimeIST(startDate)}
                        {endDate && ` - ${formatTimeIST(endDate)}`}
                      </p>
                    </div>
                  </>
                );
              }
              
              // Priority 4: Check for preferred_date only
              if (task.preferred_date) {
                const date = new Date(task.preferred_date);
                return (
                  <>
                    <div>
                      <p className="text-xs sm:text-sm text-gray-600">Preferred Date</p>
                      <p className="font-semibold text-sm sm:text-base">
                        {date.toLocaleDateString('en-IN', { 
                          weekday: 'long',
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                  </>
                );
              }
              
              // No preferred date/time found
              return <p className="text-xs sm:text-sm text-gray-500">No schedule information available</p>;
            })()}
          </div>
        </div>

        {/* Photos */}
        <div className="card p-3 sm:p-4 md:p-5">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-3 sm:mb-4">
            <h3 className="text-base sm:text-lg font-semibold flex items-center gap-1.5 sm:gap-2">
              <Camera className="w-4 h-4 sm:w-5 sm:h-5 text-brand-primary flex-shrink-0" />
              Photos ({beforePhotos.length})
            </h3>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-secondary bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
            >
              <Upload className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Upload Photos</span>
              <span className="sm:hidden">Upload</span>
            </button>
          </div>

          {beforePhotos.length === 0 ? (
            <div className="text-center py-6 sm:py-8 bg-gray-50 rounded">
              <Camera className="w-10 h-10 sm:w-12 sm:h-12 mx-auto mb-1.5 sm:mb-2 text-gray-400" />
              <p className="text-xs sm:text-sm text-gray-600">No photos uploaded yet</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Upload before and after photos for documentation</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 sm:gap-3">
              {beforePhotos.map((photo) => (
                <div key={photo.id} className="relative aspect-square">
                  <img
                    src={photo.file_url}
                    alt={photo.category}
                    className="w-full h-full object-cover rounded"
                  />
                  <span className="absolute top-1.5 sm:top-2 left-1.5 sm:left-2 px-1.5 sm:px-2 py-0.5 sm:py-1 bg-black bg-opacity-60 text-white text-[10px] sm:text-xs rounded">
                    {photo.category.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

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
                  <p className="text-xs sm:text-sm text-green-800 text-center font-semibold mb-1.5 sm:mb-2">
                    ✅ Testing Mode - OTP Bypass Active
                  </p>
                  <p className="text-[10px] sm:text-xs text-green-700 text-center">
                    Enter <strong className="text-base sm:text-lg">123456</strong> to verify
                  </p>
                  <p className="text-[10px] sm:text-xs text-gray-600 mt-0.5 sm:mt-1 text-center">
                    (Production: Customer receives OTP via SMS)
                  </p>
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
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-green-600">Deliver Vehicle to Workshop</h3>
              <p className="text-sm sm:text-base text-gray-700 mb-3 sm:mb-4">
                Confirm that you have successfully delivered the vehicle to the workshop.
              </p>

              {beforePhotos.filter(p => p.category === 'BEFORE_PICKUP').length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-2.5 sm:p-3 mb-3 sm:mb-4">
                  <p className="text-xs sm:text-sm text-yellow-700">⚠️ Recommendation: Upload before pickup photos for documentation</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded p-2.5 sm:p-3 mb-3 sm:mb-4">
                <p className="text-xs sm:text-sm text-blue-700">✓ Vehicle will be marked as delivered to workshop</p>
                <p className="text-xs sm:text-sm text-blue-700">✓ Workshop team will be notified</p>
              </div>

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

        {/* Upload Photos Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto p-4 sm:p-5 md:p-6">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 text-blue-600">Upload Photos</h3>
              
              <div className="space-y-3 sm:space-y-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Photo Category
                  </label>
                  <select
                    value={photoCategory}
                    onChange={(e) => setPhotoCategory(e.target.value as any)}
                    className="input w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                    disabled={uploading}
                  >
                    <option value="BEFORE_PICKUP">Before Pickup</option>
                    <option value="AFTER_DELIVERY">After Delivery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    Select Photos (Multiple)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                    disabled={uploading}
                    className="block w-full text-xs sm:text-sm text-gray-500
                      file:mr-2 sm:file:mr-4 file:py-1.5 sm:file:py-2 file:px-2 sm:file:px-4
                      file:rounded-lg file:border-0
                      file:text-xs sm:file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      cursor-pointer"
                  />
                  {selectedFiles.length > 0 && (
                    <p className="text-xs sm:text-sm text-green-600 mt-1.5 sm:mt-2">
                      ✓ {selectedFiles.length} file(s) selected
                    </p>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded p-2.5 sm:p-3">
                  <p className="text-xs sm:text-sm text-yellow-800">
                    📸 Take clear photos of:
                  </p>
                  <ul className="text-[10px] sm:text-xs text-gray-700 mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1 ml-3 sm:ml-4 list-disc">
                    <li>Vehicle from all 4 sides</li>
                    <li>Odometer reading</li>
                    <li>Any existing damage</li>
                    <li>Customer ID/signature</li>
                  </ul>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6">
                <button
                  onClick={handleUploadPhotos}
                  disabled={uploading || selectedFiles.length === 0}
                  className="btn-primary flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} Photo(s)`}
                </button>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFiles([]);
                  }}
                  disabled={uploading}
                  className="btn-secondary flex-1 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

