'use client';

import { useEffect, useState } from 'react';
import { UserPlus, Users, Trash2 } from 'lucide-react';
import { PcmPageHeader, PcmStatCard, PcmStatusBadge } from '../shared';

export default function PcmCustomersSection() {
  const [dashboard, setDashboard] = useState<any>(null);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState(false);

  const fetchData = async () => {
    try {
      const [dRes, aRes] = await Promise.all([
        fetch('/api/admin/coupons/pcms-dashboard'),
        fetch('/api/admin/coupons/assignments?limit=100'),
      ]);
      const dJson = await dRes.json();
      const aJson = await aRes.json();
      if (dRes.ok) setDashboard(dJson);
      if (aRes.ok) setAssignments(aJson.assignments || []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    const removable = assignments.filter((a) => !a.redeemed_at);
    if (selected.size === removable.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(removable.map((a) => a.id)));
    }
  };

  const removeAssignment = async (id: string) => {
    if (!window.confirm('Remove this coupon assignment?')) return;
    try {
      const res = await fetch(`/api/admin/coupons/assignments?id=${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to remove assignment');
      setAssignments((prev) => prev.filter((a) => a.id !== id));
      setSelected((prev) => { const next = new Set(prev); next.delete(id); return next; });
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
      setAssignments((prev) => prev.filter((a) => !selected.has(a.id)));
      setSelected(new Set());
    } catch (err: any) {
      alert(err?.message || 'Failed to remove assignments');
    } finally {
      setRemoving(false);
    }
  };

  if (loading) return <div className="h-40 pcm-card rounded-xl border animate-pulse" />;

  const activeAssignments = assignments.filter((a) => !a.redeemed_at);
  const removableIds = new Set(activeAssignments.map((a) => a.id));
  const allSelected = removableIds.size > 0 && selected.size === removableIds.size;

  return (
    <div>
      <PcmPageHeader
        title="Customer Assignments"
        description="Real personal coupons assigned to customers — visible in app under My Coupons"
      />

      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-5">
        <PcmStatCard label="Total Customers" value={dashboard?.kpis?.total_customers || 0} icon={<Users className="w-5 h-5" />} accent="sky" />
        <PcmStatCard label="Total Assignments" value={dashboard?.kpis?.total_assignments || 0} icon={<UserPlus className="w-5 h-5" />} accent="primary" />
        <PcmStatCard label="Open Assignments" value={activeAssignments.length} icon={<UserPlus className="w-5 h-5" />} accent="emerald" />
      </div>

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

      <div className="pcm-card rounded-xl border overflow-hidden">
        <div className="p-4 border-b border-[#e6e0da] font-bold">Assigned Coupons</div>
        <table className="w-full text-sm">
          <thead className="bg-[#f7f3ec]">
            <tr>
              <th className="px-4 py-3 text-left w-10">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={selectAll}
                  className="rounded"
                />
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
                  No assignments yet. Go to Assign Coupons to give personal coupons.
                </td>
              </tr>
            ) : (
              assignments.map((row) => (
                <tr key={row.id} className={`border-t border-[#e6e0da] ${selected.has(row.id) ? 'bg-red-50' : ''}`}>
                  <td className="px-4 py-3">
                    {!row.redeemed_at && (
                      <input
                        type="checkbox"
                        checked={selected.has(row.id)}
                        onChange={() => toggleSelect(row.id)}
                        className="rounded"
                      />
                    )}
                  </td>
                  <td className="px-4 py-3 font-medium">{row.customer?.full_name || '—'}</td>
                  <td className="px-4 py-3">{row.customer?.phone || '—'}</td>
                  <td className="px-4 py-3 font-semibold">{row.coupon?.code || '—'}</td>
                  <td className="px-4 py-3">{new Date(row.created_at).toLocaleString('en-IN')}</td>
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
      </div>
    </div>
  );
}
