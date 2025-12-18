'use client';

import React, { useState } from 'react';
import { X, Loader2, Check, XCircle, Image as ImageIcon, ZoomIn } from 'lucide-react';

interface ExtraCharge {
  id: string;
  description: string;
  amount: number;
  reason: string;
  image_url?: string | null;
  requested_by_name?: string;
  requester?: { full_name?: string | null } | null;
  created_at: string;
}

interface ExtraWorkModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadNumber: string;
  extraCharge: ExtraCharge;
  onSuccess: () => void;
}

const REJECTION_REASONS = [
  'Not necessary',
  'Overpriced',
  'Insufficient evidence',
  'Already covered in original quote',
  'Customer has not approved',
  'Other'
];

export default function ExtraWorkModal({
  isOpen,
  onClose,
  leadId,
  leadNumber,
  extraCharge,
  onSuccess
}: ExtraWorkModalProps) {
  const [action, setAction] = useState<'approve' | 'reject' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [customReason, setCustomReason] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageZoomed, setImageZoomed] = useState(false);

  async function handleSubmit() {
    if (action === 'reject') {
      const finalReason = rejectionReason === 'Other' ? customReason : rejectionReason;
      if (!finalReason || finalReason.trim() === '') {
        setError('Please provide a reason for rejection');
        return;
      }
    }

    try {
      setLoading(true);
      setError(null);

      const endpoint = action === 'approve' 
        ? `/api/leads/${leadId}/extra-work/approve`
        : `/api/leads/${leadId}/extra-work/reject`;

      const body: any = {
        charge_id: extraCharge.id,
        notes: notes.trim() || undefined
      };

      if (action === 'reject') {
        body.reason = rejectionReason === 'Other' ? customReason.trim() : rejectionReason;
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to process request');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Extra work processing error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-heading">Review Additional Job Request</h2>
            <p className="text-sm text-gray-600 mt-1">Lead: {leadNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {/* Charge Details */}
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-600">Description</p>
                <p className="font-semibold text-text-heading mt-1">{extraCharge.description}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Amount</p>
                <p className="text-2xl font-bold text-brand-primary mt-1">
                  ₹{extraCharge.amount.toLocaleString()}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Reason</p>
                <p className="font-medium text-gray-800 mt-1">{extraCharge.reason}</p>
              </div>
              <div>
                <p className="text-sm text-gray-600">Requested by</p>
                <p className="font-medium text-gray-800 mt-1">
                  {extraCharge.requested_by_name || extraCharge.requester?.full_name || 'Unknown'}
                </p>
              </div>
            </div>
          </div>

          {/* Image */}
          {extraCharge.image_url ? (
            <div className="mb-4">
              <p className="text-sm font-medium text-gray-700 mb-2">Supporting Image</p>
              <div className="relative">
                <img
                  src={extraCharge.image_url}
                  alt="Extra work evidence"
                  className="w-full rounded-lg border border-gray-300 cursor-pointer hover:opacity-90 transition"
                  onClick={() => setImageZoomed(true)}
                />
                <button
                  onClick={() => setImageZoomed(true)}
                  className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 p-2 rounded-lg shadow transition"
                >
                  <ZoomIn className="w-5 h-5 text-gray-700" />
                </button>
              </div>
            </div>
          ) : (
            <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
              <ImageIcon className="w-5 h-5 text-yellow-600" />
              <p className="text-sm text-yellow-700">No supporting image provided</p>
            </div>
          )}

          {/* Action Selection */}
          {!action && (
            <div className="grid grid-cols-2 gap-4 mb-4">
              <button
                onClick={() => setAction('approve')}
                className="p-6 border-2 border-green-200 bg-green-50 hover:bg-green-100 rounded-lg transition flex flex-col items-center gap-2"
              >
                <Check className="w-8 h-8 text-green-600" />
                <span className="font-semibold text-green-700">Approve</span>
              </button>
              <button
                onClick={() => setAction('reject')}
                className="p-6 border-2 border-red-200 bg-red-50 hover:bg-red-100 rounded-lg transition flex flex-col items-center gap-2"
              >
                <XCircle className="w-8 h-8 text-red-600" />
                <span className="font-semibold text-red-700">Reject</span>
              </button>
            </div>
          )}

          {/* Approval Notes */}
          {action === 'approve' && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Approval Notes (Optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Add any notes about this approval..."
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
          )}

          {/* Rejection Reason */}
          {action === 'reject' && (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Reason for Rejection <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  {REJECTION_REASONS.map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setRejectionReason(r)}
                      className={`
                        px-3 py-2 rounded-lg text-sm font-medium transition-all
                        ${rejectionReason === r
                          ? 'bg-red-600 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }
                      `}
                    >
                      {r}
                    </button>
                  ))}
                </div>
                {rejectionReason === 'Other' && (
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
                  placeholder="Add any additional feedback..."
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          {action && (
            <button
              onClick={() => setAction(null)}
              disabled={loading}
              className="btn btn-outline"
            >
              Back
            </button>
          )}
          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-outline"
          >
            Cancel
          </button>
          {action && (
            <button
              onClick={handleSubmit}
              disabled={loading || (action === 'reject' && !rejectionReason) || (rejectionReason === 'Other' && !customReason)}
              className={`btn flex items-center gap-2 ${
                action === 'approve'
                  ? 'bg-green-600 hover:bg-green-700 text-white'
                  : 'bg-red-600 hover:bg-red-700 text-white'
              }`}
            >
              {loading && <Loader2 className="w-4 h-4 animate-spin" />}
              {action === 'approve' ? 'Approve Work' : 'Reject Work'}
            </button>
          )}
        </div>
      </div>

      {/* Image Zoom Modal */}
      {imageZoomed && extraCharge.image_url && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-[60] p-4"
          onClick={() => setImageZoomed(false)}
        >
          <button
            className="absolute top-4 right-4 text-white hover:text-gray-300"
            onClick={() => setImageZoomed(false)}
          >
            <X className="w-8 h-8" />
          </button>
          <img
            src={extraCharge.image_url}
            alt="Extra work evidence (zoomed)"
            className="max-w-full max-h-full object-contain"
          />
        </div>
      )}
    </div>
  );
}

