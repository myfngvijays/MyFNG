'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, Wrench, Eye, Truck, CheckCircle, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface TeamMember {
  id: string;
  name: string;
  email: string;
  phone: string;
  role: string;
}

export default function AssignTeamPage() {
  const router = useRouter();
  const params = useParams();
  const leadId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [mechanics, setMechanics] = useState<TeamMember[]>([]);
  const [supervisors, setSupervisors] = useState<TeamMember[]>([]);
  const [pickupBoys, setPickupBoys] = useState<TeamMember[]>([]);
  
  const [selectedMechanic, setSelectedMechanic] = useState('');
  const [selectedSupervisor, setSelectedSupervisor] = useState('');
  const [selectedPickupBoy, setSelectedPickupBoy] = useState('');
  const [notes, setNotes] = useState('');
  
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, [leadId]);

  async function fetchData() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      if (!userProfile?.workshop_id) {
        toast.error('Workshop not found');
        return;
      }

      // Fetch lead details
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select('*')
        .eq('id', leadId)
        .single();

      if (leadError || !leadData) {
        toast.error('Lead not found');
        router.push('/dashboard/workshop_admin');
        return;
      }

      setLead(leadData);

      // Fetch available mechanics
      const { data: mechanicsData } = await supabase
        .from('users_login')
        .select('id, name, email, phone, role')
        .eq('workshop_id', userProfile.workshop_id)
        .eq('role', 'workshop_mechanic')
        .eq('is_active', true);

      // Fetch available supervisors
      const { data: supervisorsData } = await supabase
        .from('users_login')
        .select('id, name, email, phone, role')
        .eq('workshop_id', userProfile.workshop_id)
        .eq('role', 'workshop_supervisor')
        .eq('is_active', true);

      // Fetch available pickup boys
      const { data: pickupBoysData } = await supabase
        .from('users_login')
        .select('id, name, email, phone, role')
        .eq('workshop_id', userProfile.workshop_id)
        .eq('role', 'workshop_pickup_boy')
        .eq('is_active', true);

      setMechanics(mechanicsData || []);
      setSupervisors(supervisorsData || []);
      setPickupBoys(pickupBoysData || []);

    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Failed to load data');
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (!selectedMechanic) {
      toast.error('Please select a mechanic');
      return;
    }

    if (lead?.pickup_required && !selectedPickupBoy) {
      toast.error('Pickup boy is required for this lead');
      return;
    }

    setSubmitting(true);

    try {
      const response = await fetch(`/api/workshop/leads/${leadId}/assign-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mechanic_id: selectedMechanic,
          supervisor_id: selectedSupervisor || null,
          pickup_boy_id: selectedPickupBoy || null,
          notes: notes
        })
      });

      const data = await response.json();

      if (!response.ok) {
        toast.error(data.error || 'Failed to assign team');
        return;
      }

      toast.success('Team assigned successfully!');
      setTimeout(() => {
        router.push(`/dashboard/workshop_admin/leads/${leadId}`);
      }, 1000);

    } catch (error) {
      console.error('Error assigning team:', error);
      toast.error('Failed to assign team');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="card text-center py-12">
          <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-gray-700">Lead not found</h3>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_admin">
      <div className="space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg">
          <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">👥 Assign Team Members</h1>
          <p className="text-white font-medium mt-1">Lead: {lead.lead_number}</p>
        </div>

        {/* Lead Summary */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-4">Lead Details</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Customer</p>
              <p className="font-semibold">{lead.customer_name}</p>
            </div>
            <div>
              <p className="text-gray-500">Vehicle</p>
              <p className="font-semibold">{lead.vehicle_number}</p>
            </div>
            <div>
              <p className="text-gray-500">Model</p>
              <p className="font-semibold">{lead.vehicle_make} {lead.vehicle_model}</p>
            </div>
            <div>
              <p className="text-gray-500">Pickup</p>
              <p className="font-semibold">{lead.pickup_required ? '✅ Required' : '❌ Not Required'}</p>
            </div>
          </div>
        </div>

        {/* Assignment Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Mechanic Selection */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <Wrench className="w-6 h-6 text-brand-primary" />
              <h3 className="text-lg font-semibold">
                Select Mechanic <span className="text-red-500">*</span>
              </h3>
            </div>

            {mechanics.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <p>No mechanics available</p>
                <p className="text-sm mt-2">Please add mechanics to your workshop first</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mechanics.map((mechanic) => (
                  <div
                    key={mechanic.id}
                    onClick={() => setSelectedMechanic(mechanic.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                      selectedMechanic === mechanic.id
                        ? 'border-brand-primary bg-blue-50'
                        : 'border-gray-200 hover:border-brand-primary hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {selectedMechanic === mechanic.id && (
                        <CheckCircle className="w-5 h-5 text-brand-primary" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold">{mechanic.name}</p>
                        <p className="text-sm text-gray-600">{mechanic.phone}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Supervisor Selection (Optional) */}
          <div className="card">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold">
                Select Supervisor <span className="text-gray-400 text-sm">(Optional)</span>
              </h3>
            </div>

            {supervisors.length === 0 ? (
              <div className="text-center py-6 text-gray-500 text-sm">
                No supervisors available - Job will proceed without supervisor QC
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {supervisors.map((supervisor) => (
                  <div
                    key={supervisor.id}
                    onClick={() => setSelectedSupervisor(supervisor.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                      selectedSupervisor === supervisor.id
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-gray-200 hover:border-purple-600 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {selectedSupervisor === supervisor.id && (
                        <CheckCircle className="w-5 h-5 text-purple-600" />
                      )}
                      <div className="flex-1">
                        <p className="font-semibold">{supervisor.name}</p>
                        <p className="text-sm text-gray-600">{supervisor.phone}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Pickup Boy Selection (Conditional) */}
          {lead.pickup_required && (
            <div className="card">
              <div className="flex items-center gap-3 mb-4">
                <Truck className="w-6 h-6 text-orange-600" />
                <h3 className="text-lg font-semibold">
                  Select Pickup Boy <span className="text-red-500">*</span>
                </h3>
              </div>

              {pickupBoys.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <p>No pickup boys available</p>
                  <p className="text-sm mt-2 text-red-600">Pickup is required for this lead!</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pickupBoys.map((pickupBoy) => (
                    <div
                      key={pickupBoy.id}
                      onClick={() => setSelectedPickupBoy(pickupBoy.id)}
                      className={`p-4 border-2 rounded-lg cursor-pointer transition ${
                        selectedPickupBoy === pickupBoy.id
                          ? 'border-orange-600 bg-orange-50'
                          : 'border-gray-200 hover:border-orange-600 hover:bg-gray-50'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        {selectedPickupBoy === pickupBoy.id && (
                          <CheckCircle className="w-5 h-5 text-orange-600" />
                        )}
                        <div className="flex-1">
                          <p className="font-semibold">{pickupBoy.name}</p>
                          <p className="text-sm text-gray-600">{pickupBoy.phone}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Notes */}
          <div className="card">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Additional Notes (Optional)
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="input w-full"
              rows={3}
              placeholder="Any special instructions or notes for the team..."
            />
          </div>

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting || !selectedMechanic || (lead.pickup_required && !selectedPickupBoy)}
              className="btn-primary flex-1"
            >
              {submitting ? 'Assigning Team...' : 'Assign Team & Start Job'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={submitting}
              className="btn-secondary"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </DashboardLayout>
  );
}

