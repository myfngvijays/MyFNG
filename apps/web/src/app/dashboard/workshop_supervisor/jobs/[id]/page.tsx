'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import QCChecklist from '@/components/supervisor/QCChecklist';
import MechanicAssignmentModal from '@/components/supervisor/MechanicAssignmentModal';
import ReassignMechanicModal from '@/components/supervisor/ReassignMechanicModal';
import ExtraWorkModal from '@/components/supervisor/ExtraWorkModal';
import PhotoValidationModal from '@/components/supervisor/PhotoValidationModal';
import SendBackModal from '@/components/supervisor/SendBackModal';
import { 
  ArrowLeft, Clock, User, Car, Calendar, Wrench, 
  CheckCircle, AlertTriangle, Image as ImageIcon, Package,
  DollarSign, FileText, MessageSquare, History, Loader2, Save,
  XCircle, ArrowLeftCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

export default function SupervisorJobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showQC, setShowQC] = useState(false);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showReassignModal, setShowReassignModal] = useState(false);
  const [selectedExtraCharge, setSelectedExtraCharge] = useState<any>(null);
  const [showPhotoValidation, setShowPhotoValidation] = useState(false);
  const [showSendBack, setShowSendBack] = useState(false);
  const [internalNotes, setInternalNotes] = useState('');
  const [savingNotes, setSavingNotes] = useState(false);
  const [parts, setParts] = useState<any[]>([]);
  const [showAddPartModal, setShowAddPartModal] = useState(false);
  const [editingPart, setEditingPart] = useState<any>(null);
  const [partForm, setPartForm] = useState({
    part_name: '',
    part_code: '',
    quantity_issued: 1,
    part_notes: ''
  });

  useEffect(() => {
    if (jobId) {
      fetchJobDetails();
    }

    // Real-time updates
    const supabase = createClient();
    const channel = supabase
      .channel(`job-${jobId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'service_leads',
          filter: `id=eq.${jobId}`
        },
        () => {
          fetchJobDetails();
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [jobId]);

  async function fetchJobDetails() {
    try {
      setLoading(true);
      setError(null);

      const supabase = createClient();

      // Fetch complete job details
      const { data, error: fetchError } = await supabase
        .from('service_leads')
        .select(`
          *,
          mechanic:assigned_mechanic_id(id, full_name, profile_image),
          supervisor:assigned_supervisor_id(id, full_name),
          pickup_boy:assigned_pickup_boy_id(id, full_name),
          extra_charges:lead_extra_charges(*),
          media:lead_media(*),
          events:lead_events(*, created_by_user:created_by(full_name))
        `)
        .eq('id', jobId)
        .single();

      if (fetchError) throw fetchError;
      
      // Fetch service type names if service_type_ids exists
      // Parse service_type_ids if it's a string (JSONB from Supabase)
      let serviceTypeIds = data.service_type_ids;
      if (typeof serviceTypeIds === 'string') {
        try {
          serviceTypeIds = JSON.parse(serviceTypeIds);
        } catch (e) {
          console.error('Failed to parse service_type_ids:', e);
        }
      }
      
      if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
        const { data: serviceTypes } = await supabase
          .from('service_types')
          .select('id, name')
          .in('id', serviceTypeIds);
        
        if (serviceTypes && serviceTypes.length > 0) {
          data.service_type_names = serviceTypes.map((st: any) => st.name);
        }
      }
      
      setLead(data);
      setInternalNotes(data.notes_internal || '');

      // Fetch mechanic_jobs to get mechanic_id
      const { data: mechanicJob } = await supabase
        .from('mechanic_jobs')
        .select('mechanic_id')
        .eq('lead_id', jobId)
        .single();

      // Fetch parts if mechanic is assigned
      if (mechanicJob?.mechanic_id) {
        const { data: partsData, error: partsError } = await supabase
          .from('mechanic_parts_usage')
          .select('*')
          .eq('lead_id', jobId)
          .order('created_at', { ascending: false });

        if (!partsError && partsData) {
          setParts(partsData || []);
        }
      }
    } catch (err: any) {
      console.error('Error fetching job details:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveInternalNotes() {
    try {
      setSavingNotes(true);
      const supabase = createClient();

      const { error } = await supabase
        .from('service_leads')
        .update({
          notes_internal: internalNotes,
          updated_at: new Date().toISOString()
        })
        .eq('id', jobId);

      if (error) throw error;

      // Log supervisor action
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userProfile } = await supabase
          .from('users_login')
          .select('id')
          .eq('email', user.email)
          .single();

        await supabase
          .from('supervisor_actions')
          .insert({
            supervisor_id: userProfile?.id,
            lead_id: jobId,
            action_type: 'INTERNAL_NOTES_UPDATED',
            action_description: 'Updated internal supervisor notes',
            notes: internalNotes
          });
      }

      alert('Internal notes saved successfully');
    } catch (error) {
      console.error('Error saving notes:', error);
      alert('Failed to save notes');
    } finally {
      setSavingNotes(false);
    }
  }

  async function changeJobStatus(newStatus: string) {
    if (!confirm(`Are you sure you want to change status to ${newStatus}?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/supervisor/jobs/${jobId}/change-status`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          new_status: newStatus,
          notes: `Status changed to ${newStatus} by supervisor`
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to change status');
      }

      alert(`Status changed to ${newStatus} successfully!`);
      fetchJobDetails();
    } catch (error: any) {
      console.error('Error changing status:', error);
      alert(`Failed to change status: ${error.message || 'Unknown error'}`);
    }
  }

  async function savePart() {
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Get mechanic_id from mechanic_jobs
      const { data: mechanicJob } = await supabase
        .from('mechanic_jobs')
        .select('mechanic_id')
        .eq('lead_id', jobId)
        .single();

      if (!mechanicJob?.mechanic_id) {
        alert('Mechanic not assigned to this job');
        return;
      }

      if (editingPart) {
        // Update existing part in mechanic_parts_usage
        const { error } = await supabase
          .from('mechanic_parts_usage')
          .update({
            part_name: partForm.part_name,
            part_code: partForm.part_code || null,
            quantity: partForm.quantity_issued,
            notes: partForm.part_notes || null
          })
          .eq('id', editingPart.id);

        if (error) throw error;

        // Also update in job_card_parts if it exists
        const { data: jobCard } = await supabase
          .from('job_cards')
          .select('id')
          .eq('lead_id', jobId)
          .maybeSingle();

        if (jobCard) {
          // Find matching part in job_card_parts by part_name
          const { data: jobCardPart } = await supabase
            .from('job_card_parts')
            .select('id')
            .eq('job_card_id', jobCard.id)
            .eq('part_name', editingPart.part_name)
            .maybeSingle();

          if (jobCardPart) {
            // Get existing unit_price to recalculate total_price
            const { data: existingPart } = await supabase
              .from('job_card_parts')
              .select('unit_price')
              .eq('id', jobCardPart.id)
              .single();

            const unitPrice = existingPart?.unit_price || 0;
            const totalPrice = unitPrice * partForm.quantity_issued;

            // Update job_card_parts
            await supabase
              .from('job_card_parts')
              .update({
                part_name: partForm.part_name,
                part_number: partForm.part_code || null,
                quantity: partForm.quantity_issued,
                total_price: totalPrice
              })
              .eq('id', jobCardPart.id);
          }
        }

        alert('Part updated successfully');
      } else {
        // Add new part to mechanic_parts_usage
        const { error } = await supabase
          .from('mechanic_parts_usage')
          .insert({
            lead_id: jobId,
            mechanic_id: mechanicJob.mechanic_id,
            part_name: partForm.part_name,
            part_code: partForm.part_code || null,
            quantity: partForm.quantity_issued,
            notes: partForm.part_notes || null
          });

        if (error) throw error;

        // Also add to job_card_parts automatically (for billing)
        const { data: jobCard } = await supabase
          .from('job_cards')
          .select('id')
          .eq('lead_id', jobId)
          .maybeSingle();

        if (jobCard) {
          // Check if part already exists in job_card_parts
          const { data: existingPart } = await supabase
            .from('job_card_parts')
            .select('id')
            .eq('job_card_id', jobCard.id)
            .eq('part_name', partForm.part_name)
            .maybeSingle();

          if (!existingPart) {
            // Add to job_card_parts with default unit_price (can be updated later)
            await supabase
              .from('job_card_parts')
              .insert({
                job_card_id: jobCard.id,
                part_name: partForm.part_name,
                part_number: partForm.part_code || null,
                quantity: partForm.quantity_issued,
                unit_price: 0, // Default, can be updated later
                total_price: 0 // Will be calculated when unit_price is set
              });
          }
        }

        alert('Part assigned successfully');
      }

      setShowAddPartModal(false);
      setEditingPart(null);
      setPartForm({ part_name: '', part_code: '', quantity_issued: 1, part_notes: '' });
      fetchJobDetails();
    } catch (error: any) {
      console.error('Error saving part:', error);
      alert(`Failed to save part: ${error.message}`);
    }
  }

  async function deletePart(partId: string) {
    if (!confirm('Are you sure you want to delete this part?')) return;

    try {
      const supabase = createClient();
      
      // Get part details before deleting
      const { data: partToDelete } = await supabase
        .from('mechanic_parts_usage')
        .select('part_name')
        .eq('id', partId)
        .single();

      // Delete from mechanic_parts_usage
      const { error } = await supabase
        .from('mechanic_parts_usage')
        .delete()
        .eq('id', partId);

      if (error) throw error;

      // Also delete from job_card_parts if it exists
      if (partToDelete) {
        const { data: jobCard } = await supabase
          .from('job_cards')
          .select('id')
          .eq('lead_id', jobId)
          .maybeSingle();

        if (jobCard) {
          await supabase
            .from('job_card_parts')
            .delete()
            .eq('job_card_id', jobCard.id)
            .eq('part_name', partToDelete.part_name);
        }
      }

      alert('Part deleted successfully');
      fetchJobDetails();
    } catch (error: any) {
      console.error('Error deleting part:', error);
      alert(`Failed to delete part: ${error.message}`);
    }
  }

  const getSLAColor = (status: string) => {
    switch (status) {
      case 'ON_TIME': return 'bg-green-100 text-green-700 border-green-200';
      case 'AT_RISK': return 'bg-yellow-100 text-yellow-700 border-yellow-200';
      case 'BREACHED': return 'bg-red-100 text-red-700 border-red-200';
      default: return 'bg-gray-100 text-gray-700 border-gray-200';
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      'NEW': 'bg-blue-100 text-blue-700',
      'ASSIGNED': 'bg-purple-100 text-purple-700',
      'IN_PROGRESS': 'bg-green-100 text-green-700',
      'HOLD': 'bg-orange-100 text-orange-700',
      'COMPLETED': 'bg-teal-100 text-teal-700',
      'READY_FOR_DELIVERY': 'bg-indigo-100 text-indigo-700',
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (error || !lead) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="card bg-red-50 border-red-200">
          <p className="text-red-600">Error loading job details</p>
          <button onClick={() => router.back()} className="btn btn-primary mt-3">
            Go Back
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const pendingExtraCharges = (lead.extra_charges || []).filter((c: any) => c.status === 'PENDING');

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="btn btn-outline flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Back
            </button>
            <div>
              <h1 className="text-3xl font-bold text-text-heading">{lead.lead_number}</h1>
              <p className="text-sm text-gray-600 mt-1">Job Details & Progress</p>
            </div>
          </div>
          
          {/* Quick Actions */}
          <div className="flex gap-2">
            {lead.mechanic && (
              <button
                onClick={() => setShowSendBack(true)}
                className="btn bg-orange-600 hover:bg-orange-700 text-white flex items-center gap-2"
              >
                <ArrowLeftCircle className="w-4 h-4" />
                Send Back
              </button>
            )}
            
            {lead.media && lead.media.length > 0 && (
              <button
                onClick={() => setShowPhotoValidation(true)}
                className="btn btn-primary flex items-center gap-2"
              >
                <ImageIcon className="w-4 h-4" />
                Validate Photos
              </button>
            )}
          </div>
        </div>

        {/* Section 1: Job Summary */}
        <div className="card">
          <h2 className="text-xl font-semibold mb-4">Job Summary</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Status</p>
              <span className={`inline-block px-3 py-1 rounded-full text-sm font-semibold mt-1 ${getStatusColor(lead.status)}`}>
                {lead.status.replace(/_/g, ' ')}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600">SLA Status</p>
              <span className={`inline-block px-3 py-1 rounded-lg border text-sm font-semibold mt-1 ${getSLAColor(lead.sla_status)}`}>
                {lead.sla_status}
              </span>
            </div>
            <div>
              <p className="text-sm text-gray-600">Priority</p>
              <p className="font-semibold mt-1">{lead.priority}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Created</p>
              <p className="font-semibold mt-1">{new Date(lead.created_at).toLocaleDateString()}</p>
            </div>
          </div>
        </div>

        {/* Section 2: Customer & Vehicle */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="card">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Details
            </h3>
            <div className="space-y-2">
              <p><span className="text-gray-600">Name:</span> <strong>{lead.customer_name}</strong></p>
              <p><span className="text-gray-600">Phone:</span> <strong>{lead.customer_phone}</strong></p>
              {lead.customer_email && (
                <p><span className="text-gray-600">Email:</span> {lead.customer_email}</p>
              )}
            </div>
          </div>

          <div className="card">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Car className="w-5 h-5" />
              Vehicle Details
            </h3>
            <div className="space-y-2">
              <p><span className="text-gray-600">Number:</span> <strong>{lead.vehicle_number}</strong></p>
              <p><span className="text-gray-600">Make/Model:</span> {lead.vehicle_make} {lead.vehicle_model}</p>
              {lead.vehicle_year && (
                <p><span className="text-gray-600">Year:</span> {lead.vehicle_year}</p>
              )}
            </div>
          </div>
        </div>

        {/* Section 3: Service Details */}
        <div className="card">
          <h3 className="text-lg font-semibold mb-3">Service Request</h3>
          {lead.service_type_names && lead.service_type_names.length > 0 ? (
            <div className="space-y-2">
              {lead.service_type_names.map((serviceName: string, index: number) => (
                <div key={index} className="flex items-center gap-2">
                  <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                  <p className="text-gray-700 font-medium">{serviceName}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-700">{lead.service_type || 'General Service'}</p>
          )}
          {lead.problem_description && (
            <div className="mt-3 p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 font-semibold">Problem Description:</p>
              <p className="text-sm text-gray-700 mt-1">{lead.problem_description}</p>
            </div>
          )}
          {lead.issue_description && (
            <p className="text-sm text-gray-600 mt-2">{lead.issue_description}</p>
          )}
        </div>

        {/* Section 4: Mechanic Assignment */}
        <div className="card">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Wrench className="w-5 h-5" />
              Mechanic Assignment
            </h3>
            {!lead.mechanic && lead.status === 'ASSIGNED' && (
              <button
                onClick={() => setShowAssignModal(true)}
                className="btn btn-primary text-sm"
              >
                Assign Mechanic
              </button>
            )}
            {lead.mechanic && (
              <button
                onClick={() => setShowReassignModal(true)}
                className="btn btn-outline text-sm"
              >
                Reassign
              </button>
            )}
          </div>
          {lead.mechanic ? (
            <div className="flex items-center gap-3">
              {lead.mechanic.profile_image ? (
                <img src={lead.mechanic.profile_image} alt="" className="w-10 h-10 rounded-full" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-brand-primary flex items-center justify-center">
                  <User className="w-5 h-5 text-white" />
                </div>
              )}
              <div>
                <p className="font-semibold">{lead.mechanic.full_name}</p>
                <p className="text-sm text-gray-600">Assigned Mechanic</p>
              </div>
            </div>
          ) : (
            <p className="text-gray-500 italic">No mechanic assigned yet</p>
          )}
        </div>

        {/* Section 5: Extra Charges */}
        {pendingExtraCharges.length > 0 && (
          <div className="card bg-orange-50 border-orange-200">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <DollarSign className="w-5 h-5 text-orange-600" />
              Pending Extra Work Approvals
            </h3>
            <div className="space-y-3">
              {pendingExtraCharges.map((charge: any) => (
                <div key={charge.id} className="bg-white p-4 rounded-lg border border-orange-200">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">{charge.description}</p>
                      <p className="text-2xl font-bold text-brand-primary mt-1">
                        ₹{charge.amount.toLocaleString()}
                      </p>
                      <p className="text-sm text-gray-600 mt-1">{charge.reason}</p>
                    </div>
                    <button
                      onClick={() => setSelectedExtraCharge(charge)}
                      className="btn bg-orange-600 hover:bg-orange-700 text-white text-sm"
                    >
                      Review
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 6: Media */}
        {lead.media && lead.media.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <ImageIcon className="w-5 h-5" />
              Media ({lead.media.length})
            </h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {lead.media.map((item: any) => (
                <div key={item.id} className="relative">
                  <img
                    src={item.file_url}
                    alt={item.media_type}
                    className="w-full h-32 object-cover rounded-lg cursor-pointer hover:opacity-90"
                  />
                  <span className="absolute top-2 left-2 bg-black bg-opacity-70 text-white text-xs px-2 py-1 rounded">
                    {item.media_type}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Section 7: Parts Management */}
        {lead.mechanic && (
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <Package className="w-5 h-5" />
                Parts Management ({parts.length})
              </h3>
              <button
                onClick={() => {
                  setEditingPart(null);
                  setPartForm({ part_name: '', part_code: '', quantity_issued: 1, part_notes: '' });
                  setShowAddPartModal(true);
                }}
                className="btn btn-primary flex items-center gap-2"
              >
                <Package className="w-4 h-4" />
                Add Part
              </button>
            </div>

            {parts.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Package className="w-12 h-12 mx-auto mb-2 opacity-30" />
                <p>No parts assigned yet</p>
              </div>
            ) : (
              <div className="space-y-3">
                {parts.map((part) => (
                  <div key={part.id} className="p-4 border rounded-lg bg-gray-50">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <p className="font-semibold text-lg">{part.part_name}</p>
                        {part.part_code && (
                          <p className="text-sm text-gray-600">Code: {part.part_code}</p>
                        )}
                        <p className="text-sm text-gray-600 mt-1">
                          Quantity: {part.quantity || 0}
                        </p>
                        {part.notes && (
                          <p className="text-sm text-gray-600 mt-1">{part.notes}</p>
                        )}
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => {
                            setEditingPart(part);
                            setPartForm({
                              part_name: part.part_name,
                              part_code: part.part_code || '',
                              quantity_issued: part.quantity || 1,
                              part_notes: part.notes || ''
                            });
                            setShowAddPartModal(true);
                          }}
                          className="btn btn-outline text-sm"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => deletePart(part.id)}
                          className="btn bg-red-500 hover:bg-red-600 text-white text-sm"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Section 8: Internal Notes */}
        <div className="card bg-blue-50 border-blue-200">
          <h3 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-blue-600" />
            Internal Supervisor Notes
          </h3>
          <textarea
            value={internalNotes}
            onChange={(e) => setInternalNotes(e.target.value)}
            placeholder="Add your private notes here... (visible only to supervisors and admins)"
            className="input w-full"
            rows={4}
          />
          <div className="flex items-center justify-between mt-3">
            <p className="text-xs text-gray-600">
              These notes are internal and not visible to mechanics or customers
            </p>
            <button
              onClick={saveInternalNotes}
              disabled={savingNotes}
              className="btn btn-primary flex items-center gap-2"
            >
              {savingNotes ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Notes
                </>
              )}
            </button>
          </div>
        </div>

        {/* Section 8: Status Management */}
        {(lead.status === 'DELIVERED' || lead.status === 'IN_PROGRESS' || lead.status === 'INSPECTED' || lead.status === 'QC_PENDING' || lead.status === 'WORK_COMPLETED') && (
          <div className="card bg-purple-50 border-purple-200">
            <h3 className="text-lg font-semibold mb-3">Change Job Status</h3>
            <p className="text-sm text-gray-600 mb-4">
              Update the job status based on your inspection and validation
            </p>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {(lead.status === 'DELIVERED' || lead.status === 'IN_PROGRESS') && (
                <button
                  onClick={() => changeJobStatus('IN_PROGRESS')}
                  className="btn bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as IN PROGRESS
                </button>
              )}
              {(lead.status === 'DELIVERED' || lead.status === 'IN_PROGRESS') && (
                <button
                  onClick={() => changeJobStatus('INSPECTED')}
                  className="btn bg-purple-600 hover:bg-purple-700 text-white flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  Mark as INSPECTED
                </button>
              )}
              {(lead.status === 'INSPECTED' || lead.status === 'WORK_COMPLETED' || lead.status === 'QC_PENDING') && (
                <button
                  onClick={() => changeJobStatus('QC_APPROVED')}
                  className="btn bg-green-600 hover:bg-green-700 text-white flex items-center justify-center gap-2"
                >
                  <CheckCircle className="w-4 h-4" />
                  QC APPROVED
                </button>
              )}
              {lead.status === 'QC_APPROVED' && (
                <button
                  onClick={() => changeJobStatus('READY_FOR_DELIVERY')}
                  className="btn bg-blue-600 hover:bg-blue-700 text-white flex items-center justify-center gap-2"
                >
                  <Package className="w-4 h-4" />
                  READY FOR DELIVERY
                </button>
              )}
            </div>
          </div>
        )}

        {/* Section 9: QC Section */}
        {lead.status === 'COMPLETED' && lead.qc_status === 'PENDING' && !showQC && (
          <div className="card bg-purple-50 border-purple-200">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-purple-600" />
                  Quality Control Required
                </h3>
                <p className="text-sm text-gray-600 mt-1">This job is ready for quality inspection</p>
              </div>
              <button
                onClick={() => setShowQC(true)}
                className="btn bg-purple-600 hover:bg-purple-700 text-white"
              >
                Perform QC
              </button>
            </div>
          </div>
        )}

        {showQC && (
          <QCChecklist
            leadId={lead.id}
            leadNumber={lead.lead_number}
            onSuccess={() => {
              setShowQC(false);
              fetchJobDetails();
            }}
            onCancel={() => setShowQC(false)}
          />
        )}

        {/* Section 10: Activity Timeline */}
        {lead.events && lead.events.length > 0 && (
          <div className="card">
            <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
              <History className="w-5 h-5" />
              Activity Timeline
            </h3>
            <div className="space-y-3">
              {lead.events.slice(0, 10).map((event: any) => (
                <div key={event.id} className="flex gap-3 pb-3 border-b border-gray-200 last:border-0">
                  <div className="flex-shrink-0 w-2 h-2 rounded-full bg-brand-primary mt-2"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{event.event_description}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {new Date(event.created_at).toLocaleString()}
                      {event.created_by_user && ` • by ${event.created_by_user.full_name}`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Modals */}
      {showAssignModal && (
        <MechanicAssignmentModal
          isOpen={showAssignModal}
          onClose={() => setShowAssignModal(false)}
          leadId={lead.id}
          leadNumber={lead.lead_number}
          onSuccess={() => {
            setShowAssignModal(false);
            fetchJobDetails();
          }}
        />
      )}

      {showReassignModal && lead.mechanic && (
        <ReassignMechanicModal
          isOpen={showReassignModal}
          onClose={() => setShowReassignModal(false)}
          leadId={lead.id}
          leadNumber={lead.lead_number}
          currentMechanicId={lead.mechanic.id}
          currentMechanicName={lead.mechanic.full_name}
          onSuccess={() => {
            setShowReassignModal(false);
            fetchJobDetails();
          }}
        />
      )}

      {selectedExtraCharge && (
        <ExtraWorkModal
          isOpen={!!selectedExtraCharge}
          onClose={() => setSelectedExtraCharge(null)}
          leadId={lead.id}
          leadNumber={lead.lead_number}
          extraCharge={selectedExtraCharge}
          onSuccess={() => {
            setSelectedExtraCharge(null);
            fetchJobDetails();
          }}
        />
      )}

      {showPhotoValidation && (
        <PhotoValidationModal
          isOpen={showPhotoValidation}
          onClose={() => setShowPhotoValidation(false)}
          leadId={lead.id}
          leadNumber={lead.lead_number}
          onSuccess={() => {
            setShowPhotoValidation(false);
            fetchJobDetails();
          }}
        />
      )}

      {showSendBack && lead.mechanic && (
        <SendBackModal
          isOpen={showSendBack}
          onClose={() => setShowSendBack(false)}
          leadId={lead.id}
          leadNumber={lead.lead_number}
          currentMechanicName={lead.mechanic.full_name}
          onSuccess={() => {
            setShowSendBack(false);
            fetchJobDetails();
          }}
        />
      )}

      {/* Add/Edit Part Modal */}
      {showAddPartModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold">
                {editingPart ? 'Edit Part' : 'Add Part'}
              </h2>
              <button
                onClick={() => {
                  setShowAddPartModal(false);
                  setEditingPart(null);
                  setPartForm({ part_name: '', part_code: '', quantity_issued: 1, part_notes: '' });
                }}
                className="btn btn-outline"
              >
                <XCircle className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Part Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={partForm.part_name}
                  onChange={(e) => setPartForm({ ...partForm, part_name: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., Oil Filter, Brake Pads"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Part Code</label>
                <input
                  type="text"
                  value={partForm.part_code}
                  onChange={(e) => setPartForm({ ...partForm, part_code: e.target.value })}
                  className="input w-full"
                  placeholder="e.g., OF-12345"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">
                  Quantity Issued <span className="text-red-500">*</span>
                </label>
                <input
                  type="number"
                  value={partForm.quantity_issued}
                  onChange={(e) => setPartForm({ ...partForm, quantity_issued: parseInt(e.target.value) || 1 })}
                  className="input w-full"
                  min="1"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Notes</label>
                <textarea
                  value={partForm.part_notes}
                  onChange={(e) => setPartForm({ ...partForm, part_notes: e.target.value })}
                  className="input w-full"
                  rows={3}
                  placeholder="Additional notes about this part..."
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowAddPartModal(false);
                    setEditingPart(null);
                    setPartForm({ part_name: '', part_code: '', quantity_issued: 1, part_notes: '' });
                  }}
                  className="btn btn-outline flex-1"
                >
                  Cancel
                </button>
                <button
                  onClick={savePart}
                  disabled={!partForm.part_name || partForm.quantity_issued < 1}
                  className="btn btn-primary flex-1"
                >
                  {editingPart ? 'Update' : 'Add'} Part
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

