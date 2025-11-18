'use client';

/**
 * Status Transition Button Component
 * Allows transitioning lead status with validation
 * Task: WA-301
 */

import { useState } from 'react';
import { 
  getAvailableTransitions, 
  getStatusLabel, 
  getStatusColor, 
  getStatusIcon,
  type LeadStatus,
  type UserRole 
} from '@/lib/services/leadStatusService';
import { ChevronRight, Loader2 } from 'lucide-react';

interface StatusTransitionButtonProps {
  leadId: string;
  currentStatus: LeadStatus;
  userRole: UserRole;
  onStatusChanged?: (newStatus: LeadStatus) => void;
}

export default function StatusTransitionButton({
  leadId,
  currentStatus,
  userRole,
  onStatusChanged,
}: StatusTransitionButtonProps) {
  const [loading, setLoading] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [notes, setNotes] = useState('');
  const [selectedStatus, setSelectedStatus] = useState<LeadStatus | null>(null);

  const availableTransitions = getAvailableTransitions(currentStatus, userRole);

  if (availableTransitions.length === 0) {
    return null; // No transitions available
  }

  async function handleStatusChange(newStatus: LeadStatus) {
    setLoading(true);
    try {
      const response = await fetch(`/api/leads/${leadId}/status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          newStatus,
          notes: notes.trim() || undefined,
        }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`✅ Status updated to ${getStatusLabel(newStatus)}`);
        setShowMenu(false);
        setSelectedStatus(null);
        setNotes('');
        onStatusChanged?.(newStatus);
      } else {
        alert(`❌ Error: ${result.error}`);
      }
    } catch (error) {
      console.error('Error updating status:', error);
      alert('❌ Failed to update status');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        disabled={loading}
        className="btn btn-primary flex items-center gap-2"
      >
        {loading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            Updating...
          </>
        ) : (
          <>
            Update Status
            <ChevronRight className="w-4 h-4" />
          </>
        )}
      </button>

      {showMenu && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 z-40" 
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu */}
          <div className="absolute top-full mt-2 right-0 bg-white rounded-lg shadow-xl border border-gray-200 z-50 min-w-[250px]">
            <div className="p-3 border-b border-gray-200">
              <p className="text-sm font-semibold text-gray-700">Change Status To:</p>
            </div>
            
            <div className="p-2">
              {availableTransitions.map((status) => {
                const colors = getStatusColor(status);
                const icon = getStatusIcon(status);
                
                return (
                  <button
                    key={status}
                    onClick={() => setSelectedStatus(status)}
                    className={`w-full text-left px-3 py-2 rounded hover:bg-gray-50 flex items-center gap-2 transition ${
                      selectedStatus === status ? 'bg-gray-100' : ''
                    }`}
                  >
                    <span className="text-lg">{icon}</span>
                    <span className="font-medium">{getStatusLabel(status)}</span>
                  </button>
                );
              })}
            </div>

            {selectedStatus && (
              <div className="p-3 border-t border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any notes about this status change..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-brand-primary focus:border-transparent resize-none"
                  rows={3}
                />
                
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={() => {
                      setSelectedStatus(null);
                      setNotes('');
                    }}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => handleStatusChange(selectedStatus)}
                    disabled={loading}
                    className="flex-1 px-3 py-2 bg-brand-primary text-white rounded-lg text-sm font-medium hover:bg-brand-primary/90 disabled:opacity-50"
                  >
                    {loading ? 'Updating...' : 'Confirm'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

