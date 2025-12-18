'use client';

import { formatDateDMY, formatDateTime } from "@/lib/utils";
/**
 * Invoice Section Component
 * Generate and display invoice for completed leads
 * Task: WA-702
 */

import { useState, useEffect } from 'react';
import { FileText, Download, Printer, Send, CheckCircle, Clock, RefreshCw } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface InvoiceSectionProps {
  lead: any;
  onUpdate?: () => void;
}

interface Invoice {
  id: string;
  invoice_number: string;
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
  const [generating, setGenerating] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

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

  async function generateInvoice() {
    setGenerating(true);
    try {
      // Use the new billing API route
      const response = await fetch(`/api/billing/leads/${lead.id}/generate-invoice`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to generate invoice');
      }

      const data = await response.json();
      setInvoice(data.invoice);
      alert('✅ Invoice generated successfully!');
      onUpdate?.();
    } catch (error: any) {
      console.error('Error generating invoice:', error);
      alert(`Failed to generate invoice: ${error.message}`);
    } finally {
      setGenerating(false);
    }
  }

  async function regenerateInvoice() {
    if (!confirm('Are you sure you want to regenerate this invoice? This will create a new invoice with updated amounts.')) {
      return;
    }

    setRegenerating(true);
    try {
      // Use the new billing API route with regenerate parameter
      const response = await fetch(`/api/billing/leads/${lead.id}/generate-invoice?regenerate=true`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to regenerate invoice');
      }

      const data = await response.json();
      setInvoice(data.invoice);
      alert('✅ Invoice regenerated successfully!');
      onUpdate?.();
    } catch (error: any) {
      console.error('Error regenerating invoice:', error);
      alert(`Failed to regenerate invoice: ${error.message}`);
    } finally {
      setRegenerating(false);
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

  // Allow supervisor/admin to generate invoice once mechanic has submitted work completion as well.
  const canGenerateInvoice = ['WORK_COMPLETED', 'QC_APPROVED', 'READY_FOR_BILLING', 'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'].includes(lead.status);

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
          {canGenerateInvoice ? (
            <button
              onClick={generateInvoice}
              disabled={generating}
              className="btn btn-primary"
            >
              <FileText className="w-4 h-4" />
              {generating ? 'Generating...' : 'Generate Invoice'}
            </button>
          ) : (
            <p className="text-sm text-gray-500">
              Invoice can only be generated when lead status is WORK_COMPLETED, QC_APPROVED, READY_FOR_BILLING, READY_FOR_DELIVERY, DELIVERED, or CLOSED
            </p>
          )}
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
              <p className="text-3xl font-bold">₹{invoice.total_amount.toFixed(2)}</p>
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
                  <td className="px-4 py-3 font-semibold">Net Taxable Value</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{((invoice.subtotal || invoice.sub_total || 0) - (invoice.discount_amount || 0)).toFixed(2)}</td>
                </tr>
                {(invoice.cgst_amount || invoice.cgst || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3">CGST @ 9%</td>
                    <td className="px-4 py-3 text-right">₹{((invoice.cgst_amount || invoice.cgst) || 0).toFixed(2)}</td>
                  </tr>
                )}
                {(invoice.sgst_amount || invoice.sgst || 0) > 0 && (
                <tr>
                  <td className="px-4 py-3">SGST @ 9%</td>
                    <td className="px-4 py-3 text-right">₹{((invoice.sgst_amount || invoice.sgst) || 0).toFixed(2)}</td>
                  </tr>
                )}
                {(invoice.igst_amount || invoice.igst || 0) > 0 && (
                  <tr>
                    <td className="px-4 py-3">IGST @ 18%</td>
                    <td className="px-4 py-3 text-right">₹{((invoice.igst_amount || invoice.igst) || 0).toFixed(2)}</td>
                  </tr>
                )}
                {(invoice.total_tax || 0) > 0 && (
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
                  <td className="px-4 py-3">Amount Payable (INR)</td>
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
            <button
              onClick={regenerateInvoice}
              disabled={regenerating}
              className="btn btn-secondary flex-1"
            >
              <RefreshCw className={`w-4 h-4 ${regenerating ? 'animate-spin' : ''}`} />
              {regenerating ? 'Regenerating...' : 'Regenerate'}
            </button>
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
            <button
              onClick={sendInvoice}
              className="btn btn-primary flex-1"
            >
              <Send className="w-4 h-4" />
              Send to Customer
            </button>
          </div>

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

