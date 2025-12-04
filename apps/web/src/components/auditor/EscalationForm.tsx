'use client';

import { useState } from 'react';
import { Flag, Send, Loader2, AlertTriangle } from 'lucide-react';
import toast from 'react-hot-toast';

interface EscalationFormProps {
  auditId: string;
  leadId: string | null;
  workshopId: string | null;
  onSuccess: () => void;
}

export default function EscalationForm({
  auditId,
  leadId,
  workshopId,
  onSuccess,
}: EscalationFormProps) {
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    escalation_type: 'FRAUD',
    priority: 'HIGH',
    reason: '',
    details: '',
    escalated_to_user_id: '',
    evidence_urls: [] as string[],
  });

  const escalationTypes = [
    { value: 'FRAUD', label: 'Fraud Detected' },
    { value: 'MISSING_PARTS', label: 'Missing Parts' },
    { value: 'VEHICLE_DAMAGE', label: 'Vehicle Damage' },
    { value: 'EXTRA_CHARGES_SCAM', label: 'Extra Charges Scam' },
    { value: 'UNSAFE_PRACTICES', label: 'Unsafe Practices' },
    { value: 'REPEATED_ISSUES', label: 'Repeated Issues' },
    { value: 'OTHER', label: 'Other' },
  ];

  const priorities = [
    { value: 'LOW', label: 'Low', color: 'bg-blue-100 text-blue-800' },
    { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'URGENT', label: 'Urgent', color: 'bg-red-100 text-red-800' },
    { value: 'CRITICAL', label: 'Critical', color: 'bg-red-200 text-red-900' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.reason) {
      toast.error('Escalation reason is required');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(`/api/auditor/audits/${auditId}/escalate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to escalate');
      }

      toast.success('Escalation submitted successfully');
      onSuccess();
    } catch (error: any) {
      toast.error(error.message || 'Failed to escalate');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg">
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          <div>
            <p className="font-semibold text-red-900">Escalate Audit</p>
            <p className="text-sm text-red-700">
              Escalate serious issues to Sub Admin or Super Admin for immediate action
            </p>
          </div>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Escalation Type *
          </label>
          <select
            value={formData.escalation_type}
            onChange={(e) => setFormData({ ...formData, escalation_type: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            required
          >
            {escalationTypes.map((type) => (
              <option key={type.value} value={type.value}>
                {type.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Priority *
          </label>
          <div className="grid grid-cols-5 gap-2">
            {priorities.map((priority) => (
              <button
                key={priority.value}
                type="button"
                onClick={() => setFormData({ ...formData, priority: priority.value })}
                className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  formData.priority === priority.value
                    ? priority.color
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                {priority.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Escalation Reason *
          </label>
          <input
            type="text"
            value={formData.reason}
            onChange={(e) => setFormData({ ...formData, reason: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            placeholder="Brief reason for escalation"
            required
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Detailed Description *
          </label>
          <textarea
            value={formData.details}
            onChange={(e) => setFormData({ ...formData, details: e.target.value })}
            rows={5}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-red-500"
            placeholder="Provide detailed description of the issue, what was found, and why it needs escalation..."
            required
          />
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <p className="text-sm text-yellow-800">
            <strong>Note:</strong> Escalations will be sent to Auditor Sub Admin. Critical escalations may also notify Super Admin.
          </p>
        </div>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={submitting}
            className="flex-1 btn btn-primary bg-red-600 hover:bg-red-700 flex items-center justify-center gap-2"
          >
            {submitting ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Flag className="w-4 h-4" />
                Escalate Audit
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}

