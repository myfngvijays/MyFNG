'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Edit, Trash2, Loader2, Box } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase/browserClient';

export default function ProductsTab() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
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

  const supabase = getBrowserClient();

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

  const q = searchTerm.trim().toLowerCase();
  const filteredProducts = !q
    ? products
    : products.filter(
        (p) =>
          String(p.name || '').toLowerCase().includes(q) ||
          String(p.hsn_sac_code || '').toLowerCase().includes(q) ||
          String(p.category || '').toLowerCase().includes(q) ||
          String(p.type || '').toLowerCase().includes(q)
      );

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
    <div className="p-3 sm:p-4 md:p-6">
      <div className="flex flex-col sm:flex-row justify-between items-stretch sm:items-center gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
        <div className="relative max-w-full sm:max-w-md w-full">
          <Search className="absolute left-2 sm:left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search products..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Add Product</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8 sm:p-10 md:p-12">
          <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
        <>
          {/* Desktop Table */}
          <div className="hidden lg:block overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium border-b">
                <tr>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">Name</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">Type</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">HSN/SAC</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">Category</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">Price</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-xs sm:text-sm">Tax</th>
                  <th className="px-3 sm:px-4 py-2 sm:py-3 text-right text-xs sm:text-sm">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {filteredProducts.map((p) => (
                  <tr key={p.id} className="hover:bg-gray-50">
                    <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-gray-900 text-xs sm:text-sm">{p.name}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3">
                      <span className={`px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                        p.type === 'PART' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                      }`}>
                        {p.type}
                      </span>
                    </td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-500 text-xs sm:text-sm">{p.hsn_sac_code || '-'}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-500 text-xs sm:text-sm">{p.category || '-'}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 font-medium text-xs sm:text-sm">₹{p.default_price}</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-gray-500 text-xs sm:text-sm">{p.tax_rate}%</td>
                    <td className="px-3 sm:px-4 py-2 sm:py-3 text-right">
                      <button className="p-1 hover:bg-gray-100 rounded text-gray-500">
                        <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
                {filteredProducts.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 sm:py-10 md:py-12 text-center text-gray-500 text-sm sm:text-base">
                      {searchTerm.trim() ? `No results for "${searchTerm.trim()}"` : 'No products found. Add one to get started.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Mobile Cards */}
          <div className="lg:hidden space-y-3 sm:space-y-4">
            {filteredProducts.map((p) => (
              <div key={p.id} className="card p-3 sm:p-4 hover:shadow-md transition">
                <div className="flex items-start justify-between mb-2 sm:mb-3">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-sm sm:text-base text-gray-900 truncate">{p.name}</h3>
                    <span className={`inline-block mt-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-medium ${
                      p.type === 'PART' ? 'bg-blue-100 text-blue-700' : 'bg-purple-100 text-purple-700'
                    }`}>
                      {p.type}
                    </span>
                  </div>
                  <button className="p-1 hover:bg-gray-100 rounded text-gray-500 flex-shrink-0 ml-2">
                    <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2 sm:gap-3 text-xs sm:text-sm">
                  <div>
                    <p className="text-gray-500">HSN/SAC</p>
                    <p className="font-medium">{p.hsn_sac_code || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Category</p>
                    <p className="font-medium">{p.category || '-'}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Price</p>
                    <p className="font-medium">₹{p.default_price}</p>
                  </div>
                  <div>
                    <p className="text-gray-500">Tax</p>
                    <p className="font-medium">{p.tax_rate}%</p>
                  </div>
                </div>
              </div>
            ))}
            {filteredProducts.length === 0 && (
              <div className="card text-center py-8 sm:py-10 md:py-12">
                <p className="text-gray-500 text-sm sm:text-base">
                  {searchTerm.trim() ? `No results for "${searchTerm.trim()}"` : 'No products found. Add one to get started.'}
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-5 md:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Add New Product</h2>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    required
                    value={formData.name}
                    onChange={e => setFormData({...formData, name: e.target.value})}
                    className="w-full border rounded-lg p-1.5 sm:p-2 text-xs sm:text-sm"
                    placeholder="e.g. Engine Oil"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={formData.type}
                    onChange={e => setFormData({...formData, type: e.target.value})}
                    className="w-full border rounded-lg p-1.5 sm:p-2 text-xs sm:text-sm"
                  >
                    <option value="PART">Part</option>
                    <option value="LABOUR">Labour</option>
                    <option value="CONSUMABLE">Consumable</option>
                    <option value="SERVICE">Service</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">HSN/SAC Code</label>
                  <input
                    value={formData.hsn_sac_code}
                    onChange={e => setFormData({...formData, hsn_sac_code: e.target.value})}
                    className="w-full border rounded-lg p-1.5 sm:p-2 text-xs sm:text-sm"
                    placeholder="e.g. 8708"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Category</label>
                  <input
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                    className="w-full border rounded-lg p-1.5 sm:p-2 text-xs sm:text-sm"
                    placeholder="e.g. Engine"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Default Price</label>
                  <input
                    type="number"
                    required
                    value={formData.default_price}
                    onChange={e => setFormData({...formData, default_price: e.target.value})}
                    className="w-full border rounded-lg p-1.5 sm:p-2 text-xs sm:text-sm"
                    placeholder="0.00"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                  <select
                    value={formData.tax_rate}
                    onChange={e => setFormData({...formData, tax_rate: e.target.value})}
                    className="w-full border rounded-lg p-1.5 sm:p-2 text-xs sm:text-sm"
                  >
                    <option value="5.00">5%</option>
                    <option value="12.00">12%</option>
                    <option value="18.00">18%</option>
                    <option value="28.00">28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={e => setFormData({...formData, unit: e.target.value})}
                    className="w-full border rounded-lg p-1.5 sm:p-2 text-xs sm:text-sm"
                  >
                    <option value="PIECE">Piece</option>
                    <option value="LITRE">Litre</option>
                    <option value="SET">Set</option>
                    <option value="KIT">Kit</option>
                    <option value="JOB">Job</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6 pt-4 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-3 sm:px-4 py-1.5 sm:py-2 text-gray-600 hover:bg-gray-100 rounded-lg text-xs sm:text-sm w-full sm:w-auto"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 sm:px-4 py-1.5 sm:py-2 bg-brand-primary text-white rounded-lg text-xs sm:text-sm hover:bg-brand-primary/90 w-full sm:w-auto"
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

