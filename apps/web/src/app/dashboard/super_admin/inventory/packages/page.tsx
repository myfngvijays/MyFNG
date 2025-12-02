'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Package, Search, ChevronRight, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';

export default function PackageListPage() {
  const router = useRouter();
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Using service_types as packages
  const [newPackage, setNewPackage] = useState({
    name: '',
    description: '',
    hsn_sac_code: '',
    default_tax_rate: '18.00',
    is_active: true
  });

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/inventory/packages');
      const responseText = await res.text();
      
      if (!res.ok) {
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch {
          errorData = { error: responseText || 'Unknown error' };
        }
        setError(errorData.error || `HTTP ${res.status}: Failed to fetch packages`);
        setPackages([]);
        return;
      }
      
      const data = JSON.parse(responseText);
      setPackages(Array.isArray(data) ? data : []);
    } catch (error: any) {
      console.error('Error fetching packages:', error);
      setError(error.message || 'Failed to load packages');
      setPackages([]);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePackage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    
    try {
      const payload = {
        ...newPackage,
        default_tax_rate: parseFloat(newPackage.default_tax_rate)
      };
      
      const res = await fetch('/api/admin/inventory/packages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const responseText = await res.text();

      if (!res.ok) {
        let err;
        try {
          err = JSON.parse(responseText);
        } catch {
          err = { error: responseText || 'Failed to create package' };
        }
        throw new Error(err.error || 'Failed to create package');
      }

      const createdPkg = JSON.parse(responseText);
      setShowAddModal(false);
      setNewPackage({
        name: '', description: '', hsn_sac_code: '',
        default_tax_rate: '18.00', is_active: true
      });
      
      // Refresh the list
      fetchPackages();
      
      // Navigate to detail page to add items
      router.push(`/dashboard/super_admin/inventory/packages/${createdPkg.id}`);
    } catch (error: any) {
      console.error('Error creating package:', error);
      setError(error.message || 'Failed to create package');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPackages = packages.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.hsn_sac_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Packages</h1>
          <p className="text-gray-500">Manage services and their included products (parts/consumables)</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create New Service
        </button>
      </div>

      {/* Error Message */}
      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
          <p className="text-red-800 font-medium">Error: {error}</p>
          <button 
            onClick={fetchPackages}
            className="mt-2 text-sm text-red-600 hover:underline"
          >
            Retry
          </button>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search services..." 
            className="w-full pl-10 p-2 border rounded-lg bg-gray-50 focus:bg-white transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : filteredPackages.length === 0 && !error ? (
        <div className="text-center p-12 bg-white rounded-xl border border-dashed border-gray-300">
          <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900">No Services Found</h3>
          <p className="text-gray-500 mb-4">Create your first service to get started.</p>
          <button 
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary btn-sm"
          >
            Create Service
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredPackages.map((pkg) => (
            <div 
              key={pkg.id} 
              onClick={() => router.push(`/dashboard/super_admin/inventory/packages/${pkg.id}`)}
              className="group bg-white rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-all cursor-pointer overflow-hidden"
            >
              <div className="p-5">
                <div className="flex justify-between items-start mb-2">
                  <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
                    <Package className="w-6 h-6" />
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${pkg.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                    {pkg.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <h3 className="text-lg font-bold text-gray-900 group-hover:text-brand-primary transition-colors mb-1">
                  {pkg.name}
                </h3>
                <p className="text-sm text-gray-500 line-clamp-2 mb-4 h-10">
                  {pkg.description || 'No description provided.'}
                </p>

                <div className="flex justify-between items-end border-t border-gray-50 pt-4">
                  <div>
                    <p className="text-xs text-gray-500 mb-1">HSN Code</p>
                    <p className="text-sm font-medium text-gray-900">{pkg.hsn_sac_code || '-'}</p>
                  </div>
                  <div className="flex items-center text-brand-primary text-sm font-medium">
                    Manage Items <ChevronRight className="w-4 h-4 ml-1" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 m-4 shadow-xl">
            <h2 className="text-xl font-bold mb-6">Create New Service</h2>
            <form onSubmit={handleCreatePackage} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Service Name *</label>
                <input 
                  type="text" 
                  required 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none" 
                  value={newPackage.name} 
                  onChange={e => setNewPackage({...newPackage, name: e.target.value})} 
                  placeholder="e.g. Gold Service"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none" 
                  rows={3}
                  value={newPackage.description} 
                  onChange={e => setNewPackage({...newPackage, description: e.target.value})}
                  placeholder="What does this service include?"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN/SAC Code</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none" 
                    value={newPackage.hsn_sac_code} 
                    onChange={e => setNewPackage({...newPackage, hsn_sac_code: e.target.value})} 
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                  <select 
                    className="w-full p-2 border rounded-lg focus:ring-2 focus:ring-brand-primary/20 outline-none"
                    value={newPackage.default_tax_rate}
                    onChange={e => setNewPackage({...newPackage, default_tax_rate: e.target.value})}
                  >
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowAddModal(false)} 
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50 font-medium"
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  disabled={submitting} 
                  className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 font-medium disabled:opacity-50"
                >
                  {submitting ? 'Creating...' : 'Create & Add Items'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
