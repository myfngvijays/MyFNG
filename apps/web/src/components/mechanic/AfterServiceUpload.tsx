'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, X, MapPin, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
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
}

const REQUIRED_AFTER_PHOTOS = [
  { type: 'AFTER_FRONT', label: 'Front View (After)', required: true },
  { type: 'AFTER_REAR', label: 'Rear View (After)', required: true },
  { type: 'AFTER_LEFT', label: 'Left Side (After)', required: true },
  { type: 'AFTER_RIGHT', label: 'Right Side (After)', required: true },
  { type: 'AFTER_ENGINE_BAY', label: 'Engine Bay (After)', required: true },
  { type: 'AFTER_OLD_PARTS', label: 'Old Parts Photo', required: true },
  { type: 'AFTER_ODOMETER', label: 'Final Odometer Reading', required: true },
  { type: 'AFTER_NEW_PARTS', label: 'New Parts Installed', required: false },
];

export default function AfterServiceUpload({ leadId, jobId, onUploadComplete }: Props) {
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [odometerReading, setOdometerReading] = useState('');
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [workNotes, setWorkNotes] = useState('');
  const [checklistCompleted, setChecklistCompleted] = useState(false);
  const [partsRecorded, setPartsRecorded] = useState(false);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});

  const revokeIfBlobUrl = (url: string | null) => {
    if (url && url.startsWith('blob:')) {
      try {
        URL.revokeObjectURL(url);
      } catch {
        // ignore
      }
    }
  };

  useEffect(() => {
    initializePhotos();
    getLocation();
    // Only fetch if jobId is valid (not empty)
    if (jobId && jobId.trim() !== '') {
    fetchExistingPhotos();
    fetchJobDetails();
    }
  }, [leadId, jobId]);

  const initializePhotos = () => {
    setPhotos(
      REQUIRED_AFTER_PHOTOS.map((photo) => ({
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

  const fetchJobDetails = async () => {
    // Guard: Don't fetch if jobId is empty or invalid
    if (!jobId || jobId.trim() === '') {
      return;
    }

    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mechanic_jobs')
        .select('*')
        .eq('id', jobId)
        .single();

      if (error) throw error;
      if (data) {
        setChecklistCompleted(data.checklist_completed || false);
        setWorkNotes(data.work_notes || '');

        // Check if parts are recorded
        const { data: partsData } = await supabase
          .from('mechanic_parts_usage')
          .select('id')
          .eq('lead_id', leadId)
          .limit(1);

        setPartsRecorded((partsData?.length || 0) > 0);
      }
    } catch (error) {
      console.error('Error fetching job:', error);
    }
  };

  const fetchExistingPhotos = async () => {
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
        .eq('photo_category', 'after')
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

        // Set odometer reading if exists
        const odometerPhoto = data.find((d) => d.photo_type === 'AFTER_ODOMETER');
        if (odometerPhoto?.odometer_reading) {
          setOdometerReading(odometerPhoto.odometer_reading.toString());
        }
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
    }
  };

  const getLocation = async () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
          });
        },
        () => {
          // Silent fail
        }
      );
    }
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

    const optimized = await optimizeUploadFile(file);
    const actualFile = optimized.file;

    setPhotos((prev) => {
      const next = [...prev];
      revokeIfBlobUrl(next[index]?.preview || null);
      next[index] = {
        ...next[index],
        file: actualFile,
        preview: URL.createObjectURL(actualFile),
        uploaded: false,
      };
      return next;
    });

      // If it's odometer photo, show input
      if (photos[index].type === 'AFTER_ODOMETER') {
        setSelectedPhotoIndex(index);
        setShowOdometerModal(true);
      } else {
        uploadPhoto(index);
      }
  };

  const uploadPhoto = async (index: number) => {
    const photo = photos[index];
    if (!photo.file || photo.uploaded || photo.uploading) return;

    const newPhotos = [...photos];
    newPhotos[index].uploading = true;
    setPhotos(newPhotos);

    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');

      const formData = new FormData();
      formData.append('file', photo.file);
      formData.append('photo_type', photo.type);
      formData.append('photo_category', 'after');

      if (photo.type === 'AFTER_ODOMETER' && odometerReading) {
        formData.append('odometer_reading', odometerReading);
      }

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

      // Check content-type before parsing JSON
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
        throw new Error(result.error || result.details || 'Failed to upload photo');
      }

      newPhotos[index].uploading = false;
      newPhotos[index].uploaded = true;
      setPhotos(newPhotos);
      toast.success(`${photo.label} uploaded successfully`);
      onUploadComplete();
    } catch (error: any) {
      newPhotos[index].uploading = false;
      setPhotos(newPhotos);
      toast.error(error.message || 'Failed to upload photo');
    }
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
  const canComplete = uploadedCount >= requiredCount && checklistCompleted && partsRecorded && workNotes.trim().length > 0;

  return (
    <div className="space-y-4">
      {/* After Service Checklist Indicator - Same style as Before Inspection */}
      <div className="bg-gradient-to-r from-green-50 to-emerald-50 rounded-lg p-5 border-2 border-green-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Camera className="w-6 h-6 text-green-600" />
            After Service Completion Checklist
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
      </div>

      {/* GPS Warning */}
      {!location && (
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

      {/* Requirements Checklist */}
      <div className="bg-gradient-to-r from-gray-50 to-gray-100 rounded-lg p-4 border-2 border-gray-300">
        <h4 className="text-sm font-bold text-gray-800 mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4" />
          Additional Completion Requirements:
        </h4>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className={`flex items-center gap-2 p-2 rounded-lg ${
            checklistCompleted ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'
          }`}>
            {checklistCompleted ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <X className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span className={`text-sm font-semibold ${
              checklistCompleted ? 'text-green-800' : 'text-red-800'
            }`}>
              Checklist Completed
            </span>
          </div>
          <div className={`flex items-center gap-2 p-2 rounded-lg ${
            partsRecorded ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'
          }`}>
            {partsRecorded ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <X className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span className={`text-sm font-semibold ${
              partsRecorded ? 'text-green-800' : 'text-red-800'
            }`}>
              Parts Recorded
            </span>
          </div>
          <div className={`flex items-center gap-2 p-2 rounded-lg ${
            workNotes.trim().length > 0 ? 'bg-green-50 border border-green-300' : 'bg-red-50 border border-red-300'
          }`}>
            {workNotes.trim().length > 0 ? (
              <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0" />
            ) : (
              <X className="w-5 h-5 text-red-600 flex-shrink-0" />
            )}
            <span className={`text-sm font-semibold ${
              workNotes.trim().length > 0 ? 'text-green-800' : 'text-red-800'
            }`}>
              Work Notes Entered
            </span>
          </div>
        </div>
      </div>

      {/* Work Notes Input */}
      <div className="bg-white rounded-lg p-4 border border-gray-200">
        <label className="block text-sm font-semibold text-gray-700 mb-2">
          Work Notes <span className="text-red-500">*</span>
        </label>
        <textarea
          value={workNotes}
          onChange={(e) => setWorkNotes(e.target.value)}
          className="input w-full"
          rows={4}
          placeholder="Enter work notes..."
        />
      </div>

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
            <h3 className="text-xl font-bold mb-4 text-brand-primary">Enter Final Odometer Reading</h3>
            <input
              type="number"
              value={odometerReading}
              onChange={(e) => setOdometerReading(e.target.value)}
              placeholder="Enter final odometer reading"
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

