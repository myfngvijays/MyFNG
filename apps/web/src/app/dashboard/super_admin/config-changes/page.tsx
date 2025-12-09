'use client';

import { useEffect, useState } from 'react';
import { SystemConfigChange } from '@/shared/types/audit';
import { Loader2, Settings, Filter, ChevronLeft, ChevronRight, Eye, History } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface ConfigChangesResponse {
  changes: SystemConfigChange[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function ConfigChangesPage() {
  const [changes, setChanges] = useState<SystemConfigChange[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    config_key: '',
    changed_by: '',
    start_date: '',
    end_date: '',
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedChange, setSelectedChange] = useState<SystemConfigChange | null>(null);

  useEffect(() => {
    fetchConfigChanges();
  }, [page, filters]);

  const fetchConfigChanges = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters.config_key) params.append('config_key', filters.config_key);
      if (filters.changed_by) params.append('changed_by', filters.changed_by);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await fetch(`/api/audit/config-changes?${params.toString()}`);
      const data: ConfigChangesResponse = await response.json();

      if (response.ok) {
        setChanges(data.changes);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        toast.error('Failed to fetch config changes');
      }
    } catch (error) {
      console.error('Error fetching config changes:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1);
  };

  const clearFilters = () => {
    setFilters({
      config_key: '',
      changed_by: '',
      start_date: '',
      end_date: '',
    });
    setPage(1);
  };

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Settings className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-300 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">System Configuration Changes</h1>
              <p className="text-white/90 text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Track all system configuration modifications</p>
            </div>
          </div>
          <div className="text-left sm:text-right flex-shrink-0">
            <p className="text-xl sm:text-2xl font-bold">{total.toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-white/80">Total Changes</p>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <div className="flex flex-wrap items-center gap-2 sm:gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
            >
              <Filter className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            {Object.values(filters).some((v) => v) && (
              <button onClick={clearFilters} className="text-xs sm:text-sm text-brand-primary hover:underline">
                Clear All Filters
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1">Config Key</label>
              <input
                type="text"
                className="form-input w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                placeholder="e.g. system.max_users"
                value={filters.config_key}
                onChange={(e) => handleFilterChange('config_key', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1">Changed By</label>
              <input
                type="text"
                className="form-input w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                placeholder="Enter user ID"
                value={filters.changed_by}
                onChange={(e) => handleFilterChange('changed_by', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1">Start Date</label>
              <input
                type="date"
                className="form-input w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1">End Date</label>
              <input
                type="date"
                className="form-input w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Changes Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8 sm:py-10 md:py-12">
            <Loader2 className="h-7 w-7 sm:h-8 sm:w-8 animate-spin text-brand-primary" />
            <p className="ml-2 sm:ml-3 text-text-body text-xs sm:text-sm">Loading changes...</p>
          </div>
        ) : changes.length === 0 ? (
          <div className="text-center py-8 sm:py-10 md:py-12 text-text-body">
            <History className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto text-gray-300 mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base">No configuration changes found</p>
          </div>
        ) : (
          <>
            {/* Desktop Table */}
            <div className="hidden lg:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Config Key
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Old Value
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      New Value
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Changed By
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Approved By
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {changes.map((change) => (
                    <tr key={change.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-text-body">
                        <span title={new Date(change.created_at).toLocaleString()}>
                          {formatDistanceToNow(new Date(change.created_at), { addSuffix: true })}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-text-body font-mono">
                        {change.config_key}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm text-text-body">
                        <div className="max-w-xs truncate" title={change.old_value || 'N/A'}>
                          {change.old_value ? (
                            <span className="text-red-600">{change.old_value}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm text-text-body">
                        <div className="max-w-xs truncate" title={change.new_value || 'N/A'}>
                          {change.new_value ? (
                            <span className="text-green-600">{change.new_value}</span>
                          ) : (
                            <span className="text-gray-400">-</span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-text-body">
                        {change.changed_by ? (
                          <span className="font-mono text-[10px] sm:text-xs">{change.changed_by.slice(0, 8)}...</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-text-body">
                        {change.approved_by ? (
                          <span className="font-mono text-[10px] sm:text-xs">{change.approved_by.slice(0, 8)}...</span>
                        ) : (
                          <span className="text-gray-400">Pending</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm">
                        <button
                          onClick={() => setSelectedChange(change)}
                          className="text-brand-primary hover:text-brand-secondary flex items-center gap-1"
                        >
                          <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          View
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards */}
            <div className="lg:hidden divide-y divide-gray-200">
              {changes.map((change) => (
                <div key={change.id} className="p-3 sm:p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-xs sm:text-sm font-mono text-gray-900 mb-1 truncate">{change.config_key}</div>
                      <div className="text-[10px] sm:text-xs text-gray-600 mb-2">
                        {formatDistanceToNow(new Date(change.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedChange(change)}
                      className="text-brand-primary hover:text-brand-secondary flex items-center gap-1 text-xs sm:text-sm flex-shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      View
                    </button>
                  </div>
                  <div className="space-y-1.5 text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-500">Old: </span>
                      <span className="text-red-600 truncate block">{change.old_value || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">New: </span>
                      <span className="text-green-600 truncate block">{change.new_value || '-'}</span>
                    </div>
                    <div>
                      <span className="text-gray-500">Changed By: </span>
                      <span className="text-gray-900 font-mono text-[10px] sm:text-xs">
                        {change.changed_by ? `${change.changed_by.slice(0, 8)}...` : '-'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Approved By: </span>
                      <span className="text-gray-900 font-mono text-[10px] sm:text-xs">
                        {change.approved_by ? `${change.approved_by.slice(0, 8)}...` : 'Pending'}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 card p-3 sm:p-4">
          <div className="text-xs sm:text-sm text-text-body">
            Showing <span className="font-semibold">{(page - 1) * limit + 1}</span> to{' '}
            <span className="font-semibold">{Math.min(page * limit, total)}</span> of{' '}
            <span className="font-semibold">{total}</span> changes
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
            >
              <ChevronLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Previous
            </button>
            <span className="text-xs sm:text-sm text-text-body">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
            >
              Next
              <ChevronRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedChange && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-5 md:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-text-heading">Configuration Change Details</h2>
            </div>
            <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Change ID</p>
                  <p className="text-xs sm:text-sm text-text-body font-mono break-all">{selectedChange.id}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Timestamp</p>
                  <p className="text-xs sm:text-sm text-text-body">{new Date(selectedChange.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Config Key</p>
                  <p className="text-xs sm:text-sm text-text-body font-mono break-all">{selectedChange.config_key}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Changed By</p>
                  <p className="text-xs sm:text-sm text-text-body font-mono break-all">{selectedChange.changed_by || 'N/A'}</p>
                </div>
                {selectedChange.approved_by && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Approved By</p>
                    <p className="text-xs sm:text-sm text-text-body font-mono break-all">{selectedChange.approved_by}</p>
                  </div>
                )}
                {selectedChange.change_reason && (
                  <div className="sm:col-span-2">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Change Reason</p>
                    <p className="text-xs sm:text-sm text-text-body">{selectedChange.change_reason}</p>
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1.5 sm:mb-2">Old Value</p>
                  <pre className="bg-red-50 p-2 sm:p-3 md:p-4 rounded text-[10px] sm:text-xs overflow-x-auto border border-red-200">
                    {selectedChange.old_value || 'N/A'}
                  </pre>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1.5 sm:mb-2">New Value</p>
                  <pre className="bg-green-50 p-2 sm:p-3 md:p-4 rounded text-[10px] sm:text-xs overflow-x-auto border border-green-200">
                    {selectedChange.new_value || 'N/A'}
                  </pre>
                </div>
              </div>
            </div>
            <div className="p-4 sm:p-5 md:p-6 border-t border-gray-200 flex justify-end">
              <button onClick={() => setSelectedChange(null)} className="btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

