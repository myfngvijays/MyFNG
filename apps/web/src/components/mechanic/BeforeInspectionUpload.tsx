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

export default function BeforeInspectionUpload({ leadId, jobId, onUploadComplete }: Props) {
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [odometerReading, setOdometerReading] = useState('');
  const [showOdometerModal, setShowOdometerModal] = useState(false);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
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
        .eq('photo_category', 'before')
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

  const handleFileSelect = (index: number, file: File) => {
    // Accept images with fallback to file extension check for PNG compatibility
    const isImage = file.type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(file.name);
    
    if (!isImage) {
      toast.error('Please select an image file (PNG, JPG, GIF, WebP)');
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const newPhotos = [...photos];
      newPhotos[index].file = file;
      newPhotos[index].preview = reader.result as string;
      setPhotos(newPhotos);

      // If it's dashboard photo, show odometer input
      if (photos[index].type === 'BEFORE_DASHBOARD') {
        setSelectedPhotoIndex(index);
        setShowOdometerModal(true);
      } else {
        uploadPhoto(index);
      }
    };
    reader.readAsDataURL(file);
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
      formData.append('photo_category', 'before');

      if (photo.type === 'BEFORE_DASHBOARD' && odometerReading) {
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

      const result = await response.json();

      if (!response.ok) {
        console.error('Upload error response:', result);
        throw new Error(result.details || result.error || 'Failed to upload photo');
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
    const newPhotos = [...photos];
    newPhotos[index].file = null;
    newPhotos[index].preview = null;
    newPhotos[index].uploaded = false;
    setPhotos(newPhotos);
  };

  const requiredCount = photos.filter((p) => p.required).length;
  const uploadedCount = photos.filter((p) => p.required && p.uploaded).length;

  return (
    <div className="space-y-4">
      {/* Before Inspection Checklist Indicator */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-5 border-2 border-blue-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Camera className="w-6 h-6 text-brand-primary" />
            Before Inspection Checklist
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
                <img
                  src={photo.preview}
                  alt={photo.label}
                  className="w-full h-32 object-cover rounded-lg mb-2"
                />
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
                  accept="image/png,image/jpeg,image/jpg,image/gif,image/webp,image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) handleFileSelect(index, file);
                  }}
                />
                <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                <p className="text-sm text-gray-600">Click to Upload</p>
                <p className="text-xs text-gray-400 mt-1">or drag & drop</p>
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

