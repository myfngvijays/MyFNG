'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import {
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  ExternalLink,
  Loader2,
  PauseCircle,
  PlayCircle,
  Search,
  Trash2,
} from 'lucide-react';
import LinkQrPreview, { getLinkQrDownloadUrl } from '../LinkQrPreview';
import { downloadDataUrl } from '../QrLivePreview';
import SplitWithPreview from '../SplitWithPreview';
import { buildClientQrShortUrl, buildProductionShortUrl, buildQrShortUrl } from '@/lib/link-manager/utils';

type LinkRow = {
  id: string;
  short_code: string;
  short_url?: string;
  long_url: string;
  title?: string | null;
  description?: string | null;
  folder?: string | null;
  tags?: string[] | null;
  utm_source?: string | null;
  utm_medium?: string | null;
  utm_campaign?: string | null;
  utm_term?: string | null;
  utm_content?: string | null;
  clicks?: number;
  unique_clicks?: number;
  qr_scans?: number;
  is_active?: boolean;
  created_at?: string;
  qr_code_url?: string | null;
  meta?: { create_mode?: string } | null;
};

const PAGE_SIZE_OPTIONS = [10, 20, 50];

function shortUrlFor(link: Pick<LinkRow, 'short_code' | 'short_url'>) {
  return link.short_url || buildProductionShortUrl(link.short_code);
}

function qrScanUrlFor(link: Pick<LinkRow, 'short_code'>) {
  if (typeof window !== 'undefined') return buildClientQrShortUrl(link.short_code);
  return buildQrShortUrl(link.short_code);
}

