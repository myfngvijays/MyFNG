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
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Escalations Management</h1>
          <p className="text-gray-600 mt-1">{escalations.length} escalation(s) found</p>
        </div>
        <Link href="/dashboard/lead_manager">
          <button className="bg-gray-200 hover:bg-gray-300 px-4 py-2 rounded-lg font-medium">
            ← Back to Dashboard
          </button>
        </Link>
      </div>

      {/* Filter Tabs */}
      <div className="mb-6 flex gap-3">
        <button
          onClick={() => setFilter('active')}
          className={`px-6 py-2 rounded-lg font-medium ${
            filter === 'active' ? 'bg-red-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Active
        </button>
        <button
          onClick={() => setFilter('all')}
          className={`px-6 py-2 rounded-lg font-medium ${
            filter === 'all' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        <button
          onClick={() => setFilter('resolved')}
          className={`px-6 py-2 rounded-lg font-medium ${
            filter === 'resolved' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          Resolved
        </button>
      </div>

      {/* Escalations List */}
      {escalations.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <div className="text-6xl mb-4">
            {filter === 'resolved' ? '✅' : '🚨'}
          </div>
          <h3 className="text-xl font-bold text-gray-900 mb-2">No Escalations</h3>
          <p className="text-gray-600">
            {filter === 'resolved'
              ? 'No resolved escalations found'
              : 'No active escalations at the moment'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {escalations.map((escalation) => {
            const reason = getEscalationReason(escalation);

            return (
              <div
                key={escalation.id}
                className="bg-white rounded-lg shadow border-l-4 border-red-500 p-6 hover:shadow-lg transition"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    {/* Header */}
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-lg font-bold text-gray-900">#{escalation.lead_number}</span>
                      <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                        escalation.escalation === 'ESCALATED'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-green-100 text-green-600'
                      }`}>
                        {escalation.escalation}
                      </span>
                      {escalation.lead_priority === 'URGENT' && (
                        <span className="px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-600">
                          URGENT
                        </span>
                      )}
                    </div>

                    {/* Escalation Reason */}
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-3">
                      <div className="flex items-center gap-2">
                        <span className="text-2xl">⚠️</span>
                        <div>
                          <p className="text-sm font-medium text-orange-700">Escalation Reason:</p>
                          <p className="text-orange-900 font-bold">{reason}</p>
                        </div>
                      </div>
                    </div>

                    {/* Lead Info */}
                    <div className="grid grid-cols-3 gap-4 mb-3">
                      <div>
                        <p className="text-sm text-gray-600">Customer</p>
                        <p className="font-medium text-gray-900">{escalation.customer_name}</p>
                        <p className="text-sm text-gray-500">{escalation.customer_phone}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Vehicle</p>
                        <p className="font-medium text-gray-900">{escalation.vehicle_model || 'N/A'}</p>
                        <p className="text-sm text-gray-500">{escalation.vehicle_number || 'Not provided'}</p>
                      </div>
                      <div>
                        <p className="text-sm text-gray-600">Location</p>
                        <p className="font-medium text-gray-900">{escalation.city || 'N/A'}</p>
                        {escalation.workshop && (
                          <p className="text-sm text-gray-500">{escalation.workshop.name}</p>
                        )}
                      </div>
                    </div>

                    {/* SLA Status */}
                    {escalation.sla_state && (
                      <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-lg ${
                        escalation.sla_state === 'BREACHED'
                          ? 'bg-red-100 text-red-600'
                          : 'bg-orange-100 text-orange-600'
                      }`}>
                        <span className="text-xl">{escalation.sla_state === 'BREACHED' ? '🚨' : '⏰'}</span>
                        <span className="text-sm font-medium">SLA {escalation.sla_state}</span>
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-2 ml-6">
                    <Link href={`/dashboard/lead_manager/leads/${escalation.id}`}>
                      <button className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-blue-700 whitespace-nowrap">
                        View Lead
                      </button>
                    </Link>
                    {escalation.escalation === 'ESCALATED' && (
                      <button
                        onClick={() => handleResolveEscalation(escalation.id)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg font-medium hover:bg-green-700 whitespace-nowrap"
                      >
                        Mark Resolved
                      </button>
                    )}
                  </div>
                </div>

                {/* Timestamp */}
                <div className="mt-3 pt-3 border-t border-gray-200">
                  <p className="text-xs text-gray-500">
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

