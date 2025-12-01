'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Loader2, Box } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ProductsTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    type: 'PART',
    hsn_sac_code: '',
    default_price: '',
    tax_rate: '18.00',
    unit: 'PIECE',
    category: ''
  });

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('master_products')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('master_products')
        .insert([formData]);
      
      if (error) throw error;
      
      setShowModal(false);
      setFormData({
        name: '',
        type: 'PART',
        hsn_sac_code: '',
        default_price: '',
        tax_rate: '18.00',
        unit: 'PIECE',
        category: ''
      });
      fetchProducts();
    } catch (err) {
      alert('Error creating product');
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
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add Product
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-gray-600 font-medium border-b">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">HSN/SAC</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Price</th>
                <th className="px-4 py-3">Tax</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {products.map((p) => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      p.type === 'PART' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {p.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">{p.hsn_sac_code || '-'}</td>
                  <td className="px-4 py-3 text-gray-500">{p.category || '-'}</td>
                  <td className="px-4 py-3 font-medium">₹{p.default_price}</td>
                  <td className="px-4 py-3 text-gray-500">{p.tax_rate}%</td>
                  <td className="px-4 py-3 text-right">
                    <button className="p-1 hover:bg-gray-100 rounded text-gray-500">
                      <Edit className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
              {products.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-500">
                    No products found. Add one to get started.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6">
            <h2 className="text-xl font-bold mb-4">Add New Product</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full border rounded-lg p-2 text-sm"
                    placeholder="e.g. Engine Oil"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className="w-full border rounded-lg p-2 text-sm"
                  >
                    <option value="PART">Part</option>
                    <option value="LABOUR">Labour</option>
                    <option value="CONSUMABLE">Consumable</option>
                    <option value="SERVICE">Service</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN/SAC Code</label>
                  <input
                    value={formData.hsn_sac_code}
                    onChange={e => setFormData({...formData, hsn_sac_code: e.target.value})}
                    className="w-full border rounded-lg p-2 text-sm"
                    placeholder="e.g. 8708"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full border rounded-lg p-2 text-sm"
                    placeholder="e.g. Engine"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Default Price</label>
                  <input
                    type="number"
                    required
                    value={formData.default_price}
                    onChange={e => setFormData({...formData, default_price: e.target.value})}
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
                    <option value="5.00">5%</option>
                    <option value="12.00">12%</option>
                    <option value="18.00">18%</option>
                    <option value="28.00">28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                    className="w-full border rounded-lg p-2 text-sm"
                  >
                    <option value="PIECE">Piece</option>
                    <option value="LITRE">Litre</option>
                    <option value="SET">Set</option>
                    <option value="KIT">Kit</option>
                    <option value="JOB">Job</option>
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
                  Create Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

