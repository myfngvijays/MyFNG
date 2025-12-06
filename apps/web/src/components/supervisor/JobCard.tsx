'use client';

import React from 'react';
import { 
  User, Car, Clock, AlertTriangle, Image as ImageIcon,
  CheckCircle, XCircle, Truck, DollarSign, Wrench, Eye
} from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Job {
  id: string;
  lead_number: string;
  customer_name: string;
  customer_phone_masked: string;
  vehicle_number: string;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_variant?: string;
  service_type: string;
  service_type_ids?: any[];
  status: string;
  priority: string;
  sla_status: string;
  time_remaining: string | null;
  pickup_required: boolean;
  pickup_status: string | null;
  qc_status: string;
  mechanic: {
    id: string;
    name: string;
    profileImage?: string | null;
  } | null;
  pickup_boy: {
    id: string;
    name: string;
    profileImage?: string | null;
  } | null;
  images: {
    before: boolean;
    progress: boolean;
    after: boolean;
  };
  extra_work_pending: boolean;
  created_at: string;
  updated_at: string;
}

interface JobCardProps {
  job: Job;
  onQuickAction?: (action: string, jobId: string) => void;
}

export default function JobCard({ job, onQuickAction }: JobCardProps) {
  const router = useRouter();

  // SLA Color
  const getSLAColor = () => {
    switch (job.sla_status) {
      case 'ON_TIME':
        return 'bg-green-100 text-green-700 border-green-200';
      case 'AT_RISK':
        return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'BREACHED':
        return 'bg-red-100 text-red-700 border-red-200';
      default:
        return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  // Status Color
  const getStatusColor = () => {
    switch (job.status) {
      case 'NEW':
        return 'bg-blue-100 text-blue-700';
      case 'INCOMPLETE':
        return 'bg-yellow-100 text-yellow-700';
      case 'VALIDATED':
        return 'bg-cyan-100 text-cyan-700';
      case 'ASSIGNED_TO_WORKSHOP':
        return 'bg-purple-100 text-purple-700';
      case 'ACCEPTED':
        return 'bg-indigo-100 text-indigo-700';
      case 'IN_PROGRESS':
        return 'bg-green-100 text-green-700';
      case 'HOLD':
        return 'bg-orange-100 text-orange-700';
      case 'COMPLETED':
      case 'WORK_COMPLETED':
        return 'bg-teal-100 text-teal-700';
      case 'QC_PENDING':
        return 'bg-purple-100 text-purple-700';
      case 'READY_FOR_DELIVERY':
        return 'bg-emerald-100 text-emerald-700';
      case 'DELIVERED':
        return 'bg-lime-100 text-lime-700';
      case 'CANCELLED':
        return 'bg-red-100 text-red-700';
      case 'REJECTED':
        return 'bg-rose-100 text-rose-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  // Priority Badge
  const getPriorityBadge = () => {
    const colors = {
      LOW: 'bg-gray-100 text-gray-600',
      MEDIUM: 'bg-blue-100 text-blue-600',
      HIGH: 'bg-orange-100 text-orange-600',
      URGENT: 'bg-red-100 text-red-600'
    };
    return colors[job.priority as keyof typeof colors] || colors.MEDIUM;
  };

  return (
    <div className="card hover:shadow-lg transition-all duration-200 border-l-4 border-brand-primary">
      {/* Header Row */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h3 
              className="text-lg font-semibold text-text-heading hover:text-brand-primary cursor-pointer"
              onClick={() => router.push(`/dashboard/workshop_supervisor/jobs/${job.id}`)}
            >
              {job.lead_number}
            </h3>
            <span className={`px-2 py-1 rounded text-xs font-semibold ${getPriorityBadge()}`}>
              {job.priority}
            </span>
          </div>
          <p className="text-sm text-gray-600 mt-1">{job.service_type}</p>
        </div>

        {/* SLA Badge */}
        {job.time_remaining && (
          <div className={`px-3 py-1 rounded-lg border text-sm font-semibold flex items-center gap-1 ${getSLAColor()}`}>
            <Clock className="w-4 h-4" />
            {job.time_remaining}
          </div>
        )}
      </div>

      {/* Customer & Vehicle Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
        <div className="flex items-center gap-2 text-sm">
          <User className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{job.customer_name}</span>
          <span className="text-gray-500">({job.customer_phone_masked})</span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Car className="w-4 h-4 text-gray-400" />
          <span className="font-medium">{job.vehicle_number}</span>
          <span className="text-gray-500">
            {job.vehicle_make} {job.vehicle_model}
          </span>
        </div>
      </div>

      {/* Status Row */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <span className={`px-3 py-1 rounded-full text-xs font-semibold ${getStatusColor()}`}>
          {job.status === 'WORK_COMPLETED' ? 'Mechanic Work Completed' : 
           job.status === 'QC_PENDING' ? 'QC Pending' :
           job.status.replace(/_/g, ' ')}
        </span>
        
        {job.mechanic && (
          <div className="flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
            <Wrench className="w-3 h-3" />
            {job.mechanic.name}
          </div>
        )}

        {job.pickup_boy && (
          <div className="flex items-center gap-1 text-xs bg-green-50 text-green-700 px-2 py-1 rounded">
            <Truck className="w-3 h-3" />
            Pickup: {job.pickup_boy.name}
          </div>
        )}

        {job.pickup_required && !job.pickup_boy && (
          <div className="flex items-center gap-1 text-xs bg-yellow-50 text-yellow-700 px-2 py-1 rounded">
            <Truck className="w-3 h-3" />
            Pickup Not Assigned
          </div>
        )}

        {job.extra_work_pending && (
          <div className="flex items-center gap-1 text-xs bg-orange-50 text-orange-700 px-2 py-1 rounded animate-pulse">
            <DollarSign className="w-3 h-3" />
            Extra Work Pending
          </div>
        )}

        {job.qc_status === 'PENDING' && (job.status === 'COMPLETED' || job.status === 'QC_PENDING' || job.status === 'WORK_COMPLETED') && (
          <div className="flex items-center gap-1 text-xs bg-purple-50 text-purple-700 px-2 py-1 rounded">
            <AlertTriangle className="w-3 h-3" />
            QC Required
          </div>
        )}
      </div>

      {/* Image Status Indicators */}
      <div className="flex items-center gap-4 mb-3 py-2 px-3 bg-gray-50 rounded">
        <span className="text-xs font-semibold text-gray-600">Images:</span>
        <div className="flex items-center gap-1">
          {job.images.before ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <XCircle className="w-4 h-4 text-gray-300" />
          )}
          <span className="text-xs">Before</span>
        </div>
        <div className="flex items-center gap-1">
          {job.images.progress ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <XCircle className="w-4 h-4 text-gray-300" />
          )}
          <span className="text-xs">Progress</span>
        </div>
        <div className="flex items-center gap-1">
          {job.images.after ? (
            <CheckCircle className="w-4 h-4 text-green-600" />
          ) : (
            <XCircle className="w-4 h-4 text-gray-300" />
          )}
          <span className="text-xs">After</span>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
        <button
          onClick={() => router.push(`/dashboard/workshop_supervisor/jobs/${job.id}`)}
          className="btn btn-outline text-sm"
        >
          View Details
        </button>

        {/* QC Review Button - Show when status is WORK_COMPLETED or QC_PENDING and QC is pending */}
        {((job.status === 'WORK_COMPLETED' && job.qc_status === 'PENDING') || 
          (job.status === 'QC_PENDING' && job.qc_status === 'PENDING')) && (
          <button
            onClick={() => router.push(`/dashboard/workshop_supervisor/jobs/${job.id}/review`)}
            className="btn bg-purple-600 hover:bg-purple-700 text-white text-sm flex items-center gap-2"
          >
            <Eye className="w-4 h-4" />
            QC Review
          </button>
        )}

        {!job.mechanic && job.status === 'ASSIGNED' && (
          <button
            onClick={() => onQuickAction?.('assign', job.id)}
            className="btn btn-primary text-sm flex-1"
          >
            Assign Mechanic
          </button>
        )}

        {job.mechanic && job.status !== 'COMPLETED' && job.status !== 'WORK_COMPLETED' && (
          <button
            onClick={() => onQuickAction?.('reassign', job.id)}
            className="btn btn-outline text-sm"
          >
            Reassign
          </button>
        )}

        {job.extra_work_pending && (
          <button
            onClick={() => onQuickAction?.('approve-extra-work', job.id)}
            className="btn bg-orange-600 hover:bg-orange-700 text-white text-sm"
          >
            Approve Work
          </button>
        )}
      </div>
    </div>
  );
}

