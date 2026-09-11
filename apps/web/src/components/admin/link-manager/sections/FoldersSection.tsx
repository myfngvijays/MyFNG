'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import {
  BarChart3,
  ChevronLeft,
  ChevronRight,
  Copy,
  FolderOpen,
  Loader2,
  MousePointerClick,
  QrCode,
  Users,
} from 'lucide-react';
import ReportDateRangeFilter, { type ReportDateRangeValue } from '@/components/admin/ReportDateRangeFilter';
import type { ReportDatePreset } from '@/lib/report-date-range';
import { buildProductionShortUrl } from '@/lib/link-manager/utils';
import OpenEventsList from '../OpenEventsList';

type FolderRow = {
  name: string;
  links: number;
  clicks: number;
  unique?: number;
  qr: number;
  active: number;
};

type FolderAnalytics = {
  range?: { label: string };
  kpis?: {
    links: number;
    active: number;
    total_clicks: number;
    unique_clicks: number;
    qr_scans: number;
    clicks_in_range: number;
    qr_scans_in_range: number;
  };
  top_links?: Array<{
    id: string;
    short_code: string;
    title?: string | null;
    clicks?: number;
    unique_clicks?: number;
    qr_scans?: number;
  }>;
  devices?: Array<{ label: string; count: number }>;
  recent_clicks?: any[];
};

type LinkRow = {
  id: string;
  short_code: string;
  short_url?: string;
  long_url: string;
  title?: string | null;
  clicks?: number;
  qr_scans?: number;
  is_active?: boolean;
  created_at?: string;
};

function shortUrlFor(link: Pick<LinkRow, 'short_code' | 'short_url'>) {
  return link.short_url || buildProductionShortUrl(link.short_code);
}

