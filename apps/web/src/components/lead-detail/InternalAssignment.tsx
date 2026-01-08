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
      const getNameById = (list: any[], id: string) =>
        (list || []).find((x) => String(x?.id) === String(id))?.full_name || '';

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
        const mechanicName = getNameById(mechanics, userId) || 'selected mechanic';
        if (!confirm(`Assign this lead to mechanic: ${mechanicName}?`)) {
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
        if (!userId) {
          alert('Please select a pickupboy/driver');
          setLoading(false);
          return;
        }
        const pickupName = getNameById(pickupBoys, userId) || 'selected pickupboy/driver';
        if (!confirm(`Assign this lead to pickupboy/driver: ${pickupName}?`)) {
          setLoading(false);
          return;
        }
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

  // Prepare assignment rows for table
  const assignmentRows = [
    ...(lead.pickup_required ? [{
      type: 'pickup' as const,
      label: 'Pickupboy/Driver',
      icon: Truck,
      selected: selectedPickup,
      setSelected: setSelectedPickup,
      assignedId: lead.assigned_pickup_boy_id,
      assignedAt: lead.pickup_assigned_at,
      options: pickupBoys,
      emptyMessage: 'No pickupboys/drivers available'
    }] : []),
    {
      type: 'mechanic' as const,
      label: 'Mechanic',
      icon: UserCheck,
      selected: selectedMechanic,
      setSelected: setSelectedMechanic,
      assignedId: lead.assigned_mechanic_id,
      assignedAt: lead.mechanic_assigned_at,
      options: mechanics,
      emptyMessage: 'No mechanics available'
    },
    {
      type: 'supervisor' as const,
      label: 'Adviser',
      icon: Users,
      selected: selectedSupervisor,
      setSelected: setSelectedSupervisor,
      assignedId: lead.assigned_supervisor_id,
      assignedAt: lead.supervisor_assigned_at,
      options: supervisors,
      emptyMessage: 'No advisers available'
    }
  ];

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <Users className="w-5 h-5 text-brand-primary" />
        Internal Assignment
      </h2>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Role</th>
              <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Assign</th>
              <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
              <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Action</th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {assignmentRows.map((row) => {
              const Icon = row.icon;
              const assignedPerson = row.options.find((p: any) => p.id === row.assignedId);
              
              return (
                <tr key={row.type} className="hover:bg-gray-50">
                  {/* Role */}
                  <td className="px-4 md:px-6 py-3 md:py-4">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4 text-gray-600" />
                      <span className="text-xs sm:text-sm font-medium text-gray-900">{row.label}</span>
                    </div>
                  </td>

                  {/* Assign Dropdown */}
                  <td className="px-4 md:px-6 py-3 md:py-4">
              <select
                      value={row.selected}
                      onChange={(e) => row.setSelected(e.target.value)}
                disabled={loading}
                      className="w-full px-3 py-1.5 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent disabled:opacity-50"
              >
                      <option value="">Select {row.label.toLowerCase()}...</option>
                      {row.options.map((option: any) => (
                        <option key={option.id} value={option.id}>
                          {option.full_name}
                  </option>
                ))}
              </select>
                    {row.options.length === 0 && (
                      <p className="text-xs text-gray-500 mt-1">{row.emptyMessage}</p>
                )}
                  </td>

                  {/* Status */}
                  <td className="px-4 md:px-6 py-3 md:py-4">
                    {row.assignedId && assignedPerson ? (
                      <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1 text-xs sm:text-sm text-green-600">
                          <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
                          <span className="font-medium">{assignedPerson.full_name}</span>
          </div>
                        {row.assignedAt && (
                          <span className="text-[10px] sm:text-xs text-gray-500">
                            {formatDateTime(row.assignedAt)}
                </span>
              )}
            </div>
                    ) : (
                      <span className="text-xs sm:text-sm text-gray-400">Not assigned</span>
          )}
                  </td>

                  {/* Action */}
                  <td className="px-4 md:px-6 py-3 md:py-4">
            <button
                      onClick={() => handleAssignment(row.type, row.selected)}
                      disabled={loading || !row.selected}
                      className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm rounded font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
            >
                      <CheckCircle className="w-3 h-3 sm:w-4 sm:h-4" />
              Assign
            </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

