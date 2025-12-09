'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';

export default function LeadManagerEscalationsPage() {
  const supabase = createClientComponentClient();
  const [escalations, setEscalations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'active' | 'resolved'>('active');

  useEffect(() => {
    fetchEscalations();
  }, [filter]);

  const fetchEscalations = async () => {
    try {
      let query = supabase
        .from('service_leads')
        .select(`
          *,
          workshop:workshops(name),
          city_info:city_id(name)
        `)
        .not('escalation', 'is', null);

      switch (filter) {
        case 'active':
          query = query.eq('escalation', 'ESCALATED').not('status', 'in', '(COMPLETED,CANCELLED,CLOSED)');
          break;
        case 'resolved':
          query = query.eq('escalation', 'RESOLVED');
          break;
      }

      query = query.order('updated_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setEscalations(data || []);
    } catch (error) {
      console.error('Error fetching escalations:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResolveEscalation = async (leadId: string) => {
    if (confirm('Mark this escalation as resolved?')) {
      try {
        const { error } = await supabase
          .from('service_leads')
          .update({
            escalation: 'RESOLVED',
            updated_at: new Date().toISOString()
          })
          .eq('id', leadId);

        if (!error) {
          alert('Escalation resolved successfully!');
          fetchEscalations();
        }
      } catch (error) {
        alert('Failed to resolve escalation');
      }
    }
  };

  const getEscalationReason = (lead: any) => {
    if (lead.sla_state === 'BREACHED') return 'SLA Breached';
    if (lead.status === 'REJECTED') return 'Workshop Rejected';
    if (!lead.workshop_id && lead.reopen_count > 0) return 'Reopened Lead';
    if (lead.lead_priority === 'URGENT') return 'Urgent Priority';
    return 'Customer Complaint';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 sm:h-14 sm:w-14 md:h-16 md:w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-4 sm:mb-5 md:mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
        <div className="min-w-0 flex-1">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900">Escalations Management</h1>
          <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">{escalations.length} escalation(s) found</p>
        </div>
        <Link href="/dashboard/lead_manager">
          <button className="bg-gray-200 hover:bg-gray-300 px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium w-full sm:w-auto">
            ← Back to Dashboard
          </button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="mb-4 sm:mb-5 md:mb-6 flex flex-wrap gap-2 sm:gap-3">
        <button
          onClick={() => setFilter('active')}
          className={`px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium ${
            filter === 'active' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`px-4 sm:px-5 md:px-6 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium ${
            filter === 'resolved' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Escalations List */}
      {escalations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 sm:p-10 md:p-12 text-center">
          <div className="text-4xl sm:text-5xl md:text-6xl mb-3 sm:mb-4">
            {filter === 'resolved' ? '✅' : '🚨'}
          </div>
          <h3 className="text-lg sm:text-xl font-bold text-gray-900 mb-1.5 sm:mb-2">No Escalations</h3>
          <p className="text-gray-600 text-sm sm:text-base">
            {filter === 'resolved'
              ? 'No resolved escalations found'
              : 'No active escalations at the moment'}
          </p>
        </div>
      ) : (
        <div className="space-y-3 sm:space-y-4">
          {escalations.map((escalation) => {
            const reason = getEscalationReason(escalation);

            return (
              <div
                key={escalation.id}
                className="bg-white rounded-lg shadow border-l-4 border-red-500 p-4 sm:p-5 md:p-6 hover:shadow-lg transition"
              >
                <div className="flex flex-col sm:flex-row items-start sm:items-start justify-between gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0 w-full">
                    {/* Header */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                      <span className="text-base sm:text-lg font-bold text-gray-900">#{escalation.lead_number}</span>
                      <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                        escalation.escalation === 'ESCALATED'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {escalation.escalation}
                      </span>
                      {escalation.lead_priority === 'URGENT' && (
                        <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium bg-red-100 text-red-600">
                          URGENT
                        </span>
                      )}
                    </div>

                    {/* Escalation Reason */}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-2.5 sm:p-3 mb-2 sm:mb-3">
                      <div className="flex items-center gap-1.5 sm:gap-2">
                        <span className="text-xl sm:text-2xl">⚠️</span>
                        <div>
                          <p className="text-xs sm:text-sm font-medium text-orange-700">Escalation Reason:</p>
                          <p className="text-orange-900 font-bold text-sm sm:text-base">{reason}</p>
                        </div>
                      </div>
                    </div>

                    {/* Lead Info */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 mb-2 sm:mb-3">
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Customer</p>
                        <p className="font-medium text-sm sm:text-base text-gray-900">{escalation.customer_name}</p>
                        <p className="text-xs sm:text-sm text-gray-500">{escalation.customer_phone}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Vehicle</p>
                        <p className="font-medium text-sm sm:text-base text-gray-900">{escalation.vehicle_model || 'N/A'}</p>
                        <p className="text-xs sm:text-sm text-gray-500">{escalation.vehicle_number || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-xs sm:text-sm text-gray-600">Location</p>
                        <p className="font-medium text-sm sm:text-base text-gray-900">{escalation.city || 'N/A'}</p>
                        {escalation.workshop && (
                          <p className="text-xs sm:text-sm text-gray-500">{escalation.workshop.name}</p>
                        )}
                      </div>
                    </div>

                    {/* SLA Status */}
                    {escalation.sla_state && (
                      <div className={`inline-flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-0.5 sm:py-1 rounded-lg ${
                        escalation.sla_state === 'BREACHED'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-orange-100 text-orange-600'
                      }`}>
                        <span className="text-lg sm:text-xl">{escalation.sla_state === 'BREACHED' ? '🚨' : '⏰'}</span>
                        <span className="text-xs sm:text-sm font-medium">SLA {escalation.sla_state}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-row sm:flex-col gap-2 w-full sm:w-auto">
                    <Link href={`/dashboard/lead_manager/leads/${escalation.id}`} className="flex-1 sm:flex-none">
                      <button className="bg-blue-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-blue-700 w-full sm:w-auto">
                        View Lead
                      </button>
                    </Link>
                    {escalation.escalation === 'ESCALATED' && (
                      <button
                        onClick={() => handleResolveEscalation(escalation.id)}
                        className="bg-green-600 text-white px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg text-xs sm:text-sm font-medium hover:bg-green-700 w-full sm:w-auto"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-200">
                  <p className="text-[10px] sm:text-xs text-gray-500">
                    Last updated: {new Date(escalation.updated_at).toLocaleString()}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