export default function LinksListSection() {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [searchInput, setSearchInput] = useState('');
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<LinkRow | null>(null);
  const [workingId, setWorkingId] = useState<string | null>(null);
  const [editLongUrl, setEditLongUrl] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editUtm, setEditUtm] = useState({
    utm_source: '',
    utm_medium: '',
    utm_campaign: '',
    utm_term: '',
    utm_content: '',
  });

  useEffect(() => {
    setEditLongUrl(selected?.long_url || '');
    setEditTitle(selected?.title || '');
    setEditUtm({
      utm_source: selected?.utm_source || '',
      utm_medium: selected?.utm_medium || '',
      utm_campaign: selected?.utm_campaign || '',
      utm_term: selected?.utm_term || '',
      utm_content: selected?.utm_content || '',
    });
  }, [selected?.id, selected?.long_url, selected?.title, selected?.utm_source, selected?.utm_medium, selected?.utm_campaign, selected?.utm_term, selected?.utm_content]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/super_admin/link-manager?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load links');
      setLinks(json.links || []);
      setTotal(Number(json.total) || 0);
      setTotalPages(Math.max(1, Number(json.totalPages) || 1));
      setSelected((prev) => {
        if (!prev) return prev;
        return (json.links || []).find((l: LinkRow) => l.id === prev.id) || prev;
      });
    } catch (e: any) {
      toast.error(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q]);

  useEffect(() => {
    void load();
  }, [load]);

  async function copyText(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      toast.success('Copied');
    } catch {
      toast.error('Copy failed');
    }
  }

  async function toggleActive(link: LinkRow) {
    setWorkingId(link.id);
    try {
      const res = await fetch(`/api/super_admin/link-manager/${link.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !link.is_active }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      toast.success(link.is_active ? 'Link paused' : 'Link activated');
      void load();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setWorkingId(null);
    }
  }

  async function saveLinkDetails() {
    if (!selected) return;
    const nextUrl = editLongUrl.trim();
    if (!nextUrl) {
      toast.error('Enter a destination URL');
      return;
    }
    setWorkingId(selected.id);
    try {
      const res = await fetch(`/api/super_admin/link-manager/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ long_url: nextUrl, title: editTitle.trim() || null, ...editUtm }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      toast.success('Link updated');
      setSelected(json.link || selected);
      void load();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setWorkingId(null);
    }
  }

  const linkDetailsDirty = selected
    ? editLongUrl.trim() !== selected.long_url ||
      editTitle.trim() !== (selected.title || '') ||
      editUtm.utm_source.trim() !== (selected.utm_source || '') ||
      editUtm.utm_medium.trim() !== (selected.utm_medium || '') ||
      editUtm.utm_campaign.trim() !== (selected.utm_campaign || '') ||
      editUtm.utm_term.trim() !== (selected.utm_term || '') ||
      editUtm.utm_content.trim() !== (selected.utm_content || '')
    : false;

  async function downloadSelectedQr() {
    if (!selected) return;
    try {
      const shortUrl = selected.short_url || buildProductionShortUrl(selected.short_code);
      const dataUrl = await getLinkQrDownloadUrl(selected.short_code, shortUrl);
      downloadDataUrl(dataUrl, `qr-${selected.short_code}.png`);
      toast.success('QR downloaded');
    } catch {
      toast.error('QR download failed');
    }
  }

  async function regenerateQr() {
    if (!selected) return;
    setWorkingId(selected.id);
    try {
      const res = await fetch(`/api/super_admin/link-manager/${selected.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate_qr: true }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'QR regenerate failed');
      toast.success('QR saved');
      setSelected(json.link || selected);
      void load();
    } catch (e: any) {
      toast.error(e?.message || 'QR regenerate failed');
    } finally {
      setWorkingId(null);
    }
  }

  async function deleteLink(id: string) {
    if (!confirm('Delete this link permanently?')) return;
    setWorkingId(id);
    try {
      const res = await fetch(`/api/super_admin/link-manager/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Delete failed');
      toast.success('Deleted');
      if (selected?.id === id) setSelected(null);
      void load();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setWorkingId(null);
    }
  }

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-lg font-black text-gray-900">My Links</h2>
            <p className="text-sm text-gray-500">
              {total.toLocaleString('en-IN')} total · showing {from}–{to}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[240px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    setPage(1);
                    setQ(searchInput.trim());
                  }
                }}
                placeholder="Search title, code or URL…"
                className="w-full rounded-xl border border-gray-200 py-2.5 pl-9 pr-3 text-sm outline-none focus:border-blue-500"
              />
            </div>
            <button
              type="button"
              onClick={() => {
                setPage(1);
                setQ(searchInput.trim());
              }}
              className="rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-bold text-white"
            >
              Search
            </button>
            <select
              value={pageSize}
              onChange={(e) => {
                setPage(1);
                setPageSize(Number(e.target.value) || 10);
              }}
              className="rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
            >
              {PAGE_SIZE_OPTIONS.map((n) => (
                <option key={n} value={n}>
                  {n} / page
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <SplitWithPreview
        main={
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          {loading ? (
            <div className="flex justify-center p-12">
              <Loader2 className="h-6 w-6 animate-spin text-blue-600" />
            </div>
          ) : links.length === 0 ? (
            <div className="px-4 py-16 text-center text-sm text-gray-500">
              No links on this page. Create one from Create Link tab.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {links.map((link) => {
                const active = selected?.id === link.id;
                const mode = String(link.meta?.create_mode || '');
                return (
                  <div
                    key={link.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelected(link)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setSelected(link);
                      }
                    }}
                    className={`w-full cursor-pointer px-4 py-3.5 text-left transition hover:bg-blue-50/50 ${
                      active ? 'bg-blue-50' : 'bg-white'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-mono text-sm font-bold text-blue-700 break-all">
                            {shortUrlFor(link)}
                          </span>
                          <span
                            className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                              link.is_active
                                ? 'bg-emerald-100 text-emerald-700'
                                : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {link.is_active ? 'Active' : 'Paused'}
                          </span>
                          {mode === 'both' || mode === 'qr_only' || link.qr_code_url ? (
                            <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-bold text-violet-700">
                              QR
                            </span>
                          ) : null}
                          {link.folder ? (
                            <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold text-gray-600">
                              {link.folder}
                            </span>
                          ) : null}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-gray-900">
                          {link.title || 'Untitled'}
                        </p>
                        <p className="mt-0.5 truncate text-xs text-gray-500">{link.long_url}</p>
                      </div>
                      <div className="flex shrink-0 gap-3 text-center">
                        <div>
                          <div className="text-base font-black text-blue-700">{link.clicks || 0}</div>
                          <div className="text-[10px] font-semibold uppercase text-gray-400">Clicks</div>
                        </div>
                        <div>
                          <div className="text-base font-black text-violet-700">{link.qr_scans || 0}</div>
                          <div className="text-[10px] font-semibold uppercase text-gray-400">QR</div>
                        </div>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-1" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        title="Copy"
                        onClick={() => void copyText(shortUrlFor(link))}
                        className="rounded-lg border border-gray-200 p-1.5 hover:bg-white"
                      >
                        <Copy className="h-3.5 w-3.5" />
                      </button>
                      <a
                        href={shortUrlFor(link)}
                        target="_blank"
                        rel="noreferrer"
                        title="Open"
                        className="inline-flex rounded-lg border border-gray-200 p-1.5 hover:bg-white"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                      <button
                        type="button"
                        title={link.is_active ? 'Pause' : 'Activate'}
                        disabled={workingId === link.id}
                        onClick={() => void toggleActive(link)}
                        className="rounded-lg border border-gray-200 p-1.5 hover:bg-white"
                      >
                        {link.is_active ? (
                          <PauseCircle className="h-3.5 w-3.5" />
                        ) : (
                          <PlayCircle className="h-3.5 w-3.5" />
                        )}
                      </button>
                      <button
                        type="button"
                        title="Delete"
                        disabled={workingId === link.id}
                        onClick={() => void deleteLink(link.id)}
                        className="rounded-lg border border-rose-200 p-1.5 text-rose-600 hover:bg-rose-50"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Prominent pagination */}
          <div className="flex flex-col gap-3 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm font-semibold text-gray-700">
              Page <span className="text-blue-700">{page}</span> of {totalPages}
              <span className="font-normal text-gray-500"> · {total} links</span>
            </p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1 || loading}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800 disabled:opacity-40"
              >
                <ChevronLeft className="h-4 w-4" />
                Prev
              </button>
              <div className="hidden items-center gap-1 sm:flex">
                {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                  let n = i + 1;
                  if (totalPages > 5) {
                    if (page <= 3) n = i + 1;
                    else if (page >= totalPages - 2) n = totalPages - 4 + i;
                    else n = page - 2 + i;
                  }
                  return (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setPage(n)}
                      className={`h-9 min-w-9 rounded-lg px-2 text-sm font-bold ${
                        page === n ? 'bg-blue-600 text-white' : 'bg-white text-gray-700 border border-gray-200'
                      }`}
                    >
                      {n}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                disabled={page >= totalPages || loading}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold text-gray-800 disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        }
        preview={
          <div className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            {!selected ? (
              <div className="py-10 text-center text-sm text-gray-500">
                Select a link to preview QR, edit destination & stats here.
              </div>
            ) : (
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-gray-400">Selected</p>
                  <h3 className="mt-1 break-all font-mono text-sm font-bold text-blue-700">
                    {shortUrlFor(selected)}
                  </h3>
                </div>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-gray-600">Title</span>
                  <input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <label className="block space-y-1">
                  <span className="text-xs font-semibold text-gray-600">Destination</span>
                  <input
                    value={editLongUrl}
                    onChange={(e) => setEditLongUrl(e.target.value)}
                    className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {([
                    ['utm_source', 'Source'],
                    ['utm_medium', 'Medium'],
                    ['utm_campaign', 'Campaign'],
                    ['utm_content', 'Content'],
                  ] as const).map(([key, label]) => (
                    <label key={key} className="block space-y-1">
                      <span className="text-[11px] text-gray-500">{label}</span>
                      <input
                        value={editUtm[key]}
                        onChange={(e) => setEditUtm((prev) => ({ ...prev, [key]: e.target.value }))}
                        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs"
                      />
                    </label>
                  ))}
                </div>
                <button
                  type="button"
                  disabled={workingId === selected.id || !linkDetailsDirty}
                  onClick={() => void saveLinkDetails()}
                  className="w-full rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                >
                  Save details
                </button>
                <LinkQrPreview shortCode={selected.short_code} />
                <div className="grid grid-cols-3 gap-2 text-center text-sm">
                  <div className="rounded-xl border p-2">
                    <div className="font-black">{selected.clicks || 0}</div>
                    <div className="text-[10px] text-gray-500">Clicks</div>
                  </div>
                  <div className="rounded-xl border p-2">
                    <div className="font-black">{selected.unique_clicks || 0}</div>
                    <div className="text-[10px] text-gray-500">Unique</div>
                  </div>
                  <div className="rounded-xl border p-2">
                    <div className="font-black">{selected.qr_scans || 0}</div>
                    <div className="text-[10px] text-gray-500">QR</div>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => void copyText(shortUrlFor(selected))}
                  className="w-full rounded-xl border py-2 text-sm font-semibold"
                >
                  Copy short URL
                </button>
                <button
                  type="button"
                  onClick={() => void downloadSelectedQr()}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-2 text-sm font-semibold text-blue-700"
                >
                  <Download className="h-4 w-4" /> Download QR
                </button>
                <button
                  type="button"
                  disabled={workingId === selected.id}
                  onClick={() => void regenerateQr()}
                  className="w-full rounded-xl border border-amber-200 bg-amber-50 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"
                >
                  Save fixed QR to DB
                </button>
                <p className="text-[10px] text-center text-gray-400 break-all">
                  QR scan URL: {qrScanUrlFor(selected)}
                </p>
              </div>
            )}
          </div>
        }
      />
    </div>
  );
}
