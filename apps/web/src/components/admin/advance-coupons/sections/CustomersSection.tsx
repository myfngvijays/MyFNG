'use client';

import { useEffect, useState, useCallback } from 'react';
import { UserPlus, Users, Trash2, Search, ChevronLeft, ChevronRight, Clock, CheckCircle2, X } from 'lucide-react';
import { PcmPageHeader, PcmStatCard, PcmStatusBadge } from '../shared';

const PAGE_SIZES = [25, 50, 100] as const;

export default function PcmCustomersSection() {
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(25);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [counts, setCounts] = useState({ total: 0, registered: 0, pending: 0, redeemed: 0, open: 0 });
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [filter, setFilter] = useState<'' | 'registered' | 'pending'>('');
  const [couponId, setCouponId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [datePreset, setDatePreset] = useState('');
  const [customDateFrom, setCustomDateFrom] = useState('');
  const [customDateTo, setCustomDateTo] = useState('');
  const [coupons, setCoupons] = useState<{ id: string; code: string }[]>([]);

  const fetchData = useCallback(async (p = page, s = search, f = filter, ps = pageSize, cId = couponId, dFrom = dateFrom, dTo = dateTo) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: String(p),
        limit: String(ps),
      });
      if (s) params.set('search', s);
      if (f) params.set('filter', f);
      if (cId) params.set('coupon_id', cId);
      if (dFrom) params.set('date_from', dFrom);
      if (dTo) params.set('date_to', dTo);

      const res = await fetch(`/api/admin/coupons/assignments?${params}`);
      const json = await res.json();
      if (res.ok) {
        setAssignments(json.assignments || []);
        setTotalPages(json.pagination?.total_pages || 1);
        setTotal(json.pagination?.total || 0);
        if (json.counts) setCounts(json.counts);
        if (json.coupons && json.coupons.length > 0) setCoupons(json.coupons);
      }
    } finally {
      setLoading(false);
    }
  }, [page, search, filter, pageSize, couponId, dateFrom, dateTo]);

  useEffect(() => { fetchData(page, search, filter, pageSize, couponId, dateFrom, dateTo); }, [page, search, filter, pageSize, couponId, dateFrom, dateTo]);

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

  const handlePageSize = (size: number) => {
    setPageSize(size);
    setPage(1);
  };

  const removableOnPage = assignments.filter((a) => !a.redeemed_at);
  const allOnPageSelected = removableOnPage.length > 0 && removableOnPage.every((a) => selected.has(a.id));
  const startItem = (page - 1) * pageSize + 1;
  const endItem = Math.min(page * pageSize, total);

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

      {/* Search + Filters Row */}
      <div className="flex items-center gap-2 mb-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            className="w-full pl-9 pr-8 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            placeholder="Search by phone or name…"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          />
          {searchInput && (
            <button onClick={clearSearch} className="absolute right-2.5 top-1/2 -translate-y-1/2">
              <X className="w-3.5 h-3.5 text-gray-400 hover:text-gray-600" />
            </button>
          )}
        </div>
        <button onClick={handleSearch} className="px-3 py-1.5 rounded-lg bg-blue-600 text-white text-xs font-semibold hover:bg-blue-700 shrink-0">
          Search
        </button>
        <div className="w-px h-6 bg-gray-200 shrink-0" />
        <select
          value={couponId}
          onChange={(e) => { setCouponId(e.target.value); setPage(1); }}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-w-[140px] shrink-0"
        >
          <option value="">All Coupons</option>
          {coupons.map((c) => (
            <option key={c.id} value={c.id}>{c.code}</option>
          ))}
        </select>
        <select
          value={datePreset}
          onChange={(e) => {
            const val = e.target.value;
            setDatePreset(val);
            const today = new Date();
            const fmt = (d: Date) => d.toISOString().split('T')[0];
            if (val === '') {
              setDateFrom(''); setDateTo('');
            } else if (val === 'today') {
              setDateFrom(fmt(today)); setDateTo(fmt(today));
            } else if (val === 'yesterday') {
              const y = new Date(today); y.setDate(y.getDate() - 1);
              setDateFrom(fmt(y)); setDateTo(fmt(y));
            } else if (val === '7d') {
              const d = new Date(today); d.setDate(d.getDate() - 7);
              setDateFrom(fmt(d)); setDateTo(fmt(today));
            } else if (val === '14d') {
              const d = new Date(today); d.setDate(d.getDate() - 14);
              setDateFrom(fmt(d)); setDateTo(fmt(today));
            } else if (val === '30d') {
              const d = new Date(today); d.setDate(d.getDate() - 30);
              setDateFrom(fmt(d)); setDateTo(fmt(today));
            }
            setPage(1);
          }}
          className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30 min-w-[120px] shrink-0"
        >
          <option value="">All Time</option>
          <option value="today">Today</option>
          <option value="yesterday">Yesterday</option>
          <option value="7d">Last 7 Days</option>
          <option value="14d">Last 14 Days</option>
          <option value="30d">Last 30 Days</option>
          <option value="custom">Custom Range</option>
        </select>
        <div className="w-px h-6 bg-gray-200 shrink-0" />
        <div className="flex gap-1 shrink-0">
          {([
            { id: '' as const, label: 'All' },
            { id: 'registered' as const, label: 'Registered' },
            { id: 'pending' as const, label: 'Pending' },
          ]).map((f) => (
            <button
              key={f.id}
              onClick={() => handleFilter(f.id)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                filter === f.id
                  ? 'bg-blue-600 text-white border-blue-600'
                  : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
        {(couponId || datePreset) && (
          <button
            onClick={() => { setCouponId(''); setDateFrom(''); setDateTo(''); setDatePreset(''); setCustomDateFrom(''); setCustomDateTo(''); setFilter(''); setPage(1); }}
            className="px-2.5 py-1.5 rounded-lg text-xs font-semibold border border-red-200 bg-red-50 text-red-600 hover:bg-red-100 flex items-center gap-1 shrink-0"
          >
            <X className="w-3 h-3" /> Clear
          </button>
        )}
      </div>

      {/* Date Range - inline with custom pickers */}
      {datePreset === 'custom' && (
        <div className="flex items-center gap-2 mb-3">
          <input
            type="date"
            value={customDateFrom}
            onChange={(e) => { setCustomDateFrom(e.target.value); setDateFrom(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
          <span className="text-xs text-gray-400">–</span>
          <input
            type="date"
            value={customDateTo}
            onChange={(e) => { setCustomDateTo(e.target.value); setDateTo(e.target.value); setPage(1); }}
            className="px-2.5 py-1.5 rounded-lg border border-gray-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
          />
        </div>
      )}

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
        {total > 0 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-[#e6e0da] bg-[#f7f3ec]/50">
            <div className="flex items-center gap-3">
              <span className="text-xs text-gray-500">
                Page {page} of {totalPages} ({total} total)
              </span>
              <div className="flex items-center gap-1.5">
                <span className="text-xs text-gray-400">Show:</span>
                {PAGE_SIZES.map((size) => (
                  <button
                    key={size}
                    onClick={() => handlePageSize(size)}
                    className={`px-2 py-0.5 text-xs rounded border ${
                      pageSize === size
                        ? 'bg-blue-600 text-white border-blue-600'
                        : 'border-gray-200 bg-white hover:bg-gray-50 text-gray-600'
                    }`}
                  >
                    {size}
                  </button>
                ))}
              </div>
            </div>
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
