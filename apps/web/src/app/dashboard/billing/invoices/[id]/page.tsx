'use client';

/**
 * Invoice Detail Page
 * Shows invoice details with actions: Review, Send, Payment, etc.
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { FileText, CheckCircle, XCircle, Send, DollarSign, Eye, Download, Printer, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface Invoice {
  id: string;
  invoice_number: string;
  invoice_date: string;
  final_amount: number;
  paid_amount: number;
  payment_status: string;
  status: string;
  invoice_type?: 'ORDER_SUMMARY' | 'CUSTOMER_INVOICE' | 'TAX_INVOICE' | string;
  invoice_approved?: boolean;
  lead: {
    id: string;
    customer_name: string;
    customer_phone: string;
    vehicle_number: string;
  };
}

export default function InvoiceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [relatedInvoices, setRelatedInvoices] = useState<Array<{ id: string; invoice_number: string; invoice_type?: string; payment_status?: string; status?: string }>>([]);

  useEffect(() => {
    fetchInvoice();
  }, [invoiceId]);

  async function fetchInvoice() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: invoiceData, error } = await supabase
        .from('invoices')
        .select(`
          *,
          lead:service_leads!lead_id(
            id,
            customer_name,
            customer_phone,
            vehicle_number
          )
        `)
        .eq('id', invoiceId)
        .single();

      if (error || !invoiceData) {
        toast.error('Invoice not found');
        router.push('/dashboard/billing');
        return;
      }

      setInvoice(invoiceData as Invoice);

      // Fetch related OS/CI/TI for same lead (best-effort)
      try {
        const leadId = (invoiceData as any).lead_id;
        if (leadId) {
          const { data: rel } = await supabase
            .from('invoices')
            .select('id, invoice_number, invoice_type, payment_status, status, created_at')
            .eq('lead_id', leadId)
            .order('created_at', { ascending: true });
          setRelatedInvoices((rel as any) || []);
        } else {
          setRelatedInvoices([]);
        }
      } catch {
        setRelatedInvoices([]);
      }
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load invoice');
    } finally {
      setLoading(false);
    }
  }

  async function handleSendInvoice() {
    if (!invoice) return;

    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/send`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          methods: ['EMAIL', 'SMS', 'IN_APP'],
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invoice');
      }

      toast.success('Invoice sent successfully!');
      fetchInvoice();
    } catch (error: any) {
      console.error('Error sending invoice:', error);
      toast.error(error.message || 'Failed to send invoice');
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="billing">
        <div className="flex items-center justify-center min-h-[300px] sm:min-h-[400px]">
          <div className="text-center">
            <Loader2 className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 animate-spin text-brand-primary mx-auto mb-3 sm:mb-4" />
            <p className="text-gray-600 text-xs sm:text-sm md:text-base">Loading invoice details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout role="billing">
        <div className="card text-center py-8 sm:py-10 md:py-12 px-4">
          <XCircle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-red-500 mx-auto mb-2 sm:mb-3 md:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold mb-1.5 sm:mb-2">Invoice Not Found</h3>
          <button onClick={() => router.push('/dashboard/billing')} className="btn-primary mt-3 sm:mt-4 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2">
            Back to Billing
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const canReview = invoice.status === 'GENERATED';
  const canSend = ['APPROVED', 'GENERATED'].includes(invoice.status);
  const canCollectPayment = ['APPROVED', 'SENT', 'AWAITING_PAYMENT'].includes(invoice.status);
  const isPaid = invoice.payment_status === 'PAID';
  const canInternalApproveTI = invoice.invoice_type === 'TAX_INVOICE' && !invoice.invoice_approved;
  const docLabel =
    invoice.invoice_type === 'ORDER_SUMMARY'
      ? 'Order Summary (OS)'
      : invoice.invoice_type === 'CUSTOMER_INVOICE'
        ? 'Customer Invoice (CI)'
        : invoice.invoice_type === 'TAX_INVOICE'
          ? 'Tax Invoice (TI)'
          : 'Invoice';

  return (
    <DashboardLayout role="billing">
      <div className="space-y-4 sm:space-y-5 md:space-y-6 p-3 sm:p-4 md:p-5 lg:p-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">Invoice Details</h1>
          <p className="text-white font-medium mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base">Invoice: {invoice.invoice_number}</p>
        </div>

        {/* Invoice Summary */}
        <div className="card">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Customer</p>
              <p className="font-semibold text-base sm:text-lg mt-0.5 sm:mt-1">{invoice.lead?.customer_name}</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">{invoice.lead?.customer_phone}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Vehicle</p>
              <p className="font-semibold text-base sm:text-lg mt-0.5 sm:mt-1">{invoice.lead?.vehicle_number}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Total Amount</p>
              <p className="font-bold text-xl sm:text-2xl text-green-600 mt-0.5 sm:mt-1">₹{invoice.final_amount.toFixed(2)}</p>
              <p className={`text-xs sm:text-sm mt-0.5 sm:mt-1 ${isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                {isPaid ? 'Paid' : 'Pending'}
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <span className="inline-flex items-center rounded-full bg-gray-100 text-gray-700 px-2 py-1 text-xs font-semibold">
              {docLabel}
            </span>
            {invoice.invoice_approved && invoice.invoice_type === 'TAX_INVOICE' && (
              <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-1 text-xs font-semibold">
                Internal Approved
              </span>
            )}
          </div>
        </div>

        {/* Related OS/CI/TI */}
        {relatedInvoices.length > 0 && (
          <div className="card">
            <p className="text-xs sm:text-sm text-gray-600 mb-2">Documents for this lead</p>
            <div className="flex flex-wrap gap-2">
              {relatedInvoices.map((inv) => (
                <button
                  key={inv.id}
                  onClick={() => router.push(`/dashboard/billing/invoices/${inv.id}`)}
                  className={`btn-secondary text-xs px-3 py-1.5 ${inv.id === invoice.id ? 'bg-brand-primary text-white' : ''}`}
                >
                  {(inv.invoice_type === 'ORDER_SUMMARY' ? 'OS' : inv.invoice_type === 'CUSTOMER_INVOICE' ? 'CI' : inv.invoice_type === 'TAX_INVOICE' ? 'TI' : 'INV')}
                  -{inv.invoice_number}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Status Badge */}
        <div className="card">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Status</p>
              <p className="font-semibold text-base sm:text-lg mt-0.5 sm:mt-1 capitalize">{invoice.status.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-xs sm:text-sm text-gray-600">Payment Status</p>
              <p className={`font-semibold text-base sm:text-lg mt-0.5 sm:mt-1 ${isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                {invoice.payment_status}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
          {/* Review Invoice */}
          {canReview && (
            <button
              onClick={() => router.push(`/dashboard/billing/invoices/${invoiceId}/review`)}
              className="btn-primary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5"
            >
              <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Review Invoice</span>
              <span className="sm:hidden">Review</span>
            </button>
          )}

          {/* Send Invoice */}
          {canSend && (
            <button
              onClick={handleSendInvoice}
              className="btn-secondary bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5"
            >
              <Send className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Send Invoice</span>
              <span className="sm:hidden">Send</span>
            </button>
          )}

          {/* Collect Payment */}
          {canCollectPayment && !isPaid && (
            <button
              onClick={() => router.push(`/dashboard/billing/invoices/${invoiceId}/payment`)}
              className="btn-secondary bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5"
            >
              <DollarSign className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Collect Payment</span>
              <span className="sm:hidden">Payment</span>
            </button>
          )}

          {/* View Customer Invoice */}
          <button
            onClick={() => window.open(`/invoice/${invoice.invoice_number}`, '_blank')}
            className="btn-secondary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5"
          >
            <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">View Document</span>
            <span className="sm:hidden">View</span>
          </button>

          {/* Internal Approve (Tax Invoice) */}
          {canInternalApproveTI && (
            <button
              onClick={async () => {
                try {
                  const res = await fetch(`/api/billing/invoices/${invoiceId}/internal-approve`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ checklist_data: { items: true, taxes: true, customer: true } }),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error || 'Failed to approve');
                  toast.success('Tax invoice internally approved');
                  fetchInvoice();
                } catch (e: any) {
                  toast.error(e?.message || 'Failed to approve tax invoice');
                }
              }}
              className="btn-secondary bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5"
            >
              <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Internal Approve (TI)</span>
              <span className="sm:hidden">Approve TI</span>
            </button>
          )}

          {/* Download PDF */}
          <button
            onClick={async () => {
              try {
                const { downloadInvoicePDF } = await import('@/lib/services/pdfService');
                await downloadInvoicePDF(invoice.id, invoice.invoice_number);
                toast.success('Invoice download started!');
              } catch (error: any) {
                toast.error('Failed to download invoice');
              }
            }}
            className="btn-secondary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5"
          >
            <Download className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Download PDF</span>
            <span className="sm:hidden">Download</span>
          </button>

          {/* Print Invoice */}
          <button
            onClick={async () => {
              try {
                const { printInvoice } = await import('@/lib/services/pdfService');
                printInvoice(invoice.id);
              } catch (error: any) {
                window.print();
              }
            }}
            className="btn-secondary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-2 sm:py-2.5"
          >
            <Printer className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
            <span className="hidden sm:inline">Print Invoice</span>
            <span className="sm:hidden">Print</span>
          </button>
        </div>

        {/* Back Button */}
        <div className="flex justify-end">
          <button
            onClick={() => router.push('/dashboard/billing')}
            className="btn-secondary text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
          >
            Back to Billing Dashboard
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

