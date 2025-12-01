'use client';

import React, { useState, useEffect } from 'react';
import { Save, Search, Store, AlertTriangle, Loader2, Car, Filter } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function WorkshopPricingPage() {
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('');
  
  // Car Class State
  const [selectedClass, setSelectedClass] = useState<string>('DEFAULT'); // 'DEFAULT' means no specific class (Base Price)
  const [availableClasses, setAvailableClasses] = useState<string[]>(['DEFAULT', 'Hatchback', 'Sedan', 'SUV', 'Luxury', 'MUV']); 

  const [products, setProducts] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({}); // Map: productId -> price
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchWorkshops();
    // Optionally fetch dynamic classes from DB if needed, using hardcoded list for now as per common standards
  }, []);

  useEffect(() => {
    if (selectedWorkshop) {
      fetchPricingData(selectedWorkshop, selectedClass);
    } else {
      setProducts([]);
    }
  }, [selectedWorkshop, selectedClass]);

  const fetchWorkshops = async () => {
    try {
      const { data } = await supabase.from('workshops').select('id, name, city');
      setWorkshops(data || []);
      if (data && data.length > 0) setLoading(false);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    }
  };

  const fetchPricingData = async (workshopId: string, vehicleClass: string) => {
    setLoading(true);
    try {
      // 1. Fetch All Master Products
      const { data: masterProducts } = await supabase
        .from('master_products')
        .select('*')
        .order('name');

      // 2. Fetch Existing Overrides for this Workshop AND Class
      let query = supabase
        .from('workshop_product_pricing')
        .select('product_id, selling_price')
        .eq('workshop_id', workshopId);

      if (vehicleClass === 'DEFAULT') {
        query = query.is('class', null); // Default pricing where class is NULL
      } else {
        query = query.eq('class', vehicleClass);
      }

      const { data: existingPrices } = await query;

      // 3. Merge Data
      const priceMap: Record<string, number> = {};
      
      // If a price exists for this class, use it.
      // If not, we show the Default/Master price placeholder, but don't set it as an "override" yet.
      existingPrices?.forEach((p: any) => {
        priceMap[p.product_id] = p.selling_price;
      });

      setProducts(masterProducts || []);
      setPrices(priceMap);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (productId: string, price: string) => {
    setPrices(prev => ({
      ...prev,
      [productId]: parseFloat(price)
    }));
  };

  const handleSave = async () => {
    if (!selectedWorkshop) return;
    setSaving(true);
    try {
      // Prepare upsert data
      // We only save entries that have a valid price in the `prices` map
      const upsertData = Object.entries(prices).map(([productId, price]) => ({
        workshop_id: selectedWorkshop,
        product_id: productId,
        selling_price: price,
        class: selectedClass === 'DEFAULT' ? null : selectedClass
      }));

      if (upsertData.length === 0) {
        alert("No prices to save.");
        setSaving(false);
        return;
      }

      // We need to handle the unique constraint conflict.
      // The constraint is on (workshop_id, product_id, class).
      // Supabase upsert works well if we specify onConflict correctly.
      
      // Note: Since 'class' can be NULL, standard Postgres unique indexes treat NULLs as distinct (duplicates allowed).
      // But we created a unique index with COALESCE(class, 'DEFAULT') logic in migration 30.
      // However, Supabase client `upsert` might struggle with partial indexes or complex unique constraints directly.
      // It relies on the constraint name usually.
      
      // Let's try simple upsert. If it fails due to NULL class handling, we might need a different approach.
      // BUT, for 'DEFAULT' class (NULL), we might delete existing null-class entry and insert new? No, upsert is better.
      
      // WORKAROUND: Since unique index logic with NULL is tricky in upsert, 
      // we will delete existing entries for these products + class first, then insert.
      // OR rely on the fact that we replaced the standard constraint with a unique index.
      
      // Safest approach for UI: Delete specifically modified rows then Insert. 
      // Actually, let's try standard upsert first. If migration 30 created a unique index, it acts as constraint.
      
      const { error } = await supabase
        .from('workshop_product_pricing')
        .upsert(upsertData, { 
            onConflict: 'workshop_id, product_id, class' // This requires a real CONSTRAINT with this name or columns
            // Since we dropped the constraint and added an index, upsert might fail if we don't specify constraint name 
            // or if we rely on columns inference which doesn't support NULL well in some PG versions.
            // Let's try without onConflict params first (Supabase tries to infer PK). But this table PK is ID.
            // We don't have ID in our data.
        });

        // If the above fails because we are using a unique index instead of constraint:
        if (error) {
            console.warn("Upsert failed, trying delete-insert strategy", error);
            
            // Fallback: Delete logic
            // It's cleaner to just create a constraint that handles NULLs if possible, 
            // but since we are here, let's just do Delete-Insert for the specific scope
            
            // Delete existing for this scope
            const productIds = upsertData.map(d => d.product_id);
            let delQuery = supabase.from('workshop_product_pricing')
                .delete()
                .eq('workshop_id', selectedWorkshop)
                .in('product_id', productIds);
            
            if (selectedClass === 'DEFAULT') delQuery = delQuery.is('class', null);
            else delQuery = delQuery.eq('class', selectedClass);
            
            await delQuery;
            
            // Insert new
            const { error: insertError } = await supabase.from('workshop_product_pricing').insert(upsertData);
            if (insertError) throw insertError;
        }

      alert('Pricing updated successfully!');
    } catch (error: any) {
      alert('Error updating pricing: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workshop Pricing</h1>
          <p className="text-gray-500">Override prices by Workshop & Car Class</p>
        </div>
        <button 
          onClick={handleSave}
          disabled={saving || !selectedWorkshop}
          className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Changes
        </button>
      </div>

      {/* Controls: Workshop & Class */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {/* Workshop Selector */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">1. Select Workshop</label>
            <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
                className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
                value={selectedWorkshop}
                onChange={(e) => setSelectedWorkshop(e.target.value)}
            >
                <option value="">-- Select a Workshop --</option>
                {workshops.map(w => (
                <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
                ))}
            </select>
            </div>
        </div>

        {/* Class Selector */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
            <label className="block text-sm font-medium text-gray-700 mb-2">2. Select Car Class</label>
            <div className="relative">
            <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
                className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
                value={selectedClass}
                onChange={(e) => setSelectedClass(e.target.value)}
                disabled={!selectedWorkshop}
            >
                <option value="DEFAULT">Default (Base Price)</option>
                <option value="Hatchback">Hatchback</option>
                <option value="Sedan">Sedan</option>
                <option value="SUV">SUV</option>
                <option value="Luxury">Luxury</option>
                <option value="MUV">MUV</option>
            </select>
            </div>
        </div>
      </div>

      {/* Pricing Table */}
      {!selectedWorkshop ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <Store className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Please select a workshop to view pricing</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Filter products..." 
                className="w-full pl-10 p-2 border rounded-lg text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="text-sm text-gray-500">
                Editing rates for: <span className="font-bold text-brand-primary">{selectedClass === 'DEFAULT' ? 'All Classes (Base)' : selectedClass}</span>
            </div>
          </div>
          
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="p-4 font-medium text-gray-600">Product Name</th>
                  <th className="p-4 font-medium text-gray-600">Type</th>
                  <th className="p-4 font-medium text-gray-600 text-right">Global Default</th>
                  <th className="p-4 font-medium text-gray-600 text-right">
                    {selectedClass === 'DEFAULT' ? 'Workshop Base Price' : `${selectedClass} Price`}
                  </th>
                  <th className="p-4 font-medium text-gray-600 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={5} className="p-8 text-center">Loading...</td></tr>
                ) : (
                  filteredProducts.map((product) => {
                    const currentPrice = prices[product.id];
                    const hasOverride = currentPrice !== undefined;
                    
                    return (
                      <tr key={product.id} className={hasOverride ? 'bg-blue-50/30' : ''}>
                        <td className="p-4 font-medium">{product.name}</td>
                        <td className="p-4 text-xs text-gray-500">{product.type}</td>
                        <td className="p-4 text-right text-gray-500">₹{product.default_price}</td>
                        <td className="p-4 text-right">
                          <div className="relative inline-block w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                            <input 
                              type="number" 
                              className={`w-full pl-6 p-1.5 border rounded text-right font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none ${hasOverride ? 'border-blue-300 text-blue-700' : 'border-gray-200'}`}
                              placeholder={product.default_price.toString()}
                              value={currentPrice ?? ''}
                              onChange={(e) => handlePriceChange(product.id, e.target.value)}
                            />
                          </div>
                        </td>
                        <td className="p-4 text-center">
                          {hasOverride && (
                            <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                                {selectedClass === 'DEFAULT' ? 'Workshop Base' : `${selectedClass} Rate`}
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
