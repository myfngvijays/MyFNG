'use client';

import React, { useState, useEffect } from 'react';
import { 
  ArrowLeft, Save, Plus, Trash2, Search, Package, 
  Wrench, Box, Loader2 
} from 'lucide-react';
import { useRouter, useParams } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import Link from 'next/link';

export default function PackageDetailPage() {
  const router = useRouter();
  const params = useParams();
  const packageId = params?.id ? String(params.id) : '';
  const supabase = getBrowserClient();
  
  const [pkg, setPkg] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Add Item State
  const [showAddItem, setShowAddItem] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemQty, setItemQty] = useState(1);
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  useEffect(() => {
    if (!packageId) return;
    fetchPackageDetails(packageId);
  }, [packageId]);

  useEffect(() => {
    if (showAddItem) {
      searchItems('');
    }
  }, [showAddItem]);

  const fetchPackageDetails = async (id: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/inventory/packages/${id}`);
      if (!res.ok) throw new Error('Failed to load package');
      const data = await res.json();
      setPkg(data);
      setItems(data.items || []);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to load package details');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePackage = async () => {
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/inventory/packages/${packageId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: pkg.name,
          description: pkg.description,
          hsn_sac_code: pkg.hsn_sac_code,
          default_tax_rate: parseFloat(pkg.default_tax_rate),
          is_active: pkg.is_active
        })
      });

      if (!res.ok) throw new Error('Failed to update');
      alert('Service updated successfully');
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to update service');
    } finally {
      setSaving(false);
    }
  };

  const searchItems = async (term: string) => {
    setSearchLoading(true);
    try {
      let data: any[] = [];
      
      // Search Master Products only (Products are added to Service Types)
      let query = supabase
        .from('master_products')
        .select('id, name, type, default_price, part_number')
        .limit(20);
      
      if (term) query = query.ilike('name', `%${term}%`);
      
      const { data: products } = await query;
      data = products || [];
      
      setSearchResults(data);
    } catch (error) {
      console.error('Search error:', error);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!selectedItem) return;

    try {
      const payload = { 
        product_id: selectedItem.id,
        quantity: itemQty 
      };

      const res = await fetch(`/api/admin/inventory/packages/${packageId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add item');
      }
      
      // Refresh
      fetchPackageDetails(packageId);
      setShowAddItem(false);
      setSelectedItem(null);
      setItemQty(1);
    } catch (error: any) {
      console.error('Error:', error);
      alert(error.message || 'Failed to add item');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    if (!confirm('Are you sure you want to remove this item?')) return;

    try {
      const res = await fetch(`/api/admin/inventory/packages/${packageId}/items?item_id=${itemId}`, {
        method: 'DELETE'
      });

      if (!res.ok) throw new Error('Failed to remove item');
      fetchPackageDetails(packageId);
    } catch (error) {
      console.error('Error:', error);
      alert('Failed to remove item');
    }
  };

  if (loading) return <div className="p-12 text-center"><Loader2 className="w-8 h-8 animate-spin mx-auto" /></div>;
  if (!pkg) return <div className="p-12 text-center">Service not found</div>;

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Link href="/dashboard/super_admin/inventory/packages" className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-6 h-6 text-gray-600" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Edit Service: {pkg.name}</h1>
          <p className="text-gray-500">Manage service details and included parts/products</p>
        </div>
        <button 
          onClick={handleUpdatePackage}
          disabled={saving}
          className="btn btn-primary flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Package Details */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-gray-400" />
              Service Info
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                <input 
                  type="text" 
                  className="w-full p-2 border rounded-lg bg-gray-50 focus:bg-white"
                  value={pkg.name}
                  onChange={e => setPkg({...pkg, name: e.target.value})}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea 
                  className="w-full p-2 border rounded-lg bg-gray-50 focus:bg-white"
                  rows={3}
                  value={pkg.description || ''}
                  onChange={e => setPkg({...pkg, description: e.target.value})}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tax Rate (%)</label>
                  <select 
                    className="w-full p-2 border rounded-lg bg-gray-50 focus:bg-white"
                    value={pkg.default_tax_rate}
                    onChange={e => setPkg({...pkg, default_tax_rate: e.target.value})}
                  >
                    <option value="5">5%</option>
                    <option value="12">12%</option>
                    <option value="18">18%</option>
                    <option value="28">28%</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">HSN Code</label>
                  <input 
                    type="text" 
                    className="w-full p-2 border rounded-lg bg-gray-50 focus:bg-white"
                    value={pkg.hsn_sac_code || ''}
                    onChange={e => setPkg({...pkg, hsn_sac_code: e.target.value})}
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  id="isActive"
                  checked={pkg.is_active}
                  onChange={e => setPkg({...pkg, is_active: e.target.checked})}
                  className="w-4 h-4 text-brand-primary rounded"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-gray-700">Active Service</label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Package Items */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50">
              <h3 className="font-bold text-gray-900 flex items-center gap-2">
                <Box className="w-5 h-5 text-gray-400" />
                Included Products/Parts ({items.length})
              </h3>
              <button 
                onClick={() => setShowAddItem(true)}
                className="btn btn-sm bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Product
              </button>
            </div>

            {items.length === 0 ? (
              <div className="p-12 text-center text-gray-500">
                <Package className="w-12 h-12 mx-auto text-gray-300 mb-3" />
                <p>No products added to this service yet.</p>
                <button onClick={() => setShowAddItem(true)} className="text-brand-primary font-medium hover:underline mt-2">Add first product</button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm text-left">
                  <thead className="bg-gray-50 text-gray-600 font-medium">
                    <tr>
                      <th className="p-4">Product Name</th>
                      <th className="p-4">Type</th>
                      <th className="p-4 text-center">Qty</th>
                      <th className="p-4 text-right">Default Price</th>
                      <th className="p-4 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {items.map((item) => {
                      const product = item.product;
                      return (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="p-4 font-medium text-gray-900">
                            {product?.name || 'Unknown Item'}
                            {product?.part_number && (
                              <span className="block text-xs text-gray-400 font-normal">{product.part_number}</span>
                            )}
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded text-xs font-medium ${
                              product?.type === 'PART' ? 'bg-blue-100 text-blue-700' : 
                              product?.type === 'LABOUR' ? 'bg-purple-100 text-purple-700' : 
                              'bg-gray-100 text-gray-600'
                            }`}>
                              {product?.type || 'Product'}
                            </span>
                          </td>
                          <td className="p-4 text-center font-bold text-gray-700">{item.quantity}</td>
                          <td className="p-4 text-right text-gray-500">
                             ₹{product?.default_price || 0}
                          </td>
                          <td className="p-4 text-right">
                            <button 
                              onClick={() => handleRemoveItem(item.id)}
                              className="text-red-500 hover:bg-red-50 p-2 rounded transition-colors"
                              title="Remove Item"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Add Item Modal */}
      {showAddItem && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 m-4 shadow-xl">
            <h3 className="text-xl font-bold mb-4">Add Product to Service</h3>
            
            {/* Search */}
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input 
                  type="text" 
                  autoFocus
                  placeholder="Search products/parts..."
                  className="w-full pl-10 p-2 border rounded-lg bg-gray-50 focus:bg-white outline-none focus:ring-2 focus:ring-brand-primary/20"
                  onChange={(e) => {
                    setItemSearchTerm(e.target.value);
                    searchItems(e.target.value);
                  }}
                />
              </div>
            </div>

            {/* Results */}
            <div className="max-h-60 overflow-y-auto border rounded-lg mb-4 divide-y divide-gray-100 bg-white">
              {searchLoading ? (
                <div className="p-4 text-center text-gray-500"><Loader2 className="w-5 h-5 animate-spin mx-auto" /></div>
              ) : searchResults.length === 0 ? (
                <div className="p-4 text-center text-gray-400 text-sm">No products found</div>
              ) : (
                searchResults.map(item => (
                  <div 
                    key={item.id}
                    onClick={() => setSelectedItem(item)}
                    className={`p-3 cursor-pointer hover:bg-blue-50 transition-colors flex justify-between items-center ${
                      selectedItem?.id === item.id ? 'bg-blue-50 border-l-4 border-brand-primary' : ''
                    }`}
                  >
                    <div>
                      <p className="font-medium text-gray-900">{item.name}</p>
                      <p className="text-xs text-gray-500">Price: ₹{item.default_price} {item.part_number ? `| PN: ${item.part_number}` : ''}</p>
                    </div>
                    {selectedItem?.id === item.id && <div className="w-2 h-2 rounded-full bg-brand-primary"></div>}
                  </div>
                ))
              )}
            </div>

            {/* Quantity */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
              <input 
                type="number" 
                min="1"
                className="w-full p-2 border rounded-lg"
                value={itemQty}
                onChange={e => setItemQty(parseInt(e.target.value))}
              />
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => { setShowAddItem(false); setSelectedItem(null); }}
                className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button 
                onClick={handleAddItem}
                disabled={!selectedItem}
                className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Add Product
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
}
