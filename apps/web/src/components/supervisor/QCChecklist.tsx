'use client';

import React, { useState } from 'react';
import { CheckCircle, XCircle, Loader2, AlertTriangle, Check, X } from 'lucide-react';

interface QCChecklistProps {
  leadId: string;
  leadNumber: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const CHECKLIST_ITEMS = [
  { key: 'before_images_uploaded', label: 'Before images uploaded' },
  { key: 'progress_images_uploaded', label: 'Progress images uploaded' },
  { key: 'after_images_uploaded', label: 'After images uploaded' },
  { key: 'all_parts_documented', label: 'All parts documented' },
  { key: 'service_completed_as_requested', label: 'Service completed as per request' },
  { key: 'no_additional_issues', label: 'No additional issues found' },
  { key: 'car_cleaned', label: 'Car cleaned' },
  { key: 'test_drive_completed', label: 'Test drive completed' },
  { key: 'no_warning_lights', label: 'No warning lights on dashboard' },
  { key: 'documents_ready', label: 'Customer documents ready' }
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
  const [checklist, setChecklist] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    CHECKLIST_ITEMS.forEach(item => {
      initial[item.key] = false;
    });
    return initial;
  });

  const [decision, setDecision] = useState<'pass' | 'fail' | null>(null);
  const [notes, setNotes] = useState('');
  const [failureReason, setFailureReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChecklistChange = (key: string, value: boolean) => {
    setChecklist(prev => ({ ...prev, [key]: value }));
  };

  const allChecked = Object.values(checklist).every(v => v === true);
  const checkedCount = Object.values(checklist).filter(v => v).length;

  async function handleSubmit() {
    if (decision === 'fail') {
      const finalReason = failureReason === 'Other' ? customReason : failureReason;
      if (!finalReason || finalReason.trim() === '') {
        setError('Please provide a reason for QC failure');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const response = await fetch(`/api/leads/${leadId}/qc-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          qc_status: decision === 'pass' ? 'PASSED' : 'FAILED',
          checklist_data: checklist,
          notes: notes.trim() || undefined,
          failed_reason: decision === 'fail' 
            ? (failureReason === 'Other' ? customReason.trim() : failureReason)
            : undefined
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
              style={{ width: `${(checkedCount / CHECKLIST_ITEMS.length) * 100}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-600">
            {checkedCount}/{CHECKLIST_ITEMS.length}
          </span>
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-2 mb-6">
        {CHECKLIST_ITEMS.map((item) => (
          <div
            key={item.key}
            className={`
              p-3 rounded-lg border-2 cursor-pointer transition-all
              ${checklist[item.key]
                ? 'border-green-500 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
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
              <span className={`
                font-medium
                ${checklist[item.key] ? 'text-green-700' : 'text-gray-700'}
              `}>
                {item.label}
              </span>
            </div>
          </div>
        ))}
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
            Job will be marked as <strong>READY FOR DELIVERY</strong>
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
            Job will be sent back to mechanic as <strong>IN PROGRESS</strong>
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

