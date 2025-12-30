'use client';

import { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, Image as ImageIcon, CheckCircle, ZoomIn, AlertTriangle } from 'lucide-react';

interface PhotoValidationModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadNumber: string;
  onSuccess: () => void;
}

type NormalizedPhoto = {
  id: string;
  url: string;
  category: 'before' | 'during' | 'after' | 'other';
  type?: string | null;
  created_at?: string | null;
  source: 'mechanic_job_photos' | 'lead_media';
};

interface PhotoGroup {
  type: 'BEFORE' | 'DURING' | 'AFTER';
  photos: NormalizedPhoto[];
  required: string[];
  complete: boolean;
}

// Canonical required types (align with mechanic_job_photos + JOB COMPLETE enforcement)
const REQUIRED_BEFORE_TYPES = [
  'BEFORE_FRONT',
  'BEFORE_REAR',
  'BEFORE_LEFT',
  'BEFORE_RIGHT',
  'BEFORE_DASHBOARD',
  'BEFORE_ENGINE_BAY',
];

const REQUIRED_AFTER_TYPES = [
  'AFTER_FRONT',
  'AFTER_REAR',
  'AFTER_LEFT',
  'AFTER_RIGHT',
  'AFTER_ENGINE_BAY',
  'AFTER_OLD_PARTS',
  'AFTER_ODOMETER',
];

const MIN_DURING_COUNT = 1;

function inferSlotKey(row: any): string | null {
  const t = String(row?.photo_type || row?.category || '').trim().toUpperCase();
  if (t) return t;
  const fn = String(row?.file_name || '').trim();
  const m = fn.match(/^(BEFORE_[A-Z0-9_]+|DURING_[A-Z0-9_]+|AFTER_[A-Z0-9_]+)__+/);
  return m?.[1] ? m[1] : null;
}

function inferCategory(row: any, slotKey?: string | null): NormalizedPhoto['category'] {
  const pc = String(row?.photo_category || '').trim().toLowerCase();
  if (pc === 'before' || pc === 'during' || pc === 'after') return pc as any;
  const sk = String(slotKey || '').toUpperCase();
  if (sk.startsWith('BEFORE_')) return 'before';
  if (sk.startsWith('DURING_')) return 'during';
  if (sk.startsWith('AFTER_')) return 'after';
  // Fallback: parse description like "PhotoCategory: before | ..."
  const desc = String(row?.description || '').toLowerCase();
  const m = desc.match(/photocategory:\s*(before|during|after)\b/);
  if (m?.[1] === 'before' || m?.[1] === 'during' || m?.[1] === 'after') return m[1] as any;
  return 'other';
}

