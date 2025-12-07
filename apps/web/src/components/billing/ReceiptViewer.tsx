'use client';

import { useEffect, useState } from 'react';
import { Download, Mail, Printer, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface ReceiptViewerProps {
  paymentId: string;
}

export default function ReceiptViewer({ paymentId }: ReceiptViewerProps) {
  const [receipt, setReceipt] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchReceipt();
  }, [paymentId]);

  const fetchReceipt = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/payments/${paymentId}/receipt`);
      const data = await response.json();
      
      if (data.success) {
        setReceipt(data.receipt);
      }
    } catch (error) {
      toast.error('Failed to load receipt');
    } finally {
      setLoading(false);
    }
  };

  const generateReceipt = async () => {
    setGenerating(true);
    try {
      const response = await fetch(`/api/payments/${paymentId}/receipt`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          send_to_customer: true,
          channels: ['email', 'sms']
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Receipt generated and sent!');
        fetchReceipt();
      } else {
        toast.error(data.error || 'Failed to generate receipt');
      }
    } catch (error) {
      toast.error('Error generating receipt');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
        <p className="mt-4 text-gray-600">Loading receipt...</p>
      </div>
    );
  }

  if (!receipt || !receipt.receipt_number) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600 mb-4">Receipt not generated yet</p>
        <button
          onClick={generateReceipt}
          disabled={generating}
          className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg disabled:opacity-50"
        >
          {generating ? 'Generating...' : 'Generate Receipt'}
        </button>
      </div>
    );
  }

  const lead = receipt.invoice?.lead;

  return (
    <div className="space-y-6">
      {/* Actions */}
      <div className="flex gap-3 justify-end">
        <button
          onClick={() => window.open(receipt.receipt_url, '_blank')}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <Download className="w-4 h-4" />
          Download
        </button>
        <button
          onClick={() => window.print()}
          className="px-4 py-2 border rounded-lg hover:bg-gray-50 flex items-center gap-2"
        >
          <Printer className="w-4 h-4" />
          Print
        </button>
        <button
          onClick={generateReceipt}
          className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2"
        >
          <Mail className="w-4 h-4" />
          Send to Customer
        </button>
      </div>

      {/* Receipt Preview */}
      <div className="bg-white border rounded-lg p-8 print:p-0">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
            <Check className="w-10 h-10 text-green-600" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Payment Receipt</h1>
          <p className="text-gray-600">Receipt #{receipt.receipt_number}</p>
        </div>

        {/* Payment Details */}
        <div className="border-t border-b py-6 mb-6">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="font-semibold mb-3">Customer Details</h3>
              <p className="text-sm"><strong>Name:</strong> {lead?.customer_name}</p>
              <p className="text-sm"><strong>Lead #:</strong> {lead?.lead_number}</p>
              <p className="text-sm"><strong>Invoice #:</strong> {receipt.invoice?.invoice_number}</p>
            </div>
            <div>
              <h3 className="font-semibold mb-3">Payment Details</h3>
              <p className="text-sm"><strong>Method:</strong> {receipt.payment_method}</p>
              <p className="text-sm"><strong>Transaction ID:</strong> {receipt.transaction_id}</p>
              <p className="text-sm"><strong>Date:</strong> {new Date(receipt.completed_at).toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Amount */}
        <div className="bg-green-50 p-6 rounded-lg text-center mb-6">
          <p className="text-sm text-gray-600 mb-1">Amount Paid</p>
          <p className="text-4xl font-bold text-green-600">₹{parseFloat(receipt.amount).toLocaleString()}</p>
        </div>

        {/* Footer */}
        <div className="text-center text-sm text-gray-600">
          <p>Thank you for your payment!</p>
          <p className="mt-2">
            Generated on {new Date(receipt.receipt_generated_at || Date.now()).toLocaleString()}
          </p>
        </div>
      </div>
    </div>
  );
}

