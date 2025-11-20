'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, ArrowLeft, User, Car, FileText, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function CloseLeadPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [closureNotes, setClosureNotes] = useState('');
  const [confirmClose, setConfirmClose] = useState(false);

  useEffect(() => {
    fetchLeadDetails();
  }, [leadId]);

  async function fetchLeadDetails() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError || !leadData) {
        toast.error('Lead not found');
        router.push('/dashboard/cse');
        return;
      }

      setLead(leadData);

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  }

  async function handleCloseLead() {
    if (!closureNotes.trim()) {
      toast.error('Please provide closure notes');
      return;
    }

    if (!confirmClose) {
      toast.error('Please confirm lead closure');
      return;
    }

    setProcessing(true);

    try {
      const response = await fetch(`/api/cse/leads/${leadId}/close`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          closure_notes: closureNotes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to close lead');
        return;
      }

      toast.success('Lead closed successfully!');
      router.push('/dashboard/cse');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to close lead');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="cse">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout role="cse">
        <div className="card text-center py-12">
          <p className="text-red-600 font-semibold">Lead not found</p>
        </div>
      </DashboardLayout>
    );
  }

  if (lead.status === 'CLOSED') {
    return (
      <DashboardLayout role="cse">
        <div className="card text-center py-12">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700 mb-2">Lead Already Closed</h3>
          <p className="text-gray-500 mb-4">This lead was already closed.</p>
          <button onClick={() => router.push('/dashboard/cse')} className="btn-primary">
            Back to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="cse">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
        </div>

        {/* Warning Banner */}
        <div className="bg-gradient-to-r from-red-600 to-red-700 text-white p-6 rounded-lg">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <AlertCircle className="w-6 h-6" />
            Close Lead
          </h1>
          <p className="text-lg">Lead: {lead.lead_number}</p>
          <p className="text-sm mt-2 opacity-90">⚠️ This action will mark the lead as closed and no further follow-ups will be required.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Lead Summary */}
          <div className="lg:col-span-1 space-y-6">
            {/* Customer Info */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-brand-primary" />
                Customer
              </h3>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-semibold">{lead.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p className="font-semibold">{lead.customer_phone}</p>
                </div>
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Car className="w-5 h-5 text-brand-primary" />
                Vehicle
              </h3>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Number</p>
                  <p className="font-semibold text-xl">{lead.vehicle_number}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Make/Model</p>
                  <p className="font-semibold">{lead.vehicle_make} {lead.vehicle_model}</p>
                </div>
              </div>
            </div>

            {/* Lead Stats */}
            <div className="card bg-blue-50">
              <h3 className="text-lg font-semibold mb-3">Lead Statistics</h3>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Status:</span>
                  <span className="font-semibold">{lead.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Total Calls:</span>
                  <span className="font-semibold">{lead.total_calls || 0}</span>
                </div>
                {lead.customer_satisfaction_score && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Satisfaction:</span>
                    <span className="font-semibold">{lead.customer_satisfaction_score}/5</span>
                  </div>
                )}
                {lead.invoice_amount && (
                  <div className="flex justify-between">
                    <span className="text-sm text-gray-600">Invoice Amount:</span>
                    <span className="font-semibold text-green-600">₹{lead.invoice_amount.toFixed(2)}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Right Column - Closure Form */}
          <div className="lg:col-span-2">
            <div className="card space-y-6">
              <h3 className="text-xl font-bold border-b pb-3">Lead Closure Details</h3>

              {/* Closure Checklist */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h4 className="font-semibold text-yellow-800 mb-3">Pre-Closure Checklist</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-5 h-5 ${lead.invoice_sent_at ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className={lead.invoice_sent_at ? 'text-green-700' : 'text-gray-600'}>
                      Invoice sent to customer
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-5 h-5 ${lead.customer_satisfaction_score ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className={lead.customer_satisfaction_score ? 'text-green-700' : 'text-gray-600'}>
                      Customer satisfaction recorded
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-5 h-5 ${lead.total_calls > 0 ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className={lead.total_calls > 0 ? 'text-green-700' : 'text-gray-600'}>
                      Follow-up calls completed
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CheckCircle className={`w-5 h-5 ${!lead.follow_up_required ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className={!lead.follow_up_required ? 'text-green-700' : 'text-gray-600'}>
                      No pending follow-ups
                    </span>
                  </div>
                </div>
              </div>

              {/* Warning if follow-up required */}
              {lead.follow_up_required && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                  <div className="flex items-start gap-2">
                    <AlertCircle className="w-5 h-5 text-red-600 mt-0.5" />
                    <div>
                      <p className="font-semibold text-red-800">Warning: Pending Follow-up</p>
                      <p className="text-sm text-red-700 mt-1">
                        This lead has a pending follow-up scheduled. Are you sure you want to close it?
                      </p>
                      {lead.next_follow_up_at && (
                        <p className="text-sm text-red-600 mt-1">
                          Next follow-up: {new Date(lead.next_follow_up_at).toLocaleString()}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Closure Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <FileText className="inline-block w-4 h-4 mr-1" />
                  Closure Notes <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={closureNotes}
                  onChange={(e) => setClosureNotes(e.target.value)}
                  className="input w-full"
                  rows={6}
                  placeholder="Provide detailed closure notes:&#10;&#10;- Reason for closure&#10;- Final customer feedback&#10;- Any outstanding issues&#10;- Overall service summary&#10;- Recommendations for future"
                  required
                />
              </div>

              {/* Confirmation Checkbox */}
              <div className="bg-gray-50 p-4 rounded-lg">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={confirmClose}
                    onChange={(e) => setConfirmClose(e.target.checked)}
                    className="w-5 h-5 mt-0.5"
                  />
                  <div>
                    <p className="font-semibold">I confirm that:</p>
                    <ul className="text-sm text-gray-600 mt-1 space-y-1">
                      <li>• All service work has been completed</li>
                      <li>• Customer has been contacted and is satisfied</li>
                      <li>• All necessary follow-ups have been done</li>
                      <li>• This lead can be permanently closed</li>
                    </ul>
                  </div>
                </label>
              </div>

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t">
                <button
                  onClick={handleCloseLead}
                  disabled={processing || !closureNotes.trim() || !confirmClose}
                  className="btn-primary bg-red-600 hover:bg-red-700 flex-1 flex items-center justify-center gap-2 py-3"
                >
                  <CheckCircle className="w-5 h-5" />
                  {processing ? 'Closing Lead...' : 'Close Lead Permanently'}
                </button>
                <button
                  onClick={() => router.back()}
                  disabled={processing}
                  className="btn-secondary flex-1 py-3"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

