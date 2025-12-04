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
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-3">
            <Star className="w-8 h-8 text-indigo-600" />
            Customer Ratings Pending
          </h1>
          <p className="text-gray-600 mt-1">Collect customer satisfaction ratings</p>
        </div>

        {/* Ratings List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            </div>
          ) : ratings.length === 0 ? (
            <div className="text-center py-12">
              <Star className="w-12 h-12 text-green-400 mx-auto mb-4" />
              <p className="text-gray-600">No pending ratings</p>
              <p className="text-sm text-gray-500 mt-2">All customers have provided ratings!</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lead #</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Completed Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Workshop</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {ratings.map((lead) => (
                    <tr key={lead.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{lead.lead_number}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm font-medium text-gray-900">{lead.customer_name}</div>
                        <div className="text-sm text-gray-500">{lead.customer_phone}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {lead.completed_at 
                            ? new Date(lead.completed_at).toLocaleDateString()
                            : 'N/A'}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{lead.workshop?.name || 'N/A'}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <Link
                          href={`/dashboard/cse/leads/${lead.id}`}
                          className="inline-flex items-center gap-1 px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700"
                        >
                          <Eye className="w-4 h-4" />
                          Collect Rating
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

