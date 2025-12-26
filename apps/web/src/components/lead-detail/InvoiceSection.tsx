'use client';

import { formatDateDMY, formatDateTime } from "@/lib/utils";
/**
 * Invoice Section Component
 * Generate and display invoice for completed leads
 * Task: WA-702
 */

import { useState, useEffect } from 'react';
import { FileText, Download, Printer, Send, CheckCircle, Clock, RefreshCw, CreditCard, DollarSign } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface InvoiceSectionProps {
  lead: any;
  onUpdate?: () => void;
}

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_type?: 'ORDER_SUMMARY' | 'CUSTOMER_INVOICE' | 'TAX_INVOICE' | string;
  visible_to_customer?: boolean;
  show_gst_breakup?: boolean;
  base_amount: number;
  parts_cost?: number;
  parts_amount?: number;
  extra_charges?: number;
  extra_charges_amount?: number;
  discount_amount?: number;
  subtotal: number;
  sub_total?: number;
  cgst?: number;
  cgst_amount?: number;
  sgst?: number;
  sgst_amount?: number;
  igst?: number;
  igst_amount?: number;
  total_tax?: number;
  round_off_amount?: number;
  total_amount: number;
  final_amount?: number;
  amount_in_words?: string;
  invoice_date: string;
  due_date: string;
  payment_status: 'PENDING' | 'PAID' | 'PARTIAL' | 'PARTIALLY_PAID' | 'OVERDUE';
  payment_mode?: string;
  payment_txn_id?: string;
  payment_remarks?: string;
  paid_amount?: number;
  old_parts_handed_over?: boolean;
  old_parts_handed_over_notes?: string;
  warranty_info?: {
    labour_warranty?: string;
    parts_warranty?: string;
    notes?: string;
  };
  recommended_future_work?: string;
  invoice_notes?: string;
  bank_name?: string;
  bank_account_name?: string;
  bank_account_number?: string;
  bank_ifsc?: string;
  bank_branch?: string;
  document_url?: string;
  document_type?: string;
  created_at: string;
  status?: string;
}

