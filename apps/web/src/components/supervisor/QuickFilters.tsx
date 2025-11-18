'use client';

import React from 'react';

const FILTER_OPTIONS = [
  { value: '', label: 'ALL' },
  { value: 'NEW', label: 'NEW' },
  { value: 'ACCEPTED', label: 'ACCEPTED' },
  { value: 'ASSIGNED', label: 'ASSIGNED' },
  { value: 'IN_PROGRESS', label: 'IN PROGRESS' },
  { value: 'HOLD', label: 'HOLD' },
  { value: 'COMPLETED', label: 'COMPLETED' },
  { value: 'READY_FOR_DELIVERY', label: 'READY' }
];

interface QuickFiltersProps {
  activeFilter: string;
  onFilterChange: (filter: string) => void;
  counts?: Record<string, number>;
}

export default function QuickFilters({ 
  activeFilter, 
  onFilterChange,
  counts = {}
}: QuickFiltersProps) {
  return (
    <div className="card">
      <h3 className="text-sm font-semibold text-gray-600 mb-3">QUICK FILTERS</h3>
      <div className="flex flex-wrap gap-2">
        {FILTER_OPTIONS.map((option) => {
          const count = counts[option.value] || 0;
          const isActive = activeFilter === option.value;
          
          return (
            <button
              key={option.value}
              onClick={() => onFilterChange(option.value)}
              className={`
                px-4 py-2 rounded-lg font-medium text-sm transition-all duration-200
                ${isActive 
                  ? 'bg-brand-primary text-white shadow-md' 
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }
              `}
            >
              {option.label}
              {count > 0 && (
                <span className={`
                  ml-2 px-2 py-0.5 rounded-full text-xs
                  ${isActive ? 'bg-white text-brand-primary' : 'bg-gray-300 text-gray-700'}
                `}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

