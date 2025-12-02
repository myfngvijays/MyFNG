'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';
import { Store, Search, Plus, MapPin, Edit2, X, Building } from 'lucide-react';

export default function WorkshopManagementPage() {
  const router = useRouter();
  const supabase = createClientComponentClient();
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]); // For Zone Dropdown
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  
  // Edit Modal State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingWorkshop, setEditingWorkshop] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchWorkshops();
    fetchZones();
  }, [filterStatus]);

  const fetchZones = async () => {
    const { data } = await supabase.from('zones').select('id, name');
    setZones(data || []);
  };

  const fetchWorkshops = async () => {
    try {
      let query = supabase
        .from('workshops')
        .select('*, zones(name)') // Fetch zone name too
        .order('created_at', { ascending: false });

      if (filterStatus === 'active') {
        query = query.eq('is_verified', true);
      } else if (filterStatus === 'inactive') {
        query = query.eq('is_verified', false);
      }

      const { data, error } = await query;
      if (error) throw error;
      setWorkshops(data || []);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (workshop: any) => {
    setEditingWorkshop({ ...workshop }); // Create a copy
    setShowEditModal(true);
  };

  const handleSaveChanges = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingWorkshop) return;
    setSaving(true);
    
    try {
      const { error } = await supabase
        .from('workshops')
        .update({
          name: editingWorkshop.name,
          contact_person: editingWorkshop.contact_person,
          phone: editingWorkshop.phone,
          email: editingWorkshop.email,
          
          // Address
          address: editingWorkshop.address,
          city: editingWorkshop.city,
          state: editingWorkshop.state,
          pincode: editingWorkshop.pincode,
          
          // Zone & Tax
          zone_id: editingWorkshop.zone_id,
          gst_number: editingWorkshop.gst_number,
          
          // Bank Details
          bank_account_number: editingWorkshop.bank_account_number,
          ifsc_code: editingWorkshop.ifsc_code,
          upi_id: editingWorkshop.upi_id,
          commission_percentage: editingWorkshop.commission_percentage
        })
        .eq('id', editingWorkshop.id);

      if (error) throw error;
      
      alert('Workshop updated successfully!');
      setShowEditModal(false);
        fetchWorkshops();
    } catch (error: any) {
      alert('Error updating workshop: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleApprove = async (workshopId: string) => {
    if (!confirm('Approve this workshop?')) return;
    try {
      const { error } = await supabase.from('workshops').update({ is_verified: true }).eq('id', workshopId);
      if (!error) { alert('Approved!'); fetchWorkshops(); }
    } catch { alert('Failed'); }
  };

  const handleDisable = async (workshopId: string) => {
    if (!confirm('Disable this workshop?')) return;
    try {
      const { error } = await supabase.from('workshops').update({ is_verified: false }).eq('id', workshopId);
      if (!error) { alert('Disabled!'); fetchWorkshops(); }
    } catch { alert('Failed'); }
  };

  const handleEnable = async (workshopId: string) => {
    try {
      const { error } = await supabase.from('workshops').update({ is_verified: true }).eq('id', workshopId);
      if (!error) { alert('Enabled!'); fetchWorkshops(); }
    } catch { alert('Failed'); }
  };

  const filteredWorkshops = workshops.filter((w) =>
    searchTerm === '' ||
    w.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.city?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    w.phone?.includes(searchTerm)
  );

  if (loading) return <div className="p-12 text-center text-gray-500">Loading workshops...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Store className="w-6 h-6" />
                Workshop Management
              </h1>
              <p className="text-sm text-gray-600 mt-1">Manage workshops, approvals, and zones</p>
            </div>
            <button 
              onClick={() => router.push('/dashboard/super_admin/workshops/add')}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <Plus className="w-4 h-4" /> Add Workshop
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4 flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name, city, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border rounded-lg"
                />
              </div>
            <div className="flex gap-2">
            {['all', 'active', 'inactive', 'pending'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`px-4 py-2 rounded-lg capitalize ${filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Workshops Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
              <tr>
                <th className="px-6 py-3">Workshop</th>
                <th className="px-6 py-3">Contact</th>
                <th className="px-6 py-3">Location / Zone</th>
                <th className="px-6 py-3">Status</th>
                <th className="px-6 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredWorkshops.map((workshop) => (
                <tr key={workshop.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4">
                      <div className="font-medium text-gray-900">{workshop.name}</div>
                      <div className="text-sm text-gray-500">{workshop.contact_person || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                      <div className="text-gray-900">{workshop.phone}</div>
                      <div className="text-gray-500">{workshop.email}</div>
                  </td>
                  <td className="px-6 py-4 text-sm">
                    <div className="text-gray-900">{workshop.city}, {workshop.state}</div>
                    {workshop.zones?.name ? (
                      <div className="flex items-center gap-1 text-xs font-semibold text-blue-600 mt-1">
                        <MapPin className="w-3 h-3" /> {workshop.zones.name}
                      </div>
                    ) : (
                      <div className="text-xs text-orange-500 mt-1">No Zone Assigned</div>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${workshop.is_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                      {workshop.is_verified ? 'Active' : 'Inactive'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                    <button onClick={() => handleEditClick(workshop)} className="text-blue-600 hover:text-blue-900">
                      Edit
                      </button>
                    {workshop.is_verified ? (
                      <button onClick={() => handleDisable(workshop.id)} className="text-red-600 hover:text-red-900">Disable</button>
                    ) : (
                      <button onClick={() => handleApprove(workshop.id)} className="text-green-600 hover:text-green-900">Approve</button>
                    )}
                    <button onClick={() => router.push(`/dashboard/super_admin/inventory/pricing`)} className="text-purple-600 hover:text-purple-900">
                      Manage Rate
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Edit Modal (Full Details) */}
      {showEditModal && editingWorkshop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-3xl w-full p-6 m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6 border-b pb-4">
              <h2 className="text-xl font-bold">Edit Workshop Details</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSaveChanges} className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="col-span-2">
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Basic Information</h3>
              </div>
              
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Workshop Name *</label>
                <input type="text" required className="w-full p-2 border rounded-lg"
                  value={editingWorkshop.name} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input type="text" className="w-full p-2 border rounded-lg"
                  value={editingWorkshop.contact_person} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, contact_person: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input type="text" required className="w-full p-2 border rounded-lg"
                  value={editingWorkshop.phone} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, phone: e.target.value})} 
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input type="email" required className="w-full p-2 border rounded-lg"
                  value={editingWorkshop.email} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, email: e.target.value})} 
                />
              </div>

              {/* Address */}
              <div className="col-span-2 pt-2 border-t">
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Location & Address</h3>
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Full Address *</label>
                <textarea required className="w-full p-2 border rounded-lg" rows={2}
                  value={editingWorkshop.address} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, address: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">City *</label>
                <input type="text" required className="w-full p-2 border rounded-lg"
                  value={editingWorkshop.city} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, city: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">State *</label>
                <input type="text" required className="w-full p-2 border rounded-lg"
                  value={editingWorkshop.state} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, state: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                <input type="text" required className="w-full p-2 border rounded-lg"
                  value={editingWorkshop.pincode} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, pincode: e.target.value})} 
                />
              </div>

              {/* Zone Selector */}
              <div>
                <label className="block text-sm font-bold text-blue-800 mb-1">Assign Zone *</label>
                <div className="relative">
                  <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-blue-500 w-4 h-4" />
                  <select 
                    className="w-full pl-10 p-2 border rounded-lg bg-blue-50 focus:bg-white border-blue-200"
                    value={editingWorkshop.zone_id || ''}
                    onChange={e => setEditingWorkshop({...editingWorkshop, zone_id: e.target.value || null})}
                  >
                    <option value="">-- No Zone Assigned --</option>
                    {zones.map(z => (
                      <option key={z.id} value={z.id}>{z.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Bank Details */}
              <div className="col-span-2 pt-2 border-t">
                <h3 className="text-sm font-bold text-gray-500 uppercase mb-3">Bank & Financial Details</h3>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">GST Number</label>
                <input type="text" className="w-full p-2 border rounded-lg uppercase"
                  value={editingWorkshop.gst_number || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, gst_number: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Commission (%)</label>
                <input type="number" step="0.01" className="w-full p-2 border rounded-lg"
                  value={editingWorkshop.commission_percentage || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, commission_percentage: e.target.value})} 
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Bank Account Number</label>
                <input type="text" className="w-full p-2 border rounded-lg"
                  value={editingWorkshop.bank_account_number || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, bank_account_number: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                <input type="text" className="w-full p-2 border rounded-lg uppercase"
                  value={editingWorkshop.ifsc_code || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, ifsc_code: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID</label>
                <input type="text" className="w-full p-2 border rounded-lg"
                  value={editingWorkshop.upi_id || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, upi_id: e.target.value})} 
                />
              </div>

              <div className="col-span-2 flex gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-3 border rounded-lg hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-3 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 font-medium">
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
