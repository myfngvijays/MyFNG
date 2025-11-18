'use client';

/**
 * Audit & Quality Section
 * Manage audit checklist and quality checks
 * Task: WA-501
 */

import { useState, useEffect } from 'react';
import { ClipboardCheck, CheckCircle, XCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface AuditSectionProps {
  lead: any;
  onUpdate?: () => void;
}

interface Audit {
  id: string;
  audit_required: boolean;
  audit_status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED';
  auditor_id?: string;
  audit_remarks?: string;
  audit_score?: number;
  audit_completed_at?: string;
  created_at: string;
  auditor?: { full_name: string };
}

interface ChecklistItem {
  id: string;
  item_name: string;
  is_checked: boolean;
  notes?: string;
}

export default function AuditSection({ lead, onUpdate }: AuditSectionProps) {
  const [audit, setAudit] = useState<Audit | null>(null);
  const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [remarks, setRemarks] = useState('');
  const [score, setScore] = useState(0);

  const defaultChecklistItems = [
    'Vehicle exterior cleaned',
    'Interior cleaned and vacuumed',
    'All requested services completed',
    'Parts installation verified',
    'Test drive completed',
    'No warning lights on dashboard',
    'Fluid levels checked',
    'Tire pressure checked',
    'Documents properly filed',
    'Customer belongings checked'
  ];

  useEffect(() => {
    fetchAudit();
  }, [lead.id]);

  async function fetchAudit() {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data: auditData, error: auditError } = await supabase
        .from('audits')
        .select(`
          *,
          auditor:auditor_id(full_name)
        `)
        .eq('lead_id', lead.id)
        .single();

      if (auditError && auditError.code !== 'PGRST116') {
        throw auditError;
      }

      setAudit(auditData);

      if (auditData) {
        const { data: checklistData } = await supabase
          .from('audit_checklist')
          .select('*')
          .eq('audit_id', auditData.id)
          .order('item_name', { ascending: true });

        setChecklist(checklistData || []);
      }
    } catch (error) {
      console.error('Error fetching audit:', error);
    } finally {
      setLoading(false);
    }
  }

  async function createAudit() {
    setLoading(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      // Create audit
      const { data: auditData, error: auditError } = await supabase
        .from('audits')
        .insert({
          lead_id: lead.id,
          audit_required: true,
          audit_status: 'IN_PROGRESS',
          auditor_id: user.id,
        })
        .select()
        .single();

      if (auditError) throw auditError;

      // Create checklist items
      const checklistInserts = defaultChecklistItems.map(item => ({
        audit_id: auditData.id,
        item_name: item,
        is_checked: false,
      }));

      const { error: checklistError } = await supabase
        .from('audit_checklist')
        .insert(checklistInserts);

      if (checklistError) throw checklistError;

      // Create event
      await supabase.from('lead_events').insert({
        lead_id: lead.id,
        event_type: 'AUDIT_STARTED',
        event_description: 'Quality audit started',
        event_data: { auditor_id: user.id },
        created_by: user.id,
      });

      alert('✅ Audit started successfully!');
      fetchAudit();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error creating audit:', error);
      alert(`Failed to start audit: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function toggleChecklistItem(itemId: string, currentStatus: boolean) {
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('audit_checklist')
        .update({ is_checked: !currentStatus })
        .eq('id', itemId);

      if (error) throw error;

      fetchAudit();
    } catch (error) {
      console.error('Error updating checklist:', error);
      alert('Failed to update checklist item');
    }
  }

  async function completeAudit() {
    if (!audit) return;

    const allChecked = checklist.every(item => item.is_checked);
    if (!allChecked) {
      if (!confirm('Not all items are checked. Continue anyway?')) return;
    }

    if (!remarks) {
      alert('Please provide audit remarks');
      return;
    }

    setLoading(true);
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const auditStatus = score >= 70 ? 'COMPLETED' : 'FAILED';

      const { error } = await supabase
        .from('audits')
        .update({
          audit_status: auditStatus,
          audit_remarks: remarks,
          audit_score: score,
          audit_completed_at: new Date().toISOString(),
        })
        .eq('id', audit.id);

      if (error) throw error;

      // Create event
      await supabase.from('lead_events').insert({
        lead_id: lead.id,
        event_type: 'AUDIT_COMPLETED',
        event_description: `Audit ${auditStatus.toLowerCase()} with score ${score}/100`,
        event_data: { audit_status: auditStatus, score },
        created_by: user.id,
      });

      alert(`✅ Audit completed! Status: ${auditStatus}`);
      fetchAudit();
      onUpdate?.();
    } catch (error: any) {
      console.error('Error completing audit:', error);
      alert(`Failed to complete audit: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  const checkedCount = checklist.filter(item => item.is_checked).length;
  const completionPercentage = checklist.length > 0 
    ? Math.round((checkedCount / checklist.length) * 100) 
    : 0;

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <ClipboardCheck className="w-5 h-5 text-brand-primary" />
        Audit & Quality Check
      </h2>

      {loading && !audit ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : !audit ? (
        <div className="text-center py-8">
          <ClipboardCheck className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500 mb-4">No audit started yet</p>
          <button
            onClick={createAudit}
            className="btn btn-primary"
          >
            <ClipboardCheck className="w-4 h-4" />
            Start Quality Audit
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Audit Status */}
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex justify-between items-center mb-2">
              <div>
                <p className="text-sm text-gray-600">Audit Status</p>
                <span
                  className={`inline-block px-3 py-1 text-sm font-semibold rounded-full ${
                    audit.audit_status === 'COMPLETED'
                      ? 'bg-green-100 text-green-800'
                      : audit.audit_status === 'FAILED'
                      ? 'bg-red-100 text-red-800'
                      : 'bg-yellow-100 text-yellow-800'
                  }`}
                >
                  {audit.audit_status}
                </span>
              </div>
              {audit.auditor && (
                <div className="text-right">
                  <p className="text-sm text-gray-600">Auditor</p>
                  <p className="font-semibold">{audit.auditor.full_name}</p>
                </div>
              )}
            </div>
            {audit.audit_score !== null && audit.audit_score !== undefined && (
              <div className="mt-3">
                <p className="text-sm text-gray-600">Audit Score</p>
                <p className="text-3xl font-bold text-gray-800">{audit.audit_score}/100</p>
              </div>
            )}
          </div>

          {/* Checklist Progress */}
          <div>
            <div className="flex justify-between items-center mb-2">
              <h3 className="font-semibold">Quality Checklist</h3>
              <span className="text-sm font-medium text-gray-600">
                {checkedCount}/{checklist.length} ({completionPercentage}%)
              </span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div
                className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${completionPercentage}%` }}
              />
            </div>

            <div className="space-y-2">
              {checklist.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <button
                    onClick={() => toggleChecklistItem(item.id, item.is_checked)}
                    disabled={audit.audit_status !== 'IN_PROGRESS'}
                    className="flex-shrink-0"
                  >
                    {item.is_checked ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <div className="w-6 h-6 rounded-full border-2 border-gray-300" />
                    )}
                  </button>
                  <span
                    className={`flex-1 ${
                      item.is_checked ? 'line-through text-gray-500' : 'text-gray-800'
                    }`}
                  >
                    {item.item_name}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Complete Audit Form */}
          {audit.audit_status === 'IN_PROGRESS' && (
            <div className="p-4 bg-gray-50 rounded-lg">
              <h3 className="font-semibold mb-3">Complete Audit</h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Overall Score (0-100) *
                  </label>
                  <input
                    type="number"
                    value={score}
                    onChange={(e) => setScore(parseInt(e.target.value))}
                    min="0"
                    max="100"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Score ≥ 70 = PASS, Score &lt; 70 = FAIL
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Audit Remarks *
                  </label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows={4}
                    placeholder="Provide detailed audit findings and recommendations..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                </div>
                <button
                  onClick={completeAudit}
                  disabled={loading}
                  className="btn btn-primary"
                >
                  <CheckCircle className="w-4 h-4" />
                  Complete Audit
                </button>
              </div>
            </div>
          )}

          {/* Audit Results */}
          {(audit.audit_status === 'COMPLETED' || audit.audit_status === 'FAILED') && (
            <div
              className={`p-4 rounded-lg border-2 ${
                audit.audit_status === 'COMPLETED'
                  ? 'bg-green-50 border-green-300'
                  : 'bg-red-50 border-red-300'
              }`}
            >
              <h3 className="font-semibold mb-2 flex items-center gap-2">
                {audit.audit_status === 'COMPLETED' ? (
                  <CheckCircle className="w-5 h-5 text-green-600" />
                ) : (
                  <XCircle className="w-5 h-5 text-red-600" />
                )}
                Audit {audit.audit_status === 'COMPLETED' ? 'Passed' : 'Failed'}
              </h3>
              <p className="text-sm text-gray-700 mb-2">
                <strong>Remarks:</strong> {audit.audit_remarks}
              </p>
              {audit.audit_completed_at && (
                <p className="text-xs text-gray-500">
                  Completed on: {new Date(audit.audit_completed_at).toLocaleString()}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

