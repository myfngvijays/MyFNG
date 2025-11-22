/**
 * CSE (Customer Service Executive) Dashboard - Enhanced
 * Complete dashboard with final call and closure workflow
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { 
  Phone, 
  CheckCircle, 
  Clock, 
  DollarSign, 
  Star,
  MessageSquare,
  XCircle,
  AlertCircle,
  Search,
  Filter
} from 'lucide-react';

interface CSELead {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone: string;
  customer_email?: string;
  status: string;
  final_amount?: number;
  payment_status?: string;
  customer_satisfaction_score?: number;
  customer_feedback?: string;
  follow_up_required?: boolean;
  next_follow_up_at?: string;
  cse_followup_completed?: boolean;
  closed_at?: string;
  created_at: string;
  updated_at: string;
  workshop?: { name: string; phone: string };
  priority?: string;
}

export default function CSEDashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState<CSELead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'follow_up' | 'invoiced' | 'completed' | 'closed'>('follow_up');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<CSELead | null>(null);
  const [showCallModal, setShowCallModal] = useState(false);
  const [showCloseModal, setShowCloseModal] = useState(false);
  
  // Call form state
  const [callData, setCallData] = useState({
    call_duration: 0,
    customer_satisfaction_score: 5,
    customer_feedback: '',
    issues_resolved: [] as string[],
    pending_issues: '',
    call_notes: '',
    follow_up_required: false,
    next_follow_up_at: '',
  });

  // Close form state
  const [closeData, setCloseData] = useState({
    closure_notes: '',
    final_satisfaction_score: 5,
    all_issues_resolved: true,
    customer_recommendation: true,
    service_quality_score: 5,
  });

  const [stats, setStats] = useState({
    total: 0,
    pendingFollowUps: 0,
    awaitingPayment: 0,
    readyToClose: 0,
    closedToday: 0,
  });

  useEffect(() => {
    fetchCSEData();
  }, [filter, searchTerm]);

  async function fetchCSEData() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch leads from API
      const params = new URLSearchParams();
      params.append('filter', filter);
      if (searchTerm) params.append('search', searchTerm);

      const response = await fetch(`/api/cse/leads?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setLeads(result.leads);
        setStats(result.stats);
      } else {
        toast.error('Failed to fetch leads');
      }
    } catch (error) {
      console.error('Error fetching CSE data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }

  async function handleFinalCall() {
    if (!selectedLead) return;

    try {
      const response = await fetch(`/api/cse/leads/${selectedLead.id}/final-call`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(callData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('Final call logged successfully!');
        setShowCallModal(false);
        fetchCSEData();
        
        // Ask if ready to close
        if (result.ready_to_close) {
          toast.success('Lead is ready to close!');
          setTimeout(() => {
            setShowCloseModal(true);
          }, 1000);
        }
      } else {
        toast.error(result.error || 'Failed to log call');
      }
    } catch (error) {
      console.error('Error logging call:', error);
      toast.error('Failed to log call');
    }
  }

  async function handleCloseLead() {
    if (!selectedLead) return;

    try {
      const response = await fetch(`/api/cse/leads/${selectedLead.id}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(closeData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('🎉 Lead closed successfully!');
        setShowCloseModal(false);
        setSelectedLead(null);
        fetchCSEData();
      } else {
        toast.error(result.error || 'Failed to close lead');
      }
    } catch (error) {
      console.error('Error closing lead:', error);
      toast.error('Failed to close lead');
    }
  }

  const filterButtons = [
    { value: 'follow_up', label: 'Follow-up Required', icon: Clock, color: 'bg-yellow-500' },
    { value: 'invoiced', label: 'Invoiced', icon: DollarSign, color: 'bg-blue-500' },
    { value: 'completed', label: 'Ready to Close', icon: CheckCircle, color: 'bg-green-500' },
    { value: 'closed', label: 'Closed', icon: XCircle, color: 'bg-gray-500' },
    { value: 'all', label: 'All Leads', icon: Filter, color: 'bg-purple-500' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">CSE Dashboard</h1>
        <p className="text-gray-600">Customer Service Executive - Final Call & Closure</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Leads</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Filter className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending Follow-ups</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pendingFollowUps}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Awaiting Payment</p>
              <p className="text-2xl font-bold text-gray-900">{stats.awaitingPayment}</p>
            </div>
            <DollarSign className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Ready to Close</p>
              <p className="text-2xl font-bold text-gray-900">{stats.readyToClose}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-indigo-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Closed Today</p>
              <p className="text-2xl font-bold text-gray-900">{stats.closedToday}</p>
            </div>
            <Star className="w-8 h-8 text-indigo-500" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <div className="flex flex-wrap gap-2 mb-4">
          {filterButtons.map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.value}
                onClick={() => setFilter(btn.value as any)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  filter === btn.value
                    ? `${btn.color} text-white shadow-lg`
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {btn.label}
              </button>
            );
          })}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by lead number, customer name, or phone..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading leads...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No leads found</p>
            <p className="text-gray-400 text-sm mt-2">Try changing the filter or search term</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Customer
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Satisfaction
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {leads.map((lead) => (
                  <tr key={lead.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{lead.lead_number}</div>
                        <div className="text-sm text-gray-500">{lead.workshop?.name || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{lead.customer_name}</div>
                        <div className="text-sm text-gray-500">{lead.customer_phone}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        lead.status === 'CLOSED' ? 'bg-gray-100 text-gray-800' :
                        lead.status === 'COMPLETED' || lead.status === 'DELIVERED' ? 'bg-green-100 text-green-800' :
                        lead.status === 'PAYMENT_COMPLETED' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {lead.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {lead.customer_satisfaction_score ? (
                        <div className="flex items-center">
                          <Star className="w-4 h-4 text-yellow-400 fill-current mr-1" />
                          <span className="text-sm font-medium">{lead.customer_satisfaction_score}/5</span>
                        </div>
                      ) : (
                        <span className="text-sm text-gray-400">Not rated</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₹{lead.final_amount?.toLocaleString() || '0'}
                      </div>
                      <div className="text-xs text-gray-500">{lead.payment_status || 'N/A'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        {!lead.cse_followup_completed && (
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setShowCallModal(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"
                          >
                            <Phone className="w-4 h-4" />
                            Call
                          </button>
                        )}
                        {lead.status !== 'CLOSED' && lead.cse_followup_completed && (
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              setShowCloseModal(true);
                            }}
                            className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                          >
                            <CheckCircle className="w-4 h-4" />
                            Close
                          </button>
                        )}
                        {lead.customer_feedback && (
                          <button
                            onClick={() => {
                              setSelectedLead(lead);
                              toast.info(lead.customer_feedback);
                            }}
                            className="flex items-center gap-1 px-3 py-1 bg-purple-600 text-white rounded hover:bg-purple-700"
                          >
                            <MessageSquare className="w-4 h-4" />
                            Feedback
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

      {/* Final Call Modal */}
      {showCallModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Final Call - {selectedLead.lead_number}
              </h2>
              <p className="text-gray-600 mb-6">Customer: {selectedLead.customer_name}</p>

              <div className="space-y-4">
                {/* Satisfaction Score */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Satisfaction Score *
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        onClick={() => setCallData({ ...callData, customer_satisfaction_score: score })}
                        className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                          callData.customer_satisfaction_score === score
                            ? 'bg-yellow-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {score} ⭐
                      </button>
                    ))}
                  </div>
                </div>

                {/* Customer Feedback */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Customer Feedback
                  </label>
                  <textarea
                    value={callData.customer_feedback}
                    onChange={(e) => setCallData({ ...callData, customer_feedback: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="What did the customer say?"
                  />
                </div>

                {/* Call Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Call Notes
                  </label>
                  <textarea
                    value={callData.call_notes}
                    onChange={(e) => setCallData({ ...callData, call_notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    placeholder="Internal notes about the call"
                  />
                </div>

                {/* Follow-up Required */}
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    checked={callData.follow_up_required}
                    onChange={(e) => setCallData({ ...callData, follow_up_required: e.target.checked })}
                    className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                  />
                  <label className="ml-2 text-sm font-medium text-gray-700">
                    Follow-up Required
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleFinalCall}
                    className="flex-1 bg-blue-600 text-white py-3 rounded-lg font-medium hover:bg-blue-700 transition-colors"
                  >
                    Log Call
                  </button>
                  <button
                    onClick={() => setShowCallModal(false)}
                    className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Close Lead Modal */}
      {showCloseModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                Close Lead - {selectedLead.lead_number}
              </h2>
              <p className="text-gray-600 mb-6">Final closure for {selectedLead.customer_name}</p>

              <div className="space-y-4">
                {/* Final Satisfaction Score */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Final Satisfaction Score *
                  </label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((score) => (
                      <button
                        key={score}
                        onClick={() => setCloseData({ ...closeData, final_satisfaction_score: score })}
                        className={`flex-1 py-3 rounded-lg font-medium transition-all ${
                          closeData.final_satisfaction_score === score
                            ? 'bg-green-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {score} ⭐
                      </button>
                    ))}
                  </div>
                </div>

                {/* Closure Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Closure Notes *
                  </label>
                  <textarea
                    value={closeData.closure_notes}
                    onChange={(e) => setCloseData({ ...closeData, closure_notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Final summary and closure notes"
                    required
                  />
                </div>

                {/* Checkboxes */}
                <div className="space-y-2">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={closeData.all_issues_resolved}
                      onChange={(e) => setCloseData({ ...closeData, all_issues_resolved: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <label className="ml-2 text-sm font-medium text-gray-700">
                      All issues resolved
                    </label>
                  </div>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={closeData.customer_recommendation}
                      onChange={(e) => setCloseData({ ...closeData, customer_recommendation: e.target.checked })}
                      className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                    />
                    <label className="ml-2 text-sm font-medium text-gray-700">
                      Customer would recommend us
                    </label>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleCloseLead}
                    disabled={!closeData.closure_notes}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed"
                  >
                    🎉 Close Lead
                  </button>
                  <button
                    onClick={() => setShowCloseModal(false)}
                    className="px-6 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
