'use client';

import { formatDateTime } from "@/lib/utils";
/**
 * Internal Assignment Section
 * Assign mechanics, supervisors, and pickup boys to leads
 * Task: WA-501
 */

import { useState, useEffect } from 'react';
import { Users, UserCheck, Truck, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface InternalAssignmentProps {
  lead: any;
  onUpdate?: () => void;
}

export default function InternalAssignment({ lead, onUpdate }: InternalAssignmentProps) {
  const [mechanics, setMechanics] = useState<any[]>([]);
  const [pickupBoys, setPickupBoys] = useState<any[]>([]);
  const [supervisors, setSupervisors] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedMechanic, setSelectedMechanic] = useState(lead.assigned_mechanic_id || '');
  const [selectedPickup, setSelectedPickup] = useState(lead.assigned_pickup_boy_id || '');
  const [selectedSupervisor, setSelectedSupervisor] = useState(lead.assigned_supervisor_id || '');

  useEffect(() => {
    if (lead.workshop_id) {
      fetchStaff();
    }
  }, [lead.workshop_id]);

  async function fetchStaff() {
    const supabase = createClient();

    try {
      // Fetch roles first
      const { data: rolesData } = await supabase
        .from('roles')
        .select('id, role_code')
        .in('role_code', ['WORKSHOP_MECHANIC', 'WORKSHOP_PICKUP_BOY', 'WORKSHOP_SUPERVISOR']);

      const roleMap = (rolesData || []).reduce((acc: any, role: any) => {
        acc[role.role_code] = role.id;
        return acc;
      }, {});

      // Fetch mechanics
      const { data: mechanicsData } = await supabase
        .from('users_login')
        .select('id, full_name, email')
        .eq('workshop_id', lead.workshop_id)
        .eq('role_id', roleMap['WORKSHOP_MECHANIC'])
        .eq('is_active', true);

      // Fetch pickup boys
      const { data: pickupData } = await supabase
        .from('users_login')
        .select('id, full_name, email')
        .eq('workshop_id', lead.workshop_id)
        .eq('role_id', roleMap['WORKSHOP_PICKUP_BOY'])
        .eq('is_active', true);

      // Fetch supervisors
      const { data: supervisorsData } = await supabase
        .from('users_login')
        .select('id, full_name, email')
        .eq('workshop_id', lead.workshop_id)
        .eq('role_id', roleMap['WORKSHOP_SUPERVISOR'])
        .eq('is_active', true);

      setMechanics(mechanicsData || []);
      setPickupBoys(pickupData || []);
      setSupervisors(supervisorsData || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
    }
  }

  async function handleAssignment(type: 'mechanic' | 'pickup' | 'supervisor', userId: string) {
    setLoading(true);

    try {
      // Use the proper API endpoint for team assignment
      // This ensures mechanic_jobs entry is created/updated
      const requestBody: any = {
        notes: `Assigned via Internal Assignment component`
      };

      if (type === 'mechanic') {
        if (!userId) {
          alert('Please select a mechanic');
          setLoading(false);
          return;
        }
        requestBody.mechanic_id = userId;
        // Keep existing supervisor/pickup if already assigned
        if (lead.assigned_supervisor_id) {
          requestBody.supervisor_id = lead.assigned_supervisor_id;
        }
        if (lead.assigned_pickup_boy_id) {
          requestBody.pickup_boy_id = lead.assigned_pickup_boy_id;
        }
      } else if (type === 'pickup') {
        requestBody.pickup_boy_id = userId || null;
        // Keep existing mechanic/supervisor if already assigned
        if (lead.assigned_mechanic_id) {
          requestBody.mechanic_id = lead.assigned_mechanic_id;
        }
        if (lead.assigned_supervisor_id) {
          requestBody.supervisor_id = lead.assigned_supervisor_id;
        }
      } else if (type === 'supervisor') {
        requestBody.supervisor_id = userId || null;
        // Keep existing mechanic/pickup if already assigned
        if (lead.assigned_mechanic_id) {
          requestBody.mechanic_id = lead.assigned_mechanic_id;
        }
        if (lead.assigned_pickup_boy_id) {
          requestBody.pickup_boy_id = lead.assigned_pickup_boy_id;
        }
      }

      // Mechanic assignment requires mechanic_id
      if (type === 'mechanic' && !requestBody.mechanic_id) {
        alert('Mechanic ID is required');
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/workshop/leads/${lead.id}/assign-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error assigning team:', data);
        alert(`Failed to assign: ${data.error || 'Unknown error'}`);
        setLoading(false);
        return;
      }

      alert('✅ Assignment successful!');
      onUpdate?.();
    } catch (error: any) {
      console.error('❌ [INTERNAL-ASSIGNMENT] Unexpected error:', error);
      alert(`Failed to assign: ${error.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-brand-primary" />
        Internal Assignment
      </h2>

      <div className="space-y-6">
        {/* Pickup Boy Assignment - First */}
        {lead.pickup_required && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Assign Pickupboy/Driver
            </label>
            <div className="flex gap-2">
              <select
                value={selectedPickup}
                onChange={(e) => setSelectedPickup(e.target.value)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option value="">Select pickupboy/driver...</option>
                {pickupBoys.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.full_name}
                  </option>
                ))}
              </select>
              <button
                onClick={() => handleAssignment('pickup', selectedPickup)}
                disabled={loading || !selectedPickup}
                className="btn btn-primary disabled:opacity-50"
              >
                <CheckCircle className="w-4 h-4" />
                Assign
              </button>
            </div>
            {lead.assigned_pickup_boy_id && (
              <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
                <CheckCircle className="w-4 h-4" />
                Currently assigned
                {lead.pickup_assigned_at && (
                  <span className="text-gray-500">
                    - {formatDateTime(lead.pickup_assigned_at)}
                  </span>
                )}
              </div>
            )}
            {pickupBoys.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">No pickupboys/drivers available</p>
            )}
          </div>
        )}

        {/* Mechanic Assignment - Second */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <UserCheck className="w-4 h-4" />
            Assign Mechanic
          </label>
          <div className="flex gap-2">
            <select
              value={selectedMechanic}
              onChange={(e) => setSelectedMechanic(e.target.value)}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            >
              <option value="">Select mechanic...</option>
              {mechanics.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleAssignment('mechanic', selectedMechanic)}
              disabled={loading || !selectedMechanic}
              className="btn btn-primary disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Assign
            </button>
          </div>
          {lead.assigned_mechanic_id && (
            <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Currently assigned
              {lead.mechanic_assigned_at && (
                <span className="text-gray-500">
                  - {formatDateTime(lead.mechanic_assigned_at)}
                </span>
              )}
            </div>
          )}
          {mechanics.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">No mechanics available</p>
          )}
        </div>

        {/* Supervisor Assignment - Third */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Assign Adviser
          </label>
          <div className="flex gap-2">
            <select
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            >
              <option value="">Select adviser...</option>
              {supervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.full_name}
                </option>
              ))}
            </select>
            <button
              onClick={() => handleAssignment('supervisor', selectedSupervisor)}
              disabled={loading || !selectedSupervisor}
              className="btn btn-primary disabled:opacity-50"
            >
              <CheckCircle className="w-4 h-4" />
              Assign
            </button>
          </div>
          {lead.assigned_supervisor_id && (
            <div className="mt-2 text-sm text-green-600 flex items-center gap-1">
              <CheckCircle className="w-4 h-4" />
              Currently assigned
              {lead.supervisor_assigned_at && (
                <span className="text-gray-500">
                  - {formatDateTime(lead.supervisor_assigned_at)}
                </span>
              )}
            </div>
          )}
          {supervisors.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">No advisers available</p>
          )}
        </div>

        {/* Assignment History */}
        {(lead.assigned_mechanic_id || lead.assigned_pickup_boy_id || lead.assigned_supervisor_id) && (
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Assignment History</h3>
            <div className="space-y-2 text-sm">
              {lead.assigned_pickup_boy_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Pickupboy/Driver:</span>
                  <span className="font-medium">
                    {pickupBoys.find(p => p.id === lead.assigned_pickup_boy_id)?.full_name || 'Unknown'}
                  </span>
                </div>
              )}
              {lead.assigned_mechanic_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Mechanic:</span>
                  <span className="font-medium">
                    {mechanics.find(m => m.id === lead.assigned_mechanic_id)?.full_name || 'Unknown'}
                  </span>
                </div>
              )}
              {lead.assigned_supervisor_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Adviser:</span>
                  <span className="font-medium">
                    {supervisors.find(s => s.id === lead.assigned_supervisor_id)?.full_name || 'Unknown'}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

