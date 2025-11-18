'use client';

/**
 * Lead Card Component for Workshop Admin
 * Displays lead information with SLA tracking
 * Task: WA-201
 */

import { useState, useEffect } from 'react';
import { Clock, MapPin, Phone, Car, AlertCircle, CheckCircle, XCircle } from 'lucide-react';
import { 
  getSLAColor, 
  getSLABackgroundColor, 
  getTimeRemaining, 
  formatTimeRemaining,
  getTimeSince,
  calculateLeadSLAStatus,
  type SLAStatus 
} from '@/lib/services/slaService';

interface LeadCardProps {
  lead: {
    id: string;
    lead_number: string;
    lead_type: 'NORMAL' | 'RSA' | 'HOME_SERVICE';
    customer_name: string;
    customer_phone: string;
    vehicle_number: string;
    vehicle_make?: string;
    vehicle_model?: string;
    service_type: string;
    status: string;
    priority: string;
    pickup_required?: boolean;
    preferred_time_slot?: string;
    distance_from_workshop?: number;
    created_at: string;
    assigned_at?: string;
    accepted_at?: string;
    sla_accept_deadline?: string;
    sla_assign_deadline?: string;
    sla_start_deadline?: string;
    sla_status?: SLAStatus;
    assigned_mechanic_id?: string;
    estimated_amount?: number;
  };
  onAccept?: (leadId: string) => void;
  onReject?: (leadId: string) => void;
  onView?: (leadId: string) => void;
}

