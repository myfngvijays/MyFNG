'use client';

import { useState } from 'react';
import { AlertTriangle, Plus, X, Save, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface AuditFindingsFormProps {
  auditId: string;
  findings: any[];
  onUpdate: () => void;
}

export default function AuditFindingsForm({
  auditId,
  findings,
  onUpdate,
}: AuditFindingsFormProps) {
  const [items, setItems] = useState<any[]>(findings || []);
  const [showAddForm, setShowAddForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [newFinding, setNewFinding] = useState({
    finding_type: 'MISSING_IMAGE',
    severity: 'MEDIUM',
    title: '',
    description: '',
    evidence_photos: [] as string[],
    evidence_notes: '',
    requires_re_audit: false,
  });

  const findingTypes = [
    { value: 'MISSING_IMAGE', label: 'Missing Image' },
    { value: 'FAKE_IMAGE', label: 'Fake Image' },
    { value: 'PARTS_MISMATCH', label: 'Parts Mismatch' },
    { value: 'EXTRA_CHARGE_FRAUD', label: 'Extra Charge Fraud' },
    { value: 'SERVICE_NOT_DONE', label: 'Service Not Done' },
    { value: 'DAMAGE_NOT_NOTED', label: 'Damage Not Noted' },
    { value: 'CLEANLINESS_ISSUE', label: 'Cleanliness Issue' },
    { value: 'SAFETY_VIOLATION', label: 'Safety Violation' },
    { value: 'OTHER', label: 'Other' },
  ];

  const severities = [
    { value: 'LOW', label: 'Low', color: 'bg-blue-100 text-blue-800' },
    { value: 'MEDIUM', label: 'Medium', color: 'bg-yellow-100 text-yellow-800' },
    { value: 'HIGH', label: 'High', color: 'bg-orange-100 text-orange-800' },
    { value: 'CRITICAL', label: 'Critical', color: 'bg-red-100 text-red-800' },
  ];

  const handleAddFinding = () => {
    if (!newFinding.title || !newFinding.description) {
      toast.error('Title and description are required');
      return;
    }

    setItems([...items, {
      ...newFinding,
      id: `temp-${Date.now()}`,
      resolved: false,
    }]);
    setNewFinding({
      finding_type: 'MISSING_IMAGE',
      severity: 'MEDIUM',
      title: '',
      description: '',
      evidence_photos: [],
      evidence_notes: '',
      requires_re_audit: false,
    });
    setShowAddForm(false);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save findings will be done when submitting audit
      toast.success('Findings will be saved when you submit the audit');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save findings');
    } finally {
      setSaving(false);
    }
  };

  const getSeverityColor = (severity: string) => {
    return severities.find(s => s.value === severity)?.color || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="space-y-4">
      {/* Existing Findings */}
      <div className="space-y-3">
        {items.map((finding, index) => (
          <div
            key={finding.id || index}
            className="border rounded-lg p-4 bg-white"
          >
            <div className="flex items-start justify-between mb-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-semibold">{finding.title}</h4>
                  <span className={`px-2 py-1 text-xs rounded-full ${getSeverityColor(finding.severity)}`}>
                    {finding.severity}
                  </span>
                  <span className="px-2 py-1 text-xs bg-gray-100 text-gray-800 rounded-full">
                    {finding.finding_type.replace(/_/g, ' ')}
                  </span>
                </div>
                <p className="text-sm text-gray-700 mb-2">{finding.description}</p>
                {finding.evidence_notes && (
                  <p className="text-sm text-gray-600 italic">Evidence: {finding.evidence_notes}</p>
                )}
                {finding.requires_re_audit && (
                  <span className="inline-block mt-2 px-2 py-1 text-xs bg-red-100 text-red-800 rounded-full">
                    Requires Re-Audit
                  </span>
                )}
              </div>
              <button
                onClick={() => setItems(items.filter((_, i) => i !== index))}
                className="text-red-600 hover:text-red-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Add Finding Form */}
      {showAddForm ? (
        <div className="border-2 border-dashed border-indigo-300 rounded-lg p-4 bg-indigo-50">
          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Finding Type *
              </label>
              <select
                value={newFinding.finding_type}
                onChange={(e) => setNewFinding({ ...newFinding, finding_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                {findingTypes.map((type) => (
                  <option key={type.value} value={type.value}>
                    {type.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity *
              </label>
              <div className="grid grid-cols-4 gap-2">
                {severities.map((sev) => (
                  <button
                    key={sev.value}
                    onClick={() => setNewFinding({ ...newFinding, severity: sev.value })}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                      newFinding.severity === sev.value
                        ? sev.color
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {sev.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={newFinding.title}
                onChange={(e) => setNewFinding({ ...newFinding, title: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Brief title of the finding"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description *
              </label>
              <textarea
                value={newFinding.description}
                onChange={(e) => setNewFinding({ ...newFinding, description: e.target.value })}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Detailed description of the finding..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Evidence Notes
              </label>
              <textarea
                value={newFinding.evidence_notes}
                onChange={(e) => setNewFinding({ ...newFinding, evidence_notes: e.target.value })}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                placeholder="Notes about evidence..."
              />
            </div>

            <label className="flex items-center">
              <input
                type="checkbox"
                checked={newFinding.requires_re_audit}
                onChange={(e) => setNewFinding({ ...newFinding, requires_re_audit: e.target.checked })}
                className="w-4 h-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
              />
              <span className="ml-2 text-sm text-gray-700">Requires Re-Audit</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={handleAddFinding}
                className="flex-1 btn btn-primary flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Finding
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowAddForm(true)}
          className="w-full btn btn-outline flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Finding
        </button>
      )}

      {/* Summary */}
      {items.length > 0 && (
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="font-semibold">Total Findings: {items.length}</p>
              <p className="text-sm text-gray-600">
                Critical: {items.filter(f => f.severity === 'CRITICAL').length} | 
                High: {items.filter(f => f.severity === 'HIGH').length} | 
                Medium: {items.filter(f => f.severity === 'MEDIUM').length} | 
                Low: {items.filter(f => f.severity === 'LOW').length}
              </p>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="btn btn-primary flex items-center gap-2"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save Findings
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