export default function InvoiceSection({ lead, onUpdate }: InvoiceSectionProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [activating, setActivating] = useState(false);
  const [showPaymentForm, setShowPaymentForm] = useState(false);
  const [paymentMode, setPaymentMode] = useState<'CASH' | 'POS' | 'UPI' | 'CARD'>('CASH');
  const [staffName, setStaffName] = useState('');
  const [paymentRemarks, setPaymentRemarks] = useState('');
  const [paymentRef, setPaymentRef] = useState('');
  const [paying, setPaying] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [lead.id]);

  async function fetchInvoice() {
    setLoading(true);
    try {
      // Fetch invoice using the existing API route
      const response = await fetch(`/api/leads/${lead.id}/invoice`);
      
      if (response.ok) {
        const data = await response.json();
        // Handle API response format
        const invoiceData = data.invoice;
        if (invoiceData) {
          // Map fields to ensure compatibility
          const mappedInvoice: Invoice = {
            ...invoiceData,
            parts_amount: invoiceData.parts_amount || invoiceData.parts_cost || 0,
            extra_charges_amount: invoiceData.extra_charges_amount || invoiceData.extra_charges || 0,
            subtotal: invoiceData.subtotal || invoiceData.sub_total || 0,
            cgst: invoiceData.cgst || invoiceData.cgst_amount || 0,
            sgst: invoiceData.sgst || invoiceData.sgst_amount || 0,
            igst: invoiceData.igst || invoiceData.igst_amount || 0,
            total_amount: invoiceData.total_amount || invoiceData.final_amount || 0,
            invoice_date: invoiceData.invoice_date || invoiceData.created_at || new Date().toISOString(),
            due_date: invoiceData.due_date || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
            payment_status: invoiceData.payment_status || 'PENDING',
          };
          setInvoice(mappedInvoice);
        }
      }
    } catch (error) {
      console.error('Error fetching invoice:', error);
    } finally {
      setLoading(false);
    }
  }

  async function finalizeBill() {
    setFinalizing(true);
    try {
      const res = await fetch(`/api/billing/leads/${lead.id}/finalize-bill`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to finalize bill');
      alert(`✅ Bill finalized. Customer Invoice: ${data?.invoice?.invoice_number || ''}`);
      await fetchInvoice();
      onUpdate?.();
    } catch (e: any) {
      alert(`Failed to finalize bill: ${e?.message || 'Unknown error'}`);
    } finally {
      setFinalizing(false);
    }
  }

  async function activateCustomerInvoice() {
    if (!invoice) return;
    setActivating(true);
    try {
      const res = await fetch(`/api/billing/invoices/${invoice.id}/activate`, { method: 'POST' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to activate invoice');
      alert('✅ Customer invoice activated for payment');
      await fetchInvoice();
      onUpdate?.();
    } catch (e: any) {
      alert(`Failed to activate: ${e?.message || 'Unknown error'}`);
    } finally {
      setActivating(false);
    }
  }

  async function recordOfflinePayment() {
    if (!invoice) return;
    const remaining = ((invoice.final_amount || invoice.total_amount) || 0) - (invoice.paid_amount || 0);
    if (remaining <= 0) {
      alert('No balance due');
      return;
    }
    if (!staffName.trim()) {
      alert('Staff name is required');
      return;
    }
    if (!paymentRemarks.trim()) {
      alert('Payment remarks are required');
      return;
    }
    setPaying(true);
    try {
      const res = await fetch(`/api/payments/invoices/${invoice.id}/record-payment`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payment_mode: paymentMode,
          paid_amount: remaining,
          payment_reference: paymentRef || undefined,
          payment_remarks: paymentRemarks,
          staff_name: staffName,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to record payment');
      alert('✅ Payment recorded');
      setShowPaymentForm(false);
      setPaymentRef('');
      setPaymentRemarks('');
      await fetchInvoice();
      onUpdate?.();
    } catch (e: any) {
      alert(`Failed to record payment: ${e?.message || 'Unknown error'}`);
    } finally {
      setPaying(false);
    }
  }

  async function printInvoice() {
    if (!invoice) {
      alert('Invoice not found');
      return;
    }

    try {
      // Prefer persisted document URL (stable); otherwise generate/persist first
      let printUrl = invoice.document_url;

      if (!printUrl) {
        const persistRes = await fetch(`/api/billing/invoices/${invoice.id}/persist-document`, {
          method: 'POST',
        });
        if (persistRes.ok) {
          const persisted = await persistRes.json();
          printUrl = persisted.document_url;
        }
      }

      if (!printUrl) {
        printUrl = `/api/billing/invoices/${invoice.id}/generate-pdf`;
      }

      const printWindow = window.open(printUrl, '_blank');
      
      if (printWindow) {
        printWindow.onload = () => {
          setTimeout(() => {
            printWindow.print();
          }, 500); // Small delay to ensure content is loaded
        };
      } else {
        // Fallback: if popup blocked, open in same window
        window.location.href = printUrl;
        setTimeout(() => {
          window.print();
        }, 1000);
      }

      // Refresh invoice to capture document_url if it was generated
      await fetchInvoice();
    } catch (error: any) {
      console.error('Error printing invoice:', error);
      alert(`Failed to print invoice: ${error.message}`);
    }
  }

  async function downloadInvoice() {
    if (!invoice) {
      alert('Invoice not found');
      return;
    }

    try {
      // Prefer persisted document URL (stable)
      let urlToDownload = invoice.document_url;

      // If not persisted yet, persist first (best-effort)
      if (!urlToDownload) {
        const persistRes = await fetch(`/api/billing/invoices/${invoice.id}/persist-document`, {
          method: 'POST',
        });
        if (persistRes.ok) {
          const persisted = await persistRes.json();
          urlToDownload = persisted.document_url;
        }
      }

      // Fallback to generator endpoint (HTML)
      if (!urlToDownload) {
        urlToDownload = `/api/billing/invoices/${invoice.id}/generate-pdf`;
      }

      const link = document.createElement('a');
      link.href = urlToDownload;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.download = `Invoice-${invoice.invoice_number}.${(invoice.document_type || 'HTML').toLowerCase()}`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      // Refresh invoice to capture document_url if it was generated
      await fetchInvoice();
      alert('✅ Invoice download started!');
    } catch (error: any) {
      console.error('Error downloading invoice:', error);
      alert(`Failed to download invoice: ${error.message}`);
    }
  }

  async function sendInvoice() {
    if (!invoice) {
      alert('Invoice not found');
      return;
    }

    try {
      const methods = [];
      const hasEmail = lead.customer_email;
      const hasPhone = lead.customer_phone;

      if (hasEmail) methods.push('EMAIL');
      if (hasPhone) methods.push('SMS');
      if (hasPhone) methods.push('WHATSAPP');
      methods.push('IN_APP');

      const response = await fetch(`/api/billing/invoices/${invoice.id}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ methods }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invoice');
      }

      const successMethods = Object.entries(data.results || {})
        .filter(([_, result]: [string, any]) => result.success)
        .map(([method]) => method);

      if (successMethods.length > 0) {
        alert(`✅ Invoice sent successfully via: ${successMethods.join(', ')}`);
        onUpdate?.();
      } else {
        alert('⚠️ Failed to send invoice. Please check customer contact details.');
      }
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      alert(`Failed to send invoice: ${error.message}`);
    }
  }

  const invoiceType = (invoice as any)?.invoice_type || 'TAX_INVOICE';
  const showGst = (invoice as any)?.show_gst_breakup !== false && invoiceType === 'TAX_INVOICE';
  const isOS = invoiceType === 'ORDER_SUMMARY';
  const isCI = invoiceType === 'CUSTOMER_INVOICE';
  const isTI = invoiceType === 'TAX_INVOICE';

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <FileText className="w-5 h-5 text-brand-primary" />
        Invoice
      </h2>

      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading invoice...</div>
      ) : !invoice ? (
        <div className="text-center py-8">
          <FileText className="w-12 h-12 mx-auto mb-3 text-gray-400" />
          <p className="text-gray-500 mb-4">No invoice generated yet</p>
          <p className="text-sm text-gray-500">
            In the new flow, Order Summary is generated automatically when Supervisor approves QC.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Invoice Header */}
          <div className="flex justify-between items-start p-4 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-lg text-white">
            <div>
              <h3 className="text-2xl font-bold">{invoice.invoice_number}</h3>
              <p className="text-sm opacity-90">Invoice Date: {formatDateDMY(invoice.invoice_date)}</p>
              <p className="text-sm opacity-90">Due Date: {formatDateDMY(invoice.due_date)}</p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-90">Total Amount</p>
              <p className="text-3xl font-bold">₹{((invoice.final_amount || invoice.total_amount) || 0).toFixed(2)}</p>
              <span
                className={`inline-block px-3 py-1 rounded-full text-xs font-semibold mt-2 ${
                  invoice.payment_status === 'PAID'
                    ? 'bg-green-100 text-green-800'
                    : invoice.payment_status === 'OVERDUE'
                    ? 'bg-red-100 text-red-800'
                    : 'bg-yellow-100 text-yellow-800'
                }`}
              >
                {invoice.payment_status === 'PAID' && <CheckCircle className="w-3 h-3 inline mr-1" />}
                {invoice.payment_status === 'PENDING' && <Clock className="w-3 h-3 inline mr-1" />}
                {invoice.payment_status}
              </span>
            </div>
          </div>

          {/* Invoice Breakdown */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Description</th>
                  <th className="px-4 py-3 text-right font-semibold">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                <tr>
                  <td className="px-4 py-3">Base Service Charges</td>
                  <td className="px-4 py-3 text-right font-medium">₹{(invoice.base_amount || 0).toFixed(2)}</td>
                </tr>
                {(invoice.parts_amount || invoice.parts_cost || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3">Parts & Materials</td>
                    <td className="px-4 py-3 text-right font-medium">₹{((invoice.parts_amount || invoice.parts_cost) || 0).toFixed(2)}</td>
                  </tr>
                )}
                {(invoice.extra_charges_amount || invoice.extra_charges || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3">Additional Charges</td>
                    <td className="px-4 py-3 text-right font-medium">₹{((invoice.extra_charges_amount || invoice.extra_charges) || 0).toFixed(2)}</td>
                  </tr>
                )}
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 font-semibold">Sub-Total (without taxes)</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{((invoice.subtotal || invoice.sub_total) || 0).toFixed(2)}</td>
                </tr>
                {(invoice.discount_amount || 0) > 0 && (
                <tr>
                    <td className="px-4 py-3">Discount / Coupon</td>
                    <td className="px-4 py-3 text-right text-red-600">-₹{(invoice.discount_amount || 0).toFixed(2)}</td>
                  </tr>
                )}
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 font-semibold">{showGst ? 'Net Taxable Value' : 'Sub-Total (No GST)'}</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{((invoice.subtotal || invoice.sub_total || 0) - (invoice.discount_amount || 0)).toFixed(2)}</td>
                </tr>
                {showGst && (invoice.cgst_amount || invoice.cgst || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3">CGST @ 9%</td>
                    <td className="px-4 py-3 text-right">₹{((invoice.cgst_amount || invoice.cgst) || 0).toFixed(2)}</td>
                  </tr>
                )}
                {showGst && (invoice.sgst_amount || invoice.sgst || 0) > 0 && (
                <tr>
                  <td className="px-4 py-3">SGST @ 9%</td>
                    <td className="px-4 py-3 text-right">₹{((invoice.sgst_amount || invoice.sgst) || 0).toFixed(2)}</td>
                  </tr>
                )}
                {showGst && (invoice.igst_amount || invoice.igst || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3">IGST @ 18%</td>
                    <td className="px-4 py-3 text-right">₹{((invoice.igst_amount || invoice.igst) || 0).toFixed(2)}</td>
                  </tr>
                )}
                {showGst && (invoice.total_tax || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3 font-semibold">Total GST</td>
                    <td className="px-4 py-3 text-right font-semibold">₹{(invoice.total_tax || 0).toFixed(2)}</td>
                  </tr>
                )}
                {(invoice.round_off_amount || 0) !== 0 && (
                  <tr>
                    <td className="px-4 py-3">Round Off</td>
                    <td className="px-4 py-3 text-right">{(invoice.round_off_amount || 0) > 0 ? '+' : ''}₹{(invoice.round_off_amount || 0).toFixed(2)}</td>
                </tr>
                )}
                <tr className="bg-brand-primary bg-opacity-10 font-bold text-lg">
                  <td className="px-4 py-3">
                    {isOS ? 'Gross Total (No GST)' : isCI ? 'Total to Pay (No GST)' : 'Amount Payable (INR)'}
                  </td>
                  <td className="px-4 py-3 text-right">₹{((invoice.final_amount || invoice.total_amount) || 0).toFixed(2)}</td>
                </tr>
                {invoice.amount_in_words && (
                  <tr>
                    <td colSpan={2} className="px-4 py-3 text-center italic text-gray-600 bg-gray-50">
                      <strong>Amount in Words:</strong> {invoice.amount_in_words}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Payment Status */}
          {invoice.paid_amount && invoice.paid_amount > 0 && (
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex justify-between items-center">
                <div>
                  <p className="text-sm text-green-700">Amount Paid</p>
                  <p className="text-2xl font-bold text-green-800">₹{invoice.paid_amount.toFixed(2)}</p>
                  {invoice.payment_mode && (
                    <p className="text-xs text-green-600 mt-1">Via: {invoice.payment_mode}</p>
                  )}
                  {invoice.payment_txn_id && (
                    <p className="text-xs text-green-600">Txn Ref: {invoice.payment_txn_id}</p>
                  )}
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-700">Balance Due</p>
                  <p className="text-2xl font-bold text-green-800">
                    ₹{(((invoice.final_amount || invoice.total_amount) || 0) - invoice.paid_amount).toFixed(2)}
                  </p>
                </div>
              </div>
              {invoice.payment_remarks && (
                <div className="mt-3 pt-3 border-t border-green-200">
                  <p className="text-xs text-green-700"><strong>Payment Remarks:</strong> {invoice.payment_remarks}</p>
                </div>
              )}
            </div>
          )}

          {/* Additional Invoice Details */}
          {(invoice.old_parts_handed_over !== undefined || invoice.warranty_info || invoice.recommended_future_work || invoice.invoice_notes) && (
            <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg">
              <h4 className="font-semibold mb-3">Additional Information</h4>
              {invoice.old_parts_handed_over !== undefined && (
                <p className="text-sm mb-2">
                  <strong>Old parts handed over:</strong> {invoice.old_parts_handed_over ? 'Yes' : 'No'}
                  {invoice.old_parts_handed_over_notes && ` - ${invoice.old_parts_handed_over_notes}`}
                </p>
              )}
              {invoice.warranty_info && (
                <div className="text-sm mb-2">
                  <strong>Warranty:</strong>
                  {invoice.warranty_info.labour_warranty && (
                    <p className="ml-4">Labour: {invoice.warranty_info.labour_warranty}</p>
                  )}
                  {invoice.warranty_info.parts_warranty && (
                    <p className="ml-4">Parts: {invoice.warranty_info.parts_warranty}</p>
                  )}
                  {invoice.warranty_info.notes && (
                    <p className="ml-4 text-gray-600">{invoice.warranty_info.notes}</p>
                  )}
                </div>
              )}
              {invoice.recommended_future_work && (
                <p className="text-sm mb-2">
                  <strong>Recommended future work:</strong> {invoice.recommended_future_work}
                </p>
              )}
              {invoice.invoice_notes && (
                <p className="text-sm">
                  <strong>Notes:</strong> {invoice.invoice_notes}
                </p>
              )}
            </div>
          )}

          {/* Bank Details */}
          {(invoice.bank_name || invoice.bank_account_number) && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="font-semibold mb-2">Bank Details (NEFT/RTGS)</h4>
              <div className="text-sm space-y-1">
                {invoice.bank_name && <p><strong>Bank:</strong> {invoice.bank_name}</p>}
                {invoice.bank_account_name && <p><strong>Account Name:</strong> {invoice.bank_account_name}</p>}
                {invoice.bank_account_number && <p><strong>Account No:</strong> {invoice.bank_account_number}</p>}
                {invoice.bank_ifsc && <p><strong>IFSC:</strong> {invoice.bank_ifsc}</p>}
                {invoice.bank_branch && <p><strong>Branch:</strong> {invoice.bank_branch}</p>}
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
            {isOS && (
              <button
                onClick={finalizeBill}
                disabled={finalizing}
                className="btn btn-secondary flex-1"
              >
                <RefreshCw className={`w-4 h-4 ${finalizing ? 'animate-spin' : ''}`} />
                {finalizing ? 'Finalizing...' : 'Finalize Bill (Create CI)'}
              </button>
            )}
            {isCI && (
              <button
                onClick={finalizeBill}
                disabled={finalizing}
                className="btn btn-secondary flex-1"
              >
                <RefreshCw className={`w-4 h-4 ${finalizing ? 'animate-spin' : ''}`} />
                {finalizing ? 'Recalculating...' : 'Recalculate Bill'}
              </button>
            )}
            <button
              onClick={printInvoice}
              className="btn btn-outline flex-1"
            >
              <Printer className="w-4 h-4" />
              Print
            </button>
            <button
              onClick={downloadInvoice}
              className="btn btn-outline flex-1"
            >
              <Download className="w-4 h-4" />
              Download PDF
            </button>
            {!isTI && (
              <button
                onClick={sendInvoice}
                className="btn btn-primary flex-1"
              >
                <Send className="w-4 h-4" />
                Send to Customer
              </button>
            )}
          </div>

          {/* CI activation + payment collection (Supervisor-managed) */}
          {isCI && (
            <div className="p-4 border border-gray-200 rounded-lg">
              <div className="flex flex-wrap gap-3 items-center justify-between">
                <div>
                  <p className="font-semibold">Customer Invoice</p>
                  <p className="text-xs text-gray-600">
                    Status: {(invoice.visible_to_customer ? 'VISIBLE' : 'NOT_VISIBLE')} • Payment: {invoice.payment_status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {!invoice.visible_to_customer && (
                    <button
                      onClick={activateCustomerInvoice}
                      disabled={activating}
                      className="btn btn-outline"
                    >
                      <CreditCard className="w-4 h-4" />
                      {activating ? 'Activating...' : 'Activate for Payment'}
                    </button>
                  )}
                  <button
                    onClick={() => setShowPaymentForm((v) => !v)}
                    className="btn btn-outline"
                  >
                    <DollarSign className="w-4 h-4" />
                    Record Offline Payment
                  </button>
                </div>
              </div>

              {showPaymentForm && (
                <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-gray-600">Payment Mode</label>
                    <select
                      className="w-full border rounded-md p-2"
                      value={paymentMode}
                      onChange={(e) => setPaymentMode(e.target.value as any)}
                    >
                      <option value="CASH">CASH</option>
                      <option value="POS">POS</option>
                      <option value="UPI">UPI</option>
                      <option value="CARD">CARD</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Reference (optional)</label>
                    <input
                      className="w-full border rounded-md p-2"
                      value={paymentRef}
                      onChange={(e) => setPaymentRef(e.target.value)}
                      placeholder="UPI Ref / POS Slip / Txn ID"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Staff Name</label>
                    <input
                      className="w-full border rounded-md p-2"
                      value={staffName}
                      onChange={(e) => setStaffName(e.target.value)}
                      placeholder="e.g. Rahul (Supervisor)"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-gray-600">Payment Remarks</label>
                    <input
                      className="w-full border rounded-md p-2"
                      value={paymentRemarks}
                      onChange={(e) => setPaymentRemarks(e.target.value)}
                      placeholder="e.g. Cash received at counter"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <button
                      onClick={recordOfflinePayment}
                      disabled={paying}
                      className="btn btn-primary w-full"
                    >
                      {paying ? 'Recording...' : 'Confirm Payment Received'}
                    </button>
                    <p className="text-[11px] text-gray-500 mt-2">
                      Note: This records full remaining amount as paid and triggers Tax Invoice creation on full payment.
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Invoice Footer */}
          <div className="text-xs text-gray-500 text-center pt-4 border-t border-gray-200">
            <p>Invoice created on {formatDateTime(invoice.created_at)}</p>
            <p className="mt-1">Thank you for your business!</p>
          </div>
        </div>
      )}
    </div>
  );
}

