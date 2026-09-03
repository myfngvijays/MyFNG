'use client';

import { useState, useRef, useEffect } from 'react';
import { Camera, X, CheckCircle, Upload } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import { optimizeUploadFile } from '@/lib/media/optimizeUpload';
import { isDummyWorkshopLead } from '@/lib/workshop/pickupPhotos';

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
  const [location, setLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [workNotes, setWorkNotes] = useState('');
  const [afterVideos, setAfterVideos] = useState<Array<{ id: string; url: string }>>([]);
  const [uploadingVideo, setUploadingVideo] = useState(false);
  const [checklistCompleted, setChecklistCompleted] = useState(false);
  const [partsRecorded, setPartsRecorded] = useState(false);
  const [isDummy, setIsDummy] = useState(false);
  const fileInputRefs = useRef<{ [key: number]: HTMLInputElement | null }>({});
  const photosRef = useRef<PhotoState[]>([]);

  // Bulk upload (manual mapping)
  const bulkInputRef = useRef<HTMLInputElement | null>(null);
  const [bulkMapOpen, setBulkMapOpen] = useState(false);
  const [bulkPicked, setBulkPicked] = useState<
    Array<{ id: string; file: File; previewUrl: string; assignedType: string | null }>
  >([]);
  const bulkQueueRef = useRef<Array<{ index: number; file: File; type: string; label: string }>>([]);
  const [bulkUploading, setBulkUploading] = useState(false);
  const bulkUploadingRef = useRef(false);

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
    photosRef.current = photos;
  }, [photos]);

  useEffect(() => {
    bulkUploadingRef.current = bulkUploading;
  }, [bulkUploading]);

  const cleanupBulkPickedPreviews = () => {
    setBulkPicked((prev) => {
      for (const p of prev) revokeIfBlobUrl(p.previewUrl);
      return [];
    });
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
    if (!jobId || jobId.trim() === '' || String(jobId).startsWith('lead-')) {
      if (leadId) {
        try {
          const supabase = createClient();
          const { data: lead } = await supabase
            .from('service_leads')
            .select('lead_number, created_from, customer_name')
            .eq('id', leadId)
            .maybeSingle();
          if (lead) setIsDummy(isDummyWorkshopLead(lead));
        } catch {
          // ignore
        }
      }
      return;
    }

    try {
      const supabase = createClient();
      const [{ data }, { data: lead }] = await Promise.all([
        supabase.from('mechanic_jobs').select('checklist_completed, work_notes').eq('id', jobId).maybeSingle(),
        leadId
          ? supabase
              .from('service_leads')
              .select('lead_number, created_from, customer_name')
              .eq('id', leadId)
              .maybeSingle()
          : Promise.resolve({ data: null } as any),
      ]);

      if (lead) setIsDummy(isDummyWorkshopLead(lead));
      if (data) {
        setChecklistCompleted(data.checklist_completed || false);
        setWorkNotes(data.work_notes || '');

        const { data: partsData } = await supabase
          .from('mechanic_parts_usage')
          .select('id')
          .eq('lead_id', leadId)
          .limit(1);

        setPartsRecorded((partsData?.length || 0) > 0);
      }
    } catch {
      // ignore — photo upload still works without this row
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
      }

      const { data: videos } = await supabase
        .from('mechanic_job_photos')
        .select('id, photo_url')
        .eq('job_id', jobId)
        .ilike('photo_type', 'AFTER_VIDEO-%')
        .order('created_at', { ascending: false });
      setAfterVideos((videos || []).map((row: any) => ({ id: String(row.id), url: String(row.photo_url) })));
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

    // Set preview immediately; optimization happens right before upload.
    setPhotos((prev) => {
      const next = [...prev];
      revokeIfBlobUrl(next[index]?.preview || null);
      next[index] = {
        ...next[index],
        file,
        preview: URL.createObjectURL(file),
        uploaded: false,
      };
      return next;
    });

    // Always upload directly (no odometer prompt)
    uploadPhoto(index);
  };

  const uploadAfterVideos = async (files: File[]) => {
    if (!files.length || !leadId) return;
    setUploadingVideo(true);
    try {
      const supabase = createClient();
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Not authenticated');
      for (const [index, file] of files.entries()) {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('photo_type', `AFTER_VIDEO-${Date.now()}-${index}`);
        formData.append('photo_category', 'after_video');
        const response = await fetch(`/api/mechanic/jobs/${leadId}/upload-photos`, {
          method: 'POST',
          headers: { Authorization: `Bearer ${session.access_token}` },
          body: formData,
        });
        const json = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(json?.error || 'Failed to upload video');
      }
      await fetchExistingPhotos();
      toast.success('Video uploaded');
      onUploadComplete();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to upload video');
    } finally {
      setUploadingVideo(false);
    }
  };

  const uploadPhoto = async (
    index: number,
    fileOverride?: File,
    typeOverride?: string,
    labelOverride?: string
  ) => {
    const photo = photosRef.current[index];
    const fileToUpload = fileOverride || photo?.file || null;
    const typeToUpload = typeOverride || photo?.type || REQUIRED_AFTER_PHOTOS[index]?.type;
    const labelToUpload = labelOverride || photo?.label || REQUIRED_AFTER_PHOTOS[index]?.label || 'Photo';
    if (!fileToUpload || !typeToUpload) return;
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

      const optimized = await optimizeUploadFile(fileToUpload);
      const actualFile = optimized.file;

      const formData = new FormData();
      formData.append('file', actualFile);
      formData.append('photo_type', typeToUpload);
      formData.append('photo_category', 'after');

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

      setPhotos((prev) => {
        const next = [...prev];
        if (!next[index]) return prev;
        next[index] = { ...next[index], uploading: false, uploaded: true };
        return next;
      });
      toast.success(`${labelToUpload} uploaded successfully`);
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
  const canComplete = isDummy
    ? workNotes.trim().length > 0
    : uploadedCount >= requiredCount && checklistCompleted && partsRecorded && workNotes.trim().length > 0;

  const photoTypeOptions = REQUIRED_AFTER_PHOTOS.map((p) => ({ type: p.type, label: p.label }));

  const getSlotIndexByType = (t: string) => {
    const current = photosRef.current.length ? photosRef.current : photos;
    return current.findIndex((p) => p.type === t);
  };

  const isTypeAvailable = (t: string) => {
    const idx = getSlotIndexByType(t);
    if (idx < 0) return false;
    const slot = (photosRef.current.length ? photosRef.current : photos)[idx];
    if (!slot) return false;
    if (slot.uploaded || slot.uploading) return false;
    if (slot.file && !slot.uploaded) return false;
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

    const missing = bulkPicked.filter((x) => !x.assignedType);
    if (missing.length) {
      toast.error('Please select slot for every file');
      return;
    }

    const assigned = bulkPicked.map((x) => String(x.assignedType || '').trim()).filter(Boolean);
    const unique = new Set(assigned);
    if (unique.size !== assigned.length) {
      toast.error('Each slot can be selected only once');
      return;
    }

    for (const t of assigned) {
      if (!isTypeAvailable(t)) {
        toast.error(`Slot not available: ${photoTypeOptions.find((o) => o.type === t)?.label || t}`);
        return;
      }
    }

    const queue: Array<{ index: number; file: File; type: string; label: string }> = [];
    for (const item of bulkPicked) {
      const t = item.assignedType!;
      const idx = getSlotIndexByType(t);
      const label = photoTypeOptions.find((o) => o.type === t)?.label || t;
      // show preview in tile immediately
      setPhotos((prev) => {
        const next = [...prev];
        if (!next[idx]) return prev;
        revokeIfBlobUrl(next[idx].preview);
        next[idx] = { ...next[idx], file: item.file, preview: URL.createObjectURL(item.file), uploaded: false };
        return next;
      });
      queue.push({ index: idx, file: item.file, type: t, label });
    }

    bulkQueueRef.current = [...bulkQueueRef.current, ...queue];
    setBulkMapOpen(false);
    cleanupBulkPickedPreviews();
    toast.success(`Uploading ${queue.length} files…`);
    await runBulkQueue();
  };

  return (
    <div className="space-y-3">
      {isDummy ? (
        <div className="rounded-lg border border-orange-200 bg-orange-50 px-3 py-2 text-xs text-orange-800">
          Dummy lead — upload from gallery. Checklist / parts not required to complete.
        </div>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2">
        <p className="text-sm font-semibold text-slate-800">
          {uploadedCount}/{requiredCount} after photos
        </p>
        <div className="flex flex-wrap gap-1.5">
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${checklistCompleted || isDummy ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            Checklist
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${partsRecorded || isDummy ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            Parts
          </span>
          <span className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${workNotes.trim() ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'}`}>
            Notes
          </span>
        </div>
      </div>

      {/* Bulk Upload (manual mapping) */}
      <div className="flex items-center justify-between gap-3">
        <div className="text-sm text-gray-700">
          <span className="font-semibold">Tip:</span> Bulk upload me files select karo, phir slot choose karke upload start karo.
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={bulkInputRef}
            type="file"
            accept="image/*,video/*"
            multiple
            className="hidden"
            onChange={(e) => {
              const files = Array.from(e.target.files || []);
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

      <textarea
        value={workNotes}
        onChange={(e) => setWorkNotes(e.target.value)}
        className="input w-full min-h-[72px]"
        rows={2}
        placeholder="Work notes *"
      />

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

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="text-sm font-semibold text-slate-800">Service work videos</p>
        <p className="text-xs text-slate-500 mt-0.5 mb-2">Regular service videos — extra work videos stay on extra work.</p>
        <div className="flex flex-wrap gap-2 items-center">
          {afterVideos.map((clip) => (
            <video key={clip.id} src={clip.url} className="h-20 w-28 rounded-lg object-cover bg-black" controls preload="metadata" />
          ))}
          <label className={`btn btn-outline text-xs ${uploadingVideo ? 'opacity-60' : ''}`}>
            {uploadingVideo ? 'Uploading...' : 'Add video'}
            <input
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              disabled={uploadingVideo}
              onChange={(e) => {
                const files = Array.from(e.target.files || []);
                e.currentTarget.value = '';
                void uploadAfterVideos(files);
              }}
            />
          </label>
        </div>
      </div>

      {/* Bulk Mapping Modal */}
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
                          <video src={item.previewUrl} className="w-full h-full object-cover" muted playsInline />
                        ) : (
                          <img src={item.previewUrl} alt={item.file.name} className="w-full h-full object-cover" />
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
    </div>
  );
}

