'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY, formatDateTime } from "@/lib/utils";
import { 
  Shield, 
  Clock, 
  CheckCircle,
  AlertTriangle,
  MapPin,
  Camera,
  Upload,
  Save,
  Send,
  X,
  Loader2,
  Image as ImageIcon,
  FileText,
  DollarSign,
  Flag,
  TrendingUp
} from 'lucide-react';
import toast from 'react-hot-toast';
import ImageVerificationComponent from '@/components/auditor/ImageVerificationComponent';
import AuditChecklistComponent from '@/components/auditor/AuditChecklistComponent';
import AuditScoringComponent from '@/components/auditor/AuditScoringComponent';
import AuditFindingsForm from '@/components/auditor/AuditFindingsForm';
import EscalationForm from '@/components/auditor/EscalationForm';

export default function AuditDetailPage() {
  const router = useRouter();
  const params = useParams();
  const auditId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [audit, setAudit] = useState<any>(null);
  const [checklist, setChecklist] = useState<any[]>([]);
  const [imageVerification, setImageVerification] = useState<any[]>([]);
  const [findings, setFindings] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'checklist' | 'images' | 'scoring' | 'findings' | 'escalate'>('overview');
  const [showStartModal, setShowStartModal] = useState(false);
  const [showSubmitModal, setShowSubmitModal] = useState(false);

  useEffect(() => {
    if (auditId) {
      fetchAuditDetail();
    }
  }, [auditId]);

  const fetchAuditDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/auditor/audits/${auditId}`);
      if (!response.ok) {
        throw new Error('Failed to fetch audit details');
      }

      const data = await response.json();
      setAudit(data.audit);
      setChecklist(data.checklist || []);
      setImageVerification(data.image_verification || []);
      setFindings(data.findings || []);
      setMedia(data.media || []);

      // If audit is PENDING or SCHEDULED, show start modal
      if (data.audit.status === 'PENDING' || data.audit.status === 'SCHEDULED') {
        setShowStartModal(true);
      }

      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching audit detail:', error);
      toast.error('Failed to load audit details');
      setLoading(false);
    }
  };

  const handleStartAudit = async (auditMode: 'ON_GROUND' | 'DIGITAL', location?: { lat: number; lng: number }) => {
    try {
      const response = await fetch(`/api/auditor/audits/${auditId}/start`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          audit_mode: auditMode,
          latitude: location?.lat,
          longitude: location?.lng,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start audit');
      }

      toast.success('Audit started successfully');
      setShowStartModal(false);
      fetchAuditDetail();
    } catch (error: any) {
      toast.error(error.message || 'Failed to start audit');
    }
  };

  const handleSubmitAudit = async (formData: any) => {
    try {
      // Include findings in submission
      const submitData = {
        ...formData,
        findings: findings.map((f) => ({
          finding_type: f.finding_type,
          severity: f.severity,
          title: f.title,
          description: f.description,
          evidence_photos: f.evidence_photos || [],
          evidence_notes: f.evidence_notes || '',
          requires_re_audit: f.requires_re_audit || false,
        })),
      };

      const response = await fetch(`/api/auditor/audits/${auditId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        throw new Error('Failed to submit audit');
      }

      toast.success('Audit submitted successfully');
      setShowSubmitModal(false);
      router.push('/dashboard/auditor');
    } catch (error: any) {
      toast.error(error.message || 'Failed to submit audit');
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="auditor">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!audit) {
    return (
      <DashboardLayout role="auditor">
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">Audit not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const isJobCardAudit = audit.type === 'JOB_CARD';

  return (
    <DashboardLayout role="auditor">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                <Shield className="w-6 h-6 text-indigo-600" />
                {isJobCardAudit ? 'Job Card Audit' : 'Workshop Facility Audit'}
              </h1>
              <p className="text-gray-600 mt-1">
                {isJobCardAudit 
                  ? audit.lead?.lead_number || audit.id.slice(0, 8)
                  : audit.workshop?.name || 'Workshop Audit'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 text-sm font-semibold rounded-full ${
                audit.status === 'COMPLETED' ? 'bg-green-100 text-green-800' :
                audit.status === 'IN_PROGRESS' ? 'bg-purple-100 text-purple-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {audit.status}
              </span>
              {audit.audit_mode === 'ON_GROUND' && (
                <span className="px-3 py-1 text-sm bg-blue-100 text-blue-800 rounded-full flex items-center gap-1">
                  <MapPin className="w-4 h-4" />
                  On-Ground
                </span>
              )}
            </div>
          </div>

          {/* Audit Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {isJobCardAudit && audit.lead && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Customer</p>
                  <p className="font-medium">{audit.lead.customer_name || 'N/A'}</p>
                  <p className="text-sm text-gray-500">{audit.lead.customer_phone || ''}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Vehicle</p>
                  <p className="font-medium">{audit.lead.vehicle_number || 'N/A'}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Workshop</p>
                  <p className="font-medium">{audit.workshop?.name || 'N/A'}</p>
                  <p className="text-sm text-gray-500">{audit.workshop?.city || ''}</p>
                </div>
              </>
            )}
            {!isJobCardAudit && audit.workshop && (
              <>
                <div>
                  <p className="text-sm text-gray-600">Workshop</p>
                  <p className="font-medium">{audit.workshop.name}</p>
                  <p className="text-sm text-gray-500">{audit.workshop.city}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Scheduled Date</p>
                  <p className="font-medium">
                    {audit.scheduled_date 
                      ? formatDateDMY(audit.scheduled_date)
                      : 'N/A'}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Last Audit Score</p>
                  <p className="font-medium">
                    {audit.workshop.audit_score ? `${audit.workshop.audit_score}%` : 'N/A'}
                  </p>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b border-gray-200">
            <nav className="flex -mb-px">
              {[
                { id: 'overview', label: 'Overview', icon: FileText },
                { id: 'checklist', label: 'Checklist', icon: CheckCircle },
                { id: 'images', label: 'Images', icon: ImageIcon },
                { id: 'scoring', label: 'Scoring', icon: TrendingUp },
                { id: 'findings', label: 'Findings', icon: AlertTriangle },
                { id: 'escalate', label: 'Escalate', icon: Flag },
              ].map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab.id
                        ? 'border-indigo-500 text-indigo-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    {tab.label}
                  </button>
                );
              })}
            </nav>
          </div>

          <div className="p-6">
            {activeTab === 'overview' && (
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-semibold mb-2">Audit Details</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Audit Type</p>
                      <p className="font-medium">{audit.audit_type || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Mode</p>
                      <p className="font-medium">{audit.audit_mode || 'DIGITAL'}</p>
                    </div>
                    {audit.sla_deadline && (
                      <div>
                        <p className="text-sm text-gray-600">SLA Deadline</p>
                        <p className="font-medium">{formatDateTime(audit.sla_deadline)}</p>
                      </div>
                    )}
                    {audit.score !== undefined && (
                      <div>
                        <p className="text-sm text-gray-600">Score</p>
                        <p className="font-medium">{audit.score}/5</p>
                      </div>
                    )}
                  </div>
                </div>
                {audit.remarks && (
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Remarks</h3>
                    <p className="text-gray-700">{audit.remarks}</p>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'checklist' && (
              <AuditChecklistComponent
                auditId={auditId}
                auditType={audit.type}
                checklist={checklist}
                onUpdate={fetchAuditDetail}
              />
            )}

            {activeTab === 'images' && (
              <ImageVerificationComponent
                auditId={auditId}
                leadId={isJobCardAudit ? (audit.lead?.id || audit.lead_id) : null}
                imageVerification={imageVerification}
                media={media}
                onUpdate={fetchAuditDetail}
              />
            )}

            {activeTab === 'scoring' && (
              <AuditScoringComponent
                auditId={auditId}
                auditType={audit.type}
                currentScore={audit.score || audit.score_percentage}
                onUpdate={fetchAuditDetail}
              />
            )}

            {activeTab === 'findings' && (
              <AuditFindingsForm
                auditId={auditId}
                findings={findings}
                onUpdate={fetchAuditDetail}
              />
            )}

            {activeTab === 'escalate' && (
              <EscalationForm
                auditId={auditId}
                leadId={isJobCardAudit ? (audit.lead?.id || audit.lead_id) : null}
                workshopId={audit.workshop_id || audit.workshop?.id}
                onSuccess={() => router.push('/dashboard/auditor')}
              />
            )}
          </div>
        </div>

        {/* Action Buttons */}
        {audit.status === 'IN_PROGRESS' && (
          <div className="bg-white rounded-lg shadow p-4 flex justify-end gap-3">
            <button
              onClick={() => setShowSubmitModal(true)}
              className="btn btn-primary flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Submit Audit
            </button>
          </div>
        )}

        {/* Start Audit Modal */}
        {showStartModal && (
          <StartAuditModal
            onClose={() => setShowStartModal(false)}
            onStart={handleStartAudit}
            auditType={audit.type}
          />
        )}

        {/* Submit Audit Modal */}
        {showSubmitModal && (
          <SubmitAuditModal
            onClose={() => setShowSubmitModal(false)}
            onSubmit={handleSubmitAudit}
            audit={audit}
          />
        )}
      </div>
    </DashboardLayout>
  );
}

// Start Audit Modal Component
function StartAuditModal({ onClose, onStart, auditType }: any) {
  const [mode, setMode] = useState<'ON_GROUND' | 'DIGITAL'>('DIGITAL');
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [gettingLocation, setGettingLocation] = useState(false);

  const getCurrentLocation = () => {
    setGettingLocation(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setGettingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('Failed to get location');
          setGettingLocation(false);
        }
      );
    } else {
      toast.error('Geolocation not supported');
      setGettingLocation(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Start Audit</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Audit Mode
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => setMode('DIGITAL')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  mode === 'DIGITAL'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <FileText className="w-6 h-6 mx-auto mb-2" />
                <p className="font-medium">Digital</p>
                <p className="text-xs text-gray-500">Image-based audit</p>
              </button>
              <button
                onClick={() => setMode('ON_GROUND')}
                className={`p-4 border-2 rounded-lg transition-all ${
                  mode === 'ON_GROUND'
                    ? 'border-indigo-500 bg-indigo-50'
                    : 'border-gray-300 hover:border-gray-400'
                }`}
              >
                <MapPin className="w-6 h-6 mx-auto mb-2" />
                <p className="font-medium">On-Ground</p>
                <p className="text-xs text-gray-500">Physical visit</p>
              </button>
            </div>
          </div>

          {mode === 'ON_GROUND' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Location (GPS)
              </label>
              <button
                onClick={getCurrentLocation}
                disabled={gettingLocation}
                className="w-full btn btn-outline flex items-center justify-center gap-2"
              >
                {gettingLocation ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <MapPin className="w-4 h-4" />
                )}
                {location ? 'Location Captured' : 'Get Current Location'}
              </button>
              {location && (
                <p className="text-sm text-gray-600 mt-2">
                  Lat: {location.lat.toFixed(6)}, Lng: {location.lng.toFixed(6)}
                </p>
              )}
            </div>
          )}

          <div className="flex gap-3 pt-4">
            <button
              onClick={onClose}
              className="flex-1 btn btn-outline"
            >
              Cancel
            </button>
            <button
              onClick={() => onStart(mode, location)}
              className="flex-1 btn btn-primary"
            >
              Start Audit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Submit Audit Modal Component
function SubmitAuditModal({ onClose, onSubmit, audit }: any) {
  const [formData, setFormData] = useState({
    recommendations: '',
    issues_severity: 'LOW',
    re_audit_required: false,
    workshop_manager_meeting_required: false,
    auditor_remarks: '',
  });

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Submit Audit</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Recommendations
            </label>
            <textarea
              value={formData.recommendations}
              onChange={(e) => setFormData({ ...formData, recommendations: e.target.value })}
              rows={4}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Provide recommendations..."
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Issues Severity
            </label>
            <select
              value={formData.issues_severity}
              onChange={(e) => setFormData({ ...formData, issues_severity: e.target.value })}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
            >
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="CRITICAL">Critical</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.re_audit_required}
                onChange={(e) => setFormData({ ...formData, re_audit_required: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700">Re-audit Required</span>
            </label>
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={formData.workshop_manager_meeting_required}
                onChange={(e) => setFormData({ ...formData, workshop_manager_meeting_required: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700">Workshop Manager Meeting Required</span>
            </label>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Auditor Remarks
            </label>
            <textarea
              value={formData.auditor_remarks}
              onChange={(e) => setFormData({ ...formData, auditor_remarks: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              placeholder="Final remarks..."
            />
          </div>

          <div className="flex gap-3 pt-4">
            <button onClick={onClose} className="flex-1 btn btn-outline">
              Cancel
            </button>
            <button
              onClick={() => onSubmit(formData)}
              className="flex-1 btn btn-primary flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Submit Audit
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

