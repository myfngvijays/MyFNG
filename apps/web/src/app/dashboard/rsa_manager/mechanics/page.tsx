'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  Search, Wrench, MapPin, Phone, Clock, 
  CheckCircle, XCircle, Star, TrendingUp, Plus, AlertTriangle, X, Pencil
} from 'lucide-react';

function normalizePhone10(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 10 ? digits : digits.slice(-10);
}

function normalizePincode6(value: string) {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length <= 6 ? digits : digits.slice(0, 6);
}

export default function RSAMechanicsPage() {
  const supabase = getBrowserClient();
  const router = useRouter();
  const initializedFromUrlRef = useRef(false);
  
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [query, setQuery] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'busy'>('all');

  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addPhoneError, setAddPhoneError] = useState('');
  const [checkingPhone, setCheckingPhone] = useState(false);
  const [editingMechanic, setEditingMechanic] = useState<any | null>(null);
  const [editError, setEditError] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [addForm, setAddForm] = useState({
    mechanic_name: '',
    number: '',
    alternate_number1: '',
    alternate_number2: '',
    service_tag: '',
    service_tag2: '',
    service_areas: [{ area: '', pincode: '', state: '' }] as Array<{ area: string; pincode: string; state: string }>,
    timing: '',
    active: true,
  });

  // Live duplicate number check (Add modal)
  useEffect(() => {
    if (!showAdd) return;
    const num = normalizePhone10(addForm.number);
    if (!num || num.length !== 10) {
      setAddPhoneError('');
      setCheckingPhone(false);
      return;
    }

    let cancelled = false;
    const t = setTimeout(async () => {
      setCheckingPhone(true);
      try {
        const res = await fetch(`/api/rsa/mechanics/check-number?number=${encodeURIComponent(num)}`);
        const json = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(json?.error || 'Failed to check number');
        if (cancelled) return;

        if (json?.exists) {
          const label = json?.mechanic_name || json?.code || 'this mechanic';
          setAddPhoneError(`This number is already registered (${label})`);
        } else {
          setAddPhoneError('');
        }
      } catch {
        // If check fails, don't block user; keep error empty
        if (!cancelled) setAddPhoneError('');
      } finally {
        if (!cancelled) setCheckingPhone(false);
      }
    }, 350);

    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [addForm.number, showAdd]);

  const fetchMechanics = async (
    nextQuery: string = query,
    nextAvailability: 'all' | 'available' | 'busy' = availabilityFilter
  ) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (nextQuery?.trim()) params.set('q', nextQuery.trim());
      const res = await fetch(`/api/rsa/mechanics?${params.toString()}`);
      const mechanicsData = await res.json();
      if (!res.ok) throw new Error(Array.isArray(mechanicsData) ? 'Failed to load' : (mechanicsData?.error || 'Failed to load mechanics'));

      const list = Array.isArray(mechanicsData) ? mechanicsData : [];
      // Normalize service_areas (in case API returns string)
      const normalized = list.map((m: any) => ({
        ...m,
        service_areas: Array.isArray(m.service_areas) ? m.service_areas : (typeof m.service_areas === 'string' ? (() => { try { return JSON.parse(m.service_areas); } catch { return []; } })() : []),
      }));

      let filtered = normalized;
      if (nextAvailability === 'available') {
        filtered = normalized.filter((m: any) => m.is_available);
      } else if (nextAvailability === 'busy') {
        filtered = normalized.filter((m: any) => !m.is_available);
      }
      setMechanics(filtered);
    } catch (error: any) {
      console.error('Error fetching mechanics:', error?.message || error);
    } finally {
      setLoading(false);
    }
  };

  const persistSearchInUrl = (
    nextQuery: string,
    nextAvailability: 'all' | 'available' | 'busy',
    nextSearched: boolean
  ) => {
    const params = new URLSearchParams();
    if (nextQuery.trim()) params.set('q', nextQuery.trim());
    if (nextAvailability !== 'all') params.set('availability', nextAvailability);
    if (nextSearched) params.set('searched', '1');
    const qs = params.toString();
    router.replace(qs ? `/dashboard/rsa_manager/mechanics?${qs}` : '/dashboard/rsa_manager/mechanics');
  };

  const handleSearch = () => {
    const nextQuery = query;
    const nextAvailability = availabilityFilter;
    setHasSearched(true);
    persistSearchInUrl(nextQuery, nextAvailability, true);
    fetchMechanics(nextQuery, nextAvailability);
  };

  useEffect(() => {
    if (initializedFromUrlRef.current) return;
    initializedFromUrlRef.current = true;

    const params = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : new URLSearchParams();
    const q = String(params.get('q') || '');
    const availabilityRaw = String(params.get('availability') || 'all');
    const nextAvailability: 'all' | 'available' | 'busy' =
      availabilityRaw === 'available' || availabilityRaw === 'busy' ? availabilityRaw : 'all';
    const searchedParam = params.get('searched') === '1';
    const shouldSearch = searchedParam || Boolean(q.trim()) || nextAvailability !== 'all';

    setQuery(q);
    setAvailabilityFilter(nextAvailability);
    setHasSearched(shouldSearch);

    if (shouldSearch) {
      fetchMechanics(q, nextAvailability);
    }
  }, []);

  const openEdit = (mechanic: any, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setEditError('');
    const areas = Array.isArray(mechanic.service_areas) ? mechanic.service_areas : [];
    const service_areas = areas.map((a: any) => {
      if (typeof a === 'string' || typeof a === 'number') {
        const pincode = String(a).replace(/\D/g, '').slice(0, 6);
        return { area: '', pincode: pincode.length === 6 ? pincode : '', state: '' };
      }
      return {
        area: String(a?.area ?? '').trim(),
        pincode: String(a?.pincode ?? '').replace(/\D/g, '').slice(0, 6),
        state: String(a?.state ?? '').trim(),
      };
    });
    setEditingMechanic({
      ...mechanic,
      service_areas: service_areas.length ? service_areas : [{ area: '', pincode: '', state: '' }],
    });
  };

  const closeEdit = () => {
    setEditingMechanic(null);
    setEditError('');
  };

  const getEditForm = () => {
    if (!editingMechanic) return null;
    return {
      mechanic_name: String(editingMechanic.mechanic_name ?? '').trim(),
      number: String(editingMechanic.number ?? '').replace(/\D/g, '').slice(-10),
      alternate_number1: String(editingMechanic.alternate_number1 ?? '').replace(/\D/g, '').slice(-10),
      alternate_number2: String(editingMechanic.alternate_number2 ?? '').replace(/\D/g, '').slice(-10),
      service_tag: String(editingMechanic.service_tag ?? '').trim(),
      service_tag2: String(editingMechanic.service_tag2 ?? '').trim(),
      service_tag3: String(editingMechanic.service_tag3 ?? '').trim(),
      timing: String(editingMechanic.timing ?? '').trim(),
      active: editingMechanic.active !== false,
      service_areas: Array.isArray(editingMechanic.service_areas) ? editingMechanic.service_areas : [{ area: '', pincode: '', state: '' }],
    };
  };

  const saveEdit = async () => {
    if (!editingMechanic?.id) return;
    const form = getEditForm();
    if (!form) return;
    setEditError('');
    const name = form.mechanic_name.trim();
    const num = normalizePhone10(form.number);
    if (!name) return setEditError('Mechanic name is required');
    if (!num || num.length !== 10) return setEditError('Valid 10-digit number is required');
    for (const row of form.service_areas) {
      const any = Boolean(row.area.trim() || row.pincode.trim() || row.state.trim());
      if (!any) continue;
      if (!row.area.trim() || !row.state.trim() || row.pincode.trim().length !== 6) {
        return setEditError('Service Areas: Please fill Area + 6-digit Pincode + State for each added row');
      }
    }
    setEditSaving(true);
    try {
      const res = await fetch(`/api/rsa/mechanics/${encodeURIComponent(editingMechanic.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mechanic_name: form.mechanic_name,
          number: num,
          alternate_number1: normalizePhone10(form.alternate_number1) || null,
          alternate_number2: normalizePhone10(form.alternate_number2) || null,
          service_tag: form.service_tag || null,
          service_tag2: form.service_tag2 || null,
          service_tag3: form.service_tag3 || null,
          timing: form.timing || null,
          active: form.active,
          service_areas: form.service_areas
            .filter((r) => r.area.trim() && r.state.trim() && r.pincode.trim().length === 6)
            .map((r) => ({ area: r.area.trim(), pincode: r.pincode.trim(), state: r.state.trim() })),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to update mechanic');
      closeEdit();
      fetchMechanics();
    } catch (e: any) {
      setEditError(e?.message || 'Failed to update mechanic');
    } finally {
      setEditSaving(false);
    }
  };

  return (
    <DashboardLayout role="rsa_manager">
      <div className="w-full min-w-0 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg mb-6 sm:mb-7 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">Company Mechanics</h1>
              <p className="text-white/90 font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Search and manage RSA mechanics</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAddError('');
                setAddPhoneError('');
                setShowAdd(true);
                setAddForm((p) => ({
                  ...p,
                  service_areas: Array.isArray(p.service_areas) && p.service_areas.length ? p.service_areas : [{ area: '', pincode: '', state: '' }],
                }));
              }}
              className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/20 text-white rounded-lg text-xs sm:text-sm font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add Mechanic
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 md:p-6 mb-4 sm:mb-5 md:mb-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-3 sm:mb-4">
            <div className="relative sm:col-span-2 lg:col-span-3">
              <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
              <input
                type="text"
                placeholder="Search by name, code, number, service tag, or 6-digit pincode..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch();
                }}
                className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
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
            
            {!hasSearched ? (
              <div className="text-center py-8 sm:py-10 md:py-12">
                <Wrench className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
                <p className="text-gray-600 text-sm sm:text-base">Search to view mechanics</p>
              </div>
            ) : loading ? (
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
                    onClick={() => {
                      const params = new URLSearchParams();
                      if (query.trim()) params.set('q', query.trim());
                      if (availabilityFilter !== 'all') params.set('availability', availabilityFilter);
                      if (hasSearched) params.set('searched', '1');
                      const qs = params.toString();
                      router.push(
                        qs
                          ? `/dashboard/rsa_manager/mechanics/${mechanic.id}?${qs}`
                          : `/dashboard/rsa_manager/mechanics/${mechanic.id}`
                      );
                    }}
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
                        <p className="text-xs sm:text-sm text-gray-600">Code: {mechanic.code || mechanic.mechanic_code}</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <button
                          type="button"
                          onClick={(e) => openEdit(mechanic, e)}
                          className="p-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700"
                          title="Edit mechanic"
                          aria-label="Edit"
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        {mechanic.is_available ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="text-[10px] sm:text-xs font-medium">Available</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-red-600">
                            <XCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="text-[10px] sm:text-xs font-medium">Busy</span>
                          </div>
                        )}
                      </div>
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

                      {Array.isArray(mechanic.service_areas) && mechanic.service_areas.length > 0 && (
                        <div className="flex items-start gap-1.5 sm:gap-2">
                          <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                          <div className="flex flex-wrap gap-1">
                            {mechanic.service_areas
                              .slice(0, 3)
                              .map((area: any, idx: number) => {
                                const label =
                                  typeof area === 'string'
                                    ? area
                                    : String(area?.pincode || area?.area || '').trim();
                                return (
                              <span key={idx} className="px-1.5 sm:px-2 py-0.5 sm:py-1 bg-gray-100 text-gray-700 rounded text-[10px] sm:text-xs">
                                {label || '—'}
                              </span>
                                );
                              })}
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
                            {(mechanic.completed_cases ?? mechanic.total_jobs_completed ?? 0) as any} cases done
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

        {/* Add Mechanic Modal */}
        {showAdd && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-teal-600 text-white">
                <h2 className="text-lg sm:text-xl font-bold">Add Mechanic</h2>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-white/10"
                  onClick={() => setShowAdd(false)}
                  disabled={adding}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 max-h-[calc(90vh-64px)] overflow-auto">

              {addError ? (
                <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2">
                  <AlertTriangle className="w-4 h-4" />
                  <span>{addError}</span>
                </div>
              ) : null}

              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-semibold text-gray-800 mb-2">Mechanic Name *</label>
                  <input
                    className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                    value={addForm.mechanic_name}
                    onChange={(e) => setAddForm((p) => ({ ...p, mechanic_name: e.target.value }))}
                    placeholder="e.g. Ravi Kumar"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Phone *</label>
                    <input
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      value={addForm.number}
                      onChange={(e) => setAddForm((p) => ({ ...p, number: normalizePhone10(e.target.value) }))}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData?.getData('text') || '';
                        setAddForm((p) => ({ ...p, number: normalizePhone10(text) }));
                      }}
                      inputMode="numeric"
                      maxLength={10}
                      placeholder="10 digit number"
                    />
                    {addPhoneError ? (
                      <p className="mt-2 text-sm text-red-600 font-semibold">{addPhoneError}</p>
                    ) : checkingPhone && normalizePhone10(addForm.number).length === 10 ? (
                      <p className="mt-2 text-sm text-gray-500">Checking number…</p>
                    ) : null}
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Timing</label>
                    <input
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      value={addForm.timing}
                      onChange={(e) => setAddForm((p) => ({ ...p, timing: e.target.value }))}
                      placeholder="e.g. 9am-9pm"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Alt Number 1</label>
                    <input
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      value={addForm.alternate_number1}
                      onChange={(e) => setAddForm((p) => ({ ...p, alternate_number1: normalizePhone10(e.target.value) }))}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData?.getData('text') || '';
                        setAddForm((p) => ({ ...p, alternate_number1: normalizePhone10(text) }));
                      }}
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Alt Number 2</label>
                    <input
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      value={addForm.alternate_number2}
                      onChange={(e) => setAddForm((p) => ({ ...p, alternate_number2: normalizePhone10(e.target.value) }))}
                      onPaste={(e) => {
                        e.preventDefault();
                        const text = e.clipboardData?.getData('text') || '';
                        setAddForm((p) => ({ ...p, alternate_number2: normalizePhone10(text) }));
                      }}
                      inputMode="numeric"
                      maxLength={10}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Service Tag *</label>
                    <input
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      value={addForm.service_tag}
                      onChange={(e) => setAddForm((p) => ({ ...p, service_tag: e.target.value }))}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Service Tag 2</label>
                    <input
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      value={addForm.service_tag2}
                      onChange={(e) => setAddForm((p) => ({ ...p, service_tag2: e.target.value }))}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex items-center justify-between gap-3 mb-2">
                    <label className="block text-sm font-semibold text-gray-800">Service Areas * (max 20)</label>
                    <button
                      type="button"
                      className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-800 disabled:opacity-50"
                      disabled={addForm.service_areas.length >= 20}
                      onClick={() => {
                        setAddForm((p) => ({
                          ...p,
                          service_areas: [
                            ...p.service_areas,
                            { area: '', pincode: '', state: '' },
                          ],
                        }));
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      Add Area
                    </button>
                  </div>

                  <div className="space-y-3">
                    {addForm.service_areas.map((row, idx) => (
                      <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                        <input
                          className="sm:col-span-5 w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="Area"
                          value={row.area}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAddForm((p) => ({
                              ...p,
                              service_areas: p.service_areas.map((r, i) => (i === idx ? { ...r, area: v } : r)),
                            }));
                          }}
                        />
                        <input
                          className="sm:col-span-3 w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="Pincode"
                          inputMode="numeric"
                          maxLength={6}
                          value={row.pincode}
                          onChange={(e) => {
                            const v = normalizePincode6(e.target.value);
                            setAddForm((p) => ({
                              ...p,
                              service_areas: p.service_areas.map((r, i) => (i === idx ? { ...r, pincode: v } : r)),
                            }));
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const text = e.clipboardData?.getData('text') || '';
                            const v = normalizePincode6(text);
                            setAddForm((p) => ({
                              ...p,
                              service_areas: p.service_areas.map((r, i) => (i === idx ? { ...r, pincode: v } : r)),
                            }));
                          }}
                        />
                        <input
                          className="sm:col-span-3 w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                          placeholder="State"
                          value={row.state}
                          onChange={(e) => {
                            const v = e.target.value;
                            setAddForm((p) => ({
                              ...p,
                              service_areas: p.service_areas.map((r, i) => (i === idx ? { ...r, state: v } : r)),
                            }));
                          }}
                        />
                        <button
                          type="button"
                          className="sm:col-span-1 inline-flex items-center justify-center w-full sm:w-11 h-11 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700"
                          aria-label="Remove area"
                          onClick={() => {
                            setAddForm((p) => ({
                              ...p,
                              service_areas: p.service_areas.filter((_, i) => i !== idx),
                            }));
                          }}
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <p className="mt-2 text-sm text-gray-500">
                    Note: kisi area ko valid banane ke liye <span className="font-semibold">Area + Pincode + State</span> teeno fill karo.
                  </p>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-end">
                <button
                  type="button"
                  className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 text-sm font-semibold"
                  onClick={() => setShowAdd(false)}
                  disabled={adding}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-semibold"
                  disabled={adding}
                  onClick={async () => {
                    setAddError('');
                    const name = addForm.mechanic_name.trim();
                    const num = normalizePhone10(addForm.number);
                    if (!name) return setAddError('Mechanic name is required');
                    if (!num || num.length !== 10) return setAddError('Valid 10-digit number is required');
                    if (addPhoneError) return setAddError(addPhoneError);
                    if (!String(addForm.service_tag || '').trim()) return setAddError('At least 1 Service Tag is required');

                    const validAreas = addForm.service_areas
                      .filter((r) => r.area.trim() && r.state.trim() && r.pincode.trim().length === 6)
                      .map((r) => ({ area: r.area.trim(), pincode: r.pincode.trim(), state: r.state.trim() }));
                    if (validAreas.length === 0) return setAddError('At least 1 Service Area (Area + 6-digit Pincode + State) is required');

                    // Validate service areas rows (if any field filled, require all 3)
                    for (const row of addForm.service_areas) {
                      const any = Boolean(row.area.trim() || row.pincode.trim() || row.state.trim());
                      if (!any) continue;
                      if (!row.area.trim() || !row.state.trim() || row.pincode.trim().length !== 6) {
                        return setAddError('Service Areas: Please fill Area + 6-digit Pincode + State for each added row');
                      }
                    }

                    setAdding(true);
                    try {
                      const res = await fetch('/api/rsa/mechanics', {
                        method: 'POST',
                        headers: { 'content-type': 'application/json' },
                        body: JSON.stringify({
                          ...addForm,
                          number: num,
                          alternate_number1: normalizePhone10(addForm.alternate_number1),
                          alternate_number2: normalizePhone10(addForm.alternate_number2),
                          service_areas: validAreas,
                        }),
                      });
                      const json = await res.json().catch(() => ({}));
                      if (!res.ok) throw new Error(json?.error || 'Failed to add mechanic');

                      setShowAdd(false);
                      setAddForm({
                        mechanic_name: '',
                        number: '',
                        alternate_number1: '',
                        alternate_number2: '',
                        service_tag: '',
                        service_tag2: '',
                        service_areas: [{ area: '', pincode: '', state: '' }],
                        timing: '',
                        active: true,
                      });
                      setAddPhoneError('');
                      fetchMechanics();
                    } catch (e: any) {
                      setAddError(e?.message || 'Failed to add mechanic');
                    } finally {
                      setAdding(false);
                    }
                  }}
                >
                  {adding ? 'Saving…' : 'Save Mechanic'}
                </button>
              </div>
            </div>
          </div>
          </div>
        )}

        {/* Edit Mechanic Modal */}
        {editingMechanic && (
          <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-3 sm:p-4">
            <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-hidden shadow-2xl">
              <div className="flex items-center justify-between gap-3 px-4 sm:px-6 py-4 bg-teal-600 text-white">
                <h2 className="text-lg sm:text-xl font-bold">Edit Mechanic</h2>
                <button
                  type="button"
                  className="p-1 rounded hover:bg-white/10"
                  onClick={closeEdit}
                  disabled={editSaving}
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 sm:p-6 max-h-[calc(90vh-64px)] overflow-auto">
                {editError ? (
                  <div className="mb-4 bg-red-50 border border-red-200 text-red-800 px-3 py-2 rounded-lg text-xs sm:text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>{editError}</span>
                  </div>
                ) : null}

                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Mechanic Name *</label>
                    <input
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      value={editingMechanic.mechanic_name ?? ''}
                      onChange={(e) => setEditingMechanic((p: any) => ({ ...p, mechanic_name: e.target.value }))}
                      placeholder="e.g. Ravi Kumar"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Phone *</label>
                      <input
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        value={(editingMechanic.number ?? '').replace(/\D/g, '').slice(-10)}
                        onChange={(e) => setEditingMechanic((p: any) => ({ ...p, number: normalizePhone10(e.target.value) }))}
                        onPaste={(e) => {
                          e.preventDefault();
                          const text = e.clipboardData?.getData('text') || '';
                          setEditingMechanic((p: any) => ({ ...p, number: normalizePhone10(text) }));
                        }}
                        inputMode="numeric"
                        maxLength={10}
                        placeholder="10 digit number"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Timing</label>
                      <input
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        value={editingMechanic.timing ?? ''}
                        onChange={(e) => setEditingMechanic((p: any) => ({ ...p, timing: e.target.value }))}
                        placeholder="e.g. 9am-9pm"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Alt Number 1</label>
                      <input
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        value={(editingMechanic.alternate_number1 ?? '').replace(/\D/g, '').slice(-10)}
                        onChange={(e) => setEditingMechanic((p: any) => ({ ...p, alternate_number1: normalizePhone10(e.target.value) }))}
                        onPaste={(e) => {
                          e.preventDefault();
                          const text = e.clipboardData?.getData('text') || '';
                          setEditingMechanic((p: any) => ({ ...p, alternate_number1: normalizePhone10(text) }));
                        }}
                        inputMode="numeric"
                        maxLength={10}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Alt Number 2</label>
                      <input
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        value={(editingMechanic.alternate_number2 ?? '').replace(/\D/g, '').slice(-10)}
                        onChange={(e) => setEditingMechanic((p: any) => ({ ...p, alternate_number2: normalizePhone10(e.target.value) }))}
                        onPaste={(e) => {
                          e.preventDefault();
                          const text = e.clipboardData?.getData('text') || '';
                          setEditingMechanic((p: any) => ({ ...p, alternate_number2: normalizePhone10(text) }));
                        }}
                        inputMode="numeric"
                        maxLength={10}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Service Tag</label>
                      <input
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        value={editingMechanic.service_tag ?? ''}
                        onChange={(e) => setEditingMechanic((p: any) => ({ ...p, service_tag: e.target.value }))}
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-semibold text-gray-800 mb-2">Service Tag 2</label>
                      <input
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                        value={editingMechanic.service_tag2 ?? ''}
                        onChange={(e) => setEditingMechanic((p: any) => ({ ...p, service_tag2: e.target.value }))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Service Tag 3</label>
                    <input
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                      value={editingMechanic.service_tag3 ?? ''}
                      onChange={(e) => setEditingMechanic((p: any) => ({ ...p, service_tag3: e.target.value }))}
                    />
                  </div>

                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      id="edit-active"
                      checked={editingMechanic.active !== false}
                      onChange={(e) => setEditingMechanic((p: any) => ({ ...p, active: e.target.checked }))}
                      className="rounded border-gray-300"
                    />
                    <label htmlFor="edit-active" className="text-sm font-semibold text-gray-800">Active</label>
                  </div>

                  <div>
                    <div className="flex items-center justify-between gap-3 mb-2">
                      <label className="block text-sm font-semibold text-gray-800">Service Areas (max 20)</label>
                      <button
                        type="button"
                        className="inline-flex items-center gap-2 px-3 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-sm font-semibold text-gray-800 disabled:opacity-50"
                        disabled={(editingMechanic.service_areas?.length ?? 0) >= 20}
                        onClick={() => {
                          setEditingMechanic((p: any) => ({
                            ...p,
                            service_areas: [
                              ...(Array.isArray(p.service_areas) ? p.service_areas : []),
                              { area: '', pincode: '', state: '' },
                            ],
                          }));
                        }}
                      >
                        <Plus className="w-4 h-4" />
                        Add Area
                      </button>
                    </div>
                    <div className="space-y-3">
                      {(Array.isArray(editingMechanic.service_areas) ? editingMechanic.service_areas : []).map((row: any, idx: number) => (
                        <div key={idx} className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-center">
                          <input
                            className="sm:col-span-5 w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            placeholder="Area"
                            value={row.area ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setEditingMechanic((p: any) => ({
                                ...p,
                                service_areas: (p.service_areas || []).map((r: any, i: number) => (i === idx ? { ...r, area: v } : r)),
                              }));
                            }}
                          />
                          <input
                            className="sm:col-span-3 w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            placeholder="Pincode"
                            inputMode="numeric"
                            maxLength={6}
                            value={row.pincode ?? ''}
                            onChange={(e) => {
                              const v = normalizePincode6(e.target.value);
                              setEditingMechanic((p: any) => ({
                                ...p,
                                service_areas: (p.service_areas || []).map((r: any, i: number) => (i === idx ? { ...r, pincode: v } : r)),
                              }));
                            }}
                            onPaste={(e) => {
                              e.preventDefault();
                              const text = e.clipboardData?.getData('text') || '';
                              const v = normalizePincode6(text);
                              setEditingMechanic((p: any) => ({
                                ...p,
                                service_areas: (p.service_areas || []).map((r: any, i: number) => (i === idx ? { ...r, pincode: v } : r)),
                              }));
                            }}
                          />
                          <input
                            className="sm:col-span-3 w-full px-4 py-3 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                            placeholder="State"
                            value={row.state ?? ''}
                            onChange={(e) => {
                              const v = e.target.value;
                              setEditingMechanic((p: any) => ({
                                ...p,
                                service_areas: (p.service_areas || []).map((r: any, i: number) => (i === idx ? { ...r, state: v } : r)),
                              }));
                            }}
                          />
                          <button
                            type="button"
                            className="sm:col-span-1 inline-flex items-center justify-center w-full sm:w-11 h-11 rounded-xl border border-gray-300 hover:bg-gray-50 text-gray-700"
                            aria-label="Remove area"
                            onClick={() => {
                              setEditingMechanic((p: any) => ({
                                ...p,
                                service_areas: (p.service_areas || []).filter((_: any, i: number) => i !== idx),
                              }));
                            }}
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                    </div>
                    <p className="mt-2 text-sm text-gray-500">
                      Note: kisi area ko valid banane ke liye <span className="font-semibold">Area + Pincode + State</span> teeno fill karo.
                    </p>
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 mt-8 justify-end">
                  <button
                    type="button"
                    className="px-6 py-3 border border-gray-300 rounded-xl hover:bg-gray-50 text-sm font-semibold"
                    onClick={closeEdit}
                    disabled={editSaving}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="px-6 py-3 bg-teal-600 text-white rounded-xl hover:bg-teal-700 disabled:opacity-50 text-sm font-semibold"
                    disabled={editSaving}
                    onClick={saveEdit}
                  >
                    {editSaving ? 'Saving…' : 'Update Mechanic'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

