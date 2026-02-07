'use client';

import { useMemo, useState } from 'react';
import { CircleF, GoogleMap, InfoWindowF, useJsApiLoader } from '@react-google-maps/api';

export type GoogleStateHeatmapPoint = {
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
  apiKey: string;
  points: GoogleStateHeatmapPoint[];
  activeId?: string | null;
  showProfit: boolean;
  onSelect: (id: string) => void;
  onOpenCustomers: (id: string) => void;
};

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatCurrency(value?: number | null) {
  if (!Number.isFinite(value as number)) return '₹0';
  return `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;
}

function colorByIntensity(t: number) {
  // t: 0..1 (low -> high). Green scale.
  const tt = clamp(t, 0, 1);
  const hue = 145; // green
  const sat = 70;
  const light = 90 - tt * 40; // 90 -> 50
  const fill = `hsl(${hue} ${sat}% ${light}%)`;
  const stroke = `hsl(${hue} ${sat}% ${Math.max(30, light - 20)}%)`;
  return { fill, stroke };
}

export default function GoogleStateHeatmapMap({
  className,
  apiKey,
  points,
  activeId,
  showProfit,
  onSelect,
  onOpenCustomers,
}: Props) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'myfng-google-maps',
    googleMapsApiKey: apiKey,
  });

  const maxTotal = useMemo(() => Math.max(1, ...points.map((p) => Number(p.total || 0))), [points]);
  const [infoId, setInfoId] = useState<string>('');

  const center = useMemo(() => {
    if (activeId) {
      const p = points.find((x) => x.id === activeId);
      if (p) return { lat: p.lat, lng: p.lng };
    }
    // India center fallback
    return { lat: 22.9734, lng: 78.6569 };
  }, [points, activeId]);

  const infoPoint = useMemo(() => points.find((p) => p.id === infoId) || null, [points, infoId]);

  if (!apiKey) {
    return <div className={className} />;
  }
  if (loadError) {
    return <div className={['p-3 text-xs text-red-600', className].filter(Boolean).join(' ')}>Map failed to load.</div>;
  }
  if (!isLoaded) {
    return <div className={['p-3 text-xs text-gray-500', className].filter(Boolean).join(' ')}>Loading map…</div>;
  }

  return (
    <div className={['relative', className].filter(Boolean).join(' ')}>
      <GoogleMap
        mapContainerClassName="w-full h-full"
        center={center}
        zoom={activeId ? 6 : 4}
        options={{
          fullscreenControl: false,
          streetViewControl: false,
          mapTypeControl: false,
          clickableIcons: false,
        }}
      >
        {points.map((p) => {
          const t = clamp(Number(p.total || 0) / maxTotal, 0, 1);
          const { fill, stroke } = colorByIntensity(t);
          const isActive = !!activeId && p.id === activeId;
          const radiusMeters = clamp(25000 + Math.sqrt(Math.max(0, p.total)) * 12000, 25000, 120000);
          return (
            <CircleF
              key={p.id}
              center={{ lat: p.lat, lng: p.lng }}
              radius={radiusMeters}
              options={{
                fillColor: fill,
                fillOpacity: 0.75,
                strokeColor: isActive ? '#2563eb' : stroke,
                strokeOpacity: 0.95,
                strokeWeight: isActive ? 3 : 2,
                zIndex: isActive ? 2 : 1,
              }}
              onClick={() => {
                onSelect(p.id);
                setInfoId(p.id);
              }}
            />
          );
        })}

        {infoPoint ? (
          <InfoWindowF
            position={{ lat: infoPoint.lat, lng: infoPoint.lng }}
            onCloseClick={() => setInfoId('')}
          >
            <div className="space-y-1">
              <div className="text-sm font-semibold text-gray-900">{infoPoint.name}</div>
              <div className="text-xs text-gray-700">
                Total: <b>{infoPoint.total}</b> • Solved: <b>{infoPoint.resolved}</b>
              </div>
              <div className="text-xs text-gray-700">
                Profit:{' '}
                <b className="text-emerald-700">{showProfit ? formatCurrency(infoPoint.company_profit) : '**'}</b>
              </div>
              <button
                type="button"
                className="mt-2 btn btn-outline text-xs px-3 py-1.5"
                onClick={() => onOpenCustomers(infoPoint.id)}
              >
                Open customers
              </button>
            </div>
          </InfoWindowF>
        ) : null}
      </GoogleMap>

      <div className="absolute bottom-3 left-3 z-10 rounded-lg bg-white/95 backdrop-blur border border-gray-200 px-3 py-2 text-[11px] text-gray-800 shadow-sm pointer-events-none">
        <div className="font-semibold text-gray-900 mb-1">All view legend</div>
        <div className="flex items-center gap-2">
          <span className="inline-block w-4 h-2 rounded-sm" style={{ background: colorByIntensity(0).fill }} />
          <span>Low</span>
          <span className="inline-block w-4 h-2 rounded-sm ml-2" style={{ background: colorByIntensity(1).fill }} />
          <span>High</span>
        </div>
        <div className="text-[10px] text-gray-600 mt-1">Color + size = Total</div>
      </div>
    </div>
  );
}

