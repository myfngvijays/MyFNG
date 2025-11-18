'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function LeadManagerLeadDetailPage({ params }: { params: { id: string } }) {
  const supabase = createClientComponentClient();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get('mode');

  const [lead, setLead] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState(modeParam === 'edit');
  const [saving, setSaving] = useState(false);
  const [editedData, setEditedData] = useState<any>({});
  const [internalNotes, setInternalNotes] = useState('');
  const [callLogs, setCallLogs] = useState<any[]>([]);

  useEffect(() => {
    fetchLeadDetails();
  }, [params.id]);

  const fetchLeadDetails = async () => {
    try {
      const { data: leadData, error } = await supabase
        .from('service_leads')
        .select(`
          *,
          workshop:workshops(name, phone, city),
          assigned_telecaller:assigned_telecaller_id(full_name)
        `)
        .eq('id', params.id)
        .single();

      if (error) throw error;
      setLead(leadData);
      setEditedData(leadData);

      // Fetch call logs
      if (leadData.assigned_telecaller_id) {
        const { data: callsData } = await supabase
          .from('telecaller_call_logs')
          .select('*, telecaller:telecaller_id(full_name)')
          .eq('lead_id', params.id)
          .order('created_at', { ascending: false });
        setCallLogs(callsData || []);
      }
    } catch (error) {
      console.error('Error fetching lead:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      
      const updateData: any = {
        customer_name: editedData.customer_name,
        customer_phone: editedData.customer_phone,
        customer_alternate_phone: editedData.customer_alternate_phone || null,
        customer_email: editedData.customer_email || null,
        customer_address: editedData.customer_address || null,
        vehicle_number: editedData.vehicle_number || null,
        vehicle_make: editedData.vehicle_make || null,
        vehicle_model: editedData.vehicle_model || null,
        vehicle_variant: editedData.vehicle_variant || null,
        vehicle_year: editedData.vehicle_year || null,
        vehicle_fuel_type: editedData.vehicle_fuel_type || null,
        odometer_km: editedData.odometer_km || null,
        service_type: editedData.service_type,
        problem_description: editedData.problem_description || null,
        pickup_required: editedData.pickup_required,
        pickup_address: editedData.pickup_address || null,
        lead_priority: editedData.lead_priority,
        status: editedData.status,
        updated_at: new Date().toISOString()
      };

      const isComplete = !!(
        updateData.customer_name &&
        updateData.customer_phone &&
        updateData.vehicle_model &&
        updateData.service_type
      );

      if (isComplete && lead.is_incomplete) {
        updateData.is_incomplete = false;
      }

      const { error } = await supabase
        .from('service_leads')
        .update(updateData)
        .eq('id', params.id);

      if (error) throw error;

      if (internalNotes.trim()) {
        await supabase
          .from('lead_events')
          .insert([{
            lead_id: params.id,
            event_type: 'NOTE_ADDED',
            event_data: { notes: internalNotes },
            description: `Lead Manager added notes: ${internalNotes}`,
            created_at: new Date().toISOString()
          }]);
      }

      alert('Lead updated successfully!');
      setEditMode(false);
      setInternalNotes('');
      fetchLeadDetails();
    } catch (error) {
      console.error('Error saving lead:', error);
      alert('Failed to update lead');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="text-6xl mb-4">❌</div>
          <h3 className="text-xl font-bold">Lead not found</h3>
          <Link href="/dashboard/lead_manager/leads">
            <button className="mt-4 bg-blue-600 text-white px-6 py-2 rounded-lg">Go Back</button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Lead #{lead.lead_number}</h1>
          <p className="text-gray-600 mt-1">{lead.customer_name}</p>
        </div>
        <div className="flex gap-3">
          {!editMode ? (
            <button
              onClick={() => setEditMode(true)}
              className="bg-blue-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-blue-700"
            >
              ✏️ Edit Lead
            </button>
          ) : (
            <>
              <button
                onClick={handleSave}
                disabled={saving}
                className="bg-green-600 text-white px-6 py-2 rounded-lg font-medium hover:bg-green-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : '💾 Save Changes'}
              </button>
              <button
                onClick={() => {
                  setEditMode(false);
                  setEditedData(lead);
                }}
                className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-300"
              >
                Cancel
              </button>
            </>
          )}
          <Link href="/dashboard/lead_manager/leads">
            <button className="bg-gray-200 text-gray-700 px-6 py-2 rounded-lg font-medium hover:bg-gray-300">
              ← Back
            </button>
          </Link>
        </div>
      </div>

      {/* Alerts & Badges */}
      <div className="mb-6 flex gap-3 flex-wrap">
        <span className={`px-4 py-2 rounded-lg font-medium ${lead.status === 'NEW' ? 'bg-blue-100 text-blue-600' : lead.status === 'REJECTED' ? 'bg-red-100 text-red-600' : 'bg-green-100 text-green-600'}`}>
          {lead.status}
        </span>
        <span className={`px-4 py-2 rounded-lg font-medium ${(lead.lead_priority || 'NORMAL') === 'URGENT' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
          {lead.lead_priority || 'NORMAL'}
        </span>
        {lead.is_incomplete && (
          <span className="px-4 py-2 rounded-lg font-medium bg-orange-100 text-orange-600">
            INCOMPLETE
          </span>
        )}
        {lead.sla_state === 'BREACHED' && (
          <span className="px-4 py-2 rounded-lg font-medium bg-red-100 text-red-600">
            🚨 SLA BREACHED
          </span>
        )}
        {lead.sla_state === 'AT_RISK' && (
          <span className="px-4 py-2 rounded-lg font-medium bg-orange-100 text-orange-600">
            ⚠️ SLA AT RISK
          </span>
        )}
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Main Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Customer Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">👤 Customer Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedData.customer_name || ''}
                    onChange={(e) => setEditedData({ ...editedData, customer_name: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{lead.customer_name}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone *</label>
                {editMode ? (
                  <input
                    type="tel"
                    value={editedData.customer_phone || ''}
                    onChange={(e) => setEditedData({ ...editedData, customer_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{lead.customer_phone}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Alt Phone</label>
                {editMode ? (
                  <input
                    type="tel"
                    value={editedData.customer_alternate_phone || ''}
                    onChange={(e) => setEditedData({ ...editedData, customer_alternate_phone: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{lead.customer_alternate_phone || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                {editMode ? (
                  <input
                    type="email"
                    value={editedData.customer_email || ''}
                    onChange={(e) => setEditedData({ ...editedData, customer_email: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{lead.customer_email || 'N/A'}</p>
                )}
              </div>
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Address</label>
                {editMode ? (
                  <textarea
                    value={editedData.customer_address || ''}
                    onChange={(e) => setEditedData({ ...editedData, customer_address: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={2}
                  />
                ) : (
                  <p className="text-gray-900">{lead.customer_address || 'N/A'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Vehicle Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">🚗 Vehicle Details</h2>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Registration</label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedData.vehicle_number || ''}
                    onChange={(e) => setEditedData({ ...editedData, vehicle_number: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{lead.vehicle_number || 'Not provided'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Make</label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedData.vehicle_make || ''}
                    onChange={(e) => setEditedData({ ...editedData, vehicle_make: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{lead.vehicle_make || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Model *</label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedData.vehicle_model || ''}
                    onChange={(e) => setEditedData({ ...editedData, vehicle_model: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{lead.vehicle_model || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Variant</label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedData.vehicle_variant || ''}
                    onChange={(e) => setEditedData({ ...editedData, vehicle_variant: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{lead.vehicle_variant || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Year</label>
                {editMode ? (
                  <input
                    type="number"
                    value={editedData.vehicle_year || ''}
                    onChange={(e) => setEditedData({ ...editedData, vehicle_year: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{lead.vehicle_year || 'N/A'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Fuel Type</label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedData.vehicle_fuel_type || ''}
                    onChange={(e) => setEditedData({ ...editedData, vehicle_fuel_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{lead.vehicle_fuel_type || 'N/A'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Service Section */}
          <div className="bg-white rounded-lg shadow p-6">
            <h2 className="text-xl font-bold mb-4">🔧 Service Details</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Type *</label>
                {editMode ? (
                  <input
                    type="text"
                    value={editedData.service_type || ''}
                    onChange={(e) => setEditedData({ ...editedData, service_type: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                ) : (
                  <p className="text-gray-900">{lead.service_type || 'Not specified'}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Problem Description</label>
                {editMode ? (
                  <textarea
                    value={editedData.problem_description || ''}
                    onChange={(e) => setEditedData({ ...editedData, problem_description: e.target.value })}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                    rows={3}
                  />
                ) : (
                  <p className="text-gray-900 italic">{lead.problem_description || 'N/A'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Internal Notes */}
          {editMode && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-xl font-bold mb-4">📝 Internal Notes (Lead Manager Only)</h2>
              <textarea
                value={internalNotes}
                onChange={(e) => setInternalNotes(e.target.value)}
                placeholder="Add internal notes..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                rows={4}
              />
            </div>
          )}
        </div>

        {/* Right Column - Sidebar */}
        <div className="space-y-6">
          {/* Workshop Info */}
          {lead.workshop && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">🏢 Workshop Assigned</h2>
              <div className="space-y-2">
                <p className="text-sm text-gray-600">Name:</p>
                <p className="font-medium">{lead.workshop.name}</p>
                <p className="text-sm text-gray-600 mt-2">City:</p>
                <p className="font-medium">{lead.workshop.city}</p>
                <p className="text-sm text-gray-600 mt-2">Phone:</p>
                <p className="font-medium">{lead.workshop.phone}</p>
              </div>
            </div>
          )}

          {/* Call History */}
          {callLogs.length > 0 && (
            <div className="bg-white rounded-lg shadow p-6">
              <h2 className="text-lg font-bold mb-4">📞 Call History ({callLogs.length})</h2>
              <div className="space-y-3">
                {callLogs.slice(0, 5).map((log) => (
                  <div key={log.id} className="border-b pb-3">
                    <div className="flex justify-between">
                      <span className="text-xs font-medium text-blue-600">{log.call_status}</span>
                      {log.call_duration && (
                        <span className="text-xs text-gray-500">{Math.floor(log.call_duration / 60)}m {log.call_duration % 60}s</span>
                      )}
                    </div>
                    {log.notes && <p className="text-sm text-gray-700 mt-1">{log.notes}</p>}
                    <p className="text-xs text-gray-400 mt-1">{new Date(log.created_at).toLocaleString()}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

