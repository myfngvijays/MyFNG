'use client';

import { useEffect, useState } from 'react';
import { Activity, User, Calendar, FileText } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime } from "@/lib/utils";

export default function AuditTrailViewer() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState({
    entity_type: 'ALL',
    event_type: 'ALL',
    date_from: '',
    date_to: ''
  });

  useEffect(() => {
    fetchEvents();
  }, [filter]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter.entity_type !== 'ALL') params.append('entity_type', filter.entity_type);
      if (filter.event_type !== 'ALL') params.append('event_type', filter.event_type);
      if (filter.date_from) params.append('date_from', filter.date_from);
      if (filter.date_to) params.append('date_to', filter.date_to);

      const response = await fetch(`/api/finance-events?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setEvents(data.events || []);
      }
    } catch (error) {
      toast.error('Failed to load audit trail');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-5 lg:p-6">
      <div className="mb-4 sm:mb-5 md:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">Audit Trail</h1>
        <p className="text-gray-600 text-xs sm:text-sm md:text-base">Complete financial transaction history and events</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg shadow mb-4 sm:mb-5 md:mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Entity Type</label>
            <select
              value={filter.entity_type}
              onChange={(e) => setFilter({...filter, entity_type: e.target.value})}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm"
            >
              <option value="ALL">All Types</option>
              <option value="invoice">Invoice</option>
              <option value="payment">Payment</option>
              <option value="refund">Refund</option>
              <option value="payout">Payout</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Event Type</label>
            <select
              value={filter.event_type}
              onChange={(e) => setFilter({...filter, event_type: e.target.value})}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm"
            >
              <option value="ALL">All Events</option>
              <option value="invoice_generated">Invoice Generated</option>
              <option value="invoice_approved">Invoice Approved</option>
              <option value="payment_received">Payment Received</option>
              <option value="refund_approved">Refund Approved</option>
              <option value="payout_executed">Payout Executed</option>
            </select>
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">From Date</label>
            <input
              type="date"
              value={filter.date_from}
              onChange={(e) => setFilter({...filter, date_from: e.target.value})}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm"
            />
          </div>

          <div>
            <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">To Date</label>
            <input
              type="date"
              value={filter.date_to}
              onChange={(e) => setFilter({...filter, date_to: e.target.value})}
              className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm"
            />
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      {loading ? (
        <div className="text-center py-8 sm:py-10 md:py-12">
          <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 sm:py-10 md:py-12 bg-gray-50 rounded-lg">
          <FileText className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-2 sm:mb-3 md:mb-4" />
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">No events found</p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {events.map((event, index) => (
            <div key={event.id} className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg shadow border-l-4 border-l-blue-500">
              <div className="flex items-start justify-between gap-3 sm:gap-4">
                <div className="flex gap-2 sm:gap-3 md:gap-4 flex-1 min-w-0">
                  <div className="flex-shrink-0">
                    <Activity className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                      <h3 className="font-bold text-sm sm:text-base md:text-lg truncate">{event.event_type.replace(/_/g, ' ').toUpperCase()}</h3>
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded-full text-xs sm:text-sm">
                        {event.entity_type}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs sm:text-sm mb-2 sm:mb-3">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600">Actor:</span>
                        <span className="font-medium truncate">{event.actor_name || event.actor_role || 'System'}</span>
                      </div>
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium">{formatDateTime(event.created_at)}</span>
                      </div>
                      <div className="min-w-0">
                        <span className="text-gray-600">Entity ID:</span>
                        <span className="font-mono text-[10px] sm:text-xs ml-1 sm:ml-2 truncate">{event.entity_id.substr(0, 8)}...</span>
                      </div>
                    </div>

                    {event.event_data && Object.keys(event.event_data).length > 0 && (
                      <details className="mt-2 sm:mt-3">
                        <summary className="cursor-pointer text-xs sm:text-sm font-medium text-blue-600 hover:text-blue-800">
                          View Details
                        </summary>
                        <pre className="mt-1.5 sm:mt-2 p-2 sm:p-3 bg-gray-50 rounded text-[10px] sm:text-xs overflow-x-auto">
                          {JSON.stringify(event.event_data, null, 2)}
                        </pre>
                      </details>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

