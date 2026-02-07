'use client';

import { useEffect, useMemo, useRef } from 'react';

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

function clamp(n: number, a: number, b: number) {
  return Math.max(a, Math.min(b, n));
}

function formatCurrency(value?: number | null) {
  if (!Number.isFinite(value as number)) return '₹0';
  return `₹${Math.round(Number(value)).toLocaleString('en-IN')}`;
}

export default function StateHeatmapLeafletVanillaMap({
  className,
  points,
  activeId,
  showProfit,
  onSelect,
  onOpenCustomers,
}: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);

  const maxTotal = useMemo(() => Math.max(1, ...points.map((p) => Number(p.total || 0))), [points]);

  useEffect(() => {
    let map: any = null;
    let layerGroup: any = null;
    let cancelled = false;

    const run = async () => {
      const host = hostRef.current;
      if (!host) return;

      // Lazy-load Leaflet only in browser.
      const L = await import('leaflet');
      if (cancelled) return;

      // If hot refresh reused DOM, clear Leaflet id safely (Leaflet checks this)
      const container: any = host;
      if (container && container._leaflet_id) {
        try {
          delete container._leaflet_id;
        } catch {
          // ignore
        }
      }

      // Create map
      map = L.map(host, {
        zoomControl: true,
        scrollWheelZoom: false,
        attributionControl: true,
      });

      // Base tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(map);

      layerGroup = L.layerGroup().addTo(map);

      const pts = (Array.isArray(points) ? points : []).filter(
        (p) => Number.isFinite(p?.lat) && Number.isFinite(p?.lng)
      );

      const bounds = L.latLngBounds([]);

      for (const p of pts) {
        const t = clamp(Number(p.total || 0) / maxTotal, 0, 1);
        const radius = clamp(6 + Math.sqrt(Math.max(0, p.total)) * 2, 7, 22);
        const isActive = !!activeId && p.id === activeId;
        const color = isActive ? '#2563eb' : '#059669';
        const fillColor = isActive ? '#60a5fa' : '#34d399';
        const fillOpacity = 0.25 + t * 0.45;

        const marker = L.circleMarker([p.lat, p.lng], {
          radius,
          color,
          weight: isActive ? 3 : 2,
          fillColor,
          fillOpacity,
        });

        marker.on('click', () => onSelect(p.id));

        marker.bindTooltip(
          `<div style="font-size:12px"><b>${escapeHtml(p.name)}</b> • Total: ${p.total} • Solved: ${p.resolved}</div>`,
          { sticky: true, direction: 'top', opacity: 1 }
        );

        const profitText = showProfit ? formatCurrency(p.company_profit) : '**';
        const popupHtml = `
          <div style="min-width:180px">
            <div style="font-size:14px;font-weight:700;margin-bottom:6px">${escapeHtml(p.name)}</div>
            <div style="font-size:12px;color:#374151;margin-bottom:4px">
              Total: <b>${p.total}</b> • Solved: <b>${p.resolved}</b>
            </div>
            <div style="font-size:12px;color:#374151;margin-bottom:10px">
              Profit: <b style="color:#047857">${profitText}</b>
            </div>
            <button
              data-open-customers="1"
              data-id="${escapeAttr(p.id)}"
              style="font-size:12px;font-weight:600;border:2px solid #023D95;color:#023D95;padding:6px 10px;border-radius:8px;background:#fff;cursor:pointer"
            >
              Open customers
            </button>
          </div>
        `;

        marker.bindPopup(popupHtml);
        marker.on('popupopen', (e: any) => {
          // delegate button click
          const el: HTMLElement | null = e?.popup?._contentNode || null;
          if (!el) return;
          const btn = el.querySelector('button[data-open-customers="1"]') as HTMLButtonElement | null;
          if (!btn) return;
          const id = btn.getAttribute('data-id') || '';
          btn.onclick = () => onOpenCustomers(id);
        });

        marker.addTo(layerGroup);
        bounds.extend([p.lat, p.lng]);
      }

      if (pts.length) {
        map.fitBounds(bounds, { padding: [20, 20], maxZoom: 5 });
        if (activeId) {
          const active = pts.find((p) => p.id === activeId);
          if (active) map.flyTo([active.lat, active.lng], Math.max(map.getZoom(), 5), { duration: 0.6 });
        }
      } else {
        map.setView([22.9734, 78.6569], 4);
      }
    };

    void run();

    return () => {
      cancelled = true;
      try {
        if (layerGroup) layerGroup.clearLayers();
      } catch {
        // ignore
      }
      try {
        if (map) map.remove();
      } catch {
        // ignore
      }
    };
    // We intentionally rebuild the map when these change (stable in dev).
  }, [points, activeId, showProfit, onSelect, onOpenCustomers, maxTotal]);

  return <div ref={hostRef} className={className} />;
}

function escapeHtml(s: any) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function escapeAttr(s: any) {
  return String(s ?? '').replace(/"/g, '&quot;');
}

