'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { 
  Phone, 
  Search,
  Loader2,
  User,
  Car,
  Building2,
  Clock,
  MapPin,
  Wrench,
  FileText,
  Eye,
  MessageSquare,
  AlertTriangle,
  Truck
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function CSECallPanelPage() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [searching, setSearching] = useState(false);
  const [results, setResults] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  const handleSearch = async () => {
    if (!searchQuery || searchQuery.length < 2) {
      toast.error('Please enter at least 2 characters');
      return;
    }

    setSearching(true);
    try {
      const response = await fetch(`/api/cse/leads/search?query=${encodeURIComponent(searchQuery)}`);
      const data = await response.json();

      if (data.success) {
        setResults(data.leads || []);
        if (data.leads.length === 0) {
          toast('No leads found', { icon: 'ℹ️' });
        }
      } else {
        toast.error(data.error || 'Search failed');
      }
    } catch (error) {
      console.error('Search error:', error);
      toast.error('Search failed');
    } finally {
      setSearching(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  return (
    <DashboardLayout role="customer_service_executive">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
            <Phone className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
            <span className="truncate">Call Handling Panel</span>
          </h1>
          <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Search and view customer lead details</p>
        </div>

        {/* Search Panel */}
        <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            <div className="flex-1 min-w-0 relative">
              <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 sm:w-5 sm:h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Search by phone number, Lead ID, vehicle registration, or customer name..."
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-2 sm:py-2.5 md:py-3 text-sm sm:text-base md:text-lg border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                autoFocus
              />
            </div>
            <button
              onClick={handleSearch}
              disabled={searching || !searchQuery}
              className="px-4 sm:px-5 md:px-6 py-2 sm:py-2.5 md:py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap"
            >
              {searching ? (
                <Loader2 className="w-4 h-4 sm:w-5 sm:h-5 animate-spin" />
              ) : (
                <Search className="w-4 h-4 sm:w-5 sm:h-5" />
              )}
              <span className="hidden sm:inline">Search</span>
              <span className="sm:hidden">Search</span>
            </button>
          </div>
          <div className="mt-3 sm:mt-4 text-xs sm:text-sm text-gray-500">
            <p>💡 Tip: You can search by:</p>
            <ul className="list-disc list-inside mt-1.5 sm:mt-2 space-y-0.5 sm:space-y-1">
              <li>Phone number (e.g., 9876543210)</li>
              <li>Lead ID (e.g., LEAD-20240101-001)</li>
              <li>Vehicle registration (e.g., MH12AB1234)</li>
              <li>Customer name (e.g., John Doe)</li>
            </ul>
          </div>
        </div>

        {/* Results */}
        {results.length > 0 && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <div className="p-3 sm:p-4 border-b border-gray-200">
              <h2 className="text-base sm:text-lg font-semibold">Search Results ({results.length})</h2>
            </div>
            <div className="divide-y divide-gray-200">
              {results.map((lead) => (
                <div key={lead.id} className="p-4 sm:p-5 md:p-6 hover:bg-gray-50">
                  <div className="flex flex-col lg:flex-row items-start justify-between gap-3 sm:gap-4">
                    <div className="flex-1 min-w-0 w-full">
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-2 sm:mb-3">
                        <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{lead.lead_number}</h3>
                        <span className={`px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full flex-shrink-0 ${
                          lead.status === 'CLOSED' ? 'bg-green-100 text-green-800' :
                          lead.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-800' :
                          'bg-yellow-100 text-yellow-800'
                        }`}>
                          {lead.status}
                        </span>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        {/* Customer Info */}
                        <div className="space-y-1.5 sm:space-y-2">
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                            <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                            <span className="font-medium truncate">{lead.customer_name}</span>
                          </div>
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                            <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                            <span className="truncate">{lead.customer_phone}</span>
                          </div>
                          {lead.customer_email && (
                            <div className="text-xs sm:text-sm text-gray-600 truncate">{lead.customer_email}</div>
                          )}
                        </div>

                        {/* Vehicle Info */}
                        <div className="space-y-1.5 sm:space-y-2">
                          <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                            <Car className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                            <span className="font-medium truncate">{lead.vehicle_number}</span>
                          </div>
                          {lead.vehicle_model && (
                            <div className="text-xs sm:text-sm text-gray-600 truncate">{lead.vehicle_model}</div>
                          )}
                        </div>

                        {/* Workshop Info */}
                        {lead.workshop && (
                          <div className="space-y-1.5 sm:space-y-2">
                            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                              <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                              <span className="font-medium truncate">{lead.workshop.name}</span>
                            </div>
                            {lead.workshop.phone && (
                              <div className="text-xs sm:text-sm text-gray-600 truncate">{lead.workshop.phone}</div>
                            )}
                            {lead.workshop.city && (
                              <div className="flex items-center gap-1 text-xs sm:text-sm text-gray-600">
                                <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
                                <span className="truncate">{lead.workshop.city}</span>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Assigned Staff */}
                        <div className="space-y-1.5 sm:space-y-2">
                          {lead.assigned_mechanic && (
                            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                              <Wrench className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-gray-600">Mechanic: </span>
                              <span className="font-medium truncate">{lead.assigned_mechanic.full_name}</span>
                            </div>
                          )}
                          {lead.assigned_supervisor && (
                            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                              <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-gray-600">Supervisor: </span>
                              <span className="font-medium truncate">{lead.assigned_supervisor.full_name}</span>
                            </div>
                          )}
                          {lead.pickup_boy && (
                            <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm">
                              <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 flex-shrink-0" />
                              <span className="text-gray-600">Pickup Boy: </span>
                              <span className="font-medium truncate">{lead.pickup_boy.full_name}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="w-full lg:w-auto lg:ml-4 flex flex-row sm:flex-col gap-2 mt-3 lg:mt-0">
                      <Link
                        href={`/dashboard/cse/leads/${lead.id}`}
                        className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs sm:text-sm flex-1 sm:flex-none"
                      >
                        <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                        <span className="hidden sm:inline">View Details</span>
                        <span className="sm:hidden">View</span>
                      </Link>
                      {lead.invoice && (
                        <Link
                          href={`/dashboard/cse/leads/${lead.id}#invoice`}
                          className="inline-flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 text-xs sm:text-sm flex-1 sm:flex-none"
                        >
                          <FileText className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          <span className="hidden sm:inline">View Invoice</span>
                          <span className="sm:hidden">Invoice</span>
                        </Link>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {!searching && results.length === 0 && searchQuery && (
          <div className="text-center py-8 sm:py-10 md:py-12 bg-white rounded-lg shadow">
            <Search className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <p className="text-gray-600 text-sm sm:text-base">No results found</p>
            <p className="text-xs sm:text-sm text-gray-500 mt-1 sm:mt-2">Try a different search term</p>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

