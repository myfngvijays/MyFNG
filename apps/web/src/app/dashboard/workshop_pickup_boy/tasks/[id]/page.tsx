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

      setTask(leadData);

      // Check if OTP is already verified
      if (leadData.pickup_otp_verified_at) {
        setOtpVerified(true);
      }

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

      // Update lead status
      const { error: updateError } = await supabase
        .from('service_leads')
        .update({
          pickup_otp: otp,
          updated_at: new Date().toISOString()
        })
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
    const supabase = createClient();

    try {
      // Bypass mode: Accept 123456 or actual OTP
      if (task.pickup_otp !== otpInput && otpInput !== '123456') {
        toast.error('Invalid OTP. Please try again.');
        setProcessing(false);
        return;
      }

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Mark OTP as verified and update status to IN_PROGRESS
      const updateData: any = {
        pickup_otp_verified_at: new Date().toISOString(),
        status: 'IN_PROGRESS'
      };
      
      // Only add updated_at if column exists (check via try-catch or just omit it)
      // Most tables have updated_at, but if it doesn't exist, it will cause an error
      
      const { error: updateError } = await supabase
        .from('service_leads')
        .update(updateData)
        .eq('id', taskId);

      if (updateError) {
        console.error('Error updating service_leads:', updateError);
        throw updateError;
      }

      // Create lead event (don't fail request if this fails)
      try {
        await supabase.from('lead_events').insert({
          lead_id: taskId,
          event_type: 'OTP_VERIFIED',
          event_description: `Customer OTP verified for vehicle handover`,
          created_by: user.id,
        });
      } catch (eventError) {
        // Log but don't fail the request
        console.error('Error creating lead event (non-critical):', eventError);
      }

      toast.success('✅ OTP verified successfully!');
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
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // First, ensure status is VEHICLE_IN_TRANSIT (required by API)
      // If current status is OTP_VERIFIED or IN_PROGRESS, update to VEHICLE_IN_TRANSIT first
      if (task?.pickup_status !== 'VEHICLE_IN_TRANSIT' && task?.status !== 'VEHICLE_IN_TRANSIT') {
        const { error: transitError } = await supabase
        .from('service_leads')
          .update({
            pickup_status: 'VEHICLE_IN_TRANSIT',
            status: 'VEHICLE_IN_TRANSIT',
            updated_at: new Date().toISOString()
          })
        .eq('id', taskId);

        if (transitError) {
          console.warn('Warning: Could not update to VEHICLE_IN_TRANSIT:', transitError);
          // Continue anyway, API will handle it
        }

        // Also update pickup_tracking
        await supabase
          .from('pickup_tracking')
          .update({
            pickup_status: 'VEHICLE_IN_TRANSIT',
            pickup_in_transit_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('lead_id', taskId);
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

  const openGoogleMaps = () => {
    if (!task) return;
    const address = task.address || task.customer_address || task.pickup_address || '';
    const city = task.city || '';
    const pincode = task.pincode || '';
    const fullAddress = `${address}, ${city}, ${pincode}`.trim();
    const encodedAddress = encodeURIComponent(fullAddress);
    window.open(`https://www.google.com/maps/search/?api=1&query=${encodedAddress}`, '_blank');
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_pickup_boy">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!task) {
    return (
      <DashboardLayout role="workshop_pickup_boy">
        <div className="card text-center py-12">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">Task not found</h3>
        </div>
      </DashboardLayout>
    );
  }

  const canStart = (task.status === 'ACCEPTED' || task.status === 'ASSIGNED_TO_WORKSHOP') && !task.pickup_otp;
  const isInProgress = task.status === 'IN_PROGRESS';
  const canComplete = isInProgress && otpVerified;

  return (
    <DashboardLayout role="workshop_pickup_boy">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <div className="flex gap-2">
            {canStart && (
              <button
                onClick={() => setShowStartModal(true)}
                className="btn-primary flex items-center gap-2"
              >
                <PlayCircle className="w-5 h-5" />
                Start Pickup
              </button>
            )}
            {canStart && task.pickup_otp && !otpVerified && (
              <button
                onClick={() => setShowOTPModal(true)}
                className="btn-secondary bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2"
              >
                <Shield className="w-5 h-5" />
                Verify OTP
              </button>
            )}
            {canComplete && (
              <button
                onClick={() => setShowCompleteModal(true)}
                className="btn-primary bg-green-600 hover:bg-green-700 flex items-center gap-2"
              >
                <CheckCircle className="w-5 h-5" />
                Deliver to Workshop
              </button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <div className={`p-4 rounded-lg border-l-4 ${
          task.status === 'IN_PROGRESS' ? 'bg-blue-50 border-blue-500' :
          task.status === 'ACCEPTED' || task.status === 'ASSIGNED_TO_WORKSHOP' ? 'bg-yellow-50 border-yellow-500' :
          'bg-green-50 border-green-500'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Lead Status</p>
              <p className="text-xl font-bold">{task.status.replace(/_/g, ' ')}</p>
              {otpVerified && (
                <p className="text-sm text-green-600 font-semibold mt-1">✓ OTP Verified</p>
              )}
              {task.pickup_otp && !otpVerified && (
                <p className="text-sm text-orange-600 font-semibold mt-1">⚠️ OTP Not Verified</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Lead Number</p>
              <p className="text-xl font-bold">{task.lead_number}</p>
            </div>
          </div>
        </div>

        {/* Task Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Customer Info */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <User className="w-5 h-5 text-brand-primary" />
              Customer Information
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Name</p>
                <p className="font-semibold">{task.customer_name}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Phone</p>
                <a href={`tel:${task.customer_phone}`} className="font-semibold text-brand-primary hover:underline">
                  {task.customer_phone}
                </a>
              </div>
              {task.customer_alternate_phone && (
                <div>
                  <p className="text-sm text-gray-600">Alternate Phone</p>
                  <a href={`tel:${task.customer_alternate_phone}`} className="font-semibold text-brand-primary hover:underline">
                    {task.customer_alternate_phone}
                  </a>
                </div>
              )}
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <Car className="w-5 h-5 text-brand-primary" />
              Vehicle Information
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-sm text-gray-600">Number</p>
                <p className="font-semibold text-xl">{task.vehicle_number}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Make/Model</p>
                <p className="font-semibold">{task.vehicle_make} {task.vehicle_model}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Pickup Location */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <MapPin className="w-5 h-5 text-brand-primary" />
            Pickup Location
          </h3>
          <div className="space-y-3">
            <div>
              <p className="font-semibold">{task.address || task.customer_address || task.pickup_address || 'Address not provided'}</p>
              <p className="text-gray-600">{task.city || ''}{task.pincode ? `, ${task.pincode}` : ''}</p>
            </div>
            <button
              onClick={openGoogleMaps}
              className="btn-secondary bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
            >
              <Navigation className="w-4 h-4" />
              Open in Google Maps
            </button>
          </div>
        </div>

        {/* Schedule */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Clock className="w-5 h-5 text-brand-primary" />
            Schedule
          </h3>
          <div className="space-y-2">
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
                      <p className="text-sm text-gray-600">Preferred Date</p>
                      <p className="font-semibold">
                        {date.toLocaleDateString('en-IN', { 
                          weekday: 'long',
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Time Slot</p>
                      <p className="font-semibold">{task.pickup_time_slot}</p>
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
                      <p className="text-sm text-gray-600">Preferred Date</p>
                      <p className="font-semibold">
                        {date.toLocaleDateString('en-IN', { 
                          weekday: 'long',
                          year: 'numeric', 
                          month: 'long', 
                          day: 'numeric' 
                        })}
                      </p>
                    </div>
                      <div>
                        <p className="text-sm text-gray-600">Time Slot</p>
                        <p className="font-semibold">{task.preferred_time_slot}</p>
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
                      <p className="text-sm text-gray-600">Preferred Date</p>
                      <p className="font-semibold">
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
                      <p className="text-sm text-gray-600">Time Slot</p>
                      <p className="font-semibold">
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
                      <p className="text-sm text-gray-600">Preferred Date</p>
                      <p className="font-semibold">
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
              return <p className="text-gray-500">No schedule information available</p>;
            })()}
          </div>
        </div>

        {/* Photos */}
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Camera className="w-5 h-5 text-brand-primary" />
              Photos ({beforePhotos.length})
            </h3>
            <button
              onClick={() => setShowUploadModal(true)}
              className="btn-secondary bg-blue-600 hover:bg-blue-700 text-white flex items-center gap-2"
            >
              <Upload className="w-4 h-4" />
              Upload Photos
            </button>
          </div>

          {beforePhotos.length === 0 ? (
            <div className="text-center py-8 bg-gray-50 rounded">
              <Camera className="w-12 h-12 mx-auto mb-2 text-gray-400" />
              <p className="text-sm text-gray-600">No photos uploaded yet</p>
              <p className="text-xs text-gray-500 mt-1">Upload before and after photos for documentation</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {beforePhotos.map((photo) => (
                <div key={photo.id} className="relative aspect-square">
                  <img
                    src={photo.file_url}
                    alt={photo.category}
                    className="w-full h-full object-cover rounded"
                  />
                  <span className="absolute top-2 left-2 px-2 py-1 bg-black bg-opacity-60 text-white text-xs rounded">
                    {photo.category.replace(/_/g, ' ')}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Start Pickup Modal */}
        {showStartModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4 text-blue-600">Start Pickup</h3>
              <p className="text-gray-700 mb-4">
                You are about to start the pickup for <strong>{task.customer_name}</strong>.
              </p>
              <p className="text-sm text-gray-600 mb-4">
                Make sure you have reached the pickup location before starting.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={handleStartPickup}
                  disabled={processing}
                  className="btn-primary flex-1"
                >
                  {processing ? 'Starting...' : 'Start Pickup'}
                </button>
                <button
                  onClick={() => setShowStartModal(false)}
                  disabled={processing}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* OTP Verification Modal */}
        {showOTPModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4 text-orange-600">Verify OTP</h3>
              <p className="text-gray-700 mb-4">
                Ask the customer for the 6-digit OTP to verify vehicle handover.
              </p>
              
              {task?.pickup_otp && (
                <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <p className="text-sm text-green-800 text-center font-semibold mb-2">
                    ✅ Testing Mode - OTP Bypass Active
                  </p>
                  <p className="text-xs text-green-700 text-center">
                    Enter <strong className="text-lg">123456</strong> to verify
                  </p>
                  <p className="text-xs text-gray-600 mt-1 text-center">
                    (Production: Customer receives OTP via SMS)
                  </p>
                </div>
              )}

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Enter OTP <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  className="input w-full text-center text-2xl font-bold tracking-widest"
                  placeholder="000000"
                  maxLength={6}
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={handleVerifyOTP}
                  disabled={processing || otpInput.length !== 6}
                  className="btn-secondary bg-orange-600 hover:bg-orange-700 text-white flex-1"
                >
                  {processing ? 'Verifying...' : 'Verify OTP'}
                </button>
                <button
                  onClick={() => {
                    setShowOTPModal(false);
                    setOtpInput('');
                  }}
                  disabled={processing}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Complete Delivery Modal */}
        {showCompleteModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4 text-green-600">Deliver Vehicle to Workshop</h3>
              <p className="text-gray-700 mb-4">
                Confirm that you have successfully delivered the vehicle to the workshop.
              </p>

              {beforePhotos.filter(p => p.category === 'BEFORE_PICKUP').length === 0 && (
                <div className="bg-yellow-50 border border-yellow-200 rounded p-3 mb-4">
                  <p className="text-sm text-yellow-700">⚠️ Recommendation: Upload before pickup photos for documentation</p>
                </div>
              )}

              <div className="bg-blue-50 border border-blue-200 rounded p-3 mb-4">
                <p className="text-sm text-blue-700">✓ Vehicle will be marked as delivered to workshop</p>
                <p className="text-sm text-blue-700">✓ Workshop team will be notified</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={handleCompleteDelivery}
                  disabled={processing}
                  className="btn-primary bg-green-600 hover:bg-green-700 flex-1"
                >
                  {processing ? 'Processing...' : 'Confirm Delivery'}
                </button>
                <button
                  onClick={() => setShowCompleteModal(false)}
                  disabled={processing}
                  className="btn-secondary flex-1"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Upload Photos Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <h3 className="text-xl font-bold mb-4 text-blue-600">Upload Photos</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Photo Category
                  </label>
                  <select
                    value={photoCategory}
                    onChange={(e) => setPhotoCategory(e.target.value as any)}
                    className="input w-full"
                    disabled={uploading}
                  >
                    <option value="BEFORE_PICKUP">Before Pickup</option>
                    <option value="AFTER_DELIVERY">After Delivery</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Photos (Multiple)
                  </label>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => setSelectedFiles(Array.from(e.target.files || []))}
                    disabled={uploading}
                    className="block w-full text-sm text-gray-500
                      file:mr-4 file:py-2 file:px-4
                      file:rounded-lg file:border-0
                      file:text-sm file:font-semibold
                      file:bg-blue-50 file:text-blue-700
                      hover:file:bg-blue-100
                      cursor-pointer"
                  />
                  {selectedFiles.length > 0 && (
                    <p className="text-sm text-green-600 mt-2">
                      ✓ {selectedFiles.length} file(s) selected
                    </p>
                  )}
                </div>

                <div className="bg-yellow-50 border border-yellow-200 rounded p-3">
                  <p className="text-sm text-yellow-800">
                    📸 Take clear photos of:
                  </p>
                  <ul className="text-xs text-gray-700 mt-2 space-y-1 ml-4 list-disc">
                    <li>Vehicle from all 4 sides</li>
                    <li>Odometer reading</li>
                    <li>Any existing damage</li>
                    <li>Customer ID/signature</li>
                  </ul>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={handleUploadPhotos}
                  disabled={uploading || selectedFiles.length === 0}
                  className="btn-primary flex-1"
                >
                  {uploading ? 'Uploading...' : `Upload ${selectedFiles.length} Photo(s)`}
                </button>
                <button
                  onClick={() => {
                    setShowUploadModal(false);
                    setSelectedFiles([]);
                  }}
                  disabled={uploading}
                  className="btn-secondary flex-1"
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

