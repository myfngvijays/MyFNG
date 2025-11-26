'use client';

/**
 * Invoice Review Page
 * Step 4: Invoice Review - Workshop Admin/Billing verification
 */

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { CheckCircle, XCircle, FileText, DollarSign, User, Car, AlertCircle, Loader2 } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface Invoice {
  id: string;
  invoice_number: string;
  final_amount: number;
  base_amount: number;
  extra_charges: number;
  parts_cost: number;
  cgst_amount: number;
  sgst_amount: number;
  igst_amount: number;
  discount_amount: number;
  line_items: any[];
  status: string;
  lead: {
    id: string;
    customer_name: string;
    customer_phone: string;
    vehicle_number: string;
    vehicle_make: string;
    vehicle_model: string;
  };
  workshop: {
    name: string;
    gst_number: string;
  };
}

export default function InvoiceReviewPage() {
  const router = useRouter();
  const params = useParams();
  const invoiceId = params.id as string;

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);
  
  // Review checklist
  const [itemsVerified, setItemsVerified] = useState(false);
  const [taxesVerified, setTaxesVerified] = useState(false);
  const [customerDetailsVerified, setCustomerDetailsVerified] = useState(false);
  const [reviewNotes, setReviewNotes] = useState('');

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
            vehicle_number,
            vehicle_make,
            vehicle_model
          ),
          workshop:workshops!workshop_id(
            name,
            gst_number
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

  async function approveInvoice() {
    if (!itemsVerified || !taxesVerified || !customerDetailsVerified) {
      toast.error('Please verify all items before approving');
      return;
    }

    setReviewing(true);

    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/approve`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          review_notes: reviewNotes || 'Invoice verified and approved',
          items_verified: itemsVerified,
          taxes_verified: taxesVerified,
          customer_details_verified: customerDetailsVerified,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to approve invoice');
      }

      toast.success('Invoice approved successfully!');
      
      // Redirect after 2 seconds
      setTimeout(() => {
        router.push(`/dashboard/billing/invoices/${invoiceId}`);
      }, 2000);

    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to approve invoice');
    } finally {
      setReviewing(false);
    }
  }

  async function rejectInvoice() {
    if (!reviewNotes.trim()) {
      toast.error('Please provide rejection reason');
      return;
    }

    setReviewing(true);

    try {
      const response = await fetch(`/api/billing/invoices/${invoiceId}/reject`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rejection_reason: reviewNotes,
          review_notes: reviewNotes,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reject invoice');
      }

      toast.success('Invoice rejected. Please revise and regenerate.');
      
      setTimeout(() => {
        router.push(`/dashboard/billing/invoices/${invoiceId}`);
      }, 2000);

    } catch (error: any) {
      console.error('Error:', error);
      toast.error(error.message || 'Failed to reject invoice');
    } finally {
      setReviewing(false);
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
  const isApproved = invoice.status === 'APPROVED';

  return (
    <DashboardLayout role="billing">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-primary to-brand-secondary text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">📋 Invoice Review</h1>
          <p className="text-white font-medium mt-1">Invoice: {invoice.invoice_number}</p>
        </div>

        {isApproved && (
          <div className="card bg-green-50 border border-green-200">
            <div className="flex items-center gap-2 text-green-700">
              <CheckCircle className="w-5 h-5" />
              <span className="font-semibold">This invoice has already been approved</span>
            </div>
          </div>
        )}

        {/* Invoice Summary */}
        <div className="card">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            <FileText className="w-5 h-5 text-brand-primary" />
            Invoice Summary
          </h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600">Customer</p>
              <p className="font-semibold text-lg">{invoice.lead?.customer_name}</p>
              <p className="text-sm text-gray-500">{invoice.lead?.customer_phone}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Vehicle</p>
              <p className="font-semibold text-lg">{invoice.lead?.vehicle_number}</p>
              <p className="text-sm text-gray-500">
                {invoice.lead?.vehicle_make} {invoice.lead?.vehicle_model}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="font-bold text-2xl text-green-600">₹{invoice.final_amount.toFixed(2)}</p>
            </div>
          </div>
        </div>

        {/* Review Checklist */}
        {canReview && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-brand-primary" />
              Review Checklist
            </h2>

            <div className="space-y-4">
              {/* Items Verification */}
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <input
                  type="checkbox"
                  id="items"
                  checked={itemsVerified}
                  onChange={(e) => setItemsVerified(e.target.checked)}
                  className="mt-1 w-5 h-5"
                />
                <div className="flex-1">
                  <label htmlFor="items" className="font-semibold cursor-pointer">
                    Items Verified
                  </label>
                  <p className="text-sm text-gray-500 mt-1">
                    Verify all line items are correct, no missing items, no wrong/additional items
                  </p>
                  {invoice.line_items && invoice.line_items.length > 0 && (
                    <div className="mt-2 text-sm">
                      <p className="font-medium">Line Items ({invoice.line_items.length}):</p>
                      <ul className="list-disc list-inside mt-1 text-gray-600">
                        {invoice.line_items.slice(0, 5).map((item: any, idx: number) => (
                          <li key={idx}>{item.description} - ₹{item.amount?.toFixed(2)}</li>
                        ))}
                        {invoice.line_items.length > 5 && (
                          <li className="text-gray-400">... and {invoice.line_items.length - 5} more</li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              {/* Taxes Verification */}
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <input
                  type="checkbox"
                  id="taxes"
                  checked={taxesVerified}
                  onChange={(e) => setTaxesVerified(e.target.checked)}
                  className="mt-1 w-5 h-5"
                />
                <div className="flex-1">
                  <label htmlFor="taxes" className="font-semibold cursor-pointer">
                    Taxes Verified
                  </label>
                  <p className="text-sm text-gray-500 mt-1">
                    Verify taxes are correctly applied (CGST 9% + SGST 9% or IGST 18%)
                  </p>
                  <div className="mt-2 text-sm space-y-1">
                    {invoice.cgst_amount > 0 && (
                      <p className="text-gray-600">CGST (9%): ₹{invoice.cgst_amount.toFixed(2)}</p>
                    )}
                    {invoice.sgst_amount > 0 && (
                      <p className="text-gray-600">SGST (9%): ₹{invoice.sgst_amount.toFixed(2)}</p>
                    )}
                    {invoice.igst_amount > 0 && (
                      <p className="text-gray-600">IGST (18%): ₹{invoice.igst_amount.toFixed(2)}</p>
                    )}
                    <p className="font-semibold text-green-600">
                      Total Tax: ₹{(invoice.cgst_amount + invoice.sgst_amount + invoice.igst_amount).toFixed(2)}
                    </p>
                  </div>
                </div>
              </div>

              {/* Customer Details Verification */}
              <div className="flex items-start gap-3 p-4 border rounded-lg">
                <input
                  type="checkbox"
                  id="customer"
                  checked={customerDetailsVerified}
                  onChange={(e) => setCustomerDetailsVerified(e.target.checked)}
                  className="mt-1 w-5 h-5"
                />
                <div className="flex-1">
                  <label htmlFor="customer" className="font-semibold cursor-pointer">
                    Customer Details Verified
                  </label>
                  <p className="text-sm text-gray-500 mt-1">
                    Verify customer name and vehicle number are correct
                  </p>
                  <div className="mt-2 text-sm space-y-1">
                    <p className="text-gray-600">
                      <strong>Name:</strong> {invoice.lead?.customer_name}
                    </p>
                    <p className="text-gray-600">
                      <strong>Vehicle:</strong> {invoice.lead?.vehicle_number}
                    </p>
                    <p className="text-gray-600">
                      <strong>Phone:</strong> {invoice.lead?.customer_phone}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Review Notes */}
        {canReview && (
          <div className="card">
            <h2 className="text-xl font-bold mb-4">Review Notes</h2>
            <textarea
              value={reviewNotes}
              onChange={(e) => setReviewNotes(e.target.value)}
              placeholder="Add any notes or comments about this invoice..."
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              rows={4}
            />
          </div>
        )}

        {/* Action Buttons */}
        {canReview && (
          <div className="flex gap-4">
            <button
              onClick={approveInvoice}
              disabled={reviewing || !itemsVerified || !taxesVerified || !customerDetailsVerified}
              className="btn-primary flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reviewing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  Approve Invoice
                </>
              )}
            </button>
            <button
              onClick={rejectInvoice}
              disabled={reviewing || !reviewNotes.trim()}
              className="btn-secondary bg-red-600 hover:bg-red-700 text-white flex-1 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {reviewing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <XCircle className="w-4 h-4" />
                  Reject Invoice
                </>
              )}
            </button>
          </div>
        )}

        {/* Back Button */}
        <div className="flex justify-end">
          <button
            onClick={() => router.push(`/dashboard/billing/invoices/${invoiceId}`)}
            className="btn-secondary"
          >
            Back to Invoice
          </button>
        </div>
      </div>
    </DashboardLayout>
  );
}

