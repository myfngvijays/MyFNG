'use client';

import { useEffect, useState } from 'react';
import { Activity, User, Calendar, FileText } from 'lucide-react';
import toast from 'react-hot-toast';

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
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Audit Trail</h1>
        <p className="text-gray-600">Complete financial transaction history and events</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-2">Entity Type</label>
            <select
              value={filter.entity_type}
              onChange={(e) => setFilter({...filter, entity_type: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            >
              <option value="ALL">All Types</option>
              <option value="invoice">Invoice</option>
              <option value="payment">Payment</option>
              <option value="refund">Refund</option>
              <option value="payout">Payout</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">Event Type</label>
            <select
              value={filter.event_type}
              onChange={(e) => setFilter({...filter, event_type: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
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
            <label className="block text-sm font-medium mb-2">From Date</label>
            <input
              type="date"
              value={filter.date_from}
              onChange={(e) => setFilter({...filter, date_from: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-2">To Date</label>
            <input
              type="date"
              value={filter.date_to}
              onChange={(e) => setFilter({...filter, date_to: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
        </div>
      </div>

      {/* Events Timeline */}
      {loading ? (
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        </div>
      ) : events.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg">
          <FileText className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">No events found</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event, index) => (
            <div key={event.id} className="bg-white p-6 rounded-lg shadow border-l-4 border-l-blue-500">
              <div className="flex items-start justify-between">
                <div className="flex gap-4 flex-1">
                  <div className="flex-shrink-0">
                    <Activity className="w-6 h-6 text-blue-600" />
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-bold text-lg">{event.event_type.replace(/_/g, ' ').toUpperCase()}</h3>
                      <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                        {event.entity_type}
                      </span>
                    </div>

                    <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                      <div className="flex items-center gap-2">
                        <User className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Actor:</span>
                        <span className="font-medium">{event.actor_name || event.actor_role || 'System'}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400" />
                        <span className="text-gray-600">Date:</span>
                        <span className="font-medium">{new Date(event.created_at).toLocaleString()}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Entity ID:</span>
                        <span className="font-mono text-sm ml-2">{event.entity_id.substr(0, 8)}...</span>
                      </div>
                    </div>

                    {event.event_data && Object.keys(event.event_data).length > 0 && (
                      <details className="mt-3">
                        <summary className="cursor-pointer text-sm font-medium text-blue-600 hover:text-blue-800">
                          View Details
                        </summary>
                        <pre className="mt-2 p-3 bg-gray-50 rounded text-xs overflow-x-auto">
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

