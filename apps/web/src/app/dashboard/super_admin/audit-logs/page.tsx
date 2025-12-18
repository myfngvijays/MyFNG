'use client';

import { useEffect, useState } from 'react';
import { AuditLog, AuditLogsResponse } from '@/shared/types/audit';
import { Loader2, Shield, Search, Filter, ChevronLeft, ChevronRight, Eye, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';
import { formatDateTime } from "@/lib/utils";

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    action: '',
    table_name: '',
    user_id: '',
    start_date: '',
    end_date: '',
    action_category: '',
    severity: '',
    api_endpoint: '',
    has_error: '',
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLog | null>(null);

  useEffect(() => {
    fetchAuditLogs();
  }, [page, filters]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters.action) params.append('action', filters.action);
      if (filters.table_name) params.append('table_name', filters.table_name);
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);
      if (filters.action_category) params.append('action_category', filters.action_category);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.api_endpoint) params.append('api_endpoint', filters.api_endpoint);
      if (filters.has_error) params.append('has_error', filters.has_error);

      const response = await fetch(`/api/audit/logs?${params.toString()}`);
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        toast.error(errorData.error || 'Failed to fetch audit logs');
        setLogs([]);
        setTotal(0);
        setTotalPages(0);
        return;
      }

      const data: AuditLogsResponse = await response.json();

      setLogs(data.logs || []);
      setTotal(data.total || 0);
      setTotalPages(data.totalPages || 0);
    } catch (error) {
      toast.error('An error occurred while fetching audit logs');
      setLogs([]);
      setTotal(0);
      setTotalPages(0);
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setFilters({
      action: '',
      table_name: '',
      user_id: '',
      start_date: '',
      end_date: '',
      action_category: '',
      severity: '',
      api_endpoint: '',
      has_error: '',
    });
    setPage(1);
  };

  const exportLogs = () => {
    const csv = [
      ['ID', 'User ID', 'Action', 'Action Category', 'Severity', 'Table', 'Record ID', 'API Endpoint', 'HTTP Method', 'Response Status', 'Execution Time (ms)', 'Error Message', 'IP Address', 'Created At'].join(','),
      ...logs.map((log) =>
        [
          log.id,
          log.user_id || 'N/A',
          log.action,
          log.action_category || 'N/A',
          log.severity || 'N/A',
          log.table_name || 'N/A',
          log.record_id || 'N/A',
          log.api_endpoint || 'N/A',
          log.http_method || 'N/A',
          log.response_status || 'N/A',
          log.execution_time_ms || 'N/A',
          log.error_message ? `"${log.error_message.replace(/"/g, '""')}"` : 'N/A',
          log.ip_address || 'N/A',
          formatDateTime(log.created_at),
        ].join(',')
      ),
    ].join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit-logs-${new Date().toISOString()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Logs exported successfully');
  };

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <Shield className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-yellow-300 flex-shrink-0" />
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Audit Logs</h1>
              <p className="text-white/90 text-xs sm:text-sm mt-0.5 sm:mt-1">Complete system activity tracking</p>
            </div>
          </div>
          <div className="text-left sm:text-right flex-shrink-0">
            <p className="text-xl sm:text-2xl font-bold">{total.toLocaleString()}</p>
            <p className="text-xs sm:text-sm text-white/80">Total Logs</p>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="card p-3 sm:p-4">
        <div className="flex flex-col sm:flex-row flex-wrap items-start sm:items-center justify-between gap-3 sm:gap-4">
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
          <button onClick={exportLogs} className="btn-primary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto">
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Export CSV</span>
            <span className="sm:hidden">Export</span>
          </button>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1">Action</label>
              <input
                type="text"
                className="form-input w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                placeholder="e.g. CREATE, UPDATE, DELETE"
                value={filters.action}
                onChange={(e) => handleFilterChange('action', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1">Action Category</label>
              <select
                className="form-select w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                value={filters.action_category}
                onChange={(e) => handleFilterChange('action_category', e.target.value)}
              >
                <option value="">All Categories</option>
                <option value="SECURITY">Security</option>
                <option value="DATA">Data</option>
                <option value="CONFIG">Config</option>
                <option value="API">API</option>
                <option value="ERROR">Error</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1">Severity</label>
              <select
                className="form-select w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                value={filters.severity}
                onChange={(e) => handleFilterChange('severity', e.target.value)}
              >
                <option value="">All Severities</option>
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1">Has Error</label>
              <select
                className="form-select w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                value={filters.has_error}
                onChange={(e) => handleFilterChange('has_error', e.target.value)}
              >
                <option value="">All</option>
                <option value="true">With Errors</option>
                <option value="false">No Errors</option>
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1">Table Name</label>
              <input
                type="text"
                className="form-input w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                placeholder="e.g. service_leads"
                value={filters.table_name}
                onChange={(e) => handleFilterChange('table_name', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1">API Endpoint</label>
              <input
                type="text"
                className="form-input w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                placeholder="e.g. /api/leads"
                value={filters.api_endpoint}
                onChange={(e) => handleFilterChange('api_endpoint', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-text-body mb-1">User ID</label>
              <input
                type="text"
                className="form-input w-full text-xs sm:text-sm px-2 sm:px-3 py-1.5 sm:py-2"
                placeholder="Enter user ID"
                value={filters.user_id}
                onChange={(e) => handleFilterChange('user_id', e.target.value)}
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

      {/* Logs Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-8 sm:py-10 md:py-12">
            <Loader2 className="h-7 w-7 sm:h-8 sm:w-8 animate-spin text-brand-primary" />
            <p className="ml-2 sm:ml-3 text-text-body text-xs sm:text-sm">Loading logs...</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="text-center py-8 sm:py-10 md:py-12 text-text-body">
            <Shield className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 mx-auto text-gray-300 mb-3 sm:mb-4" />
            <p className="text-sm sm:text-base">No audit logs found</p>
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
                      User
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Action
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Category
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severity
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Table
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      API Endpoint
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-text-body">
                        <span title={formatDateTime(log.created_at)}>
                          {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-text-body">
                        {log.user_id ? (
                          <span className="font-mono text-[10px] sm:text-xs">{log.user_id.slice(0, 8)}...</span>
                        ) : (
                          <span className="text-gray-400">System</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${
                            log.action === 'CREATE'
                              ? 'bg-green-100 text-green-800'
                              : log.action === 'UPDATE'
                              ? 'bg-blue-100 text-blue-800'
                              : log.action === 'DELETE'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {log.action}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-text-body">
                        {log.action_category ? (
                          <span className="px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-purple-100 text-purple-800 rounded">
                            {log.action_category}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                        {log.severity ? (
                          <span
                            className={`px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded ${
                              log.severity === 'CRITICAL'
                                ? 'bg-red-100 text-red-800'
                                : log.severity === 'HIGH'
                                ? 'bg-orange-100 text-orange-800'
                                : log.severity === 'MEDIUM'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {log.severity}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-text-body font-mono">
                        {log.table_name || 'N/A'}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-text-body">
                        {log.api_endpoint ? (
                          <span className="font-mono text-[10px] sm:text-xs" title={log.api_endpoint}>
                            {log.api_endpoint.length > 30 ? `${log.api_endpoint.substring(0, 30)}...` : log.api_endpoint}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm text-text-body">
                        {log.error_message ? (
                          <span className="px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs bg-red-100 text-red-800 rounded" title={log.error_message}>
                            Error
                          </span>
                        ) : log.response_status ? (
                          <span
                            className={`px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs rounded ${
                              log.response_status >= 200 && log.response_status < 300
                                ? 'bg-green-100 text-green-800'
                                : log.response_status >= 400
                                ? 'bg-red-100 text-red-800'
                                : 'bg-yellow-100 text-yellow-800'
                            }`}
                          >
                            {log.response_status}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap text-xs sm:text-sm">
                        <button
                          onClick={() => setSelectedLog(log)}
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
              {logs.map((log) => (
                <div key={log.id} className="p-3 sm:p-4 hover:bg-gray-50 transition">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1.5">
                        <span
                          className={`px-2 py-0.5 text-[10px] font-semibold rounded-full ${
                            log.action === 'CREATE'
                              ? 'bg-green-100 text-green-800'
                              : log.action === 'UPDATE'
                              ? 'bg-blue-100 text-blue-800'
                              : log.action === 'DELETE'
                              ? 'bg-red-100 text-red-800'
                              : 'bg-gray-100 text-gray-800'
                          }`}
                        >
                          {log.action}
                        </span>
                        {log.action_category && (
                          <span className="px-2 py-0.5 text-[10px] bg-purple-100 text-purple-800 rounded">
                            {log.action_category}
                          </span>
                        )}
                        {log.severity && (
                          <span
                            className={`px-2 py-0.5 text-[10px] font-semibold rounded ${
                              log.severity === 'CRITICAL'
                                ? 'bg-red-100 text-red-800'
                                : log.severity === 'HIGH'
                                ? 'bg-orange-100 text-orange-800'
                                : log.severity === 'MEDIUM'
                                ? 'bg-yellow-100 text-yellow-800'
                                : 'bg-green-100 text-green-800'
                            }`}
                          >
                            {log.severity}
                          </span>
                        )}
                      </div>
                      <div className="text-xs sm:text-sm text-gray-600 mb-1">
                        {formatDistanceToNow(new Date(log.created_at), { addSuffix: true })}
                      </div>
                    </div>
                    <button
                      onClick={() => setSelectedLog(log)}
                      className="text-brand-primary hover:text-brand-secondary flex items-center gap-1 text-xs sm:text-sm flex-shrink-0"
                    >
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      View
                    </button>
                  </div>
                  <div className="space-y-1 text-xs sm:text-sm">
                    <div>
                      <span className="text-gray-500">User: </span>
                      <span className="text-gray-900 font-mono">
                        {log.user_id ? `${log.user_id.slice(0, 8)}...` : 'System'}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-500">Table: </span>
                      <span className="text-gray-900 font-mono">{log.table_name || 'N/A'}</span>
                    </div>
                    {log.api_endpoint && (
                      <div>
                        <span className="text-gray-500">API: </span>
                        <span className="text-gray-900 font-mono text-[10px] sm:text-xs truncate block">
                          {log.api_endpoint.length > 40 ? `${log.api_endpoint.substring(0, 40)}...` : log.api_endpoint}
                        </span>
                      </div>
                    )}
                    <div>
                      <span className="text-gray-500">Status: </span>
                      {log.error_message ? (
                        <span className="px-2 py-0.5 text-[10px] bg-red-100 text-red-800 rounded">Error</span>
                      ) : log.response_status ? (
                        <span
                          className={`px-2 py-0.5 text-[10px] rounded ${
                            log.response_status >= 200 && log.response_status < 300
                              ? 'bg-green-100 text-green-800'
                              : log.response_status >= 400
                              ? 'bg-red-100 text-red-800'
                              : 'bg-yellow-100 text-yellow-800'
                          }`}
                        >
                          {log.response_status}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
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
            <span className="font-semibold">{total}</span> logs
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
      {selectedLog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-3 sm:p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-5 md:p-6 border-b border-gray-200">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-text-heading">Audit Log Details</h2>
            </div>
            <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Log ID</p>
                  <p className="text-xs sm:text-sm text-text-body font-mono break-all">{selectedLog.id}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Timestamp</p>
                  <p className="text-xs sm:text-sm text-text-body">{formatDateTime(selectedLog.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">User ID</p>
                  <p className="text-xs sm:text-sm text-text-body font-mono break-all">{selectedLog.user_id || 'System'}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Action</p>
                  <p className="text-xs sm:text-sm text-text-body font-semibold">{selectedLog.action}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Table Name</p>
                  <p className="text-xs sm:text-sm text-text-body font-mono">{selectedLog.table_name || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">Record ID</p>
                  <p className="text-xs sm:text-sm text-text-body font-mono break-all">{selectedLog.record_id || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">IP Address</p>
                  <p className="text-xs sm:text-sm text-text-body">{selectedLog.ip_address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500">User Agent</p>
                  <p className="text-xs sm:text-sm text-text-body truncate" title={selectedLog.user_agent || 'N/A'}>
                    {selectedLog.user_agent || 'N/A'}
                  </p>
                </div>
                {selectedLog.action_category && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Action Category</p>
                    <p className="text-xs sm:text-sm text-text-body">{selectedLog.action_category}</p>
                  </div>
                )}
                {selectedLog.severity && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Severity</p>
                    <p className="text-xs sm:text-sm text-text-body">{selectedLog.severity}</p>
                  </div>
                )}
                {selectedLog.api_endpoint && (
                  <div className="sm:col-span-2">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">API Endpoint</p>
                    <p className="text-xs sm:text-sm text-text-body font-mono break-all">{selectedLog.api_endpoint}</p>
                  </div>
                )}
                {selectedLog.http_method && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">HTTP Method</p>
                    <p className="text-xs sm:text-sm text-text-body">{selectedLog.http_method}</p>
                  </div>
                )}
                {selectedLog.response_status && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Response Status</p>
                    <p className="text-xs sm:text-sm text-text-body">{selectedLog.response_status}</p>
                  </div>
                )}
                {selectedLog.execution_time_ms && (
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Execution Time</p>
                    <p className="text-xs sm:text-sm text-text-body">{selectedLog.execution_time_ms} ms</p>
                  </div>
                )}
                {selectedLog.error_message && (
                  <div className="sm:col-span-2">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Error Message</p>
                    <p className="text-xs sm:text-sm text-red-600 break-words">{selectedLog.error_message}</p>
                  </div>
                )}
                {selectedLog.error_stack && (
                  <div className="sm:col-span-2">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Error Stack</p>
                    <pre className="bg-red-50 p-2 sm:p-3 md:p-4 rounded text-[10px] sm:text-xs overflow-x-auto text-red-800">
                      {selectedLog.error_stack}
                    </pre>
                  </div>
                )}
                {selectedLog.data_hash && (
                  <div className="sm:col-span-2">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Data Hash</p>
                    <p className="text-xs sm:text-sm text-text-body font-mono break-all">{selectedLog.data_hash}</p>
                  </div>
                )}
                {selectedLog.compliance_flags && Object.keys(selectedLog.compliance_flags).length > 0 && (
                  <div className="sm:col-span-2">
                    <p className="text-xs sm:text-sm font-medium text-gray-500">Compliance Flags</p>
                    <pre className="bg-gray-100 p-2 sm:p-3 md:p-4 rounded text-[10px] sm:text-xs overflow-x-auto">
                      {JSON.stringify(selectedLog.compliance_flags, null, 2)}
                    </pre>
                  </div>
                )}
              </div>

              {selectedLog.old_data && (
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1.5 sm:mb-2">Old Data</p>
                  <pre className="bg-gray-100 p-2 sm:p-3 md:p-4 rounded text-[10px] sm:text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.old_data, null, 2)}
                  </pre>
                </div>
              )}

              {selectedLog.new_data && (
                <div>
                  <p className="text-xs sm:text-sm font-medium text-gray-500 mb-1.5 sm:mb-2">New Data</p>
                  <pre className="bg-gray-100 p-2 sm:p-3 md:p-4 rounded text-[10px] sm:text-xs overflow-x-auto">
                    {JSON.stringify(selectedLog.new_data, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-4 sm:p-5 md:p-6 border-t border-gray-200 flex justify-end">
              <button onClick={() => setSelectedLog(null)} className="btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
