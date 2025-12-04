'use client';

import { Users, TrendingUp, Award, AlertCircle } from 'lucide-react';
import Link from 'next/link';

interface TeamPerformanceWidgetProps {
  teamOverview: {
    total_staff: number;
    online_staff: number;
    offline_staff: number;
    quality_score: number;
  };
  department: string;
}

export default function TeamPerformanceWidget({ teamOverview, department }: TeamPerformanceWidgetProps) {
  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Users className="w-5 h-5 text-gray-600" />
          Team Performance
        </h2>
        <Link
          href={`/dashboard/sub_admin/${department.toLowerCase()}/performance`}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View Details →
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-blue-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Staff</p>
              <p className="text-2xl font-bold text-gray-900">{teamOverview.total_staff}</p>
            </div>
            <Users className="w-8 h-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-green-50 rounded-lg p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Online</p>
              <p className="text-2xl font-bold text-green-700">{teamOverview.online_staff}</p>
            </div>
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse" />
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm text-gray-600">Quality Score</p>
            <p className="text-3xl font-bold text-purple-700">{teamOverview.quality_score || 0}</p>
          </div>
          <Award className="w-10 h-10 text-purple-600" />
        </div>
      </div>

      {teamOverview.offline_staff > 0 && (
        <div className="mt-4 p-3 bg-yellow-50 border-l-4 border-yellow-500 rounded">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-yellow-600" />
            <p className="text-sm text-yellow-800">
              {teamOverview.offline_staff} staff member{teamOverview.offline_staff > 1 ? 's' : ''} offline
            </p>
          </div>
        </div>
      )}
    </div>
  );
}

