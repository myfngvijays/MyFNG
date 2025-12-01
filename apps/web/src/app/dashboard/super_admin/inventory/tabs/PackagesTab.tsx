'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Package, Loader2 } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function PackagesTab() {
  const [packages, setPackages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    total_price: '',
    tax_rate: '18.00'
  });

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchPackages();
  }, []);

  const fetchPackages = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('service_packages')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setPackages(data || []);
    } catch (err) {
      console.error('Error fetching packages:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('service_packages')
        .insert([formData]);
      
      if (error) throw error;
      
      setShowModal(false);
      setFormData({ name: '', description: '', total_price: '', tax_rate: '18.00' });
      fetchPackages();
    } catch (err) {
      alert('Error creating package');
      console.error(err);
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div className="relative max-w-md w-full">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search packages..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Create Package
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {packages.map((pkg) => (
            <div key={pkg.id} className="border rounded-xl p-4 hover:shadow-md transition-shadow bg-white">
              <div className="flex justify-between items-start mb-2">
                <div className="p-2 bg-orange-50 rounded-lg">
                  <Package className="w-6 h-6 text-orange-600" />
                </div>
                <button className="text-gray-400 hover:text-brand-primary">
                  <Edit className="w-4 h-4" />
                </button>
              </div>
              <h3 className="font-semibold text-gray-900 mb-1">{pkg.name}</h3>
              <p className="text-sm text-gray-500 mb-4 line-clamp-2">{pkg.description || 'No description'}</p>
              
              <div className="flex justify-between items-end border-t pt-3">
                <div>
                  <span className="text-xs text-gray-500 block">Tax: {pkg.tax_rate}%</span>
                  <span className="text-xs text-green-600 font-medium">Active</span>
                </div>
                <div className="text-right">
                  <span className="text-xs text-gray-500 block">Total Price</span>
                  <span className="text-lg font-bold text-brand-primary">₹{pkg.total_price}</span>
                </div>
              </div>
            </div>
          ))}
          
          {packages.length === 0 && (
            <div className="col-span-full py-12 text-center text-gray-500 bg-gray-50 rounded-xl border border-dashed">
              <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
              <p>No service packages found.</p>
              <button onClick={() => setShowModal(true)} className="text-brand-primary text-sm font-medium mt-2 hover:underline">
                Create your first package
              </button>
            </div>
          )}
        </div>
      )}

      {/* Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-xl font-bold mb-4">Create Service Package</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Package Name</label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full border rounded-lg p-2 text-sm"
                  placeholder="e.g. Gold Service Bundle"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full border rounded-lg p-2 text-sm h-20 resize-none"
                  placeholder="What's included..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Total Price</label>
                  <input
                    type="number"
                    required
                    value={formData.total_price}
                    onChange={e => setFormData({...formData, total_price: e.target.value})}
                    className="w-full border rounded-lg p-2 text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                  <select
                    value={formData.tax_rate}
                    onChange={e => setFormData({...formData, tax_rate: e.target.value})}
                    className="w-full border rounded-lg p-2 text-sm"
                  >
                    <option value="12.00">12%</option>
                    <option value="18.00">18%</option>
                    <option value="28.00">28%</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm hover:bg-brand-primary/90"
                >
                  Create Package
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

