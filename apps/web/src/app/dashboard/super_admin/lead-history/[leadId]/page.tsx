'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { LeadHistoryResponse } from '@/shared/types/audit';
import { Loader2, ArrowLeft, Activity, Calendar, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

export default function LeadHistoryPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = params.leadId as string;

  const [history, setHistory] = useState<LeadHistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'status' | 'activities' | 'events'>('status');

  useEffect(() => {
    if (leadId) {
      fetchLeadHistory();
    }
  }, [leadId]);

  const fetchLeadHistory = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/audit/lead-history/${leadId}`);
      const data: LeadHistoryResponse = await response.json();

      if (response.ok) {
        setHistory(data);
      } else {
        toast.error('Failed to fetch lead history');
      }
    } catch (error) {
      console.error('Error fetching lead history:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        <p className="ml-3 text-text-body">Loading lead history...</p>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="text-center py-12">
        <p className="text-text-body">No history found for this lead</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => router.back()}
          className="btn-secondary flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Back
        </button>
        <div>
          <h1 className="text-3xl font-bold text-text-heading">Lead History</h1>
          <p className="text-text-body mt-1">Lead ID: {leadId}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-4">
        <div className="flex gap-4 border-b border-gray-200">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'status'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4" />
              Status History ({history.status_history.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'activities'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Activities ({history.activities.length})
            </div>
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-4 py-2 font-medium transition-colors ${
              activeTab === 'events'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4" />
              Events ({history.events.length})
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-4">
        {activeTab === 'status' && (
          <>
            {history.status_history.length === 0 ? (
              <div className="card p-6 text-center text-text-body">
                No status changes recorded
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                {history.status_history.map((item, index) => (
                  <div key={item.id} className="card p-6 mb-4 relative pl-16">
                    <div className="absolute left-4 top-6 w-8 h-8 bg-brand-primary rounded-full flex items-center justify-center text-white text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          {item.old_status && (
                            <>
                              <span className="px-3 py-1 bg-gray-100 text-gray-700 rounded-full text-sm font-medium">
                                {item.old_status}
                              </span>
                              <span className="text-gray-400">→</span>
                            </>
                          )}
                          <span className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                            {item.new_status}
                          </span>
                        </div>
                        {item.reason && (
                          <p className="text-sm text-text-body mb-1">
                            <span className="font-medium">Reason:</span> {item.reason}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-sm text-text-body">
                            <span className="font-medium">Notes:</span> {item.notes}
                          </p>
                        )}
                        {item.changed_by && (
                          <p className="text-xs text-gray-500 mt-2">
                            Changed by: {item.changed_by.slice(0, 8)}...
                          </p>
                        )}
                        {item.ip_address && (
                          <p className="text-xs text-gray-500">IP: {item.ip_address}</p>
                        )}
                      </div>
                      <div className="text-right text-sm text-gray-500">
                        <p>{formatDistanceToNow(new Date(item.changed_at), { addSuffix: true })}</p>
                        <p className="text-xs">{new Date(item.changed_at).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {activeTab === 'activities' && (
          <>
            {history.activities.length === 0 ? (
              <div className="card p-6 text-center text-text-body">
                No activities recorded
              </div>
            ) : (
              history.activities.map((activity) => (
                <div key={activity.id} className="card p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full text-sm font-semibold">
                          {activity.activity_type}
                        </span>
                        {activity.old_status && activity.new_status && (
                          <div className="flex items-center gap-2 text-sm text-text-body">
                            <span className="font-mono">{activity.old_status}</span>
                            <span>→</span>
                            <span className="font-mono">{activity.new_status}</span>
                          </div>
                        )}
                      </div>
                      {activity.description && (
                        <p className="text-text-body mb-2">{activity.description}</p>
                      )}
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-brand-primary hover:underline">
                            View Metadata
                          </summary>
                          <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                            {JSON.stringify(activity.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                      {activity.user_id && (
                        <p className="text-xs text-gray-500 mt-2">
                          User: {activity.user_id.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</p>
                      <p className="text-xs">{new Date(activity.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}

        {activeTab === 'events' && (
          <>
            {history.events.length === 0 ? (
              <div className="card p-6 text-center text-text-body">
                No events recorded
              </div>
            ) : (
              history.events.map((event) => (
                <div key={event.id} className="card p-6">
                  <div className="flex justify-between items-start">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full text-sm font-semibold">
                          {event.event_type}
                        </span>
                        {event.old_status && event.new_status && (
                          <div className="flex items-center gap-2 text-sm text-text-body">
                            <span className="font-mono">{event.old_status}</span>
                            <span>→</span>
                            <span className="font-mono">{event.new_status}</span>
                          </div>
                        )}
                      </div>
                      {event.event_description && (
                        <p className="text-text-body mb-2">{event.event_description}</p>
                      )}
                      {event.event_data && Object.keys(event.event_data).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-sm text-brand-primary hover:underline">
                            View Event Data
                          </summary>
                          <pre className="mt-2 bg-gray-100 p-3 rounded text-xs overflow-x-auto">
                            {JSON.stringify(event.event_data, null, 2)}
                          </pre>
                        </details>
                      )}
                      {event.created_by && (
                        <p className="text-xs text-gray-500 mt-2">
                          Created by: {event.created_by.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                    <div className="text-right text-sm text-gray-500">
                      <p>{formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}</p>
                      <p className="text-xs">{new Date(event.created_at).toLocaleString()}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </>
        )}
      </div>
    </div>
  );
}