export default function PhotoValidationModal({
  isOpen,
  onClose,
  leadId,
  leadNumber,
}: PhotoValidationModalProps) {
  const [photos, setPhotos] = useState<NormalizedPhoto[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<NormalizedPhoto | null>(null);
  const [missing, setMissing] = useState<string[]>([]);
  const [duringCount, setDuringCount] = useState(0);

  useEffect(() => {
    if (isOpen) fetchPhotos();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, leadId]);

  async function fetchPhotos() {
    try {
      setLoading(true);
      const supabase = createClient();

      const { data: jobPhotos, error } = await supabase
        .from('mechanic_job_photos')
        .select('id, photo_url, photo_category, photo_type, created_at')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: true });

      if (error) throw error;

      // Pickup/visit "BEFORE_*" photos are stored in lead_media (schema varies across installs).
      // NOTE: we fetch lead_media via server API to avoid RLS issues for supervisor roles.
      let leadMedia: any[] = [];
      try {
        const res = await fetch(`/api/leads/${leadId}/media`, { method: 'GET' });
        const json = await res.json().catch(() => ({}));
        if (res.ok && Array.isArray((json as any)?.media)) {
          leadMedia = (json as any).media;
        } else if (!res.ok) {
          console.warn('PhotoValidationModal: /api/leads/[id]/media failed:', (json as any)?.error || res.statusText);
        }
      } catch (e) {
        console.warn('PhotoValidationModal: lead media fetch error:', e);
      }

      const normalizedJobPhotos: NormalizedPhoto[] = (jobPhotos || []).map((p: any) => ({
        id: String(p.id),
        url: p.photo_url,
        category:
          p.photo_category === 'before' || p.photo_category === 'during' || p.photo_category === 'after'
          ? p.photo_category
          : 'other',
        type: p.photo_type,
        created_at: p.created_at,
        source: 'mechanic_job_photos',
      }));

      const normalizedLeadMedia: NormalizedPhoto[] = (leadMedia || [])
        .map((m: any) => {
          const slotKey = inferSlotKey(m);
          const url = m.file_url || m.photo_url;
          if (!url) return null;
          return {
            id: String(m.id),
            url,
            category: inferCategory(m, slotKey),
            type: slotKey,
            created_at: m.created_at,
            source: 'lead_media',
          } as NormalizedPhoto;
        })
        .filter(Boolean) as any;

      // Merge + stable sort
      const normalized: NormalizedPhoto[] = [...normalizedJobPhotos, ...normalizedLeadMedia].sort((a, b) => {
        const at = a.created_at ? Date.parse(a.created_at) : 0;
        const bt = b.created_at ? Date.parse(b.created_at) : 0;
        return at - bt;
      });

      setPhotos(normalized);

      const beforeTypes = new Set(normalized.filter(p => p.category === 'before').map(p => p.type).filter(Boolean) as string[]);
      const afterTypes = new Set(normalized.filter(p => p.category === 'after').map(p => p.type).filter(Boolean) as string[]);
      const dCount = normalized.filter(p => p.category === 'during').length;
      setDuringCount(dCount);

      const missingList: string[] = [];
      REQUIRED_BEFORE_TYPES.forEach((t) => { if (!beforeTypes.has(t)) missingList.push(t); });
      REQUIRED_AFTER_TYPES.forEach((t) => { if (!afterTypes.has(t)) missingList.push(t); });
      if (dCount < MIN_DURING_COUNT) missingList.push('DURING_* (at least 1)');
      setMissing(missingList);
    } catch (e) {
      console.error('Error fetching photos:', e);
      setPhotos([]);
      setMissing(['Unable to load photos (check permissions/RLS)']);
      setDuringCount(0);
    } finally {
      setLoading(false);
    }
  }

  const photoGroups: PhotoGroup[] = useMemo(() => {
    const beforePhotos = photos.filter(p => p.category === 'before');
    const duringPhotos = photos.filter(p => p.category === 'during');
    const afterPhotos = photos.filter(p => p.category === 'after');

    const beforeComplete = REQUIRED_BEFORE_TYPES.every(t => beforePhotos.some(p => p.type === t));
    const afterComplete = REQUIRED_AFTER_TYPES.every(t => afterPhotos.some(p => p.type === t));
    const duringComplete = duringPhotos.length >= MIN_DURING_COUNT;

    return [
      { type: 'BEFORE', photos: beforePhotos, required: REQUIRED_BEFORE_TYPES, complete: beforeComplete },
      { type: 'DURING', photos: duringPhotos, required: ['DURING_* (at least 1)'], complete: duringComplete },
      { type: 'AFTER', photos: afterPhotos, required: REQUIRED_AFTER_TYPES, complete: afterComplete },
    ];
  }, [photos]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-2xl font-bold text-text-heading flex items-center gap-2">
              <ImageIcon className="w-6 h-6" />
              Photo Review (QC Proofs)
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Job #{leadNumber} • {photos.length} photos • DURING count: {duringCount}
            </p>
          </div>
          <button onClick={onClose} className="btn btn-outline btn-sm" disabled={loading}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)]">
          {loading && photos.length === 0 ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
            </div>
          ) : photos.length === 0 ? (
            <div className="text-center py-12">
              <AlertTriangle className="w-16 h-16 text-yellow-600 mx-auto mb-4" />
              <p className="text-xl font-semibold text-gray-700">No Photos Found</p>
              <p className="text-gray-600 mt-2">Mechanic hasn&apos;t uploaded photos yet</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Summary */}
              {missing.length > 0 ? (
                <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="font-semibold text-yellow-800">Missing mandatory proofs:</p>
                  <ul className="list-disc ml-5 text-sm text-yellow-800 mt-1">
                    {missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                  <p className="text-sm text-yellow-800 mt-2">
                    Tip: Use <strong>QC Failed</strong> to send job back as <strong>REWORK_REQUIRED</strong>.
                  </p>
                </div>
              ) : (
                <div className="p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-green-700" />
                  <p className="text-sm text-green-800 font-semibold">
                    All mandatory BEFORE/DURING/AFTER proofs are present
                  </p>
                </div>
              )}

              {/* Groups */}
              {photoGroups.map((group) => (
                <div key={group.type} className="card">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="text-lg font-semibold">
                        {group.type === 'BEFORE'
                          ? `Pickup/Visit Photos (${group.photos.length}/${group.required.length})`
                          : `${group.type} Photos (${group.photos.length}/${group.required.length})`}
                      </h3>
                      <p className="text-sm text-gray-600">Required: {group.required.join(', ')}</p>
                    </div>
                    {group.complete ? (
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
                        <div key={photo.id} className="relative rounded-lg overflow-hidden border-2 border-gray-200">
                          <img
                            src={photo.url}
                            alt={photo.type || 'Vehicle photo'}
                            className="w-full h-48 object-cover"
                          />
                          <div className="absolute top-2 right-2">
                            <button
                              onClick={() => setSelectedPhoto(photo)}
                              className="p-2 bg-black bg-opacity-50 hover:bg-opacity-70 rounded-full transition-all"
                            >
                              <ZoomIn className="w-4 h-4 text-white" />
                            </button>
                          </div>
                          <div className="p-3 bg-white">
                            <p className="text-xs text-gray-700 font-semibold">{photo.type || 'UNKNOWN_TYPE'}</p>
                            <p className="text-[11px] text-gray-500 mt-1">{photo.source}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-lg">
                      <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-2" />
                      <p className="text-sm text-gray-600">
                        {group.type === 'BEFORE' ? 'No pickup/visit photos uploaded yet' : `No ${group.type.toLowerCase()} photos uploaded yet`}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Zoom */}
      {selectedPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setSelectedPhoto(null)}
        >
          <div className="relative max-w-5xl w-full max-h-[90vh]">
            <img src={selectedPhoto.url} alt="Zoomed" className="w-full h-full object-contain rounded-lg" />
            <button
              onClick={() => setSelectedPhoto(null)}
              className="absolute top-4 right-4 p-2 bg-white rounded-full shadow-lg"
            >
              <X className="w-5 h-5 text-gray-700" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


