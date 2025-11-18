'use client';

import React from 'react';
import { User, Wrench, CheckCircle, TrendingUp } from 'lucide-react';
import Image from 'next/image';

interface Mechanic {
  id: string;
  name: string;
  profileImage?: string | null;
  activeJobs: number;
  completedToday: number;
  efficiency: number;
}

interface MechanicPerformancePanelProps {
  mechanics: Mechanic[];
  onMechanicClick?: (mechanicId: string) => void;
  loading?: boolean;
}

export default function MechanicPerformancePanel({ 
  mechanics, 
  onMechanicClick,
  loading = false 
}: MechanicPerformancePanelProps) {
  
  if (loading) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-text-heading mb-4">Mechanic Performance</h3>
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="animate-pulse">
              <div className="h-16 bg-gray-200 rounded"></div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!mechanics || mechanics.length === 0) {
    return (
      <div className="card">
        <h3 className="text-lg font-semibold text-text-heading mb-4">Mechanic Performance</h3>
        <div className="text-center py-8 text-gray-500">
          <Wrench className="w-12 h-12 mx-auto mb-2 text-gray-400" />
          <p>No mechanics assigned to this workshop</p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-text-heading">Mechanic Performance</h3>
        <span className="text-sm text-gray-500">{mechanics.length} Mechanics</span>
      </div>

      <div className="space-y-3 max-h-96 overflow-y-auto">
        {mechanics.map((mechanic) => (
          <div
            key={mechanic.id}
            onClick={() => onMechanicClick?.(mechanic.id)}
            className={`
              p-4 rounded-lg border border-gray-200 bg-white
              hover:border-brand-primary hover:shadow-md 
              transition-all duration-200
              ${onMechanicClick ? 'cursor-pointer' : ''}
            `}
          >
            <div className="flex items-center gap-4">
              {/* Mechanic Avatar */}
              <div className="flex-shrink-0">
                {mechanic.profileImage ? (
                  <Image
                    src={mechanic.profileImage}
                    alt={mechanic.name}
                    width={48}
                    height={48}
                    className="rounded-full"
                  />
                ) : (
                  <div className="w-12 h-12 rounded-full bg-brand-primary flex items-center justify-center">
                    <User className="w-6 h-6 text-white" />
                  </div>
                )}
              </div>

              {/* Mechanic Info */}
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-text-heading truncate">{mechanic.name}</p>
                <div className="flex items-center gap-4 mt-1 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Wrench className="w-4 h-4" />
                    {mechanic.activeJobs} active
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="w-4 h-4" />
                    {mechanic.completedToday} today
                  </span>
                </div>
              </div>

              {/* Efficiency Badge */}
              <div className="flex-shrink-0">
                <div className={`
                  px-3 py-1 rounded-full text-sm font-semibold flex items-center gap-1
                  ${mechanic.efficiency >= 80 ? 'bg-green-100 text-green-700' : 
                    mechanic.efficiency >= 60 ? 'bg-yellow-100 text-yellow-700' : 
                    'bg-red-100 text-red-700'}
                `}>
                  <TrendingUp className="w-4 h-4" />
                  {mechanic.efficiency}%
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

