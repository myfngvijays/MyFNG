'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { FileText, DollarSign, Percent, Plus, Minus, Save, ArrowLeft, User, Car } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface InvoiceItem {
  id: string;
  description: string;
  amount: number;
  category: string;
}

export default function GenerateInvoicePage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);

  const [baseAmount, setBaseAmount] = useState(0);
  const [extraCharges, setExtraCharges] = useState<InvoiceItem[]>([]);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [discountValue, setDiscountValue] = useState(0);
  const [taxRate, setTaxRate] = useState(18); // Default GST 18%
  
  const [paymentTerms, setPaymentTerms] = useState('');
  const [notes, setNotes] = useState('');

  useEffect(() => {
    fetchLeadDetails();
  }, [leadId]);

  async function fetchLeadDetails() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError || !leadData) {
        toast.error('Lead not found');
        router.push('/dashboard/billing');
        return;
      }

      setLead(leadData);
      setBaseAmount(leadData.estimated_cost || 0);

      // Fetch approved extra charges
      const { data: extraChargesData } = await supabase
        .from('lead_extra_charges')
        .select('*')
        .eq('lead_id', leadId)
        .eq('status', 'APPROVED');

      if (extraChargesData && extraChargesData.length > 0) {
        setExtraCharges(extraChargesData.map(ec => ({
          id: ec.id,
          description: ec.description,
          amount: parseFloat(ec.amount),
          category: ec.category
        })));
      }

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  }

  const calculateTotals = () => {
    const extraTotal = extraCharges.reduce((sum, item) => sum + item.amount, 0);
    const subtotal = baseAmount + extraTotal;
    
    let discount = 0;
    if (discountType === 'percentage') {
      discount = (subtotal * discountValue) / 100;
    } else {
      discount = discountValue;
    }
    
    const afterDiscount = subtotal - discount;
    const tax = (afterDiscount * taxRate) / 100;
    const total = afterDiscount + tax;

    return {
      subtotal,
      discount,
      afterDiscount,
      tax,
      total
    };
  };

  async function handleGenerateInvoice() {
    if (baseAmount <= 0) {
      toast.error('Base amount must be greater than 0');
      return;
    }

    setProcessing(true);

    try {
      const totals = calculateTotals();

      const response = await fetch(`/api/billing/leads/${leadId}/generate-invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_amount: baseAmount,
          extra_charges: extraCharges,
          discount_type: discountType,
          discount_value: discountValue,
          discount_amount: totals.discount,
          tax_rate: taxRate,
          tax_amount: totals.tax,
          total_amount: totals.total,
          payment_terms: paymentTerms,
          notes: notes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to generate invoice');
        return;
      }

      toast.success(`Invoice generated successfully! Invoice #${data.invoiceNumber}`);
      router.push('/dashboard/billing');
    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to generate invoice');
    } finally {
      setProcessing(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="billing">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout role="billing">
        <div className="card text-center py-12">
          <p className="text-red-600 font-semibold">Lead not found</p>
        </div>
      </DashboardLayout>
    );
  }

  const totals = calculateTotals();

  return (
    <DashboardLayout role="billing">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="btn-secondary flex items-center gap-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </button>
          <button
            onClick={handleGenerateInvoice}
            disabled={processing || baseAmount <= 0}
            className="btn-primary flex items-center gap-2"
          >
            <FileText className="w-5 h-5" />
            {processing ? 'Generating...' : 'Generate Invoice'}
          </button>
        </div>

        {/* Lead Info Banner */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg">
          <h1 className="text-2xl font-bold mb-2">Generate Invoice</h1>
          <p className="text-lg">Lead: {lead.lead_number}</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Invoice Details */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer & Vehicle Info */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <User className="w-5 h-5 text-brand-primary" />
                Bill To
              </h3>
              <div className="space-y-2">
                <div>
                  <p className="text-sm text-gray-600">Customer Name</p>
                  <p className="font-semibold">{lead.customer_name}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Phone</p>
                  <p>{lead.customer_phone}</p>
                </div>
                {lead.customer_email && (
                  <div>
                    <p className="text-sm text-gray-600">Email</p>
                    <p>{lead.customer_email}</p>
                  </div>
                )}
                <div className="pt-2 border-t flex items-center gap-2">
                  <Car className="w-4 h-4 text-gray-500" />
                  <span className="font-semibold">{lead.vehicle_number}</span>
                </div>
              </div>
            </div>

            {/* Base Amount */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-brand-primary" />
                Base Service Charges
              </h3>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Base Amount (₹) <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={baseAmount}
                  onChange={(e) => setBaseAmount(parseFloat(e.target.value) || 0)}
                  className="input w-full"
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Extra Charges */}
            {extraCharges.length > 0 && (
              <div className="card">
                <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                  <Plus className="w-5 h-5 text-green-600" />
                  Approved Extra Charges
                </h3>
                <div className="space-y-2">
                  {extraCharges.map((item) => (
                    <div key={item.id} className="flex justify-between items-center p-3 bg-gray-50 rounded">
                      <div>
                        <p className="font-medium">{item.description}</p>
                        <p className="text-sm text-gray-600">{item.category}</p>
                      </div>
                      <p className="text-lg font-bold text-green-600">₹{item.amount.toFixed(2)}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Discount */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Percent className="w-5 h-5 text-orange-600" />
                Discount (Optional)
              </h3>
              <div className="space-y-4">
                <div className="flex gap-2">
                  <button
                    onClick={() => setDiscountType('percentage')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                      discountType === 'percentage'
                        ? 'bg-brand-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Percentage (%)
                  </button>
                  <button
                    onClick={() => setDiscountType('fixed')}
                    className={`flex-1 py-2 px-4 rounded-lg font-medium transition ${
                      discountType === 'fixed'
                        ? 'bg-brand-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    Fixed Amount (₹)
                  </button>
                </div>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(parseFloat(e.target.value) || 0)}
                  className="input w-full"
                  min="0"
                  step="0.01"
                  placeholder={discountType === 'percentage' ? '0%' : '₹0.00'}
                />
              </div>
            </div>

            {/* Tax */}
            <div className="card">
              <h3 className="text-lg font-semibold mb-4">Tax Rate (GST %)</h3>
              <input
                type="number"
                value={taxRate}
                onChange={(e) => setTaxRate(parseFloat(e.target.value) || 0)}
                className="input w-full"
                min="0"
                max="100"
                step="0.01"
              />
            </div>

            {/* Additional Info */}
            <div className="card space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Terms (Optional)
                </label>
                <input
                  type="text"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                  className="input w-full"
                  placeholder="e.g., Payment due within 30 days"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="input w-full"
                  rows={3}
                  placeholder="Additional notes for the invoice..."
                />
              </div>
            </div>
          </div>

          {/* Right Column - Invoice Summary */}
          <div className="lg:col-span-1">
            <div className="card sticky top-6">
              <h3 className="text-lg font-semibold mb-4 text-center">Invoice Summary</h3>
              
              <div className="space-y-3">
                <div className="flex justify-between pb-2">
                  <span className="text-gray-600">Base Amount:</span>
                  <span className="font-semibold">₹{baseAmount.toFixed(2)}</span>
                </div>

                {extraCharges.length > 0 && (
                  <div className="flex justify-between pb-2">
                    <span className="text-gray-600">Extra Charges:</span>
                    <span className="font-semibold text-green-600">
                      +₹{extraCharges.reduce((sum, item) => sum + item.amount, 0).toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between pb-3 border-b">
                  <span className="font-medium">Subtotal:</span>
                  <span className="font-bold">₹{totals.subtotal.toFixed(2)}</span>
                </div>

                {discountValue > 0 && (
                  <div className="flex justify-between pb-2">
                    <span className="text-gray-600">
                      Discount ({discountType === 'percentage' ? `${discountValue}%` : '₹'}):
                    </span>
                    <span className="font-semibold text-red-600">
                      -₹{totals.discount.toFixed(2)}
                    </span>
                  </div>
                )}

                <div className="flex justify-between pb-3 border-b">
                  <span className="font-medium">After Discount:</span>
                  <span className="font-bold">₹{totals.afterDiscount.toFixed(2)}</span>
                </div>

                <div className="flex justify-between pb-3 border-b">
                  <span className="text-gray-600">Tax (GST {taxRate}%):</span>
                  <span className="font-semibold">+₹{totals.tax.toFixed(2)}</span>
                </div>

                <div className="flex justify-between items-center py-4 bg-gradient-to-r from-brand-secondary/10 to-brand-primary/10 px-4 rounded-lg">
                  <span className="text-xl font-bold">Total Amount:</span>
                  <span className="text-2xl font-bold text-brand-primary">
                    ₹{totals.total.toFixed(2)}
                  </span>
                </div>
              </div>

              <button
                onClick={handleGenerateInvoice}
                disabled={processing || baseAmount <= 0}
                className="btn-primary w-full mt-6 flex items-center justify-center gap-2"
              >
                <Save className="w-5 h-5" />
                {processing ? 'Generating...' : 'Generate Invoice'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

