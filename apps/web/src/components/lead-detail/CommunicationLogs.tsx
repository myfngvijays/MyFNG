'use client';

import { formatDateTime } from "@/lib/utils";
/**
 * Communication Logs Section
 * Display all events and activities for this lead
 * Task: WA-501
 */

import { useState, useEffect } from 'react';
import { MessageSquare, Clock, User, Activity } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface CommunicationLogsProps {
  lead: any;
}

interface LeadEvent {
  id: string;
  event_type: string;
  event_description: string;
  event_data?: any;
  created_at: string;
  created_by: string;
  creator?: { full_name: string };
}

export default function CommunicationLogs({ lead }: CommunicationLogsProps) {
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<string>('ALL');

  const eventTypes = [
    'ALL',
    'STATUS_UPDATE',
    'ASSIGNMENT',
    'MEDIA_UPLOADED',
    'EXTRA_CHARGE_REQUESTED',
    'JOB_CARD_CREATED',
    'AUDIT_STARTED',
    'INVOICE_GENERATED'
  ];

  useEffect(() => {
    fetchEvents();
  }, [lead.id, filter]);

  async function fetchEvents() {
    setLoading(true);
    const supabase = createClient();

    try {
      let query = supabase
        .from('lead_events')
        .select(`
          *,
          creator:created_by(full_name)
        `)
        .eq('lead_id', lead.id)
        .order('created_at', { ascending: false });

      if (filter !== 'ALL') {
        query = query.eq('event_type', filter);
      }

      const { data, error } = await query;

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      console.error('Error fetching events:', error);
    } finally {
      setLoading(false);
    }
  }

  function getEventIcon(eventType: string) {
    if (eventType.includes('STATUS')) return '🔄';
    if (eventType.includes('ASSIGNMENT') || eventType.includes('ASSIGNED')) return '👤';
    if (eventType.includes('MEDIA')) return '📸';
    if (eventType.includes('CHARGE')) return '💰';
    if (eventType.includes('JOB_CARD')) return '📋';
    if (eventType.includes('AUDIT')) return '✅';
    if (eventType.includes('INVOICE')) return '📄';
    if (eventType.includes('ACCEPTED')) return '✅';
    if (eventType.includes('REJECTED')) return '❌';
    return '📌';
  }

  function getEventColor(eventType: string) {
    if (eventType.includes('ACCEPTED') || eventType.includes('COMPLETED')) return 'bg-green-100 text-green-800 border-green-300';
    if (eventType.includes('REJECTED') || eventType.includes('FAILED')) return 'bg-red-100 text-red-800 border-red-300';
    if (eventType.includes('PENDING')) return 'bg-yellow-100 text-yellow-800 border-yellow-300';
    return 'bg-blue-100 text-blue-800 border-blue-300';
  }

  function formatTimeAgo(dateString: string) {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours} hours ago`;
    
    const diffDays = Math.floor(diffHours / 24);
    return `${diffDays} days ago`;
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-brand-primary" />
        Communication & Activity Logs
      </h2>

      {/* Filter */}
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-2">Filter by Type</label>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
        >
          {eventTypes.map((type) => (
            <option key={type} value={type}>
              {type.replace(/_/g, ' ')}
            </option>
          ))}
        </select>
      </div>

      {/* Timeline */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading events...</div>
      ) : events.length === 0 ? (
        <div className="text-center py-8 text-gray-500">
          <Activity className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No events found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {events.map((event, index) => (
            <div
              key={event.id}
              className={`relative pl-8 pb-4 ${
                index !== events.length - 1 ? 'border-l-2 border-gray-200' : ''
              }`}
            >
              {/* Timeline dot */}
              <div className="absolute left-0 top-0 -translate-x-1/2 w-4 h-4 rounded-full bg-brand-primary border-2 border-white" />
              
              {/* Event card */}
              <div className={`p-3 rounded-lg border ${getEventColor(event.event_type)}`}>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">{getEventIcon(event.event_type)}</span>
                    <h3 className="font-semibold text-sm">
                      {event.event_type.replace(/_/g, ' ')}
                    </h3>
                  </div>
                  <div className="text-right text-xs">
                    <div className="flex items-center gap-1 text-gray-600">
                      <Clock className="w-3 h-3" />
                      {formatTimeAgo(event.created_at)}
                    </div>
                    <div className="text-gray-500">
                      {formatDateTime(event.created_at)}
                    </div>
                  </div>
                </div>
                
                <p className="text-sm text-gray-700 mb-2">
                  {event.event_description}
                </p>
                
                {event.event_data && Object.keys(event.event_data).length > 0 && (
                  <details className="text-xs text-gray-600">
                    <summary className="cursor-pointer hover:text-gray-800">
                      View Details
                    </summary>
                    <pre className="mt-2 p-2 bg-white rounded text-xs overflow-x-auto">
                      {JSON.stringify(event.event_data, null, 2)}
                    </pre>
                  </details>
                )}
                
                {event.creator && (
                  <div className="flex items-center gap-1 text-xs text-gray-600 mt-2 pt-2 border-t border-gray-300">
                    <User className="w-3 h-3" />
                    {event.creator.full_name}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

