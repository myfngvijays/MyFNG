'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface PhotoState {
  type: string;
  label: string;
  file: File | null;
  preview: string | null;
  uploaded: boolean;
  uploading: boolean;
  required: boolean;
}

interface Props {
  leadId: string;
  jobId: string;
  onUploadComplete: () => void;
}

const DURING_PHOTOS = [
  { type: 'DURING_OIL_DRAIN', label: 'Drained Oil (Dirty Oil in Pan)', required: true },
  { type: 'DURING_OIL_POUR', label: 'New Oil Being Poured', required: true },
  { type: 'DURING_FILTER_OLD', label: 'Old Filter Removed', required: true },
  { type: 'DURING_FILTER_NEW', label: 'New Filter Installed', required: true },
  { type: 'DURING_BRAKE_BEFORE', label: 'Brake Pads Removed (Before)', required: false },
  { type: 'DURING_BRAKE_AFTER', label: 'Brake Pads Installed (After)', required: false },
  { type: 'DURING_AC_BEFORE', label: 'AC Coil Before Service', required: false },
  { type: 'DURING_AC_AFTER', label: 'AC Coil After Service', required: false },
  { type: 'DURING_PART_REMOVAL', label: 'Part Removal', required: false },
  { type: 'DURING_PART_INSTALL', label: 'Part Installation', required: false },
];

