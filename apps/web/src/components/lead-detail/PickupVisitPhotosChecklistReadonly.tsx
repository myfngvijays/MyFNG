import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle, AlertTriangle } from 'lucide-react';

type Slot = { key: string; label: string; required: boolean };

const SLOTS: Slot[] = [
  { key: 'SLOT_1', label: 'Front View', required: true },
  { key: 'SLOT_2', label: 'Rear View', required: true },
  { key: 'SLOT_3', label: 'Left Side', required: true },
  { key: 'SLOT_4', label: 'Right Side', required: true },
  { key: 'SLOT_5', label: 'Dashboard & Odometer', required: true },
  { key: 'SLOT_6', label: 'Engine Bay', required: true },
];

function pickUrl(row: any): string | null {
  const url = row?.photo_url || row?.file_url || row?.url || null;
  return typeof url === 'string' && url.trim() ? url.trim() : null;
}

/**
 * Read-only checklist view for Pickup/Visit photos on Adviser lead view.
 *
 * Source priority:
 * 1) typed slots if present (photo_type OR category contains BEFORE_* slot keys)
 * 2) pickup boy photos (lead_media.category='BEFORE_PICKUP') mapped sequentially into slots
 */
export default function PickupVisitPhotosChecklistReadonly({ leadId }: { leadId: string }) {
  const [loading, setLoading] = useState(true);
  const [media, setMedia] = useState<any[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      try {
        setLoading(true);
        const res = await fetch(`/api/leads/${leadId}/media`, { method: 'GET' });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) setMedia(Array.isArray(data?.media) ? data.media : []);
      } catch {
        if (!cancelled) setMedia([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    if (leadId) run();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  const slotUrls = useMemo(() => {
    // Try to map typed BEFORE_* photos if they exist
    const typedBefore = (media || []).filter((m: any) => {
      const pc = String(m?.photo_category || '').toLowerCase();
      const t = String(m?.photo_type || m?.category || '').toUpperCase();
      return pc === 'before' || t.startsWith('BEFORE_');
    });
    const hasTyped = typedBefore.some((m: any) => {
      const t = String(m?.photo_type || m?.category || '').toUpperCase();
      return t.startsWith('BEFORE_');
    });

    const map: Record<string, { url: string; source: 'typed' | 'pickup' } | null> = {};
    for (const s of SLOTS) map[s.key] = null;

    if (hasTyped) {
      const byType: Record<string, any> = {};
      for (const row of typedBefore) {
        let t = String(row?.photo_type || row?.category || '').trim().toUpperCase();
        if (!t) {
          const fn = String(row?.file_name || '');
          const m = fn.match(/^(BEFORE_[A-Z0-9_]+)__+/);
          if (m?.[1]) t = String(m[1]).toUpperCase();
        }
        if (!t) continue;
        // prefer latest (api sorts desc)
        if (!byType[t]) byType[t] = row;
      }
      const typeToSlot: Record<string, string> = {
        BEFORE_FRONT: 'SLOT_1',
        BEFORE_REAR: 'SLOT_2',
        BEFORE_LEFT: 'SLOT_3',
        BEFORE_RIGHT: 'SLOT_4',
        BEFORE_DASHBOARD: 'SLOT_5',
        BEFORE_ENGINE_BAY: 'SLOT_6',
      };
      for (const [t, slotKey] of Object.entries(typeToSlot)) {
        const row = byType[t];
        const url = row ? pickUrl(row) : null;
        if (url) map[slotKey] = { url, source: 'typed' };
      }
      return map;
    }

    // Fallback: pickup boy "Before Pickup" photos stored as lead_media.category='BEFORE_PICKUP'
    const pickupBefore = (media || [])
      .filter((m: any) => String(m?.category || '').toUpperCase() === 'BEFORE_PICKUP')
      // API sorts desc; display older first for stable slot mapping
      .slice()
      .reverse();

    const urls = pickupBefore.map((r: any) => pickUrl(r)).filter(Boolean) as string[];
    for (let i = 0; i < SLOTS.length; i++) {
      const url = urls[i];
      if (url) map[SLOTS[i].key] = { url, source: 'pickup' };
    }
    return map;
  }, [media]);

  const requiredCount = SLOTS.filter((s) => s.required).length;
  const uploadedCount = SLOTS.filter((s) => s.required && Boolean(slotUrls[s.key]?.url)).length;

  return (
    <div className="card border-2 border-blue-200 bg-blue-50">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
          <Camera className="w-5 h-5 text-brand-primary" />
          Pickup/Visit Photos Checklist
        </h3>
        <div
          className={`px-3 py-1 rounded-full font-bold text-sm ${
            uploadedCount >= requiredCount
              ? 'bg-green-100 text-green-700 border border-green-300'
              : 'bg-orange-100 text-orange-700 border border-orange-300'
          }`}
        >
          {uploadedCount} / {requiredCount}
        </div>
      </div>

      {loading ? (
        <div className="text-sm text-gray-600">Loading photos…</div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {SLOTS.map((slot, idx) => {
              const item = slotUrls[slot.key];
              const url = item?.url || null;
              return (
                <div
                  key={slot.key}
                  className={`flex items-center gap-3 p-3 rounded-lg border-2 transition-all ${
                    url ? 'bg-white border-green-300' : 'bg-white border-orange-200'
                  }`}
                >
                  <div
                    className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center ${
                      url ? 'bg-green-500' : 'bg-orange-200'
                    }`}
                  >
                    {url ? <CheckCircle className="w-5 h-5 text-white" /> : <span className="text-orange-700 font-bold text-sm">{idx + 1}</span>}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-semibold text-gray-800 text-sm truncate">
                        {slot.label} {slot.required ? <span className="text-red-500">*</span> : null}
                      </p>
                      {item?.source === 'pickup' && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 border border-blue-200">
                          Pickup boy
                        </span>
                      )}
                    </div>

                    {url ? (
                      <button
                        type="button"
                        onClick={() => window.open(url, '_blank')}
                        className="mt-2 w-full text-left"
                        title="Open photo"
                      >
                        <img
                          src={url}
                          alt={slot.label}
                          className="w-full h-40 object-cover rounded border border-gray-200 hover:opacity-90 transition"
                        />
                        <p className="text-[11px] text-gray-500 mt-1">Click image to open</p>
                      </button>
                    ) : (
                      <div className="mt-2 h-40 rounded border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center text-xs text-gray-500">
                        No photo uploaded
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {uploadedCount < requiredCount && (
            <div className="mt-3 p-3 rounded-lg bg-yellow-50 border border-yellow-200 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-yellow-600 mt-0.5" />
              <div className="text-xs text-yellow-800">
                Missing required photos. Pickup boy should upload all 6 required Pickup/Visit photos.
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

