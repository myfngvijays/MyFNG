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
      const response = await fetch(`/api/pickup/tasks/${taskId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to start pickup');
        return;
      }

      toast.success('Pickup started successfully!');
      setShowStartModal(false);
      setShowOTPModal(true);
      fetchTaskDetails();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to start pickup');
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
      const response = await fetch(`/api/pickup/tasks/${taskId}/verify-otp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ otp_code: otpInput })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Invalid OTP');
        return;
      }

      toast.success('OTP verified successfully!');
      setShowOTPModal(false);
      setOtpVerified(true);
      fetchTaskDetails();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to verify OTP');
    } finally {
      setProcessing(false);
    }
  }

  async function handleCompleteDelivery() {
    if (beforePhotos.filter(p => p.category === 'BEFORE_PICKUP').length === 0) {
      toast.error('Please upload before pickup photos first');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/api/pickup/tasks/${taskId}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' }
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to complete delivery');
        return;
      }

      toast.success('Delivery completed successfully!');
      setShowCompleteModal(false);
      router.push('/dashboard/workshop_pickup_boy/tasks');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to complete delivery');
    } finally {
      setProcessing(false);
    }
  }

  async function handleUploadPhotos(photoUrls: string[]) {
    setProcessing(true);

    try {
      const response = await fetch(`/api/pickup/tasks/${taskId}/upload-photos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          photo_urls: photoUrls,
          category: photoCategory,
          title: `${photoCategory} Photos`,
          description: `Photos taken by pickup boy`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to upload photos');
        return;
      }

      toast.success(`${photoUrls.length} photo(s) uploaded successfully!`);
      setShowUploadModal(false);
      fetchTaskDetails();
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to upload photos');
    } finally {
      setProcessing(false);
    }
  }

  const openGoogleMaps = () => {
    if (!task) return;
    const fullAddress = `${task.pickup_address}, ${task.pickup_city}, ${task.pickup_pincode}`;
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

  const canStart = task.pickup_status === 'PICKUP_SCHEDULED';
  const canComplete = task.pickup_status === 'IN_TRANSIT' && otpVerified;

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
            {task.pickup_status === 'IN_TRANSIT' && !otpVerified && (
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
                Complete Delivery
              </button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <div className={`p-4 rounded-lg border-l-4 ${
          task.pickup_status === 'IN_TRANSIT' ? 'bg-blue-50 border-blue-500' :
          task.pickup_status === 'PICKUP_SCHEDULED' ? 'bg-yellow-50 border-yellow-500' :
          'bg-green-50 border-green-500'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pickup Status</p>
              <p className="text-xl font-bold">{task.pickup_status.replace(/_/g, ' ')}</p>
              {otpVerified && (
                <p className="text-sm text-green-600 font-semibold mt-1">✓ OTP Verified</p>
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
              <p className="font-semibold">{task.pickup_address}</p>
              <p className="text-gray-600">{task.pickup_city}, {task.pickup_pincode}</p>
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
            <div>
              <p className="text-sm text-gray-600">Preferred Date</p>
              <p className="font-semibold">{new Date(task.preferred_date).toLocaleDateString()}</p>
            </div>
            {task.preferred_time_slot && (
              <div>
                <p className="text-sm text-gray-600">Time Slot</p>
                <p className="font-semibold">{task.preferred_time_slot}</p>
              </div>
            )}
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
              <h3 className="text-xl font-bold mb-4 text-green-600">Complete Delivery</h3>
              <p className="text-gray-700 mb-4">
                Mark this vehicle as delivered to the workshop.
              </p>

              {beforePhotos.filter(p => p.category === 'BEFORE_PICKUP').length === 0 && (
                <div className="bg-red-50 border border-red-200 rounded p-3 mb-4">
                  <p className="text-sm text-red-700">⚠️ Before pickup photos are required</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={handleCompleteDelivery}
                  disabled={processing || beforePhotos.filter(p => p.category === 'BEFORE_PICKUP').length === 0}
                  className="btn-primary bg-green-600 hover:bg-green-700 flex-1"
                >
                  {processing ? 'Completing...' : 'Complete Delivery'}
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

        {/* Upload Photos Modal (Simplified) */}
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
                  >
                    <option value="BEFORE_PICKUP">Before Pickup</option>
                    <option value="AFTER_DELIVERY">After Delivery</option>
                  </select>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded p-4">
                  <p className="text-sm text-blue-700 mb-2">
                    📸 Photo upload feature requires file upload integration.
                  </p>
                  <p className="text-xs text-gray-600">
                    In production, this would integrate with your file storage service (AWS S3, Cloudinary, etc.)
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => setShowUploadModal(false)}
                  className="btn-secondary flex-1"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

