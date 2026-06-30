'use client';

import { useCallback, useEffect, useState } from 'react';
import { RefreshCw, TrendingUp, Users, MousePointerClick, AlertTriangle, Loader2, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import toast from 'react-hot-toast';

type EventMetric = {
  name: string;
  count: number;
  change?: number;
};

type LiveDataResponse = {
  period: string;
  total_events: number;
  total_users: number;
  top_events: EventMetric[];
  conversion_events: EventMetric[];
  error?: string;
  configured: boolean;
};

type Period = '7d' | '14d' | '28d';

const PERIOD_LABELS: Record<Period, string> = {
  '7d': 'Last 7 days',
  '14d': 'Last 14 days',
  '28d': 'Last 28 days',
};

export default function LiveDataSection() {
  const [data, setData] = useState<LiveDataResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<Period>('7d');

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/super_admin/analytics-hub/live-data?period=${p}`);
      const json = await res.json();
      setData(json);
      if (json.error) toast.error(json.error);
    } catch {
      toast.error('Failed to fetch analytics data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData(period);
  }, [period, fetchData]);

  if (loading && !data) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-violet-500" />
        <span className="ml-2 text-sm text-gray-500">Loading live data…</span>
      </div>
    );
  }

  if (data && !data.configured) {
    return (
      <div className="bg-white rounded-2xl border border-amber-200 p-8 shadow-sm">
        <div className="flex items-start gap-4">
          <div className="w-10 h-10 rounded-xl bg-amber-50 flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-lg">GA4 Data API Not Configured</h3>
            <p className="text-sm text-gray-600 mt-2">
              Live event data requires a Google Service Account with access to your GA4 property.
            </p>
            <div className="mt-4 bg-gray-50 rounded-xl p-4 space-y-3 text-sm text-gray-700">
              <p className="font-semibold">Setup steps:</p>
              <ol className="list-decimal list-inside space-y-2 text-gray-600">
                <li>Go to <a href="https://console.cloud.google.com/iam-admin/serviceaccounts" target="_blank" rel="noopener noreferrer" className="text-violet-600 underline">Google Cloud Console → Service Accounts</a></li>
                <li>Create a service account (or use existing one)</li>
                <li>Grant it <strong>Viewer</strong> role on your GA4 property</li>
                <li>Download the JSON key file</li>
                <li>Set <code className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-xs font-mono">GA4_SERVICE_ACCOUNT_JSON</code> env variable with the JSON content</li>
                <li>Set <code className="bg-violet-50 text-violet-700 px-1.5 py-0.5 rounded text-xs font-mono">GA4_PROPERTY_ID</code> env variable with your GA4 property ID</li>
              </ol>
              <p className="text-xs text-gray-500 mt-3">
                Find your Property ID in GA4 → Admin → Property Settings. It&apos;s a numeric ID like <code>123456789</code>.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header with period selector */}
      <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Live Event Data</h2>
            <p className="text-sm text-gray-500 mt-0.5">Real-time event metrics from Firebase / GA4</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-gray-100 rounded-lg p-1">
              {(Object.keys(PERIOD_LABELS) as Period[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPeriod(p)}
                  className={`px-3 py-1.5 text-xs font-semibold rounded-md transition ${
                    period === p ? 'bg-white text-violet-700 shadow-sm' : 'text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => fetchData(period)}
              disabled={loading}
              className="p-2 rounded-lg border border-gray-200 hover:border-violet-300 transition disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center">
                <MousePointerClick className="w-5 h-5 text-violet-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Total Events</p>
                <p className="text-2xl font-black text-gray-900">{data.total_events.toLocaleString()}</p>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 p-6 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-50 flex items-center justify-center">
                <Users className="w-5 h-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium">Active Users</p>
                <p className="text-2xl font-black text-gray-900">{data.total_users.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top events */}
      {data && data.top_events.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-violet-600" />
            <h3 className="font-bold text-gray-900 text-sm">Top Events</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60">
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">#</th>
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Count</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                </tr>
              </thead>
              <tbody>
                {data.top_events.map((ev, i) => (
                  <tr key={ev.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                    <td className="px-6 py-2.5 text-xs text-gray-400 font-mono">{i + 1}</td>
                    <td className="px-6 py-2.5">
                      <code className="text-xs font-mono font-semibold text-violet-700 bg-violet-50 px-2 py-0.5 rounded">
                        {ev.name}
                      </code>
                    </td>
                    <td className="px-6 py-2.5 text-right font-semibold text-gray-900">{ev.count.toLocaleString()}</td>
                    <td className="px-6 py-2.5 text-right">
                      {ev.change !== undefined && (
                        <span className={`inline-flex items-center text-xs font-semibold ${ev.change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {ev.change >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                          {Math.abs(ev.change)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Conversion events */}
      {data && data.conversion_events.length > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-50 flex items-center gap-3">
            <TrendingUp className="w-4 h-4 text-emerald-600" />
            <h3 className="font-bold text-gray-900 text-sm">Conversion Events</h3>
            <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Key metrics</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/60">
                  <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Event</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Count</th>
                  <th className="text-right px-6 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Change</th>
                </tr>
              </thead>
              <tbody>
                {data.conversion_events.map((ev, i) => (
                  <tr key={ev.name} className={i % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}>
                    <td className="px-6 py-2.5">
                      <code className="text-xs font-mono font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                        {ev.name}
                      </code>
                    </td>
                    <td className="px-6 py-2.5 text-right font-semibold text-gray-900">{ev.count.toLocaleString()}</td>
                    <td className="px-6 py-2.5 text-right">
                      {ev.change !== undefined && (
                        <span className={`inline-flex items-center text-xs font-semibold ${ev.change >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                          {ev.change >= 0 ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                          {Math.abs(ev.change)}%
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
