'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { Wrench, Eye, Truck, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';
import {
  WorkshopPageHeader,
  WorkshopPageShell,
  WorkshopEmpty,
} from '@/components/workshop/WorkshopUi';

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

    const mechanicName = mechanics.find((m) => m.id === selectedMechanic)?.name || 'selected mechanic';
    const pickupName = lead?.pickup_required
      ? (pickupBoys.find((p) => p.id === selectedPickupBoy)?.name || 'selected pickup boy')
      : '';
    const ok = confirm(
      lead?.pickup_required
        ? `Confirm assignment:\n\nMechanic: ${mechanicName}\nPickup Boy: ${pickupName}\n\nProceed?`
        : `Confirm assignment:\n\nMechanic: ${mechanicName}\n\nProceed?`
    );
    if (!ok) return;

    setSubmitting(true);

    try {
      const requestBody = {
        mechanic_id: selectedMechanic,
        supervisor_id: selectedSupervisor || null,
        pickup_boy_id: selectedPickupBoy || null,
        notes: notes
      };
      
      const response = await fetch(`/api/workshop/leads/${leadId}/assign-team`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody)
      });

      const data = await response.json();

      if (!response.ok) {
        console.error('Error assigning team:', data);
        toast.error(data.error || 'Failed to assign team');
        return;
      }

      toast.success('Team assigned successfully!');
      setTimeout(() => {
        router.push(`/dashboard/workshop_admin/leads/${leadId}`);
      }, 1000);

    } catch (error: any) {
      console.error('Unexpected error:', error);
      toast.error('Failed to assign team: ' + (error?.message || 'Unknown error'));
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
        <WorkshopPageShell>
          <WorkshopPageHeader eyebrow="Workshop Owner" title="Assign Team" subtitle="Lead not found" />
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <WorkshopEmpty>Lead not found</WorkshopEmpty>
          </div>
        </WorkshopPageShell>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_admin">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Workshop Owner"
          title="Assign Team Members"
          subtitle={`Lead: ${lead.lead_number}`}
        />

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <Wrench className="w-6 h-6 text-[#004AAD]" />
              <h3 className="text-lg font-semibold">
                Select Mechanic <span className="text-red-500">*</span>
              </h3>
            </div>

            {mechanics.length === 0 ? (
              <WorkshopEmpty>No mechanics available. Add mechanics to your workshop first.</WorkshopEmpty>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {mechanics.map((mechanic) => (
                  <div
                    key={mechanic.id}
                    onClick={() => setSelectedMechanic(mechanic.id)}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition ${
                      selectedMechanic === mechanic.id
                        ? 'border-[#004AAD] bg-blue-50'
                        : 'border-slate-200 hover:border-[#004AAD] hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      {selectedMechanic === mechanic.id && (
                        <CheckCircle className="w-5 h-5 text-[#004AAD]" />
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <div className="flex items-center gap-3 mb-4">
              <Eye className="w-6 h-6 text-purple-600" />
              <h3 className="text-lg font-semibold">
                Select Adviser <span className="text-gray-400 text-sm">(Optional)</span>
              </h3>
            </div>

            {supervisors.length === 0 ? (
              <WorkshopEmpty>No advisers available — job will proceed without adviser QC</WorkshopEmpty>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {supervisors.map((supervisor) => (
                  <div
                    key={supervisor.id}
                    onClick={() => setSelectedSupervisor(supervisor.id)}
                    className={`p-4 border-2 rounded-xl cursor-pointer transition ${
                      selectedSupervisor === supervisor.id
                        ? 'border-purple-600 bg-purple-50'
                        : 'border-slate-200 hover:border-purple-600 hover:bg-slate-50'
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
            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center gap-3 mb-4">
                <Truck className="w-6 h-6 text-orange-600" />
                <h3 className="text-lg font-semibold">
                  Select Pickupboy/Driver <span className="text-red-500">*</span>
                </h3>
              </div>

              {pickupBoys.length === 0 ? (
                <WorkshopEmpty>No pickupboys/drivers available. Pickup is required for this lead.</WorkshopEmpty>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pickupBoys.map((pickupBoy) => (
                    <div
                      key={pickupBoy.id}
                      onClick={() => setSelectedPickupBoy(pickupBoy.id)}
                      className={`p-4 border-2 rounded-xl cursor-pointer transition ${
                        selectedPickupBoy === pickupBoy.id
                          ? 'border-orange-600 bg-orange-50'
                          : 'border-slate-200 hover:border-orange-600 hover:bg-slate-50'
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
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
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
              className="flex-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#004AAD] px-4 py-2.5 text-sm font-bold text-white hover:bg-[#023D95] disabled:opacity-50"
            >
              {submitting ? 'Assigning Team...' : 'Assign Team & Start Job'}
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              disabled={submitting}
              className="inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
          </div>
        </form>
      </WorkshopPageShell>
    </DashboardLayout>
  );
}

