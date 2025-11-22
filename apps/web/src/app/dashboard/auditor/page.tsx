/**
 * Auditor Dashboard - Complete
 * Audit queue, approve/flag leads, fraud detection
 */

'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { 
  Shield, 
  CheckCircle, 
  AlertTriangle, 
  Flag, 
  Search,
  Eye,
  DollarSign,
  Clock,
  TrendingUp,
  XCircle,
  FileText
} from 'lucide-react';

interface AuditLead {
  id: string;
  lead_number: string;
  customer_name: string;
  vehicle_number: string;
  status: string;
  final_amount?: number;
  audit_status?: string;
  audit_score?: number;
  priority?: string;
  created_at: string;
  workshop?: { name: string; phone: string; audit_score?: number };
  mechanic?: { full_name: string };
  supervisor?: { full_name: string };
}

export default function AuditorDashboard() {
  const router = useRouter();
  const [leads, setLeads] = useState<AuditLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'pending' | 'approved' | 'flagged' | 'high_value' | 'all'>('pending');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedLead, setSelectedLead] = useState<AuditLead | null>(null);
  const [showAuditModal, setShowAuditModal] = useState(false);
  const [showFlagModal, setShowFlagModal] = useState(false);
  
  // Audit form state
  const [auditData, setAuditData] = useState({
    audit_score: 80,
    audit_notes: '',
    checklist: {
      before_images_valid: true,
      after_images_valid: true,
      service_completed_properly: true,
      extra_charges_justified: true,
      no_fraud_detected: true,
      cleanliness_maintained: true,
      customer_satisfaction: true,
    },
    recommendations: '',
  });

  // Flag form state
  const [flagData, setFlagData] = useState({
    flag_reason: 'FRAUD_SUSPECTED',
    severity: 'MEDIUM' as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL',
    description: '',
    evidence: [] as string[],
    action_required: '',
    escalate_to_super_admin: false,
  });

  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    flagged: 0,
    highValue: 0,
    avgAuditTime: 0,
  });

  useEffect(() => {
    fetchAuditData();
  }, [filter, searchTerm]);

  async function fetchAuditData() {
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

      const response = await fetch(`/api/auditor/leads?${params.toString()}`);
      const result = await response.json();

      if (result.success) {
        setLeads(result.leads);
        setStats(result.stats);
      } else {
        toast.error('Failed to fetch audit leads');
      }
    } catch (error) {
      console.error('Error fetching audit data:', error);
      toast.error('Failed to fetch data');
    } finally {
      setLoading(false);
    }
  }

  async function handleApproveAudit() {
    if (!selectedLead) return;

    try {
      const response = await fetch(`/api/auditor/leads/${selectedLead.id}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('✅ Audit approved successfully!');
        setShowAuditModal(false);
        setSelectedLead(null);
        fetchAuditData();
      } else {
        toast.error(result.error || 'Failed to approve audit');
      }
    } catch (error) {
      console.error('Error approving audit:', error);
      toast.error('Failed to approve audit');
    }
  }

  async function handleFlagLead() {
    if (!selectedLead) return;

    if (!flagData.description) {
      toast.error('Description is required');
      return;
    }

    try {
      const response = await fetch(`/api/auditor/leads/${selectedLead.id}/flag`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(flagData),
      });

      const result = await response.json();

      if (result.success) {
        toast.success('🚩 Lead flagged successfully!');
        setShowFlagModal(false);
        setSelectedLead(null);
        fetchAuditData();
      } else {
        toast.error(result.error || 'Failed to flag lead');
      }
    } catch (error) {
      console.error('Error flagging lead:', error);
      toast.error('Failed to flag lead');
    }
  }

  const filterButtons = [
    { value: 'pending', label: 'Pending Audit', icon: Clock, color: 'bg-yellow-500' },
    { value: 'approved', label: 'Approved', icon: CheckCircle, color: 'bg-green-500' },
    { value: 'flagged', label: 'Flagged', icon: Flag, color: 'bg-red-500' },
    { value: 'high_value', label: 'High Value', icon: DollarSign, color: 'bg-blue-500' },
    { value: 'all', label: 'All Audits', icon: FileText, color: 'bg-purple-500' },
  ];

  const flagReasons = [
    'FRAUD_SUSPECTED',
    'IMAGE_MANIPULATION',
    'OVERCHARGING',
    'POOR_SERVICE',
    'MISSING_DOCUMENTATION',
    'SAFETY_VIOLATION',
    'OTHER'
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-2">
          <Shield className="w-8 h-8 text-indigo-600" />
          Auditor Dashboard
        </h1>
        <p className="text-gray-600">Quality Control & Fraud Detection</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Audits</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Shield className="w-8 h-8 text-purple-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-yellow-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-gray-900">{stats.pending}</p>
            </div>
            <Clock className="w-8 h-8 text-yellow-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-gray-900">{stats.approved}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Flagged</p>
              <p className="text-2xl font-bold text-gray-900">{stats.flagged}</p>
            </div>
            <Flag className="w-8 h-8 text-red-500" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">High Value</p>
              <p className="text-2xl font-bold text-gray-900">{stats.highValue}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
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
            placeholder="Search by lead number, customer name, or vehicle number..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Leads Table */}
      <div className="bg-white rounded-lg shadow-md overflow-hidden">
        {loading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading audit queue...</p>
          </div>
        ) : leads.length === 0 ? (
          <div className="p-8 text-center">
            <Shield className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 text-lg">No leads to audit</p>
            <p className="text-gray-400 text-sm mt-2">All caught up! 🎉</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Lead Details
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Customer & Vehicle
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Workshop
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Audit Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
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
                        <div className="text-xs text-gray-500">
                          {new Date(lead.created_at).toLocaleDateString()}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{lead.customer_name}</div>
                        <div className="text-sm text-gray-500">{lead.vehicle_number}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{lead.workshop?.name || 'N/A'}</div>
                        {lead.workshop?.audit_score && (
                          <div className="text-xs text-gray-500">
                            Score: {lead.workshop.audit_score.toFixed(1)}/5
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        ₹{lead.final_amount?.toLocaleString() || '0'}
                      </div>
                      {lead.final_amount && lead.final_amount > 10000 && (
                        <span className="text-xs text-blue-600 font-medium">High Value</span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        lead.audit_status === 'AUDIT_APPROVED' ? 'bg-green-100 text-green-800' :
                        lead.audit_status === 'AUDIT_FLAGGED' ? 'bg-red-100 text-red-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {lead.audit_status || 'PENDING'}
                      </span>
                      {lead.audit_score && (
                        <div className="text-xs text-gray-500 mt-1">
                          Score: {lead.audit_score}/100
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            setShowAuditModal(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4" />
                          Approve
                        </button>
                        <button
                          onClick={() => {
                            setSelectedLead(lead);
                            setShowFlagModal(true);
                          }}
                          className="flex items-center gap-1 px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700"
                        >
                          <Flag className="w-4 h-4" />
                          Flag
                        </button>
                        <button
                          onClick={() => router.push(`/dashboard/auditor/leads/${lead.id}`)}
                          className="flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white rounded hover:bg-indigo-700"
                        >
                          <Eye className="w-4 h-4" />
                          Review
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Approve Audit Modal */}
      {showAuditModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <CheckCircle className="w-6 h-6 text-green-600" />
                Approve Audit - {selectedLead.lead_number}
              </h2>

              <div className="space-y-4">
                {/* Audit Score */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Audit Score (0-100) *
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={auditData.audit_score}
                    onChange={(e) => setAuditData({ ...auditData, audit_score: parseInt(e.target.value) })}
                    className="w-full"
                  />
                  <div className="flex justify-between text-sm text-gray-600 mt-1">
                    <span>0</span>
                    <span className="font-bold text-lg">{auditData.audit_score}/100</span>
                    <span>100</span>
                  </div>
                </div>

                {/* Checklist */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Audit Checklist
                  </label>
                  <div className="space-y-2 bg-gray-50 p-4 rounded-lg">
                    {Object.entries(auditData.checklist).map(([key, value]) => (
                      <div key={key} className="flex items-center">
                        <input
                          type="checkbox"
                          checked={value}
                          onChange={(e) => setAuditData({
                            ...auditData,
                            checklist: { ...auditData.checklist, [key]: e.target.checked }
                          })}
                          className="w-4 h-4 text-green-600 border-gray-300 rounded focus:ring-green-500"
                        />
                        <label className="ml-2 text-sm text-gray-700 capitalize">
                          {key.replace(/_/g, ' ')}
                        </label>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Audit Notes */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Audit Notes
                  </label>
                  <textarea
                    value={auditData.audit_notes}
                    onChange={(e) => setAuditData({ ...auditData, audit_notes: e.target.value })}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Detailed audit observations..."
                  />
                </div>

                {/* Recommendations */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recommendations (Optional)
                  </label>
                  <textarea
                    value={auditData.recommendations}
                    onChange={(e) => setAuditData({ ...auditData, recommendations: e.target.value })}
                    rows={2}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500"
                    placeholder="Suggestions for improvement..."
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleApproveAudit}
                    className="flex-1 bg-green-600 text-white py-3 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Approve Audit
                  </button>
                  <button
                    onClick={() => setShowAuditModal(false)}
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

      {/* Flag Lead Modal */}
      {showFlagModal && selectedLead && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
                <Flag className="w-6 h-6 text-red-600" />
                Flag Lead - {selectedLead.lead_number}
              </h2>

              <div className="space-y-4">
                {/* Flag Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Flag Reason *
                  </label>
                  <select
                    value={flagData.flag_reason}
                    onChange={(e) => setFlagData({ ...flagData, flag_reason: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                  >
                    {flagReasons.map(reason => (
                      <option key={reason} value={reason}>{reason.replace(/_/g, ' ')}</option>
                    ))}
                  </select>
                </div>

                {/* Severity */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Severity *
                  </label>
                  <div className="grid grid-cols-4 gap-2">
                    {['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'].map((sev) => (
                      <button
                        key={sev}
                        onClick={() => setFlagData({ ...flagData, severity: sev as any })}
                        className={`py-2 rounded-lg font-medium transition-all ${
                          flagData.severity === sev
                            ? sev === 'CRITICAL' ? 'bg-red-600 text-white' :
                              sev === 'HIGH' ? 'bg-orange-500 text-white' :
                              sev === 'MEDIUM' ? 'bg-yellow-500 text-white' :
                              'bg-blue-500 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {sev}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description *
                  </label>
                  <textarea
                    value={flagData.description}
                    onChange={(e) => setFlagData({ ...flagData, description: e.target.value })}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    placeholder="Detailed description of the issue..."
                    required
                  />
                </div>

                {/* Action Required */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Action Required
                  </label>
                  <input
                    type="text"
                    value={flagData.action_required}
                    onChange={(e) => setFlagData({ ...flagData, action_required: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
                    placeholder="What action should be taken?"
                  />
                </div>

                {/* Escalate */}
                <div className="flex items-center bg-red-50 p-3 rounded-lg">
                  <input
                    type="checkbox"
                    checked={flagData.escalate_to_super_admin}
                    onChange={(e) => setFlagData({ ...flagData, escalate_to_super_admin: e.target.checked })}
                    className="w-4 h-4 text-red-600 border-gray-300 rounded focus:ring-red-500"
                  />
                  <label className="ml-2 text-sm font-medium text-red-900">
                    🚨 Escalate to Super Admin (High priority)
                  </label>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-3 pt-4">
                  <button
                    onClick={handleFlagLead}
                    className="flex-1 bg-red-600 text-white py-3 rounded-lg font-medium hover:bg-red-700 transition-colors flex items-center justify-center gap-2"
                  >
                    <Flag className="w-5 h-5" />
                    Flag Lead
                  </button>
                  <button
                    onClick={() => setShowFlagModal(false)}
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

