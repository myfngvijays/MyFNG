'use client';

export const dynamic = 'force-dynamic';

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  FileText, 
  Loader2,
  Save,
  X,
  AlertTriangle
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

function CreateTicketContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const leadId = searchParams.get('lead_id');

  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    lead_id: leadId || '',
    issue_category: 'OTHER',
    severity: 'MEDIUM',
    title: '',
    description: '',
    customer_expected_resolution: '',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.lead_id || !formData.title || !formData.description) {
      toast.error('Please fill all required fields');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/cse/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();
      if (data.success) {
        toast.success('Ticket created successfully!');
        router.push(`/dashboard/cse/tickets/${data.ticket.id}`);
      } else {
        toast.error(data.error || 'Failed to create ticket');
      }
    } catch (error) {
      console.error('Error creating ticket:', error);
      toast.error('Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="customer_service_executive">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
              <FileText className="w-8 h-8 text-indigo-600" />
              Create Support Ticket
            </h1>
            <p className="text-gray-600 mt-1">Create a new customer support ticket</p>
          </div>
          <Link
            href="/dashboard/cse/tickets"
            className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
          >
            <X className="w-5 h-5" />
            Cancel
          </Link>
        </div>

        {/* Form */}
        <div className="bg-white p-6 rounded-lg shadow">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Lead ID <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.lead_id}
                onChange={(e) => setFormData({ ...formData, lead_id: e.target.value })}
                placeholder="Enter Lead ID"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Issue Category <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.issue_category}
                onChange={(e) => setFormData({ ...formData, issue_category: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="PICKUP_DELAY">Pickup Delay</option>
                <option value="DROP_DELAY">Drop Delay</option>
                <option value="JOB_PROGRESS_INQUIRY">Job Progress Inquiry</option>
                <option value="EXTRA_CHARGES_DISPUTE">Extra Charges Dispute</option>
                <option value="INVOICE_BILLING_ISSUE">Invoice/Billing Issue</option>
                <option value="WORKSHOP_MISCOMMUNICATION">Workshop Miscommunication</option>
                <option value="SERVICE_QUALITY_COMPLAINT">Service Quality Complaint</option>
                <option value="WRONG_WORK_DONE">Wrong Work Done</option>
                <option value="CANCELLATION_REQUEST">Cancellation Request</option>
                <option value="RESCHEDULE_REQUEST">Reschedule Request</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Severity <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.severity}
                onChange={(e) => setFormData({ ...formData, severity: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              >
                <option value="LOW">Low</option>
                <option value="MEDIUM">Medium</option>
                <option value="HIGH">High</option>
                <option value="URGENT">Urgent</option>
                <option value="CRITICAL">Critical</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Brief title for the ticket"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Description <span className="text-red-500">*</span>
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                rows={6}
                placeholder="Detailed description of the issue..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Customer Expected Resolution
              </label>
              <textarea
                value={formData.customer_expected_resolution}
                onChange={(e) => setFormData({ ...formData, customer_expected_resolution: e.target.value })}
                rows={3}
                placeholder="What does the customer expect as resolution?"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="flex gap-3">
              <button
                type="submit"
                disabled={loading}
                className="flex items-center gap-2 px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Save className="w-5 h-5" />
                )}
                Create Ticket
              </button>
              <Link
                href="/dashboard/cse/tickets"
                className="flex items-center gap-2 px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </div>
    </DashboardLayout>
  );
}

export default function CreateTicketPage() {
  return (
    <Suspense fallback={
      <DashboardLayout role="CUSTOMER_SERVICE_EXECUTIVE">
        <div className="flex items-center justify-center min-h-screen">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    }>
      <CreateTicketContent />
    </Suspense>
  );
}
