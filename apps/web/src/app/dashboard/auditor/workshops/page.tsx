'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY } from "@/lib/utils";
import { 
  Building2, 
  Search,
  MapPin,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Loader2,
  Filter,
  Star
} from 'lucide-react';
import toast from 'react-hot-toast';

export default function AuditorWorkshopsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [cities, setCities] = useState<string[]>([]);
  const [stats, setStats] = useState({
    total: 0,
    compliant: 0,
    at_risk: 0,
    non_compliant: 0,
  });
  const [filters, setFilters] = useState({
    search: '',
    city: '',
    min_score: '',
    sort_by: 'audit_score',
  });

  useEffect(() => {
    fetchWorkshops();
  }, [filters]);

  const fetchWorkshops = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      // Build query params
      const params = new URLSearchParams();
      if (filters.search) {
        params.append('search', filters.search);
      }
      if (filters.city) {
        params.append('city', filters.city);
      }
      if (filters.min_score) {
        params.append('min_score', filters.min_score);
      }
      if (filters.sort_by) {
        params.append('sort_by', filters.sort_by);
      }

      const response = await fetch(`/api/auditor/workshops?${params.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch workshops');
      }

      const data = await response.json();
      setWorkshops(data.workshops || []);
      setCities(data.cities || []);
      setStats(data.stats || {
        total: 0,
        compliant: 0,
        at_risk: 0,
        non_compliant: 0,
      });
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching workshops:', error);
      toast.error('Failed to load workshops');
      setLoading(false);
    }
  };

  const getComplianceColor = (status: string) => {
    const colors: Record<string, string> = {
      'COMPLIANT': 'bg-green-100 text-green-800',
      'AT_RISK': 'bg-yellow-100 text-yellow-800',
      'NON_COMPLIANT': 'bg-red-100 text-red-800',
    };
    return colors[status] || 'bg-gray-100 text-gray-800';
  };

  const getScoreColor = (score: number) => {
    if (score >= 4) return 'text-green-600';
    if (score >= 3) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <DashboardLayout role="auditor">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
            <Building2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
            <span>Workshops</span>
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">View workshop compliance status and audit scores</p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-indigo-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Total Workshops</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Building2 className="w-7 h-7 sm:w-8 sm:h-8 text-indigo-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-green-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Compliant</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.compliant}</p>
              </div>
              <CheckCircle className="w-7 h-7 sm:w-8 sm:h-8 text-green-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-yellow-500">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">At Risk</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.at_risk}</p>
              </div>
              <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-yellow-500 flex-shrink-0" />
            </div>
          </div>
          <div className="bg-white p-3 sm:p-4 rounded-lg shadow border-l-4 border-red-500 sm:col-span-2 lg:col-span-1">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm text-gray-600">Non-Compliant</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900">{stats.non_compliant}</p>
              </div>
              <AlertTriangle className="w-7 h-7 sm:w-8 sm:h-8 text-red-500 flex-shrink-0" />
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-3 sm:p-4 rounded-lg shadow">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
                <input
                  type="text"
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  placeholder="Search workshops..."
                  className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">City</label>
              <select
                value={filters.city}
                onChange={(e) => setFilters({ ...filters, city: e.target.value })}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">All Cities</option>
                {cities.map((city) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Min Score</label>
              <input
                type="number"
                min="0"
                max="5"
                step="0.1"
                value={filters.min_score}
                onChange={(e) => setFilters({ ...filters, min_score: e.target.value })}
                placeholder="0.0"
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Sort By</label>
              <select
                value={filters.sort_by}
                onChange={(e) => setFilters({ ...filters, sort_by: e.target.value })}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="audit_score">Audit Score</option>
                <option value="name">Name</option>
                <option value="last_audit_date">Last Audit Date</option>
              </select>
            </div>
          </div>
        </div>

        {/* Workshops List */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <div className="p-3 sm:p-4 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold">Workshop List</h2>
          </div>

          {loading ? (
            <div className="flex items-center justify-center h-48 sm:h-64">
              <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-indigo-600" />
            </div>
          ) : workshops.length === 0 ? (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <Building2 className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-600 text-sm sm:text-base">No workshops found</p>
            </div>
          ) : (
            <>
              {/* Desktop Table */}
              <div className="hidden lg:block overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Workshop</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Audit Score</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Grade</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Last Audit</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Audits</th>
                      <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {workshops.map((workshop) => (
                      <tr key={workshop.id} className="hover:bg-gray-50">
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{workshop.name}</div>
                          {workshop.phone && (
                            <div className="text-xs sm:text-sm text-gray-500">{workshop.phone}</div>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-600">
                            <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            {workshop.city}
                          </div>
                          {workshop.address && (
                            <div className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">{workshop.address}</div>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className={`text-base sm:text-lg font-bold ${getScoreColor(workshop.audit_score)}`}>
                            {workshop.audit_score.toFixed(1)}/5.0
                          </div>
                          <div className="flex items-center gap-0.5 sm:gap-1 mt-0.5 sm:mt-1">
                            {[...Array(5)].map((_, i) => (
                              <Star
                                key={i}
                                className={`w-2.5 h-2.5 sm:w-3 sm:h-3 ${
                                  i < Math.round(workshop.audit_score)
                                    ? 'fill-yellow-400 text-yellow-400'
                                    : 'text-gray-300'
                                }`}
                              />
                            ))}
                          </div>
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {workshop.audit_grade ? (
                            <span className="inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full bg-indigo-100 text-indigo-800">
                              {workshop.audit_grade}
                            </span>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-500">-</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          {workshop.last_audit_date ? (
                            <div className="text-xs sm:text-sm text-gray-900">
                              {formatDateDMY(workshop.last_audit_date)}
                            </div>
                          ) : (
                            <span className="text-xs sm:text-sm text-gray-500">Never</span>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4">
                          <div className="text-xs sm:text-sm font-medium text-gray-900">{workshop.total_audits}</div>
                          {workshop.open_action_items > 0 && (
                            <div className="text-[10px] sm:text-xs text-red-600 mt-0.5 sm:mt-1">
                              {workshop.open_action_items} open items
                            </div>
                          )}
                        </td>
                        <td className="px-4 md:px-6 py-3 md:py-4 whitespace-nowrap">
                          <span className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${getComplianceColor(workshop.compliance_status)}`}>
                            {workshop.compliance_status.replace('_', ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Cards */}
              <div className="lg:hidden divide-y divide-gray-200">
                {workshops.map((workshop) => (
                  <div key={workshop.id} className="p-4 hover:bg-gray-50 transition">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm sm:text-base font-medium text-gray-900 truncate">{workshop.name}</h3>
                        {workshop.phone && (
                          <p className="text-xs text-gray-500 mt-0.5">{workshop.phone}</p>
                        )}
                      </div>
                      <span className={`inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full flex-shrink-0 ${getComplianceColor(workshop.compliance_status)}`}>
                        {workshop.compliance_status.replace('_', ' ')}
                      </span>
                    </div>
                    <div className="space-y-1.5 text-xs sm:text-sm mb-3">
                      <div className="flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                        <span className="text-gray-600">{workshop.city}</span>
                        {workshop.address && (
                          <span className="text-gray-500 truncate">, {workshop.address}</span>
                        )}
                      </div>
                      <div>
                        <span className="text-gray-500">Score: </span>
                        <span className={`font-bold ${getScoreColor(workshop.audit_score)}`}>
                          {workshop.audit_score.toFixed(1)}/5.0
                        </span>
                        <div className="flex items-center gap-0.5 mt-0.5">
                          {[...Array(5)].map((_, i) => (
                            <Star
                              key={i}
                              className={`w-2.5 h-2.5 ${
                                i < Math.round(workshop.audit_score)
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {workshop.audit_grade && (
                        <div>
                          <span className="text-gray-500">Grade: </span>
                          <span className="inline-flex px-2 py-0.5 text-[10px] font-semibold rounded-full bg-indigo-100 text-indigo-800">
                            {workshop.audit_grade}
                          </span>
                        </div>
                      )}
                      <div>
                        <span className="text-gray-500">Last Audit: </span>
                        <span className="text-gray-900">
                          {workshop.last_audit_date
                            ? formatDateDMY(workshop.last_audit_date)
                            : 'Never'}
                        </span>
                      </div>
                      <div>
                        <span className="text-gray-500">Total Audits: </span>
                        <span className="font-medium text-gray-900">{workshop.total_audits}</span>
                        {workshop.open_action_items > 0 && (
                          <span className="text-red-600 ml-1">({workshop.open_action_items} open items)</span>
                        )}
                      </div>
                    </div>
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

