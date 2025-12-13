'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { CheckCircle, XCircle, Loader2, AlertTriangle, Check, X, Camera, Wrench, Image as ImageIcon } from 'lucide-react';

interface QCChecklistProps {
  leadId: string;
  leadNumber: string;
  onSuccess: () => void;
  onCancel: () => void;
}

// Photo requirements (source: mechanic_job_photos)
const REQUIRED_BEFORE_TYPES = [
  'BEFORE_FRONT',
  'BEFORE_REAR',
  'BEFORE_LEFT',
  'BEFORE_RIGHT',
  'BEFORE_DASHBOARD',
  'BEFORE_ENGINE_BAY',
];

const REQUIRED_AFTER_TYPES = [
  'AFTER_FRONT',
  'AFTER_REAR',
  'AFTER_LEFT',
  'AFTER_RIGHT',
  'AFTER_ENGINE_BAY',
  'AFTER_OLD_PARTS',
  'AFTER_ODOMETER',
];

const MIN_DURING_COUNT = 1;

const PHYSICAL_CHECK_ITEMS = [
  { key: 'physical_engine_bay_clean', label: 'Engine bay is clean' },
  { key: 'physical_bolts_tightened', label: 'All bolts tightened' },
  { key: 'physical_no_leaks', label: 'No leaks' },
  { key: 'physical_no_tools_left', label: 'No tools left inside car' },
  { key: 'physical_fluids_filled', label: 'Fluids filled properly' },
  { key: 'physical_noise_vibration_test', label: 'Noise/vibration test completed' },
  { key: 'physical_brake_performance_check', label: 'Brake performance check' },
  { key: 'physical_ac_cooling_check', label: 'AC cooling check (if applicable)' },
  { key: 'physical_car_cleaned', label: 'Car cleaned (interior/exterior)' },
  { key: 'physical_no_warning_lights', label: 'No warning lights on dashboard' },
  { key: 'physical_test_drive_completed', label: 'Test drive completed (if applicable)' },
];

const WORK_VERIFICATION_ITEMS = [
  { key: 'work_service_completed', label: 'Service completed as per request' },
  { key: 'work_no_additional_issues', label: 'No additional issues found' },
  { key: 'work_documents_ready', label: 'Customer documents ready' },
  { key: 'work_all_parts_documented', label: 'All parts documented/recorded in system' },
];

const EXTRA_WORK_VERIFICATION_ITEMS = [
  { key: 'extra_work_all_approved', label: 'Any extra work charges are approved by system (no pending requests)' },
  { key: 'extra_work_proof_uploaded', label: 'Extra work proof photo uploaded (if extra work exists)' },
];

const FAILURE_REASONS = [
  'Incomplete work',
  'Poor quality work',
  'Missing documentation',
  'Missing images',
  'Car not cleaned',
  'Test drive revealed issues',
  'Parts not properly documented',
  'Other'
];

