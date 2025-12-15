'use client';

import { useEffect, useMemo, useRef } from 'react';

declare global {
  interface Window {
    __maplibreLoader?: Promise<void>;
    maplibregl?: any;
  }
}

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

function loadMapLibre() {
  if (typeof window === 'undefined') return Promise.resolve();
  if (window.maplibregl) return Promise.resolve();
  if (window.__maplibreLoader) return window.__maplibreLoader;

  window.__maplibreLoader = new Promise<void>((resolve, reject) => {
    // CSS
    const cssId = 'maplibre-css';
    if (!document.getElementById(cssId)) {
      const link = document.createElement('link');
      link.id = cssId;
      link.rel = 'stylesheet';
      link.href = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.css';
      document.head.appendChild(link);
    }

    // JS
    const scriptId = 'maplibre-js';
    const existing = document.getElementById(scriptId) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('Failed to load maplibre-gl')));
      return;
    }

    const script = document.createElement('script');
    script.id = scriptId;
    script.src = 'https://unpkg.com/maplibre-gl@4.7.1/dist/maplibre-gl.js';
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Failed to load maplibre-gl'));
    document.head.appendChild(script);
  });

  return window.__maplibreLoader;
}

export default function WorkshopMap({ className, center, zoom, markers, onSelect, activeId }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const markerRefs = useRef<Map<string, any>>(new Map());

  const normalizedMarkers = useMemo(() => {
    // ensure stable ordering
    return markers.slice().sort((a, b) => a.id.localeCompare(b.id));
  }, [markers]);

  useEffect(() => {
    let destroyed = false;

    async function init() {
      try {
        await loadMapLibre();
        if (destroyed) return;

        const maplibregl = window.maplibregl;
        if (!containerRef.current || !maplibregl) return;

        // Create map once
        if (!mapRef.current) {
          // Google-ish look (Airbnb-like): light road map tiles
          const style = {
            version: 8,
            sources: {
              'carto-tiles': {
                type: 'raster',
                tiles: [
                  'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                  'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                  'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                  'https://d.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
                ],
                tileSize: 256,
                attribution:
                  '© OpenStreetMap contributors © CARTO',
              },
            },
            layers: [
              {
                id: 'carto-base',
                type: 'raster',
                source: 'carto-tiles',
                minzoom: 0,
                maxzoom: 20,
              },
            ],
          };

          const map = new maplibregl.Map({
            container: containerRef.current,
            style,
            center: [center.lng, center.lat],
            zoom,
            attributionControl: false,
          });

          map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
          map.addControl(new maplibregl.AttributionControl({ compact: true }), 'bottom-right');
          mapRef.current = map;
        } else {
          // Keep the map in sync if parent passes new center/zoom (e.g. after parsing map_link).
          const map = mapRef.current;
          map.easeTo({ center: [center.lng, center.lat], zoom, duration: 450 });
        }
      } catch (e) {
        console.error('WorkshopMap init error:', e);
      }
    }

    init();
    return () => {
      destroyed = true;
    };
  }, [center.lat, center.lng, zoom]);

  // Also sync center/zoom on updates (init() may not run if map already created quickly).
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.easeTo({ center: [center.lng, center.lat], zoom, duration: 450 });
  }, [center.lat, center.lng, zoom]);

  // Sync markers
  useEffect(() => {
    const map = mapRef.current;
    const maplibregl = typeof window !== 'undefined' ? window.maplibregl : null;
    if (!map || !maplibregl) return;

    const existing = markerRefs.current;
    const keep = new Set<string>();

    for (const m of normalizedMarkers) {
      keep.add(m.id);
      const current = existing.get(m.id);
      const el = document.createElement('button');
      el.type = 'button';
      el.className = [
        'wfng-pin',
        m.selected || m.id === activeId ? 'wfng-pin--active' : 'wfng-pin--idle',
      ].join(' ');
      el.textContent = m.label;
      el.onclick = () => onSelect(m.id);

      if (!current) {
        const marker = new maplibregl.Marker({ element: el, anchor: 'center' })
          .setLngLat([m.lng, m.lat])
          .addTo(map);
        existing.set(m.id, marker);
      } else {
        // Update element + position
        const dom = current.getElement?.() as HTMLElement | undefined;
        if (dom) {
          dom.className = el.className;
          dom.textContent = m.label;
          (dom as any).onclick = el.onclick;
        }
        current.setLngLat([m.lng, m.lat]);
      }
    }

    // Remove stale markers
    for (const [id, marker] of existing.entries()) {
      if (!keep.has(id)) {
        marker.remove?.();
        existing.delete(id);
      }
    }
  }, [activeId, normalizedMarkers, onSelect]);

  // Fly to active
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !activeId) return;
    const marker = markerRefs.current.get(activeId);
    if (!marker) return;
    const ll = marker.getLngLat?.();
    if (!ll) return;
    map.easeTo({ center: [ll.lng, ll.lat], duration: 550, zoom: Math.max(map.getZoom?.() ?? 12, 12) });
  }, [activeId]);

  return (
    <div className={className}>
      <div ref={containerRef} className="w-full h-full" />
      <style jsx global>{`
        .wfng-pin {
          border-radius: 9999px;
          padding: 8px 12px;
          font-size: 12px;
          font-weight: 800;
          line-height: 1;
          box-shadow: 0 10px 20px rgba(17, 24, 39, 0.12);
          border: 1px solid rgba(229, 231, 235, 1);
          cursor: pointer;
          transform: translateY(0);
          transition: transform 120ms ease, background 120ms ease, color 120ms ease, border-color 120ms ease;
          user-select: none;
          white-space: nowrap;
        }
        .wfng-pin--idle {
          background: rgba(255, 255, 255, 0.96);
          color: #111827;
        }
        .wfng-pin--idle:hover {
          background: #111827;
          color: white;
          border-color: #111827;
          transform: translateY(-1px);
        }
        .wfng-pin--active {
          background: #111827;
          color: white;
          border-color: #111827;
          transform: translateY(-1px) scale(1.03);
        }
      `}</style>
    </div>
  );
}


