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
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-12 h-12 animate-spin text-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!invoice) {
    return (
      <DashboardLayout role="billing">
        <div className="card text-center py-12">
          <XCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Invoice Not Found</h3>
          <button onClick={() => router.push('/dashboard/billing')} className="btn-primary mt-4">
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

  return (
    <DashboardLayout role="billing">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">Invoice Details</h1>
          <p className="text-white font-medium mt-1">Invoice: {invoice.invoice_number}</p>
        </div>

        {/* Invoice Summary */}
        <div className="card">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-semibold text-lg">{invoice.lead?.customer_name}</p>
              <p className="text-sm text-gray-500">{invoice.lead?.customer_phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Vehicle</p>
              <p className="font-semibold text-lg">{invoice.lead?.vehicle_number}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="font-bold text-2xl text-green-600">₹{invoice.final_amount.toFixed(2)}</p>
              <p className={`text-sm mt-1 ${isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                {isPaid ? 'Paid' : 'Pending'}
              </p>
            </div>
          </div>
        </div>

        {/* Status Badge */}
        <div className="card">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <p className="font-semibold text-lg capitalize">{invoice.status.replace('_', ' ')}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Payment Status</p>
              <p className={`font-semibold text-lg ${isPaid ? 'text-green-600' : 'text-orange-600'}`}>
                {invoice.payment_status}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Review Invoice */}
          {canReview && (
            <button
              onClick={() => router.push(`/dashboard/billing/invoices/${invoiceId}/review`)}
              className="btn-primary flex items-center justify-center gap-2"
            >
              <Eye className="w-4 h-4" />
              Review Invoice
            </button>
          )}

          {/* Send Invoice */}
          {canSend && (
            <button
              onClick={handleSendInvoice}
              className="btn-secondary bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Invoice
            </button>
          )}

          {/* Collect Payment */}
          {canCollectPayment && !isPaid && (
            <button
              onClick={() => router.push(`/dashboard/billing/invoices/${invoiceId}/payment`)}
              className="btn-secondary bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
            >
              <DollarSign className="w-4 h-4" />
              Collect Payment
            </button>
          )}

          {/* View Customer Invoice */}
          <button
            onClick={() => window.open(`/invoice/${invoice.invoice_number}`, '_blank')}
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <FileText className="w-4 h-4" />
            View Customer Invoice
          </button>

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
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Download className="w-4 h-4" />
            Download PDF
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
            className="btn-secondary flex items-center justify-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Print Invoice
          </button>
        </div>

        {/* Back Button */}
        <div className="flex justify-end">
          <button
            onClick={() => router.push('/dashboard/billing')}
            className="btn-secondary"
          >
            Back to Billing Dashboard
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

