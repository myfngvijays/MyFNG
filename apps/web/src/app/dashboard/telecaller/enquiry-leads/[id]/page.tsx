'use client';

import { useEffect, useMemo, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import Link from 'next/link';
import { ArrowLeft, PhoneCall, StickyNote, CheckCircle } from 'lucide-react';

type EnquiryLead = any;

const DISPOSITIONS = [
  'CUSTOMER_NOT_INTERESTED',
  'WRONG_NUMBER',
  'DUPLICATE_LEAD',
  'ALREADY_SERVICED_ELSEWHERE',
  'QUALIFIED',
];

export default function EnquiryLeadDetailPage() {
  const params = useParams();
  const router = useRouter();
  const leadId = String(params?.id || '');

  const [loading, setLoading] = useState(true);
  const [lead, setLead] = useState<EnquiryLead | null>(null);
  const [noteText, setNoteText] = useState('');
  const [callStatus, setCallStatus] = useState('ANSWERED');
  const [callDuration, setCallDuration] = useState('');
  const [callSummary, setCallSummary] = useState('');
  const [callFollowUpAt, setCallFollowUpAt] = useState('');
  const [disposition, setDisposition] = useState('QUALIFIED');
  const [dispositionNote, setDispositionNote] = useState('');
  const [dispositionFollowUpAt, setDispositionFollowUpAt] = useState('');
  const [couponCode, setCouponCode] = useState('');
  const [couponSaving, setCouponSaving] = useState(false);

  useEffect(() => {
    if (leadId) fetchLead();
  }, [leadId]);

  useEffect(() => {
    if (lead?.meta?.coupon?.code) {
      setCouponCode(lead.meta.coupon.code);
    }
  }, [lead]);

  async function fetchLead() {
    setLoading(true);
    try {
      const res = await fetch(`/api/telecaller/enquiry-leads/${leadId}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load lead');
      setLead(json.lead || null);
    } catch (e) {
      console.error('Failed to load enquiry lead:', e);
    } finally {
      setLoading(false);
    }
  }

  const history = useMemo(() => {
    const list = Array.isArray(lead?.history) ? lead.history : [];
    return [...list].reverse();
  }, [lead]);

  async function addNote() {
    if (!noteText.trim()) return;
    await fetch(`/api/telecaller/enquiry-leads/${leadId}/note`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ note: noteText.trim() }),
    });
    setNoteText('');
    await fetchLead();
  }

  async function logCall() {
    const payload: any = {
      call_status: callStatus,
      call_duration: callDuration ? Number(callDuration) : null,
      summary: callSummary || null,
      next_follow_up_at: callFollowUpAt ? new Date(callFollowUpAt).toISOString() : null,
    };
    await fetch(`/api/telecaller/enquiry-leads/${leadId}/call`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setCallDuration('');
    setCallSummary('');
    setCallFollowUpAt('');
    await fetchLead();
  }

  async function submitDisposition() {
    const payload: any = {
      disposition,
      note: dispositionNote || null,
      next_follow_up_at: dispositionFollowUpAt ? new Date(dispositionFollowUpAt).toISOString() : null,
    };
    await fetch(`/api/telecaller/enquiry-leads/${leadId}/disposition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    setDispositionNote('');
    setDispositionFollowUpAt('');
    await fetchLead();
  }

  async function saveCoupon() {
    setCouponSaving(true);
    try {
      const res = await fetch(`/api/telecaller/enquiry-leads/${leadId}/coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode.trim() }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update coupon');
      await fetchLead();
    } catch (error) {
      console.error('Failed to update coupon', error);
    } finally {
      setCouponSaving(false);
    }
  }

  async function removeCoupon() {
    setCouponSaving(true);
    try {
      const res = await fetch(`/api/telecaller/enquiry-leads/${leadId}/coupon`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: '' }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to remove coupon');
      setCouponCode('');
      await fetchLead();
    } catch (error) {
      console.error('Failed to remove coupon', error);
    } finally {
      setCouponSaving(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="telecaller">
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout role="telecaller">
        <div className="max-w-4xl mx-auto px-4 py-8">
          <p className="text-gray-600">Lead not found.</p>
          <button className="btn btn-secondary mt-3" onClick={() => router.back()}>
            Go Back
          </button>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="telecaller">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 md:px-6 py-5 sm:py-6 md:py-8 space-y-4">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/telecaller/enquiry-leads" className="text-gray-600 hover:text-black">
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-text-heading">
              {lead.lead_number || 'Enquiry Lead'}
            </h1>
            <p className="text-xs sm:text-sm text-gray-600">
              {lead.lead_type} • {lead.lead_status} • {lead.lead_source}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4 space-y-2">
            <div className="text-sm font-semibold">Customer</div>
            <div className="text-sm">{lead.customer_name || 'Customer'}</div>
            <div className="text-sm text-gray-600">{lead.customer_phone || '—'}</div>
            <div className="text-xs text-gray-500">{lead.customer_address || '—'}</div>
          </div>
          <div className="bg-white rounded-lg border p-4 space-y-2">
            <div className="text-sm font-semibold">Vehicle</div>
            <div className="text-sm">{lead.vehicle_number || '—'}</div>
            <div className="text-xs text-gray-500">
              {[lead.vehicle_make, lead.vehicle_model, lead.vehicle_variant].filter(Boolean).join(' ')}
            </div>
          </div>
          <div className="bg-white rounded-lg border p-4 space-y-2">
            <div className="text-sm font-semibold">Details</div>
            <div className="text-xs text-gray-500">{lead.problem_description || '—'}</div>
            <div className="text-xs text-gray-500">Next follow-up: {lead.next_follow_up_at ? new Date(lead.next_follow_up_at).toLocaleString() : '—'}</div>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4 space-y-3">
          <div className="text-sm font-semibold">Coupon</div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              className="w-full border rounded-md px-2 py-2 text-sm"
              placeholder="Enter coupon code"
              value={couponCode}
              onChange={(e) => setCouponCode(e.target.value.toUpperCase())}
            />
            <button className="btn btn-primary text-sm" onClick={saveCoupon} disabled={couponSaving}>
              {couponSaving ? 'Saving...' : 'Apply'}
            </button>
            {lead?.meta?.coupon?.code ? (
              <button className="btn btn-secondary text-sm" onClick={removeCoupon} disabled={couponSaving}>
                Remove
              </button>
            ) : null}
          </div>
          {lead?.meta?.coupon?.code && (
            <div className="text-xs text-gray-600">
              Applied: <strong>{lead.meta.coupon.code}</strong> • Discount: ₹{Number(lead.meta.coupon.discount_amount || 0).toFixed(0)}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="bg-white rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <StickyNote className="w-4 h-4" />
              Add Note
            </div>
            <textarea
              className="w-full border rounded-md px-2 py-2 text-sm"
              rows={3}
              value={noteText}
              onChange={(e) => setNoteText(e.target.value)}
              placeholder="Add a note..."
            />
            <button className="btn btn-primary text-sm" onClick={addNote}>
              Save Note
            </button>
          </div>

          <div className="bg-white rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <PhoneCall className="w-4 h-4" />
              Log Call
            </div>
            <select
              className="w-full border rounded-md px-2 py-2 text-sm"
              value={callStatus}
              onChange={(e) => setCallStatus(e.target.value)}
            >
              <option value="ANSWERED">Answered</option>
              <option value="NO_ANSWER">No Answer</option>
              <option value="BUSY">Busy</option>
              <option value="SWITCHED_OFF">Switched Off</option>
              <option value="WRONG_NUMBER">Wrong Number</option>
            </select>
            <input
              type="number"
              className="w-full border rounded-md px-2 py-2 text-sm"
              placeholder="Duration (sec)"
              value={callDuration}
              onChange={(e) => setCallDuration(e.target.value)}
            />
            <textarea
              className="w-full border rounded-md px-2 py-2 text-sm"
              rows={2}
              placeholder="Call summary"
              value={callSummary}
              onChange={(e) => setCallSummary(e.target.value)}
            />
            <input
              type="datetime-local"
              className="w-full border rounded-md px-2 py-2 text-sm"
              value={callFollowUpAt}
              onChange={(e) => setCallFollowUpAt(e.target.value)}
            />
            <button className="btn btn-primary text-sm" onClick={logCall}>
              Log Call
            </button>
          </div>

          <div className="bg-white rounded-lg border p-4 space-y-3">
            <div className="flex items-center gap-2 font-semibold text-sm">
              <CheckCircle className="w-4 h-4" />
              Disposition
            </div>
            <select
              className="w-full border rounded-md px-2 py-2 text-sm"
              value={disposition}
              onChange={(e) => setDisposition(e.target.value)}
            >
              {DISPOSITIONS.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
            <textarea
              className="w-full border rounded-md px-2 py-2 text-sm"
              rows={2}
              placeholder="Disposition note"
              value={dispositionNote}
              onChange={(e) => setDispositionNote(e.target.value)}
            />
            <input
              type="datetime-local"
              className="w-full border rounded-md px-2 py-2 text-sm"
              value={dispositionFollowUpAt}
              onChange={(e) => setDispositionFollowUpAt(e.target.value)}
            />
            <button className="btn btn-primary text-sm" onClick={submitDisposition}>
              Save Disposition
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg border p-4">
          <div className="font-semibold text-sm mb-3">History</div>
          <div className="space-y-2 text-xs sm:text-sm">
            {history.length === 0 && <div className="text-gray-500">No history yet.</div>}
            {history.map((h: any, idx: number) => (
              <div key={`${h.type}-${idx}`} className="border rounded-md px-3 py-2">
                <div className="font-medium">{h.type}</div>
                <div className="text-gray-500">{h.at ? new Date(h.at).toLocaleString() : ''}</div>
                {h.text && <div className="text-gray-700 mt-1">{h.text}</div>}
                {h.summary && <div className="text-gray-700 mt-1">{h.summary}</div>}
                {h.note && <div className="text-gray-700 mt-1">{h.note}</div>}
                {h.status && <div className="text-gray-500 mt-1">Status: {h.status}</div>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

