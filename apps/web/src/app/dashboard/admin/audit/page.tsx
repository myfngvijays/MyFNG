'use client';

import { useState, useEffect } from 'react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from "@/lib/utils";

export default function AuditTrailViewer() {
  const [activeTab, setActiveTab] = useState<'finance' | 'leads'>('finance');
  const [financeEvents, setFinanceEvents] = useState<any[]>([]);
  const [leadEvents, setLeadEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    eventType: '',
    startDate: '',
    endDate: '',
  });

  const supabase = createClient();

  useEffect(() => {
    fetchEvents();
  }, [activeTab, filters]);

  const fetchEvents = async () => {
    setLoading(true);
    try {
      if (activeTab === 'finance') {
        let query = supabase
          .from('finance_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (filters.eventType) {
          query = query.eq('event_type', filters.eventType);
        }
        if (filters.startDate) {
          query = query.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('created_at', filters.endDate);
        }

        const { data } = await query;
        setFinanceEvents(data || []);
      } else {
        let query = supabase
          .from('lead_events')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (filters.startDate) {
          query = query.gte('created_at', filters.startDate);
        }
        if (filters.endDate) {
          query = query.lte('created_at', filters.endDate);
        }

        const { data } = await query;
        setLeadEvents(data || []);
      }
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Audit Trail Viewer</h1>
        <p className="text-gray-600 mt-1">View all financial and lead events</p>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow">
        <div className="grid grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1">Event Type</label>
            <input
              type="text"
              value={filters.eventType}
              onChange={(e) => setFilters({ ...filters, eventType: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Filter by type"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Start Date</label>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">End Date</label>
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg"
            />
          </div>
          <div className="flex items-end">
            <button
              onClick={fetchEvents}
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              Apply Filters
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b">
        <div className="flex space-x-4">
          {['finance', 'leads'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as any)}
              className={`px-4 py-2 border-b-2 ${
                activeTab === tab
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-600'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)} Events
            </button>
          ))}
        </div>
      </div>

      {/* Events List */}
      {loading ? (
        <div className="text-center py-12">Loading...</div>
      ) : activeTab === 'finance' ? (
        <div className="space-y-2">
          {financeEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No finance events found</div>
          ) : (
            financeEvents.map((event) => (
              <div key={event.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{event.event_type}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Entity: {event.entity_type} - {event.entity_id.substring(0, 8)}...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      Actor: {event.actor_name || event.actor_role || 'System'} | {formatDateTime(event.created_at)}
                    </p>
                    {event.ip_address && (
                      <p className="text-xs text-gray-400 mt-1">IP: {event.ip_address}</p>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      ) : (
        <div className="space-y-2">
          {leadEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">No lead events found</div>
          ) : (
            leadEvents.map((event) => (
              <div key={event.id} className="bg-white p-4 rounded-lg shadow">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-medium">{event.event_type}</p>
                    <p className="text-sm text-gray-600 mt-1">
                      Lead: {event.lead_id?.substring(0, 8)}...
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {formatDateTime(event.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

