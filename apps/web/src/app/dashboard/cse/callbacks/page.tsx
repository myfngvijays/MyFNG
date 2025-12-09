'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  Clock, 
  Phone,
  Loader2,
  CheckCircle,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function CSECallbacksPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [callbacks, setCallbacks] = useState<any[]>([]);

  useEffect(() => {
    fetchCallbacks();
  }, []);

  const fetchCallbacks = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch leads with follow_up_required
      const { data: leads, error } = await supabase
        .from('service_leads')
        .select(`
          *,
          workshop:workshops!workshop_id(name, phone)
        `)
        .eq('follow_up_required', true)
        .is('closed_at', null)
        .order('next_follow_up_at', { ascending: true })
        .order('created_at', { ascending: false });

      if (error) throw error;

      setCallbacks(leads || []);
    } catch (error: any) {
      console.error('Error fetching callbacks:', error);
      toast.error('Failed to load callbacks');
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout role="customer_service_executive">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
            <Clock className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
            <span>Pending Callbacks</span>
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Leads requiring follow-up calls</p>
        </div>

        {/* Callbacks List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-indigo-600" />
            </div>
          ) : callbacks.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <CheckCircle className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-green-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-600 text-sm sm:text-base">No pending callbacks</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">All follow-ups are complete!</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead #</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Next Follow-up</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {callbacks.map((lead) => (
                      <tr key={lead.id} className="hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{lead.lead_number}</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{lead.customer_name}</div>
                          <div className="text-xs sm:text-sm text-gray-500">{lead.customer_phone}</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <div className="text-xs sm:text-sm text-gray-900">
                            {lead.next_follow_up_at 
                              ? new Date(lead.next_follow_up_at).toLocaleString()
                              : 'Not scheduled'}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${
                            lead.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                            lead.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {lead.status}
                          </span>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <Link
                            href={`/dashboard/cse/leads/${lead.id}`}
                            className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700"
                          >
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {callbacks.map((lead) => (
                  <div key={lead.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 mb-1">{lead.lead_number}</div>
                        <div className="text-base font-semibold text-gray-900 truncate">{lead.customer_name}</div>
                        <div className="text-sm text-gray-500 truncate">{lead.customer_phone}</div>
                      </div>
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full flex-shrink-0 ${
                        lead.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                        lead.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {lead.status}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs sm:text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Next Follow-up: </span>
                        <span className="text-gray-900">
                          {lead.next_follow_up_at 
                            ? new Date(lead.next_follow_up_at).toLocaleString()
                            : 'Not scheduled'}
                        </span>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/cse/leads/${lead.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700"
                    >
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      View Details
                    </Link>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

