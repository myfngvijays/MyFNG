'use client';

import { useState, useEffect } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Loader2, Save } from 'lucide-react';
import toast from 'react-hot-toast';

interface AuditChecklistComponentProps {
  auditId: string;
  auditType: string;
  checklist: any[];
  onUpdate: () => void;
}

export default function AuditChecklistComponent({
  auditId,
  auditType,
  checklist,
  onUpdate,
}: AuditChecklistComponentProps) {
  const [items, setItems] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (checklist.length > 0) {
      setItems(checklist);
    } else {
      // Initialize with default checklist items
      initializeChecklist();
    }
  }, [checklist, auditType]);

  const initializeChecklist = () => {
    if (auditType === 'JOB_CARD') {
      const defaultItems = [
        { category: 'BEFORE_IMAGES', item_name: 'Before images uploaded (Front, Rear, Left, Right)', is_mandatory: true, is_critical: true },
        { category: 'BEFORE_IMAGES', item_name: 'Odometer reading captured', is_mandatory: true, is_critical: false },
        { category: 'BEFORE_IMAGES', item_name: 'Existing damages noted', is_mandatory: true, is_critical: true },
        { category: 'BEFORE_IMAGES', item_name: 'Engine bay images captured', is_mandatory: true, is_critical: false },
        { category: 'DURING_IMAGES', item_name: 'Service work images (filters, oil, AC cleaning)', is_mandatory: true, is_critical: true },
        { category: 'DURING_IMAGES', item_name: 'Timestamps match service sequence', is_mandatory: true, is_critical: true },
        { category: 'AFTER_IMAGES', item_name: 'After service images (clean vehicle)', is_mandatory: true, is_critical: true },
        { category: 'AFTER_IMAGES', item_name: 'Reassembled parts verified', is_mandatory: true, is_critical: true },
        { category: 'AFTER_IMAGES', item_name: 'Final odometer reading', is_mandatory: true, is_critical: false },
        { category: 'PARTS_USED', item_name: 'Parts used match invoice', is_mandatory: true, is_critical: true },
        { category: 'EXTRA_CHARGES', item_name: 'Extra charges validated', is_mandatory: true, is_critical: true },
        { category: 'EXTRA_CHARGES', item_name: 'No inflated or duplicate charges', is_mandatory: true, is_critical: true },
        { category: 'BILLING_COMPLIANCE', item_name: 'Invoice matches work done', is_mandatory: true, is_critical: true },
        { category: 'BILLING_COMPLIANCE', item_name: 'No fraudulent parts', is_mandatory: true, is_critical: true },
        { category: 'SOP_COMPLIANCE', item_name: 'All customer instructions followed', is_mandatory: true, is_critical: true },
      ];
      setItems(defaultItems.map((item, index) => ({
        ...item,
        id: `temp-${index}`,
        is_verified: false,
        verification_status: 'PENDING',
        points_awarded: 0,
        max_points: item.is_critical ? 10 : 5,
      })));
    } else {
      // Workshop facility checklist
      const defaultItems = [
        { category: 'CLEANLINESS', item_name: 'Workshop floor clean', is_mandatory: true, is_critical: false },
        { category: 'CLEANLINESS', item_name: 'Waste disposal proper', is_mandatory: true, is_critical: false },
        { category: 'CLEANLINESS', item_name: 'Inventory room hygiene maintained', is_mandatory: true, is_critical: false },
        { category: 'EQUIPMENT', item_name: 'Tool availability verified', is_mandatory: true, is_critical: true },
        { category: 'SAFETY', item_name: 'Fire extinguisher valid', is_mandatory: true, is_critical: true },
        { category: 'SAFETY', item_name: 'Safety signs displayed', is_mandatory: true, is_critical: true },
        { category: 'STAFF', item_name: 'Mechanic uniform worn', is_mandatory: true, is_critical: false },
        { category: 'CUSTOMER_SERVICE', item_name: 'Customer vehicle care proper', is_mandatory: true, is_critical: true },
        { category: 'CUSTOMER_SERVICE', item_name: 'Parking management adequate', is_mandatory: true, is_critical: false },
      ];
      setItems(defaultItems.map((item, index) => ({
        ...item,
        id: `temp-${index}`,
        is_verified: false,
        verification_status: 'PENDING',
        points_awarded: 0,
        max_points: item.is_critical ? 10 : 5,
      })));
    }
  };

  const toggleItem = (index: number) => {
    const newItems = [...items];
    newItems[index].is_verified = !newItems[index].is_verified;
    newItems[index].verification_status = newItems[index].is_verified ? 'VERIFIED' : 'PENDING';
    newItems[index].points_awarded = newItems[index].is_verified ? newItems[index].max_points : 0;
    setItems(newItems);
  };

  const updatePoints = (index: number, points: number) => {
    const newItems = [...items];
    newItems[index].points_awarded = Math.min(Math.max(0, points), newItems[index].max_points);
    setItems(newItems);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch(`/api/auditor/audits/${auditId}/score`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist_items: items.map((item) => ({
            id: item.id,
            category: item.category,
            item_name: item.item_name,
            is_verified: item.is_verified,
            verification_status: item.verification_status,
            points_awarded: item.points_awarded,
            max_points: item.max_points,
            verification_notes: item.verification_notes || '',
          })),
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save checklist');
      }

      toast.success('Checklist saved successfully');
      onUpdate();
    } catch (error: any) {
      toast.error(error.message || 'Failed to save checklist');
    } finally {
      setSaving(false);
    }
  };

  const completedCount = items.filter((item) => item.is_verified).length;
  const totalCount = items.length;
  const completionPercentage = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Progress */}
      <div className="bg-gray-50 rounded-lg p-4">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold">Checklist Progress</h3>
          <span className="text-sm font-medium text-gray-600">
            {completedCount}/{totalCount} ({completionPercentage}%)
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div
            className="bg-indigo-600 h-3 rounded-full transition-all"
            style={{ width: `${completionPercentage}%` }}
          />
        </div>
      </div>

      {/* Checklist Items */}
      <div className="space-y-3">
        {items.map((item, index) => (
          <div
            key={item.id || index}
            className={`border rounded-lg p-4 ${
              item.is_verified ? 'bg-green-50 border-green-200' : 'bg-white border-gray-200'
            }`}
          >
            <div className="flex items-start gap-3">
              <button
                onClick={() => toggleItem(index)}
                className="flex-shrink-0 mt-1"
              >
                {item.is_verified ? (
                  <CheckCircle className="w-6 h-6 text-green-600" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                )}
              </button>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium">{item.item_name}</h4>
                  {item.is_critical && (
                    <span className="px-2 py-0.5 text-xs bg-red-100 text-red-800 rounded-full">
                      Critical
                    </span>
                  )}
                  {item.is_mandatory && (
                    <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-800 rounded-full">
                      Mandatory
                    </span>
                  )}
                </div>
                <div className="text-sm text-gray-600 mb-2">
                  Category: {item.category.replace(/_/g, ' ')}
                </div>
                {item.is_verified && (
                  <div className="flex items-center gap-4 mt-2">
                    <div>
                      <label className="text-sm text-gray-600">Points:</label>
                      <input
                        type="number"
                        min="0"
                        max={item.max_points}
                        value={item.points_awarded}
                        onChange={(e) => updatePoints(index, parseInt(e.target.value) || 0)}
                        className="ml-2 w-20 px-2 py-1 border border-gray-300 rounded text-sm"
                      />
                      <span className="text-sm text-gray-500 ml-1">/ {item.max_points}</span>
                    </div>
                  </div>
                )}
                <textarea
                  placeholder="Verification notes..."
                  value={item.verification_notes || ''}
                  onChange={(e) => {
                    const newItems = [...items];
                    newItems[index].verification_notes = e.target.value;
                    setItems(newItems);
                  }}
                  rows={2}
                  className="mt-2 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Save Button */}
      <div className="flex justify-end">
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
          Save Checklist
        </button>
      </div>
    </div>
  );
}

