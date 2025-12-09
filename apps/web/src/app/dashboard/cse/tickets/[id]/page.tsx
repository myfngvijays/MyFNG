'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  FileText, 
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle,
  User,
  Phone,
  Car,
  Building2
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function TicketDetailPage() {
  const router = useRouter();
  const params = useParams();
  const ticketId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [ticket, setTicket] = useState<any>(null);

  useEffect(() => {
    if (ticketId) {
      fetchTicketDetail();
    }
  }, [ticketId]);

  const fetchTicketDetail = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/cse/tickets/${ticketId}`);
      const data = await response.json();

      if (data.success) {
        setTicket(data.ticket);
      } else {
        toast.error(data.error || 'Failed to load ticket');
        router.push('/dashboard/cse/tickets');
      }
    } catch (error) {
      console.error('Error fetching ticket:', error);
      toast.error('Failed to load ticket');
      router.push('/dashboard/cse/tickets');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'OPEN': 'bg-red-100 text-red-800',
      'ACKNOWLEDGED': 'bg-yellow-100 text-yellow-800',
      'IN_PROGRESS': 'bg-blue-100 text-blue-800',
      'RESOLVED': 'bg-green-100 text-green-800',
      'CLOSED': 'bg-gray-100 text-gray-800',
      'ESCALATED': 'bg-orange-100 text-orange-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getSeverityColor = (severity: string) => {
    const colors: Record<string, string> = {
      'CRITICAL': 'bg-red-600 text-white',
      'URGENT': 'bg-orange-600 text-white',
      'HIGH': 'bg-yellow-600 text-white',
      'MEDIUM': 'bg-blue-600 text-white',
      'LOW': 'bg-gray-600 text-white',
    };
    return colors[severity] || 'bg-gray-100 text-gray-800';
  };

  if (loading) {
    return (
      <DashboardLayout role="customer_service_executive">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-indigo-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!ticket) {
    return (
      <DashboardLayout role="customer_service_executive">
        <div className="text-center py-8 sm:py-10 md:py-12">
          <p className="text-gray-600 text-sm sm:text-base">Ticket not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="customer_service_executive">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
              <FileText className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
              <span className="truncate">Ticket: {ticket.ticket_number}</span>
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Support Ticket Details</p>
          </div>
          <Link
            href="/dashboard/cse/tickets"
            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 text-gray-700 text-xs sm:text-sm rounded-lg hover:bg-gray-300 w-full sm:w-auto text-center"
          >
            Back to Tickets
          </Link>
        </div>

        {/* Status Badge */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 sm:gap-3">
              <span className={`inline-flex px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold rounded-full ${getStatusColor(ticket.status)}`}>
                {ticket.status}
              </span>
              <span className={`inline-flex px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold rounded-full ${getSeverityColor(ticket.severity)}`}>
                {ticket.severity}
              </span>
            </div>
            <div className="text-xs sm:text-sm text-gray-600">
              Created: {new Date(ticket.created_at).toLocaleString()}
            </div>
          </div>
        </div>

        {/* Ticket Details */}
        <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow space-y-4 sm:space-y-5 md:space-y-6">
          {/* Lead Info */}
          {ticket.lead && (
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Related Lead</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Lead Number</label>
                  <div className="text-sm sm:text-base md:text-lg font-semibold">{ticket.lead.lead_number}</div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    Customer
                  </label>
                  <div className="text-sm sm:text-base md:text-lg">{ticket.lead.customer_name}</div>
                  <div className="text-xs sm:text-sm text-gray-500">{ticket.lead.customer_phone}</div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                    <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    Vehicle
                  </label>
                  <div className="text-sm sm:text-base md:text-lg">{ticket.lead.vehicle_number || 'N/A'}</div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                    <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    Workshop
                  </label>
                  <div className="text-sm sm:text-base md:text-lg">{ticket.lead.workshop?.name || 'N/A'}</div>
                </div>
              </div>
              <div className="mt-3 sm:mt-4">
                <Link
                  href={`/dashboard/cse/leads/${ticket.lead.id}`}
                  className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700"
                >
                  View Lead Details
                </Link>
              </div>
            </div>
          )}

          {/* Issue Details */}
          <div>
            <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Issue Details</h3>
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Category</label>
                <div className="text-sm sm:text-base md:text-lg">{ticket.issue_category?.replace(/_/g, ' ')}</div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Title</label>
                <div className="text-sm sm:text-base md:text-lg font-semibold">{ticket.title}</div>
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Description</label>
                <div className="bg-gray-50 p-3 sm:p-4 rounded-lg whitespace-pre-wrap text-xs sm:text-sm">{ticket.description}</div>
              </div>
              {ticket.customer_expected_resolution && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Customer Expected Resolution</label>
                  <div className="bg-blue-50 p-3 sm:p-4 rounded-lg border-l-4 border-blue-500 whitespace-pre-wrap text-xs sm:text-sm">
                    {ticket.customer_expected_resolution}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Resolution */}
          {ticket.status === 'RESOLVED' || ticket.status === 'CLOSED' ? (
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Resolution</h3>
              <div className="space-y-3 sm:space-y-4">
                {ticket.resolution_notes && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Resolution Notes</label>
                    <div className="bg-green-50 p-3 sm:p-4 rounded-lg border-l-4 border-green-500 whitespace-pre-wrap text-xs sm:text-sm">
                      {ticket.resolution_notes}
                    </div>
                  </div>
                )}
                {ticket.resolution_action_taken && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Action Taken</label>
                    <div className="bg-gray-50 p-3 sm:p-4 rounded-lg whitespace-pre-wrap text-xs sm:text-sm">
                      {ticket.resolution_action_taken}
                    </div>
                  </div>
                )}
                {ticket.resolved_at && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Resolved At</label>
                    <div className="text-sm sm:text-base md:text-lg">{new Date(ticket.resolved_at).toLocaleString()}</div>
                  </div>
                )}
                {ticket.resolved_by_user && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Resolved By</label>
                    <div className="text-sm sm:text-base md:text-lg">{ticket.resolved_by_user.full_name}</div>
                  </div>
                )}
              </div>
            </div>
          ) : null}

          {/* Escalation */}
          {ticket.escalated && (
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                <AlertTriangle className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" />
                <span>Escalation</span>
              </h3>
              <div className="bg-orange-50 p-3 sm:p-4 rounded-lg border-l-4 border-orange-500 space-y-2">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Escalation Level</label>
                  <div className="text-sm sm:text-base md:text-lg font-semibold">{ticket.escalation_level || 'N/A'}</div>
                </div>
                {ticket.escalation_reason && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Reason</label>
                    <div className="text-sm sm:text-base md:text-lg">{ticket.escalation_reason}</div>
                  </div>
                )}
                {ticket.escalated_at && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Escalated At</label>
                    <div className="text-sm sm:text-base md:text-lg">{new Date(ticket.escalated_at).toLocaleString()}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Internal Notes */}
          {ticket.internal_notes && (
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4">Internal Notes</h3>
              <div className="bg-yellow-50 p-3 sm:p-4 rounded-lg border-l-4 border-yellow-500 whitespace-pre-wrap text-xs sm:text-sm">
                {ticket.internal_notes}
              </div>
            </div>
          )}

          {/* SLA Info */}
          {ticket.sla_time && (
            <div>
              <h3 className="text-base sm:text-lg font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
                <Clock className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
                <span>SLA Information</span>
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">SLA Deadline</label>
                  <div className="text-sm sm:text-base md:text-lg">{new Date(ticket.sla_time).toLocaleString()}</div>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">SLA Status</label>
                  <span className={`inline-flex px-2 sm:px-3 py-0.5 sm:py-1 text-xs sm:text-sm font-semibold rounded-full ${
                    ticket.sla_status === 'BREACHED' ? 'bg-red-100 text-red-800' :
                    ticket.sla_status === 'AT_RISK' ? 'bg-yellow-100 text-yellow-800' :
                    'bg-green-100 text-green-800'
                  }`}>
                    {ticket.sla_status}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

