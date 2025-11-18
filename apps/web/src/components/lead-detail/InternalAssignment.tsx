'use client';

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
    const supabase = createClient();

    try {
      const updateData: any = {
        updated_at: new Date().toISOString(),
      };

      if (type === 'mechanic') {
        updateData.assigned_mechanic_id = userId || null;
        updateData.mechanic_assigned_at = userId ? new Date().toISOString() : null;
      } else if (type === 'pickup') {
        updateData.assigned_pickup_boy_id = userId || null;
        updateData.pickup_assigned_at = userId ? new Date().toISOString() : null;
      } else if (type === 'supervisor') {
        updateData.assigned_supervisor_id = userId || null;
        updateData.supervisor_assigned_at = userId ? new Date().toISOString() : null;
      }

      const { error } = await supabase
        .from('service_leads')
        .update(updateData)
        .eq('id', lead.id);

      if (error) {
        console.error('Error assigning:', error);
        alert('Failed to assign');
        return;
      }

      // Create event
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from('lead_events').insert({
        lead_id: lead.id,
        event_type: `${type.toUpperCase()}_ASSIGNED`,
        event_description: `${type} assigned`,
        event_data: { [`${type}_id`]: userId },
        created_by: user?.id,
      });

      alert('✅ Assignment successful!');
      onUpdate?.();
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to assign');
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
        {/* Mechanic Assignment */}
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
                  - {new Date(lead.mechanic_assigned_at).toLocaleString()}
                </span>
              )}
            </div>
          )}
          {mechanics.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">No mechanics available</p>
          )}
        </div>

        {/* Pickup Boy Assignment */}
        {lead.pickup_required && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
              <Truck className="w-4 h-4" />
              Assign Pickup Boy
            </label>
            <div className="flex gap-2">
              <select
                value={selectedPickup}
                onChange={(e) => setSelectedPickup(e.target.value)}
                disabled={loading}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option value="">Select pickup boy...</option>
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
                    - {new Date(lead.pickup_assigned_at).toLocaleString()}
                  </span>
                )}
              </div>
            )}
            {pickupBoys.length === 0 && (
              <p className="text-sm text-gray-500 mt-2">No pickup boys available</p>
            )}
          </div>
        )}

        {/* Supervisor Assignment */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
            <Users className="w-4 h-4" />
            Assign Supervisor
          </label>
          <div className="flex gap-2">
            <select
              value={selectedSupervisor}
              onChange={(e) => setSelectedSupervisor(e.target.value)}
              disabled={loading}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
            >
              <option value="">Select supervisor...</option>
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
                  - {new Date(lead.supervisor_assigned_at).toLocaleString()}
                </span>
              )}
            </div>
          )}
          {supervisors.length === 0 && (
            <p className="text-sm text-gray-500 mt-2">No supervisors available</p>
          )}
        </div>

        {/* Assignment History */}
        {(lead.assigned_mechanic_id || lead.assigned_pickup_boy_id || lead.assigned_supervisor_id) && (
          <div className="pt-4 border-t border-gray-200">
            <h3 className="text-sm font-semibold text-gray-700 mb-2">Assignment History</h3>
            <div className="space-y-2 text-sm">
              {lead.assigned_mechanic_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Mechanic:</span>
                  <span className="font-medium">
                    {mechanics.find(m => m.id === lead.assigned_mechanic_id)?.full_name || 'Unknown'}
                  </span>
                </div>
              )}
              {lead.assigned_pickup_boy_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Pickup Boy:</span>
                  <span className="font-medium">
                    {pickupBoys.find(p => p.id === lead.assigned_pickup_boy_id)?.full_name || 'Unknown'}
                  </span>
                </div>
              )}
              {lead.assigned_supervisor_id && (
                <div className="flex justify-between">
                  <span className="text-gray-600">Supervisor:</span>
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

