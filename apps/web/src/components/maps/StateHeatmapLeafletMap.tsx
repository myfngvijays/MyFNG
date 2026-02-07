'use client';

import type { Map as LeafletMap } from 'leaflet';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { CircleMarker, MapContainer, Popup, TileLayer, Tooltip, useMap } from 'react-leaflet';

export type StateHeatmapPoint = {
  id: string;
  name: string;
  lat: number;
  lng: number;
  total: number;
  resolved: number;
  company_profit: number;
};

type Props = {
  className?: string;
  points: StateHeatmapPoint[];
  activeId?: string | null;
  showProfit: boolean;
  onSelect: (id: string) => void;
  onOpenCustomers: (id: string) => void;
};

function FitBounds({ points, activeId }: { points: StateHeatmapPoint[]; activeId?: string | null }) {
  const map = useMap();

  const bounds = useMemo(() => {
    const coords = points
      .map((p) => [p.lat, p.lng] as [number, number])
      .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    if (coords.length === 0) return null;
    return coords;
  }, [points]);

  useEffect(() => {
    if (!bounds || bounds.length === 0) return;
    if (activeId) return; // keep user's chosen center
    // @ts-expect-error Leaflet types accept (LatLngTuple[])
    map.fitBounds(bounds, { padding: [20, 20], maxZoom: 5 });
  }, [map, bounds, activeId]);

  return null;
}

function FlyToActive({ points, activeId }: { points: StateHeatmapPoint[]; activeId?: string | null }) {
  const map = useMap();

  useEffect(() => {
    if (!activeId) return;
    const p = points.find((x) => x.id === activeId);
    if (!p) return;
    map.flyTo([p.lat, p.lng], Math.max(map.getZoom(), 5), { duration: 0.6 });
  }, [map, points, activeId]);

  return null;
}

function formatCurrency(value?: number | null) {
  if (!Number.isFinite(value as number)) return '₹0';
  return `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;
}

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

export default function StateHeatmapLeafletMap({
  className,
  points,
  activeId,
  showProfit,
  onSelect,
  onOpenCustomers,
}: Props) {
  const maxTotal = Math.max(1, ...points.map((p) => Number(p.total || 0)));
  const mapRef = useRef<LeafletMap | null>(null);
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);

  // India-ish center, used as fallback
  const center: [number, number] = [22.9734, 78.6569];

  // Fix for Next dev + fast refresh:
  // Sometimes the previous Leaflet container DOM survives, causing:
  // "Map container is already initialized."
  // We mount the map only after we proactively clear any old Leaflet nodes.
  useLayoutEffect(() => {
    const host = hostRef.current;
    if (host) {
      const old = host.querySelector('.leaflet-container') as any;
      if (old) {
        try {
          if (old._leaflet_id) delete old._leaflet_id;
        } catch {
          // ignore
        }
        try {
          old.innerHTML = '';
        } catch {
          // ignore
        }
      }
      try {
        host.innerHTML = '';
      } catch {
        // ignore
      }
    }
    setReady(true);
    return () => {
      setReady(false);
    };
  }, []);

  // Fix for dev/StrictMode & fast refresh:
  // ensure the Leaflet instance is destroyed, otherwise Leaflet complains
  // "Map container is already initialized."
  useEffect(() => {
    return () => {
      try {
        mapRef.current?.remove();
      } catch {
        // ignore cleanup errors
      } finally {
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div ref={hostRef} className={className}>
      {!ready ? (
        <div className="p-3 text-xs text-gray-500">Loading map…</div>
      ) : (
        <MapContainer
          key="state-heatmap-map"
          center={center}
          zoom={4}
          scrollWheelZoom={false}
          className="w-full h-full"
          whenCreated={(map) => {
            mapRef.current = map;
          }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <FitBounds points={points} activeId={activeId} />
          <FlyToActive points={points} activeId={activeId} />

          {points.map((p) => {
            const t = clamp(Number(p.total || 0) / maxTotal, 0, 1);
            const radius = clamp(6 + Math.sqrt(Math.max(0, p.total)) * 2, 7, 22);
            const isActive = !!activeId && p.id === activeId;
            const color = isActive ? '#2563eb' : '#059669';
            const fillColor = isActive ? '#60a5fa' : '#34d399';
            const fillOpacity = 0.25 + t * 0.45;

            return (
              <CircleMarker
                key={p.id}
                center={[p.lat, p.lng]}
                radius={radius}
                pathOptions={{
                  color,
                  weight: isActive ? 3 : 2,
                  fillColor,
                  fillOpacity,
                }}
                eventHandlers={{
                  click: () => onSelect(p.id),
                }}
              >
                <Tooltip direction="top" offset={[0, -6]} opacity={1} sticky>
                  <div className="text-xs">
                    <b>{p.name}</b> • Total: {p.total} • Solved: {p.resolved}
                  </div>
                </Tooltip>
                <Popup>
                  <div className="space-y-2">
                    <div className="text-sm font-semibold text-gray-900">{p.name}</div>
                    <div className="text-xs text-gray-700">
                      Total: <b>{p.total}</b> • Solved: <b>{p.resolved}</b>
                    </div>
                    <div className="text-xs text-gray-700">
                      Profit:{' '}
                      <b className="text-emerald-700">{showProfit ? formatCurrency(p.company_profit) : '**'}</b>
                    </div>
                    <button
                      type="button"
                      className="btn btn-outline text-xs px-3 py-1.5"
                      onClick={() => onOpenCustomers(p.id)}
                    >
                      Open customers
                    </button>
                  </div>
                </Popup>
              </CircleMarker>
            );
          })}
        </MapContainer>
      )}
    </div>
  );
}

