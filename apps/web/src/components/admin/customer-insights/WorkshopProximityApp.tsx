'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, MapPin, Eye, EyeOff } from 'lucide-react';

type ProximityEvent = {
  id: string;
  source: string;
  distance_m: number | null;
  had_active_booking: boolean;
  ops_alert_sent: boolean;
  customer_nudge_sent: boolean;
  created_at: string;
  metadata?: { workshop_name?: string; workshop_city?: string; customer_phone_last10?: string };
  customer?: { full_name?: string | null; phone?: string | null } | null;
  workshop?: { workshop_name?: string | null; name?: string | null; city?: string | null } | null;
};

function hoursAgo(h: number) {
  return new Date(Date.now() - h * 60 * 60 * 1000).toISOString();
}

const DEMO_EVENTS: ProximityEvent[] = [
  {
    id: 'demo-1',
    source: 'geofence',
    distance_m: 412,
    had_active_booking: false,
    ops_alert_sent: true,
    customer_nudge_sent: true,
    created_at: hoursAgo(0.4),
    metadata: { workshop_name: 'MyFNG Andheri West', workshop_city: 'Mumbai', customer_phone_last10: '294017' },
    customer: { full_name: 'Rahul Sharma', phone: '9594294017' },
    workshop: { workshop_name: 'MyFNG Andheri West', city: 'Mumbai' },
  },
  {
    id: 'demo-2',
    source: 'geofence',
    distance_m: 628,
    had_active_booking: false,
    ops_alert_sent: true,
    customer_nudge_sent: false,
    created_at: hoursAgo(1.2),
    metadata: { workshop_name: 'MyFNG Kharghar', workshop_city: 'Navi Mumbai', customer_phone_last10: '710389' },
    customer: { full_name: 'Priya Mehta', phone: '8652710389' },
    workshop: { workshop_name: 'MyFNG Kharghar', city: 'Navi Mumbai' },
  },
  {
    id: 'demo-3',
    source: 'foreground',
    distance_m: 189,
    had_active_booking: false,
    ops_alert_sent: true,
    customer_nudge_sent: true,
    created_at: hoursAgo(3.5),
    metadata: { workshop_name: 'MyFNG Thane', workshop_city: 'Thane', customer_phone_last10: '882341' },
    customer: { full_name: 'Amit Patel', phone: '9876588234' },
    workshop: { workshop_name: 'MyFNG Thane', city: 'Thane' },
  },
  {
    id: 'demo-4',
    source: 'geofence',
    distance_m: 701,
    had_active_booking: true,
    ops_alert_sent: false,
    customer_nudge_sent: false,
    created_at: hoursAgo(5),
    metadata: { workshop_name: 'MyFNG Borivali', workshop_city: 'Mumbai', customer_phone_last10: '334521' },
    customer: { full_name: 'Sneha Desai', phone: '98200334521' },
    workshop: { workshop_name: 'MyFNG Borivali', city: 'Mumbai' },
  },
  {
    id: 'demo-5',
    source: 'geofence',
    distance_m: 533,
    had_active_booking: false,
    ops_alert_sent: true,
    customer_nudge_sent: true,
    created_at: hoursAgo(8),
    metadata: { workshop_name: 'MyFNG Wakad', workshop_city: 'Pune', customer_phone_last10: '445612' },
    customer: { full_name: 'Vikram Singh', phone: '9012345612' },
    workshop: { workshop_name: 'MyFNG Wakad', city: 'Pune' },
  },
];

