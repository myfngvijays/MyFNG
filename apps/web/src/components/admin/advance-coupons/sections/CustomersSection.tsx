'use client';

import { useEffect, useState, useCallback } from 'react';
import { UserPlus, Users, Trash2, Search, ChevronLeft, ChevronRight, Clock, CheckCircle2, X } from 'lucide-react';
import { PcmPageHeader, PcmStatCard, PcmStatusBadge } from '../shared';

const PAGE_SIZE = 25;

export default function PcmCustomersSection() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ total: 0, registered: 0, pending: 0, redeemed: 0, open: 0 });
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter] = useState<'' | 'registered' | 'pending'>('');

  const fetchData = useCallback(async (p = page, s = search, f = filter) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(PAGE_SIZE),
      });
      if (s) params.set('search', s);
      if (f) params.set('filter', f);

      const res = await fetch(`/api/admin/coupons/assignments?${params}`);
      const json = await res.json();
      if (res.ok) {
        setAssignments(json.assignments || []);
        setTotalPages(json.pagination?.total_pages || 1);
        setTotal(json.pagination?.total || 0);
        if (json.counts) setCounts(json.counts);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, filter]);

  useEffect(() => { fetchData(page, search, filter); }, [page, search, filter]);

  const handleSearch = () => {
    setSearch(searchInput.trim());
    setPage(1);
  };

  const clearSearch = () => {
    setSearchInput('');
    setSearch('');
    setPage(1);
  };

  const handleFilter = (f: '' | 'registered' | 'pending') => {
    setFilter(f);
    setPage(1);
  };

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllOnPage = () => {
    const removable = assignments.filter((a) => !a.redeemed_at);
    const allOnPageSelected = removable.length > 0 && removable.every((a) => selected.has(a.id));
    if (allOnPageSelected) {
      setSelected((prev) => {
        const next = new Set(prev);
        removable.forEach((a) => next.delete(a.id));
        return next;
      });
    } else {
      setSelected((prev) => {
        const next = new Set(prev);
        removable.forEach((a) => next.add(a.id));
        return next;
      });
    }
  };

  const removeAssignment = async (id: string) => {
    if (!window.confirm('Remove this coupon assignment?')) return;
    try {
      const res = await fetch(`/api/admin/coupons/assignments?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to remove assignment');
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
      fetchData(page, search, filter);
    } catch (err: any) {
      alert(err?.message || 'Failed to remove assignment');
    }
  };

  const removeSelected = async () => {
    if (selected.size === 0) return;
    if (!window.confirm(`Remove ${selected.size} selected assignment(s)?`)) return;
    setRemoving(true);
    try {
      const ids = Array.from(selected).join(',');
      const res = await fetch(`/api/admin/coupons/assignments?ids=${ids}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to remove assignments');
      setSelected(new Set());
      fetchData(1, search, filter);
      setPage(1);
    } catch (err: any) {
      alert(err?.message || 'Failed to remove assignments');
    } finally {
      setRemoving(false);
    }
  };

  const removableOnPage = assignments.filter((a) => !a.redeemed_at);
  const allOnPageSelected = removableOnPage.length > 0 && removableOnPage.every((a) => selected.has(a.id));
  const startItem = (page - 1) * PAGE_SIZE + 1;
  const endItem = Math.min(page * PAGE_SIZE, total);

  return (
    <div>
      <PcmPageHeader
        title="Customer Assignments"
        description="Real personal coupons assigned to customers — visible in app under My Coupons"
      />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <PcmStatCard label="Total Assignments" value={counts.total} icon={<UserPlus className="w-5 h-5" />} accent="primary" />
        <PcmStatCard label="Registered" value={counts.registered} icon={<Users className="w-5 h-5" />} accent="sky" />
        <PcmStatCard label="Pending Signup" value={counts.pending} icon={<Clock className="w-5 h-5" />} accent="amber" />
        <PcmStatCard label="Open (Active)" value={counts.open} icon={<UserPlus className="w-5 h-5" />} accent="emerald" />
        <PcmStatCard label="Redeemed" value={counts.redeemed} icon={<CheckCircle2 className="w-5 h-5" />} accent="violet" />
      </div>

      {/* Search + Filter */}
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <div className="flex-1 flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              className="w-full pl-9 pr-8 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              placeholder="Search by phone number or customer name…"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            />
            {searchInput && (
              <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2">
                <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
              </button>
            )}
          </div>
          <button onClick={handleSearch} className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700">
            Search
          </button>
        </div>
        <div className="flex gap-1.5">
          {([
            { id: '' as const, label: 'All' },
            { id: 'registered' as const, label: 'Registered' },
            { id: 'pending' as const, label: 'Pending' },
          ]).map((f) => (
            <button
              key={f.id}
              onClick={() => handleFilter(f.id)}
              className={`px-3 py-2 rounded-lg text-xs font-semibold border transition-colors ${
                filter === f.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Bulk Actions */}
      {selected.size > 0 && (
        <div className="mb-3 flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
          <span className="text-sm font-medium text-red-800">{selected.size} selected</span>
          <button
            className="text-xs px-3 py-1.5 rounded bg-red-600 text-white hover:bg-red-700 flex items-center gap-1 disabled:opacity-50"
            onClick={removeSelected}
            disabled={removing}
          >
            <Trash2 className="w-3 h-3" />
            {removing ? 'Removing...' : 'Remove Selected'}
          </button>
          <button
            className="text-xs px-3 py-1.5 rounded border border-gray-300 hover:bg-gray-100"
            onClick={() => setSelected(new Set())}
          >
            Clear Selection
          </button>
        </div>
      )}

      {/* Table */}
      <div className="pcm-card rounded-xl border overflow-hidden">
        <div className="p-4 border-b border-[#e6e0da] flex items-center justify-between">
          <span className="font-bold">Assigned Coupons</span>
          <span className="text-sm text-gray-500">
            {total > 0 ? `${startItem}–${endItem} of ${total}` : '0 results'}
            {search && <span className="ml-1 text-blue-600">for &quot;{search}&quot;</span>}
          </span>
        </div>

        {loading ? (
          <div className="p-8 text-center text-gray-400">Loading...</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="bg-[#f7f3ec]">
              <tr>
                <th className="px-4 py-3 text-left w-10">
                  <input type="checkbox" checked={allOnPageSelected} onChange={selectAllOnPage} className="rounded" />
                </th>
                <th className="px-4 py-3 text-left">Customer</th>
                <th className="px-4 py-3 text-left">Phone</th>
                <th className="px-4 py-3 text-left">Coupon</th>
                <th className="px-4 py-3 text-left">Assigned</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Action</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-[#72665e]">
                    {search ? `No assignments found for "${search}"` : 'No assignments yet. Go to Assign Coupons to give personal coupons.'}
                  </td>
                </tr>
              ) : (
                assignments.map((row) => (
                  <tr key={row.id} className={`border-t border-[#e6e0da] ${selected.has(row.id) ? 'bg-red-50' : ''}`}>
                    <td className="px-4 py-3">
                      {!row.redeemed_at && (
                        <input type="checkbox" checked={selected.has(row.id)} onChange={() => toggleSelect(row.id)} className="rounded" />
                      )}
                    </td>
                    <td className="px-4 py-3 font-medium">
                      {row.customer?.full_name || (
                        row.pending_phone
                          ? <span className="inline-flex items-center gap-1 text-amber-700 text-xs font-semibold bg-amber-50 px-2 py-0.5 rounded-full"><Clock className="w-3 h-3" />Pending signup</span>
                          : '—'
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">{row.customer?.phone || row.pending_phone || '—'}</td>
                    <td className="px-4 py-3 font-semibold">{row.coupon?.code || '—'}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{new Date(row.created_at).toLocaleString('en-IN')}</td>
                    <td className="px-4 py-3">
                      <PcmStatusBadge status={row.redeemed_at ? 'Redeemed' : row.coupon?.is_active ? 'Active' : 'Inactive'} />
                    </td>
                    <td className="px-4 py-3">
                      {!row.redeemed_at && (
                        <button
                          className="text-xs px-2 py-1 rounded bg-red-600 text-white hover:bg-red-700"
                          onClick={() => removeAssignment(row.id)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#e6e0da] bg-[#f7f3ec]/50">
            <span className="text-xs text-gray-500">
              Page {page} of {totalPages} ({total} total)
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(1)}
                disabled={page === 1}
                className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                First
              </button>
              <button
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
                className="p-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let p: number;
                if (totalPages <= 5) {
                  p = i + 1;
                } else if (page <= 3) {
                  p = i + 1;
                } else if (page >= totalPages - 2) {
                  p = totalPages - 4 + i;
                } else {
                  p = page - 2 + i;
                }
                return (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`px-2.5 py-1 text-xs rounded border ${
                      page === p
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 bg-white hover:bg-gray-50'
                    }`}
                  >
                    {p}
                  </button>
                );
              })}
              <button
                onClick={() => setPage(page + 1)}
                disabled={page === totalPages}
                className="p-1 rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPage(totalPages)}
                disabled={page === totalPages}
                className="px-2 py-1 text-xs rounded border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                Last
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
