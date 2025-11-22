'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import DashboardLayout from '@/components/DashboardLayout';
import {
  CheckCircle, XCircle, Building, MapPin, Phone, Mail, Car,
  Calendar, DollarSign, FileText, AlertCircle, ArrowRight,
  Loader2, Search
} from 'lucide-react';
import { toast } from 'react-hot-toast';

export default function LeadReviewPage() {
  const params = useParams();
  const router = useRouter();
  const supabase = createClientComponentClient();
  
  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  
  // Validation state
  const [showValidation, setShowValidation] = useState(false);
  const [validationNotes, setValidationNotes] = useState('');
  
  // Workshop assignment state
  const [showWorkshopAssignment, setShowWorkshopAssignment] = useState(false);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('');
  const [workshopSearch, setWorkshopSearch] = useState('');
  const [assignmentNotes, setAssignmentNotes] = useState('');
  const [priority, setPriority] = useState('');

  useEffect(() => {
    if (params.id) {
      fetchLeadDetails();
    }
  }, [params.id]);

  // Fetch workshops when search changes (with debounce)
  useEffect(() => {
    if (showWorkshopAssignment) {
      const delayDebounceFn = setTimeout(() => {
        fetchWorkshops(workshopSearch);
      }, 300); // 300ms debounce

      return () => clearTimeout(delayDebounceFn);
    }
  }, [workshopSearch, showWorkshopAssignment]);

  const fetchLeadDetails = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_leads')
        .select(`
          *,
          created_by:users_login!created_by_id(id, full_name, email, phone),
          validated_by:users_login!validated_by_id(id, full_name),
          city:cities(id, name, state),
          model:car_models(id, make, model_name, variant),
          workshop:workshops(id, name, city, contact_person, phone)
        `)
        .eq('id', params.id)
        .single();

      if (error) throw error;
      
      // Parse service_type_ids if it's a string (JSONB from database)
      let serviceTypeIds = data.service_type_ids;
      if (typeof serviceTypeIds === 'string') {
        try {
          serviceTypeIds = JSON.parse(serviceTypeIds);
        } catch (e) {
          console.error('Failed to parse service_type_ids:', e);
          serviceTypeIds = [];
        }
      }
      
      // Fetch service type names if service_type_ids exists
      if (serviceTypeIds && Array.isArray(serviceTypeIds) && serviceTypeIds.length > 0) {
        const { data: serviceTypes, error: stError } = await supabase
          .from('service_types')
          .select('id, name')
          .in('id', serviceTypeIds);
        
        if (!stError && serviceTypes && serviceTypes.length > 0) {
          data.service_type_names = serviceTypes.map(st => st.name).join(', ');
        }
      }
      
      setLead(data);
      setPriority(data.priority || 'MEDIUM');
    } catch (error: any) {
      console.error('Error fetching lead:', error);
      toast.error('Failed to load lead details');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkshops = async (searchQuery = '') => {
    try {
      const city = lead?.city?.name || lead?.city;
      let url = `/api/lead-manager/available-workshops?`;
      
      if (searchQuery) {
        // If search query exists, prioritize search over city
        url += `search=${encodeURIComponent(searchQuery)}`;
      } else if (city) {
        // If no search, filter by city
        url += `city=${encodeURIComponent(city)}`;
      }
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.success) {
        setWorkshops(data.workshops);
      }
    } catch (error) {
      console.error('Error fetching workshops:', error);
      toast.error('Failed to load workshops');
    }
  };

  const handleValidate = async (isValid: boolean) => {
    if (!isValid && !validationNotes.trim()) {
      toast.error('Please provide validation notes when marking as incomplete');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/lead-manager/validate-lead', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          is_valid: isValid,
          validation_notes: validationNotes
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setShowValidation(false);
        setValidationNotes('');
        fetchLeadDetails();
      } else {
        toast.error(data.error || 'Validation failed');
      }
    } catch (error) {
      console.error('Validation error:', error);
      toast.error('Failed to validate lead');
    } finally {
      setActionLoading(false);
    }
  };

  const handleAssignWorkshop = async () => {
    if (!selectedWorkshop) {
      toast.error('Please select a workshop');
      return;
    }

    setActionLoading(true);
    try {
      const response = await fetch('/api/lead-manager/assign-workshop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead_id: lead.id,
          workshop_id: selectedWorkshop,
          assignment_notes: assignmentNotes,
          priority
        })
      });

      const data = await response.json();

      if (data.success) {
        toast.success(data.message);
        setShowWorkshopAssignment(false);
        setSelectedWorkshop('');
        setAssignmentNotes('');
        fetchLeadDetails();
      } else {
        toast.error(data.error || 'Assignment failed');
      }
    } catch (error) {
      console.error('Assignment error:', error);
      toast.error('Failed to assign workshop');
    } finally {
      setActionLoading(false);
    }
  };

  // No need for client-side filtering anymore, API handles it
  const filteredWorkshops = workshops;

  if (loading) {
    return (
      <DashboardLayout role="lead_manager">
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="w-12 h-12 animate-spin text-brand-primary" />
        </div>
      </DashboardLayout>
    );
  }

  if (!lead) {
    return (
      <DashboardLayout role="lead_manager">
        <div className="p-6 text-center">
          <AlertCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Lead Not Found</h2>
          <button
            onClick={() => router.push('/dashboard/lead_manager')}
            className="btn-primary mt-4"
          >
            Back to Dashboard
          </button>
        </div>
      </DashboardLayout>
    );
  }

  const canValidate = ['NEW', 'INCOMPLETE'].includes(lead.status);
  const canAssignWorkshop = lead.status === 'VALIDATED' || (lead.workshop_id && !['ACCEPTED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(lead.status));
  const isReassignment = lead.workshop_id && lead.status === 'ASSIGNED_TO_WORKSHOP';

  return (
    <DashboardLayout role="lead_manager">
      <div className="p-6 max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Lead Review</h1>
            <p className="text-gray-600 mt-1">Lead #{lead.lead_number}</p>
          </div>
          <div className="flex gap-3">
            {canValidate && (
              <>
                <button
                  onClick={() => setShowValidation(true)}
                  className="btn-secondary flex items-center gap-2"
                >
                  <XCircle className="w-5 h-5" />
                  Mark Incomplete
                </button>
                <button
                  onClick={() => handleValidate(true)}
                  disabled={actionLoading}
                  className="btn-primary flex items-center gap-2"
                >
                  <CheckCircle className="w-5 h-5" />
                  {actionLoading ? 'Validating...' : 'Validate Lead'}
                </button>
              </>
            )}
            {canAssignWorkshop && (
              <button
                onClick={() => {
                  setShowWorkshopAssignment(true);
                  fetchWorkshops();
                }}
                className="btn-primary flex items-center gap-2"
              >
                <Building className="w-5 h-5" />
                {isReassignment ? 'Change Workshop' : 'Assign Workshop'}
              </button>
            )}
          </div>
        </div>

        {/* Status Banner */}
        <div className={`p-4 rounded-lg mb-6 ${
          lead.status === 'NEW' ? 'bg-blue-50 border border-blue-200' :
          lead.status === 'INCOMPLETE' ? 'bg-yellow-50 border border-yellow-200' :
          lead.status === 'VALIDATED' ? 'bg-green-50 border border-green-200' :
          'bg-gray-50 border border-gray-200'
        }`}>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">
                Status: <span className="text-lg">{lead.status}</span>
              </p>
              {lead.validated_at && (
                <p className="text-sm text-gray-600 mt-1">
                  Validated by {lead.validated_by?.full_name} on {new Date(lead.validated_at).toLocaleString()}
                </p>
              )}
            </div>
            <span className={`px-4 py-2 rounded-full font-semibold ${
              lead.priority === 'CRITICAL' ? 'bg-red-600 text-white' :
              lead.priority === 'URGENT' ? 'bg-red-100 text-red-800' :
              lead.priority === 'HIGH' ? 'bg-orange-100 text-orange-800' :
              'bg-blue-100 text-blue-800'
            }`}>
              {lead.priority} Priority
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Customer Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Customer Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Name</label>
                  <p className="font-medium">{lead.customer_name}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Phone</label>
                  <p className="font-medium flex items-center gap-2">
                    <Phone className="w-4 h-4 text-gray-400" />
                    {lead.customer_phone}
                  </p>
                </div>
                {lead.customer_email && (
                  <div className="col-span-2">
                    <label className="text-sm text-gray-600">Email</label>
                    <p className="font-medium flex items-center gap-2">
                      <Mail className="w-4 h-4 text-gray-400" />
                      {lead.customer_email}
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <label className="text-sm text-gray-600">Address</label>
                  <p className="font-medium flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-gray-400" />
                    {lead.address || lead.customer_address}, {lead.city?.name || lead.city}, {lead.pincode}
                  </p>
                </div>
              </div>
            </div>

            {/* Vehicle Information */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Vehicle Information</h2>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-sm text-gray-600">Vehicle Number</label>
                  <p className="font-medium text-lg">{lead.vehicle_number}</p>
                </div>
                <div>
                  <label className="text-sm text-gray-600">Make & Model</label>
                  <p className="font-medium">
                    {lead.model?.make || lead.vehicle_make} {lead.model?.model_name || lead.vehicle_model}
                  </p>
                </div>
                {lead.vehicle_fuel_type && (
                  <div>
                    <label className="text-sm text-gray-600">Fuel Type</label>
                    <p className="font-medium">{lead.vehicle_fuel_type}</p>
                  </div>
                )}
                {lead.vehicle_odometer && (
                  <div>
                    <label className="text-sm text-gray-600">Odometer</label>
                    <p className="font-medium">{lead.vehicle_odometer} km</p>
                  </div>
                )}
              </div>
            </div>

            {/* Service Details */}
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Service Details</h2>
              <div className="space-y-3">
                <div>
                  <label className="text-sm text-gray-600">Service Type</label>
                  <p className="font-medium">{lead.service_type_names || lead.service_type || 'Not specified'}</p>
                </div>
                {lead.description && (
                  <div>
                    <label className="text-sm text-gray-600">Description</label>
                    <p className="font-medium">{lead.description}</p>
                  </div>
                )}
                {lead.problem_description && (
                  <div>
                    <label className="text-sm text-gray-600">Problem Description</label>
                    <p className="font-medium">{lead.problem_description}</p>
                  </div>
                )}
                {lead.estimated_amount && (
                  <div>
                    <label className="text-sm text-gray-600">Estimated Amount</label>
                    <p className="font-medium text-lg text-green-600">₹{lead.estimated_amount}</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Timeline */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-bold text-gray-900 mb-4">Timeline</h3>
              <div className="space-y-4">
                <div className="flex items-start gap-3">
                  <div className="bg-blue-100 p-2 rounded-full">
                    <Calendar className="w-4 h-4 text-blue-600" />
                  </div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Created</p>
                    <p className="text-xs text-gray-600">{new Date(lead.created_at).toLocaleString()}</p>
                    {lead.created_by && (
                      <p className="text-xs text-gray-500">by {lead.created_by.full_name}</p>
                    )}
                  </div>
                </div>
                
                {lead.validated_at && (
                  <div className="flex items-start gap-3">
                    <div className="bg-green-100 p-2 rounded-full">
                      <CheckCircle className="w-4 h-4 text-green-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Validated</p>
                      <p className="text-xs text-gray-600">{new Date(lead.validated_at).toLocaleString()}</p>
                      {lead.validated_by && (
                        <p className="text-xs text-gray-500">by {lead.validated_by.full_name}</p>
                      )}
                    </div>
                  </div>
                )}
                
                {lead.assigned_to_workshop_at && (
                  <div className="flex items-start gap-3">
                    <div className="bg-purple-100 p-2 rounded-full">
                      <Building className="w-4 h-4 text-purple-600" />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Workshop Assigned</p>
                      <p className="text-xs text-gray-600">{new Date(lead.assigned_to_workshop_at).toLocaleString()}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Notes */}
            {(lead.validation_notes || lead.internal_notes) && (
              <div className="bg-white rounded-lg shadow p-6">
                <h3 className="text-lg font-bold text-gray-900 mb-4">Notes</h3>
                {lead.validation_notes && (
                  <div className="mb-3">
                    <p className="text-sm font-medium text-gray-600">Validation Notes:</p>
                    <p className="text-sm text-gray-800 mt-1">{lead.validation_notes}</p>
                  </div>
                )}
                {lead.internal_notes && (
                  <div>
                    <p className="text-sm font-medium text-gray-600">Internal Notes:</p>
                    <p className="text-sm text-gray-800 mt-1">{lead.internal_notes}</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Validation Modal */}
        {showValidation && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
              <h3 className="text-xl font-bold text-gray-900 mb-4">Mark Lead as Incomplete</h3>
              <p className="text-gray-600 mb-4">
                Please provide details about what information is missing or incorrect:
              </p>
              <textarea
                value={validationNotes}
                onChange={(e) => setValidationNotes(e.target.value)}
                rows={4}
                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="e.g., Vehicle model incorrect, missing pickup address, etc."
              />
              <div className="flex gap-3 mt-6">
                <button
                  onClick={() => {
                    setShowValidation(false);
                    setValidationNotes('');
                  }}
                  className="flex-1 btn-secondary"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleValidate(false)}
                  disabled={actionLoading || !validationNotes.trim()}
                  className="flex-1 btn-primary"
                >
                  {actionLoading ? 'Processing...' : 'Mark Incomplete'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Workshop Assignment Modal */}
        {showWorkshopAssignment && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-6 my-8">
              <h3 className="text-xl font-bold text-gray-900 mb-4">
                {isReassignment ? 'Change Workshop Assignment' : 'Assign Workshop'}
              </h3>
              
              {/* Reassignment Notice */}
              {isReassignment && lead.workshop && (
                <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
                  <div className="flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-yellow-900">Currently Assigned To</p>
                      <p className="text-sm text-yellow-800 mt-1">
                        {lead.workshop.name} - {lead.workshop.city}
                      </p>
                      <p className="text-xs text-yellow-700 mt-2">
                        ⚠️ Workshop has not accepted yet. You can reassign to another workshop.
                      </p>
                    </div>
                  </div>
                </div>
              )}
              
              {/* Priority Selection */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Priority Level</label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-brand-primary"
                >
                  <option value="LOW">Low</option>
                  <option value="MEDIUM">Medium</option>
                  <option value="HIGH">High</option>
                  <option value="URGENT">Urgent</option>
                  <option value="CRITICAL">Critical</option>
                </select>
              </div>

              {/* Workshop Search */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Search Workshops</label>
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <input
                    type="text"
                    value={workshopSearch}
                    onChange={(e) => setWorkshopSearch(e.target.value)}
                    placeholder="Search by name or city..."
                    className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary"
                  />
                </div>
              </div>

              {/* Workshop List */}
              <div className="mb-4 max-h-80 overflow-y-auto border border-gray-200 rounded-lg">
                {filteredWorkshops.length === 0 ? (
                  <p className="p-4 text-center text-gray-500">No workshops found</p>
                ) : (
                  filteredWorkshops.map((workshop) => (
                    <div
                      key={workshop.id}
                      onClick={() => setSelectedWorkshop(workshop.id)}
                      className={`p-4 cursor-pointer hover:bg-gray-50 transition border-b border-gray-100 ${
                        selectedWorkshop === workshop.id ? 'bg-blue-50 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <h4 className="font-semibold text-gray-900">{workshop.name}</h4>
                          <p className="text-sm text-gray-600">{workshop.city}, {workshop.state}</p>
                          <p className="text-xs text-gray-500 mt-1">{workshop.contact_person} • {workshop.phone}</p>
                        </div>
                        <div className="text-right">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">Rating: {workshop.rating || 'N/A'}</span>
                          </div>
                          <div className={`text-xs mt-1 px-2 py-1 rounded ${
                            workshop.capacity_status === 'AVAILABLE' ? 'bg-green-100 text-green-800' :
                            workshop.capacity_status === 'BUSY' ? 'bg-yellow-100 text-yellow-800' :
                            'bg-red-100 text-red-800'
                          }`}>
                            {workshop.capacity_status} ({workshop.active_leads_count} active)
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Assignment Notes */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-2">Assignment Notes (Optional)</label>
                <textarea
                  value={assignmentNotes}
                  onChange={(e) => setAssignmentNotes(e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-brand-primary"
                  placeholder="Any special instructions or notes for the workshop..."
                />
              </div>

              {/* Actions */}
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowWorkshopAssignment(false);
                    setSelectedWorkshop('');
                    setAssignmentNotes('');
                  }}
                  className="flex-1 btn-secondary"
                  disabled={actionLoading}
                >
                  Cancel
                </button>
                <button
                  onClick={handleAssignWorkshop}
                  disabled={actionLoading || !selectedWorkshop}
                  className="flex-1 btn-primary flex items-center justify-center gap-2"
                >
                  {actionLoading ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Assigning...
                    </>
                  ) : (
                    <>
                      Assign Workshop
                      <ArrowRight className="w-5 h-5" />
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