export default function QCChecklist({ 
  leadId, 
  leadNumber, 
  onSuccess, 
  onCancel 
}: QCChecklistProps) {
  const ALL_ITEMS = useMemo(
    () => [...PHYSICAL_CHECK_ITEMS, ...WORK_VERIFICATION_ITEMS, ...EXTRA_WORK_VERIFICATION_ITEMS],
    []
  );

  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    ALL_ITEMS.forEach(item => {
      initial[item.key] = false;
    });
    // Photo items are computed automatically (shown separately)
    return initial;
  });

  const [loadingEvidence, setLoadingEvidence] = useState(false);
  const [evidenceError, setEvidenceError] = useState<string | null>(null);
  const [photoSummary, setPhotoSummary] = useState<{
    beforePresent: string[];
    duringCount: number;
    afterPresent: string[];
    missing: string[];
  }>({ beforePresent: [], duringCount: 0, afterPresent: [], missing: [] });

  const [extraWorkSummary, setExtraWorkSummary] = useState<{
    hasExtraWork: boolean;
    hasPendingExtraWork: boolean;
    allHaveProof: boolean;
    pendingCount: number;
    approvedCount: number;
  }>({ hasExtraWork: false, hasPendingExtraWork: false, allHaveProof: true, pendingCount: 0, approvedCount: 0 });

  const [decision, setDecision] = useState<'pass' | 'fail' | null>(null);
  const [notes, setNotes] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChecklistChange = (key: string, value: boolean) => {
    setChecklist(prev => ({ ...prev, [key]: value }));
  };

  const allChecked = Object.values(checklist).every(v => v === true) && photoSummary.missing.length === 0;
  const checkedCount = Object.values(checklist).filter(v => v).length;
  const totalCount = ALL_ITEMS.length + 1; // +1 for "Photo Verification" gate

  useEffect(() => {
    async function fetchEvidence() {
      try {
        setLoadingEvidence(true);
        setEvidenceError(null);
        const supabase = createClient();

        // 1) Photos (primary: mechanic_job_photos by lead_id)
        const { data: jobPhotos, error: photosError } = await supabase
          .from('mechanic_job_photos')
          .select('photo_category, photo_type')
          .eq('lead_id', leadId);

        if (photosError) throw photosError;

        const beforeTypes = new Set((jobPhotos || []).filter(p => p.photo_category === 'before').map(p => p.photo_type));
        const afterTypes = new Set((jobPhotos || []).filter(p => p.photo_category === 'after').map(p => p.photo_type));
        const duringCount = (jobPhotos || []).filter(p => p.photo_category === 'during').length;

        const missing: string[] = [];
        REQUIRED_BEFORE_TYPES.forEach((t) => { if (!beforeTypes.has(t)) missing.push(t); });
        REQUIRED_AFTER_TYPES.forEach((t) => { if (!afterTypes.has(t)) missing.push(t); });
        if (duringCount < MIN_DURING_COUNT) missing.push('DURING_* (at least 1)');

        setPhotoSummary({
          beforePresent: Array.from(beforeTypes),
          afterPresent: Array.from(afterTypes),
          duringCount,
          missing,
        });

        // 2) Parts recorded
        const { data: partsRows, error: partsError } = await supabase
          .from('mechanic_parts_usage')
          .select('id')
          .eq('lead_id', leadId)
          .limit(1);
        if (partsError) throw partsError;
        const hasPartsRecorded = (partsRows?.length || 0) > 0;

        // 3) Extra work approval verification
        const { data: extraCharges, error: extraError } = await supabase
          .from('lead_extra_charges')
          .select('id, status, attachment_url')
          .eq('lead_id', leadId);
        if (extraError) throw extraError;

        const hasExtraWork = (extraCharges?.length || 0) > 0;
        const pendingCount = (extraCharges || []).filter(c => c.status === 'PENDING').length;
        const approvedCount = (extraCharges || []).filter(c => c.status === 'APPROVED').length;
        const hasPendingExtraWork = pendingCount > 0;
        const allHaveProof = (extraCharges || []).every(c => !c.id ? true : (c.attachment_url ? true : false));

        setExtraWorkSummary({
          hasExtraWork,
          hasPendingExtraWork,
          allHaveProof,
          pendingCount,
          approvedCount,
        });

        // Auto-fill certain checklist items based on evidence
        setChecklist(prev => ({
          ...prev,
          work_all_parts_documented: hasPartsRecorded ? true : prev.work_all_parts_documented,
          extra_work_all_approved: !hasPendingExtraWork ? true : prev.extra_work_all_approved,
          extra_work_proof_uploaded: (!hasExtraWork || allHaveProof) ? true : prev.extra_work_proof_uploaded,
        }));
      } catch (e: any) {
        setEvidenceError(e?.message || 'Failed to load evidence');
      } finally {
        setLoadingEvidence(false);
      }
    }

    fetchEvidence();
  }, [leadId]);

  async function handleSubmit() {
    if (decision === 'fail') {
      const finalReason = failureReason === 'Other' ? customReason : failureReason;
      if (!finalReason || finalReason.trim() === '') {
        setError('Please provide a reason for QC failure');
        return;
      }
    } else if (decision === 'pass') {
      if (photoSummary.missing.length > 0) {
        setError('Photo verification failed: missing mandatory photos. Please send job back for rework.');
        return;
      }
      if (!Object.values(checklist).every(v => v === true)) {
        setError('Please complete all QC checks before approving.');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      // IMPORTANT:
      // Use supervisor-owned QC endpoints so audit_required logic and full workflow
      // transitions (READY_FOR_BILLING / AUDIT_PENDING) remain consistent.
      const response = decision === 'pass'
        ? await fetch(`/api/supervisor/jobs/${leadId}/approve-qc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              notes: notes.trim() || undefined,
              checklist_data: checklist,
              quality_score: Math.round((checkedCount / ALL_ITEMS.length) * 100),
            }),
          })
        : await fetch(`/api/supervisor/jobs/${leadId}/reject-qc`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              reason: (failureReason === 'Other' ? customReason.trim() : failureReason),
              failed_checklist_items: checklist,
              notes: notes.trim() || undefined,
            }),
          });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to submit QC');
      }

      onSuccess();
    } catch (err: any) {
      console.error('QC submission error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      {/* Header */}
      <div className="border-b border-gray-200 pb-4 mb-4">
        <h3 className="text-xl font-bold text-text-heading">Quality Control Checklist</h3>
        <p className="text-sm text-gray-600 mt-1">Lead: {leadNumber}</p>
        <div className="mt-2 flex items-center gap-2">
          <div className="flex-1 bg-gray-200 rounded-full h-2">
            <div 
              className="bg-brand-primary h-2 rounded-full transition-all duration-300"
              style={{ width: `${(checkedCount / totalCount) * 100}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-600">
            {checkedCount}/{totalCount}
          </span>
        </div>
      </div>

      {/* Evidence Summary (Photos/Extra work) */}
      <div className="mb-6 space-y-3">
        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <ImageIcon className="w-5 h-5 text-brand-primary" />
            <h4 className="font-semibold text-gray-800">Photo Verification</h4>
            {loadingEvidence && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
          </div>
          {evidenceError ? (
            <p className="text-sm text-red-600">{evidenceError}</p>
          ) : (
            <>
              <p className="text-sm text-gray-700">
                BEFORE: {photoSummary.beforePresent.length}/{REQUIRED_BEFORE_TYPES.length} • DURING: {photoSummary.duringCount} • AFTER: {photoSummary.afterPresent.length}/{REQUIRED_AFTER_TYPES.length}
              </p>
              {photoSummary.missing.length > 0 ? (
                <div className="mt-2 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <p className="text-sm text-yellow-800 font-semibold">Missing mandatory photos:</p>
                  <ul className="text-sm text-yellow-800 list-disc ml-5 mt-1">
                    {photoSummary.missing.map((m) => (
                      <li key={m}>{m}</li>
                    ))}
                  </ul>
                </div>
              ) : (
                <div className="mt-2 flex items-center gap-2 text-sm text-green-700">
                  <CheckCircle className="w-4 h-4" />
                  All required photo proofs are present
                </div>
              )}
            </>
          )}
        </div>

        <div className="p-4 rounded-lg border border-gray-200 bg-white">
          <div className="flex items-center gap-2 mb-2">
            <Wrench className="w-5 h-5 text-brand-primary" />
            <h4 className="font-semibold text-gray-800">Extra Work Verification</h4>
          </div>
          <p className="text-sm text-gray-700">
            Requests: {extraWorkSummary.pendingCount + extraWorkSummary.approvedCount} • Pending: {extraWorkSummary.pendingCount} • Approved: {extraWorkSummary.approvedCount}
          </p>
          {extraWorkSummary.hasPendingExtraWork && (
            <p className="text-sm text-red-600 mt-1">Pending extra work requests found. Approve/reject them before QC approval.</p>
          )}
          {extraWorkSummary.hasExtraWork && !extraWorkSummary.allHaveProof && (
            <p className="text-sm text-red-600 mt-1">Some extra work items are missing proof image (attachment_url).</p>
          )}
        </div>
      </div>

      {/* Checklist Items (Grouped) */}
      <div className="space-y-4 mb-6">
        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <Camera className="w-5 h-5 text-gray-700" />
            <h4 className="font-semibold text-gray-800">Physical Quality Check</h4>
          </div>
          <div className="space-y-2">
            {PHYSICAL_CHECK_ITEMS.map((item) => (
              <div
                key={item.key}
                className={`
                  p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${checklist[item.key]
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                  }
                `}
                onClick={() => handleChecklistChange(item.key, !checklist[item.key])}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-6 h-6 rounded-full flex items-center justify-center transition-colors
                    ${checklist[item.key]
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                    }
                  `}>
                    {checklist[item.key] && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className={`font-medium ${checklist[item.key] ? 'text-green-700' : 'text-gray-700'}`}>
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-5 h-5 text-gray-700" />
            <h4 className="font-semibold text-gray-800">Work & Documentation Verification</h4>
          </div>
          <div className="space-y-2">
            {WORK_VERIFICATION_ITEMS.map((item) => (
              <div
                key={item.key}
                className={`
                  p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${checklist[item.key]
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                  }
                `}
                onClick={() => handleChecklistChange(item.key, !checklist[item.key])}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-6 h-6 rounded-full flex items-center justify-center transition-colors
                    ${checklist[item.key]
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                    }
                  `}>
                    {checklist[item.key] && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className={`font-medium ${checklist[item.key] ? 'text-green-700' : 'text-gray-700'}`}>
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex items-center gap-2 mb-3">
            <Wrench className="w-5 h-5 text-gray-700" />
            <h4 className="font-semibold text-gray-800">Extra Work Verification</h4>
          </div>
          <div className="space-y-2">
            {EXTRA_WORK_VERIFICATION_ITEMS.map((item) => (
              <div
                key={item.key}
                className={`
                  p-3 rounded-lg border-2 cursor-pointer transition-all
                  ${checklist[item.key]
                    ? 'border-green-500 bg-green-50'
                    : 'border-gray-200 hover:border-gray-300 bg-white'
                  }
                `}
                onClick={() => handleChecklistChange(item.key, !checklist[item.key])}
              >
                <div className="flex items-center gap-3">
                  <div className={`
                    w-6 h-6 rounded-full flex items-center justify-center transition-colors
                    ${checklist[item.key]
                      ? 'bg-green-500'
                      : 'bg-gray-300'
                    }
                  `}>
                    {checklist[item.key] && <Check className="w-4 h-4 text-white" />}
                  </div>
                  <span className={`font-medium ${checklist[item.key] ? 'text-green-700' : 'text-gray-700'}`}>
                    {item.label}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* QC Decision */}
      {!decision && (
        <>
          <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-sm text-blue-700">
              <strong>Note:</strong> Review all checklist items carefully before making a decision.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 mb-4">
            <button
              onClick={() => setDecision('pass')}
              disabled={!allChecked}
              className={`
                p-6 border-2 rounded-lg transition flex flex-col items-center gap-2
                ${allChecked
                  ? 'border-green-500 bg-green-50 hover:bg-green-100 cursor-pointer'
                  : 'border-gray-300 bg-gray-100 cursor-not-allowed opacity-50'
                }
              `}
            >
              <CheckCircle className={`w-10 h-10 ${allChecked ? 'text-green-600' : 'text-gray-400'}`} />
              <span className={`font-semibold ${allChecked ? 'text-green-700' : 'text-gray-500'}`}>
                QC PASSED
              </span>
              {!allChecked && (
                <span className="text-xs text-gray-500">Complete all checks first</span>
              )}
            </button>

            <button
              onClick={() => setDecision('fail')}
              className="p-6 border-2 border-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition flex flex-col items-center gap-2 cursor-pointer"
            >
              <XCircle className="w-10 h-10 text-red-600" />
              <span className="font-semibold text-red-700">QC FAILED</span>
            </button>
          </div>
        </>
      )}

      {/* Pass - Notes */}
      {decision === 'pass' && (
        <div className="mb-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle className="w-5 h-5 text-green-600" />
            <h4 className="font-semibold text-green-700">QC Passed</h4>
          </div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            QC Notes (Optional)
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Add any quality control notes..."
            rows={3}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
          />
          <p className="text-xs text-gray-600 mt-2">
            Job will be marked as <strong>READY FOR BILLING</strong> (invoice generation starts after QC).
          </p>
        </div>
      )}

      {/* Fail - Reason & Notes */}
      {decision === 'fail' && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-5 h-5 text-red-600" />
            <h4 className="font-semibold text-red-700">QC Failed</h4>
          </div>

          <div className="mb-3">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Failure Reason <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {FAILURE_REASONS.map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => setFailureReason(reason)}
                  className={`
                    px-3 py-2 rounded-lg text-sm font-medium transition-all
                    ${failureReason === reason
                      ? 'bg-red-600 text-white'
                      : 'bg-white text-gray-700 hover:bg-gray-100 border border-gray-300'
                    }
                  `}
                >
                  {reason}
                </button>
              ))}
            </div>
            {failureReason === 'Other' && (
              <input
                type="text"
                value={customReason}
                onChange={(e) => setCustomReason(e.target.value)}
                placeholder="Please specify reason..."
                className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Provide detailed feedback for the mechanic..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
          </div>

          <p className="text-xs text-gray-600 mt-2">
            Job will be sent back to mechanic as <strong>REWORK REQUIRED</strong>
          </p>
        </div>
      )}

      {/* Error Message */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200">
        {decision && (
          <button
            onClick={() => setDecision(null)}
            disabled={loading}
            className="btn btn-outline"
          >
            <X className="w-4 h-4 mr-2" />
            Change Decision
          </button>
        )}
        <button
          onClick={onCancel}
          disabled={loading}
          className="btn btn-outline"
        >
          Cancel
        </button>
        {decision && (
          <button
            onClick={handleSubmit}
            disabled={loading || (decision === 'fail' && !failureReason) || (failureReason === 'Other' && !customReason)}
            className={`btn flex items-center gap-2 ${
              decision === 'pass'
                ? 'bg-green-600 hover:bg-green-700 text-white'
                : 'bg-red-600 hover:bg-red-700 text-white'
            }`}
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {decision === 'pass' ? 'Submit & Mark Ready' : 'Submit & Send Back'}
          </button>
        )}
      </div>
    </div>
  );
}

