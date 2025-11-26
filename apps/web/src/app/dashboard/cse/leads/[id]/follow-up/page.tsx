'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Phone, Star, ArrowLeft, User, Car, Calendar, Save } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

export default function LogFollowUpPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  // Form states
  const [customerResponse, setCustomerResponse] = useState('');
  const [satisfactionScore, setSatisfactionScore] = useState(5);
  const [serviceQualityRating, setServiceQualityRating] = useState(5);
  const [workshopRating, setWorkshopRating] = useState(5);
  const [pickupRating, setPickupRating] = useState(5);
  const [priceRating, setPriceRating] = useState(5);
  const [wouldRecommend, setWouldRecommend] = useState<boolean | null>(null);
  const [issuesReported, setIssuesReported] = useState('');
  const [issueCategory, setIssueCategory] = useState('');
  const [resolutionProvided, setResolutionProvided] = useState('');
  const [resolutionStatus, setResolutionStatus] = useState('PENDING');
  const [escalated, setEscalated] = useState(false);
  const [escalationReason, setEscalationReason] = useState('');
  const [notes, setNotes] = useState('');
  const [followUpRequired, setFollowUpRequired] = useState(false);
  const [nextFollowUpDate, setNextFollowUpDate] = useState('');
  const [nextFollowUpTime, setNextFollowUpTime] = useState('');

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

      // Pre-fill previous satisfaction score if exists
      if (leadData.customer_satisfaction_score) {
        setSatisfactionScore(leadData.customer_satisfaction_score);
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!customerResponse.trim()) {
      toast.error('Please enter customer response');
      return;
    }

    if (followUpRequired && (!nextFollowUpDate || !nextFollowUpTime)) {
      toast.error('Please specify next follow-up date and time');
      return;
    }

    setProcessing(true);

    try {
      const nextFollowUp = followUpRequired && nextFollowUpDate && nextFollowUpTime
        ? new Date(`${nextFollowUpDate}T${nextFollowUpTime}`).toISOString()
        : null;

      const response = await fetch(`/api/cse/leads/${leadId}/follow-up`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          followup_type: 'POST_SERVICE',
          customer_response: customerResponse,
          satisfaction_score: satisfactionScore,
          service_quality_rating: serviceQualityRating,
          workshop_rating: workshopRating,
          pickup_rating: pickupRating,
          price_rating: priceRating,
          would_recommend: wouldRecommend,
          issues_reported: issuesReported || null,
          issue_category: issueCategory || null,
          resolution_provided: resolutionProvided || null,
          resolution_status: resolutionStatus,
          escalated: escalated,
          escalation_reason: escalated ? escalationReason : null,
          notes: notes || null,
          follow_up_required: followUpRequired,
          next_follow_up_at: nextFollowUp
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to log follow-up');
        return;
      }

      toast.success('Follow-up logged successfully!');
      router.push('/dashboard/cse');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to log follow-up');
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

        {/* Lead Info Banner */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg">
          <h1 className="text-2xl font-bold mb-2 flex items-center gap-2">
            <Phone className="w-6 h-6" />
            Log Customer Follow-up
          </h1>
          <p className="text-lg">Lead: {lead.lead_number}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Lead Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Customer Info */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-brand-primary" />
                Customer Info
              </h3>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Name</p>
                  <p className="font-semibold">{lead.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <a href={`tel:${lead.customer_phone}`} className="font-semibold text-brand-primary hover:underline">
                    {lead.customer_phone}
                  </a>
                </div>
                {lead.customer_email && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p className="text-sm">{lead.customer_email}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Vehicle Info */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Car className="w-5 h-5 text-brand-primary" />
                Vehicle Info
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

            {/* Previous Follow-ups */}
            <div className="card bg-blue-50">
              <h3 className="text-lg font-semibold mb-2">Previous Follow-ups</h3>
              <p className="text-3xl font-bold text-brand-primary">{lead.total_calls || 0}</p>
              {lead.last_call_at && (
                <p className="text-sm text-gray-600 mt-1">
                  Last call: {new Date(lead.last_call_at).toLocaleString()}
                </p>
              )}
              {lead.customer_satisfaction_score && (
                <div className="mt-3 flex items-center gap-2">
                  <Star className="w-5 h-5 fill-yellow-400 text-yellow-400" />
                  <span className="font-semibold">Previous Score: {lead.customer_satisfaction_score}/5</span>
                </div>
              )}
            </div>
          </div>

          {/* Right Column - Follow-up Form */}
          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit} className="card space-y-6">
              <h3 className="text-xl font-bold border-b pb-3">Follow-up Details</h3>

              {/* Customer Response */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Customer Response <span className="text-red-500">*</span>
                </label>
                <textarea
                  value={customerResponse}
                  onChange={(e) => setCustomerResponse(e.target.value)}
                  className="input w-full"
                  rows={4}
                  placeholder="Summarize the conversation with the customer..."
                  required
                />
              </div>

              {/* Overall Satisfaction Score */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Overall Satisfaction Score <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((score) => (
                    <button
                      key={score}
                      type="button"
                      onClick={() => setSatisfactionScore(score)}
                      className={`flex-1 py-3 rounded-lg border-2 font-semibold transition flex items-center justify-center gap-2 ${
                        satisfactionScore === score
                          ? 'border-yellow-500 bg-yellow-50 text-yellow-700'
                          : 'border-gray-300 hover:border-yellow-400'
                      }`}
                    >
                      <Star className={`w-5 h-5 ${satisfactionScore >= score ? 'fill-yellow-400 text-yellow-400' : 'text-gray-400'}`} />
                      {score}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-gray-500 mt-1">1 = Very Unsatisfied, 5 = Very Satisfied</p>
              </div>

              {/* Detailed Ratings */}
              <div className="border-t pt-4">
                <h4 className="text-lg font-semibold mb-4">Detailed Ratings</h4>
                
                <div className="space-y-4">
                  {/* Service Quality Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Quality
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setServiceQualityRating(score)}
                          className={`flex-1 py-2 rounded-lg border-2 transition ${
                            serviceQualityRating >= score
                              ? 'border-green-500 bg-green-50 text-green-700'
                              : 'border-gray-300 hover:border-green-400'
                          }`}
                        >
                          <Star className={`w-4 h-4 mx-auto ${serviceQualityRating >= score ? 'fill-green-400 text-green-400' : 'text-gray-400'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Workshop Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Workshop Experience
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setWorkshopRating(score)}
                          className={`flex-1 py-2 rounded-lg border-2 transition ${
                            workshopRating >= score
                              ? 'border-blue-500 bg-blue-50 text-blue-700'
                              : 'border-gray-300 hover:border-blue-400'
                          }`}
                        >
                          <Star className={`w-4 h-4 mx-auto ${workshopRating >= score ? 'fill-blue-400 text-blue-400' : 'text-gray-400'}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Pickup Rating */}
                  {lead.pickup_required && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Pickup & Delivery Service
                      </label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((score) => (
                          <button
                            key={score}
                            type="button"
                            onClick={() => setPickupRating(score)}
                            className={`flex-1 py-2 rounded-lg border-2 transition ${
                              pickupRating >= score
                                ? 'border-purple-500 bg-purple-50 text-purple-700'
                                : 'border-gray-300 hover:border-purple-400'
                            }`}
                          >
                            <Star className={`w-4 h-4 mx-auto ${pickupRating >= score ? 'fill-purple-400 text-purple-400' : 'text-gray-400'}`} />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Price Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Value for Money
                    </label>
                    <div className="flex gap-2">
                      {[1, 2, 3, 4, 5].map((score) => (
                        <button
                          key={score}
                          type="button"
                          onClick={() => setPriceRating(score)}
                          className={`flex-1 py-2 rounded-lg border-2 transition ${
                            priceRating >= score
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-gray-300 hover:border-orange-400'
                          }`}
                        >
                          <Star className={`w-4 h-4 mx-auto ${priceRating >= score ? 'fill-orange-400 text-orange-400' : 'text-gray-400'}`} />
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Would Recommend */}
              <div className="border-t pt-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Would you recommend us to others?
                </label>
                <div className="flex gap-4">
                  <button
                    type="button"
                    onClick={() => setWouldRecommend(true)}
                    className={`flex-1 py-3 rounded-lg border-2 font-semibold transition ${
                      wouldRecommend === true
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-300 hover:border-green-400'
                    }`}
                  >
                    ✅ Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => setWouldRecommend(false)}
                    className={`flex-1 py-3 rounded-lg border-2 font-semibold transition ${
                      wouldRecommend === false
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-300 hover:border-red-400'
                    }`}
                  >
                    ❌ No
                  </button>
                </div>
              </div>

              {/* Issues Reported */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Issues Reported (Optional)
                </label>
                <textarea
                  value={issuesReported}
                  onChange={(e) => setIssuesReported(e.target.value)}
                  className="input w-full"
                  rows={3}
                  placeholder="Any issues or complaints reported by the customer..."
                />
                {issuesReported && (
                  <div className="mt-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Issue Category
                    </label>
                    <select
                      value={issueCategory}
                      onChange={(e) => setIssueCategory(e.target.value)}
                      className="input w-full"
                    >
                      <option value="">Select category</option>
                      <option value="QUALITY">Service Quality</option>
                      <option value="PRICING">Pricing</option>
                      <option value="DELAY">Delay</option>
                      <option value="BEHAVIOR">Staff Behavior</option>
                      <option value="OTHER">Other</option>
                    </select>
                  </div>
                )}
              </div>

              {/* Resolution Provided */}
              {issuesReported && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resolution Provided (Optional)
                    </label>
                    <textarea
                      value={resolutionProvided}
                      onChange={(e) => setResolutionProvided(e.target.value)}
                      className="input w-full"
                      rows={3}
                      placeholder="How were the issues resolved or what actions were taken..."
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Resolution Status
                    </label>
                    <select
                      value={resolutionStatus}
                      onChange={(e) => setResolutionStatus(e.target.value)}
                      className="input w-full"
                    >
                      <option value="PENDING">Pending</option>
                      <option value="RESOLVED">Resolved</option>
                      <option value="ESCALATED">Escalated</option>
                      <option value="NO_ACTION_NEEDED">No Action Needed</option>
                    </select>
                  </div>
                  {resolutionStatus === 'ESCALATED' && (
                    <div>
                      <label className="flex items-center gap-2 mb-2">
                        <input
                          type="checkbox"
                          checked={escalated}
                          onChange={(e) => setEscalated(e.target.checked)}
                          className="w-5 h-5"
                        />
                        <span className="font-medium">Escalate to Management</span>
                      </label>
                      {escalated && (
                        <textarea
                          value={escalationReason}
                          onChange={(e) => setEscalationReason(e.target.value)}
                          className="input w-full mt-2"
                          rows={2}
                          placeholder="Reason for escalation..."
                        />
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Additional Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Additional Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input w-full"
                  rows={2}
                  placeholder="Any additional notes or observations..."
                />
              </div>

              {/* Follow-up Required */}
              <div className="border-t pt-4">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={followUpRequired}
                    onChange={(e) => setFollowUpRequired(e.target.checked)}
                    className="w-5 h-5"
                  />
                  <span className="font-medium">Schedule Next Follow-up</span>
                </label>
              </div>

              {/* Next Follow-up Schedule */}
              {followUpRequired && (
                <div className="bg-blue-50 p-4 rounded-lg space-y-4">
                  <h4 className="font-semibold flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-blue-600" />
                    Next Follow-up Schedule
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Date <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="date"
                        value={nextFollowUpDate}
                        onChange={(e) => setNextFollowUpDate(e.target.value)}
                        className="input w-full"
                        required={followUpRequired}
                        min={new Date().toISOString().split('T')[0]}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Time <span className="text-red-500">*</span>
                      </label>
                      <input
                        type="time"
                        value={nextFollowUpTime}
                        onChange={(e) => setNextFollowUpTime(e.target.value)}
                        className="input w-full"
                        required={followUpRequired}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Submit Button */}
              <button
                type="submit"
                disabled={processing}
                className="btn-primary w-full flex items-center justify-center gap-2 py-3"
              >
                <Save className="w-5 h-5" />
                {processing ? 'Saving...' : 'Save Follow-up'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

