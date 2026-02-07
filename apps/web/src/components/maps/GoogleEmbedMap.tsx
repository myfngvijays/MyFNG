'use client';

type Props = {
  className?: string;
  center: { lat: number; lng: number };
  zoom: number;
  query?: string; // optional: "India", "Maharashtra", etc.
  overlayLabel?: string; // optional: show label on top of map
};

export default function GoogleEmbedMap({ className, center, zoom, query, overlayLabel }: Props) {
  const safeZoom = Math.max(2, Math.min(18, Math.floor(zoom || 12)));
  const q = String(query || '').trim() || `${center.lat},${center.lng}`;
  const src = `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=${safeZoom}&output=embed`;

  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      <iframe
        title="Google map"
        src={src}
        className="w-full h-full"
        loading="lazy"
        referrerPolicy="no-referrer-when-downgrade"
        style={{ border: 0 }}
        allowFullScreen
      />

      {overlayLabel ? (
        <div className="absolute top-3 left-3 z-10 rounded-full bg-white/95 backdrop-blur border border-gray-200 px-3 py-1 text-xs font-semibold text-gray-900 shadow-sm pointer-events-none">
          {overlayLabel}
        </div>
      ) : null}
    </div>
  );
}

