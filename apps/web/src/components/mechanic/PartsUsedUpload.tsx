'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, MapPin, AlertTriangle, CheckCircle, Package } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface PhotoState {
  type: string;
  label: string;
  partId?: string;
  partName?: string;
  file: File | null;
  preview: string | null;
  uploaded: boolean;
  uploading: boolean;
  required: boolean;
}

interface Part {
  id: string;
  part_name: string;
  part_code?: string;
}

interface Props {
  leadId: string;
  jobId: string;
  onUploadComplete: () => void;
}

export default function PartsUsedUpload({ leadId, jobId, onUploadComplete }: Props) {
  const [photos, setPhotos] = useState<PhotoState[]>([]);
  const [parts, setParts] = useState<Part[]>([]);
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [gpsWarning, setGpsWarning] = useState(false);
  const [partsRecorded, setPartsRecorded] = useState(false);
  const fileInputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});

  useEffect(() => {
    getLocation();
    if (jobId) {
      fetchParts();
      checkPartsRecorded();
    }
  }, [leadId, jobId]);

  const fetchParts = async () => {
    try {
      const supabase = createClient();
      // Fetch all parts for the lead, filter client-side if needed
      const { data, error } = await supabase
        .from('mechanic_parts_usage')
        .select('id, part_name, part_code')
        .eq('lead_id', leadId);

      if (error) throw error;

      if (data && data.length > 0) {
        setParts(data);
        initializePhotosFromParts(data);
        fetchExistingPhotos(data);
      } else {
        setPhotos([]);
      }
    } catch (error) {
      console.error('Error fetching parts:', error);
      toast.error('Failed to fetch parts');
    }
  };

  const initializePhotosFromParts = (partsList: Part[]) => {
    const newPhotos: PhotoState[] = [];
    
    partsList.forEach((part) => {
      // For each part, add old part removed and new part installed photos
      newPhotos.push({
        type: 'DURING_PART_REMOVAL',
        label: `${part.part_name} - Old Part Removed`,
        partId: part.id,
        partName: part.part_name,
        file: null,
        preview: null,
        uploaded: false,
        uploading: false,
        required: true,
      });
      
      newPhotos.push({
        type: 'DURING_PART_INSTALL',
        label: `${part.part_name} - New Part Installed`,
        partId: part.id,
        partName: part.part_name,
        file: null,
        preview: null,
        uploaded: false,
        uploading: false,
        required: true,
      });
    });

    // Add general old parts photo (after service)
    newPhotos.push({
      type: 'AFTER_OLD_PARTS',
      label: 'All Old Parts Photo',
      file: null,
      preview: null,
      uploaded: false,
      uploading: false,
      required: true,
    });

    setPhotos(newPhotos);
  };

  const fetchExistingPhotos = async (partsList: Part[]) => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mechanic_job_photos')
        .select('*')
        .eq('job_id', jobId)
        .in('photo_type', ['DURING_PART_REMOVAL', 'DURING_PART_INSTALL', 'AFTER_OLD_PARTS'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data && data.length > 0) {
        setPhotos((prevPhotos) =>
          prevPhotos.map((photo) => {
            // Match by part_id if available, or by type
            const existing = data.find((d) => {
              if (photo.partId && d.part_id) {
                return d.part_id === photo.partId && d.photo_type === photo.type;
              }
              return d.photo_type === photo.type && !photo.partId;
            });
            
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

  const checkPartsRecorded = async () => {
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('mechanic_parts_usage')
        .select('id')
        .eq('lead_id', leadId)
        .limit(1);

      if (!error && data && data.length > 0) {
        setPartsRecorded(true);
      }
    } catch (error) {
      console.error('Error checking parts:', error);
    }
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

  const handleFileSelect = (photoKey: string, file: File | null) => {
    if (!file) return;

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

    const reader = new FileReader();
    reader.onloadend = () => {
      setPhotos((prev) =>
        prev.map((photo) => {
          const key = photo.partId ? `${photo.type}_${photo.partId}` : photo.type;
          if (key === photoKey) {
            return {
              ...photo,
              file,
              preview: reader.result as string,
              uploaded: false,
            };
          }
          return photo;
        })
      );
    };
    reader.readAsDataURL(file);
  };

  const handleUpload = async (photoKey: string) => {
    const photo = photos.find((p) => {
      const key = p.partId ? `${p.type}_${p.partId}` : p.type;
      return key === photoKey;
    });

    if (!photo || !photo.file || !photo.preview) {
      toast.error('Please select a photo first');
      return;
    }

    setPhotos((prev) =>
      prev.map((p) => {
        const key = p.partId ? `${p.type}_${p.partId}` : p.type;
        return key === photoKey ? { ...p, uploading: true } : p;
      })
    );

    try {
      const formData = new FormData();
      formData.append('file', photo.file);
      formData.append('photoType', photo.type);
      const category = photo.type.startsWith('AFTER_') ? 'after' : 'during';
      formData.append('photoCategory', category);
      if (photo.partId) {
        formData.append('partId', photo.partId);
      }
      if (location) {
        formData.append('latitude', location.latitude.toString());
        formData.append('longitude', location.longitude.toString());
      }

      // Get session token for authorization
      const supabase = createClient();
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError || !session?.access_token) {
        throw new Error('Authentication failed. Please login again.');
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

      // Check if response is ok
      if (!response.ok) {
        throw new Error(result.error || result.details || 'Upload failed');
      }

      // Double check for error in response body
      if (result.error) {
        throw new Error(result.error || result.details || 'Upload failed');
      }

      setPhotos((prev) =>
        prev.map((p) => {
          const key = p.partId ? `${p.type}_${p.partId}` : p.type;
          return key === photoKey
            ? {
                ...p,
                uploaded: true,
                uploading: false,
              }
            : p;
        })
      );

      toast.success(`${photo.label} uploaded successfully`);
      onUploadComplete();
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error(error.message || 'Failed to upload photo');
      setPhotos((prev) =>
        prev.map((p) => {
          const key = p.partId ? `${p.type}_${p.partId}` : p.type;
          return key === photoKey ? { ...p, uploading: false } : p;
        })
      );
    }
  };

  const handleRemove = (photoKey: string) => {
    setPhotos((prev) =>
      prev.map((photo) => {
        const key = photo.partId ? `${photo.type}_${photo.partId}` : photo.type;
        if (key === photoKey) {
          return {
            ...photo,
            file: null,
            preview: null,
            uploaded: false,
          };
        }
        return photo;
      })
    );
  };

  const requiredUploaded = photos.filter((p) => p.required && p.uploaded).length;
  const requiredCount = photos.filter((p) => p.required).length;
  const totalUploaded = photos.filter((p) => p.uploaded).length;

  return (
    <div className="space-y-4">
      {/* Parts Used Checklist Indicator - Same style as Before Inspection */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-5 border-2 border-indigo-200">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-bold text-gray-800 flex items-center gap-2">
            <Package className="w-6 h-6 text-indigo-600" />
            Parts Used Checklist {parts.length > 0 && `(${parts.length} ${parts.length === 1 ? 'Part' : 'Parts'})`}
          </h4>
          {requiredCount > 0 && (
            <div className={`px-4 py-2 rounded-full font-bold ${
              requiredUploaded >= requiredCount 
                ? 'bg-green-100 text-green-700 border-2 border-green-300' 
                : 'bg-orange-100 text-orange-700 border-2 border-orange-300'
            }`}>
              {requiredUploaded} / {requiredCount}
            </div>
          )}
        </div>
        
        {/* Progress Bar - Only show if there are required photos */}
        {requiredCount > 0 && (
          <div className="mb-4">
            <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  requiredUploaded >= requiredCount ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-orange-500 to-orange-600'
                }`}
                style={{ width: `${Math.min((requiredUploaded / requiredCount) * 100, 100)}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-600">
              <span>{requiredUploaded >= requiredCount ? '✅ Complete' : '⏳ In Progress'}</span>
              <span>{Math.round((requiredUploaded / requiredCount) * 100)}%</span>
            </div>
          </div>
        )}

        {/* Show message if no parts */}
        {parts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
            <p className="text-sm">No parts recorded. Record parts in the "Parts" tab to upload photos.</p>
          </div>
        )}

        {/* Checklist Items Grid - Same style as Before Inspection */}
        {photos.filter(p => p.required).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {photos.filter(p => p.required).map((photo, index) => (
            <div
              key={photo.partId ? `${photo.type}_${photo.partId}` : photo.type}
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
        )}
      </div>

      {/* Parts Recorded Warning - Only show if parts exist but not recorded */}
      {!partsRecorded && parts.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            ⚠️ Please record parts usage in the "Parts" tab before uploading photos
          </p>
        </div>
      )}

      {/* Parts Recorded Warning */}
      {!partsRecorded && parts.length > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-3 rounded">
          <p className="text-sm text-yellow-800 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            ⚠️ Please record parts usage in the "Parts" tab before uploading photos
          </p>
        </div>
      )}

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
        {photos.map((photo, index) => {
          const photoKey = photo.partId ? `${photo.type}_${photo.partId}` : photo.type;
          return (
            <div
              key={photoKey}
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
                        onClick={() => handleUpload(photoKey)}
                        className="flex-1 btn-primary text-sm py-1 cursor-pointer"
                      >
                        Upload
                      </button>
                      <button
                        onClick={() => handleRemove(photoKey)}
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
                  onClick={() => fileInputRefs.current[photoKey]?.click()}
                >
                  <input
                    ref={(el) => { fileInputRefs.current[photoKey] = el; }}
                    type="file"
                    accept="image/*,video/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleFileSelect(photoKey, file);
                    }}
                  />
                  <Camera className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">Click to Upload</p>
                  <p className="text-xs text-gray-400 mt-1">or drag & drop</p>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
