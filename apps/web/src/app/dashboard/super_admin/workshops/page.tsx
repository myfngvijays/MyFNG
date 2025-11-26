'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Store, Search, Filter, CheckCircle, XCircle, AlertTriangle, Plus } from 'lucide-react';

export default function WorkshopManagementPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');

  useEffect(() => {
    fetchWorkshops();
  }, [filterStatus]);

  const fetchWorkshops = async () => {
    try {
      let query = supabase
        .from('workshops')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterStatus === 'active') {
        query = query.eq('is_verified', true);
      } else if (filterStatus === 'inactive') {
        query = query.eq('is_verified', false);
      }
      // Remove 'pending' filter as approval_status column doesn't exist

      const { data, error } = await query;
      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (workshopId: string) => {
    if (!confirm('Approve this workshop?')) return;
    
    try {
      const { error } = await supabase
        .from('workshops')
        .update({
          is_verified: true
        })
        .eq('id', workshopId);

      if (!error) {
        alert('Workshop approved successfully!');
        fetchWorkshops();
      }
    } catch (error) {
      alert('Failed to approve workshop');
    }
  };

  const handleDisable = async (workshopId: string) => {
    if (!confirm('Disable this workshop? Lead assignments will stop.')) return;
    
    try {
      const { error } = await supabase
        .from('workshops')
        .update({ is_verified: false })
        .eq('id', workshopId);

      if (!error) {
        alert('Workshop disabled successfully!');
        fetchWorkshops();
      }
    } catch (error) {
      alert('Failed to disable workshop');
    }
  };

  const handleEnable = async (workshopId: string) => {
    try {
      const { error } = await supabase
        .from('workshops')
        .update({ is_verified: true })
        .eq('id', workshopId);

      if (!error) {
        alert('Workshop enabled successfully!');
        fetchWorkshops();
      }
    } catch (error) {
      alert('Failed to enable workshop');
    }
  };

  const filteredWorkshops = workshops.filter((w) =>
    searchTerm === '' ||
    w.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.phone?.includes(searchTerm)
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading workshops...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Store className="w-6 h-6" />
                Workshop Management
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Manage workshops, approvals, and operations
              </p>
            </div>
            <button 
              onClick={() => router.push('/dashboard/super_admin/workshops/add')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Workshop
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name, city, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Status Filters */}
            <div className="flex gap-2">
              <button
                onClick={() => setFilterStatus('all')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === 'all'
                    ? 'bg-blue-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterStatus('active')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === 'active'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Active
              </button>
              <button
                onClick={() => setFilterStatus('inactive')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === 'inactive'
                    ? 'bg-red-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Inactive
              </button>
              <button
                onClick={() => setFilterStatus('pending')}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  filterStatus === 'pending'
                    ? 'bg-orange-600 text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending
              </button>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredWorkshops.length} workshop(s)
          </div>
        </div>

        {/* Workshops Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Workshop
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Location
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Stats
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredWorkshops.map((workshop) => (
                <tr key={workshop.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                    <div>
                      <div className="font-medium text-gray-900">{workshop.name}</div>
                      <div className="text-sm text-gray-500">{workshop.contact_person || 'N/A'}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm">
                      <div className="text-gray-900">{workshop.phone}</div>
                      <div className="text-gray-500">{workshop.email}</div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900">{workshop.city}</div>
                    <div className="text-sm text-gray-500">{workshop.state}</div>
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        workshop.is_verified
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {workshop.is_verified ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    <div>Jobs: {workshop.total_jobs || 0}</div>
                    <div>Rating: {workshop.rating || 'N/A'}⭐</div>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                    {!workshop.is_verified && (
                      <button
                        onClick={() => handleApprove(workshop.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Approve
                      </button>
                    )}
                    {workshop.is_verified ? (
                      <button
                        onClick={() => handleDisable(workshop.id)}
                        className="text-red-600 hover:text-red-900"
                      >
                        Disable
                      </button>
                    ) : (
                      <button
                        onClick={() => handleEnable(workshop.id)}
                        className="text-green-600 hover:text-green-900"
                      >
                        Enable
                      </button>
                    )}
                    <button className="text-blue-600 hover:text-blue-900">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {filteredWorkshops.length === 0 && (
            <div className="text-center py-12">
              <Store className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No workshops found</p>
              <p className="text-gray-400 text-sm mt-2">
                {searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your filters'}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
