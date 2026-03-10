'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { MapPin, Search, Star, Phone, ArrowRight, Sparkles, Loader2, SlidersHorizontal, X } from 'lucide-react';
import WorkshopMap, { type WorkshopMapMarker } from '@/components/workshops/WorkshopMap';

type WorkshopPublicPageRow = {
  id: string;
  slug: string;
  is_published: boolean;
  is_featured: boolean | null;
  short_description: string | null;
  profile_image: string | null;
  cover_image: string | null;
  views_count: number | null;
  workshop: {
    name: string;
    address: string | null;
    city: string | null;
    state: string | null;
    pincode: string | null;
    phone: string | null;
    latitude?: number | null;
    longitude?: number | null;
    map_link?: string | null;
  } | null;
};

function cx(...classes: Array<string | undefined | false | null>) {
  return classes.filter(Boolean).join(' ');
}

function hashString(input: string): number {
  // Deterministic small hash for layout (not crypto).
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const s =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

const CITY_CENTERS: Record<string, { lat: number; lng: number }> = {
  mumbai: { lat: 19.076, lng: 72.8777 },
  delhi: { lat: 28.6139, lng: 77.209 },
  new_delhi: { lat: 28.6139, lng: 77.209 },
  bengaluru: { lat: 12.9716, lng: 77.5946 },
  bangalore: { lat: 12.9716, lng: 77.5946 },
  pune: { lat: 18.5204, lng: 73.8567 },
  thane: { lat: 19.2183, lng: 72.9781 },
  navi_mumbai: { lat: 19.033, lng: 73.0297 },
  chennai: { lat: 13.0827, lng: 80.2707 },
  hyderabad: { lat: 17.385, lng: 78.4867 },
  kolkata: { lat: 22.5726, lng: 88.3639 },
  ahmedabad: { lat: 23.0225, lng: 72.5714 },
  jaipur: { lat: 26.9124, lng: 75.7873 },
};

function cityKey(city: string) {
  return city.trim().toLowerCase().replace(/\s+/g, '_');
}

function extractLatLngFromMapLink(mapLink?: string | null): { lat: number; lng: number } | null {
  if (!mapLink) return null;
  try {
    const raw = decodeURIComponent(mapLink);

    // Common Google Maps format: .../@19.1737638,72.8,17z/...
    const at = raw.match(/@(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (at) {
      const lat = Number(at[1]);
      const lng = Number(at[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    // Query params like q=lat,lng or query=lat,lng or ll=lat,lng
    const qp = raw.match(/[?&](?:q|query|ll)=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (qp) {
      const lat = Number(qp[1]);
      const lng = Number(qp[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }

    // Sometimes links include "center=lat,lng"
    const center = raw.match(/[?&]center=(-?\d+(?:\.\d+)?),\s*(-?\d+(?:\.\d+)?)/);
    if (center) {
      const lat = Number(center[1]);
      const lng = Number(center[2]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return { lat, lng };
    }
  } catch {
    // ignore
  }
  return null;
}

export default function WorkshopsPage() {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<WorkshopPublicPageRow[]>([]);
  const [q, setQ] = useState('');
  const [city, setCity] = useState('');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [mapOpen, setMapOpen] = useState(false);
  const [userPos, setUserPos] = useState<{ lat: number; lng: number } | null>(null);

  const cardRefs = useRef(new Map<string, HTMLDivElement | null>());

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        setLoading(true);
        const supabase = createClient();
        const { data, error } = await supabase
          .from('workshop_public_pages')
          .select(
            `
            id,
            slug,
            is_published,
            is_featured,
            short_description,
            profile_image,
            cover_image,
            views_count,
            workshop:workshops(name,address,city,state,pincode,phone,latitude,longitude,map_link)
          `
          )
          .eq('is_published', true)
          .order('is_featured', { ascending: false })
          .order('views_count', { ascending: false })
          .limit(60);

        if (error) throw error;
        if (!mounted) return;
        setRows((data as any) ?? []);
      } catch (e) {
        console.error('Error loading workshops:', e);
      } finally {
        if (mounted) setLoading(false);
      }
    }
    load();
    return () => {
      mounted = false;
    };
  }, []);

  // Capture current location (best-effort). This enables nearest-first sorting.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('geolocation' in navigator)) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
        setUserPos({ lat, lng });
      },
      () => {},
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 5 * 60 * 1000 }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  const cities = useMemo(() => {
    const set = new Set<string>();
    for (const r of rows) {
      const c = r.workshop?.city?.trim();
      if (c) set.add(c);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [rows]);

  const filteredRaw = useMemo(() => {
    const query = q.trim().toLowerCase();
    const cityQuery = city.trim().toLowerCase();
    return rows.filter((r) => {
      const w = r.workshop;
      const hay = `${w?.name ?? ''} ${w?.city ?? ''} ${w?.state ?? ''} ${r.short_description ?? ''}`.toLowerCase();
      if (query && !hay.includes(query)) return false;
      if (cityQuery && (w?.city ?? '').toLowerCase() !== cityQuery) return false;
      return true;
    });
  }, [rows, q, city]);

  const getRowLatLng = (r: WorkshopPublicPageRow): { lat: number; lng: number } | null => {
    const hasCoords =
      typeof r.workshop?.latitude === 'number' &&
      typeof r.workshop?.longitude === 'number' &&
      Number.isFinite(r.workshop.latitude) &&
      Number.isFinite(r.workshop.longitude);
    if (hasCoords) return { lat: r.workshop!.latitude as number, lng: r.workshop!.longitude as number };
    const fromLink = extractLatLngFromMapLink(r.workshop?.map_link);
    if (fromLink && Number.isFinite(fromLink.lat) && Number.isFinite(fromLink.lng)) return fromLink;
    return null;
  };

  // Sort nearest-first when user location is available.
  const filtered = useMemo(() => {
    if (!userPos) return filteredRaw;
    const withDist = filteredRaw.map((r) => {
      const ll = getRowLatLng(r);
      const km = ll ? haversineKm(userPos, ll) : Number.POSITIVE_INFINITY;
      return { r, km };
    });
    withDist.sort((a, b) => a.km - b.km);
    return withDist.map((x) => x.r);
  }, [filteredRaw, userPos]);

  const markerLayout = useMemo(() => {
    // Airbnb-like: cluster pins by city with deterministic placement.
    const byCity = new Map<string, WorkshopPublicPageRow[]>();
    for (const r of filtered) {
      const c = (r.workshop?.city || 'Nearby').trim() || 'Nearby';
      const arr = byCity.get(c) ?? [];
      arr.push(r);
      byCity.set(c, arr);
    }

    const cityKeys = Array.from(byCity.keys()).sort((a, b) => a.localeCompare(b));
    const cityCenters = new Map<string, { x: number; y: number }>();
    for (const c of cityKeys) {
      const h = hashString(c);
      const x = 18 + (h % 64); // 18..82
      const y = 22 + ((h >>> 8) % 56); // 22..78
      cityCenters.set(c, { x, y });
    }

    const positions = new Map<string, { x: number; y: number; city: string }>();
    for (const c of cityKeys) {
      const items = byCity.get(c) ?? [];
      const center = cityCenters.get(c) ?? { x: 50, y: 50 };
      const n = items.length;
      const baseR = clamp(6 + n * 0.9, 8, 20);
      for (let i = 0; i < n; i++) {
        const r = items[i];
        const hh = hashString(r.slug);
        const a = ((hh % 360) * Math.PI) / 180;
        const ring = n <= 1 ? 0 : (i % 2) * 6;
        const px = clamp(center.x + Math.cos(a) * (baseR + ring), 8, 92);
        const py = clamp(center.y + Math.sin(a) * (baseR + ring), 10, 90);
        positions.set(r.id, { x: px, y: py, city: c });
      }
    }

    return { positions, cityCenters };
  }, [filtered]);

  const mapMarkers = useMemo<WorkshopMapMarker[]>(() => {
    return filtered.map((r) => {
      const ll = getRowLatLng(r);
      if (!ll) return null as any;
      const title = r.workshop?.name ?? 'Workshop';
      return {
        id: r.id,
        lat: ll.lat,
        lng: ll.lng,
        label: title,
        selected: r.id === activeId,
      };
    });
  }, [activeId, city, filtered]).filter(Boolean) as any;

  // Default select nearest workshop (first in sorted list) so map auto-zooms to it.
  useEffect(() => {
    if (activeId) return;
    if (!filtered.length) return;
    setActiveId(filtered[0].id);
  }, [activeId, filtered]);

  const mapCenter = useMemo(() => {
    // Prefer user position; otherwise fall back to city/India.
    if (userPos) return userPos;
    if (city) return CITY_CENTERS[cityKey(city)] ?? { lat: 20.5937, lng: 78.9629 };
    return { lat: 20.5937, lng: 78.9629 };
  }, [city, userPos]);

  const mapZoom = useMemo(() => {
    // Because map centers to active marker in WorkshopMap, keep zoom fairly close when we have any marker.
    if (!mapMarkers.length) return city ? 6 : 4;
    return 13;
  }, [city, mapMarkers.length]);

  const activeRow = useMemo(() => {
    if (!activeId) return null;
    return filtered.find((r) => r.id === activeId) ?? null;
  }, [activeId, filtered]);

  function scrollToCard(id: string) {
    const el = cardRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return (
    <div className="min-h-screen bg-white font-poppins text-text-body">
      <Navbar />

      <main className="pt-16 sm:pt-20 md:pt-24 pb-16 bg-white">
        {/* Top search/filter bar (Airbnb-like) */}
        <div className="sticky top-16 sm:top-20 md:top-24 z-40 bg-white/90 backdrop-blur border-b border-gray-100">
          <div className="mx-auto w-full px-4 sm:px-6 lg:px-8 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <div className="hidden md:flex items-center gap-2 text-sm font-semibold text-gray-900">
                  <MapPin className="w-4 h-4 text-blue-600" />
                  Workshop Locator
                </div>

                <div className="flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-2 shadow-sm min-w-0">
                  <Search className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <input
                    value={q}
                    onChange={(e) => setQ(e.target.value)}
                    placeholder="Search workshop, area, service..."
                    className="w-[42vw] max-w-[520px] min-w-[140px] bg-transparent text-sm font-semibold text-gray-900 placeholder:text-gray-500 focus:outline-none"
                  />
                  {q.trim() ? (
                    <button
                      type="button"
                      onClick={() => setQ('')}
                      className="rounded-full p-1 text-gray-500 hover:bg-gray-100"
                      aria-label="Clear search"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  ) : null}
                </div>

                <div className="hidden sm:block">
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm focus:outline-none"
                  >
                    <option value="">All cities</option>
                    {cities.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-full border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-900 shadow-sm hover:bg-gray-50"
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filters
              </button>
            </div>
          </div>
        </div>

        <div className="mx-auto w-full px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 py-6">
            {/* Left: results */}
            <section className="lg:col-span-7 xl:col-span-8">
              <div className="flex items-end justify-between gap-4">
                <div className="min-w-0">
                  <div className="text-sm text-gray-600">
                    {loading ? (
                      <span>Loading…</span>
                    ) : (
                      <>
                        <span className="font-bold text-gray-900">{filtered.length}</span> workshops
                        {city ? <span className="text-gray-600"> in {city}</span> : null}
                      </>
                    )}
                  </div>
                  <h1 className="mt-2 text-2xl sm:text-3xl font-extrabold text-gray-900">Workshops near you</h1>
                </div>
              </div>

              <div className="mt-5">
                {loading ? (
                  <div className="flex items-center justify-center py-16 text-gray-600">
                    <Loader2 className="w-6 h-6 animate-spin mr-2 text-blue-600" />
                    Loading workshops…
                  </div>
                ) : filtered.length ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-5">
                    {filtered.map((r) => {
                      const w = r.workshop;
                      const title = w?.name ?? 'Workshop';
                      const location = [w?.city, w?.state].filter(Boolean).join(', ');
                      const cover = r.cover_image || r.profile_image;
                      const selected = activeId === r.id;
                      const kmAway =
                        userPos && getRowLatLng(r)
                          ? Math.max(0, haversineKm(userPos, getRowLatLng(r)!))
                          : null;

                      return (
                        <div
                          key={r.id}
                          ref={(el) => {
                            cardRefs.current.set(r.id, el);
                          }}
                          onMouseEnter={() => setActiveId(r.id)}
                          className={cx(
                            'group overflow-hidden rounded-3xl border bg-white shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl cursor-pointer',
                            selected ? 'border-blue-200 ring-2 ring-blue-200/40' : 'border-gray-100'
                          )}
                          onClick={() => setActiveId(r.id)}
                          role="button"
                          tabIndex={0}
                        >
                          <div className="relative h-40 bg-gradient-to-br from-blue-100 to-purple-100">
                            {cover ? <img src={cover} alt={title} className="absolute inset-0 w-full h-full object-cover" /> : null}
                            <div className="absolute inset-0 bg-gradient-to-t from-black/35 to-transparent" />
                            <div className="absolute top-3 left-3 flex items-center gap-2">
                              {r.is_featured ? (
                                <span className="inline-flex items-center gap-2 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-blue-700 border border-blue-200">
                                  <Sparkles className="w-3.5 h-3.5" />
                                  Guest favourite
                                </span>
                              ) : null}
                            </div>
                            <div className="absolute top-3 right-3">
                              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/90 px-3 py-1 text-xs font-bold text-gray-900 border border-gray-200">
                                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" />
                                4.8
                              </span>
                            </div>
                          </div>

                          <div className="p-5">
                            <div className="min-w-0">
                              <div className="text-base font-extrabold text-gray-900 truncate">{title}</div>
                              <div className="mt-1 text-sm text-gray-600 flex items-center gap-2">
                                <MapPin className="w-4 h-4 text-gray-400 flex-shrink-0" />
                                <span className="truncate">{location || '—'}</span>
                              </div>
                              {typeof kmAway === 'number' && Number.isFinite(kmAway) && kmAway < 9999 ? (
                                <div className="mt-1 text-xs text-gray-500 font-semibold">
                                  {kmAway.toFixed(1)} km away
                                </div>
                              ) : null}
                            </div>

                            {r.short_description ? (
                              <p className="mt-3 text-sm text-gray-600 leading-relaxed line-clamp-2">{r.short_description}</p>
                            ) : null}

                            <div className="mt-4 flex items-center justify-between gap-3">
                              {w?.phone ? (
                                <a
                                  href={`tel:${w.phone}`}
                                  onClick={(e) => e.stopPropagation()}
                                  className="inline-flex items-center gap-2 text-sm font-bold text-gray-900 hover:text-blue-700"
                                >
                                  <Phone className="w-4 h-4" />
                                  Call
                                </a>
                              ) : (
                                <span className="text-sm text-gray-500"> </span>
                              )}

                              <Link
                                href={`/workshop/${r.slug}`}
                                onClick={(e) => e.stopPropagation()}
                                className="inline-flex items-center gap-2 text-sm font-bold text-blue-700 hover:text-blue-800"
                              >
                                View page <ArrowRight className="w-4 h-4" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="rounded-3xl border border-gray-200 bg-white p-10 text-center">
                    <div className="text-lg font-extrabold text-gray-900">No workshops found</div>
                    <div className="mt-2 text-sm text-gray-600">Try another search or clear the city filter.</div>
                  </div>
                )}
              </div>
            </section>

            {/* Right: map (desktop) */}
            <aside className="hidden lg:block lg:col-span-5 xl:col-span-4">
              <div className="sticky top-28">
                <div className="relative overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-xl h-[calc(100vh-11rem)] min-h-[520px]">
                  <WorkshopMap
                    className="absolute inset-0"
                    center={mapCenter}
                    zoom={mapZoom}
                    markers={mapMarkers}
                    activeId={activeId}
                    onSelect={(id) => {
                      setActiveId(id);
                      scrollToCard(id);
                    }}
                  />

                  {/* Active preview */}
                  {activeRow ? (
                    <div className="absolute bottom-4 left-4 right-4 z-20">
                      <div className="rounded-3xl border border-gray-200 bg-white shadow-xl overflow-hidden">
                        <div className="flex items-stretch">
                          <div className="w-28 h-24 bg-gradient-to-br from-blue-100 to-purple-100 flex-shrink-0 relative">
                            {(activeRow.cover_image || activeRow.profile_image) ? (
                              <img
                                src={activeRow.cover_image || activeRow.profile_image || ''}
                                alt={activeRow.workshop?.name ?? 'Workshop'}
                                className="absolute inset-0 w-full h-full object-cover"
                              />
                            ) : null}
                          </div>
                          <div className="p-4 min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="text-sm font-extrabold text-gray-900 truncate">
                                  {activeRow.workshop?.name ?? 'Workshop'}
                                </div>
                                <div className="mt-1 text-xs text-gray-600 truncate">
                                  {activeRow.workshop?.city ?? ''} {activeRow.workshop?.state ? `• ${activeRow.workshop?.state}` : ''}
                                </div>
                              </div>
                              <span className="inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-xs font-bold text-gray-900">
                                <Star className="w-3.5 h-3.5 text-yellow-400 fill-yellow-400" /> 4.8
                              </span>
                            </div>
                            <div className="mt-3 flex items-center justify-between">
                              <button
                                type="button"
                                onClick={() => scrollToCard(activeRow.id)}
                                className="text-xs font-bold text-gray-700 hover:text-gray-900"
                              >
                                Highlight listing
                              </button>
                              <Link
                                href={`/workshop/${activeRow.slug}`}
                                className="inline-flex items-center gap-2 text-xs font-bold text-blue-700 hover:text-blue-800"
                              >
                                View page <ArrowRight className="w-4 h-4" />
                              </Link>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>
        </div>

        {/* Mobile map toggle */}
        <div className="lg:hidden">
          <button
            type="button"
            onClick={() => setMapOpen(true)}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 inline-flex items-center gap-2 rounded-full bg-gray-900 text-white px-5 py-3 shadow-2xl"
          >
            <MapPin className="w-5 h-5" />
            Map
          </button>
        </div>

        {/* Mobile map sheet */}
        {mapOpen ? (
          <div className="fixed inset-0 z-[60] lg:hidden">
            <div className="absolute inset-0 bg-black/40" onClick={() => setMapOpen(false)} />
            <div className="absolute inset-x-0 bottom-0 h-[82vh] rounded-t-3xl bg-white shadow-2xl border border-gray-100 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
                <div className="text-sm font-extrabold text-gray-900">Map</div>
                <button
                  type="button"
                  onClick={() => setMapOpen(false)}
                  className="rounded-xl border border-gray-200 bg-white p-2 text-gray-700"
                  aria-label="Close map"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="relative h-full">
                <WorkshopMap
                  className="absolute inset-0"
                  center={mapCenter}
                  zoom={mapZoom}
                  markers={mapMarkers}
                  activeId={activeId}
                  onSelect={(id) => {
                    setActiveId(id);
                    setMapOpen(false);
                    scrollToCard(id);
                  }}
                />
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <Footer />
    </div>
  );
}


