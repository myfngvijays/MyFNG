'use client';

import { AlertTriangle, Clock, CheckCircle, ArrowRight } from 'lucide-react';
import Link from 'next/link';

interface Escalation {
  type: string;
  severity: string;
  message: string;
  entity_id: string;
  entity_type: string;
}

interface EscalationCornerProps {
  escalations: Escalation[];
  pendingCount: number;
  urgentCount: number;
  department: string;
}

export default function EscalationCorner({ 
  escalations, 
  pendingCount, 
  urgentCount,
  department 
}: EscalationCornerProps) {
  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL':
        return 'bg-red-100 border-red-500 text-red-800';
      case 'URGENT':
        return 'bg-orange-100 border-orange-500 text-orange-800';
      case 'HIGH':
        return 'bg-yellow-100 border-yellow-500 text-yellow-800';
      default:
        return 'bg-gray-100 border-gray-300 text-gray-800';
    }
  };

  const getSeverityIcon = (severity: string) => {
    if (severity === 'CRITICAL' || severity === 'URGENT') {
      return <AlertTriangle className="w-5 h-5" />;
    }
    return <Clock className="w-5 h-5" />;
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-red-600" />
          Escalation Corner
        </h2>
        <Link
          href={`/dashboard/sub_admin/${department.toLowerCase()}/escalations`}
          className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
        >
          View All <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        <div className="bg-red-50 rounded-lg p-4 border-l-4 border-red-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Pending</p>
              <p className="text-2xl font-bold text-red-700">{pendingCount}</p>
            </div>
            <Clock className="w-8 h-8 text-red-600" />
          </div>
        </div>

        <div className="bg-orange-50 rounded-lg p-4 border-l-4 border-orange-500">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Urgent</p>
              <p className="text-2xl font-bold text-orange-700">{urgentCount}</p>
            </div>
            <AlertTriangle className="w-8 h-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Recent Escalations */}
      <div className="space-y-2">
        {escalations.length === 0 ? (
          <div className="p-4 bg-green-50 rounded-lg border-l-4 border-green-500">
            <div className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5 text-green-600" />
              <p className="text-sm text-green-800">No pending escalations</p>
            </div>
          </div>
        ) : (
          escalations.slice(0, 5).map((escalation, index) => (
            <div
              key={index}
              className={`p-3 rounded border-l-4 ${getSeverityColor(escalation.severity)}`}
            >
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-2 flex-1">
                  {getSeverityIcon(escalation.severity)}
                  <div className="flex-1">
                    <p className="text-sm font-medium">{escalation.message}</p>
                    <p className="text-xs mt-1 opacity-75">
                      {escalation.type.replace(/_/g, ' ')}
                    </p>
                  </div>
                </div>
                <span className={`text-xs px-2 py-1 rounded font-semibold ${
                  escalation.severity === 'CRITICAL' || escalation.severity === 'URGENT'
                    ? 'bg-red-200 text-red-900'
                    : escalation.severity === 'HIGH'
                    ? 'bg-yellow-200 text-yellow-900'
                    : 'bg-gray-200 text-gray-900'
                }`}>
                  {escalation.severity}
                </span>
              </div>
            </div>
          ))
        )}
      </div>

      {escalations.length > 5 && (
        <div className="mt-4 text-center">
          <Link
            href={`/dashboard/sub_admin/${department.toLowerCase()}/escalations`}
            className="text-sm text-blue-600 hover:text-blue-800 font-medium"
          >
            View {escalations.length - 5} more escalations →
          </Link>
        </div>
      )}
    </div>
  );
}

