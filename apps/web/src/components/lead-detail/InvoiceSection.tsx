'use client';

/**
 * Invoice Section Component
 * Generate and display invoice for completed leads
 * Task: WA-702
 */

import { useState, useEffect } from 'react';
import { FileText, Download, Printer, Send, CheckCircle, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface InvoiceSectionProps {
  lead: any;
  onUpdate?: () => void;
}

interface Invoice {
  id: string;
  invoice_number: string;
  base_amount: number;
  parts_amount: number;
  extra_charges_amount: number;
  subtotal: number;
  cgst: number;
  sgst: number;
  total_amount: number;
  invoice_date: string;
  due_date: string;
  payment_status: 'PENDING' | 'PAID' | 'PARTIALLY_PAID' | 'OVERDUE';
  paid_amount?: number;
  created_at: string;
}

export default function InvoiceSection({ lead, onUpdate }: InvoiceSectionProps) {
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    fetchInvoice();
  }, [lead.id]);

  async function fetchInvoice() {
    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${lead.id}/invoice`);
      if (response.ok) {
        const data = await response.json();
        setInvoice(data.invoice);
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
      const response = await fetch(`/api/leads/${lead.id}/invoice`, {
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

  function printInvoice() {
    window.print();
  }

  function downloadInvoice() {
    // In a real implementation, this would generate a PDF
    alert('PDF download feature will be implemented');
  }

  function sendInvoice() {
    alert('Email/WhatsApp invoice feature will be implemented');
  }

  const canGenerateInvoice = ['READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED'].includes(lead.status);

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
              Invoice can only be generated when lead status is READY_FOR_DELIVERY, DELIVERED, or CLOSED
            </p>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Invoice Header */}
          <div className="flex justify-between items-start p-4 bg-gradient-to-r from-brand-primary to-brand-secondary rounded-lg text-white">
            <div>
              <h3 className="text-2xl font-bold">{invoice.invoice_number}</h3>
              <p className="text-sm opacity-90">Invoice Date: {new Date(invoice.invoice_date).toLocaleDateString()}</p>
              <p className="text-sm opacity-90">Due Date: {new Date(invoice.due_date).toLocaleDateString()}</p>
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
                  <td className="px-4 py-3 text-right font-medium">₹{invoice.base_amount.toFixed(2)}</td>
                </tr>
                {invoice.parts_amount > 0 && (
                  <tr>
                    <td className="px-4 py-3">Parts & Materials</td>
                    <td className="px-4 py-3 text-right font-medium">₹{invoice.parts_amount.toFixed(2)}</td>
                  </tr>
                )}
                {invoice.extra_charges_amount > 0 && (
                  <tr>
                    <td className="px-4 py-3">Additional Charges</td>
                    <td className="px-4 py-3 text-right font-medium">₹{invoice.extra_charges_amount.toFixed(2)}</td>
                  </tr>
                )}
                <tr className="bg-gray-50">
                  <td className="px-4 py-3 font-semibold">Subtotal</td>
                  <td className="px-4 py-3 text-right font-semibold">₹{invoice.subtotal.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">CGST @ 9%</td>
                  <td className="px-4 py-3 text-right">₹{invoice.cgst.toFixed(2)}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3">SGST @ 9%</td>
                  <td className="px-4 py-3 text-right">₹{invoice.sgst.toFixed(2)}</td>
                </tr>
                <tr className="bg-brand-primary bg-opacity-10 font-bold text-lg">
                  <td className="px-4 py-3">Total Amount</td>
                  <td className="px-4 py-3 text-right">₹{invoice.total_amount.toFixed(2)}</td>
                </tr>
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
                </div>
                <div className="text-right">
                  <p className="text-sm text-green-700">Balance Due</p>
                  <p className="text-2xl font-bold text-green-800">
                    ₹{(invoice.total_amount - invoice.paid_amount).toFixed(2)}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-3">
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
            <p>Invoice created on {new Date(invoice.created_at).toLocaleString()}</p>
            <p className="mt-1">Thank you for your business!</p>
          </div>
        </div>
      )}
    </div>
  );
}

