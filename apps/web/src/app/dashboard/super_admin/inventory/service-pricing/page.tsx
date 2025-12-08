'use client';

import React, { useState, useEffect } from 'react';
import { Save, Search, Store, Loader2, Car, MapPin, Copy, Building2 } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ServiceTypePricingPage() {
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [filteredWorkshops, setFilteredWorkshops] = useState<any[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('');
  const [zones, setZones] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  
  // Car Class State
  const [selectedClass, setSelectedClass] = useState<string>('DEFAULT');
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [availableClasses, setAvailableClasses] = useState<string[]>(['DEFAULT']);

  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
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

  // Fetch cities when zone changes
  useEffect(() => {
    if (selectedZone) {
      fetchCitiesByZone(selectedZone);
      // Reset city, workshop and class selection when zone changes
      setSelectedCity('');
      setSelectedWorkshop('');
      setSelectedClass('DEFAULT');
      setServiceTypes([]);
      setPrices({});
    } else {
      setCities([]);
      setSelectedCity('');
      setFilteredWorkshops([]);
      setSelectedWorkshop('');
      setSelectedClass('DEFAULT');
      setServiceTypes([]);
      setPrices({});
    }
  }, [selectedZone]);

  // Filter workshops by zone and city
  useEffect(() => {
    if (selectedZone) {
      let filtered = workshops.filter(w => w.zone_id === selectedZone);
      if (selectedCity) {
        // Match by city name (workshops have city as string, not city_id)
        const selectedCityName = cities.find(c => c.id === selectedCity)?.name;
        if (selectedCityName) {
          filtered = filtered.filter(w => w.city?.toLowerCase() === selectedCityName.toLowerCase());
        }
      }
      setFilteredWorkshops(filtered);
    } else {
      setFilteredWorkshops([]);
    }
  }, [selectedZone, selectedCity, workshops, cities]);

  // Reset workshop when city or class changes
  useEffect(() => {
    if (selectedZone && (selectedCity || selectedClass)) {
      setSelectedWorkshop('');
      setServiceTypes([]);
      setPrices({});
    }
  }, [selectedCity, selectedClass]);

  // Fetch pricing when workshop, class, zone, or city changes
  useEffect(() => {
    if (selectedWorkshop && selectedWorkshop !== 'ALL' && selectedZone && selectedClass) {
      // Individual workshop mode - fetch pricing data
      fetchPricingData(selectedWorkshop, selectedClass, selectedZone, selectedCity);
    } else if (selectedWorkshop === 'ALL' && selectedZone && selectedClass) {
      // Bulk mode - just fetch service types without pricing (user will set prices)
      fetchServiceTypesForBulkMode();
    } else {
      setServiceTypes([]);
      setPrices({});
    }
  }, [selectedWorkshop, selectedClass, selectedZone, selectedCity]);

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

  const fetchCitiesByZone = async (zoneId: string) => {
    try {
      const { data } = await supabase
        .from('cities')
        .select('*')
        .eq('zone_id', zoneId)
        .eq('is_active', true)
        .order('name');
      setCities(data || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const fetchServiceTypesForBulkMode = async () => {
    setLoading(true);
    try {
      // Just fetch all service types for bulk mode (no existing prices)
      const { data: allServiceTypes } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      setServiceTypes(allServiceTypes || []);
      setPrices({}); // Start with empty prices in bulk mode
    } catch (error) {
      console.error('Error fetching service types:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPricingData = async (workshopId: string, vehicleClass: string, zoneId: string, cityId?: string) => {
    setLoading(true);
    try {
      // 1. Fetch All Service Types
      const { data: allServiceTypes } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      // 2. Fetch Existing Overrides for this Workshop, Class, Zone, and City
      let query = supabase
        .from('workshop_service_pricing')
        .select('service_type_id, custom_price')
        .eq('workshop_id', workshopId);

      if (vehicleClass === 'DEFAULT') {
        query = query.is('class', null);
      } else {
        query = query.eq('class', vehicleClass);
      }

      if (cityId) {
        query = query.eq('city_id', cityId);
      } else {
        query = query.is('city_id', null);
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
        priceMap[p.service_type_id] = p.custom_price;
      });

      setServiceTypes(allServiceTypes || []);
      setPrices(priceMap);
    } catch (error) {
      console.error('Error fetching pricing:', error);
    } finally {
      setLoading(false);
    }
  };

  const handlePriceChange = (serviceTypeId: string, price: string) => {
    setPrices(prev => ({
      ...prev,
      [serviceTypeId]: parseFloat(price)
    }));
  };

  const handleSave = async () => {
    if (!selectedWorkshop || selectedWorkshop === 'ALL') return;
    setSaving(true);
    try {
      const upsertData = Object.entries(prices).map(([serviceTypeId, price]) => ({
        workshop_id: selectedWorkshop,
        service_type_id: serviceTypeId,
        custom_price: price,
        class: selectedClass === 'DEFAULT' ? null : selectedClass,
        zone_id: selectedZone || null,
        city_id: selectedCity || null
      }));

      if (upsertData.length === 0) {
        alert("No prices to save.");
        setSaving(false);
        return;
      }

      // Delete existing for this scope
      const serviceTypeIds = upsertData.map(d => d.service_type_id);
      let delQuery = supabase.from('workshop_service_pricing')
        .delete()
        .eq('workshop_id', selectedWorkshop)
        .in('service_type_id', serviceTypeIds);
      
      if (selectedClass === 'DEFAULT') {
        delQuery = delQuery.is('class', null);
      } else {
        delQuery = delQuery.eq('class', selectedClass);
      }
      
      if (selectedCity) {
        delQuery = delQuery.eq('city_id', selectedCity);
      } else {
        delQuery = delQuery.is('city_id', null);
      }
      
      if (selectedZone) {
        delQuery = delQuery.eq('zone_id', selectedZone);
      } else {
        delQuery = delQuery.is('zone_id', null);
      }
      
      await delQuery;
      
      // Insert new
      const { error: insertError } = await supabase
        .from('workshop_service_pricing')
        .insert(upsertData);
      
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

    const locationText = selectedCity 
      ? `${cities.find(c => c.id === selectedCity)?.name || 'City'} in ${zones.find(z => z.id === selectedZone)?.name || 'Zone'}`
      : `${zones.find(z => z.id === selectedZone)?.name || 'Zone'}`;

    const confirmed = confirm(
      `Are you sure you want to apply these service prices to ALL ${filteredWorkshops.length} workshops in ${locationText}?`
    );
    if (!confirmed) return;

    setBulkSaving(true);
    try {
      const workshopIds = filteredWorkshops.map(w => w.id);
      const serviceTypeIds = Object.keys(prices);

      // Prepare bulk upsert data for all workshops
      const bulkData: any[] = [];
      workshopIds.forEach(workshopId => {
        serviceTypeIds.forEach(serviceTypeId => {
          bulkData.push({
            workshop_id: workshopId,
            service_type_id: serviceTypeId,
            custom_price: prices[serviceTypeId],
            class: selectedClass === 'DEFAULT' ? null : selectedClass,
            zone_id: selectedZone || null,
            city_id: selectedCity || null
          });
        });
      });

      // Delete existing entries for all workshops in this scope
      for (const workshopId of workshopIds) {
        let delQuery = supabase.from('workshop_service_pricing')
          .delete()
          .eq('workshop_id', workshopId)
          .in('service_type_id', serviceTypeIds);
        
        if (selectedClass === 'DEFAULT') {
          delQuery = delQuery.is('class', null);
        } else {
          delQuery = delQuery.eq('class', selectedClass);
        }
        
        if (selectedCity) {
          delQuery = delQuery.eq('city_id', selectedCity);
        } else {
          delQuery = delQuery.is('city_id', null);
        }
        
        if (selectedZone) {
        delQuery = delQuery.eq('zone_id', selectedZone);
        } else {
          delQuery = delQuery.is('zone_id', null);
        }
        
        await delQuery;
      }

      // Insert new prices in batches (Supabase has limits)
      const batchSize = 100;
      for (let i = 0; i < bulkData.length; i += batchSize) {
        const batch = bulkData.slice(i, i + batchSize);
        const { error } = await supabase.from('workshop_service_pricing').insert(batch);
        if (error) throw error;
      }

      alert(`Service pricing applied successfully to ${workshopIds.length} workshops!`);
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

  const filteredServiceTypes = serviceTypes.filter(st => 
    st.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const isBulkMode = selectedWorkshop === 'ALL' && selectedZone && selectedClass;

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Service Type Pricing</h1>
          <p className="text-gray-500">Override service prices by Zone, City, Workshop & Car Class</p>
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

      {/* Controls: Zone → City → Class → Workshop */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
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

        {/* City Selector - SECOND */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">2. Select City (Optional)</label>
          <div className="relative">
            <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
              className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedCity}
              onChange={(e) => setSelectedCity(e.target.value)}
              disabled={!selectedZone}
            >
              <option value="">All Cities in Zone</option>
              {cities.map(city => (
                <option key={city.id} value={city.id}>{city.name}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Class Selector - THIRD */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">3. Select Car Class *</label>
          <div className="relative">
            <Car className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
              className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedClass}
              onChange={(e) => setSelectedClass(e.target.value)}
              disabled={!selectedZone}
            >
              <option value="DEFAULT">Default (Base Price)</option>
              {availableClasses.filter(c => c !== 'DEFAULT').map(cls => (
                <option key={cls} value={cls}>{cls}</option>
              ))}
            </select>
          </div>
        </div>

        {/* Workshop Selector - FOURTH */}
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <label className="block text-sm font-medium text-gray-700 mb-2">4. Select Workshop</label>
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
            <select 
              className="w-full pl-10 p-3 border rounded-lg bg-gray-50 focus:bg-white transition-colors appearance-none"
              value={selectedWorkshop}
              onChange={(e) => setSelectedWorkshop(e.target.value)}
              disabled={!selectedZone || !selectedClass}
            >
              <option value="">-- Select Workshop --</option>
              {selectedZone && selectedClass && (
                <>
                  <option value="ALL" className="font-semibold bg-blue-50">
                    📋 All Workshops {selectedCity ? `in ${cities.find(c => c.id === selectedCity)?.name}` : `in Zone`} ({filteredWorkshops.length})
                  </option>
                  {filteredWorkshops.map(w => (
                    <option key={w.id} value={w.id}>{w.name} ({w.city})</option>
                  ))}
                </>
              )}
            </select>
          </div>
        </div>
      </div>

      {/* Info Banner for Bulk Mode */}
      {isBulkMode && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-sm text-blue-800">
            <strong>Bulk Mode:</strong> Set prices below and click "Apply to All Workshops" to update all {filteredWorkshops.length} workshops 
            {selectedCity ? ` in ${cities.find(c => c.id === selectedCity)?.name}` : ''} 
            {selectedCity ? '' : ` in ${zones.find(z => z.id === selectedZone)?.name || 'Zone'}`} 
            {' '}for {selectedClass === 'DEFAULT' ? 'all classes' : selectedClass} at once.
            Or select a specific workshop to update individual pricing.
          </p>
        </div>
      )}

      {/* Pricing Table */}
      {!selectedZone || !selectedClass || !selectedWorkshop ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl border border-dashed border-gray-200">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {!selectedZone && "Please select a zone first"}
            {selectedZone && !selectedClass && "Please select a car class"}
            {selectedZone && selectedClass && !selectedWorkshop && "Please select a workshop"}
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100">
          <div className="p-4 border-b border-gray-100 flex justify-between items-center">
            <div className="relative w-full max-w-md">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input 
                type="text" 
                placeholder="Filter services..." 
                className="w-full pl-10 p-2 border rounded-lg text-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="text-sm text-gray-500">
              Editing rates for: <span className="font-bold text-brand-primary">
                {zones.find(z => z.id === selectedZone)?.name || 'Zone'} 
                {selectedCity && ` / ${cities.find(c => c.id === selectedCity)?.name || 'City'}`}
                {' / '}
                {selectedClass === 'DEFAULT' ? 'All Classes' : selectedClass}
                {' / '}
                {isBulkMode ? `All Workshops (${filteredWorkshops.length})` : 
                 workshops.find(w => w.id === selectedWorkshop)?.name || 'Workshop'}
              </span>
            </div>
          </div>
          
          <div className="max-h-[600px] overflow-y-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 sticky top-0 z-10">
                <tr>
                  <th className="p-4 font-medium text-gray-600">Service Name</th>
                  <th className="p-4 font-medium text-gray-600">HSN Code</th>
                  <th className="p-4 font-medium text-gray-600 text-right">
                    {isBulkMode ? 'Bulk Price (All Workshops)' : 'Custom Price'}
                  </th>
                  <th className="p-4 font-medium text-gray-600 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loading ? (
                  <tr><td colSpan={4} className="p-8 text-center">Loading...</td></tr>
                ) : (
                  filteredServiceTypes.map((serviceType) => {
                    const currentPrice = prices[serviceType.id];
                    const hasOverride = currentPrice !== undefined;
                    
                    return (
                      <tr key={serviceType.id} className={hasOverride ? 'bg-blue-50/30' : ''}>
                        <td className="p-4 font-medium">{serviceType.name}</td>
                        <td className="p-4 text-xs text-gray-500">{serviceType.hsn_sac_code || '-'}</td>
                        <td className="p-4 text-right">
                          <div className="relative inline-block w-32">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500">₹</span>
                            <input 
                              type="number" 
                              className={`w-full pl-6 p-1.5 border rounded text-right font-medium focus:ring-2 focus:ring-brand-primary/20 outline-none ${hasOverride ? 'border-blue-300 text-blue-700' : 'border-gray-200'}`}
                              placeholder="0"
                              value={currentPrice ?? ''}
                              onChange={(e) => handlePriceChange(serviceType.id, e.target.value)}
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
