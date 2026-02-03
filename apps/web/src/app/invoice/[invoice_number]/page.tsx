'use client';

import { formatDateDMY } from "@/lib/utils";
/**
 * Customer-Facing Invoice View Page
 * Step 5: Share Invoice with Customer - In-app view
 */

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { FileText, Download, Printer, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import RazorpayPaymentButton from '@/components/payment/RazorpayPaymentButton';
import toast from 'react-hot-toast';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type?: 'ORDER_SUMMARY' | 'CUSTOMER_INVOICE' | 'TAX_INVOICE' | string;
  show_gst_breakup?: boolean;
  visible_to_customer?: boolean;
  invoice_date: string;
  created_at?: string;
  final_amount: number;
  paid_amount: number;
  payment_status: string;
  base_amount: number;
  extra_charges: number;
  parts_cost: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  discount_amount: number;
  line_items: any[];
  amount_in_words: string;
  lead: {
    customer_name: string;
    customer_phone: string;
    customer_email: string;
    vehicle_number: string;
    vehicle_make: string;
    vehicle_model: string;
  };
  workshop: {
    name: string;
    address: string;
    phone: string;
    email: string;
    gst_number: string;
  };
}

type CouponBreakdownItem = {
  code: string;
  coupon_kind: string | null;
  discount_amount: number;
  free_service_label?: string | null;
  error?: string | null;
};

