'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { X, AlertTriangle, MessageSquare, ArrowLeft } from 'lucide-react';

interface SendBackModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadNumber: string;
  currentMechanicName: string;
  onSuccess: () => void;
}

const COMMON_REASONS = [
  'Incomplete work - Missing service items',
  'Poor quality work - Needs rework',
  'Missing BEFORE photos - Upload all 4 sides + odometer',
  'Missing DURING photos - Show parts replacement process',
  'Missing AFTER photos - Final result not documented',
  'Photos are blurry or unclear',
  'Wrong parts used - Check job card',
  'Safety concerns - Not following proper procedures',
  'Car not cleaned - Clean interior/exterior required',
  'Tools or parts left inside vehicle',
  'Oil spills or stains not cleaned',
  'Dashboard warning lights not addressed',
  'Test drive not completed',
  'Torque specifications not followed',
  'Customer complaint not resolved',
  'Extra work done without approval',
  'Parts documentation missing',
  'Job card not properly filled',
  'Time exceeded without valid reason',
  'Customer instructions not followed'
];

export default function SendBackModal({
  isOpen,
  onClose,
  leadId,
  leadNumber,
  currentMechanicName,
  onSuccess
}: SendBackModalProps) {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [customReason, setCustomReason] = useState('');
  const [additionalInstructions, setAdditionalInstructions] = useState('');
  const [priority, setPriority] = useState<'NORMAL' | 'HIGH' | 'URGENT'>('NORMAL');
  const [loading, setLoading] = useState(false);

  function toggleReason(reason: string) {
    setSelectedReasons(prev => 
      prev.includes(reason)
        ? prev.filter(r => r !== reason)
        : [...prev, reason]
    );
  }

  async function handleSendBack() {
    if (selectedReasons.length === 0 && !customReason.trim()) {
      alert('Please select at least one reason or provide a custom reason');
      return;
    }

    if (!additionalInstructions.trim()) {
      alert('Please provide additional instructions for the mechanic');
      return;
    }

    try {
      setLoading(true);
      const supabase = createClient();

      // Get current user (supervisor)
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id, full_name')
        .eq('email', user.email)
        .single();

      const supervisorId = userProfile?.id;
      const supervisorName = userProfile?.full_name;

      // Combine all reasons
      const allReasons = [
        ...selectedReasons,
        ...(customReason.trim() ? [customReason] : [])
      ];

      const sendBackMessage = `
🔄 JOB SENT BACK BY SUPERVISOR

Supervisor: ${supervisorName}
Date: ${new Date().toLocaleString('en-IN')}

REASONS FOR SENDING BACK:
${allReasons.map((r, i) => `${i + 1}. ${r}`).join('\n')}

ADDITIONAL INSTRUCTIONS:
${additionalInstructions}

Priority: ${priority}

Please address all issues and resubmit.
      `.trim();

      const now = new Date().toISOString();

      // Get current lead status before updating
      const { data: currentLead } = await supabase
        .from('service_leads')
        .select('status')
        .eq('id', leadId)
        .single();

      const oldStatus = currentLead?.status || 'UNKNOWN';

      // Update lead status to IN_PROGRESS (send back to mechanic) and add notes
      const { error: updateError } = await supabase
        .from('service_leads')
        .update({
          status: 'IN_PROGRESS', // Send back to mechanic for rework
          priority: priority,
          notes_internal: sendBackMessage,
          updated_at: now
        })
        .eq('id', leadId);

      if (updateError) throw updateError;

      // Update mechanic_jobs table to reset status so mechanic can see it
      const { data: mechanicJob } = await supabase
        .from('mechanic_jobs')
        .select('id, mechanic_id')
        .eq('lead_id', leadId)
        .single();

      if (mechanicJob) {
        await supabase
          .from('mechanic_jobs')
          .update({
            mechanic_status: 'IN_PROGRESS', // Reset to IN_PROGRESS so mechanic can see it
            updated_at: now
          })
          .eq('id', mechanicJob.id);
      }

      // Log status change in lead_status_history
      await supabase
        .from('lead_status_history')
        .insert({
          lead_id: leadId,
          old_status: oldStatus,
          new_status: 'IN_PROGRESS',
          changed_by: supervisorId,
          changed_at: now,
          reason: 'Job sent back to mechanic for rework',
          notes: sendBackMessage
        });

      // Create supervisor action
      await supabase
        .from('supervisor_actions')
        .insert({
          supervisor_id: supervisorId,
          lead_id: leadId,
          action_type: 'SENT_BACK_TO_MECHANIC',
          action_description: `Job sent back to ${currentMechanicName}`,
          action_data: {
            reasons: allReasons,
            instructions: additionalInstructions,
            priority: priority
          },
          notes: sendBackMessage
        });

      // Create lead event
      await supabase
        .from('lead_events')
        .insert({
          lead_id: leadId,
          event_type: 'SENT_BACK',
          event_description: `Supervisor sent job back to mechanic: ${allReasons[0]}${allReasons.length > 1 ? ` (+${allReasons.length - 1} more)` : ''}`,
          created_by: supervisorId
        });

      // TODO: Send notification to mechanic (SMS/Email/Push)

      alert('Job has been sent back to mechanic with instructions');
      onSuccess();
      onClose();
    } catch (error) {
      console.error('Error sending back:', error);
      alert('Failed to send back job');
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 bg-orange-50">
          <div>
            <h2 className="text-2xl font-bold text-text-heading flex items-center gap-2">
              <ArrowLeft className="w-6 h-6 text-orange-600" />
              Send Back to Mechanic
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Job #{leadNumber} • Assigned to: {currentMechanicName}
            </p>
          </div>
          <button
            onClick={onClose}
            className="btn btn-outline btn-sm"
            disabled={loading}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          {/* Warning */}
          <div className="card bg-yellow-50 border-yellow-200 mb-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-6 h-6 text-yellow-600 flex-shrink-0 mt-1" />
              <div>
                <p className="font-semibold text-yellow-800">Important</p>
                <p className="text-sm text-yellow-700 mt-1">
                  Sending a job back will notify the mechanic and update the job status. 
                  Please provide clear instructions so the mechanic knows exactly what needs to be fixed.
                </p>
              </div>
            </div>
          </div>

          {/* Priority Level */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Priority Level *
            </label>
            <div className="grid grid-cols-3 gap-3">
              {['NORMAL', 'HIGH', 'URGENT'].map((p) => (
                <button
                  key={p}
                  onClick={() => setPriority(p as any)}
                  className={`p-3 rounded-lg border-2 font-semibold transition-all ${
                    priority === p
                      ? p === 'URGENT'
                        ? 'bg-red-100 border-red-500 text-red-700'
                        : p === 'HIGH'
                        ? 'bg-orange-100 border-orange-500 text-orange-700'
                        : 'bg-blue-100 border-blue-500 text-blue-700'
                      : 'bg-gray-50 border-gray-300 text-gray-600 hover:border-gray-400'
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Common Reasons */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              Select Reasons * (Select all that apply)
            </label>
            <div className="max-h-64 overflow-y-auto border border-gray-200 rounded-lg p-3 space-y-2">
              {COMMON_REASONS.map((reason) => (
                <label
                  key={reason}
                  className={`flex items-start gap-3 p-3 rounded-lg cursor-pointer transition-all ${
                    selectedReasons.includes(reason)
                      ? 'bg-orange-50 border-2 border-orange-500'
                      : 'bg-gray-50 border border-gray-200 hover:bg-gray-100'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={selectedReasons.includes(reason)}
                    onChange={() => toggleReason(reason)}
                    className="checkbox mt-0.5"
                  />
                  <span className="text-sm text-gray-700">{reason}</span>
                </label>
              ))}
            </div>
            <p className="text-xs text-gray-600 mt-2">
              Selected: {selectedReasons.length} reason(s)
            </p>
          </div>

          {/* Custom Reason */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Custom Reason (Optional)
            </label>
            <textarea
              value={customReason}
              onChange={(e) => setCustomReason(e.target.value)}
              placeholder="Enter a custom reason if not listed above..."
              className="input w-full"
              rows={3}
            />
          </div>

          {/* Additional Instructions */}
          <div className="mb-6">
            <label className="block text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
              <MessageSquare className="w-4 h-4" />
              Detailed Instructions for Mechanic *
            </label>
            <textarea
              value={additionalInstructions}
              onChange={(e) => setAdditionalInstructions(e.target.value)}
              placeholder="Provide clear, specific instructions on what needs to be done...

Example:
- Re-take all BEFORE photos with better lighting
- Ensure odometer reading is clearly visible
- Upload photos showing the brake pad replacement process
- Clean the engine bay before taking AFTER photos"
              className="input w-full"
              rows={8}
            />
            <p className="text-xs text-gray-600 mt-2">
              Be specific and actionable. The mechanic will follow these instructions.
            </p>
          </div>

          {/* Preview */}
          {(selectedReasons.length > 0 || customReason.trim() || additionalInstructions.trim()) && (
            <div className="card bg-gray-50 border-gray-300">
              <h3 className="font-semibold text-sm text-gray-700 mb-3">
                📋 Preview of Message to Mechanic:
              </h3>
              <div className="bg-white p-4 rounded border border-gray-200 text-sm whitespace-pre-wrap">
                {`🔄 JOB SENT BACK BY SUPERVISOR

REASONS FOR SENDING BACK:
${[...selectedReasons, ...(customReason.trim() ? [customReason] : [])].map((r, i) => `${i + 1}. ${r}`).join('\n')}

${additionalInstructions.trim() ? `ADDITIONAL INSTRUCTIONS:\n${additionalInstructions}` : ''}

Priority: ${priority}

Please address all issues and resubmit.`}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-600">
              {selectedReasons.length + (customReason.trim() ? 1 : 0)} reason(s) selected
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="btn btn-outline"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                onClick={handleSendBack}
                disabled={loading || (selectedReasons.length === 0 && !customReason.trim()) || !additionalInstructions.trim()}
                className="btn bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2"
              >
                {loading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Sending Back...
                  </>
                ) : (
                  <>
                    <ArrowLeft className="w-4 h-4" />
                    Send Back to Mechanic
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

