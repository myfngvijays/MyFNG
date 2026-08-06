'use client';

import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { Copy, Download, ExternalLink, Loader2, PauseCircle, PlayCircle, Trash2 } from 'lucide-react';
import LinkQrPreview, { getLinkQrDownloadUrl } from '../LinkQrPreview';
import { downloadDataUrl } from '../QrLivePreview';
import { buildClientQrShortUrl, buildProductionShortUrl, buildQrShortUrl } from '@/lib/link-manager/utils';

type LinkRow = {
  id: string;
  short_code: string;
  short_url?: string;
  long_url: string;
  title?: string | null;
  description?: string | null;
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
};

function shortUrlFor(link: Pick<LinkRow, 'short_code' | 'short_url'>) {
  return link.short_url || buildProductionShortUrl(link.short_code);
}

function qrScanUrlFor(link: Pick<LinkRow, 'short_code'>) {
  if (typeof window !== 'undefined') {
    return buildClientQrShortUrl(link.short_code);
  }
  return buildQrShortUrl(link.short_code);
}

export default function LinksListSection() {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<LinkRow[]>([]);
  const [q, setQ] = useState('');
  const [page, setPage] = useState(1);
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
  }, [
    selected?.id,
    selected?.long_url,
    selected?.title,
    selected?.utm_source,
    selected?.utm_medium,
    selected?.utm_campaign,
    selected?.utm_term,
    selected?.utm_content,
  ]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), pageSize: '25' });
      if (q.trim()) params.set('q', q.trim());
      const res = await fetch(`/api/super_admin/link-manager?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load links');
      setLinks(json.links || []);
      setTotalPages(json.totalPages || 1);
      setSelected((prev) => {
        if (!prev) return prev;
        return (json.links || []).find((l: LinkRow) => l.id === prev.id) || prev;
      });
    } catch (e: any) {
      toast.error(e?.message || 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [page, q]);

  useEffect(() => {
    load();
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
      load();
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
        body: JSON.stringify({
          long_url: nextUrl,
          title: editTitle.trim() || null,
          ...editUtm,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Update failed');
      toast.success('Link details updated — same QR & short link still work');
      setSelected(json.link || selected);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Update failed');
    } finally {
      setWorkingId(null);
    }
  }

  const linkDetailsDirty = selected
    ? editLongUrl.trim() !== selected.long_url
      || editTitle.trim() !== (selected.title || '')
      || editUtm.utm_source.trim() !== (selected.utm_source || '')
      || editUtm.utm_medium.trim() !== (selected.utm_medium || '')
      || editUtm.utm_campaign.trim() !== (selected.utm_campaign || '')
      || editUtm.utm_term.trim() !== (selected.utm_term || '')
      || editUtm.utm_content.trim() !== (selected.utm_content || '')
    : false;

  async function downloadSelectedQr() {
    if (!selected) return;
    try {
      const shortUrl = selected.short_url || buildProductionShortUrl(selected.short_code);
      const dataUrl = await getLinkQrDownloadUrl(selected.short_code, shortUrl);
      downloadDataUrl(dataUrl, `qr-${selected.short_code}.png`);
      toast.success('QR downloaded (myfng.in link encoded)');
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
      toast.success('QR regenerated with live URL');
      setSelected(json.link || selected);
      load();
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
      toast.success('Link deleted');
      if (selected?.id === id) setSelected(null);
      load();
    } catch (e: any) {
      toast.error(e?.message || 'Delete failed');
    } finally {
      setWorkingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search title, code or URL..."
          className="rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm min-w-[260px]"
        />
        <button type="button" onClick={() => { setPage(1); load(); }} className="px-4 py-2 rounded-xl bg-blue-600 text-white font-semibold text-sm">
          Search
        </button>
      </div>

      <div className="grid xl:grid-cols-[1fr_320px] gap-4">
        <div className="rounded-2xl border border-gray-200 bg-white overflow-hidden shadow-sm">
          {loading ? (
            <div className="p-8 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-blue-600" /></div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 text-left text-gray-600">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Link</th>
                    <th className="px-4 py-3 font-semibold">Destination</th>
                    <th className="px-4 py-3 font-semibold">Traffic</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {links.length === 0 ? (
                    <tr><td colSpan={5} className="px-4 py-10 text-center text-gray-500">No links yet — create your first short link</td></tr>
                  ) : (
                    links.map((link) => (
                      <tr key={link.id} className={`border-t border-gray-100 ${selected?.id === link.id ? 'bg-blue-50/60' : ''}`}>
                        <td className="px-4 py-3">
                          <button type="button" onClick={() => setSelected(link)} className="text-left">
                            <div className="font-semibold text-blue-700 break-all">{shortUrlFor(link)}</div>
                            <div className="text-xs text-gray-500">{link.title || 'Untitled'}</div>
                          </button>
                        </td>
                        <td className="px-4 py-3 max-w-xs truncate text-gray-600">{link.long_url}</td>
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">{link.clicks || 0} link</div>
                          <div className="text-xs text-gray-500">{link.unique_clicks || 0} unique · {link.qr_scans || 0} QR</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${link.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                            {link.is_active ? 'Active' : 'Paused'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-1">
                            <button type="button" title="Copy" onClick={() => copyText(shortUrlFor(link))} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50"><Copy className="w-3.5 h-3.5" /></button>
                            <a href={shortUrlFor(link)} target="_blank" rel="noreferrer" title="Open" className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 inline-flex"><ExternalLink className="w-3.5 h-3.5" /></a>
                            <button type="button" title={link.is_active ? 'Pause' : 'Activate'} disabled={workingId === link.id} onClick={() => toggleActive(link)} className="p-1.5 rounded-lg border border-gray-200 hover:bg-gray-50">
                              {link.is_active ? <PauseCircle className="w-3.5 h-3.5" /> : <PlayCircle className="w-3.5 h-3.5" />}
                            </button>
                            <button type="button" title="Delete" disabled={workingId === link.id} onClick={() => deleteLink(link.id)} className="p-1.5 rounded-lg border border-red-200 text-red-600 hover:bg-red-50">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-600">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40">Prev</button>
            <span>Page {page} / {totalPages}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => p + 1)} className="px-3 py-1 rounded-lg border disabled:opacity-40">Next</button>
          </div>
        </div>

        <div className="rounded-2xl border border-gray-200 bg-white p-4 h-fit sticky top-4 shadow-sm">
          {!selected ? (
            <p className="text-sm text-gray-500">Select a link to preview QR and stats.</p>
          ) : (
            <div className="space-y-4">
              <div>
                <h3 className="font-bold text-lg text-gray-900 break-all">{shortUrlFor(selected)}</h3>
                <p className="text-xs text-emerald-700 mt-1 leading-5">
                  QR encodes a tracked scan URL — link shares use the clean URL above.
                </p>
              </div>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-gray-600">Title</span>
                <input
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Link title"
                />
              </label>
              <label className="block space-y-1.5">
                <span className="text-xs font-semibold text-gray-600">Destination URL</span>
                <input
                  value={editLongUrl}
                  onChange={(e) => setEditLongUrl(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm"
                  placeholder="https://..."
                />
              </label>
              <div className="rounded-xl border border-gray-200 bg-gray-50 p-3 space-y-2">
                <p className="text-xs font-bold uppercase tracking-wide text-gray-600">UTM tags</p>
                {([
                  ['utm_source', 'Source'],
                  ['utm_medium', 'Medium'],
                  ['utm_campaign', 'Campaign'],
                  ['utm_term', 'Term'],
                  ['utm_content', 'Content'],
                ] as const).map(([key, label]) => (
                  <label key={key} className="block space-y-1">
                    <span className="text-xs text-gray-500">{label}</span>
                    <input
                      value={editUtm[key]}
                      onChange={(e) => setEditUtm((prev) => ({ ...prev, [key]: e.target.value }))}
                      className="w-full rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm"
                      placeholder={label}
                    />
                  </label>
                ))}
              </div>
              <button
                type="button"
                disabled={workingId === selected.id || !linkDetailsDirty}
                onClick={saveLinkDetails}
                className="w-full rounded-xl bg-blue-600 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                Save link details
              </button>
              <LinkQrPreview shortCode={selected.short_code} />
              <p className="text-[11px] text-center text-gray-500 leading-4">
                QR encodes <span className="font-mono break-all">{qrScanUrlFor(selected)}</span>
              </p>
              {typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') ? (
                <p className="text-[11px] text-center text-amber-700 leading-4">
                  Localhost admin: phone scans need your LAN URL. Open admin via <span className="font-mono">http://192.168.x.x:3000</span> or deploy to myfng.in.
                </p>
              ) : null}
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="rounded-xl border p-2"><div className="text-gray-500 text-xs">Link clicks</div><div className="font-bold">{selected.clicks || 0}</div></div>
                <div className="rounded-xl border p-2"><div className="text-gray-500 text-xs">Unique clicks</div><div className="font-bold">{selected.unique_clicks || 0}</div></div>
                <div className="rounded-xl border p-2"><div className="text-gray-500 text-xs">QR scans</div><div className="font-bold">{selected.qr_scans || 0}</div></div>
                <div className="rounded-xl border p-2"><div className="text-gray-500 text-xs">Created</div><div className="font-bold text-xs">{selected.created_at ? new Date(selected.created_at).toLocaleDateString('en-IN') : '-'}</div></div>
              </div>
              <button type="button" onClick={() => copyText(shortUrlFor(selected))} className="w-full rounded-xl border py-2 text-sm font-semibold">
                Copy short URL
              </button>
              <button
                type="button"
                onClick={() => {
                  window.open(qrScanUrlFor(selected), '_blank', 'noopener,noreferrer');
                  toast.success('Opened QR scan URL — refresh to see updated QR count');
                  setTimeout(() => load(), 1200);
                }}
                className="w-full rounded-xl border border-purple-200 bg-purple-50 py-2 text-sm font-semibold text-purple-800"
              >
                Test QR scan (opens /qr URL)
              </button>
              <button
                type="button"
                onClick={downloadSelectedQr}
                className="w-full inline-flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-2 text-sm font-semibold text-blue-700"
              >
                <Download className="w-4 h-4" /> Download QR PNG
              </button>
              <button
                type="button"
                disabled={workingId === selected.id}
                onClick={regenerateQr}
                className="w-full rounded-xl border border-amber-200 bg-amber-50 py-2 text-sm font-semibold text-amber-800 disabled:opacity-50"
              >
                Save fixed QR to database
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
