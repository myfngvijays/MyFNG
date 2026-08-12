'use client';

import { useCallback, useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Loader2, Search } from 'lucide-react';
import { buildProductionShortUrl } from '@/lib/link-manager/utils';

export default function UtmLinksSection() {
  const [loading, setLoading] = useState(true);
  const [links, setLinks] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [qInput, setQInput] = useState('');
  const [q, setQ] = useState('');
  const [utmSource, setUtmSource] = useState('');
  const [utmMedium, setUtmMedium] = useState('');
  const [utmCampaign, setUtmCampaign] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      });
      if (q.trim()) params.set('q', q.trim());
      if (utmSource.trim()) params.set('utmSource', utmSource.trim());
      if (utmMedium.trim()) params.set('utmMedium', utmMedium.trim());
      if (utmCampaign.trim()) params.set('utmCampaign', utmCampaign.trim());

      const res = await fetch(`/api/super_admin/link-manager/utm-links?${params.toString()}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Load failed');
      setLinks(json.links || []);
      setTotal(Number(json.total) || 0);
      setTotalPages(Math.max(1, Number(json.totalPages) || 1));
    } catch {
      setLinks([]);
      setTotal(0);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, q, utmSource, utmMedium, utmCampaign]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    setPage(1);
  }, [q, utmSource, utmMedium, utmCampaign, pageSize]);

  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-violet-100 bg-gradient-to-r from-violet-50 to-indigo-50 px-5 py-4">
        <h2 className="text-xl font-black text-gray-900">UTM Links</h2>
        <p className="mt-1 text-sm text-gray-600">
          Jinke upar UTM source / medium / campaign set hai — search & filter yahan.
        </p>
      </div>

      <div className="grid gap-3 rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:grid-cols-2 lg:grid-cols-5">
        <label className="block space-y-1 lg:col-span-2">
          <span className="text-xs font-semibold text-gray-600">Search title / code</span>
          <div className="flex gap-1">
            <input
              value={qInput}
              onChange={(e) => setQInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') setQ(qInput.trim());
              }}
              placeholder="saket-wp / Saket Complex"
              className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={() => setQ(qInput.trim())}
              className="rounded-xl bg-violet-600 px-3 text-white"
            >
              <Search className="h-4 w-4" />
            </button>
          </div>
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-gray-600">UTM source</span>
          <input
            value={utmSource}
            onChange={(e) => setUtmSource(e.target.value)}
            placeholder="link / qr"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-gray-600">UTM medium</span>
          <input
            value={utmMedium}
            onChange={(e) => setUtmMedium(e.target.value)}
            placeholder="wp_group"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
        <label className="block space-y-1">
          <span className="text-xs font-semibold text-gray-600">UTM campaign</span>
          <input
            value={utmCampaign}
            onChange={(e) => setUtmCampaign(e.target.value)}
            placeholder="soc_grp"
            className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
          />
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <p className="text-sm font-semibold text-gray-700">
            {total.toLocaleString('en-IN')} links · showing {from}–{to}
          </p>
          <select
            value={pageSize}
            onChange={(e) => setPageSize(Number(e.target.value) || 25)}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold"
          >
            {[10, 25, 50].map((n) => (
              <option key={n} value={n}>
                {n} / page
              </option>
            ))}
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-gray-50 text-left text-gray-600">
              <tr>
                <th className="px-4 py-3 font-semibold">Link</th>
                <th className="px-4 py-3 font-semibold">Source</th>
                <th className="px-4 py-3 font-semibold">Medium</th>
                <th className="px-4 py-3 font-semibold">Campaign</th>
                <th className="px-4 py-3 font-semibold">Term</th>
                <th className="px-4 py-3 font-semibold">Content</th>
                <th className="px-4 py-3 font-semibold">Clicks</th>
                <th className="px-4 py-3 font-semibold">QR</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-400">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </td>
                </tr>
              ) : links.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center text-gray-500">
                    No UTM links match these filters
                  </td>
                </tr>
              ) : (
                links.map((link) => (
                  <tr key={link.id} className="border-t border-gray-100">
                    <td className="px-4 py-3">
                      <div className="font-medium text-gray-900">{link.title || 'Untitled'}</div>
                      <div className="break-all text-xs text-blue-700">
                        {buildProductionShortUrl(link.short_code)}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_source || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_medium || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_campaign || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_term || '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{link.utm_content || '—'}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{link.clicks || 0}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900">{link.qr_scans || 0}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="flex flex-col gap-2 border-t border-gray-200 bg-gray-50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm font-semibold text-gray-700">
            Page <span className="text-violet-700">{page}</span> of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              type="button"
              disabled={page <= 1 || loading}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
            >
              <ChevronLeft className="h-4 w-4" /> Prev
            </button>
            <button
              type="button"
              disabled={page >= totalPages || loading}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              className="inline-flex items-center gap-1 rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm font-bold disabled:opacity-40"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