export default function CustomerInvoicePage() {
  const params = useParams();
  const invoiceNumber = params.invoice_number as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [couponBreakdown, setCouponBreakdown] = useState<CouponBreakdownItem[]>([]);
  const [couponBreakdownLoading, setCouponBreakdownLoading] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceNumber]);

  async function fetchInvoice() {
    const supabase = createClient();
    setLoading(true);
    setError(null);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      // NEW FLOW: Tax Invoice (TI-...) should not be publicly visible without login
      if (!user && invoiceNumber?.toUpperCase().startsWith('TI-')) {
        setError('Tax Invoice requires login');
        return;
      }

      const { data: invoiceData, error: invoiceError } = await supabase
        .from('invoices')
        .select(`
          *,
          lead:service_leads!lead_id(
            customer_name,
            customer_phone,
            customer_email,
            vehicle_number,
            vehicle_make,
            vehicle_model
          ),
          workshop:workshops!workshop_id(
            name,
            address,
            phone,
            email,
            gst_number
          )
        `)
        .eq('invoice_number', invoiceNumber)
        .single();

      if (invoiceError || !invoiceData) {
        setError('Invoice not found');
        return;
      }

      // Gate customer visibility for CI when not yet activated/confirmed
      if (!user && (invoiceData as any).invoice_type === 'CUSTOMER_INVOICE' && (invoiceData as any).visible_to_customer !== true) {
        setError('Customer Invoice not active yet');
        return;
      }

      setInvoice(invoiceData as Invoice);

      // Mark as viewed
      await supabase
        .from('invoices')
        .update({
          viewed_by_customer_at: new Date().toISOString(),
        })
        .eq('id', invoiceData.id);
    } catch (error) {
      console.error('Error:', error);
      setError('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }

  async function printInvoice() {
    if (!invoice) return;

    try {
      const { printInvoice } = await import('@/lib/services/pdfService');
      printInvoice(invoice.id);
    } catch (error: any) {
      console.error('Error printing invoice:', error);
      // Fallback to window.print()
      window.print();
    }
  }

  async function downloadInvoice() {
    if (!invoice) return;

    try {
      const { downloadInvoicePDF } = await import('@/lib/services/pdfService');
      await downloadInvoicePDF(invoice.id, invoice.invoice_number);
      toast.success('Invoice download started!');
    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      toast.error('Failed to download invoice');
    }
  }

  const parseCodes = (raw: any): string[] => {
    if (!raw) return [];
    if (Array.isArray(raw)) {
      return raw.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean);
    }
    if (typeof raw === 'string') {
      try {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          return parsed.map((c) => String(c || '').trim().toUpperCase()).filter(Boolean);
        }
      } catch {
        // ignore
      }
      return raw
        .split(',')
        .map((c) => String(c || '').trim().toUpperCase())
        .filter(Boolean);
    }
    return [];
  };

  useEffect(() => {
    let cancelled = false;
    const inv = invoice as any;
    if (!inv) {
      setCouponBreakdown([]);
      return;
    }

    const selectedCodes = parseCodes(inv?.coupon_meta?.selected_codes);
    const applied = String(inv?.coupon_code || '').trim().toUpperCase();
    const codes = Array.from(new Set([...(selectedCodes || []), ...(applied ? [applied] : [])])).filter(Boolean);

    if (codes.length === 0) {
      setCouponBreakdown([]);
      return;
    }

    const toNum = (v: any) => {
      const n = typeof v === 'number' ? v : parseFloat(String(v ?? '0'));
      return Number.isFinite(n) ? n : 0;
    };

    const subTotalBeforeDiscount =
      toNum(inv?.sub_total ?? inv?.subtotal) ||
      Math.max(0, toNum(inv?.base_amount) + toNum(inv?.parts_cost) + toNum(inv?.extra_charges));

    const serviceItems = (Array.isArray(inv?.line_items) ? inv.line_items : [])
      .filter((it: any) => {
        const c = String(it?.category || '').toUpperCase();
        return c === 'SERVICE' || c === 'ADDON' || c === 'ADD-ON' || c === 'ADD_ON';
      })
      .map((it: any) => ({
        service_type_id: it?.service_type_id ?? null,
        subservice_id: it?.subservice_id ?? null,
        label: it?.description ?? null,
        price:
          Number((it as any)?.original_amount ?? 0) > 0
            ? Number((it as any).original_amount)
            : Number(it?.amount ?? 0) || 0,
      }));

    const leadCtx = {
      subtotal: subTotalBeforeDiscount,
      service_type_ids: serviceItems.map((x: any) => String(x?.service_type_id || '')).filter(Boolean),
      subservice_ids: serviceItems.map((x: any) => String(x?.subservice_id || '')).filter(Boolean),
      custom_labels: serviceItems.map((x: any) => String(x?.label || '')).filter(Boolean),
      service_items: serviceItems,
      customer_phone: inv?.lead?.customer_phone ?? null,
    };

    (async () => {
      try {
        setCouponBreakdownLoading(true);
        const results = await Promise.all(
          codes.map(async (c) => {
            try {
              const res = await fetch('/api/coupons/validate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ code: c, lead_context: leadCtx }),
              });
              const json = await res.json().catch(() => ({}));
              const valid = Boolean(json?.valid);
              const kind = String(json?.coupon?.coupon_kind || '').trim() || null;
              const amt = Number(json?.discount_amount ?? 0) || 0;
              const label =
                String(json?.coupon_meta?.free_service?.matched_label || '').trim() ||
                String(json?.coupon_meta?.free_service?.target_custom_label || '').trim() ||
                null;
              return {
                code: c,
                coupon_kind: kind,
                discount_amount: valid ? amt : 0,
                free_service_label: label,
                error: valid ? null : String(json?.error || 'Coupon not applicable'),
              };
            } catch (e: any) {
              return {
                code: c,
                coupon_kind: null,
                discount_amount: 0,
                error: e?.message || 'Failed to validate coupon',
              };
            }
          })
        );

        // Best-effort FREE_SERVICE amount fallback from invoice line_items original_amount
        const freeServiceOriginalTotal = (Array.isArray(inv?.line_items) ? inv.line_items : [])
          .filter((it: any) => Boolean((it as any)?.free_service) && Number((it as any)?.original_amount ?? 0) > 0)
          .reduce((s: number, it: any) => s + (Number((it as any)?.original_amount ?? 0) || 0), 0);

        const next = results.map((r) => {
          const k = String(r?.coupon_kind || '').toUpperCase();
          if (k === 'FREE_SERVICE' && (Number(r.discount_amount || 0) || 0) <= 0 && freeServiceOriginalTotal > 0) {
            return { ...r, discount_amount: freeServiceOriginalTotal };
          }
          return r;
        });

        if (cancelled) return;
        setCouponBreakdown(next);
      } catch {
        if (cancelled) return;
        setCouponBreakdown([]);
      } finally {
        if (!cancelled) setCouponBreakdownLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [invoice?.id]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <Loader2 className="w-12 h-12 animate-spin text-brand-primary mx-auto mb-4" />
          <p className="text-gray-600">Loading invoice...</p>
        </div>
      </div>
    );
  }

  if (error || !invoice) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="card text-center max-w-md">
          <FileText className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Invoice Not Found</h2>
          <p className="text-gray-600">{error || 'The invoice you are looking for does not exist.'}</p>
        </div>
      </div>
    );
  }

  const remainingAmount = invoice.final_amount - (invoice.paid_amount || 0);
  const isPaid = invoice.payment_status === 'PAID';
  const isPartial = invoice.payment_status === 'PARTIAL';
  const selectedCodes = parseCodes((invoice as any)?.coupon_meta?.selected_codes);
  const appliedCode = String((invoice as any)?.coupon_code || '').trim().toUpperCase();
  const couponCodes = Array.from(new Set([...(selectedCodes || []), ...(appliedCode ? [appliedCode] : [])])).filter(Boolean);
  const totalDiscountFromBreakdown = couponBreakdown.reduce((s, c) => s + (Number(c?.discount_amount || 0) || 0), 0);
  const totalDiscountDisplay =
    totalDiscountFromBreakdown > 0
      ? totalDiscountFromBreakdown
      : Number((invoice as any)?.discount_amount || 0) || 0;
  const docTitle =
    invoice.invoice_type === 'ORDER_SUMMARY'
      ? 'ORDER SUMMARY'
      : invoice.invoice_type === 'CUSTOMER_INVOICE'
        ? 'CUSTOMER INVOICE'
        : 'TAX INVOICE';
  const showGst = invoice.show_gst_breakup !== false && invoice.invoice_type === 'TAX_INVOICE';

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="flex justify-between items-start mb-6">
            <div>
              <h1 className="text-3xl font-bold text-gray-800">{docTitle}</h1>
              <p className="text-gray-600 mt-1">Invoice #{invoice.invoice_number}</p>
            </div>
            <div className="text-right">
              <p className="text-sm text-gray-600">Invoice Date</p>
              <p className="font-semibold">
                {formatDateDMY(invoice.invoice_date || invoice.created_at || new Date())}
              </p>
            </div>
          </div>

          {/* Company & Customer Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-6">
            <div>
              <h3 className="font-bold text-gray-800 mb-2">From:</h3>
              <p className="font-semibold">{invoice.workshop?.name || 'MyFNG Autocare'}</p>
              <p className="text-sm text-gray-600">{invoice.workshop?.address}</p>
              <p className="text-sm text-gray-600">Phone: {invoice.workshop?.phone}</p>
              <p className="text-sm text-gray-600">Email: {invoice.workshop?.email}</p>
              {invoice.workshop?.gst_number && (
                <p className="text-sm text-gray-600">GSTIN: {invoice.workshop.gst_number}</p>
              )}
            </div>
            <div>
              <h3 className="font-bold text-gray-800 mb-2">To:</h3>
              <p className="font-semibold">{invoice.lead?.customer_name}</p>
              <p className="text-sm text-gray-600">Phone: {invoice.lead?.customer_phone}</p>
              <p className="text-sm text-gray-600">Email: {invoice.lead?.customer_email}</p>
              <p className="text-sm text-gray-600">
                Vehicle: {invoice.lead?.vehicle_number} ({invoice.lead?.vehicle_make} {invoice.lead?.vehicle_model})
              </p>
            </div>
          </div>
        </div>

        {/* Line Items */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <h2 className="text-xl font-bold mb-4">Line Items</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-right font-semibold">Qty</th>
                  <th className="px-4 py-3 text-right font-semibold">Rate</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {invoice.line_items?.map((item: any, idx: number) => (
                  <tr key={idx}>
                    <td className="px-4 py-3">{item.description}</td>
                    <td className="px-4 py-3 text-right">{item.qty || 1}</td>
                    <td className="px-4 py-3 text-right">₹{item.rate?.toFixed(2) || '0.00'}</td>
                    <td className="px-4 py-3 text-right font-medium">₹{item.amount?.toFixed(2) || '0.00'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Amount Summary */}
        <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
          <div className="max-w-md ml-auto space-y-2">
            <div className="flex justify-between">
              <span>Subtotal:</span>
              <span>₹{(invoice.base_amount + invoice.extra_charges + invoice.parts_cost - invoice.discount_amount).toFixed(2)}</span>
            </div>
            {couponCodes.length > 0 && (
              <div className="flex justify-between">
                <span>Coupon Code{couponCodes.length > 1 ? 's' : ''}:</span>
                <span>{couponCodes.join(', ')}</span>
              </div>
            )}
            {couponBreakdownLoading && (
              <div className="flex justify-between text-gray-500">
                <span>Coupon Details:</span>
                <span>Calculating…</span>
              </div>
            )}
            {!couponBreakdownLoading &&
              couponBreakdown.map((c) => {
                const kind = String(c?.coupon_kind || '').toUpperCase();
                const label =
                  kind === 'FREE_SERVICE'
                    ? `Free Service (${c.code})${c.free_service_label ? ` - ${c.free_service_label}` : ''}`
                    : kind === 'TOTAL_DISCOUNT'
                      ? `Discount (${c.code})`
                      : `Coupon (${c.code})`;
                const value = Number(c?.discount_amount || 0) || 0;
                return (
                  <div key={`coupon-${c.code}`} className="flex justify-between">
                    <span>{label}:</span>
                    <span>{value > 0 ? `-₹${value.toFixed(2)}` : '—'}</span>
                  </div>
                );
              })}
            {totalDiscountDisplay > 0 && (
              <div className="flex justify-between text-red-600">
                <span>Total Discount:</span>
                <span>-₹{totalDiscountDisplay.toFixed(2)}</span>
              </div>
            )}
            {showGst && invoice.cgst_amount > 0 && (
              <div className="flex justify-between">
                <span>CGST (9%):</span>
                <span>₹{invoice.cgst_amount.toFixed(2)}</span>
              </div>
            )}
            {showGst && invoice.sgst_amount > 0 && (
              <div className="flex justify-between">
                <span>SGST (9%):</span>
                <span>₹{invoice.sgst_amount.toFixed(2)}</span>
              </div>
            )}
            {showGst && invoice.igst_amount > 0 && (
              <div className="flex justify-between">
                <span>IGST (18%):</span>
                <span>₹{invoice.igst_amount.toFixed(2)}</span>
              </div>
            )}
            <div className="border-t pt-2 mt-2 flex justify-between font-bold text-lg">
              <span>{showGst ? 'Total Amount:' : 'Total to Pay:'}</span>
              <span className="text-green-600">₹{invoice.final_amount.toFixed(2)}</span>
            </div>
            {invoice.amount_in_words && (
              <p className="text-sm text-gray-600 mt-2">
                <strong>Amount in Words:</strong> {invoice.amount_in_words}
              </p>
            )}
          </div>
        </div>

        {/* Payment Status */}
        {isPaid ? (
          <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6">
            <div className="flex items-center gap-2 text-green-700 mb-2">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold text-lg">Payment Received</span>
            </div>
            <p className="text-green-600">Thank you for your payment!</p>
          </div>
        ) : (
          <>
            {invoice.invoice_type === 'CUSTOMER_INVOICE' ? (
          <div className="bg-white rounded-lg shadow-lg p-8 mb-6">
            <h2 className="text-xl font-bold mb-4">Payment</h2>
            {isPartial && (
              <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                <p className="text-yellow-800">
                  Partial payment received: ₹{invoice.paid_amount.toFixed(2)}
                </p>
                <p className="text-yellow-800 font-semibold">
                  Remaining amount: ₹{remainingAmount.toFixed(2)}
                </p>
              </div>
            )}
            {invoice.lead && (
              <RazorpayPaymentButton
                invoiceId={invoice.id}
                amount={remainingAmount}
                customerName={invoice.lead.customer_name}
                customerEmail={invoice.lead.customer_email || ''}
                customerPhone={invoice.lead.customer_phone || ''}
                invoiceNumber={invoice.invoice_number}
                onPaymentSuccess={() => {
                  fetchInvoice();
                }}
                className="w-full"
              />
            )}
          </div>
            ) : invoice.invoice_type === 'ORDER_SUMMARY' ? (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-6">
                <div className="flex items-center gap-2 text-blue-700 mb-2">
                  <Clock className="w-5 h-5" />
                  <span className="font-semibold text-lg">Awaiting Confirmation</span>
                </div>
                <p className="text-blue-700">
                  This is an Order Summary for approval. Please confirm to activate the Customer Invoice for payment.
                </p>
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/customer/leads/${(invoice as any)?.lead?.id}/confirm-order-summary`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                      });
                      const data = await res.json();
                      if (!res.ok) throw new Error(data.error || 'Failed to confirm');
                      toast.success('Order Summary confirmed. Opening Customer Invoice...');
                      if (data?.customer_invoice?.invoice_number) {
                        window.location.href = `/invoice/${data.customer_invoice.invoice_number}`;
                      } else {
                        fetchInvoice();
                      }
                    } catch (e: any) {
                      toast.error(e?.message || 'Failed to confirm order summary');
                    }
                  }}
                  className="btn-primary mt-4 w-full"
                >
                  Confirm Order Summary
                </button>
              </div>
            ) : (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 mb-6">
                <p className="text-gray-700">
                  Payment is not available on this document type.
                </p>
              </div>
            )}
          </>
        )}

        {/* Action Buttons */}
        <div className="bg-white rounded-lg shadow-lg p-6 flex gap-4">
          <button
            onClick={printInvoice}
            className="btn-secondary flex items-center gap-2 flex-1"
          >
            <Printer className="w-4 h-4" />
            Print Invoice
          </button>
          <button
            onClick={downloadInvoice}
            className="btn-secondary flex items-center gap-2 flex-1"
          >
            <Download className="w-4 h-4" />
            Download PDF
          </button>
        </div>
      </div>
    </div>
  );
}

