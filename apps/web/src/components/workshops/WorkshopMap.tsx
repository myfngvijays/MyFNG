'use client';

import { useEffect, useRef, useMemo, useCallback } from 'react';

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

function pinSvg(color: string, size: number) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${Math.round(size * 1.4)}" viewBox="0 0 24 34">
    <path d="M12 0C5.4 0 0 5.4 0 12c0 9 12 22 12 22s12-13 12-22C24 5.4 18.6 0 12 0z" fill="${color}" stroke="white" stroke-width="1.5"/>
    <circle cx="12" cy="11" r="4.5" fill="white"/>
  </svg>`;
}

function shortLabel(label: string) {
  const cleaned = label.replace(/^My FNG\s*[-–]\s*/i, '').trim();
  if (cleaned.length > 40) return cleaned.substring(0, 38) + '...';
  return cleaned;
}

export default function WorkshopMap({ className, center, zoom, markers, onSelect, activeId }: Props) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersLayerRef = useRef<any>(null);
  const hasFitRef = useRef(false);

  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  const stableOnSelect = useCallback((id: string) => {
    onSelectRef.current(id);
  }, []);

  const activeMarker = useMemo(() => {
    if (!activeId) return null;
    return markers.find((m) => m.id === activeId) || null;
  }, [activeId, markers]);

  useEffect(() => {
    if (!mapRef.current) return;
    let cancelled = false;

    (async () => {
      const L = (await import('leaflet')).default;
      await import('leaflet/dist/leaflet.css');
      if (cancelled || !mapRef.current) return;

      if (!leafletMapRef.current) {
        leafletMapRef.current = L.map(mapRef.current, {
          center: [center.lat, center.lng],
          zoom,
          zoomControl: true,
          attributionControl: false,
        });
        L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', {
          maxZoom: 20,
        }).addTo(leafletMapRef.current);
      }

      const map = leafletMapRef.current;

      if (markersLayerRef.current) {
        markersLayerRef.current.clearLayers();
      } else {
        markersLayerRef.current = L.layerGroup().addTo(map);
      }

      markers.forEach((m) => {
        const isActive = m.id === activeId;
        const size = isActive ? 32 : 24;

        const icon = L.divIcon({
          className: '',
          html: pinSvg(isActive ? '#dc2626' : '#dc2626', size),
          iconSize: [size, Math.round(size * 1.4)],
          iconAnchor: [size / 2, Math.round(size * 1.4)],
        });

        const marker = L.marker([m.lat, m.lng], {
          icon,
          zIndexOffset: isActive ? 1000 : 0,
        });

        marker.bindTooltip(shortLabel(m.label), {
          permanent: true,
          direction: 'right',
          offset: [12, -16],
          className: isActive ? 'ws-label ws-label-active' : 'ws-label',
        });

        marker.on('click', () => stableOnSelect(m.id));
        markersLayerRef.current.addLayer(marker);
      });

      if (activeMarker) {
        map.setView([activeMarker.lat, activeMarker.lng], Math.max(map.getZoom(), 13), { animate: true });
      } else if (markers.length > 0 && !hasFitRef.current) {
        const bounds = L.latLngBounds(markers.map((m) => [m.lat, m.lng] as [number, number]));
        map.fitBounds(bounds, { padding: [40, 40], maxZoom: 13 });
        hasFitRef.current = true;
      }
    })();

    return () => { cancelled = true; };
  }, [markers, activeId, activeMarker, center, zoom, stableOnSelect]);

  useEffect(() => {
    return () => {
      if (leafletMapRef.current) {
        leafletMapRef.current.remove();
        leafletMapRef.current = null;
        hasFitRef.current = false;
      }
    };
  }, []);

  return (
    <div className={className}>
      <div ref={mapRef} className="w-full h-full" />
      <style jsx global>{`
        .ws-label {
          background: white !important;
          border: 1px solid #d1d5db !important;
          border-radius: 6px !important;
          padding: 2px 6px !important;
          font-family: 'Poppins', sans-serif !important;
          font-size: 10px !important;
          font-weight: 600 !important;
          color: #1e3a5f !important;
          box-shadow: 0 1px 4px rgba(0,0,0,0.15) !important;
          white-space: nowrap !important;
          max-width: 200px !important;
          overflow: hidden !important;
          text-overflow: ellipsis !important;
        }
        .ws-label::before {
          border-right-color: #d1d5db !important;
        }
        .ws-label-active {
          background: #2563eb !important;
          color: white !important;
          border-color: #2563eb !important;
          font-weight: 700 !important;
          z-index: 999 !important;
        }
        .ws-label-active::before {
          border-right-color: #2563eb !important;
        }
        .leaflet-container { font-family: 'Poppins', sans-serif; }
        .leaflet-tooltip-left.ws-label::before { border-left-color: #d1d5db !important; }
        .leaflet-tooltip-left.ws-label-active::before { border-left-color: #2563eb !important; }
      `}</style>
    </div>
  );
}
