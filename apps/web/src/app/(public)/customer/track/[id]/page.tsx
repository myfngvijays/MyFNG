'use client';

import { formatDateDMY, formatDateTime } from "@/lib/utils";
/**
 * Customer Lead Tracking Page
 * Phase 4 - Task WA-405
 * 
 * Features:
 * - Real-time status updates
 * - Timeline view
 * - Progress tracking
 * - Mechanic details
 * - Photos/updates
 * - Estimated completion
 */

import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import {
  ArrowLeft,
  CheckCircle,
  Clock,
  User,
  Phone,
  MapPin,
  Calendar,
  Wrench,
  Image as ImageIcon,
  FileText,
} from 'lucide-react';

export default function TrackLeadPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [media, setMedia] = useState<any[]>([]);
  const [extraWork, setExtraWork] = useState<any[]>([]);
  const [pricingItems, setPricingItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [decisionByRequestId, setDecisionByRequestId] = useState<Record<string, 'OEM' | 'OES'>>({});
  const [rejectReasonByRequestId, setRejectReasonByRequestId] = useState<Record<string, string>>({});
  const [actingByRequestId, setActingByRequestId] = useState<Record<string, boolean>>({});

  useEffect(() => {
    fetchLeadDetails();

    // Polling keeps this page working publicly (no auth required)
    const t = setInterval(() => {
      // Don't spam the server if we're already erroring; user can refresh.
      if (!loadError) fetchLeadDetails();
    }, 15000);

    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [leadId, loadError]);

  async function fetchLeadDetails() {
    try {
      const res = await fetch(`/api/public/lead/${leadId}`, { cache: 'no-store' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setLead(null);
        setEvents([]);
        setMedia([]);
        if (data?.error === 'PUBLIC_LINK_DISABLED') {
          setLoadError(String(data?.message || 'This public link is not active yet. Please ask your service advisor to enable it.'));
          return;
        }
        const parts = [
          data?.error ? String(data.error) : 'Failed to load service request',
          data?.details ? `details: ${String(data.details)}` : null,
          data?.code ? `code: ${String(data.code)}` : null,
          data?.hint ? `hint: ${String(data.hint)}` : null,
          data?.env
            ? `env: url=${data.env.hasSupabaseUrl ? 'yes' : 'no'}, serviceKey=${data.env.hasServiceRoleKey ? 'yes' : 'no'}, using=${data.env.usingServiceRoleClient ? 'service_role' : 'anon'}`
            : null,
        ].filter(Boolean);
        setLoadError(parts.join(' • '));
        return;
      }

      setLead(data.lead || null);
      setEvents(data.events || []);
      setMedia(data.media || []);
      setExtraWork(data.extra_work || []);
      setPricingItems(data.pricing_items || []);
      setLoadError(null);
    } catch (error) {
      console.error('Error fetching lead:', error);
      setLoadError('Failed to load service request');
    } finally {
      setLoading(false);
    }
  }

  // Note: Public page intentionally hides live status/progress per requirements.

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full"></div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-xl text-gray-600 mb-2">
            {loadError ? 'Unable to load service request' : 'Service request not found'}
          </p>
          {loadError && (
            <p className="text-sm text-gray-500 max-w-xl mx-auto mb-4">
              {loadError}
            </p>
          )}
          <Link href="/" className="text-brand-primary hover:underline">
            Back to Home
          </Link>
        </div>
      </div>
    );
  }

  const customerCity =
    typeof lead.city === 'object' && lead.city
      ? lead.city.name || lead.city.city_name || ''
      : (lead.city || '').toString();
  const customerAddress =
    (lead.customer_address || lead.address || lead.pickup_address || '').toString();
  const looksLikeUuid = (v: any) =>
    typeof v === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(v.trim());

  const serviceTypeLabel = !looksLikeUuid(lead.service_type_name) && (lead.service_type_name || '').toString().trim()
    ? String(lead.service_type_name).trim()
    : '—';
  const subServiceLabel = (lead.subservice_names || '').toString();
  const serviceItems = Array.isArray(pricingItems) ? pricingItems.filter((i) => !i?.is_addon) : [];
  const addonItems = Array.isArray(pricingItems) ? pricingItems.filter((i) => Boolean(i?.is_addon)) : [];

  const fallbackServices = Array.isArray(lead.selected_services) ? lead.selected_services : [];
  const fallbackAddons = Array.isArray(lead.selected_addons) ? lead.selected_addons : [];

  type DisplayItem = { id: string; name: string; qty: number; price: number };

  const displayServiceItems: DisplayItem[] =
    serviceItems.length > 0
      ? serviceItems.map((it) => ({
          id: String(it.id),
          name: String(it.item_name || ''),
          qty: Number(it?.qty ?? 1),
          price: Number(it?.final_price ?? 0),
        }))
      : fallbackServices.map((it: any) => ({
          id: String(it.id),
          name: String(it.name || ''),
          qty: 1,
          price: Number(it?.base_price ?? 0),
        }));

  const displayAddonItems: DisplayItem[] =
    addonItems.length > 0
      ? addonItems.map((it) => ({
          id: String(it.id),
          name: String(it.item_name || ''),
          qty: Number(it?.qty ?? 1),
          price: Number(it?.final_price ?? 0),
        }))
      : fallbackAddons.map((it: any) => ({
          id: String(it.id),
          name: String(it.name || ''),
          qty: 1,
          price: Number(it?.base_price ?? 0),
        }));

  const serviceTotal = displayServiceItems.reduce((sum: number, it: DisplayItem) => sum + it.price * it.qty, 0);
  const addonTotal = displayAddonItems.reduce((sum: number, it: DisplayItem) => sum + it.price * it.qty, 0);
  const approvedExtraWork = Array.isArray(extraWork)
    ? extraWork.filter((r) => String(r?.status || 'PENDING').toUpperCase() === 'APPROVED')
    : [];
  const pendingExtraWork = Array.isArray(extraWork)
    ? extraWork.filter((r) => String(r?.status || 'PENDING').toUpperCase() === 'PENDING')
    : [];

  // Potential totals for pending items (customer choice)
  const pendingExtraWorkTotalOem = pendingExtraWork.reduce(
    (sum, r) => {
      const parts = Number(r?.oem_price ?? 0);
      const labour = Number(r?.labour_price ?? 0);
      return sum + (parts > 0 ? (parts + labour) : 0);
    },
    0
  );
  const pendingExtraWorkTotalOes = pendingExtraWork.reduce(
    (sum, r) => {
      const parts = Number(r?.oes_price ?? 0);
      const labour = Number(r?.labour_price ?? 0);
      return sum + (parts > 0 ? (parts + labour) : 0);
    },
    0
  );

  const fmt = (n: number) => `₹${Number(n || 0).toFixed(2)}`;

  // All prices shown to customer are GST-inclusive (no separate GST calculation on public page)
  const serviceAddonSubtotal = serviceTotal + addonTotal;
  const serviceAddonTotal = serviceAddonSubtotal;

  // Approved additional work gets added into estimate total (based on selected part_price_type)
  const approvedExtraWorkSubtotal = approvedExtraWork.reduce((sum, r) => {
    const choice = String(r?.part_price_type || 'OEM').toUpperCase() === 'OES' ? 'OES' : 'OEM';
    const parts = choice === 'OES' ? Number(r?.oes_price ?? 0) : Number(r?.oem_price ?? 0);
    const labour = Number(r?.labour_price ?? 0);
    return sum + (parts > 0 ? (parts + labour) : 0);
  }, 0);
  const approvedExtraWorkTotal = approvedExtraWorkSubtotal;

  // Pending additional work (for information only)
  const pendingExtraWorkTotalWithGstOem = pendingExtraWorkTotalOem;
  const pendingExtraWorkTotalWithGstOes = pendingExtraWorkTotalOes;

  const getExtraWorkDecisionLabel = (req: any) => {
    const status = String(req?.status || 'PENDING').toUpperCase();
    const byCustomer = Boolean(req?.customer_approved_at);
    const choice = String(req?.part_price_type || 'OEM').toUpperCase() === 'OES' ? 'OES' : 'OEM';
    if (status === 'REJECTED') return byCustomer ? 'REJECTED • Customer' : 'REJECTED • Advisor';
    if (status === 'APPROVED') return byCustomer ? `APPROVED • Customer (${choice})` : `APPROVED • Advisor (${choice})`;
    return 'PENDING';
  };

  // Public link rule:
  // - If OEM or OES amount is 0, do NOT show that option to customer.
  // - If only one option is available, it stays selected by default (customer can't toggle; can still reject).
  const getCustomerPartChoice = (req: any) => {
    const oem = Number(req?.oem_price ?? 0);
    const oes = Number(req?.oes_price ?? 0);
    const canOem = oem > 0;
    const canOes = oes > 0;

    // When only one (or none) option exists, lock choice
    const locked = !(canOem && canOes);
    const forcedChoice: 'OEM' | 'OES' = canOes && !canOem ? 'OES' : 'OEM';
    const serverChoice: 'OEM' | 'OES' = req?.part_price_type === 'OES' ? 'OES' : 'OEM';
    const uiChoice: 'OEM' | 'OES' = (decisionByRequestId[req?.id] as any) || serverChoice;
    const choice: 'OEM' | 'OES' = locked ? forcedChoice : uiChoice;

    return { choice, locked, canOem, canOes, oem, oes };
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 print:bg-white print:py-0">
      <div className="max-w-5xl mx-auto px-4 print:px-0">
        {/* Top actions (hidden on print) */}
        <div className="flex items-center justify-between gap-3 mb-4 print:hidden">
          <button
            type="button"
            onClick={() => {
              if (typeof window !== 'undefined' && window.history.length > 1) router.back();
              else router.push('/');
            }}
            className="text-brand-primary hover:underline inline-flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button type="button" className="btn btn-outline" onClick={() => window.print()}>
            Print / Download
          </button>
        </div>

        {/* Estimate sheet */}
        <div className="bg-white border rounded-xl shadow-sm print:shadow-none print:border-0 overflow-hidden">
          {/* Header */}
          <div className="p-5 sm:p-6 border-b bg-gradient-to-r from-brand-secondary to-brand-primary text-white">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
              <div className="min-w-0">
                <div className="flex items-center gap-3 mb-3">
                  <img
                    src="/logo.png"
                    alt="MyFNG"
                    className="h-9 w-auto bg-white rounded-md p-1"
                  />
                  <div className="min-w-0">
                    <div className="text-lg font-extrabold leading-tight">MyFNG</div>
                    <div className="text-xs text-white/80 leading-tight">
                      Powered by MyFNG
                    </div>
                  </div>
                </div>
                <div className="text-xs uppercase tracking-wide text-white/80">Workshop</div>
                <div className="text-xl sm:text-2xl font-bold truncate">
                  {lead.workshop?.name || 'Workshop'}
                </div>
                {lead.workshop?.address && (
                  <div className="text-sm text-white/90 mt-1">{lead.workshop.address}</div>
                )}
                {lead.workshop?.phone && (
                  <div className="text-sm text-white/90 mt-1">Phone: {lead.workshop.phone}</div>
                )}
              </div>

              <div className="sm:text-right">
                <div className="inline-flex items-center px-2.5 py-1 rounded bg-white/15 text-white text-xs font-semibold tracking-wide">
                  ESTIMATE
                </div>
                <div className="mt-2 text-sm text-white/90">
                  <div>
                    Estimate ID: <span className="font-semibold text-white">{lead.lead_number}</span>
                  </div>
                  <div>
                    Date: <span className="font-semibold text-white">{formatDateDMY(lead.created_at)}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Party details */}
          <div className="p-5 sm:p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Customer</div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">Name</span>
                    <span className="font-semibold text-gray-900">{lead.customer_name || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">Phone</span>
                    <span className="font-semibold text-gray-900">{lead.customer_phone || lead.phone || '—'}</span>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <span className="text-gray-600">Address</span>
                    <span className="font-medium text-gray-900 text-right leading-snug">{customerAddress || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">City</span>
                    <span className="font-medium text-gray-900">{customerCity || '—'}</span>
                  </div>
                </div>
              </div>

              <div className="rounded-lg border p-4">
                <div className="text-xs uppercase tracking-wide text-gray-500">Vehicle & Advisor</div>
                <div className="mt-3 grid grid-cols-1 gap-2 text-sm">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">Car No</span>
                    <span className="font-semibold text-gray-900">{lead.vehicle_number || '—'}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">Vehicle</span>
                    <span className="font-medium text-gray-900 text-right">
                      {`${lead.vehicle_make || ''} ${lead.vehicle_model || ''}`.trim() || '—'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">Odometer</span>
                    <span className="font-medium text-gray-900">
                      {(() => {
                        const odo =
                          (lead as any)?.vehicle_odometer ??
                          (lead as any)?.odometer_km ??
                          (lead as any)?.pickup_odometer_reading ??
                          null;
                        const n = Number(odo || 0) || 0;
                        return n > 0 ? `${n.toLocaleString('en-IN')} km` : '—';
                      })()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">Service</span>
                    <span className="font-semibold text-gray-900 text-right">{serviceTypeLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-gray-600">Add-on</span>
                    <span className="font-semibold text-gray-900 text-right">{subServiceLabel || '—'}</span>
                  </div>
                  {lead.assigned_advisor && (
                    <div className="flex items-center justify-between gap-3 pt-2 border-t mt-1">
                      <span className="text-gray-600">Advisor</span>
                      <span className="font-semibold text-gray-900 text-right">
                        {lead.assigned_advisor.full_name}
                        {lead.assigned_advisor.phone ? ` • ${lead.assigned_advisor.phone}` : ''}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {lead.problem_description && (
              <div className="mt-4 rounded-lg border p-4 bg-gray-50">
                <div className="text-xs uppercase tracking-wide text-gray-500">Customer Notes</div>
                <p className="mt-2 text-sm text-gray-800 whitespace-pre-line">{lead.problem_description}</p>
              </div>
            )}

            {/* Service + Add-ons table */}
            <div className="mt-6 rounded-lg border overflow-hidden">
              <div className="px-4 py-3 bg-gray-50 flex items-center justify-between">
                <div className="font-semibold text-gray-900">Estimate Items</div>
                <div className="text-xs text-gray-600">All prices include GST</div>
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-white border-b text-gray-600">
                    <tr>
                      <th className="text-left py-2 px-3">Type</th>
                      <th className="text-left py-2 px-3">Item</th>
                      <th className="text-right py-2 px-3">Qty</th>
                      <th className="text-right py-2 px-3">Rate</th>
                      <th className="text-right py-2 px-3">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {[...displayServiceItems.map((x) => ({ ...x, _type: 'Service' })), ...displayAddonItems.map((x) => ({ ...x, _type: 'Add-on' }))].map((it) => {
                      const amount = it.price * it.qty;
                      return (
                        <tr key={`${it._type}-${it.id}`}>
                          <td className="py-2 px-3">
                            <span className="text-xs font-semibold px-2 py-0.5 rounded bg-gray-100 text-gray-700">
                              {it._type}
                            </span>
                          </td>
                          <td className="py-2 px-3 font-medium text-gray-900">{it.name}</td>
                          <td className="py-2 px-3 text-right">{it.qty}</td>
                          <td className="py-2 px-3 text-right">{fmt(it.price)}</td>
                          <td className="py-2 px-3 text-right font-bold">{fmt(amount)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Approved additional work added to estimate */}
              {approvedExtraWork.length > 0 && (
                <div className="border-t">
                  <div className="px-4 py-3 bg-white flex items-center justify-between">
                    <div className="font-semibold text-gray-900">Approved Additional Work</div>
                    <div className="text-xs text-gray-600">Included in total</div>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="min-w-full text-sm">
                      <thead className="bg-gray-50 text-gray-600 border-y">
                        <tr>
                          <th className="text-left py-2 px-3">Item</th>
                          <th className="text-left py-2 px-3">Type</th>
                          <th className="text-right py-2 px-3">Parts</th>
                          <th className="text-right py-2 px-3">Labour</th>
                          <th className="text-right py-2 px-3">Total</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {approvedExtraWork.map((r) => {
                          const choice = String(r?.part_price_type || 'OEM').toUpperCase() === 'OES' ? 'OES' : 'OEM';
                          const parts = choice === 'OES' ? Number(r?.oes_price ?? 0) : Number(r?.oem_price ?? 0);
                          const labour = Number(r?.labour_price ?? 0);
                          const amount = parts + labour;
                          return (
                            <tr key={`approved-${r.id}`}>
                              <td className="py-2 px-3 font-medium text-gray-900">{r.description}</td>
                              <td className="py-2 px-3">
                                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-green-100 text-green-800">
                                  {choice}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-right">{fmt(parts)}</td>
                              <td className="py-2 px-3 text-right">{fmt(labour)}</td>
                              <td className="py-2 px-3 text-right font-bold">{fmt(amount)}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              <div className="p-4 border-t bg-gray-50">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="text-xs text-gray-600">
                    Prices are indicative. Final billing may vary after inspection.
                  </div>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-600">Subtotal</span>
                      <span className="font-semibold text-gray-900">{fmt(serviceAddonSubtotal)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-gray-600">Total</span>
                      <span className="font-bold text-gray-900">{fmt(serviceAddonTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-gray-600">Approved Additional Work</span>
                      <span className="font-semibold text-gray-900">{fmt(approvedExtraWorkTotal)}</span>
                    </div>
                    <div className="flex items-center justify-between pt-2 border-t">
                      <span className="text-gray-600">Grand Total</span>
                      <span className="font-bold text-gray-900">{fmt(serviceAddonTotal + approvedExtraWorkTotal)}</span>
                    </div>
                    {pendingExtraWork.length > 0 && (
                      <div className="pt-2 border-t text-xs text-gray-600">
                        Pending additional work (if approved): OEM {fmt(pendingExtraWorkTotalWithGstOem)} • OES {fmt(pendingExtraWorkTotalWithGstOes)}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Attachments / Invoice */}
            {(media.length > 0 || lead.final_amount) && (
              <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-4">
                {media.length > 0 && (
                  <div className="lg:col-span-2 rounded-lg border p-4">
                    <div className="flex items-center gap-2 font-semibold text-gray-900">
                      <ImageIcon className="w-4 h-4" />
                      Attachments
                    </div>
                    <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {media.map((item) => (
                        <div key={item.id} className="relative group">
                          <img
                            src={item.media_url}
                            alt="Attachment"
                            className="w-full h-24 object-cover rounded cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => window.open(item.media_url, '_blank')}
                          />
                          <span className="absolute bottom-1 left-1 text-[10px] bg-black/60 text-white px-2 py-0.5 rounded">
                            {item.media_category}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {lead.final_amount && (
                  <div className="rounded-lg border p-4 bg-green-50 border-green-200">
                    <div className="flex items-center gap-2 font-semibold text-green-900">
                      <FileText className="w-4 h-4" />
                      Final Invoice (if available)
                    </div>
                    <div className="mt-2 text-sm text-green-800">
                      Total: <span className="font-bold">₹{lead.final_amount.toFixed(2)}</span>
                    </div>
                    <Link
                      href={`/customer/invoices/${lead.id}`}
                      className="inline-block mt-3 text-green-800 hover:underline text-sm font-medium"
                    >
                      View Invoice →
                    </Link>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* (Removed old cards-based summary blocks; estimate sheet above contains totals + GST) */}

        {/* Additional Work (full width, table on desktop) */}
        <div className="mt-6">
          <div className="bg-white border rounded-xl shadow-sm p-6 print:shadow-none">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">Additional Job Requests</h3>
                <p className="text-sm text-gray-600">Review OEM/OES/Labour and accept or reject each item.</p>
              </div>
              <span className="text-sm text-gray-600">
                {Array.isArray(extraWork) ? `${extraWork.length} item(s)` : '0 item(s)'}
              </span>
            </div>

            {Array.isArray(extraWork) && extraWork.length > 0 ? (
              <>
                {/* Desktop table */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50 text-gray-600">
                      <tr>
                        <th className="text-left py-2 px-3">Item</th>
                        <th className="text-left py-2 px-3">Priority</th>
                        <th className="text-right py-2 px-3">OEM</th>
                        <th className="text-right py-2 px-3">OES</th>
                        <th className="text-right py-2 px-3">Labour</th>
                        <th className="text-right py-2 px-3">Total</th>
                        <th className="text-left py-2 px-3">Choice</th>
                        <th className="text-left py-2 px-3">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {extraWork.map((req) => {
                        const status = String(req.status || 'PENDING');
                        const decisionLabel = getExtraWorkDecisionLabel(req);
                        const { choice, locked, canOem, canOes, oem, oes } = getCustomerPartChoice(req);
                        const labour = Number(req.labour_price ?? 0);
                        const parts = choice === 'OES' ? oes : oem;
                        const total = parts > 0 ? (parts + labour) : 0;
                        const acting = Boolean(actingByRequestId[req.id]);
                        const isHigh = Boolean(req.is_urgent);
                        return (
                          <tr key={req.id} className={isHigh ? 'bg-red-50/40' : undefined}>
                            <td className="py-3 px-3">
                              <div className="font-semibold text-gray-900">{req.description}</div>
                              {req.reason && (
                                <div className="text-xs text-gray-600 mt-1 line-clamp-2">{req.reason}</div>
                              )}
                              {status === 'REJECTED' && req.rejection_reason && (
                                <div className="text-xs text-red-700 mt-1">
                                  Rejection reason: <span className="font-semibold">{req.rejection_reason}</span>
                                </div>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  isHigh ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {isHigh ? 'HIGH' : 'MEDIUM'}
                              </span>
                            </td>
                            <td className="py-3 px-3 text-right font-semibold">₹{oem.toFixed(2)}</td>
                            <td className="py-3 px-3 text-right font-semibold">₹{oes.toFixed(2)}</td>
                            <td className="py-3 px-3 text-right font-semibold">₹{labour.toFixed(2)}</td>
                            <td className="py-3 px-3 text-right font-bold text-gray-900">₹{total.toFixed(2)}</td>
                            <td className="py-3 px-3">
                              {status === 'PENDING' ? (
                                canOem && canOes ? (
                                <div className="flex items-center gap-3">
                                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
                                    <input
                                      type="radio"
                                      name={`choice-desktop-${req.id}`}
                                      className="h-4 w-4"
                                      checked={choice === 'OEM'}
                                      onChange={() => setDecisionByRequestId((p) => ({ ...p, [req.id]: 'OEM' }))}
                                      aria-label="Approve choice OEM"
                                    />
                                    OEM
                                  </label>
                                  <label className="inline-flex items-center gap-2 text-xs cursor-pointer select-none">
                                    <input
                                      type="radio"
                                      name={`choice-desktop-${req.id}`}
                                      className="h-4 w-4"
                                      checked={choice === 'OES'}
                                      onChange={() => setDecisionByRequestId((p) => ({ ...p, [req.id]: 'OES' }))}
                                      aria-label="Approve choice OES"
                                    />
                                    OES
                                  </label>
                                </div>
                                ) : (
                                  <div className="inline-flex items-center gap-2">
                                    <span className="text-xs text-gray-500">Selected</span>
                                    <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                                      {choice}
                                    </span>
                                    {locked && (
                                      <span className="text-[11px] text-gray-500">(fixed)</span>
                                    )}
                                  </div>
                                )
                              ) : (
                                <span
                                  className={`px-2 py-1 rounded text-xs font-semibold ${
                                    status === 'APPROVED'
                                      ? 'bg-green-100 text-green-800'
                                      : status === 'REJECTED'
                                        ? 'bg-red-100 text-red-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                  }`}
                                >
                                  {decisionLabel}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-3">
                              {status === 'PENDING' ? (
                                <div className="flex flex-col gap-2 min-w-[240px]">
                                  <div className="flex gap-2">
                                    <button
                                      type="button"
                                      disabled={acting}
                                      className="btn btn-primary btn-sm"
                                      onClick={async () => {
                                        try {
                                          setActingByRequestId((p) => ({ ...p, [req.id]: true }));
                                          const res = await fetch(
                                            `/api/public/lead/${leadId}/extra-work/${req.id}/respond`,
                                            {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({ action: 'APPROVE', part_price_type: choice }),
                                            }
                                          );
                                          const data = await res.json().catch(() => ({}));
                                          if (!res.ok) throw new Error(data?.error || 'Failed');
                                          await fetchLeadDetails();
                                        } catch (e: any) {
                                          alert(e?.message || 'Failed');
                                        } finally {
                                          setActingByRequestId((p) => ({ ...p, [req.id]: false }));
                                        }
                                      }}
                                    >
                                      Approve
                                    </button>
                                  </div>
                                  <div className="flex gap-2">
                                    <input
                                      className="input input-sm flex-1"
                                      placeholder="Reject reason"
                                      value={rejectReasonByRequestId[req.id] || ''}
                                      onChange={(e) =>
                                        setRejectReasonByRequestId((p) => ({ ...p, [req.id]: e.target.value }))
                                      }
                                    />
                                    <button
                                      type="button"
                                      disabled={acting || !(rejectReasonByRequestId[req.id] || '').trim()}
                                      className="btn btn-outline btn-sm"
                                      onClick={async () => {
                                        try {
                                          setActingByRequestId((p) => ({ ...p, [req.id]: true }));
                                          const res = await fetch(
                                            `/api/public/lead/${leadId}/extra-work/${req.id}/respond`,
                                            {
                                              method: 'POST',
                                              headers: { 'Content-Type': 'application/json' },
                                              body: JSON.stringify({
                                                action: 'REJECT',
                                                rejection_reason: (rejectReasonByRequestId[req.id] || '').trim(),
                                              }),
                                            }
                                          );
                                          const data = await res.json().catch(() => ({}));
                                          if (!res.ok) throw new Error(data?.error || 'Failed');
                                          await fetchLeadDetails();
                                        } catch (e: any) {
                                          alert(e?.message || 'Failed');
                                        } finally {
                                          setActingByRequestId((p) => ({ ...p, [req.id]: false }));
                                        }
                                      }}
                                    >
                                      Reject
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <span className="text-xs text-gray-600">
                                  {status === 'APPROVED'
                                    ? `Approved (${String(req.part_price_type || 'OEM')})`
                                    : status}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile cards */}
                <div className="md:hidden space-y-4">
                  {extraWork.map((req) => {
                    const status = String(req.status || 'PENDING');
                    const decisionLabel = getExtraWorkDecisionLabel(req);
                    const { choice, locked, canOem, canOes, oem, oes } = getCustomerPartChoice(req);
                    const labour = Number(req.labour_price ?? 0);
                    const parts = choice === 'OES' ? oes : oem;
                    const total = parts > 0 ? (parts + labour) : 0;
                    const acting = Boolean(actingByRequestId[req.id]);
                    const isHigh = Boolean(req.is_urgent);
                    return (
                      <div key={req.id} className={`border rounded-lg p-4 ${isHigh ? 'border-red-200 bg-red-50/30' : ''}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="font-semibold text-gray-900">{req.description}</p>
                            <div className="mt-1 flex items-center gap-2">
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  isHigh ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-700'
                                }`}
                              >
                                {isHigh ? 'HIGH' : 'MEDIUM'}
                              </span>
                              <span
                                className={`px-2 py-1 rounded text-xs font-semibold ${
                                  status === 'APPROVED'
                                    ? 'bg-green-100 text-green-800'
                                    : status === 'REJECTED'
                                      ? 'bg-red-100 text-red-800'
                                      : 'bg-yellow-100 text-yellow-800'
                                }`}
                              >
                                {decisionLabel}
                              </span>
                            </div>
                            {req.reason && (
                              <p className="text-sm text-gray-600 mt-2 whitespace-pre-line">{req.reason}</p>
                            )}
                            {status === 'REJECTED' && req.rejection_reason && (
                              <p className="text-sm text-red-700 mt-2">
                                Rejection reason: <strong>{req.rejection_reason}</strong>
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-sm">
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-xs text-gray-600">OEM</div>
                            <div className="font-semibold">₹{oem.toFixed(2)}</div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-xs text-gray-600">OES</div>
                            <div className="font-semibold">₹{oes.toFixed(2)}</div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-xs text-gray-600">Labour</div>
                            <div className="font-semibold">₹{labour.toFixed(2)}</div>
                          </div>
                          <div className="bg-gray-50 rounded p-2">
                            <div className="text-xs text-gray-600">Total</div>
                            <div className="font-bold">₹{total.toFixed(2)}</div>
                          </div>
                        </div>

                        {status === 'PENDING' && (
                          <div className="mt-3 space-y-3">
                            {canOem && canOes ? (
                            <div className="flex items-center gap-4">
                              <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                                <input
                                  type="radio"
                                  name={`choice-mobile-${req.id}`}
                                  className="h-4 w-4"
                                  checked={choice === 'OEM'}
                                  onChange={() => setDecisionByRequestId((p) => ({ ...p, [req.id]: 'OEM' }))}
                                  aria-label="Approve choice OEM"
                                />
                                OEM
                              </label>
                              <label className="inline-flex items-center gap-2 text-sm cursor-pointer select-none">
                                <input
                                  type="radio"
                                  name={`choice-mobile-${req.id}`}
                                  className="h-4 w-4"
                                  checked={choice === 'OES'}
                                  onChange={() => setDecisionByRequestId((p) => ({ ...p, [req.id]: 'OES' }))}
                                  aria-label="Approve choice OES"
                                />
                                OES
                              </label>
                            </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <div className="text-sm text-gray-600">Selected</div>
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-1 rounded text-xs font-semibold bg-blue-50 text-blue-700">
                                    {choice}
                                  </span>
                                  {locked && <span className="text-xs text-gray-500">(fixed)</span>}
                                </div>
                              </div>
                            )}

                            <div className="flex flex-col gap-2">
                              <button
                                type="button"
                                disabled={acting}
                                className="btn btn-primary w-full"
                                onClick={async () => {
                                  try {
                                    setActingByRequestId((p) => ({ ...p, [req.id]: true }));
                                    const res = await fetch(`/api/public/lead/${leadId}/extra-work/${req.id}/respond`, {
                                      method: 'POST',
                                      headers: { 'Content-Type': 'application/json' },
                                      body: JSON.stringify({ action: 'APPROVE', part_price_type: choice }),
                                    });
                                    const data = await res.json().catch(() => ({}));
                                    if (!res.ok) throw new Error(data?.error || 'Failed');
                                    await fetchLeadDetails();
                                  } catch (e: any) {
                                    alert(e?.message || 'Failed');
                                  } finally {
                                    setActingByRequestId((p) => ({ ...p, [req.id]: false }));
                                  }
                                }}
                              >
                                Approve
                              </button>
                              <div className="flex gap-2">
                                <input
                                  className="input flex-1"
                                  placeholder="Rejection reason"
                                  value={rejectReasonByRequestId[req.id] || ''}
                                  onChange={(e) =>
                                    setRejectReasonByRequestId((p) => ({ ...p, [req.id]: e.target.value }))
                                  }
                                />
                                <button
                                  type="button"
                                  disabled={acting || !(rejectReasonByRequestId[req.id] || '').trim()}
                                  className="btn btn-outline"
                                  onClick={async () => {
                                    try {
                                      setActingByRequestId((p) => ({ ...p, [req.id]: true }));
                                      const res = await fetch(`/api/public/lead/${leadId}/extra-work/${req.id}/respond`, {
                                        method: 'POST',
                                        headers: { 'Content-Type': 'application/json' },
                                        body: JSON.stringify({
                                          action: 'REJECT',
                                          rejection_reason: (rejectReasonByRequestId[req.id] || '').trim(),
                                        }),
                                      });
                                      const data = await res.json().catch(() => ({}));
                                      if (!res.ok) throw new Error(data?.error || 'Failed');
                                      await fetchLeadDetails();
                                    } catch (e: any) {
                                      alert(e?.message || 'Failed');
                                    } finally {
                                      setActingByRequestId((p) => ({ ...p, [req.id]: false }));
                                    }
                                  }}
                                >
                                  Reject
                                </button>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            ) : (
              <div className="text-sm text-gray-600">No additional job requests.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

