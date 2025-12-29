'use client';

import { useMemo } from 'react';

export type WorkshopMapMarker = {
  id: string;
  lat: number;
  lng: number;
  label: string;
  selected?: boolean;
};

type Props = {
  className?: string;
  center: { lat: number; lng: number };
  zoom: number;
  markers: WorkshopMapMarker[];
  onSelect: (id: string) => void;
  activeId?: string | null;
};

export default function WorkshopMap({ className, center, zoom, markers, onSelect, activeId }: Props) {
  // To keep cost low, we use Google Maps "q=lat,lng&output=embed" iframe (no API key).
  // We center on active marker (if present), otherwise fallback to provided center.
  const activeMarker = useMemo(() => {
    if (!activeId) return null;
    return markers.find((m) => m.id === activeId) || null;
  }, [activeId, markers]);

  const target = activeMarker ? { lat: activeMarker.lat, lng: activeMarker.lng } : center;
  const safeZoom = Math.max(2, Math.min(18, Math.floor(zoom || 12)));
  const src = `https://www.google.com/maps?q=${encodeURIComponent(`${target.lat},${target.lng}`)}&z=${safeZoom}&output=embed`;

  return (
    <div className={className}>
      <iframe
        title="Workshops map"
        src={src}
        className="w-full h-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ border: 0 }}
        allowFullScreen
      />

      {/* Low-cost UX: quick jump buttons (still no paid Maps API calls) */}
      {markers.length > 0 ? (
        <div className="absolute top-4 left-4 z-10 flex flex-col gap-2 pointer-events-none">
          <div className="pointer-events-auto rounded-2xl border border-gray-200 bg-white/95 backdrop-blur shadow-lg overflow-hidden">
            <div className="px-3 py-2 text-[11px] font-extrabold text-gray-900 border-b border-gray-100">
              Quick jump
            </div>
            <div className="max-h-44 overflow-y-auto">
              {markers.slice(0, 6).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => onSelect(m.id)}
                  className={[
                    'w-full text-left px-3 py-2 text-xs font-semibold hover:bg-gray-50',
                    m.id === activeId ? 'text-blue-700' : 'text-gray-800',
                  ].join(' ')}
                >
                  {m.label} {m.id === activeId ? '•' : ''}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


