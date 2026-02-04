'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import DashboardLayout from '@/components/DashboardLayout';
import { RSAManagerService } from '@/lib/services/rsaManagerService';
import { 
  Search, Wrench, MapPin, Phone, Clock, 
  CheckCircle, XCircle, Star, TrendingUp, Plus, AlertTriangle, X
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
  
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [pincodeFilter, setPincodeFilter] = useState('');
  const [serviceTagFilter, setServiceTagFilter] = useState('');
  const [availabilityFilter, setAvailabilityFilter] = useState<'all' | 'available' | 'busy'>('all');

  const [showAdd, setShowAdd] = useState(false);
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState('');
  const [addForm, setAddForm] = useState({
    mechanic_name: '',
    number: '',
    alternate_number1: '',
    alternate_number2: '',
    service_tag: '',
    service_tag2: '',
    service_areas: [] as Array<{ area: string; pincode: string; state: string }>,
    timing: '',
    active: true,
  });

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
    setHasSearched(true);
    fetchMechanics();
  };

  return (
    <DashboardLayout role="rsa_manager">
      <div className="p-3 sm:p-4 md:p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6 mb-6 sm:mb-7 md:mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-white drop-shadow-lg">Company Mechanics</h1>
              <p className="text-white/90 font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Search and manage RSA mechanics</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAddError('');
                setShowAdd(true);
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
                        <p className="text-xs sm:text-sm text-gray-600">Code: {mechanic.code || mechanic.mechanic_code}</p>
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
                    <label className="block text-sm font-semibold text-gray-800 mb-2">Service Tag</label>
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
                    <label className="block text-sm font-semibold text-gray-800">Service Areas (max 20)</label>
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
                          // Send only pincodes to backend (keeps existing pincode-based matching)
                          service_areas: addForm.service_areas
                            .filter((r) => r.area.trim() && r.state.trim() && r.pincode.trim().length === 6)
                            .map((r) => r.pincode.trim()),
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
                        service_areas: [],
                        timing: '',
                        active: true,
                      });
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
      </div>
    </DashboardLayout>
  );
}

