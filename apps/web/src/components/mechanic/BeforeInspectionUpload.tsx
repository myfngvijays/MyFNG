'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, MapPin, AlertTriangle, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { optimizeUploadFile } from '@/lib/media/optimizeUpload';

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
  mode?: 'MECHANIC_JOB' | 'LEAD_MEDIA';
}

const REQUIRED_PHOTOS = [
  { type: 'BEFORE_FRONT', label: 'Front View', required: true },
  { type: 'BEFORE_REAR', label: 'Rear View', required: true },
  { type: 'BEFORE_LEFT', label: 'Left Side', required: true },
  { type: 'BEFORE_RIGHT', label: 'Right Side', required: true },
  { type: 'BEFORE_DASHBOARD', label: 'Dashboard & Odometer', required: true },
  { type: 'BEFORE_ENGINE_BAY', label: 'Engine Bay', required: true },
  { type: 'BEFORE_DAMAGE', label: 'Visible Damages (Optional)', required: false },
  { type: 'BEFORE_TYRE', label: 'Tyres (Optional)', required: false },
];

export default function BeforeInspectionUpload({ leadId, jobId, onUploadComplete, mode = 'MECHANIC_JOB' }: Props) {
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [odometerReading, setOdometerReading] = useState('');
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsWarning, setGpsWarning] = useState(false);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const bulkInputRef = useRef<HTMLInputElement | null>(null);
  const bulkQueueRef = useRef<Array<{ index: number; file: File; type: string; label: string }>>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkUploadingRef = useRef(false);
  const photosRef = useRef<PhotoState[]>([]);
  const [bulkMapOpen, setBulkMapOpen] = useState(false);
  const [bulkPicked, setBulkPicked] = useState<
    Array<{ id: string; file: File; previewUrl: string; assignedType: string | null }>
  >([]);

  useEffect(() => {
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    bulkUploadingRef.current = bulkUploading;
  }, [bulkUploading]);

  useEffect(() => {
    if (photos.length === 0) {
      initializePhotos();
    }
    getLocation();
    // Fetch from both sources if both are available (for supervisor view)
    if (mode === 'MECHANIC_JOB') {
      if (jobId) fetchExistingPhotosFromJob();
      // Also fetch from lead_media to show pickup photos
      if (leadId) fetchExistingPhotosFromLead();
    } else {
      if (leadId) fetchExistingPhotosFromLead();
      // Also fetch from mechanic_job_photos if jobId is available
      if (jobId) fetchExistingPhotosFromJob();
    }
  }, [leadId, jobId, mode]);

  const fetchExistingPhotosFromJob = async () => {
    // Guard: Don't fetch if jobId is empty or invalid
    if (!jobId || jobId.trim() === '') {
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mechanic_job_photos')
        .select('*')
        .eq('job_id', jobId)
        .eq('photo_category', 'before')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setPhotos((prevPhotos) => {
          const base =
            prevPhotos && prevPhotos.length
              ? prevPhotos
              : REQUIRED_PHOTOS.map((p) => ({
                  type: p.type,
                  label: p.label,
                  file: null,
                  preview: null,
                  uploaded: false,
                  uploading: false,
                  required: p.required,
                }));

          return base.map((photo) => {
            // Check if photo already has a preview (from lead_media - pickup photos)
            const hasPickupPhoto = photo.preview && photo.uploaded;
            const existing = data.find((d) => d.photo_type === photo.type);
            if (existing) {
              // Mechanic photo exists - use it (mechanic photos take priority)
              return {
                ...photo,
                preview: existing.photo_url,
                uploaded: true,
              };
            }
            // If no mechanic photo but pickup photo exists, keep the pickup photo
            if (hasPickupPhoto) {
              return photo;
            }
            return photo;
          });
        });

        // Set odometer reading if dashboard photo exists
        const dashboardPhoto = data.find((d) => d.photo_type === 'BEFORE_DASHBOARD');
        if (dashboardPhoto?.odometer_reading) {
          setOdometerReading(dashboardPhoto.odometer_reading.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  };

  const fetchExistingPhotosFromLead = async () => {
    try {
      const res = await fetch(`/api/leads/${leadId}/media`, { method: 'GET' });
      const data = await res.json().catch(() => ({}));
      const media = Array.isArray(data?.media) ? data.media : [];
      // Support both schemas:
      // - legacy typed columns: photo_category/photo_type
      // - fallback: category contains BEFORE_* slot key
      const typedBefore = media.filter((m: any) => {
        const pc = String(m?.photo_category || '').toLowerCase();
        const cat = String(m?.category || '').toUpperCase();
        return pc === 'before' || cat.startsWith('BEFORE_');
      });

      setPhotos((prevPhotos) => {
        const base =
          prevPhotos && prevPhotos.length
            ? prevPhotos
            : REQUIRED_PHOTOS.map((p) => ({
                type: p.type,
                label: p.label,
                file: null,
                preview: null,
                uploaded: false,
                uploading: false,
                required: p.required,
              }));

        return base.map((photo) => {
          // Check if photo already has a preview (from mechanic_job_photos)
          if (photo.preview && photo.uploaded) {
            return photo; // Keep existing mechanic photo
          }
          // Otherwise, check lead_media
          const existing = typedBefore.find((d: any) => {
            const t = String(d.photo_type || d.category || '').toUpperCase();
            if (t) return t === photo.type;
            const fn = String(d.file_name || '');
            const m = fn.match(/^(BEFORE_[A-Z0-9_]+)__+/);
            return (m?.[1] || '').toUpperCase() === photo.type;
          });
          if (existing) {
            return {
              ...photo,
              preview: existing.file_url || existing.photo_url || photo.preview || null,
              uploaded: true,
            };
          }
          return photo;
        });
      });
    } catch (e) {
      console.error('Error fetching lead media:', e);
    }
  };

  const initializePhotos = () => {
    setPhotos(
      REQUIRED_PHOTOS.map((photo) => ({
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
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
          setGpsWarning(false);
        },
        () => {
          setGpsWarning(true);
        }
      );
    } else {
      setGpsWarning(true);
    }
  };

  const revokeIfBlobUrl = (url: string | null) => {
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
  };

  const cleanupBulkPickedPreviews = () => {
    setBulkPicked((prev) => {
      for (const p of prev) revokeIfBlobUrl(p.previewUrl);
      return [];
    });
  };

  const setSlotFile = (index: number, file: File) => {
    setPhotos((prev) => {
      const next = [...prev];
      // cleanup old preview blob url if any
      revokeIfBlobUrl(next[index]?.preview || null);
      next[index] = {
        ...next[index],
        file,
        preview: URL.createObjectURL(file),
        uploaded: false,
      };
      return next;
    });
  };

  const handleFileSelect = async (index: number, file: File) => {
    // Check file size before processing (100MB limit for videos)
    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    if (file.size > MAX_FILE_SIZE) {
      const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
      toast.error(`File too large: ${fileSizeMB}MB. Maximum size is 100MB. Please compress the video or use a smaller file.`);
      return;
    }

    // Accept both images and videos - check file extension first for better PNG/video detection
    const fileName = file.name.toLowerCase();
    const fileExtension = fileName.split('.').pop();
    
    // Comprehensive list of image formats
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'bmp', 'tiff', 'tif', 'svg', 'heic', 'heif', 'ico', 'jfif', 'pjpeg', 'pjp'];
    // Comprehensive list of video formats
    const videoExtensions = ['mp4', 'webm', 'ogg', 'ogv', 'mov', 'avi', 'm4v', '3gp', 'mkv', 'flv', 'wmv', 'mpg', 'mpeg', 'm2v', 'ts', 'mts', 'f4v', 'asf', 'rm', 'rmvb', 'vob'];
    
    const isImage = file.type.startsWith('image/') || (fileExtension && imageExtensions.includes(fileExtension));
    const isVideo = file.type.startsWith('video/') || (fileExtension && videoExtensions.includes(fileExtension));

    // Special handling for files that might not have correct MIME type (especially PNG, HEIC, etc.)
    if (!isImage && !isVideo) {
      // Double check by extension
      if (fileExtension && (imageExtensions.includes(fileExtension) || videoExtensions.includes(fileExtension))) {
        // File extension is valid, proceed anyway
        console.log('File type detected by extension:', fileExtension);
      } else {
        toast.error('Please select an image or video file');
        return;
      }
    }

    // Set preview immediately; optimization is done right before upload.
    setSlotFile(index, file);

      // If it's dashboard photo, show odometer input
      const slotType = REQUIRED_PHOTOS[index]?.type || photosRef.current?.[index]?.type;
      if (slotType === 'BEFORE_DASHBOARD') {
        setSelectedPhotoIndex(index);
        setShowOdometerModal(true);
      } else {
        uploadPhoto(index, file, slotType || null, REQUIRED_PHOTOS[index]?.label || null);
      }
  };

  const uploadPhoto = async (
    index: number,
    fileOverride?: File,
    typeOverride?: string | null,
    labelOverride?: string | null
  ) => {
    const photo = photosRef.current[index];
    const effectiveType = typeOverride || photo?.type || REQUIRED_PHOTOS[index]?.type;
    const effectiveLabel = labelOverride || photo?.label || REQUIRED_PHOTOS[index]?.label || 'Photo';
    if (!effectiveType) return;

    const fileToUpload = fileOverride || photo?.file;
    if (!fileToUpload) return;
    if (photo?.uploaded || photo?.uploading) return;

    setPhotos((prev) => {
      const next = [...prev];
      if (!next[index] || next[index].uploaded || next[index].uploading) return prev;
      next[index] = { ...next[index], uploading: true };
      return next;
    });

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const formData = new FormData();
      // Optimize images before upload (keeps quality, reduces size)
      const optimized = await optimizeUploadFile(fileToUpload);
      const finalFile = optimized.file;

      formData.append('file', finalFile);
      formData.append('photo_type', effectiveType);
      formData.append('photo_category', 'before');

      if (effectiveType === 'BEFORE_DASHBOARD' && odometerReading) {
        formData.append('odometer_reading', odometerReading);
      }

      if (location) {
        formData.append('latitude', location.latitude.toString());
        formData.append('longitude', location.longitude.toString());
      }

      const endpoint =
        mode === 'LEAD_MEDIA'
          ? `/api/leads/${leadId}/upload-pickup-visit-photos`
          : `/api/mechanic/jobs/${leadId}/upload-photos`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      // Check if response is JSON before parsing
      const contentType = response.headers.get('content-type');
      let result: any;
      
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        // If not JSON, get text response
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        console.error('Upload error response:', result);
        throw new Error(result.details || result.error || 'Failed to upload photo');
      }

      setPhotos((prev) => {
        const next = [...prev];
        if (!next[index]) return prev;
        next[index] = { ...next[index], uploading: false, uploaded: true };
        return next;
      });
      toast.success(`${effectiveLabel} uploaded successfully`);
      onUploadComplete();
    } catch (error: any) {
      setPhotos((prev) => {
        const next = [...prev];
        if (!next[index]) return prev;
        next[index] = { ...next[index], uploading: false };
        return next;
      });
      toast.error(error.message || 'Failed to upload photo');
    }
  };

  const validateOdometer = () => {
    const n = Number(String(odometerReading || '').trim());
    return Number.isFinite(n) && n > 0;
  };

  const bulkNeedsOdometer = () => {
    return bulkPicked.some((x) => String(x.assignedType || '').trim() === 'BEFORE_DASHBOARD');
  };

  const photoTypeOptions = REQUIRED_PHOTOS.map((p) => ({ type: p.type, label: p.label }));

  const getSlotIndexByType = (t: string) => {
    const current = photosRef.current.length ? photosRef.current : photos;
    return current.findIndex((p) => p.type === t);
  };

  const isTypeAvailable = (t: string) => {
    const idx = getSlotIndexByType(t);
    if (idx < 0) return false;
    const slot = (photosRef.current.length ? photosRef.current : photos)[idx];
    if (!slot) return false;
    // If already uploaded or uploading, don't allow remap
    if (slot.uploaded || slot.uploading) return false;
    return true;
  };

  const runBulkQueue = async () => {
    if (!bulkQueueRef.current.length) return;
    if (bulkUploadingRef.current) return;

    bulkUploadingRef.current = true;
    setBulkUploading(true);
    try {
      while (bulkQueueRef.current.length) {
        const next = bulkQueueRef.current.shift();
        if (!next) break;
        const { index, file, type, label } = next;

        // skip if slot already uploaded mid-flight
        const slot = photosRef.current[index];
        if (slot?.uploaded) continue;

        // Ensure dashboard has odometer
        if (type === 'BEFORE_DASHBOARD' && !validateOdometer()) {
          // Pause bulk, ask odometer, resume after submit.
          bulkQueueRef.current.unshift({ index, file, type, label });
          setSelectedPhotoIndex(index);
          setShowOdometerModal(true);
          return;
        }

        await uploadPhoto(index, file, type, label);
      }
    } finally {
      bulkUploadingRef.current = false;
      setBulkUploading(false);
    }
  };

  const handleBulkFilesSelected = (files: File[]) => {
    if (!files || files.length === 0) return;
    if (!photosRef.current.length && !photos.length) {
      toast.error('Please wait… loading photo slots');
      return;
    }

    const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100MB
    const valid: File[] = [];
    for (const f of files) {
      if (f.size > MAX_FILE_SIZE) {
        const mb = (f.size / (1024 * 1024)).toFixed(2);
        toast.error(`File too large (${mb}MB). Max 100MB: ${f.name}`);
        continue;
      }
      valid.push(f);
    }
    if (!valid.length) return;

    setBulkPicked(
      valid.map((file, i) => ({
        id: `${Date.now()}-${i}`,
        file,
        previewUrl: URL.createObjectURL(file),
        assignedType: null,
      }))
    );
    setBulkMapOpen(true);
  };

  const startBulkUploadFromMapping = async () => {
    if (!bulkPicked.length) return;

    // Validate mapping
    const missing = bulkPicked.filter((x) => !x.assignedType);
    if (missing.length) {
      toast.error('Please select photo slot for every file');
      return;
    }

    // If Dashboard & Odometer is selected for any file, odometer reading is mandatory
    if (bulkNeedsOdometer() && !validateOdometer()) {
      toast.error('Please enter odometer reading for Dashboard & Odometer photo');
      // This odometer prompt is for bulk mapping, not for a specific slot upload.
      setSelectedPhotoIndex(null);
      setShowOdometerModal(true);
      return;
    }

    const assigned = bulkPicked.map((x) => String(x.assignedType || '').trim()).filter(Boolean);
    const unique = new Set(assigned);
    if (unique.size !== assigned.length) {
      toast.error('Each slot can be selected only once');
      return;
    }

    // Validate availability
    for (const t of assigned) {
      if (!isTypeAvailable(t)) {
        toast.error(`Slot not available: ${photoTypeOptions.find((o) => o.type === t)?.label || t}`);
        return;
      }
      const idx = getSlotIndexByType(t);
      const slot = (photosRef.current.length ? photosRef.current : photos)[idx];
      if (slot?.file && !slot.uploaded) {
        toast.error(`Slot already has a selected file: ${slot.label}. Remove it first.`);
        return;
      }
    }

    // Build queue + set previews
    const queue: Array<{ index: number; file: File; type: string; label: string }> = [];
    for (const item of bulkPicked) {
      const t = item.assignedType!;
      const idx = getSlotIndexByType(t);
      const label = photoTypeOptions.find((o) => o.type === t)?.label || t;
      setSlotFile(idx, item.file);
      queue.push({ index: idx, file: item.file, type: t, label });
    }

    bulkQueueRef.current = [...bulkQueueRef.current, ...queue];
    setBulkMapOpen(false);
    cleanupBulkPickedPreviews();
    toast.success(`Uploading ${queue.length} files…`);
    await runBulkQueue();
  };

  const handleOdometerSubmit = () => {
    if (!odometerReading || isNaN(parseFloat(odometerReading))) {
      toast.error('Please enter a valid odometer reading');
      return;
    }
    setShowOdometerModal(false);
    if (selectedPhotoIndex !== null) {
      uploadPhoto(selectedPhotoIndex);
    }
    // If bulk queue was paused waiting for odometer, resume it
    if (bulkQueueRef.current.length) {
      runBulkQueue();
    }
  };

  const removePhoto = (index: number) => {
    setPhotos((prev) => {
      const next = [...prev];
      revokeIfBlobUrl(next[index]?.preview || null);
      next[index] = { ...next[index], file: null, preview: null, uploaded: false };
      return next;
    });
  };

  const requiredCount = photos.filter((p) => p.required).length;
  const uploadedCount = photos.filter((p) => p.required && p.uploaded).length;

  return (
    <div className="space-y-4">
      {/* Pickup/Visit Photos Checklist Indicator */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border-2 border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Camera className="w-6 h-6 text-brand-primary" />
            Pickup/Visit Photos Checklist
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

        {/* Checklist Items Grid */}
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
                  <span>{photo.label.replace(' (Optional)', '')}</span>
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

      {/* Bulk Upload */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-700">
          <span className="font-semibold">Tip:</span> Bulk upload me aap files select karo, phir manual slot select karke upload start karo.
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={bulkInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              // IMPORTANT: copy files BEFORE resetting input value (otherwise FileList can become empty)
              const files = Array.from(e.target.files || []);
              // reset input so selecting same files again triggers onChange
              e.currentTarget.value = '';
              handleBulkFilesSelected(files);
            }}
          />
          <button
            type="button"
            onClick={() => bulkInputRef.current?.click()}
            disabled={bulkUploading || photos.length === 0}
            className={`btn-primary flex items-center gap-2 ${bulkUploading ? 'opacity-60 cursor-not-allowed' : ''}`}
          >
            <Upload className="w-4 h-4" />
            {bulkUploading ? 'Uploading...' : 'Bulk Upload'}
          </button>
        </div>
      </div>

      {/* Bulk Mapping Modal (manual mapping) */}
      {bulkMapOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-3xl w-full p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-800">Map selected files to slots</h3>
              <button
                type="button"
                onClick={() => {
                  setBulkMapOpen(false);
                  cleanupBulkPickedPreviews();
                }}
                className="px-2 py-1 rounded hover:bg-gray-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 max-h-[55vh] overflow-auto pr-1">
              {bulkPicked.map((item, idx) => {
                const assignedTypes = new Set(
                  bulkPicked.map((p) => p.assignedType).filter(Boolean) as string[]
                );
                const currentAssigned = item.assignedType;
                return (
                  <div
                    key={item.id}
                    className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3 border rounded-lg p-3"
                  >
                    <div className="flex items-center gap-3 flex-1 min-w-0">
                      <div className="w-14 h-14 rounded-md overflow-hidden bg-gray-100 border flex-shrink-0">
                        {item.file.type.startsWith('video/') ? (
                          <video
                            src={item.previewUrl}
                            className="w-full h-full object-cover"
                            muted
                            playsInline
                          />
                        ) : (
                          <img
                            src={item.previewUrl}
                            alt={item.file.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-gray-800 truncate">
                          {idx + 1}. {item.file.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          {(item.file.size / (1024 * 1024)).toFixed(2)} MB
                        </div>
                      </div>
                    </div>
                    <div className="w-full md:w-72">
                      <select
                        className="input w-full"
                        value={currentAssigned || ''}
                        onChange={(e) => {
                          const nextType = e.target.value || null;
                          setBulkPicked((prev) =>
                            prev.map((p) => (p.id === item.id ? { ...p, assignedType: nextType } : p))
                          );

                          // If user selects Dashboard & Odometer, ask reading immediately (mandatory)
                          if (nextType === 'BEFORE_DASHBOARD' && !validateOdometer()) {
                            // This prompt is for bulk mapping, not a specific slot upload.
                            setSelectedPhotoIndex(null);
                            setShowOdometerModal(true);
                          }
                        }}
                      >
                        <option value="">Select slot…</option>
                        {photoTypeOptions.map((opt) => {
                          const disabled =
                            !isTypeAvailable(opt.type) ||
                            (assignedTypes.has(opt.type) && opt.type !== currentAssigned);
                          return (
                            <option key={opt.type} value={opt.type} disabled={disabled}>
                              {opt.label}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex justify-end gap-2 mt-4">
              <button
                type="button"
                className="btn-secondary"
                onClick={() => {
                  setBulkMapOpen(false);
                  cleanupBulkPickedPreviews();
                }}
              >
                Cancel
              </button>
              <button type="button" className="btn-primary" onClick={startBulkUploadFromMapping}>
                Start Upload
              </button>
            </div>
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
                {(photo.file?.type.startsWith('video/') || /\.(mp4|webm|ogg|ogv|mov|avi|m4v|3gp|mkv|flv|wmv|mpg|mpeg|m2v|ts|mts|f4v|asf|rm|rmvb|vob)$/i.test(photo.file?.name || '') || /\.(mp4|webm|ogg|ogv|mov|avi|m4v|3gp|mkv|flv|wmv|mpg|mpeg|m2v|ts|mts|f4v|asf|rm|rmvb|vob)$/i.test(photo.preview || '')) ? (
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
                      onClick={() => uploadPhoto(index)}
                      className="flex-1 btn-primary text-sm py-1"
                    >
                      Upload
                    </button>
                    <button
                      onClick={() => removePhoto(index)}
                      className="px-3 py-1 bg-red-500 text-white rounded text-sm hover:bg-red-600"
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

      {/* Odometer Modal */}
      {showOdometerModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <h3 className="text-xl font-bold mb-4 text-brand-primary">Enter Odometer Reading</h3>
            <input
              type="number"
              value={odometerReading}
              onChange={(e) => setOdometerReading(e.target.value)}
              placeholder="Enter odometer reading"
              className="input w-full mb-4"
              autoFocus
            />
            <div className="flex gap-3">
              <button
                onClick={() => setShowOdometerModal(false)}
                className="btn-secondary flex-1"
              >
                Cancel
              </button>
              <button
                onClick={handleOdometerSubmit}
                className="btn-primary flex-1"
              >
                Submit & Upload
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

