'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { CheckCircle, XCircle, AlertTriangle, Eye, Clock, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import { formatDateTime } from "@/lib/utils";

interface Invoice {
  id: string;
  invoice_number: string;
  total_amount: number;
  status: string;
  created_at: string;
  requires_second_approval: boolean;
  invoice_approved: boolean;
  lead: {
    lead_number: string;
    customer_name: string;
    workshop_id: string;
  };
  workshop: {
    name: string;
    city: string;
  };
  reviews: any[];
  latest_review: any;
}

export default function InvoiceReviewDashboard() {
  const router = useRouter();
  const supabase = getBrowserClient();
  
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('GENERATED');
  const [selectedInvoice, setSelectedInvoice] = useState<Invoice | null>(null);
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewData, setReviewData] = useState({
    review_status: 'APPROVED',
    review_notes: '',
    items_verified: true,
    taxes_verified: true,
    customer_details_verified: true
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchInvoices();
  }, [filter]);

  const fetchInvoices = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/invoices/pending-review?status=${filter}`);
      const data = await response.json();
      
      if (data.success) {
        setInvoices(data.invoices || []);
      }
    } catch (error) {
      toast.error('Failed to load invoices');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = async () => {
    if (!selectedInvoice) return;

    setSubmitting(true);
    try {
      const response = await fetch(`/api/invoices/${selectedInvoice.id}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reviewData)
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setShowReviewModal(false);
        fetchInvoices();
      } else {
        toast.error(data.error || 'Failed to review invoice');
      }
    } catch (error) {
      toast.error('Error submitting review');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-3 sm:p-4 md:p-5 lg:p-6">
      <div className="mb-4 sm:mb-5 md:mb-6">
        <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-1 sm:mb-2">Invoice Review</h1>
        <p className="text-gray-600 text-xs sm:text-sm md:text-base">Review and approve invoices before sending to customers</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 sm:gap-3 md:gap-4 mb-4 sm:mb-5 md:mb-6">
        {['GENERATED', 'PENDING', 'APPROVED', 'DRAFT'].map(status => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg font-medium transition text-xs sm:text-sm ${
              filter === status
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status}
          </button>
        ))}
      </div>

      {/* Invoice List */}
      {loading ? (
        <div className="text-center py-8 sm:py-10 md:py-12">
          <div className="inline-block animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-blue-600"></div>
          <p className="mt-3 sm:mt-4 text-gray-600 text-xs sm:text-sm md:text-base">Loading invoices...</p>
        </div>
      ) : invoices.length === 0 ? (
        <div className="text-center py-8 sm:py-10 md:py-12 bg-gray-50 rounded-lg">
          <AlertTriangle className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-2 sm:mb-3 md:mb-4" />
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">No invoices found</p>
        </div>
      ) : (
        <div className="grid gap-3 sm:gap-4">
          {invoices.map(invoice => (
            <div key={invoice.id} className="bg-white p-3 sm:p-4 md:p-5 lg:p-6 rounded-lg shadow border">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                    <h3 className="text-lg sm:text-xl font-bold truncate">{invoice.invoice_number}</h3>
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${
                      invoice.status === 'APPROVED' ? 'bg-green-100 text-green-800' :
                      invoice.status === 'PENDING' ? 'bg-yellow-100 text-yellow-800' :
                      invoice.status === 'DRAFT' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                    }`}>
                      {invoice.status}
                    </span>
                    {invoice.requires_second_approval && (
                      <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm bg-orange-100 text-orange-800">
                        Needs Finance Manager
                      </span>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 text-xs sm:text-sm">
                    <div>
                      <p className="text-gray-600">Lead: <span className="font-medium text-gray-900">{invoice.lead.lead_number}</span></p>
                      <p className="text-gray-600">Customer: <span className="font-medium text-gray-900">{invoice.lead.customer_name}</span></p>
                    </div>
                    <div>
                      <p className="text-gray-600">Workshop: <span className="font-medium text-gray-900">{invoice.workshop.name}</span></p>
                      <p className="text-gray-600">Amount: <span className="font-bold text-green-600">₹{parseFloat(invoice.total_amount.toString()).toLocaleString()}</span></p>
                    </div>
                  </div>

                  {invoice.latest_review && (
                    <div className="mt-2 sm:mt-3 p-2.5 sm:p-3 bg-gray-50 rounded">
                      <p className="text-xs sm:text-sm text-gray-600">
                        Last reviewed: {formatDateTime(invoice.latest_review.reviewed_at)}
                      </p>
                      {invoice.latest_review.review_notes && (
                        <p className="text-xs sm:text-sm mt-0.5 sm:mt-1">{invoice.latest_review.review_notes}</p>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <button
                    onClick={() => router.push(`/dashboard/billing/invoices/${invoice.id}`)}
                    className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm w-full sm:w-auto"
                  >
                    <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    View
                  </button>
                  {invoice.status === 'GENERATED' && (
                    <button
                      onClick={() => {
                        setSelectedInvoice(invoice);
                        setShowReviewModal(true);
                      }}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm w-full sm:w-auto"
                    >
                      <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Review
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && selectedInvoice && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-4 sm:p-5 md:p-6 border-b">
              <h2 className="text-lg sm:text-xl md:text-2xl font-bold">Review Invoice</h2>
              <p className="text-gray-600 mt-0.5 sm:mt-1 text-xs sm:text-sm md:text-base">{selectedInvoice.invoice_number}</p>
            </div>

            <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
              {/* Validation Checklist */}
              <div className="space-y-2 sm:space-y-3">
                <label className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reviewData.items_verified}
                    onChange={(e) => setReviewData({...reviewData, items_verified: e.target.checked})}
                    className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
                  />
                  <span className="text-xs sm:text-sm md:text-base">Line items verified against job card</span>
                </label>
                <label className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reviewData.taxes_verified}
                    onChange={(e) => setReviewData({...reviewData, taxes_verified: e.target.checked})}
                    className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
                  />
                  <span className="text-xs sm:text-sm md:text-base">Tax calculation verified (CGST/SGST/IGST)</span>
                </label>
                <label className="flex items-center gap-2 sm:gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={reviewData.customer_details_verified}
                    onChange={(e) => setReviewData({...reviewData, customer_details_verified: e.target.checked})}
                    className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0"
                  />
                  <span className="text-xs sm:text-sm md:text-base">Customer details verified</span>
                </label>
              </div>

              {/* Decision */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">Decision</label>
                <select
                  value={reviewData.review_status}
                  onChange={(e) => setReviewData({...reviewData, review_status: e.target.value})}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm"
                >
                  <option value="APPROVED">Approve</option>
                  <option value="REJECTED">Reject</option>
                </select>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs sm:text-sm font-medium mb-1.5 sm:mb-2">
                  {reviewData.review_status === 'REJECTED' ? 'Rejection Reason *' : 'Review Notes'}
                </label>
                <textarea
                  value={reviewData.review_notes}
                  onChange={(e) => setReviewData({...reviewData, review_notes: e.target.value})}
                  className="w-full px-2 sm:px-3 py-1.5 sm:py-2 border rounded-lg h-20 sm:h-24 text-xs sm:text-sm"
                  placeholder="Enter notes..."
                  required={reviewData.review_status === 'REJECTED'}
                />
              </div>

              {selectedInvoice.requires_second_approval && (
                <div className="p-3 sm:p-4 bg-orange-50 border border-orange-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-orange-800">
                    ⚠️ This invoice requires Finance Manager approval (Amount &gt; ₹50,000)
                  </p>
                </div>
              )}
            </div>

            <div className="p-4 sm:p-5 md:p-6 border-t flex flex-col sm:flex-row gap-2 sm:gap-3 justify-end">
              <button
                onClick={() => {
                  setShowReviewModal(false);
                  setSelectedInvoice(null);
                }}
                className="px-4 sm:px-6 py-1.5 sm:py-2 border rounded-lg hover:bg-gray-50 text-xs sm:text-sm w-full sm:w-auto"
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                onClick={handleReview}
                disabled={submitting || (reviewData.review_status === 'REJECTED' && !reviewData.review_notes)}
                className={`px-4 sm:px-6 py-1.5 sm:py-2 rounded-lg text-white flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm w-full sm:w-auto ${
                  reviewData.review_status === 'APPROVED'
                    ? 'bg-green-600 hover:bg-green-700'
                    : 'bg-red-600 hover:bg-red-700'
                } disabled:opacity-50`}
              >
                {submitting ? 'Submitting...' : reviewData.review_status === 'APPROVED' ? 'Approve' : 'Reject'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