export default function DuringServiceUpload({ leadId, jobId, onUploadComplete }: Props) {
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsWarning, setGpsWarning] = useState(false);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  useEffect(() => {
    if (photos.length === 0) {
      initializePhotos();
    }
    getLocation();
    if (jobId) {
      fetchExistingPhotos();
    }
  }, [leadId, jobId]);

  const fetchExistingPhotos = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mechanic_job_photos')
        .select('*')
        .eq('job_id', jobId)
        .eq('photo_category', 'during')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setPhotos((prevPhotos) =>
          prevPhotos.map((photo) => {
            const existing = data.find((d) => d.photo_type === photo.type);
            if (existing) {
              return {
                ...photo,
                preview: existing.photo_url,
                uploaded: true,
              };
            }
            return photo;
          })
        );
      }
    } catch (error) {
      console.error('Error fetching existing photos:', error);
    }
  };

  const initializePhotos = () => {
    setPhotos(
      DURING_PHOTOS.map((photo) => ({
        type: photo.type,
        label: photo.label,
        file: null,
        preview: null,
        uploaded: false,
        uploading: false,
        required: photo.required,
      }))
    );
  };

  const getLocation = async () => {
    try {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
            });
            setGpsWarning(false);
          },
          (error) => {
            console.error('GPS error:', error);
            setGpsWarning(true);
          }
        );
      } else {
        setGpsWarning(true);
      }
    } catch (error) {
      console.error('Location error:', error);
      setGpsWarning(true);
    }
  };

  const handleFileSelect = (index: number, file: File | null) => {
    if (!file) return;

    // Accept both images and videos
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
    const isVideo = file.type.startsWith('video/') || /\.(mp4|webm|ogg|mov|avi)$/i.test(file.name);

    if (!isImage && !isVideo) {
      toast.error('Please select an image or video file');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotos((prev) =>
        prev.map((photo, idx) =>
          idx === index
            ? {
                ...photo,
                file,
                preview: reader.result as string,
                uploaded: false,
              }
            : photo
        )
      );
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (index: number) => {
    const photo = photos[index];
    if (!photo.file || !photo.preview) {
      toast.error('Please select a photo first');
      return;
    }

    setPhotos((prev) =>
      prev.map((p, idx) => (idx === index ? { ...p, uploading: true } : p))
    );

    try {
      // Get session token for authorization
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication failed. Please login again.');
      }

      const formData = new FormData();
      formData.append('file', photo.file);
      formData.append('photoType', photo.type);
      formData.append('photoCategory', 'during');
      if (location) {
        formData.append('latitude', location.latitude.toString());
        formData.append('longitude', location.longitude.toString());
      }

      const response = await fetch(`/api/mechanic/jobs/${leadId}/upload-photos`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      // Check if response is ok before parsing JSON
      if (!response.ok) {
        let errorMessage = 'Upload failed';
        try {
          const errorResult = await response.json();
          errorMessage = errorResult.error || errorResult.details || errorMessage;
        } catch (e) {
          // If JSON parsing fails, use status text
          errorMessage = response.statusText || errorMessage;
        }
        throw new Error(errorMessage);
      }

      const result = await response.json();

      // Double check for error in response body
      if (result.error) {
        throw new Error(result.error || result.details || 'Upload failed');
      }

      setPhotos((prev) =>
        prev.map((p, idx) =>
          idx === index
            ? {
                ...p,
                uploaded: true,
                uploading: false,
              }
            : p
        )
      );

      toast.success(`${photo.label} uploaded successfully`);
      onUploadComplete();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload photo');
      setPhotos((prev) =>
        prev.map((p, idx) => (idx === index ? { ...p, uploading: false } : p))
      );
    }
  };

  const handleRemove = (index: number) => {
    setPhotos((prev) =>
      prev.map((photo, idx) =>
        idx === index
          ? {
              ...photo,
              file: null,
              preview: null,
              uploaded: false,
            }
          : photo
      )
    );
  };

  const requiredCount = photos.filter((p) => p.required).length;
  const uploadedCount = photos.filter((p) => p.required && p.uploaded).length;

  return (
    <div className="space-y-4">
      {/* Work in Progress Checklist Indicator - Same style as Before Inspection */}
      <div className="bg-gradient-to-r from-orange-50 to-amber-50 rounded-lg p-5 border-2 border-orange-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Camera className="w-6 h-6 text-orange-600" />
            Work in Progress Checklist
          </h4>
          <div className={`px-4 py-2 rounded-full font-bold ${
            uploadedCount >= requiredCount 
              ? 'bg-green-100 text-green-700 border-2 border-green-300' 
              : 'bg-orange-100 text-orange-700 border-2 border-orange-300'
          }`}>
            {uploadedCount} / {requiredCount}
          </div>
        </div>
        
        {/* Progress Bar */}
        <div className="mb-4">
          <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                uploadedCount >= requiredCount ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-orange-500 to-orange-600'
              }`}
              style={{ width: `${Math.min((uploadedCount / requiredCount) * 100, 100)}%` }}
            />
          </div>
          <div className="flex justify-between mt-1 text-xs text-gray-600">
            <span>{uploadedCount >= requiredCount ? '✅ Complete' : '⏳ In Progress'}</span>
            <span>{Math.round((uploadedCount / requiredCount) * 100)}%</span>
          </div>
        </div>

        {/* Checklist Items Grid - Same style as Before Inspection */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {photos.filter(p => p.required).map((photo, index) => (
            <div
              key={photo.type}
              className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                photo.uploaded
                  ? 'bg-green-50 border-green-300 shadow-sm'
                  : 'bg-white border-orange-200'
              }`}
            >
              <div className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                photo.uploaded ? 'bg-green-500' : 'bg-orange-200'
              }`}>
                {photo.uploaded ? (
                  <CheckCircle className="w-5 h-5 text-white" />
                ) : (
                  <span className="text-orange-600 font-bold text-sm">{index + 1}</span>
                )}
              </div>
              <div className="flex-1">
                <p className={`text-sm font-semibold ${
                  photo.uploaded ? 'text-green-800' : 'text-gray-700'
                }`}>
                  {photo.label}
                </p>
                {photo.uploaded && (
                  <p className="text-xs text-green-600 mt-0.5">✓ Uploaded</p>
                )}
              </div>
              {photo.uploaded && (
                <div className="flex-shrink-0">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Optional Photos Section */}
        {photos.filter(p => !p.required).length > 0 && (
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-xs font-semibold text-gray-600 mb-2">Optional Photos (Recommended):</p>
            <div className="flex flex-wrap gap-2">
              {photos.filter(p => !p.required).map((photo) => (
                <div
                  key={photo.type}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs ${
                    photo.uploaded
                      ? 'bg-green-100 text-green-700 border border-green-300'
                      : 'bg-gray-100 text-gray-600 border border-gray-300'
                  }`}
                >
                  {photo.uploaded ? (
                    <CheckCircle className="w-3 h-3" />
                  ) : (
                    <span className="w-3 h-3 rounded-full border border-gray-400"></span>
                  )}
                  <span>{photo.label}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* GPS Warning */}
      {gpsWarning && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
          <AlertTriangle className="w-5 h-5 text-yellow-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-yellow-800 font-medium">GPS Data Missing</p>
            <p className="text-xs text-yellow-700 mt-1">
              Location verification recommended but not required. Some photos may be missing GPS coordinates.
            </p>
          </div>
        </div>
      )}

      {/* GPS Status */}
      {location && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-3 flex items-center gap-2">
          <MapPin className="w-5 h-5 text-green-600" />
          <div className="flex-1">
            <p className="text-sm text-green-800 font-medium">GPS Location Captured</p>
            <p className="text-xs text-green-700">
              {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
            </p>
          </div>
        </div>
      )}

      {/* Photo Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {photos.map((photo, index) => (
          <div
            key={photo.type}
            className={`border-2 rounded-lg p-4 ${
              photo.uploaded
                ? 'border-green-500 bg-green-50'
                : photo.required
                ? 'border-orange-300 bg-orange-50'
                : 'border-gray-300 bg-gray-50'
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm font-semibold text-gray-700">
                {photo.label}
                {photo.required && <span className="text-red-500 ml-1">*</span>}
              </label>
              {photo.uploaded && (
                <CheckCircle className="w-5 h-5 text-green-600" />
              )}
            </div>

            {photo.preview ? (
              <div className="relative">
                {photo.file?.type.startsWith('video/') || /\.(mp4|webm|ogg|mov|avi)$/i.test(photo.file?.name || '') ? (
                  <video
                    src={photo.preview}
                    className="w-full h-32 object-cover rounded-lg mb-2"
                    controls
                    preload="metadata"
                  />
                ) : (
                  <img
                    src={photo.preview}
                    alt={photo.label}
                    className="w-full h-32 object-cover rounded-lg mb-2"
                  />
                )}
                {photo.uploading && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 rounded-lg flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-white"></div>
                  </div>
                )}
                {!photo.uploaded && !photo.uploading && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleUpload(index)}
                      className="flex-1 btn-primary text-sm py-1 cursor-pointer"
                    >
                      Upload
                    </button>
                    <button
                      onClick={() => handleRemove(index)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600 cursor-pointer"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div
                className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-brand-primary hover:bg-brand-primary/5 transition"
                onClick={() => fileInputRefs.current[index]?.click()}
              >
                <input
                  ref={(el) => { fileInputRefs.current[index] = el; }}
                  type="file"
                  accept="image/*,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(index, file);
                  }}
                />
                <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Click to Upload</p>
                <p className="text-xs text-gray-400 mt-1">Image or Video</p>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
