'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import WorkshopMap from '@/components/workshops/WorkshopMap';
import { Loader2, MapPin, Phone, Search } from 'lucide-react';

type WorkshopRow = {
  id: string;
  name?: string | null;
  workshop_name?: string | null;
  city?: string | null;
  phone?: string | null;
  display_address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  map_link?: string | null;
};

function workshopTitle(row: WorkshopRow) {
  return row.workshop_name || row.name || 'Workshop';
}

export default function TelecallerWorkshopsPage() {
  const [rows, setRows] = useState<WorkshopRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [q, setQ] = useState('');
  const [city, setCity] = useState('all');
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/workshop-locator')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (!data?.success) {
          setError(data?.error || 'Could not load workshops');
          setRows([]);
          return;
        }
        setRows(Array.isArray(data.workshops) ? data.workshops : []);
      })
      .catch(() => {
        if (!cancelled) setError('Could not load workshops');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const cities = useMemo(
    () => Array.from(new Set(rows.map((row) => String(row.city || '').trim()).filter(Boolean))).sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return rows.filter((row) => {
      if (city !== 'all' && String(row.city || '') !== city) return false;
      if (!needle) return true;
      const blob = `${workshopTitle(row)} ${row.display_address || ''} ${row.phone || ''} ${row.city || ''}`.toLowerCase();
      return blob.includes(needle);
    });
  }, [rows, q, city]);

  const markers = filtered
    .filter((row) => Number.isFinite(Number(row.latitude)) && Number.isFinite(Number(row.longitude)))
    .map((row) => ({
      id: row.id,
      lat: Number(row.latitude),
      lng: Number(row.longitude),
      label: workshopTitle(row),
      selected: row.id === activeId,
    }));

  const center = markers[0]
    ? { lat: markers[0].lat, lng: markers[0].lng }
    : { lat: 19.2183, lng: 72.9781 };

  return (
    <DashboardLayout role="telecaller">
      <div className="flex h-[calc(100dvh-88px)] min-h-[520px] flex-col gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="min-w-0">
            <h1 className="text-xl font-extrabold text-gray-900">Workshops</h1>
            <p className="text-xs text-gray-500">{filtered.length} workshops</p>
          </div>
          <label className="relative min-w-[220px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Search workshop, area, phone"
              className="h-10 w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 text-sm"
            />
          </label>
          <select
            value={city}
            onChange={(event) => setCity(event.target.value)}
            className="h-10 rounded-xl border border-gray-200 bg-white px-3 text-sm font-semibold text-gray-800"
          >
            <option value="all">All cities</option>
            {cities.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="flex flex-1 items-center justify-center gap-2 text-gray-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading workshops…
          </div>
        ) : error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
            {error}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 gap-3 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="min-h-0 overflow-y-auto">
              {filtered.length === 0 ? (
                <p className="px-4 py-10 text-center text-sm text-gray-500">No workshop for this search.</p>
              ) : (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                  {filtered.map((row) => {
                    const active = row.id === activeId;
                    return (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setActiveId(row.id)}
                        className={`flex min-h-[132px] flex-col rounded-2xl border bg-white p-3 text-left shadow-sm ${
                          active ? 'border-[#004AAD] ring-2 ring-blue-100' : 'border-gray-200 hover:border-[#004AAD]/40'
                        }`}
                      >
                        <span className="flex items-start gap-2">
                          <MapPin className={`mt-0.5 h-4 w-4 shrink-0 ${active ? 'text-[#004AAD]' : 'text-gray-400'}`} />
                          <span className="truncate text-sm font-extrabold text-gray-900">{workshopTitle(row)}</span>
                        </span>
                        <span className="mt-1 line-clamp-3 text-xs leading-snug text-gray-500">
                          {[row.display_address, row.city].filter(Boolean).join(' · ') || 'Address not set'}
                        </span>
                        {row.phone ? (
                          <span className="mt-auto inline-flex items-center gap-1 pt-2 text-xs font-semibold text-[#004AAD]">
                            <Phone className="h-3 w-3" />
                            {row.phone}
                          </span>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="min-h-[280px] overflow-hidden rounded-2xl border border-gray-200 bg-white">
              <WorkshopMap
                className="h-full min-h-[280px] w-full"
                center={center}
                zoom={11}
                markers={markers}
                activeId={activeId}
                onSelect={setActiveId}
              />
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
