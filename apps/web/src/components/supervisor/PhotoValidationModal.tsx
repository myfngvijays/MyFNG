'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Image as ImageIcon, CheckCircle, XCircle, ZoomIn, AlertTriangle } from 'lucide-react';

interface PhotoValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadNumber: string;
  onSuccess: () => void;
}

interface PhotoGroup {
  type: 'BEFORE' | 'DURING' | 'AFTER';
  photos: any[];
  required: string[];
  validated: boolean;
}

const REQUIRED_BEFORE_PHOTOS = [
  'Front view',
  'Rear view',
  'Left side',
  'Right side',
  'Dashboard/Odometer',
  'Engine bay',
  'Existing damage'
];

const REQUIRED_DURING_PHOTOS = [
  'Work in progress',
  'Parts being replaced',
  'Old vs New parts comparison'
];

const REQUIRED_AFTER_PHOTOS = [
  'Front view (clean)',
  'Rear view (clean)',
  'Engine bay (clean)',
  'Dashboard/Final odometer',
  'Replaced parts',
  'Work completed area'
];

export default function PhotoValidationModal({
  isOpen,
  onClose,
  leadId,
  leadNumber,
  onSuccess
}: PhotoValidationModalProps) {
  const [photos, setPhotos] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<any | null>(null);
  const [validation, setValidation] = useState<Record<string, boolean>>({});
  const [rejectionReasons, setRejectionReasons] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      fetchPhotos();
    }
  }, [isOpen, leadId]);

  async function fetchPhotos() {
    try {
      setLoading(true);
      const supabase = createClient();

      // Fetch all photos for this lead
      const { data, error } = await supabase
        .from('lead_media')
        .select('*')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (error) throw error;
      setPhotos(data || []);

      // Initialize validation state
      const initialValidation: Record<string, boolean> = {};
      (data || []).forEach(photo => {
        initialValidation[photo.id] = true; // Default to approved
      });
      setValidation(initialValidation);
    } catch (error) {
      console.error('Error fetching photos:', error);
    } finally {
      setLoading(false);
    }
  }

  function groupPhotosByType(): PhotoGroup[] {
    const beforePhotos = photos.filter(p => p.media_type === 'BEFORE' || p.photo_type === 'BEFORE');
    const duringPhotos = photos.filter(p => p.media_type === 'DURING' || p.media_type === 'PROGRESS' || p.photo_type === 'DURING');
    const afterPhotos = photos.filter(p => p.media_type === 'AFTER' || p.photo_type === 'AFTER');

    return [
      {
        type: 'BEFORE',
        photos: beforePhotos,
        required: REQUIRED_BEFORE_PHOTOS,
        validated: beforePhotos.length >= REQUIRED_BEFORE_PHOTOS.length
      },
      {
        type: 'DURING',
        photos: duringPhotos,
        required: REQUIRED_DURING_PHOTOS,
        validated: duringPhotos.length >= REQUIRED_DURING_PHOTOS.length
      },
      {
        type: 'AFTER',
        photos: afterPhotos,
        required: REQUIRED_AFTER_PHOTOS,
        validated: afterPhotos.length >= REQUIRED_AFTER_PHOTOS.length
      }
    ];
  }

  function togglePhotoValidation(photoId: string) {
    setValidation(prev => ({
      ...prev,
      [photoId]: !prev[photoId]
    }));
  }

  async function submitValidation() {
    try {
      setLoading(true);
      const supabase = createClient();

      // Get current user
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      const supervisorId = userProfile?.id;

      // Update validation status for each photo
      for (const [photoId, isApproved] of Object.entries(validation)) {
        const reason = rejectionReasons[photoId] || null;
        
        await supabase
          .from('lead_media')
          .update({
            validation_status: isApproved ? 'APPROVED' : 'REJECTED',
            validated_by: supervisorId,
            validated_at: new Date().toISOString(),
            rejection_reason: reason
          })
          .eq('id', photoId);
      }

      // Create supervisor action
      const rejectedCount = Object.values(validation).filter(v => !v).length;
      await supabase
        .from('supervisor_actions')
        .insert({
          supervisor_id: supervisorId,
          lead_id: leadId,
          action_type: 'PHOTOS_VALIDATED',
          action_description: `Validated ${photos.length} photos. ${rejectedCount} rejected.`,
          action_data: {
            total_photos: photos.length,
            approved: photos.length - rejectedCount,
            rejected: rejectedCount
          }
        });

      // If any photos rejected, send back to mechanic
      if (rejectedCount > 0) {
        await supabase
          .from('service_leads')
          .update({
            status: 'PHOTOS_REJECTED',
            photo_rejection_notes: Object.entries(rejectionReasons)
              .filter(([id]) => !validation[id])
              .map(([_, reason]) => reason)
              .join('; ')
          })
          .eq('id', leadId);
      }

      alert(`Photo validation completed. ${rejectedCount} photo(s) rejected.`);
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error submitting validation:', error);
      alert('Failed to submit validation');
    } finally {
      setLoading(false);
    }
  }

  const photoGroups = groupPhotosByType();
  const allPhotosValidated = photos.length > 0 && Object.keys(validation).length === photos.length;
  const hasRejections = Object.values(validation).some(v => !v);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-text-heading flex items-center gap-2">
              <ImageIcon className="w-6 h-6" />
              Photo Validation
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Job #{leadNumber} • {photos.length} photos to review
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-outline btn-sm"
            disabled={loading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {loading && photos.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
              <p className="text-xl font-semibold text-gray-700">No Photos Found</p>
              <p className="text-gray-600 mt-2">Mechanic hasn't uploaded any photos yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Photo Groups */}
              {photoGroups.map((group) => (
                <div key={group.type} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {group.type} Photos ({group.photos.length}/{group.required.length})
                      </h3>
                      <p className="text-sm text-gray-600">Required: {group.required.join(', ')}</p>
                    </div>
                    {group.validated ? (
                      <div className="flex items-center gap-2 px-3 py-1 bg-green-100 text-green-700 rounded-full">
                        <CheckCircle className="w-4 h-4" />
                        <span className="text-sm font-semibold">Complete</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="text-sm font-semibold">Incomplete</span>
                      </div>
                    )}
                  </div>

                  {group.photos.length > 0 ? (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      {group.photos.map((photo) => (
                        <div 
                          key={photo.id}
                          className={`relative rounded-lg overflow-hidden border-2 ${
                            validation[photo.id] 
                              ? 'border-green-500' 
                              : 'border-red-500'
                          }`}
                        >
                          {/* Photo */}
                          <img
                            src={photo.file_url}
                            alt={photo.description || 'Vehicle photo'}
                            className="w-full h-48 object-cover"
                          />

                          {/* Overlay with zoom button */}
                          <div className="absolute top-2 right-2">
                            <button
                              onClick={() => setSelectedPhoto(photo)}
                              className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-all"
                            >
                              <ZoomIn className="w-4 h-4 text-white" />
                            </button>
                          </div>

                          {/* Validation Badge */}
                          <div className="absolute top-2 left-2">
                            {validation[photo.id] ? (
                              <div className="p-2 bg-green-500 rounded-full">
                                <CheckCircle className="w-4 h-4 text-white" />
                              </div>
                            ) : (
                              <div className="p-2 bg-red-500 rounded-full">
                                <XCircle className="w-4 h-4 text-white" />
                              </div>
                            )}
                          </div>

                          {/* Photo Info */}
                          <div className="p-3 bg-white">
                            <p className="text-xs text-gray-600 mb-2">
                              {photo.description || 'No description'}
                            </p>
                            
                            {/* Approve/Reject Buttons */}
                            <div className="flex gap-2">
                              <button
                                onClick={() => {
                                  setValidation(prev => ({ ...prev, [photo.id]: true }));
                                  setRejectionReasons(prev => {
                                    const updated = { ...prev };
                                    delete updated[photo.id];
                                    return updated;
                                  });
                                }}
                                className={`flex-1 px-2 py-1 text-xs rounded ${
                                  validation[photo.id]
                                    ? 'bg-green-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-green-100'
                                }`}
                              >
                                ✓ Approve
                              </button>
                              <button
                                onClick={() => togglePhotoValidation(photo.id)}
                                className={`flex-1 px-2 py-1 text-xs rounded ${
                                  !validation[photo.id]
                                    ? 'bg-red-600 text-white'
                                    : 'bg-gray-200 text-gray-700 hover:bg-red-100'
                                }`}
                              >
                                ✗ Reject
                              </button>
                            </div>

                            {/* Rejection Reason */}
                            {!validation[photo.id] && (
                              <textarea
                                placeholder="Reason for rejection..."
                                value={rejectionReasons[photo.id] || ''}
                                onChange={(e) => setRejectionReasons(prev => ({
                                  ...prev,
                                  [photo.id]: e.target.value
                                }))}
                                className="input input-sm w-full mt-2"
                                rows={2}
                              />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">No {group.type.toLowerCase()} photos uploaded yet</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        {photos.length > 0 && (
          <div className="p-6 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                {hasRejections && (
                  <p className="text-sm text-orange-600 font-semibold">
                    ⚠️ Some photos will be rejected. Job will be sent back to mechanic.
                  </p>
                )}
              </div>
              <div className="flex gap-3">
                <button
                  onClick={onClose}
                  className="btn btn-outline"
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  onClick={submitValidation}
                  disabled={loading || !allPhotosValidated}
                  className="btn btn-primary flex items-center gap-2"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <CheckCircle className="w-4 h-4" />
                      Submit Validation
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Photo Zoom Modal */}
      {selectedPhoto && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-5xl max-h-[90vh]">
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute -top-12 right-0 text-white hover:text-gray-300"
            >
              <X className="w-8 h-8" />
            </button>
            <img
              src={selectedPhoto.file_url}
              alt={selectedPhoto.description}
              className="max-w-full max-h-[85vh] rounded-lg"
            />
            <div className="mt-4 text-white text-center">
              <p className="text-lg font-semibold">{selectedPhoto.description || 'Vehicle Photo'}</p>
              <p className="text-sm text-gray-300 mt-1">
                Uploaded: {new Date(selectedPhoto.created_at).toLocaleString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

