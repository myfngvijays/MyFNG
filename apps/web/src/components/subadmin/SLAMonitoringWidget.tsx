'use client';

import { Clock, AlertTriangle, CheckCircle, TrendingDown } from 'lucide-react';
import Link from 'next/link';

interface SLAMonitoringWidgetProps {
  slaBreaches: number;
  slaAtRisk: number;
  department: string;
}

export default function SLAMonitoringWidget({ slaBreaches, slaAtRisk, department }: SLAMonitoringWidgetProps) {
  const totalIssues = slaBreaches + slaAtRisk;
  const severity = slaBreaches > 0 ? 'high' : slaAtRisk > 5 ? 'medium' : 'low';

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <Clock className="w-5 h-5 text-gray-600" />
          SLA Monitoring
        </h2>
        <Link
          href={`/dashboard/sub_admin/${department.toLowerCase()}/sla`}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium"
        >
          View All →
        </Link>
      </div>

      <div className="space-y-4">
        {/* Breaches */}
        <div className={`p-4 rounded-lg border-l-4 ${
          slaBreaches > 0 
            ? 'bg-red-50 border-red-500' 
            : 'bg-gray-50 border-gray-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertTriangle className={`w-6 h-6 ${
                slaBreaches > 0 ? 'text-red-600' : 'text-gray-400'
              }`} />
              <div>
                <p className="text-sm font-medium text-gray-700">SLA Breaches</p>
                <p className={`text-2xl font-bold ${
                  slaBreaches > 0 ? 'text-red-700' : 'text-gray-500'
                }`}>
                  {slaBreaches}
                </p>
              </div>
            </div>
            {slaBreaches > 0 && (
              <span className="px-2 py-1 bg-red-200 text-red-800 text-xs font-semibold rounded">
                CRITICAL
              </span>
            )}
          </div>
        </div>

        {/* At Risk */}
        <div className={`p-4 rounded-lg border-l-4 ${
          slaAtRisk > 5 
            ? 'bg-yellow-50 border-yellow-500' 
            : slaAtRisk > 0
            ? 'bg-orange-50 border-orange-400'
            : 'bg-gray-50 border-gray-300'
        }`}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <TrendingDown className={`w-6 h-6 ${
                slaAtRisk > 5 ? 'text-yellow-600' : slaAtRisk > 0 ? 'text-orange-600' : 'text-gray-400'
              }`} />
              <div>
                <p className="text-sm font-medium text-gray-700">At Risk</p>
                <p className={`text-2xl font-bold ${
                  slaAtRisk > 5 ? 'text-yellow-700' : slaAtRisk > 0 ? 'text-orange-700' : 'text-gray-500'
                }`}>
                  {slaAtRisk}
                </p>
              </div>
            </div>
            {slaAtRisk > 5 && (
              <span className="px-2 py-1 bg-yellow-200 text-yellow-800 text-xs font-semibold rounded">
                WARNING
              </span>
            )}
          </div>
        </div>

        {/* Status Indicator */}
        {totalIssues === 0 && (
          <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
            <div className="flex items-center gap-3">
              <CheckCircle className="w-6 h-6 text-green-600" />
              <div>
                <p className="text-sm font-medium text-green-800">All SLAs On Track</p>
                <p className="text-xs text-green-600">No breaches or at-risk items</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

