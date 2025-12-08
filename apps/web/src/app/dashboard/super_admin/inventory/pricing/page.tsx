'use client';

import React, { useState, useEffect } from 'react';
import { Save, Search, Store, Loader2, Car, MapPin, Copy } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function WorkshopPricingPage() {
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [filteredWorkshops, setFilteredWorkshops] = useState<any[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('');
  const [zones, setZones] = useState<any[]>([]);
  
  // Car Class State
  const [selectedClass, setSelectedClass] = useState<string>('DEFAULT');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [availableClasses, setAvailableClasses] = useState<string[]>(['DEFAULT']); 

  const [products, setProducts] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [bulkSaving, setBulkSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchWorkshops();
    fetchZones();
    fetchCarClasses();
  }, []);

  const fetchCarClasses = async () => {
    try {
      const { data, error } = await supabase
        .from('car_models')
        .select('class')
        .eq('is_active', true);
      
      if (error) throw error;
      
      // Get unique classes and filter out null/empty values
      const uniqueClasses = [...new Set(
        (data || [])
          .map((item: any) => item.class)
          .filter((cls: string | null) => cls && cls.trim() !== '')
      )].sort();
      
      // Add DEFAULT at the beginning
      setAvailableClasses(['DEFAULT', ...uniqueClasses]);
    } catch (error) {
      console.error('Error fetching car classes:', error);
      // Fallback to default classes if fetch fails
      setAvailableClasses(['DEFAULT', 'Hatchback', 'Sedan', 'SUV', 'Luxury', 'MUV']);
    }
  };

  // Filter workshops by zone when zone changes
  useEffect(() => {
    if (selectedZone) {
      const filtered = workshops.filter(w => w.zone_id === selectedZone);
      setFilteredWorkshops(filtered);
      // Reset workshop selection when zone changes
      setSelectedWorkshop('');
      setProducts([]);
      setPrices({});
    } else {
      setFilteredWorkshops([]);
      setSelectedWorkshop('');
      setProducts([]);
      setPrices({});
    }
  }, [selectedZone, workshops]);

  // Fetch pricing when workshop, class, or zone changes
  useEffect(() => {
    if (selectedWorkshop && selectedWorkshop !== 'ALL') {
      // Individual workshop mode - fetch pricing data
      fetchPricingData(selectedWorkshop, selectedClass, selectedZone);
    } else if (selectedWorkshop === 'ALL' && selectedZone) {
      // Bulk mode - just fetch products without pricing (user will set prices)
      fetchProductsForBulkMode();
    } else {
      setProducts([]);
      setPrices({});
    }
  }, [selectedWorkshop, selectedClass, selectedZone]);

  const fetchWorkshops = async () => {
    try {
      const { data } = await supabase.from('workshops').select('id, name, city, zone_id');
      setWorkshops(data || []);
      if (data && data.length > 0) setLoading(false);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    }
  };

  const fetchZones = async () => {
    try {
      const { data } = await supabase.from('zones').select('id, name').eq('is_active', true).order('name');
      setZones(data || []);
    } catch (error) {
      console.error('Error fetching zones:', error);
    }
  };

  const fetchProductsForBulkMode = async () => {
    setLoading(true);
    try {
      // Just fetch all products for bulk mode (no existing prices)
      const { data: masterProducts } = await supabase
        .from('master_products')
        .select('*')
        .order('name');

      setProducts(masterProducts || []);
      setPrices({}); // Start with empty prices in bulk mode
    } catch (error) {
      console.error('Error fetching products:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPricingData = async (workshopId: string, vehicleClass: string, zoneId: string) => {
    setLoading(true);
    try {
      // 1. Fetch All Master Products
      const { data: masterProducts } = await supabase
        .from('master_products')
        .select('*')
        .order('name');

      // 2. Fetch Existing Overrides for this Workshop, Class, and Zone
      let query = supabase
        .from('workshop_product_pricing')
        .select('product_id, selling_price')
        .eq('workshop_id', workshopId);

      if (vehicleClass === 'DEFAULT') {
        query = query.is('class', null);
      } else {
        query = query.eq('class', vehicleClass);
      }

      if (zoneId) {
        query = query.eq('zone_id', zoneId);
      } else {
        query = query.is('zone_id', null);
      }

      const { data: existingPrices } = await query;

      // 3. Merge Data
      const priceMap: Record<string, number> = {};
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
    if (!selectedWorkshop || selectedWorkshop === 'ALL') return;
    setSaving(true);
    try {
      const upsertData = Object.entries(prices).map(([productId, price]) => ({
        workshop_id: selectedWorkshop,
        product_id: productId,
        selling_price: price,
        class: selectedClass === 'DEFAULT' ? null : selectedClass,
        zone_id: selectedZone || null
      }));

      if (upsertData.length === 0) {
        alert("No prices to save.");
        setSaving(false);
        return;
      }

      // Delete existing for this scope
      const productIds = upsertData.map(d => d.product_id);
      let delQuery = supabase.from('workshop_product_pricing')
        .delete()
        .eq('workshop_id', selectedWorkshop)
        .in('product_id', productIds);
      
      if (selectedClass === 'DEFAULT') {
        delQuery = delQuery.is('class', null);
      } else {
        delQuery = delQuery.eq('class', selectedClass);
      }
      
      if (selectedZone) {
        delQuery = delQuery.eq('zone_id', selectedZone);
      } else {
        delQuery = delQuery.is('zone_id', null);
      }
      
      await delQuery;
      
      // Insert new
      const { error: insertError } = await supabase.from('workshop_product_pricing').insert(upsertData);
      if (insertError) throw insertError;

      alert('Pricing updated successfully!');
    } catch (error: any) {
      alert('Error updating pricing: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSave = async () => {
    if (!selectedZone || selectedWorkshop !== 'ALL') return;
    if (Object.keys(prices).length === 0) {
      alert("Please set prices first before applying to all workshops.");
      return;
    }

    const confirmed = confirm(
      `Are you sure you want to apply these prices to ALL ${filteredWorkshops.length} workshops in this zone?`
    );
    if (!confirmed) return;

    setBulkSaving(true);
    try {
      const workshopIds = filteredWorkshops.map(w => w.id);
      const productIds = Object.keys(prices);

      // Prepare bulk upsert data for all workshops
      const bulkData: any[] = [];
      workshopIds.forEach(workshopId => {
        productIds.forEach(productId => {
          bulkData.push({
            workshop_id: workshopId,
            product_id: productId,
            selling_price: prices[productId],
            class: selectedClass === 'DEFAULT' ? null : selectedClass,
            zone_id: selectedZone
          });
        });
      });

      // Delete existing entries for all workshops in this zone
      for (const workshopId of workshopIds) {
        let delQuery = supabase.from('workshop_product_pricing')
          .delete()
          .eq('workshop_id', workshopId)
          .in('product_id', productIds);
        
        if (selectedClass === 'DEFAULT') {
          delQuery = delQuery.is('class', null);
        } else {
          delQuery = delQuery.eq('class', selectedClass);
        }
        
        delQuery = delQuery.eq('zone_id', selectedZone);
        await delQuery;
      }

      // Insert new prices in batches (Supabase has limits)
      const batchSize = 100;
      for (let i = 0; i < bulkData.length; i += batchSize) {
        const batch = bulkData.slice(i, i + batchSize);
        const { error } = await supabase.from('workshop_product_pricing').insert(batch);
        if (error) throw error;
      }

      alert(`Pricing applied successfully to ${workshopIds.length} workshops!`);
      // Reset to show first workshop
      if (filteredWorkshops.length > 0) {
        setSelectedWorkshop(filteredWorkshops[0].id);
      }
    } catch (error: any) {
      alert('Error applying bulk pricing: ' + error.message);
    } finally {
      setBulkSaving(false);
    }
  };

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isBulkMode = selectedWorkshop === 'ALL' && selectedZone;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workshop Pricing</h1>
          <p className="text-gray-500">Override prices by Zone, Workshop & Car Class</p>
        </div>
        <div className="flex gap-2">
          {isBulkMode && (
            <button 
              onClick={handleBulkSave}
              disabled={bulkSaving || Object.keys(prices).length === 0}
              className="btn btn-secondary flex items-center gap-2 disabled:opacity-50"
            >
              {bulkSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Copy className="w-4 h-4" />}
              Apply to All ({filteredWorkshops.length}) Workshops
            </button>
          )}
          <button 
            onClick={handleSave}
            disabled={saving || !selectedWorkshop || selectedWorkshop === 'ALL'}
            className="btn btn-primary flex items-center gap-2 disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Changes
          </button>
        </div>
      </div>

      {/* Controls: Zone First, then Workshop & Class */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {/* Zone Selector - FIRST */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">1. Select Zone *</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
              className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedZone}
              onChange={(e) => setSelectedZone(e.target.value)}
            >
              <option value="">-- Select Zone First --</option>
              {zones.map(zone => (
                <option key={zone.id} value={zone.id}>{zone.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Workshop Selector - Shows workshops in selected zone */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">2. Select Workshop</label>
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
              className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedWorkshop}
              onChange={(e) => setSelectedWorkshop(e.target.value)}
              disabled={!selectedZone}
            >
              <option value="">-- Select Workshop --</option>
              {selectedZone && (
                <>
                  <option value="ALL" className="font-semibold bg-blue-50">
                    📋 All Workshops in Zone ({filteredWorkshops.length})
                  </option>
                  {filteredWorkshops.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>

        {/* Class Selector */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">3. Select Car Class</label>
          <div className="relative">
            <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
              className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={!selectedWorkshop}
            >
              <option value="DEFAULT">Default (Base Price)</option>
              {availableClasses.filter(c => c !== 'DEFAULT').map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Info Banner for Bulk Mode */}
      {isBulkMode && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Bulk Mode:</strong> Set prices below and click "Apply to All Workshops" to update all {filteredWorkshops.length} workshops in this zone at once.
            Or select a specific workshop to update individual pricing.
          </p>
        </div>
      )}

      {/* Pricing Table */}
      {!selectedWorkshop ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">Please select a zone first, then choose a workshop</p>
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
              Editing rates for: <span className="font-bold text-brand-primary">
                {isBulkMode ? `All Workshops in ${zones.find(z => z.id === selectedZone)?.name || 'Zone'}` : 
                 workshops.find(w => w.id === selectedWorkshop)?.name || 'Workshop'} 
                {' / '}
                {selectedClass === 'DEFAULT' ? 'All Classes' : selectedClass}
              </span>
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
                    {isBulkMode ? 'Bulk Price (All Workshops)' : 'Workshop Price'}
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
                              {isBulkMode ? 'Bulk Rate' : 'Custom Rate'}
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
