'use client';

import { useState, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Building, Search, MapPin, Phone, Mail, Star, 
  CheckCircle, XCircle, Edit, Eye, Filter, Loader2,
  TrendingUp, AlertCircle, Users
} from 'lucide-react';
import Link from 'next/link';
import { toast } from 'react-hot-toast';

export default function WorkshopsPage() {
  const supabase = getBrowserClient();
  
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [cityFilter, setCityFilter] = useState('all');
  const [verificationFilter, setVerificationFilter] = useState<'all' | 'verified' | 'unverified'>('all');
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    unverified: 0,
    active_jobs: 0
  });

  useEffect(() => {
    fetchWorkshops();
  }, [verificationFilter]);

  const fetchWorkshops = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('workshops')
        .select(`
          *,
          active_leads:service_leads(count)
        `, { count: 'exact' })
        .order('created_at', { ascending: false });

      // Apply verification filter
      if (verificationFilter === 'verified') {
        query = query.eq('is_verified', true);
      } else if (verificationFilter === 'unverified') {
        query = query.eq('is_verified', false);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setWorkshops(data || []);

      // Calculate stats
      const { count: totalCount } = await supabase
        .from('workshops')
        .select('*', { count: 'exact', head: true });

      const { count: verifiedCount } = await supabase
        .from('workshops')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', true);

      const { count: unverifiedCount } = await supabase
        .from('workshops')
        .select('*', { count: 'exact', head: true })
        .eq('is_verified', false);

      const { count: activeJobsCount } = await supabase
        .from('service_leads')
        .select('*', { count: 'exact', head: true })
        .filter('workshop_id', 'not.is', null)
        .in('status', ['ACCEPTED', 'IN_PROGRESS', 'TEAM_ASSIGNED']);

      setStats({
        total: totalCount || 0,
        verified: verifiedCount || 0,
        unverified: unverifiedCount || 0,
        active_jobs: activeJobsCount || 0
      });

    } catch (error) {
      console.error('Error fetching workshops:', error);
      toast.error('Failed to load workshops');
    } finally {
      setLoading(false);
    }
  };

  const filteredWorkshops = workshops.filter(workshop => {
    const matchesSearch = 
      workshop.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workshop.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workshop.contact_person?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workshop.phone?.includes(searchTerm);

    const matchesCity = cityFilter === 'all' || workshop.city === cityFilter;

    return matchesSearch && matchesCity;
  });

  // Get unique cities for filter
  const cities = Array.from(new Set(workshops.map(w => w.city).filter(Boolean)));

  return (
    <DashboardLayout role="lead_manager">
      <div className="w-full max-w-7xl mx-auto min-w-0">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-2xl shadow-lg mb-6 sm:mb-8">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">🏢 Workshop Management</h1>
          <p className="text-white font-medium mt-1">Partner Network • Quality Control • Assignment Ready</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Total Workshops</p>
                <p className="text-3xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <div className="bg-blue-100 p-3 rounded-full">
                <Building className="w-6 h-6 text-blue-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Verified</p>
                <p className="text-3xl font-bold text-green-600">{stats.verified}</p>
              </div>
              <div className="bg-green-100 p-3 rounded-full">
                <CheckCircle className="w-6 h-6 text-green-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Unverified</p>
                <p className="text-3xl font-bold text-yellow-600">{stats.unverified}</p>
              </div>
              <div className="bg-yellow-100 p-3 rounded-full">
                <AlertCircle className="w-6 h-6 text-yellow-600" />
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">Active Jobs</p>
                <p className="text-3xl font-bold text-purple-600">{stats.active_jobs}</p>
              </div>
              <div className="bg-purple-100 p-3 rounded-full">
                <TrendingUp className="w-6 h-6 text-purple-600" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters and Search */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <div className="flex flex-col lg:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
              <input
                type="text"
                placeholder="Search by name, city, contact person, phone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            {/* City Filter */}
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
            >
              <option value="all">All Cities</option>
              {cities.map(city => (
                <option key={city} value={city}>{city}</option>
              ))}
            </select>

            {/* Verification Filter */}
            <div className="flex gap-2">
              <button
                onClick={() => setVerificationFilter('all')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  verificationFilter === 'all'
                    ? 'bg-brand-primary text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                All ({stats.total})
              </button>
              <button
                onClick={() => setVerificationFilter('verified')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  verificationFilter === 'verified'
                    ? 'bg-green-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Verified ({stats.verified})
              </button>
              <button
                onClick={() => setVerificationFilter('unverified')}
                className={`px-4 py-2 rounded-lg font-medium transition ${
                  verificationFilter === 'unverified'
                    ? 'bg-yellow-600 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                Unverified ({stats.unverified})
              </button>
            </div>
          </div>
        </div>

        {/* Workshops Grid */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <Loader2 className="w-12 h-12 animate-spin text-brand-primary mx-auto" />
              <p className="mt-4 text-gray-600">Loading workshops...</p>
            </div>
          ) : filteredWorkshops.length === 0 ? (
            <div className="p-12 text-center">
              <Building className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <p className="text-xl text-gray-600">No workshops found</p>
              <p className="text-gray-500 mt-2">
                {searchTerm ? 'Try adjusting your search' : 'No workshops available'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 p-6">
              {filteredWorkshops.map((workshop) => (
                <div
                  key={workshop.id}
                  className="bg-white border border-gray-200 rounded-lg hover:shadow-lg transition p-6"
                >
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                      <h3 className="text-lg font-bold text-gray-900 mb-1">
                        {workshop.name}
                      </h3>
                      <div className="flex items-center gap-2">
                        {workshop.is_verified ? (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 text-xs font-semibold rounded-full">
                            <CheckCircle className="w-3 h-3" />
                            Verified
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-semibold rounded-full">
                            <AlertCircle className="w-3 h-3" />
                            Unverified
                          </span>
                        )}
                      </div>
                    </div>
                    {workshop.audit_score && (
                      <div className="flex items-center gap-1 bg-yellow-50 px-2 py-1 rounded">
                        <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                        <span className="text-sm font-semibold text-yellow-700">
                          {parseFloat(workshop.audit_score).toFixed(1)}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Details */}
                  <div className="space-y-2 mb-4">
                    <div className="flex items-start gap-2 text-sm text-gray-600">
                      <MapPin className="w-4 h-4 mt-0.5 flex-shrink-0" />
                      <span className="line-clamp-2">
                        {workshop.address}, {workshop.city}, {workshop.state} - {workshop.pincode}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Users className="w-4 h-4 flex-shrink-0" />
                      <span>{workshop.contact_person}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Phone className="w-4 h-4 flex-shrink-0" />
                      <a href={`tel:${workshop.phone}`} className="hover:text-brand-primary">
                        {workshop.phone}
                      </a>
                    </div>
                    {workshop.email && (
                      <div className="flex items-center gap-2 text-sm text-gray-600">
                        <Mail className="w-4 h-4 flex-shrink-0" />
                        <a href={`mailto:${workshop.email}`} className="hover:text-brand-primary truncate">
                          {workshop.email}
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Active Jobs Badge */}
                  <div className="pt-4 border-t border-gray-100">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">Active Jobs:</span>
                      <span className="font-semibold text-brand-primary">
                        {workshop.active_leads?.[0]?.count || 0}
                      </span>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="mt-4 pt-4 border-t border-gray-100 flex gap-2">
                    <Link
                      href={`/dashboard/lead_manager/workshops/${workshop.id}`}
                      className="flex-1 btn-outline text-sm py-2 text-center inline-flex items-center justify-center"
                    >
                      <Eye className="w-4 h-4 mr-1" />
                      View Details
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

