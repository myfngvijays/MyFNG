'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';
import { formatDateTimeIST } from '@/lib/utils';
import { ArrowLeft, Car, Clock, DollarSign, Image as ImageIcon, MapPin, MessageSquare, Phone, User, Wrench } from 'lucide-react';

function formatAssignmentDateTime(value: string | null | undefined) {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const hasTimezone = /([zZ]|[+\-]\d{2}:?\d{2})$/.test(raw);
  const normalized = hasTimezone ? raw : `${raw}Z`;
  return formatDateTimeIST(normalized);
}

function getStatusBadge(status: string) {
  const key = String(status || '').toLowerCase();
  const badges: Record<string, { bg: string; text: string; label: string }> = {
    pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', label: 'Pending' },
    assigned: { bg: 'bg-blue-100', text: 'text-blue-800', label: 'Assigned' },
    assigned_to_manager: { bg: 'bg-purple-100', text: 'text-purple-800', label: 'Assigned to Manager' },
    assigned_to_mechanic: { bg: 'bg-indigo-100', text: 'text-indigo-800', label: 'Assigned to Mechanic' },
    in_progress: { bg: 'bg-orange-100', text: 'text-orange-800', label: 'In Progress' },
    completed: { bg: 'bg-green-100', text: 'text-green-800', label: 'Completed' },
    cancelled: { bg: 'bg-red-100', text: 'text-red-800', label: 'Cancelled' },
    closed: { bg: 'bg-gray-100', text: 'text-gray-800', label: 'Closed' },
  };
  const badge = badges[key] || { bg: 'bg-gray-100', text: 'text-gray-800', label: status || 'Unknown' };
  return <span className={`px-3 py-1 text-sm font-semibold rounded-full ${badge.bg} ${badge.text}`}>{badge.label}</span>;
}

