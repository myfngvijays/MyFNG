'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';
import { AlertCircle, Building, CheckCircle, Loader2, Phone, RefreshCw, Search, Star } from 'lucide-react';
import DashboardLayout from '@/components/DashboardLayout';
import PageHelpIcon from '@/components/PageHelpIcon';

type LeadCounts = { open: number; booked: number; completed: number; rejected: number; total: number };

type Workshop = {
  id: string;
  name: string | null;
  city: string | null;
  state: string | null;
  address: string | null;
  pincode: string | null;
  contact_person: string | null;
  phone: string | null;
  email: string | null;
  is_verified: boolean | null;
  audit_score: number | string | null;
  lead_counts?: LeadCounts;
};

type Stats = { total: number; verified: number; unverified: number; active_jobs: number; open_leads?: number };

type Verification = 'all' | 'verified' | 'unverified';
type SortBy = 'booked' | 'open' | 'completed' | 'name';

const EMPTY_COUNTS: LeadCounts = { open: 0, booked: 0, completed: 0, rejected: 0, total: 0 };

export default function WorkshopsPage() {
  const [workshops, setWorkshops] = useState<Workshop[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [verification, setVerification] = useState<Verification>('all');
  const [sortBy, setSortBy] = useState<SortBy>('booked');
  const [stats, setStats] = useState<Stats>({ total: 0, verified: 0, unverified: 0, active_jobs: 0 });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/lead-manager/workshops?verification=${verification}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load workshops');
      setWorkshops(json.workshops || []);
      setStats(json.stats || { total: 0, verified: 0, unverified: 0, active_jobs: 0 });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to load workshops');
    } finally {
      setLoading(false);
    }
  }, [verification]);

  useEffect(() => {
    void load();
  }, [load]);

  const cities = useMemo(
    () => Array.from(new Set(workshops.map((w) => w.city).filter(Boolean) as string[])).sort(),
    [workshops],
  );

  const rows = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    const list = workshops.filter((w) => {
      if (cityFilter !== 'all' && w.city !== cityFilter) return false;
      if (!q) return true;
      return [w.name, w.city, w.contact_person, w.phone, w.pincode, w.address].some((v) =>
        String(v || '').toLowerCase().includes(q),
      );
    });
    const c = (w: Workshop) => w.lead_counts || EMPTY_COUNTS;
    return list.sort((a, b) => {
      if (sortBy === 'name') return String(a.name || '').localeCompare(String(b.name || ''));
      const d = c(b)[sortBy] - c(a)[sortBy];
      return d || String(a.name || '').localeCompare(String(b.name || ''));
    });
  }, [workshops, searchTerm, cityFilter, sortBy]);

  return (
    <DashboardLayout role="lead_manager">
      <div className="mx-auto w-full min-w-0 max-w-6xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-black text-[#023D95]">
              <Building className="h-6 w-6" /> Workshops
              <PageHelpIcon href="/dashboard/lead_manager/workshops" label="Workshops" />
            </h1>
            <p className="text-sm text-slate-500">Partner workshops aur unki leads — open, booked, completed</p>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-bold text-slate-700"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-bold uppercase text-slate-500">Workshops</p>
            <p className="text-2xl font-black text-[#023D95]">{stats.total}</p>
          </div>
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
            <p className="text-[11px] font-bold uppercase text-emerald-700">Verified</p>
            <p className="text-2xl font-black text-emerald-900">{stats.verified}</p>
          </div>
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
            <p className="text-[11px] font-bold uppercase text-amber-700">Unverified</p>
            <p className="text-2xl font-black text-amber-900">{stats.unverified}</p>
          </div>
          <div className="rounded-2xl border border-violet-200 bg-violet-50 p-4">
            <p className="text-[11px] font-bold uppercase text-violet-700">Booked (active)</p>
            <p className="text-2xl font-black text-violet-900">{stats.active_jobs}</p>
          </div>
          <div className="col-span-2 rounded-2xl border border-sky-200 bg-sky-50 p-4 sm:col-span-1">
            <p className="text-[11px] font-bold uppercase text-sky-700">Open leads</p>
            <p className="text-2xl font-black text-sky-900">{stats.open_leads ?? 0}</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-200 bg-white p-3">
          <label className="relative min-w-[200px] flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search name, city, contact, phone, pincode"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm"
            />
          </label>
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            <option value="all">All cities</option>
            {cities.map((city) => (
              <option key={city} value={city}>
                {city}
              </option>
            ))}
          </select>
          <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-0.5">
            {(
              [
                { id: 'all', label: `All ${stats.total}` },
                { id: 'verified', label: `Verified ${stats.verified}` },
                { id: 'unverified', label: `Unverified ${stats.unverified}` },
              ] as const
            ).map((o) => (
              <button
                key={o.id}
                type="button"
                onClick={() => setVerification(o.id)}
                className={`rounded-lg px-3 py-1.5 text-xs font-bold ${
                  verification === o.id ? 'bg-[#023D95] text-white' : 'text-slate-600'
                }`}
              >
                {o.label}
              </button>
            ))}
          </div>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortBy)}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold"
          >
            <option value="booked">Sort: Most booked</option>
            <option value="open">Sort: Most open leads</option>
            <option value="completed">Sort: Most completed</option>
            <option value="name">Sort: Name A–Z</option>
          </select>
        </div>

        {loading && !workshops.length ? (
          <div className="flex items-center justify-center gap-2 py-16 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading workshops…
          </div>
        ) : rows.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white px-4 py-14 text-center">
            <Building className="mx-auto h-10 w-10 text-slate-300" />
            <p className="mt-3 text-base font-black text-slate-800">No workshops</p>
            <p className="text-sm text-slate-500">
              {searchTerm || cityFilter !== 'all' ? 'Search / city filter badal ke dekho.' : 'Koi workshop nahi mila.'}
            </p>
          </div>
        ) : (
          <div
            className={`overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition-opacity ${
              loading ? 'opacity-60' : ''
            }`}
          >
            <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2.5 text-xs text-slate-500">
              <span>{rows.length} workshops</span>
              <span>Open = lead bheji, booking baaki · Booked = booking confirmed</span>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-[11px] font-bold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Workshop</th>
                    <th className="px-4 py-3">Location</th>
                    <th className="px-4 py-3">Contact</th>
                    <th className="px-3 py-3 text-right text-sky-700">Open</th>
                    <th className="px-3 py-3 text-right text-violet-700">Booked</th>
                    <th className="px-3 py-3 text-right text-emerald-700">Completed</th>
                    <th className="px-3 py-3 text-right text-red-600">Rejected</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.map((w) => {
                    const c = w.lead_counts || EMPTY_COUNTS;
                    const score = w.audit_score != null && w.audit_score !== '' ? Number(w.audit_score) : null;
                    return (
                      <tr key={w.id} className="align-top hover:bg-slate-50/70">
                        <td className="px-4 py-3">
                          <p className="max-w-[220px] truncate font-bold text-slate-900" title={w.name || ''}>
                            {w.name || '—'}
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {w.is_verified ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                                <CheckCircle className="h-3 w-3" /> Verified
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                                <AlertCircle className="h-3 w-3" /> Unverified
                              </span>
                            )}
                            {score != null && Number.isFinite(score) ? (
                              <span className="inline-flex items-center gap-0.5 rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-bold text-yellow-700">
                                <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" /> {score.toFixed(1)}
                              </span>
                            ) : null}
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">
                            {[w.city, w.pincode].filter(Boolean).join(' · ') || '—'}
                          </p>
                          <p className="max-w-[240px] truncate text-xs text-slate-500" title={w.address || ''}>
                            {w.address || '—'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-semibold text-slate-800">{w.contact_person || '—'}</p>
                          {w.phone ? (
                            <a
                              href={`tel:${w.phone}`}
                              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-[#023D95]"
                            >
                              <Phone className="h-3 w-3" /> {w.phone}
                            </a>
                          ) : (
                            <p className="text-xs text-slate-400">—</p>
                          )}
                        </td>
                        <td className="px-3 py-3 text-right font-bold text-sky-800">{c.open || <span className="text-slate-300">0</span>}</td>
                        <td className="px-3 py-3 text-right font-bold text-violet-800">{c.booked || <span className="text-slate-300">0</span>}</td>
                        <td className="px-3 py-3 text-right font-bold text-emerald-800">{c.completed || <span className="text-slate-300">0</span>}</td>
                        <td className="px-3 py-3 text-right font-bold text-red-700">{c.rejected || <span className="text-slate-300">0</span>}</td>
                        <td className="px-4 py-3 text-right">
                          <Link
                            href={`/dashboard/lead_manager/workshops/${w.id}`}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-bold text-[#023D95] hover:bg-blue-50"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
