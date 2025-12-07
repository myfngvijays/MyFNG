'use client';

import { useState } from 'react';
import { DollarSign, CreditCard, Banknote, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';

interface RecordPaymentFormProps {
  invoice: any;
  onSuccess?: () => void;
}

export default function RecordPaymentForm({ invoice, onSuccess }: RecordPaymentFormProps) {
  const [formData, setFormData] = useState({
    payment_method: 'CASH',
    amount: invoice?.total_amount || 0,
    transaction_reference: '',
    payment_date: new Date().toISOString().split('T')[0],
    notes: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    setSubmitting(true);
    try {
      const response = await fetch('/api/payments/record-manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          invoice_id: invoice.id,
          ...formData,
          amount: parseFloat(formData.amount.toString())
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Payment recorded successfully!');
        onSuccess?.();
      } else {
        toast.error(data.error || 'Failed to record payment');
      }
    } catch (error) {
      toast.error('Error recording payment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-2xl font-bold mb-6">Record Manual Payment</h2>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Payment Method */}
        <div>
          <label className="block text-sm font-medium mb-3">Payment Method *</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'CASH', label: 'Cash', icon: Banknote },
              { value: 'CARD_POS', label: 'Card (POS)', icon: CreditCard },
              { value: 'UPI', label: 'UPI', icon: Smartphone },
              { value: 'BANK_TRANSFER', label: 'Bank Transfer', icon: DollarSign }
            ].map(method => (
              <label
                key={method.value}
                className={`flex items-center gap-3 p-4 border rounded-lg cursor-pointer transition ${
                  formData.payment_method === method.value
                    ? 'border-blue-600 bg-blue-50'
                    : 'hover:bg-gray-50'
                }`}
              >
                <input
                  type="radio"
                  name="payment_method"
                  value={method.value}
                  checked={formData.payment_method === method.value}
                  onChange={(e) => setFormData({...formData, payment_method: e.target.value})}
                  className="w-5 h-5"
                />
                <method.icon className="w-5 h-5" />
                <span className="font-medium">{method.label}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Amount */}
        <div>
          <label className="block text-sm font-medium mb-2">Amount *</label>
          <input
            type="number"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData({...formData, amount: parseFloat(e.target.value)})}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
          <p className="text-sm text-gray-600 mt-1">
            Invoice Total: ₹{parseFloat(invoice?.total_amount || 0).toLocaleString()}
          </p>
        </div>

        {/* Transaction Reference */}
        {formData.payment_method !== 'CASH' && (
          <div>
            <label className="block text-sm font-medium mb-2">
              Transaction Reference {formData.payment_method !== 'CASH' && '*'}
            </label>
            <input
              type="text"
              value={formData.transaction_reference}
              onChange={(e) => setFormData({...formData, transaction_reference: e.target.value})}
              className="w-full px-3 py-2 border rounded-lg"
              placeholder="Enter UPI ID, Card last 4 digits, or transfer reference"
              required={formData.payment_method !== 'CASH'}
            />
          </div>
        )}

        {/* Payment Date */}
        <div>
          <label className="block text-sm font-medium mb-2">Payment Date *</label>
          <input
            type="date"
            value={formData.payment_date}
            onChange={(e) => setFormData({...formData, payment_date: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg"
            required
          />
        </div>

        {/* Notes */}
        <div>
          <label className="block text-sm font-medium mb-2">Notes (Optional)</label>
          <textarea
            value={formData.notes}
            onChange={(e) => setFormData({...formData, notes: e.target.value})}
            className="w-full px-3 py-2 border rounded-lg h-24"
            placeholder="Any additional notes about this payment..."
          />
        </div>

        {/* Submit */}
        <div className="flex gap-3 justify-end pt-4 border-t">
          <button
            type="submit"
            disabled={submitting}
            className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium disabled:opacity-50"
          >
            {submitting ? 'Recording...' : 'Record Payment'}
          </button>
        </div>
      </form>
    </div>
  );
}