export default function LeadCard({ lead, onAccept, onReject, onView }: LeadCardProps) {
  const [phoneVisible, setPhoneVisible] = useState(false);
  const [timeRemaining, setTimeRemaining] = useState<any>(null);
  const [slaStatus, setSlaStatus] = useState<SLAStatus>('ON_TIME');

  // Update SLA status and time remaining every second
  useEffect(() => {
    const updateSLA = () => {
      const status = calculateLeadSLAStatus({
        status: lead.status,
        assigned_at: lead.assigned_at || null,
        accepted_at: lead.accepted_at || null,
        sla_accept_deadline: lead.sla_accept_deadline || null,
        sla_assign_deadline: lead.sla_assign_deadline || null,
        sla_start_deadline: lead.sla_start_deadline || null,
        assigned_mechanic_id: lead.assigned_mechanic_id || null,
        lead_type: lead.lead_type,
      });
      setSlaStatus(status);

      // Get time remaining for current deadline
      if (lead.status === 'ASSIGNED' && lead.sla_accept_deadline) {
        const remaining = getTimeRemaining(new Date(lead.sla_accept_deadline), lead.lead_type);
        setTimeRemaining(remaining);
      } else if (lead.status === 'ACCEPTED' && lead.sla_assign_deadline) {
        const remaining = getTimeRemaining(new Date(lead.sla_assign_deadline), lead.lead_type);
        setTimeRemaining(remaining);
      }
    };

    updateSLA();
    const interval = setInterval(updateSLA, 1000); // Update every second

    return () => clearInterval(interval);
  }, [lead]);

  const maskPhone = (phone: string) => {
    if (phone.length < 4) return phone;
    return '••••' + phone.slice(-4);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'NEW': return 'bg-blue-100 text-blue-800';
      case 'ASSIGNED': return 'bg-yellow-100 text-yellow-800';
      case 'ACCEPTED': return 'bg-green-100 text-green-800';
      case 'REJECTED': return 'bg-red-100 text-red-800';
      case 'IN_PROGRESS': return 'bg-purple-100 text-purple-800';
      case 'COMPLETED': return 'bg-gray-100 text-gray-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'URGENT': return 'bg-red-100 text-red-800';
      case 'HIGH': return 'bg-orange-100 text-orange-800';
      case 'MEDIUM': return 'bg-yellow-100 text-yellow-800';
      case 'LOW': return 'bg-green-100 text-green-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getLeadTypeLabel = (type: string) => {
    switch (type) {
      case 'NORMAL': return 'Normal Service';
      case 'RSA': return 'RSA (Urgent)';
      case 'HOME_SERVICE': return 'Home Service';
      default: return type;
    }
  };

  return (
    <div 
      className="bg-white rounded-lg shadow-md hover:shadow-lg transition-shadow p-4 border-l-4 cursor-pointer"
      style={{ borderLeftColor: getSLAColor(slaStatus) }}
      onClick={() => onView?.(lead.id)}
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="text-lg font-bold text-gray-900">{lead.lead_number}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${getStatusColor(lead.status)}`}>
              {lead.status.replace('_', ' ')}
            </span>
          </div>
          <p className="text-xs text-gray-500 flex items-center gap-1">
            <Clock className="w-3 h-3" />
            {getTimeSince(lead.created_at)}
          </p>
        </div>

        {/* SLA Indicator */}
        <div 
          className="flex flex-col items-end gap-1 px-3 py-2 rounded-lg"
          style={{ backgroundColor: getSLABackgroundColor(slaStatus) }}
        >
          <div className="flex items-center gap-1">
            {slaStatus === 'ON_TIME' && <CheckCircle className="w-4 h-4" style={{ color: getSLAColor(slaStatus) }} />}
            {slaStatus === 'AT_RISK' && <AlertCircle className="w-4 h-4" style={{ color: getSLAColor(slaStatus) }} />}
            {slaStatus === 'BREACHED' && <XCircle className="w-4 h-4" style={{ color: getSLAColor(slaStatus) }} />}
            <span className="text-xs font-semibold" style={{ color: getSLAColor(slaStatus) }}>
              {slaStatus.replace('_', ' ')}
            </span>
          </div>
          {timeRemaining && (
            <span className="text-xs font-mono" style={{ color: getSLAColor(slaStatus) }}>
              {formatTimeRemaining(timeRemaining)}
            </span>
          )}
        </div>
      </div>

      {/* Customer Info */}
      <div className="mb-3 pb-3 border-b border-gray-100">
        <p className="font-semibold text-gray-900 mb-1">{lead.customer_name}</p>
        <div className="flex items-center gap-2 text-sm text-gray-600">
          <Phone className="w-4 h-4" />
          {phoneVisible ? (
            <a href={`tel:${lead.customer_phone}`} className="text-blue-600 hover:underline">
              {lead.customer_phone}
            </a>
          ) : (
            <button 
              onClick={(e) => {
                e.stopPropagation();
                setPhoneVisible(true);
              }}
              className="text-gray-600 hover:text-blue-600"
            >
              {maskPhone(lead.customer_phone)} (Click to reveal)
            </button>
          )}
        </div>
      </div>

      {/* Vehicle Info */}
      <div className="mb-3 pb-3 border-b border-gray-100">
        <div className="flex items-center gap-2 text-sm">
          <Car className="w-4 h-4 text-gray-400" />
          <span className="font-semibold text-gray-900">{lead.vehicle_number}</span>
          {lead.vehicle_make && (
            <span className="text-gray-600">
              {lead.vehicle_make} {lead.vehicle_model}
            </span>
          )}
        </div>
      </div>

      {/* Service Details */}
      <div className="mb-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Service Type:</span>
          <span className="font-medium text-gray-900">{lead.service_type}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Lead Type:</span>
          <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded">
            {getLeadTypeLabel(lead.lead_type)}
          </span>
        </div>

        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600">Priority:</span>
          <span className={`text-xs px-2 py-1 rounded font-semibold ${getPriorityColor(lead.priority)}`}>
            {lead.priority}
          </span>
        </div>

        {lead.pickup_required && (
          <div className="flex items-center gap-1 text-sm text-orange-600">
            <MapPin className="w-4 h-4" />
            <span className="font-medium">Pickup Required</span>
          </div>
        )}

        {lead.distance_from_workshop && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Distance:</span>
            <span className="font-medium text-gray-900">{lead.distance_from_workshop.toFixed(1)} km</span>
          </div>
        )}

        {lead.estimated_amount && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Estimated Amount:</span>
            <span className="font-bold text-green-600">₹{lead.estimated_amount.toFixed(2)}</span>
          </div>
        )}

        {lead.preferred_time_slot && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Preferred Slot:</span>
            <span className="font-medium text-gray-900">{lead.preferred_time_slot}</span>
          </div>
        )}
      </div>

      {/* Actions */}
      {lead.status === 'ASSIGNED' && (
        <div className="flex gap-2 mt-4 pt-3 border-t border-gray-100">
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAccept?.(lead.id);
            }}
            className="flex-1 bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <CheckCircle className="w-4 h-4" />
            Accept
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              onReject?.(lead.id);
            }}
            className="flex-1 bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors flex items-center justify-center gap-2"
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
        </div>
      )}

      {lead.status !== 'ASSIGNED' && (
        <button
          onClick={(e) => {
            e.stopPropagation();
            onView?.(lead.id);
          }}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg font-semibold text-sm transition-colors mt-4"
        >
          View Details
        </button>
      )}
    </div>
  );
}

