'use client';

/**
 * Advanced Filters Component
 * Phase 4 - Task WA-601
 * 
 * Features:
 * - Multi-criteria filtering
 * - Date range picker
 * - Status multiselect
 * - Save filters
 * - Quick filters
 */

import { useState } from 'react';
import { Filter, X, Save, Calendar } from 'lucide-react';

export interface FilterOptions {
  dateFrom?: string;
  dateTo?: string;
  status?: string[];
  mechanicId?: string;
  workshopId?: string;
  serviceType?: string[];
  priority?: string[];
  slaStatus?: string[];
  amountMin?: number;
  amountMax?: number;
  searchQuery?: string;
}

interface AdvancedFiltersProps {
  onApplyFilters: (filters: FilterOptions) => void;
  mechanics?: { id: string; full_name: string }[];
  workshops?: { id: string; name: string }[];
}

export default function AdvancedFilters({
  onApplyFilters,
  mechanics = [],
  workshops = [],
}: AdvancedFiltersProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [filters, setFilters] = useState<FilterOptions>({
    status: [],
    serviceType: [],
    priority: [],
    slaStatus: [],
  });

  const statusOptions = [
    'NEW', 'ACCEPTED', 'ASSIGNED', 'IN_PROGRESS',
    'READY_FOR_DELIVERY', 'DELIVERED', 'CLOSED', 'REJECTED'
  ];

  const serviceTypeOptions = [
    'General Service', 'Oil Change', 'Brake Service', 'AC Service',
    'Engine Repair', 'Transmission', 'Tire Service', 'Battery',
    'Electrical', 'Body Work', 'Painting', 'Detailing'
  ];

  const priorityOptions = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
  const slaStatusOptions = ['ON_TIME', 'AT_RISK', 'BREACHED'];

  function handleToggleStatus(status: string) {
    const current = filters.status || [];
    if (current.includes(status)) {
      setFilters({ ...filters, status: current.filter(s => s !== status) });
    } else {
      setFilters({ ...filters, status: [...current, status] });
    }
  }

  function handleToggleServiceType(type: string) {
    const current = filters.serviceType || [];
    if (current.includes(type)) {
      setFilters({ ...filters, serviceType: current.filter(t => t !== type) });
    } else {
      setFilters({ ...filters, serviceType: [...current, type] });
    }
  }

  function handleTogglePriority(priority: string) {
    const current = filters.priority || [];
    if (current.includes(priority)) {
      setFilters({ ...filters, priority: current.filter(p => p !== priority) });
    } else {
      setFilters({ ...filters, priority: [...current, priority] });
    }
  }

  function handleToggleSLAStatus(status: string) {
    const current = filters.slaStatus || [];
    if (current.includes(status)) {
      setFilters({ ...filters, slaStatus: current.filter(s => s !== status) });
    } else {
      setFilters({ ...filters, slaStatus: [...current, status] });
    }
  }

  function handleApply() {
    onApplyFilters(filters);
    setIsOpen(false);
  }

  function handleClear() {
    const cleared: FilterOptions = {
      status: [],
      serviceType: [],
      priority: [],
      slaStatus: [],
    };
    setFilters(cleared);
    onApplyFilters(cleared);
  }

  const activeFilterCount = [
    filters.dateFrom || filters.dateTo,
    filters.status?.length,
    filters.mechanicId,
    filters.workshopId,
    filters.serviceType?.length,
    filters.priority?.length,
    filters.slaStatus?.length,
    filters.amountMin || filters.amountMax,
    filters.searchQuery,
  ].filter(Boolean).length;

  return (
    <div className="relative">
      {/* Filter Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
      >
        <Filter className="w-5 h-5" />
        Filters
        {activeFilterCount > 0 && (
          <span className="bg-brand-primary text-white text-xs font-semibold px-2 py-0.5 rounded-full">
            {activeFilterCount}
          </span>
        )}
      </button>

      {/* Filter Panel */}
      {isOpen && (
        <div className="absolute top-full mt-2 right-0 w-96 bg-white border border-gray-200 rounded-lg shadow-lg p-6 z-50 max-h-96 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Advanced Filters</h3>
            <button
              onClick={() => setIsOpen(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="space-y-4">
            {/* Date Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Date Range
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="date"
                  value={filters.dateFrom || ''}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="From"
                />
                <input
                  type="date"
                  value={filters.dateTo || ''}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="To"
                />
              </div>
            </div>

            {/* Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Status
              </label>
              <div className="flex flex-wrap gap-2">
                {statusOptions.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleToggleStatus(status)}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${
                      filters.status?.includes(status)
                        ? 'bg-brand-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Service Type */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Service Type
              </label>
              <select
                multiple
                value={filters.serviceType || []}
                onChange={(e) => {
                  const options = Array.from(e.target.selectedOptions, opt => opt.value);
                  setFilters({ ...filters, serviceType: options });
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                size={4}
              >
                {serviceTypeOptions.map((type) => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* Priority */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Priority
              </label>
              <div className="flex gap-2">
                {priorityOptions.map((priority) => (
                  <button
                    key={priority}
                    onClick={() => handleTogglePriority(priority)}
                    className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                      filters.priority?.includes(priority)
                        ? 'bg-brand-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {priority}
                  </button>
                ))}
              </div>
            </div>

            {/* SLA Status */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                SLA Status
              </label>
              <div className="flex gap-2">
                {slaStatusOptions.map((status) => (
                  <button
                    key={status}
                    onClick={() => handleToggleSLAStatus(status)}
                    className={`flex-1 px-3 py-2 text-sm rounded transition-colors ${
                      filters.slaStatus?.includes(status)
                        ? 'bg-brand-primary text-white'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                    }`}
                  >
                    {status.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Mechanic */}
            {mechanics.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Mechanic
                </label>
                <select
                  value={filters.mechanicId || ''}
                  onChange={(e) => setFilters({ ...filters, mechanicId: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                >
                  <option value="">All Mechanics</option>
                  {mechanics.map((mech) => (
                    <option key={mech.id} value={mech.id}>{mech.full_name}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Amount Range */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Amount Range (₹)
              </label>
              <div className="grid grid-cols-2 gap-2">
                <input
                  type="number"
                  value={filters.amountMin || ''}
                  onChange={(e) => setFilters({ ...filters, amountMin: parseFloat(e.target.value) || undefined })}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="Min"
                />
                <input
                  type="number"
                  value={filters.amountMax || ''}
                  onChange={(e) => setFilters({ ...filters, amountMax: parseFloat(e.target.value) || undefined })}
                  className="px-3 py-2 border border-gray-300 rounded text-sm"
                  placeholder="Max"
                />
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 mt-6 pt-4 border-t border-gray-200">
            <button
              onClick={handleClear}
              className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded font-medium transition-colors"
            >
              Clear All
            </button>
            <button
              onClick={handleApply}
              className="flex-1 px-4 py-2 bg-brand-primary hover:bg-brand-primary/90 text-white rounded font-medium transition-colors"
            >
              Apply Filters
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

