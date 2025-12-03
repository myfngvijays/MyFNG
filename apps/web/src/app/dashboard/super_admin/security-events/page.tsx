'use client';

import { useEffect, useState } from 'react';
import { SecurityEvent } from '@/shared/types/audit';
import { Loader2, Shield, AlertTriangle, CheckCircle, XCircle, Filter, ChevronLeft, ChevronRight, Eye } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

interface SecurityEventsResponse {
  events: SecurityEvent[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function SecurityEventsPage() {
  const [events, setEvents] = useState<SecurityEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit] = useState(50);
  const [totalPages, setTotalPages] = useState(0);

  // Filters
  const [filters, setFilters] = useState({
    event_type: '',
    user_id: '',
    severity: '',
    resolved: '',
    start_date: '',
    end_date: '',
  });

  const [showFilters, setShowFilters] = useState(false);
  const [selectedEvent, setSelectedEvent] = useState<SecurityEvent | null>(null);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    fetchSecurityEvents();
  }, [page, filters]);

  const fetchSecurityEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (filters.event_type) params.append('event_type', filters.event_type);
      if (filters.user_id) params.append('user_id', filters.user_id);
      if (filters.severity) params.append('severity', filters.severity);
      if (filters.resolved) params.append('resolved', filters.resolved);
      if (filters.start_date) params.append('start_date', filters.start_date);
      if (filters.end_date) params.append('end_date', filters.end_date);

      const response = await fetch(`/api/audit/security-events?${params.toString()}`);
      const data: SecurityEventsResponse = await response.json();

      if (response.ok) {
        setEvents(data.events);
        setTotal(data.total);
        setTotalPages(data.totalPages);
      } else {
        toast.error('Failed to fetch security events');
      }
    } catch (error) {
      console.error('Error fetching security events:', error);
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
      event_type: '',
      user_id: '',
      severity: '',
      resolved: '',
      start_date: '',
      end_date: '',
    });
    setPage(1);
  };

  const handleResolve = async (eventId: string, resolved: boolean) => {
    setResolving(eventId);
    try {
      const response = await fetch(`/api/audit/security-events/${eventId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved }),
      });

      if (response.ok) {
        toast.success(resolved ? 'Event marked as resolved' : 'Event marked as unresolved');
        fetchSecurityEvents();
        if (selectedEvent?.id === eventId) {
          setSelectedEvent(null);
        }
      } else {
        toast.error('Failed to update event');
      }
    } catch (error) {
      console.error('Error resolving event:', error);
      toast.error('An error occurred');
    } finally {
      setResolving(null);
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 text-red-800 border-red-300';
      case 'HIGH':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'MEDIUM':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'LOW':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getEventTypeLabel = (eventType: string) => {
    return eventType.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
  };

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-red-600 to-orange-600 text-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-8 h-8 text-yellow-300" />
            <div>
              <h1 className="text-3xl font-bold">Security Events</h1>
              <p className="text-white/90 mt-1">Monitor and manage security incidents</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">{total.toLocaleString()}</p>
            <p className="text-sm text-white/80">Total Events</p>
          </div>
        </div>
      </div>

      {/* Filters & Actions */}
      <div className="card p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="btn-secondary flex items-center gap-2"
            >
              <Filter className="w-4 h-4" />
              {showFilters ? 'Hide Filters' : 'Show Filters'}
            </button>
            {Object.values(filters).some((v) => v) && (
              <button onClick={clearFilters} className="text-sm text-brand-primary hover:underline">
                Clear All Filters
              </button>
            )}
          </div>
        </div>

        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-4 pt-4 border-t border-gray-200">
            <div>
              <label className="block text-sm font-medium text-text-body mb-1">Event Type</label>
              <select
                className="form-select w-full"
                value={filters.event_type}
                onChange={(e) => handleFilterChange('event_type', e.target.value)}
              >
                <option value="">All Types</option>
                <option value="FAILED_LOGIN">Failed Login</option>
                <option value="PERMISSION_DENIED">Permission Denied</option>
                <option value="RLS_VIOLATION">RLS Violation</option>
                <option value="SUSPICIOUS_ACTIVITY">Suspicious Activity</option>
                <option value="UNAUTHORIZED_ACCESS">Unauthorized Access</option>
                <option value="BRUTE_FORCE_ATTEMPT">Brute Force Attempt</option>
                <option value="SQL_INJECTION_ATTEMPT">SQL Injection Attempt</option>
                <option value="XSS_ATTEMPT">XSS Attempt</option>
                <option value="CSRF_ATTEMPT">CSRF Attempt</option>
                <option value="RATE_LIMIT_EXCEEDED">Rate Limit Exceeded</option>
                <option value="INVALID_TOKEN">Invalid Token</option>
                <option value="PRIVILEGE_ESCALATION">Privilege Escalation</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-body mb-1">Severity</label>
              <select
                className="form-select w-full"
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
              <label className="block text-sm font-medium text-text-body mb-1">Status</label>
              <select
                className="form-select w-full"
                value={filters.resolved}
                onChange={(e) => handleFilterChange('resolved', e.target.value)}
              >
                <option value="">All</option>
                <option value="false">Unresolved</option>
                <option value="true">Resolved</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-text-body mb-1">User ID</label>
              <input
                type="text"
                className="form-input w-full"
                placeholder="Enter user ID"
                value={filters.user_id}
                onChange={(e) => handleFilterChange('user_id', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-body mb-1">Start Date</label>
              <input
                type="date"
                className="form-input w-full"
                value={filters.start_date}
                onChange={(e) => handleFilterChange('start_date', e.target.value)}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-text-body mb-1">End Date</label>
              <input
                type="date"
                className="form-input w-full"
                value={filters.end_date}
                onChange={(e) => handleFilterChange('end_date', e.target.value)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Events Table */}
      <div className="card overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
            <p className="ml-3 text-text-body">Loading events...</p>
          </div>
        ) : events.length === 0 ? (
          <div className="text-center py-12 text-text-body">
            <Shield className="w-16 h-16 mx-auto text-gray-300 mb-4" />
            <p>No security events found</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Timestamp
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Event Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Severity
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    IP Address
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {events.map((event) => (
                  <tr key={event.id} className={`hover:bg-gray-50 transition-colors ${event.resolved ? 'opacity-60' : ''}`}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-body">
                      <span title={new Date(event.created_at).toLocaleString()}>
                        {formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-body">
                      {getEventTypeLabel(event.event_type)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 text-xs font-semibold rounded border ${getSeverityColor(event.severity)}`}>
                        {event.severity}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-body">
                      {event.user_id ? (
                        <span className="font-mono text-xs">{event.user_id.slice(0, 8)}...</span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-text-body">
                      {event.ip_address || 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {event.resolved ? (
                        <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded flex items-center gap-1 w-fit">
                          <CheckCircle className="w-3 h-3" />
                          Resolved
                        </span>
                      ) : (
                        <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded flex items-center gap-1 w-fit">
                          <XCircle className="w-3 h-3" />
                          Unresolved
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setSelectedEvent(event)}
                          className="text-brand-primary hover:text-brand-secondary flex items-center gap-1"
                        >
                          <Eye className="w-4 h-4" />
                          View
                        </button>
                        {!event.resolved && (
                          <button
                            onClick={() => handleResolve(event.id, true)}
                            disabled={resolving === event.id}
                            className="text-green-600 hover:text-green-700 flex items-center gap-1 disabled:opacity-50"
                          >
                            {resolving === event.id ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <CheckCircle className="w-4 h-4" />
                            )}
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between card p-4">
          <div className="text-sm text-text-body">
            Showing <span className="font-semibold">{(page - 1) * limit + 1}</span> to{' '}
            <span className="font-semibold">{Math.min(page * limit, total)}</span> of{' '}
            <span className="font-semibold">{total}</span> events
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="btn-secondary flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ChevronLeft className="w-4 h-4" />
              Previous
            </button>
            <span className="text-sm text-text-body">
              Page {page} of {totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="btn-secondary flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {selectedEvent && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-2xl font-bold text-text-heading">Security Event Details</h2>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm font-medium text-gray-500">Event ID</p>
                  <p className="text-sm text-text-body font-mono">{selectedEvent.id}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Timestamp</p>
                  <p className="text-sm text-text-body">{new Date(selectedEvent.created_at).toLocaleString()}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Event Type</p>
                  <p className="text-sm text-text-body">{getEventTypeLabel(selectedEvent.event_type)}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Severity</p>
                  <span className={`px-2 py-1 text-xs font-semibold rounded border ${getSeverityColor(selectedEvent.severity)}`}>
                    {selectedEvent.severity}
                  </span>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">User ID</p>
                  <p className="text-sm text-text-body font-mono">{selectedEvent.user_id || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">IP Address</p>
                  <p className="text-sm text-text-body">{selectedEvent.ip_address || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-500">Status</p>
                  {selectedEvent.resolved ? (
                    <span className="px-2 py-1 text-xs bg-green-100 text-green-800 rounded">
                      Resolved
                    </span>
                  ) : (
                    <span className="px-2 py-1 text-xs bg-red-100 text-red-800 rounded">
                      Unresolved
                    </span>
                  )}
                </div>
                {selectedEvent.resolved && selectedEvent.resolved_at && (
                  <div>
                    <p className="text-sm font-medium text-gray-500">Resolved At</p>
                    <p className="text-sm text-text-body">{new Date(selectedEvent.resolved_at).toLocaleString()}</p>
                  </div>
                )}
                {selectedEvent.user_agent && (
                  <div className="col-span-2">
                    <p className="text-sm font-medium text-gray-500">User Agent</p>
                    <p className="text-sm text-text-body truncate" title={selectedEvent.user_agent}>
                      {selectedEvent.user_agent}
                    </p>
                  </div>
                )}
              </div>

              {selectedEvent.event_details && Object.keys(selectedEvent.event_details).length > 0 && (
                <div>
                  <p className="text-sm font-medium text-gray-500 mb-2">Event Details</p>
                  <pre className="bg-gray-100 p-4 rounded text-xs overflow-x-auto">
                    {JSON.stringify(selectedEvent.event_details, null, 2)}
                  </pre>
                </div>
              )}
            </div>
            <div className="p-6 border-t border-gray-200 flex justify-end gap-2">
              {!selectedEvent.resolved && (
                <button
                  onClick={() => {
                    handleResolve(selectedEvent.id, true);
                  }}
                  disabled={resolving === selectedEvent.id}
                  className="btn-primary disabled:opacity-50"
                >
                  {resolving === selectedEvent.id ? 'Resolving...' : 'Mark as Resolved'}
                </button>
              )}
              <button onClick={() => setSelectedEvent(null)} className="btn-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

