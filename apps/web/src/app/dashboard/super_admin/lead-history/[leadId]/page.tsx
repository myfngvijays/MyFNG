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
      <div className="flex items-center justify-center h-48 sm:h-64">
        <Loader2 className="h-8 w-8 sm:h-9 sm:w-9 md:h-10 md:w-10 animate-spin text-brand-primary" />
        <p className="ml-2 sm:ml-3 text-text-body text-xs sm:text-sm md:text-base">Loading lead history...</p>
      </div>
    );
  }

  if (!history) {
    return (
      <div className="text-center py-8 sm:py-10 md:py-12">
        <p className="text-text-body text-sm sm:text-base">No history found for this lead</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 p-3 sm:p-4 md:p-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 sm:gap-4">
        <button
          onClick={() => router.back()}
          className="btn-secondary flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto justify-center"
        >
          <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          Back
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-text-heading">Lead History</h1>
          <p className="text-text-body text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Lead ID: {leadId}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="card p-3 sm:p-4">
        <div className="flex gap-2 sm:gap-3 md:gap-4 border-b border-gray-200 overflow-x-auto">
          <button
            onClick={() => setActiveTab('status')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'status'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Status History</span>
              <span className="sm:hidden">Status</span>
              <span className="text-[10px] sm:text-xs">({history.status_history.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('activities')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'activities'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Activity className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Activities</span>
              <span className="sm:hidden">Activities</span>
              <span className="text-[10px] sm:text-xs">({history.activities.length})</span>
            </div>
          </button>
          <button
            onClick={() => setActiveTab('events')}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm font-medium transition-colors whitespace-nowrap ${
              activeTab === 'events'
                ? 'text-brand-primary border-b-2 border-brand-primary'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            <div className="flex items-center gap-1.5 sm:gap-2">
              <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Events</span>
              <span className="sm:hidden">Events</span>
              <span className="text-[10px] sm:text-xs">({history.events.length})</span>
            </div>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="space-y-3 sm:space-y-4">
        {activeTab === 'status' && (
          <>
            {history.status_history.length === 0 ? (
              <div className="card p-4 sm:p-5 md:p-6 text-center text-text-body text-sm sm:text-base">
                No status changes recorded
              </div>
            ) : (
              <div className="relative">
                <div className="absolute left-4 sm:left-6 md:left-8 top-0 bottom-0 w-0.5 bg-gray-200"></div>
                {history.status_history.map((item, index) => (
                  <div key={item.id} className="card p-4 sm:p-5 md:p-6 mb-3 sm:mb-4 relative pl-12 sm:pl-14 md:pl-16">
                    <div className="absolute left-2 sm:left-3 md:left-4 top-4 sm:top-5 md:top-6 w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 bg-brand-primary rounded-full flex items-center justify-center text-white text-xs sm:text-sm font-bold">
                      {index + 1}
                    </div>
                    <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                          {item.old_status && (
                            <>
                              <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-gray-100 text-gray-700 rounded-full text-xs sm:text-sm font-medium">
                                {item.old_status}
                              </span>
                              <span className="text-gray-400 text-xs sm:text-sm">→</span>
                            </>
                          )}
                          <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-green-100 text-green-700 rounded-full text-xs sm:text-sm font-medium">
                            {item.new_status}
                          </span>
                        </div>
                        {item.reason && (
                          <p className="text-xs sm:text-sm text-text-body mb-1">
                            <span className="font-medium">Reason:</span> {item.reason}
                          </p>
                        )}
                        {item.notes && (
                          <p className="text-xs sm:text-sm text-text-body">
                            <span className="font-medium">Notes:</span> {item.notes}
                          </p>
                        )}
                        <div className="flex flex-wrap gap-2 mt-2">
                          {item.changed_by && (
                            <p className="text-[10px] sm:text-xs text-gray-500">
                              Changed by: {item.changed_by.slice(0, 8)}...
                            </p>
                          )}
                          {item.ip_address && (
                            <p className="text-[10px] sm:text-xs text-gray-500">IP: {item.ip_address}</p>
                          )}
                        </div>
                      </div>
                      <div className="text-left sm:text-right text-xs sm:text-sm text-gray-500 flex-shrink-0">
                        <p>{formatDistanceToNow(new Date(item.changed_at), { addSuffix: true })}</p>
                        <p className="text-[10px] sm:text-xs">{new Date(item.changed_at).toLocaleString()}</p>
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
              <div className="card p-4 sm:p-5 md:p-6 text-center text-text-body text-sm sm:text-base">
                No activities recorded
              </div>
            ) : (
              history.activities.map((activity) => (
                <div key={activity.id} className="card p-4 sm:p-5 md:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-blue-100 text-blue-700 rounded-full text-xs sm:text-sm font-semibold">
                          {activity.activity_type}
                        </span>
                        {activity.old_status && activity.new_status && (
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-text-body">
                            <span className="font-mono">{activity.old_status}</span>
                            <span>→</span>
                            <span className="font-mono">{activity.new_status}</span>
                          </div>
                        )}
                      </div>
                      {activity.description && (
                        <p className="text-xs sm:text-sm text-text-body mb-2">{activity.description}</p>
                      )}
                      {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs sm:text-sm text-brand-primary hover:underline">
                            View Metadata
                          </summary>
                          <pre className="mt-2 bg-gray-100 p-2 sm:p-3 rounded text-[10px] sm:text-xs overflow-x-auto">
                            {JSON.stringify(activity.metadata, null, 2)}
                          </pre>
                        </details>
                      )}
                      {activity.user_id && (
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-2">
                          User: {activity.user_id.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                    <div className="text-left sm:text-right text-xs sm:text-sm text-gray-500 flex-shrink-0">
                      <p>{formatDistanceToNow(new Date(activity.created_at), { addSuffix: true })}</p>
                      <p className="text-[10px] sm:text-xs">{new Date(activity.created_at).toLocaleString()}</p>
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
              <div className="card p-4 sm:p-5 md:p-6 text-center text-text-body text-sm sm:text-base">
                No events recorded
              </div>
            ) : (
              history.events.map((event) => (
                <div key={event.id} className="card p-4 sm:p-5 md:p-6">
                  <div className="flex flex-col sm:flex-row justify-between items-start gap-3 sm:gap-0">
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2">
                        <span className="px-2 sm:px-3 py-0.5 sm:py-1 bg-purple-100 text-purple-700 rounded-full text-xs sm:text-sm font-semibold">
                          {event.event_type}
                        </span>
                        {event.old_status && event.new_status && (
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-text-body">
                            <span className="font-mono">{event.old_status}</span>
                            <span>→</span>
                            <span className="font-mono">{event.new_status}</span>
                          </div>
                        )}
                      </div>
                      {event.event_description && (
                        <p className="text-xs sm:text-sm text-text-body mb-2">{event.event_description}</p>
                      )}
                      {event.event_data && Object.keys(event.event_data).length > 0 && (
                        <details className="mt-2">
                          <summary className="cursor-pointer text-xs sm:text-sm text-brand-primary hover:underline">
                            View Event Data
                          </summary>
                          <pre className="mt-2 bg-gray-100 p-2 sm:p-3 rounded text-[10px] sm:text-xs overflow-x-auto">
                            {JSON.stringify(event.event_data, null, 2)}
                          </pre>
                        </details>
                      )}
                      {event.created_by && (
                        <p className="text-[10px] sm:text-xs text-gray-500 mt-2">
                          Created by: {event.created_by.slice(0, 8)}...
                        </p>
                      )}
                    </div>
                    <div className="text-left sm:text-right text-xs sm:text-sm text-gray-500 flex-shrink-0">
                      <p>{formatDistanceToNow(new Date(event.created_at), { addSuffix: true })}</p>
                      <p className="text-[10px] sm:text-xs">{new Date(event.created_at).toLocaleString()}</p>
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

