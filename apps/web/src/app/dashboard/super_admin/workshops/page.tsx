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

  if (loading) return <div className="p-8 sm:p-10 md:p-12 text-center text-sm sm:text-base text-gray-500">Loading workshops...</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                <Store className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 flex-shrink-0" />
                <span className="truncate">Workshop Management</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Manage workshops, approvals, and zones</p>
            </div>
            <button 
              onClick={() => router.push('/dashboard/super_admin/workshops/add')}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto justify-center"
            >
              <Plus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Add Workshop</span>
              <span className="sm:hidden">Add</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4 flex flex-col sm:flex-row gap-3 sm:gap-4">
          <div className="flex-1 min-w-0 relative">
            <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
                <input
                  type="text"
                  placeholder="Search by name, city, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-sm border rounded-lg"
                />
              </div>
            <div className="flex gap-2 overflow-x-auto">
            {['all', 'active', 'inactive', 'pending'].map(status => (
              <button
                key={status}
                onClick={() => setFilterStatus(status as any)}
                className={`px-3 sm:px-4 py-1.5 sm:py-2 rounded-lg capitalize text-xs sm:text-sm whitespace-nowrap flex-shrink-0 ${filterStatus === status ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-700'}`}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        {/* Workshops Table - Desktop */}
        <div className="bg-white rounded-lg shadow overflow-hidden hidden lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase">
                <tr>
                  <th className="px-4 md:px-6 py-2 md:py-3">Workshop</th>
                  <th className="px-4 md:px-6 py-2 md:py-3">Contact</th>
                  <th className="px-4 md:px-6 py-2 md:py-3">Location / Zone</th>
                  <th className="px-4 md:px-6 py-2 md:py-3">Status</th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredWorkshops.map((workshop) => (
                  <tr key={workshop.id} className="hover:bg-gray-50">
                    <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="font-medium text-sm sm:text-base text-gray-900">{workshop.name}</div>
                        <div className="text-xs sm:text-sm text-gray-500">{workshop.contact_person || 'N/A'}</div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                        <div className="text-gray-900 truncate max-w-[200px]">{workshop.phone}</div>
                        <div className="text-gray-500 truncate">{workshop.email}</div>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm">
                      <div className="text-gray-900">{workshop.city}, {workshop.state}</div>
                      {workshop.zones?.name ? (
                        <div className="flex items-center gap-1 text-[10px] sm:text-xs font-semibold text-blue-600 mt-1">
                          <MapPin className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" /> {workshop.zones.name}
                        </div>
                      ) : (
                        <div className="text-[10px] sm:text-xs text-orange-500 mt-1">No Zone Assigned</div>
                      )}
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4">
                      <span className={`px-2 py-0.5 sm:py-1 text-xs font-semibold rounded-full ${workshop.is_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                        {workshop.is_verified ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-4 md:px-6 py-3 md:py-4 text-right text-xs sm:text-sm font-medium">
                      <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2">
                        <button onClick={() => handleEditClick(workshop)} className="text-blue-600 hover:text-blue-900 whitespace-nowrap">
                          Edit
                        </button>
                        {workshop.is_verified ? (
                          <button onClick={() => handleDisable(workshop.id)} className="text-red-600 hover:text-red-900 whitespace-nowrap">Disable</button>
                        ) : (
                          <button onClick={() => handleApprove(workshop.id)} className="text-green-600 hover:text-green-900 whitespace-nowrap">Approve</button>
                        )}
                        <button onClick={() => router.push(`/dashboard/super_admin/inventory/pricing`)} className="text-purple-600 hover:text-purple-900 whitespace-nowrap">
                          Manage Rate
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {filteredWorkshops.length === 0 && (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <Building className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No workshops found</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">
                {searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your filters'}
              </p>
            </div>
          )}
        </div>

        {/* Workshops Cards - Mobile/Tablet */}
        <div className="lg:hidden space-y-3 sm:space-y-4">
          {filteredWorkshops.map((workshop) => (
            <div key={workshop.id} className="bg-white rounded-lg shadow p-3 sm:p-4 border border-gray-100">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm sm:text-base text-gray-900 mb-1">{workshop.name}</div>
                  <div className="text-xs text-gray-500">{workshop.contact_person || 'N/A'}</div>
                </div>
                <span className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full flex-shrink-0 ${workshop.is_verified ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {workshop.is_verified ? 'Active' : 'Inactive'}
                </span>
              </div>
              
              <div className="space-y-2 mb-3">
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Phone:</span>
                  <span className="text-gray-900">{workshop.phone}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Email:</span>
                  <span className="text-gray-900 truncate max-w-[200px]">{workshop.email}</span>
                </div>
                <div className="flex items-center justify-between text-xs sm:text-sm">
                  <span className="text-gray-500">Location:</span>
                  <span className="text-gray-900">{workshop.city}, {workshop.state}</span>
                </div>
                {workshop.zones?.name && (
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-500">Zone:</span>
                    <div className="flex items-center gap-1 text-blue-600 font-semibold">
                      <MapPin className="w-3 h-3 flex-shrink-0" /> {workshop.zones.name}
                    </div>
                  </div>
                )}
              </div>

              <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                <button onClick={() => handleEditClick(workshop)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-blue-600 hover:text-blue-900 border border-blue-200 rounded-lg hover:bg-blue-50">
                  Edit
                </button>
                {workshop.is_verified ? (
                  <button onClick={() => handleDisable(workshop.id)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-red-600 hover:text-red-900 border border-red-200 rounded-lg hover:bg-red-50">
                    Disable
                  </button>
                ) : (
                  <button onClick={() => handleApprove(workshop.id)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-green-600 hover:text-green-900 border border-green-200 rounded-lg hover:bg-green-50">
                    Approve
                  </button>
                )}
                <button onClick={() => router.push(`/dashboard/super_admin/inventory/pricing`)} className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-purple-600 hover:text-purple-900 border border-purple-200 rounded-lg hover:bg-purple-50">
                  Manage Rate
                </button>
              </div>
            </div>
          ))}

          {filteredWorkshops.length === 0 && (
            <div className="text-center py-8 sm:py-10 md:py-12 bg-white rounded-lg shadow">
              <Building className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No workshops found</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">
                {searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your filters'}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Edit Modal (Full Details) */}
      {showEditModal && editingWorkshop && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white rounded-lg sm:rounded-xl max-w-3xl w-full p-4 sm:p-5 md:p-6 m-2 sm:m-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sm:mb-5 md:mb-6 border-b pb-3 sm:pb-4">
              <h2 className="text-lg sm:text-xl font-bold">Edit Workshop Details</h2>
              <button onClick={() => setShowEditModal(false)} className="p-1 hover:bg-gray-100 rounded-full">
                <X className="w-4 h-4 sm:w-5 sm:h-5 text-gray-500" />
              </button>
            </div>
            
            <form onSubmit={handleSaveChanges} className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
              {/* Basic Info */}
              <div className="col-span-2">
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase mb-2 sm:mb-3">Basic Information</h3>
              </div>
              
              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Workshop Name *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.name} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, name: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Contact Person</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.contact_person} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, contact_person: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.phone} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, phone: e.target.value})} 
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email Address *</label>
                <input type="email" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.email} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, email: e.target.value})} 
                />
              </div>

              {/* Address */}
              <div className="col-span-2 pt-2 border-t">
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase mb-2 sm:mb-3">Location & Address</h3>
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Full Address *</label>
                <textarea required className="w-full px-3 py-2 text-sm border rounded-lg" rows={2}
                  value={editingWorkshop.address} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, address: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">City *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.city} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, city: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">State *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.state} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, state: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Pincode *</label>
                <input type="text" required className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.pincode} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, pincode: e.target.value})} 
                />
              </div>

              {/* Zone Selector */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-blue-800 mb-1">Assign Zone *</label>
                <div className="relative">
                  <MapPin className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 text-blue-500 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <select 
                    className="w-full pl-8 sm:pl-10 px-3 py-2 text-sm border rounded-lg bg-blue-50 focus:bg-white border-blue-200"
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
                <h3 className="text-xs sm:text-sm font-bold text-gray-500 uppercase mb-2 sm:mb-3">Bank & Financial Details</h3>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">GST Number</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg uppercase"
                  value={editingWorkshop.gst_number || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, gst_number: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Commission (%)</label>
                <input type="number" step="0.01" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.commission_percentage || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, commission_percentage: e.target.value})} 
                />
              </div>

              <div className="col-span-2">
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Bank Account Number</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.bank_account_number || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, bank_account_number: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">IFSC Code</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg uppercase"
                  value={editingWorkshop.ifsc_code || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, ifsc_code: e.target.value})} 
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">UPI ID</label>
                <input type="text" className="w-full px-3 py-2 text-sm border rounded-lg"
                  value={editingWorkshop.upi_id || ''} 
                  onChange={e => setEditingWorkshop({...editingWorkshop, upi_id: e.target.value})} 
                />
              </div>

              <div className="col-span-2 flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6 pt-3 sm:pt-4 border-t">
                <button type="button" onClick={() => setShowEditModal(false)} className="flex-1 py-2.5 sm:py-3 text-sm sm:text-base border rounded-lg hover:bg-gray-50 font-medium">
                  Cancel
                </button>
                <button type="submit" disabled={saving} className="flex-1 py-2.5 sm:py-3 text-sm sm:text-base bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 font-medium">
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