export default function FoldersSection() {
  const [loadingFolders, setLoadingFolders] = useState(true);
  const [folders, setFolders] = useState<FolderRow[]>([]);
  const [showAllFolders, setShowAllFolders] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [loadingLinks, setLoadingLinks] = useState(false);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [analytics, setAnalytics] = useState<FolderAnalytics | null>(null);
  const [loadingAnalytics, setLoadingAnalytics] = useState(false);
  const [dateRange, setDateRange] = useState<ReportDateRangeValue>({
    preset: 'last_7_days',
    customStart: '',
    customEnd: '',
  });

  const loadFolders = useCallback(async () => {
    setLoadingFolders(true);
    try {
      const res = await fetch('/api/super_admin/link-manager/folders');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load folders');
      const next: FolderRow[] = json.folders || [];
      setFolders(next);
      setSelected((prev) => {
        if (prev && next.some((f) => f.name === prev)) return prev;
        return next[0]?.name || null;
      });
    } catch (e: any) {
      toast.error(e?.message || 'Load failed');
      setFolders([]);
    } finally {
      setLoadingFolders(false);
    }
  }, []);

  const loadLinks = useCallback(async () => {
    if (!selected) {
      setLinks([]);
      setTotal(0);
      setTotalPages(1);
      return;
    }
    setLoadingLinks(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: '20',
        preset: 'all_time',
        folder: selected,
      });
      const res = await fetch(`/api/super_admin/link-manager?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load links');
      setLinks(json.links || []);
      setTotal(Number(json.total) || 0);
      setTotalPages(Math.max(1, Number(json.totalPages) || 1));
    } catch (e: any) {
      toast.error(e?.message || 'Load failed');
      setLinks([]);
    } finally {
      setLoadingLinks(false);
    }
  }, [selected, page]);

  useEffect(() => {
    void loadFolders();
  }, [loadFolders]);

  useEffect(() => {
    void loadLinks();
  }, [loadLinks]);

  const loadAnalytics = useCallback(async () => {
    if (!selected) {
      setAnalytics(null);
      return;
    }
    setLoadingAnalytics(true);
    try {
      const params = new URLSearchParams({
        folder: selected,
        preset: dateRange.preset,
      });
      if (dateRange.preset === 'custom') {
        if (dateRange.customStart) params.set('from', dateRange.customStart);
        if (dateRange.customEnd) params.set('to', dateRange.customEnd);
      }
      const res = await fetch(`/api/super_admin/link-manager/folders/analytics?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load analytics');
      setAnalytics(json);
    } catch (e: any) {
      toast.error(e?.message || 'Analytics failed');
      setAnalytics(null);
    } finally {
      setLoadingAnalytics(false);
    }
  }, [selected, dateRange]);

  useEffect(() => {
    void loadAnalytics();
  }, [loadAnalytics]);

  useEffect(() => {
    setPage(1);
  }, [selected]);

  const maxFolderClicks = useMemo(
    () => Math.max(1, ...folders.map((f) => Number(f.clicks) || 0)),
    [folders],
  );

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  const from = total === 0 ? 0 : (page - 1) * 20 + 1;
  const to = Math.min(page * 20, total);
  const selectedFolder = folders.find((f) => f.name === selected) || null;
  const visibleFolders = showAllFolders ? folders : folders.slice(0, 8);
  const hiddenFolderCount = Math.max(0, folders.length - 8);

  function pickFolder(name: string) {
    const idx = folders.findIndex((f) => f.name === name);
    if (idx >= 8) setShowAllFolders(true);
    setSelected(name);
  }

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-amber-100 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4">
        <h2 className="text-xl font-black text-gray-900">Folders</h2>
        <p className="mt-1 text-sm text-gray-600">
          Folder cards + selected folder ka analytics — clicks, QR, unique, recent opens.
        </p>
      </div>

      {loadingFolders ? (
        <div className="flex justify-center rounded-2xl border border-gray-200 bg-white p-12">
          <Loader2 className="h-6 w-6 animate-spin text-amber-600" />
        </div>
      ) : folders.length === 0 ? (
        <div className="rounded-2xl border border-gray-200 bg-white px-4 py-16 text-center text-sm text-gray-500">
          No folders yet. Create Link pe Folder field bharo — jaise Workshops.
        </div>
      ) : (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {visibleFolders.map((folder) => {
              const active = selected === folder.name;
              return (
                <button
                  key={folder.name}
                  type="button"
                  onClick={() => pickFolder(folder.name)}
                  className={`rounded-2xl border p-4 text-left shadow-sm transition ${
                    active
                      ? 'border-amber-500 bg-amber-50'
                      : 'border-gray-200 bg-white hover:border-amber-200 hover:bg-amber-50/40'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`rounded-xl p-2 ${
                        active ? 'bg-amber-100 text-amber-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      <FolderOpen className="h-5 w-5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold text-gray-900">{folder.name}</p>
                      <p className="mt-1 text-xs text-gray-500">
                        {folder.links} links · {folder.active} active
                      </p>
                      <p className="mt-0.5 text-xs text-gray-500">
                        {folder.clicks} clicks · {folder.unique || 0} unique · {folder.qr} QR
                      </p>
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
          {hiddenFolderCount > 0 ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setShowAllFolders((v) => !v)}
                className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 hover:bg-amber-100"
              >
                {showAllFolders ? 'Show less' : `Show all (${hiddenFolderCount} more)`}
              </button>
            </div>
          ) : null}
        </div>
      )}

      {selected ? (
        <div className="space-y-4">
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-black text-gray-900">{selected} analytics</p>
                <p className="text-xs text-gray-500">{analytics?.range?.label || 'Pick a date range'}</p>
              </div>
              {loadingAnalytics ? <Loader2 className="h-4 w-4 animate-spin text-amber-600" /> : null}
            </div>
            <ReportDateRangeFilter
              preset={dateRange.preset as ReportDatePreset}
              customStart={dateRange.customStart}
              customEnd={dateRange.customEnd}
              onChange={setDateRange}
            />
            <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
              {[
                ['Links', analytics?.kpis?.links ?? selectedFolder?.links ?? 0, FolderOpen],
                ['Active', analytics?.kpis?.active ?? selectedFolder?.active ?? 0, FolderOpen],
                ['Clicks', analytics?.kpis?.total_clicks ?? selectedFolder?.clicks ?? 0, MousePointerClick],
                ['Unique', analytics?.kpis?.unique_clicks ?? selectedFolder?.unique ?? 0, Users],
                ['QR', analytics?.kpis?.qr_scans ?? selectedFolder?.qr ?? 0, QrCode],
                ['Period clicks', analytics?.kpis?.clicks_in_range ?? 0, BarChart3],
                ['Period QR', analytics?.kpis?.qr_scans_in_range ?? 0, QrCode],
              ].map(([label, value, Icon]) => (
                <div key={String(label)} className="rounded-xl border border-gray-100 bg-gray-50 px-3 py-2">
                  <div className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    <Icon className="h-3 w-3" />
                    {label}
                  </div>
                  <p className="mt-1 text-lg font-black text-gray-900">{Number(value).toLocaleString('en-IN')}</p>
                </div>
              ))}
            </div>
          </div>

          {folders.length > 1 ? (
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-black text-gray-900">All folders by clicks</p>
              <div className="space-y-2">
                {[...folders]
                  .sort((a, b) => b.clicks - a.clicks)
                  .slice(0, 8)
                  .map((folder) => (
                    <button
                      key={folder.name}
                      type="button"
                      onClick={() => pickFolder(folder.name)}
                      className="block w-full text-left"
                    >
                      <div className="mb-0.5 flex items-center justify-between text-xs">
                        <span className={`font-semibold ${folder.name === selected ? 'text-amber-800' : 'text-gray-800'}`}>
                          {folder.name}
                        </span>
                        <span className="text-gray-500">{folder.clicks.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-gray-100">
                        <div
                          className={`h-full rounded-full ${folder.name === selected ? 'bg-amber-500' : 'bg-blue-500'}`}
                          style={{ width: `${Math.max(6, Math.round((folder.clicks / maxFolderClicks) * 100))}%` }}
                        />
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ) : null}

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-black text-gray-900">Top links in {selected}</p>
              {loadingAnalytics ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-amber-600" />
              ) : !(analytics?.top_links || []).length ? (
                <p className="text-sm text-gray-500">No links in this folder.</p>
              ) : (
                <div className="space-y-2">
                  {(analytics?.top_links || []).map((link) => (
                    <div key={link.id} className="rounded-xl border border-gray-100 px-3 py-2">
                      <p className="truncate text-sm font-semibold text-gray-900">{link.title || 'Untitled'}</p>
                      <p className="truncate font-mono text-[11px] text-blue-700">
                        {buildProductionShortUrl(link.short_code)}
                      </p>
                      <p className="mt-0.5 text-[11px] text-gray-500">
                        {link.clicks || 0} clicks · {link.unique_clicks || 0} unique · {link.qr_scans || 0} QR
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <p className="mb-3 text-sm font-black text-gray-900">Recent opens</p>
              {loadingAnalytics ? (
                <Loader2 className="mx-auto h-5 w-5 animate-spin text-amber-600" />
              ) : (
                <OpenEventsList events={analytics?.recent_clicks || []} empty="Is period me is folder ka koi open nahi." />
              )}
            </div>
          </div>

        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
            <div>
              <p className="text-sm font-black text-gray-900">{selected}</p>
              <p className="text-xs text-gray-500">
                {total.toLocaleString('en-IN')} links · showing {from}–{to}
              </p>
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                <tr>
                  <th className="px-4 py-3">Short URL</th>
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Destination</th>
                  <th className="px-4 py-3">Clicks</th>
                  <th className="px-4 py-3">QR</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Copy</th>
                </tr>
              </thead>
              <tbody>
                {loadingLinks ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center">
                      <Loader2 className="mx-auto h-5 w-5 animate-spin text-amber-600" />
                    </td>
                  </tr>
                ) : links.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-gray-500">
                      Is folder me koi link nahi.
                    </td>
                  </tr>
                ) : (
                  links.map((link) => (
                    <tr key={link.id} className="border-t border-gray-100 align-top">
                      <td className="px-4 py-3 font-mono text-xs font-bold text-blue-700 break-all">
                        {shortUrlFor(link)}
                      </td>
                      <td className="px-4 py-3 font-semibold text-gray-900">{link.title || 'Untitled'}</td>
                      <td className="max-w-[14rem] px-4 py-3">
                        <p className="truncate text-xs text-gray-600" title={link.long_url}>
                          {link.long_url}
                        </p>
                      </td>
                      <td className="px-4 py-3 font-black text-blue-700">{link.clicks || 0}</td>
                      <td className="px-4 py-3 font-black text-violet-700">{link.qr_scans || 0}</td>
                      <td className="whitespace-nowrap px-4 py-3">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                            link.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                          }`}
                        >
                          {link.is_active ? 'Active' : 'Paused'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          title="Copy"
                          onClick={() => void copyText(shortUrlFor(link))}
                          className="rounded-lg border border-gray-200 p-1.5 hover:bg-gray-50"
                        >
                          <Copy className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-gray-700">
              Page <span className="text-amber-700">{page}</span> of {totalPages}
            </p>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1 || loadingLinks}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" /> Prev
              </button>
              <button
                type="button"
                disabled={page >= totalPages || loadingLinks}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
              >
                Next <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        </div>
      ) : null}
    </div>
  );
}