export default function TelecallerRsaComplaintPage() {
  const params = useParams();
  const leadId = String(params?.id || '').trim();

  const [lead, setLead] = useState<any | null>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function loadLead() {
      if (!leadId) {
        if (!alive) return;
        setError('Invalid complaint id');
        setLoading(false);
        return;
      }

      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/telecaller/rsa-complaints/${encodeURIComponent(leadId)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to load complaint');
        if (!alive) return;
        setLead(json?.lead || null);
        setTimeline(Array.isArray(json?.timeline) ? json.timeline : []);
        setPayments(Array.isArray(json?.payments) ? json.payments : []);
      } catch (e: any) {
        if (!alive) return;
        setError(e?.message || 'Failed to load complaint');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadLead();
    return () => {
      alive = false;
    };
  }, [leadId]);

  return (
    <DashboardLayout role="telecaller">
      <div className="p-3 sm:p-4 md:p-5 lg:p-6 max-w-7xl mx-auto">
        <div className="flex items-center justify-between mb-4 sm:mb-5 md:mb-6">
          <Link
            href="/dashboard/telecaller/rsa"
            className="flex items-center gap-2 text-gray-600 hover:text-gray-900 text-xs sm:text-sm md:text-base"
          >
            <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
            <span>Back to RSA</span>
          </Link>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary mx-auto" />
            <p className="mt-4 text-gray-600 text-sm">Loading complaint details...</p>
          </div>
        ) : null}
        {!loading && error ? <div className="card text-sm text-red-700">{error}</div> : null}
        {!loading && !error && !lead ? <div className="card text-sm text-gray-600">Complaint not found.</div> : null}

        {!loading && !error && lead ? (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-5 md:p-6">
              <div className="flex items-start justify-between gap-3 mb-4">
                <div>
                  <h1 className="text-xl sm:text-2xl font-bold text-gray-900">{lead.customer_name || 'Customer'}</h1>
                  <div className="mt-2">{getStatusBadge(lead.lead_status || lead.complaint_status || '')}</div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 sm:w-5 sm:h-5" />
                    Customer Information
                  </h3>
                  <div className="space-y-2 text-xs sm:text-sm text-gray-700">
                    <div className="flex items-center gap-2"><Phone className="w-4 h-4" />{lead.contact_number || '—'}</div>
                    {lead.alternate_number ? <div className="flex items-center gap-2"><Phone className="w-4 h-4" />Alt: {lead.alternate_number}</div> : null}
                    {lead.address ? <div className="flex items-start gap-2"><MapPin className="w-4 h-4 mt-0.5" />{lead.address}</div> : null}
                    <div className="flex items-center gap-2"><MapPin className="w-4 h-4" />Pincode: {lead.pincode || '—'}</div>
                    {lead.location_link ? (
                      <a href={lead.location_link} target="_blank" rel="noopener noreferrer" className="text-brand-primary hover:underline">
                        View location on map
                      </a>
                    ) : null}
                  </div>
                </div>

                <div>
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Car className="w-4 h-4 sm:w-5 sm:h-5" />
                    Vehicle Information
                  </h3>
                  <div className="space-y-2 text-xs sm:text-sm text-gray-700">
                    <div><span className="font-medium">Number:</span> {lead.vehicle_number || '—'}</div>
                    <div><span className="font-medium">Model:</span> {lead.vehicle_model || '—'}</div>
                  </div>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <Wrench className="w-4 h-4 sm:w-5 sm:h-5" />
                  Service Details
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm text-gray-700">
                  <div><span className="font-medium">Service Type:</span> {lead.service_type || '—'}</div>
                  <div><span className="font-medium">Source:</span> {lead.source || '—'}</div>
                  <div><span className="font-medium">Drop Location:</span> {lead.drop_location || '—'}</div>
                </div>
                {(lead.problem || lead.description) ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                    {lead.problem ? <div><span className="font-medium text-gray-600 text-xs sm:text-sm">Problem:</span><p className="text-gray-800 text-xs sm:text-sm mt-1 whitespace-pre-wrap">{lead.problem}</p></div> : null}
                    {lead.description ? <div><span className="font-medium text-gray-600 text-xs sm:text-sm">Description:</span><p className="text-gray-800 text-xs sm:text-sm mt-1 whitespace-pre-wrap">{lead.description}</p></div> : null}
                  </div>
                ) : null}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3">Assignment Information</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs sm:text-sm">
                  <div>
                    <span className="font-medium text-gray-600">Registered By:</span>
                    <p className="text-gray-900">{lead.registered_by_name || '—'}</p>
                    <p className="text-gray-500 text-[11px]">{formatAssignmentDateTime(lead.lead_registered_at || lead.requested_at)}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Assigned Manager:</span>
                    <p className="text-gray-900">{lead.assigned_manager_name || '—'}</p>
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Assigned Mechanic:</span>
                    <p className="text-gray-900">{lead.assigned_mechanic_name || '—'}</p>
                    {lead.mechanic_assigned_datetime ? <p className="text-gray-500 text-[11px]">Assigned: {formatAssignmentDateTime(lead.mechanic_assigned_datetime)}</p> : null}
                  </div>
                  <div>
                    <span className="font-medium text-gray-600">Current Activity:</span>
                    <p className="text-gray-900">{lead.lead_status || lead.complaint_status || '—'}</p>
                  </div>
                </div>
              </div>

              {(lead.customer_quoted_amount != null || lead.advance_payment || lead.payment_to_mechanic != null || payments.length > 0) ? (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <DollarSign className="w-4 h-4 sm:w-5 sm:h-5" />
                    Payment Information
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs sm:text-sm text-gray-700">
                    <div><span className="font-medium">Quoted:</span> {lead.customer_quoted_amount != null ? `₹${lead.customer_quoted_amount}` : '—'}</div>
                    <div><span className="font-medium">Advance:</span> {lead.advance_payment || '—'}</div>
                    <div><span className="font-medium">Mechanic Amount:</span> {lead.payment_to_mechanic != null ? `₹${lead.payment_to_mechanic}` : '—'}</div>
                  </div>
                  <div className="mt-4">
                    <div className="text-xs sm:text-sm font-semibold text-gray-900 mb-2">Razorpay Payment History</div>
                    {payments.length === 0 ? (
                      <p className="text-xs sm:text-sm text-gray-600">No Razorpay payments found for this customer.</p>
                    ) : (
                      <div className="overflow-x-auto">
                        <table className="min-w-full text-xs sm:text-sm">
                          <thead>
                            <tr className="text-left text-gray-600 border-b">
                              <th className="py-2 pr-3">Date</th>
                              <th className="py-2 pr-3">Amount</th>
                              <th className="py-2 pr-3">Status</th>
                              <th className="py-2 pr-3">Method</th>
                              <th className="py-2 pr-3">Order ID</th>
                              <th className="py-2 pr-3">Payment ID</th>
                            </tr>
                          </thead>
                          <tbody>
                            {payments.map((p, idx) => (
                              <tr key={`${p.order_id || 'order'}-${p.payment_id || idx}`} className="border-b last:border-b-0">
                                <td className="py-2 pr-3">{formatDateTimeIST(p.updated_at || p.created_at)}</td>
                                <td className="py-2 pr-3">
                                  {p.amount != null ? `₹${Number(p.amount).toFixed(2)}` : (p.amount_paise != null ? `₹${(Number(p.amount_paise) / 100).toFixed(2)}` : '—')}
                                </td>
                                <td className="py-2 pr-3">{String(p.status || '—').toUpperCase()}</td>
                                <td className="py-2 pr-3">{p.method ? String(p.method).toUpperCase() : '—'}</td>
                                <td className="py-2 pr-3 font-mono">{p.order_id || '—'}</td>
                                <td className="py-2 pr-3 font-mono">{p.payment_id || '—'}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              {(lead.remark || lead.assigned_remark || lead.dispatch_remark || lead.reached_remark || lead.complete_remark || lead.cancelled_remark) ? (
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <MessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
                    Remarks
                  </h3>
                  <div className="space-y-2 text-xs sm:text-sm">
                    {lead.remark ? <p><span className="font-medium">General:</span> {lead.remark}</p> : null}
                    {lead.assigned_remark ? <p><span className="font-medium">Assignment:</span> {lead.assigned_remark}</p> : null}
                    {lead.dispatch_remark ? <p><span className="font-medium">Dispatch:</span> {lead.dispatch_remark}</p> : null}
                    {lead.reached_remark ? <p><span className="font-medium">Reached:</span> {lead.reached_remark}</p> : null}
                    {lead.complete_remark ? <p><span className="font-medium">Completed:</span> {lead.complete_remark}</p> : null}
                    {lead.cancelled_remark ? <p><span className="font-medium">Cancelled:</span> {lead.cancelled_remark}</p> : null}
                  </div>
                </div>
              ) : null}

              <div className="mt-6 pt-6 border-t border-gray-200">
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
                  <ImageIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                  Media
                </h3>
                {Array.isArray(lead.media_upload) && lead.media_upload.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {lead.media_upload.map((url: string, index: number) => (
                      <a key={`${url}-${index}`} href={url} target="_blank" rel="noopener noreferrer" className="block">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={url} alt={`Media ${index + 1}`} className="w-full h-24 sm:h-28 md:h-32 object-cover rounded-lg hover:opacity-80 transition-opacity" />
                      </a>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs sm:text-sm text-gray-600">No media uploaded.</p>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-4 sm:p-5 md:p-6">
              <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-4">Activity Timeline</h2>
              {timeline.length === 0 ? (
                <p className="text-xs sm:text-sm text-gray-600">No activity entries found.</p>
              ) : (
                <div className="space-y-4">
                  {timeline.map((entry) => (
                    <div key={entry.id} className="flex gap-3 sm:gap-4 pb-4 border-b border-gray-200 last:border-0">
                      <div className="w-9 h-9 bg-brand-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                        <Clock className="w-4 h-4 text-brand-primary" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                          <h4 className="font-semibold text-gray-900 text-sm sm:text-base">{entry.status || 'Updated'}</h4>
                          <span className="text-[11px] text-gray-500">{formatDateTimeIST(entry.updated_at || entry.created_at)}</span>
                        </div>
                        {entry.status_description ? <p className="text-xs sm:text-sm text-gray-700 mt-1">{entry.status_description}</p> : null}
                        {entry.updated_by_name ? <p className="text-[11px] text-gray-500 mt-1">By: {entry.updated_by_name}</p> : null}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}
