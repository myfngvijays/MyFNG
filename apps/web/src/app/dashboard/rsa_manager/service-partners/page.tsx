'use client';

import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import {
  Search, MapPin, Phone, Clock, Tag,
  Building2, Calendar, ChevronDown, ChevronUp, X
} from 'lucide-react';

export const dynamic = 'force-dynamic';

interface ServiceCentre {
  id: string;
  location: string | null;
  weekoff: string | null;
  workshop_timing: string | null;
  categories: string | null;
  active: string | null;
  workshop_area: string | null;
  original_loc: string | null;
  service_centre_real_name: string | null;
  address: string | null;
  landmark: string | null;
  contect_person: string | null;
  alternate: string | null;
  alternate2: string | null;
  alternate3: string | null;
}

function CategoryBadge({ category }: { category: string | null }) {
  if (!category) return null;
  const c = category.toLowerCase();
  let color = 'bg-gray-100 text-gray-700';
  if (c.includes('a plus')) color = 'bg-purple-100 text-purple-700';
  else if (c.includes('a-cat') || c === 'a-category') color = 'bg-green-100 text-green-700';
  else if (c.includes('b-cat') || c === 'b-category') color = 'bg-yellow-100 text-yellow-700';
  else if (c.includes('c-cat') || c === 'c-category') color = 'bg-red-100 text-red-700';
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${color}`}>
      {category}
    </span>
  );
}

function ActiveBadge({ active }: { active: string | null }) {
  if (!active) return <span className="text-xs text-gray-400">—</span>;
  const a = active.toLowerCase().trim();
  if (a === '24/7') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">24/7</span>;
  if (a === 'no') return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">No</span>;
  return <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-700">{active}</span>;
}

function PhoneLink({ number }: { number: string | null }) {
  if (!number || !number.trim()) return null;
  const clean = number.trim();
  return (
    <a href={`tel:${clean}`} className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800 text-sm font-medium">
      <Phone className="w-3 h-3" />
      {clean}
    </a>
  );
}

export default function ServicePartnersPage() {
  const supabase = getBrowserClient();
  const [data, setData] = useState<ServiceCentre[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const { data: rows, error } = await supabase
        .from('service_centre_directory')
        .select('*')
        .order('location', { ascending: true });

      if (error) throw error;
      setData(rows || []);
    } catch (e) {
      console.error('Error fetching service partners:', e);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  const categories = useMemo(() => {
    const set = new Set<string>();
    data.forEach(r => { if (r.categories) set.add(r.categories); });
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    let rows = data;
    if (categoryFilter !== 'all') {
      rows = rows.filter(r => r.categories === categoryFilter);
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      rows = rows.filter(r =>
        [r.location, r.workshop_area, r.service_centre_real_name, r.address, r.landmark, r.contect_person, r.categories]
          .some(v => v && v.toLowerCase().includes(q))
      );
    }
    return rows;
  }, [data, searchTerm, categoryFilter]);

  return (
    <DashboardLayout role="rsa_manager">
      <div className="max-w-7xl mx-auto px-2 sm:px-4">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Building2 className="w-7 h-7 text-blue-600" />
            Service Partners
          </h1>
          <p className="text-gray-500 mt-1">Service centre directory with contact details</p>
        </div>

        {/* Search + Filter Bar */}
        <div className="bg-white rounded-xl shadow-sm border p-3 sm:p-4 mb-4 flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search by location, area, name, address..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-9 py-2.5 rounded-lg border border-gray-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-100 text-sm outline-none transition"
            />
            {searchTerm && (
              <button onClick={() => setSearchTerm('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <select
            value={categoryFilter}
            onChange={e => setCategoryFilter(e.target.value)}
            className="px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-100 outline-none"
          >
            <option value="all">All Categories</option>
            {categories.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>

        {/* Count */}
        <div className="text-sm text-gray-500 mb-3">
          {loading ? 'Loading...' : `${filtered.length} service partner${filtered.length !== 1 ? 's' : ''} found`}
        </div>

        {/* Cards */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="bg-white rounded-xl border p-4 animate-pulse">
                <div className="h-5 bg-gray-200 rounded w-1/3 mb-3" />
                <div className="h-4 bg-gray-100 rounded w-2/3 mb-2" />
                <div className="h-4 bg-gray-100 rounded w-1/2" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="bg-white rounded-xl border p-10 text-center">
            <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 font-medium">No service partners found</p>
            <p className="text-gray-400 text-sm mt-1">Try a different search or filter</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map(row => {
              const isExpanded = expandedId === row.id;
              return (
                <div
                  key={row.id}
                  className="bg-white rounded-xl border hover:shadow-md transition-shadow cursor-pointer"
                  onClick={() => setExpandedId(isExpanded ? null : row.id)}
                >
                  {/* Main Row */}
                  <div className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <h3 className="font-semibold text-gray-900 text-base truncate">
                            {row.service_centre_real_name || row.location || '—'}
                          </h3>
                          <CategoryBadge category={row.categories} />
                          <ActiveBadge active={row.active} />
                        </div>
                        <div className="flex items-center gap-1 text-sm text-gray-600 mb-1">
                          <MapPin className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <span className="truncate">{row.location}{row.workshop_area ? ` — ${row.workshop_area}` : ''}</span>
                        </div>
                        {row.address && (
                          <p className="text-xs text-gray-500 truncate">{row.address}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        {row.contect_person && <PhoneLink number={row.contect_person} />}
                        {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                      </div>
                    </div>
                  </div>

                  {/* Expanded Details */}
                  {isExpanded && (
                    <div className="border-t px-4 py-3 bg-gray-50/50 rounded-b-xl" onClick={e => e.stopPropagation()}>
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400 text-xs uppercase tracking-wide">Full Address</span>
                          <p className="text-gray-700 mt-0.5">{row.address || '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs uppercase tracking-wide">Landmark</span>
                          <p className="text-gray-700 mt-0.5">{row.landmark || '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs uppercase tracking-wide">Workshop Area</span>
                          <p className="text-gray-700 mt-0.5">{row.workshop_area || '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs uppercase tracking-wide flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Timing
                          </span>
                          <p className="text-gray-700 mt-0.5">{row.workshop_timing || '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs uppercase tracking-wide flex items-center gap-1">
                            <Calendar className="w-3 h-3" /> Week Off
                          </span>
                          <p className="text-gray-700 mt-0.5">{row.weekoff || '—'}</p>
                        </div>
                        <div>
                          <span className="text-gray-400 text-xs uppercase tracking-wide">Original Location</span>
                          {row.original_loc?.startsWith('http') ? (
                            <a href={row.original_loc} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline mt-0.5 block truncate">
                              View on Map
                            </a>
                          ) : (
                            <p className="text-gray-700 mt-0.5">{row.original_loc || '—'}</p>
                          )}
                        </div>
                      </div>

                      {/* Phone Numbers */}
                      <div className="mt-4 pt-3 border-t">
                        <span className="text-gray-400 text-xs uppercase tracking-wide">Contact Numbers</span>
                        <div className="flex flex-wrap gap-3 mt-1.5">
                          {row.contect_person && (
                            <div>
                              <span className="text-xs text-gray-400 block">Primary</span>
                              <PhoneLink number={row.contect_person} />
                            </div>
                          )}
                          {row.alternate && (
                            <div>
                              <span className="text-xs text-gray-400 block">Alt 1</span>
                              <PhoneLink number={row.alternate} />
                            </div>
                          )}
                          {row.alternate2 && (
                            <div>
                              <span className="text-xs text-gray-400 block">Alt 2</span>
                              <PhoneLink number={row.alternate2} />
                            </div>
                          )}
                          {row.alternate3 && (
                            <div>
                              <span className="text-xs text-gray-400 block">Alt 3</span>
                              <PhoneLink number={row.alternate3} />
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