function formatWhen(value: string) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function WorkshopProximityApp() {
  const [events, setEvents] = useState<ProximityEvent[]>([]);
  const [stats, setStats] = useState({ walk_in_alerts_24h: 0, geofence_radius_m: 750 });
  const [loading, setLoading] = useState(true);
  const [walkInsOnly, setWalkInsOnly] = useState(true);
  const [demoMode, setDemoMode] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const demoEvents = useMemo(
    () => (walkInsOnly ? DEMO_EVENTS.filter((e) => !e.had_active_booking) : DEMO_EVENTS),
    [walkInsOnly],
  );

  const displayEvents = demoMode ? demoEvents : events;
  const displayStats = demoMode
    ? {
        walk_in_alerts_24h: DEMO_EVENTS.filter((e) => !e.had_active_booking).length,
        geofence_radius_m: stats.geofence_radius_m,
      }
    : stats;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const qs = walkInsOnly ? '?walk_ins=1&limit=100' : '?limit=100';
      const res = await fetch(`/api/app_operations/workshop-proximity${qs}`, { cache: 'no-store' });
      const json = await res.json();
      if (!res.ok) {
        setError(String(json?.error || 'Failed to load proximity alerts'));
        setEvents([]);
        return;
      }
      setEvents(json.events || []);
      setStats(json.stats || { walk_in_alerts_24h: 0, geofence_radius_m: 750 });
    } catch (e: any) {
      setError(e?.message || 'Failed to load proximity alerts');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [walkInsOnly]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-6 max-w-[1400px]">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-blue-600 mb-1">
            <MapPin className="w-5 h-5" />
            <span className="text-xs font-bold uppercase tracking-wider">App Customers</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Workshop Proximity Alerts</h1>
          <p className="text-sm text-gray-600 mt-2 max-w-2xl">
            Customers who opted in and entered a geofence near a MyFNG service center. Follow up when there is
            no active app booking — possible walk-in bypass.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDemoMode((v) => !v)}
            className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold ${
              demoMode
                ? 'border-amber-300 bg-amber-50 text-amber-900 hover:bg-amber-100'
                : 'bg-white hover:bg-gray-50'
            }`}
          >
            {demoMode ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            {demoMode ? 'Hide demo' : 'Preview demo'}
          </button>
          <button
            type="button"
            onClick={() => setWalkInsOnly((v) => !v)}
            className="rounded-lg border bg-white px-3 py-2 text-sm font-semibold hover:bg-gray-50"
          >
            {walkInsOnly ? 'Walk-ins only' : 'All events'}
          </button>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Walk-in alerts (24h)</div>
          <div className="text-3xl font-black text-orange-600 mt-1">{displayStats.walk_in_alerts_24h}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Showing</div>
          <div className="text-lg font-bold text-gray-900 mt-1">{walkInsOnly ? 'Needs follow-up' : 'All proximity events'}</div>
        </div>
        <div className="rounded-xl border bg-white p-4 shadow-sm">
          <div className="text-sm text-gray-500">Geofence radius</div>
          <div className="text-lg font-bold text-gray-900 mt-1">
            ~{displayStats.geofence_radius_m ?? 750}m (system setting)
          </div>
        </div>
      </div>

      {demoMode ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <strong>Demo preview</strong> — sample rows only. Real alerts appear when customers enable{' '}
          <strong>Nearby Workshop Alerts</strong> and enter a workshop geofence without an active booking.
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">{error}</div>
      ) : null}

      {loading && !demoMode ? (
        <div className="rounded-xl border bg-white p-10 text-center text-sm text-gray-500">Loading proximity events…</div>
      ) : displayEvents.length === 0 ? (
        <div className="rounded-xl border bg-white p-10 text-center">
          <MapPin className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-800">No proximity alerts yet</p>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Customers must enable <strong>Nearby Workshop Alerts</strong> in the app under Settings → Notifications.
          </p>
          <button
            type="button"
            onClick={() => setDemoMode(true)}
            className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
          >
            <Eye className="w-4 h-4" />
            Preview demo data
          </button>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">When</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Workshop</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Distance</th>
                  <th className="px-4 py-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {displayEvents.map((event) => {
                  const workshopName =
                    event.metadata?.workshop_name ||
                    event.workshop?.workshop_name ||
                    event.workshop?.name ||
                    'Workshop';
                  const customerName = event.customer?.full_name || 'Customer';
                  const phone =
                    event.customer?.phone ||
                    (event.metadata?.customer_phone_last10
                      ? `******${event.metadata.customer_phone_last10}`
                      : '—');
                  return (
                    <tr key={event.id} className="border-t hover:bg-gray-50/80">
                      <td className="px-4 py-3 whitespace-nowrap text-gray-700">{formatWhen(event.created_at)}</td>
                      <td className="px-4 py-3">
                        <div className="font-semibold text-gray-900">{customerName}</div>
                        <div className="text-xs text-gray-500">{phone}</div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{workshopName}</div>
                        <div className="text-xs text-gray-500">
                          {event.metadata?.workshop_city || event.workshop?.city || '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3 capitalize text-gray-700">{event.source}</td>
                      <td className="px-4 py-3 text-gray-700">
                        {event.distance_m != null ? `${Math.round(Number(event.distance_m))}m` : '—'}
                      </td>
                      <td className="px-4 py-3">
                        {event.had_active_booking ? (
                          <span className="inline-flex rounded-full bg-green-100 px-2.5 py-1 text-xs font-bold text-green-700">
                            Active booking
                          </span>
                        ) : (
                          <span className="inline-flex rounded-full bg-orange-100 px-2.5 py-1 text-xs font-bold text-orange-700">
                            No booking — follow up
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500">
        Telecallers: call customers marked <strong>No booking — follow up</strong> and offer app booking for wallet,
        warranty & tracking.
      </p>
    </div>
  );
}
