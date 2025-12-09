'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  Star, 
  Loader2,
  Eye
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function CSERatingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [ratings, setRatings] = useState<any[]>([]);

  useEffect(() => {
    fetchRatings();
  }, []);

  const fetchRatings = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Fetch completed leads without ratings
      const { data: leads, error } = await supabase
        .from('service_leads')
        .select(`
          *,
          workshop:workshops!workshop_id(name)
        `)
        .in('status', ['COMPLETED', 'DELIVERED', 'CLOSED'])
        .is('customer_satisfaction_score', null)
        .order('completed_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      setRatings(leads || []);
    } catch (error: any) {
      console.error('Error fetching ratings:', error);
      toast.error('Failed to load ratings');
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
            <Star className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
            <span>Customer Ratings Pending</span>
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Collect customer satisfaction ratings</p>
        </div>

        {/* Ratings List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-indigo-600" />
            </div>
          ) : ratings.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <Star className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-green-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-600 text-sm sm:text-base">No pending ratings</p>
              <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">All customers have provided ratings!</p>
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
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed Date</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Workshop</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {ratings.map((lead) => (
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
                            {lead.completed_at 
                              ? new Date(lead.completed_at).toLocaleDateString()
                              : 'N/A'}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm text-gray-900 truncate">{lead.workshop?.name || 'N/A'}</div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <Link
                            href={`/dashboard/cse/leads/${lead.id}`}
                            className="inline-flex items-center gap-1 px-2 sm:px-3 py-1 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700"
                          >
                            <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                            Collect Rating
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {ratings.map((lead) => (
                  <div key={lead.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <div className="text-sm font-medium text-gray-900 mb-1">{lead.lead_number}</div>
                        <div className="text-base font-semibold text-gray-900 truncate">{lead.customer_name}</div>
                        <div className="text-sm text-gray-500 truncate">{lead.customer_phone}</div>
                      </div>
                    </div>
                    <div className="space-y-1.5 text-xs sm:text-sm mb-3">
                      <div>
                        <span className="text-gray-500">Completed: </span>
                        <span className="text-gray-900">
                          {lead.completed_at 
                            ? new Date(lead.completed_at).toLocaleDateString()
                            : 'N/A'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Workshop: </span>
                        <span className="text-gray-900 truncate">{lead.workshop?.name || 'N/A'}</span>
                      </div>
                    </div>
                    <Link
                      href={`/dashboard/cse/leads/${lead.id}`}
                      className="inline-flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700"
                    >
                      <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      Collect Rating
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

