'use client';

import React, { useState } from 'react';
import { Search, Filter, X } from 'lucide-react';

interface JobFiltersProps {
  onFilterChange: (filters: FilterState) => void;
  mechanics?: Array<{ id: string; name: string }>;
}

export interface FilterState {
  status: string;
  mechanicId: string;
  serviceType: string;
  slaStatus: string;
  search: string;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All Statuses' },
  { value: 'NEW', label: 'New' },
  { value: 'INCOMPLETE', label: 'Incomplete' },
  { value: 'VALIDATED', label: 'Validated' },
  { value: 'ASSIGNED_TO_WORKSHOP', label: 'Assigned to Workshop' },
  { value: 'ACCEPTED', label: 'Accepted' },
  { value: 'IN_PROGRESS', label: 'In Progress' },
  { value: 'HOLD', label: 'On Hold' },
  { value: 'COMPLETED', label: 'Completed' },
  { value: 'READY_FOR_DELIVERY', label: 'Ready for Delivery' },
  { value: 'DELIVERED', label: 'Delivered' },
  { value: 'CANCELLED', label: 'Cancelled' },
  { value: 'REJECTED', label: 'Rejected' }
];

const SLA_STATUS_OPTIONS = [
  { value: '', label: 'All SLA Statuses' },
  { value: 'ON_TIME', label: 'On Time' },
  { value: 'AT_RISK', label: 'At Risk' },
  { value: 'BREACHED', label: 'Breached' }
];

export default function JobFilters({ onFilterChange, mechanics = [] }: JobFiltersProps) {
  const [filters, setFilters] = useState<FilterState>({
    status: '',
    mechanicId: '',
    serviceType: '',
    slaStatus: '',
    search: ''
  });

  const [showFilters, setShowFilters] = useState(false);

  const handleFilterChange = (key: keyof FilterState, value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFilterChange(newFilters);
  };

  const clearFilters = () => {
    const emptyFilters: FilterState = {
      status: '',
      mechanicId: '',
      serviceType: '',
      slaStatus: '',
      search: ''
    };
    setFilters(emptyFilters);
    onFilterChange(emptyFilters);
  };

  const activeFilterCount = Object.values(filters).filter(v => v !== '').length;

  return (
    <div className="card">
      {/* Search Bar */}
      <div className="flex items-center gap-3 mb-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <input
            type="text"
            placeholder="Search by lead number, customer name, or vehicle number..."
            value={filters.search}
            onChange={(e) => handleFilterChange('search', e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
          />
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`btn ${showFilters ? 'btn-primary' : 'btn-outline'} flex items-center gap-2`}
        >
          <Filter className="w-4 h-4" />
          Filters
          {activeFilterCount > 0 && (
            <span className="bg-white text-brand-primary px-2 py-0.5 rounded-full text-xs font-semibold">
              {activeFilterCount}
            </span>
          )}
        </button>

        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            className="btn btn-outline flex items-center gap-2 text-red-600 border-red-600 hover:bg-red-50"
          >
            <X className="w-4 h-4" />
            Clear
          </button>
        )}
      </div>

      {/* Filter Panel */}
      {showFilters && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200">
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            >
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Mechanic Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Mechanic
            </label>
            <select
              value={filters.mechanicId}
              onChange={(e) => handleFilterChange('mechanicId', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            >
              <option value="">All Mechanics</option>
              {mechanics.map((mechanic) => (
                <option key={mechanic.id} value={mechanic.id}>
                  {mechanic.name}
                </option>
              ))}
            </select>
          </div>

          {/* SLA Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              SLA Status
            </label>
            <select
              value={filters.slaStatus}
              onChange={(e) => handleFilterChange('slaStatus', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            >
              {SLA_STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* Service Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Service Type
            </label>
            <input
              type="text"
              placeholder="e.g., Oil Change"
              value={filters.serviceType}
              onChange={(e) => handleFilterChange('serviceType', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            />
          </div>
        </div>
      )}
    </div>
  );
}

