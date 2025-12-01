'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Package, Search, Filter, Loader2 } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ProductMasterPage() {
  const [products, setProducts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');

  const [newProduct, setNewProduct] = useState({
    name: '',
    type: 'PART',
    category: '',
    hsn_sac_code: '',
    default_price: '',
    tax_rate: '18.00',
    unit: 'pc',
    manufacturer: '',
    part_number: ''
  });
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchProducts();
  }, [filterType]);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('master_products')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (filterType !== 'ALL') {
        query = query.eq('type', filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAddProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('master_products')
        .insert([{
          ...newProduct,
          default_price: parseFloat(newProduct.default_price),
          tax_rate: parseFloat(newProduct.tax_rate)
        }]);
      
      if (error) throw error;
      
      setShowAddModal(false);
      setNewProduct({
        name: '', type: 'PART', category: '', hsn_sac_code: '',
        default_price: '', tax_rate: '18.00', unit: 'pc',
        manufacturer: '', part_number: ''
      });
      fetchProducts();
      alert('Product added successfully!');
    } catch (error: any) {
      alert('Error adding product: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.hsn_sac_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Product Master</h1>
          <p className="text-gray-500">Manage global catalog of Parts, Labours & Consumables</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add New Product
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <input 
            type="text" 
            placeholder="Search by name or HSN..." 
            className="w-full pl-10 p-2 border rounded-lg bg-gray-50 focus:bg-white transition-colors"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select 
          className="p-2 border rounded-lg bg-gray-50"
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="ALL">All Types</option>
          <option value="PART">Parts</option>
          <option value="LABOUR">Labour</option>
          <option value="CONSUMABLE">Consumables</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="p-4 font-medium text-gray-600">Name</th>
                <th className="p-4 font-medium text-gray-600">Type</th>
                <th className="p-4 font-medium text-gray-600">Category</th>
                <th className="p-4 font-medium text-gray-600">HSN/SAC</th>
                <th className="p-4 font-medium text-gray-600 text-right">Default Price</th>
                <th className="p-4 font-medium text-gray-600 text-center">Tax %</th>
                <th className="p-4 font-medium text-gray-600 text-center">Unit</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">Loading...</td>
                </tr>
              ) : filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">No products found.</td>
                </tr>
              ) : (
                filteredProducts.map((product) => (
                  <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                    <td className="p-4 font-medium text-gray-900">{product.name}</td>
                    <td className="p-4">
                      <span className={`px-2 py-1 rounded-md text-xs font-medium ${
                        product.type === 'PART' ? 'bg-blue-100 text-blue-700' :
                        product.type === 'LABOUR' ? 'bg-purple-100 text-purple-700' :
                        'bg-orange-100 text-orange-700'
                      }`}>
                        {product.type}
                      </span>
                    </td>
                    <td className="p-4 text-gray-600">{product.category || '-'}</td>
                    <td className="p-4 font-mono text-xs bg-gray-50 rounded w-fit">{product.hsn_sac_code || '-'}</td>
                    <td className="p-4 text-right font-medium">₹{product.default_price}</td>
                    <td className="p-4 text-center">{product.tax_rate}%</td>
                    <td className="p-4 text-center text-gray-500">{product.unit}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
          <div className="bg-white rounded-xl max-w-2xl w-full p-6 m-4 max-h-[90vh] overflow-y-auto">
            <h2 className="text-xl font-bold mb-6">Add New Product</h2>
            <form onSubmit={handleAddProduct} className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                <input type="text" required className="w-full p-2 border rounded-lg" 
                  value={newProduct.name} onChange={e => setNewProduct({...newProduct, name: e.target.value})} />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
                <select className="w-full p-2 border rounded-lg"
                  value={newProduct.type} onChange={e => setNewProduct({...newProduct, type: e.target.value})}>
                  <option value="PART">Part</option>
                  <option value="LABOUR">Labour</option>
                  <option value="CONSUMABLE">Consumable</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                <input type="text" className="w-full p-2 border rounded-lg" placeholder="e.g. Engine, Brake"
                  value={newProduct.category} onChange={e => setNewProduct({...newProduct, category: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Default Price (₹) *</label>
                <input type="number" step="0.01" required className="w-full p-2 border rounded-lg" 
                  value={newProduct.default_price} onChange={e => setNewProduct({...newProduct, default_price: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%) *</label>
                <select className="w-full p-2 border rounded-lg"
                  value={newProduct.tax_rate} onChange={e => setNewProduct({...newProduct, tax_rate: e.target.value})}>
                  <option value="0">0% (Nil)</option>
                  <option value="5">5%</option>
                  <option value="12">12%</option>
                  <option value="18">18%</option>
                  <option value="28">28%</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">HSN/SAC Code</label>
                <input type="text" className="w-full p-2 border rounded-lg" placeholder="e.g. 8708"
                  value={newProduct.hsn_sac_code} onChange={e => setNewProduct({...newProduct, hsn_sac_code: e.target.value})} />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                <input type="text" className="w-full p-2 border rounded-lg" placeholder="pc, ltr, set"
                  value={newProduct.unit} onChange={e => setNewProduct({...newProduct, unit: e.target.value})} />
              </div>

              <div className="col-span-2 flex gap-3 mt-6 pt-4 border-t">
                <button type="button" onClick={() => setShowAddModal(false)} className="flex-1 py-2 border rounded-lg hover:bg-gray-50">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90">
                  {submitting ? 'Saving...' : 'Save Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

