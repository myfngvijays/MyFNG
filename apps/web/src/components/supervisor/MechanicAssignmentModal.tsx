'use client';

import React, { useState, useEffect } from 'react';
import { X, User, Loader2, Wrench, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface Mechanic {
  id: string;
  full_name: string;
  profile_image?: string | null;
  activeJobs: number;
}

interface MechanicAssignmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  leadId: string;
  leadNumber: string;
  onSuccess: () => void;
}

export default function MechanicAssignmentModal({
  isOpen,
  onClose,
  leadId,
  leadNumber,
  onSuccess
}: MechanicAssignmentModalProps) {
  const [mechanics, setMechanics] = useState<Mechanic[]>([]);
  const [selectedMechanicId, setSelectedMechanicId] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [fetchingMechanics, setFetchingMechanics] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      fetchMechanics();
    }
  }, [isOpen]);

  async function fetchMechanics() {
    try {
      setFetchingMechanics(true);
      const supabase = createClient();

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('id', user.id)
        .single();

      if (!userProfile?.workshop_id) return;

      // Fetch mechanics
      const { data: mechanicsData } = await supabase
        .from('users_login')
        .select(`
          id,
          full_name,
          profile_image,
          roles!inner(role_code)
        `)
        .eq('workshop_id', userProfile.workshop_id)
        .eq('roles.role_code', 'WORKSHOP_MECHANIC')
        .eq('is_active', true);

      if (mechanicsData) {
        // Get active job counts for each mechanic
        const mechanicsWithCounts = await Promise.all(
          mechanicsData.map(async (mechanic: any) => {
            const { count } = await supabase
              .from('service_leads')
              .select('*', { count: 'exact', head: true })
              .eq('assigned_mechanic_id', mechanic.id)
              .in('status', ['ASSIGNED', 'IN_PROGRESS']);

            return {
              id: mechanic.id,
              full_name: mechanic.full_name,
              profile_image: mechanic.profile_image,
              activeJobs: count || 0
            };
          })
        );

        // Sort by workload (least busy first)
        mechanicsWithCounts.sort((a, b) => a.activeJobs - b.activeJobs);
        setMechanics(mechanicsWithCounts);
      }
    } catch (error) {
      console.error('Error fetching mechanics:', error);
      setError('Failed to load mechanics');
    } finally {
      setFetchingMechanics(false);
    }
  }

  async function handleAssign() {
    if (!selectedMechanicId) {
      setError('Please select a mechanic');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const mechanicName = mechanics.find((m) => m.id === selectedMechanicId)?.full_name || 'selected mechanic';
      const ok = confirm(`Assign this lead to mechanic: ${mechanicName}?`);
      if (!ok) {
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/leads/${leadId}/assign-mechanic`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          mechanic_id: selectedMechanicId,
          notes: notes.trim() || undefined
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to assign mechanic');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Assignment error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold text-text-heading">Assign Mechanic</h2>
            <p className="text-sm text-gray-600 mt-1">Lead: {leadNumber}</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-4 overflow-y-auto flex-1">
          {fetchingMechanics ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary mx-auto" />
              <p className="text-sm text-gray-600 mt-2">Loading mechanics...</p>
            </div>
          ) : mechanics.length === 0 ? (
            <div className="text-center py-8">
              <Wrench className="w-12 h-12 text-gray-400 mx-auto mb-2" />
              <p className="text-gray-600">No mechanics available</p>
            </div>
          ) : (
            <>
              {/* Mechanic Selection */}
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  Select Mechanic
                </label>
                {mechanics.map((mechanic) => (
                  <div
                    key={mechanic.id}
                    onClick={() => setSelectedMechanicId(mechanic.id)}
                    className={`
                      p-4 border-2 rounded-lg cursor-pointer transition-all
                      ${selectedMechanicId === mechanic.id
                        ? 'border-brand-primary bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                      }
                    `}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {mechanic.profile_image ? (
                          <img
                            src={mechanic.profile_image}
                            alt={mechanic.full_name}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center">
                            <User className="w-5 h-5 text-white" />
                          </div>
                        )}
                        <div>
                          <p className="font-semibold text-text-heading">
                            {mechanic.full_name}
                          </p>
                          <p className="text-sm text-gray-600">
                            {mechanic.activeJobs} active job{mechanic.activeJobs !== 1 ? 's' : ''}
                          </p>
                        </div>
                      </div>
                      {selectedMechanicId === mechanic.id && (
                        <CheckCircle className="w-6 h-6 text-brand-primary" />
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Notes */}
              <div className="mt-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Assignment Notes (Optional)
                </label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add any special instructions or notes..."
                  rows={3}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                />
              </div>
            </>
          )}

          {/* Error Message */}
          {error && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            disabled={loading}
            className="btn btn-outline"
          >
            Cancel
          </button>
          <button
            onClick={handleAssign}
            disabled={loading || !selectedMechanicId || fetchingMechanics}
            className="btn btn-primary flex items-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            Assign Mechanic
          </button>
        </div>
      </div>
    </div>
  );
}

