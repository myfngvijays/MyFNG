'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import DashboardLayout from '@/components/DashboardLayout';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { 
  Search, Wrench, MapPin, Phone, Clock, 
  CheckCircle, XCircle, Star, TrendingUp 
} from 'lucide-react';

export default function RSAMechanicsPage() {
  const supabase = createClientComponentClient();
  const router = useRouter();
  
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [pincodeFilter, setPincodeFilter] = useState('');
  const [serviceTagFilter, setServiceTagFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'busy'>('all');

  useEffect(() => {
    fetchMechanics();
  }, [pincodeFilter, serviceTagFilter, availabilityFilter]);

  const fetchMechanics = async () => {
    setLoading(true);
    try {
      const mechanicsData = await RSAManagerService.searchMechanics({
        pincode: pincodeFilter || undefined,
        serviceTag: serviceTagFilter || undefined,
        searchTerm: searchTerm || undefined
      });
      
      // Apply availability filter
      let filtered = mechanicsData;
      if (availabilityFilter === 'available') {
        filtered = mechanicsData.filter(m => m.is_available);
      } else if (availabilityFilter === 'busy') {
        filtered = mechanicsData.filter(m => !m.is_available);
      }
      
      setMechanics(filtered);
    } catch (error) {
      console.error('Error fetching mechanics:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = () => {
    fetchMechanics();
  };

  return (
    <DashboardLayout role="rsa_manager">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-6 sm:mb-7 md:mb-8">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">Company Mechanics</h1>
          <p className="text-white/90 font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Search and manage RSA mechanics</p>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6 mb-4 sm:mb-5 md:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="relative sm:col-span-2 lg:col-span-1">
              <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder="Search by name, code, or number..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Filter by pincode..."
                value={pincodeFilter}
                onChange={(e) => setPincodeFilter(e.target.value)}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
            <div>
              <input
                type="text"
                placeholder="Filter by service tag..."
                value={serviceTagFilter}
                onChange={(e) => setServiceTagFilter(e.target.value)}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
            <div>
              <select
                value={availabilityFilter}
                onChange={(e) => setAvailabilityFilter(e.target.value as any)}
                className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option value="all">All Mechanics</option>
                <option value="available">Available Only</option>
                <option value="busy">Busy Only</option>
              </select>
            </div>
          </div>
            <button
            onClick={handleSearch}
            className="px-4 sm:px-6 py-1.5 sm:py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary-hover transition-colors text-xs sm:text-sm w-full sm:w-auto"
          >
            Search Mechanics
          </button>
        </div>

        {/* Mechanics List */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-4 sm:p-5 md:p-6">
            <h2 className="text-lg sm:text-xl font-bold text-gray-900 mb-3 sm:mb-4">
              Mechanics ({mechanics.length})
            </h2>
            
            {loading ? (
              <div className="text-center py-8 sm:py-10 md:py-12">
                <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary mx-auto"></div>
                <p className="mt-3 sm:mt-4 text-gray-600 text-sm sm:text-base">Loading mechanics...</p>
              </div>
            ) : mechanics.length === 0 ? (
              <div className="text-center py-8 sm:py-10 md:py-12">
                <Wrench className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">No mechanics found</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                {mechanics.map((mechanic) => (
                  <div
                    key={mechanic.id}
                    onClick={() => router.push(`/dashboard/rsa_manager/mechanics/${mechanic.id}`)}
                    className={`border rounded-lg p-3 sm:p-4 hover:shadow-md transition-all cursor-pointer ${
                      mechanic.is_available 
                        ? 'border-green-200 bg-green-50 hover:border-green-300' 
                        : 'border-red-200 bg-red-50 hover:border-red-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">
                          {mechanic.mechanic_name}
                        </h3>
                        <p className="text-xs sm:text-sm text-gray-600">Code: {mechanic.mechanic_code}</p>
                      </div>
                      {mechanic.is_available ? (
                        <div className="flex items-center gap-1 text-green-600 flex-shrink-0">
                          <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span className="text-[10px] sm:text-xs font-medium">Available</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1 text-red-600 flex-shrink-0">
                          <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                          <span className="text-[10px] sm:text-xs font-medium">Busy</span>
                        </div>
                      )}
                    </div>

                    <div className="space-y-1.5 sm:space-y-2 text-xs sm:text-sm">
                      <div className="flex items-center gap-1.5 sm:gap-2 text-gray-600">
                        <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                        <span className="truncate">{mechanic.number}</span>
                      </div>
                      
                      {mechanic.alternate_number1 && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-gray-600">
                          <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">Alt: {mechanic.alternate_number1}</span>
                        </div>
                      )}

                      {mechanic.service_tag && (
                        <div className="flex items-center gap-1.5 sm:gap-2">
                          <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                          <div className="flex flex-wrap gap-1">
                            <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded text-[10px] sm:text-xs">
                              {mechanic.service_tag}
                            </span>
                            {mechanic.service_tag2 && (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded text-[10px] sm:text-xs">
                                {mechanic.service_tag2}
                              </span>
                            )}
                            {mechanic.service_tag3 && (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-blue-100 text-blue-800 rounded text-[10px] sm:text-xs">
                                {mechanic.service_tag3}
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {mechanic.service_areas && mechanic.service_areas.length > 0 && (
                        <div className="flex items-start gap-1.5 sm:gap-2">
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex flex-wrap gap-1">
                            {mechanic.service_areas.slice(0, 3).map((area: string, idx: number) => (
                              <span key={idx} className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-700 rounded text-[10px] sm:text-xs">
                                {area}
                              </span>
                            ))}
                            {mechanic.service_areas.length > 3 && (
                              <span className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-700 rounded text-[10px] sm:text-xs">
                                +{mechanic.service_areas.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      )}

                      {mechanic.timing && (
                        <div className="flex items-center gap-1.5 sm:gap-2 text-gray-600">
                          <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="truncate">{mechanic.timing}</span>
                        </div>
                      )}

                      <div className="flex items-center justify-between pt-1.5 sm:pt-2 border-t border-gray-200">
                        <div className="flex items-center gap-1">
                          <Star className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-yellow-500 fill-yellow-500 flex-shrink-0" />
                          <span className="text-xs sm:text-sm font-medium">
                            {mechanic.rating || 0} / 5.0
                          </span>
                        </div>
                        <div className="flex items-center gap-1 text-gray-600">
                          <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                          <span className="text-xs sm:text-sm">
                            {mechanic.total_jobs_completed || 0} jobs
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

