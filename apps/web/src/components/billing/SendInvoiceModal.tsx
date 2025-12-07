'use client';

import { useState } from 'react';
import { Mail, MessageSquare, Share2, CheckCircle, X } from 'lucide-react';
import toast from 'react-hot-toast';

interface SendInvoiceModalProps {
  invoice: any;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export default function SendInvoiceModal({ invoice, isOpen, onClose, onSuccess }: SendInvoiceModalProps) {
  const [channels, setChannels] = useState<string[]>(['email']);
  const [customMessage, setCustomMessage] = useState('');
  const [sending, setSending] = useState(false);

  if (!isOpen) return null;

  const handleSend = async () => {
    if (channels.length === 0) {
      toast.error('Select at least one channel');
      return;
    }

    setSending(true);
    try {
      const response = await fetch(`/api/invoices/${invoice.id}/share`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channels,
          custom_message: customMessage || undefined
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success('Invoice sent successfully!');
        onSuccess?.();
        onClose();
      } else {
        toast.error(data.error || 'Failed to send invoice');
      }
    } catch (error) {
      toast.error('Error sending invoice');
    } finally {
      setSending(false);
    }
  };

  const toggleChannel = (channel: string) => {
    setChannels(prev =>
      prev.includes(channel)
        ? prev.filter(c => c !== channel)
        : [...prev, channel]
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full">
        <div className="p-6 border-b flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Send Invoice</h2>
            <p className="text-gray-600 mt-1">{invoice?.invoice_number}</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Channel Selection */}
          <div>
            <label className="block text-sm font-medium mb-3">Send Via</label>
            <div className="space-y-3">
              <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={channels.includes('email')}
                  onChange={() => toggleChannel('email')}
                  className="w-5 h-5"
                />
                <Mail className="w-5 h-5 text-blue-600" />
                <div className="flex-1">
                  <p className="font-medium">Email</p>
                  <p className="text-sm text-gray-600">{invoice?.lead?.customer_email || 'Not available'}</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={channels.includes('sms')}
                  onChange={() => toggleChannel('sms')}
                  className="w-5 h-5"
                />
                <MessageSquare className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium">SMS</p>
                  <p className="text-sm text-gray-600">{invoice?.lead?.customer_phone || 'Not available'}</p>
                </div>
              </label>

              <label className="flex items-center gap-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                <input
                  type="checkbox"
                  checked={channels.includes('whatsapp')}
                  onChange={() => toggleChannel('whatsapp')}
                  className="w-5 h-5"
                />
                <Share2 className="w-5 h-5 text-green-600" />
                <div className="flex-1">
                  <p className="font-medium">WhatsApp</p>
                  <p className="text-sm text-gray-600">{invoice?.lead?.customer_phone || 'Not available'}</p>
                </div>
              </label>
            </div>
          </div>

          {/* Custom Message */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Custom Message (Optional)
            </label>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full px-3 py-2 border rounded-lg h-24"
              placeholder="Add a personalized message for the customer..."
            />
          </div>

          {/* Invoice Summary */}
          <div className="p-4 bg-gray-50 rounded-lg">
            <h3 className="font-medium mb-2">Invoice Summary</h3>
            <div className="space-y-1 text-sm">
              <p className="flex justify-between">
                <span className="text-gray-600">Lead:</span>
                <span className="font-medium">{invoice?.lead?.lead_number}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-gray-600">Customer:</span>
                <span className="font-medium">{invoice?.lead?.customer_name}</span>
              </p>
              <p className="flex justify-between">
                <span className="text-gray-600">Amount:</span>
                <span className="font-bold text-green-600">₹{parseFloat(invoice?.total_amount || 0).toLocaleString()}</span>
              </p>
            </div>
          </div>
        </div>

        <div className="p-6 border-t flex gap-3 justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 border rounded-lg hover:bg-gray-50"
            disabled={sending}
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={sending || channels.length === 0}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg flex items-center gap-2 disabled:opacity-50"
          >
            {sending ? (
              <>
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <CheckCircle className="w-5 h-5" />
                Send Invoice
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

