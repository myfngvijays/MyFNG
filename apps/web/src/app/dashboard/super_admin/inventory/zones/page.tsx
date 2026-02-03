'use client';

import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Loader2, Building2, X, Check, Edit, Trash2 } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase/browserClient';

export default function ZoneManagerPage() {
  const [zones, setZones] = useState<any[]>([]);
  const [cities, setCities] = useState<any[]>([]);
  const [allCities, setAllCities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCityModal, setShowCityModal] = useState(false);
  const [selectedZone, setSelectedZone] = useState<any>(null);
  const [newZone, setNewZone] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  const [citySubmitting, setCitySubmitting] = useState(false);
  const [selectedCityIds, setSelectedCityIds] = useState<string[]>([]);
  
  const supabase = getBrowserClient();

  useEffect(() => {
    fetchZones();
    fetchAllCities();
  }, []);

  const fetchZones = async () => {
    try {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      setZones(data || []);
    } catch (error) {
      console.error('Error fetching zones:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchAllCities = async () => {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setAllCities(data || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const fetchCitiesByZone = async (zoneId: string) => {
    try {
      const { data, error } = await supabase
        .from('cities')
        .select('*')
        .eq('zone_id', zoneId)
        .eq('is_active', true)
        .order('name');
      
      if (error) throw error;
      setCities(data || []);
      setSelectedCityIds(data?.map(c => c.id) || []);
    } catch (error) {
      console.error('Error fetching cities for zone:', error);
    }
  };

  const handleAddZone = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('zones')
        .insert([newZone]);
      
      if (error) throw error;
      
      setShowAddModal(false);
      setNewZone({ name: '', description: '' });
      fetchZones();
      alert('Zone added successfully!');
    } catch (error: any) {
      alert('Error adding zone: ' + error.message);
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenCityModal = (zone: any) => {
    setSelectedZone(zone);
    setShowCityModal(true);
    fetchCitiesByZone(zone.id);
  };

  const handleToggleCity = (cityId: string) => {
    setSelectedCityIds(prev => {
      if (prev.includes(cityId)) {
        return prev.filter(id => id !== cityId);
      } else {
        return [...prev, cityId];
      }
    });
  };

  const handleSaveCityMapping = async () => {
    if (!selectedZone) return;
    
    setCitySubmitting(true);
    try {
      // First, remove all cities from this zone
      await supabase
        .from('cities')
        .update({ zone_id: null })
        .eq('zone_id', selectedZone.id);

      // Then, assign selected cities to this zone
      if (selectedCityIds.length > 0) {
        const { error } = await supabase
          .from('cities')
          .update({ zone_id: selectedZone.id })
          .in('id', selectedCityIds);

        if (error) throw error;
      }

      alert(`City mapping updated successfully! ${selectedCityIds.length} cities assigned to ${selectedZone.name}`);
      setShowCityModal(false);
      fetchZones();
      fetchAllCities();
    } catch (error: any) {
      alert('Error updating city mapping: ' + error.message);
    } finally {
      setCitySubmitting(false);
    }
  };

  const getCitiesCount = (zoneId: string) => {
    return allCities.filter(c => c.zone_id === zoneId).length;
  };

  const getCitiesForZone = (zoneId: string) => {
    return allCities.filter(c => c.zone_id === zoneId).slice(0, 3);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zone Management</h1>
          <p className="text-gray-500">Manage geographic pricing zones and map cities to zones</p>
        </div>
        <button 
          onClick={() => setShowAddModal(true)}
          className="btn btn-primary flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add New Zone
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {zones.map((zone) => {
            const citiesCount = getCitiesCount(zone.id);
            const zoneCities = getCitiesForZone(zone.id);
            
            return (
            <div key={zone.id} className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="p-3 bg-blue-50 rounded-lg">
                  <MapPin className="w-6 h-6 text-blue-600" />
                </div>
                <span className={`px-2 py-1 text-xs rounded-full ${zone.is_active ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`}>
                  {zone.is_active ? 'Active' : 'Inactive'}
                </span>
              </div>
              <h3 className="font-bold text-lg text-gray-900 mb-2">{zone.name}</h3>
              <p className="text-gray-500 text-sm mb-4">{zone.description || 'No description provided'}</p>
                
                {/* Cities Section */}
                <div className="border-t border-gray-100 pt-4 mt-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <Building2 className="w-4 h-4" />
                      <span className="font-medium">{citiesCount} Cities</span>
                    </div>
                    <button
                      onClick={() => handleOpenCityModal(zone)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Manage Cities
                    </button>
            </div>
                  
                  {citiesCount > 0 ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {zoneCities.map(city => (
                        <span 
                          key={city.id}
                          className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full"
                        >
                          {city.name}
                        </span>
                      ))}
                      {citiesCount > 3 && (
                        <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded-full">
                          +{citiesCount - 3} more
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No cities mapped</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add Zone Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full p-6">
            <h2 className="text-xl font-bold mb-4">Add New Zone</h2>
            <form onSubmit={handleAddZone} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Zone Name</label>
                <input
                  type="text"
                  required
                  value={newZone.name}
                  onChange={(e) => setNewZone({...newZone, name: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                  placeholder="e.g. North Zone"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={newZone.description}
                  onChange={(e) => setNewZone({...newZone, description: e.target.value})}
                  className="w-full p-2 border rounded-lg"
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              <div className="flex gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="flex-1 py-2 border rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50"
                >
                  {submitting ? 'Adding...' : 'Add Zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* City Mapping Modal */}
      {showCityModal && selectedZone && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold">Manage Cities for {selectedZone.name}</h2>
                  <p className="text-sm text-gray-500 mt-1">Select cities to assign to this zone</p>
                </div>
                <button
                  onClick={() => setShowCityModal(false)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6">
              {/* Search */}
              <div className="mb-4">
                <input
                  type="text"
                  placeholder="Search cities..."
                  className="w-full p-3 border rounded-lg"
                  onChange={(e) => {
                    const search = e.target.value.toLowerCase();
                    const filtered = allCities.filter(c => 
                      c.name.toLowerCase().includes(search)
                    );
                    // Update selected cities based on filtered results
                  }}
                />
              </div>

              {/* Cities List */}
              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {allCities.map((city) => {
                  const isSelected = selectedCityIds.includes(city.id);
                  const isInOtherZone = city.zone_id && city.zone_id !== selectedZone.id;
                  
                  return (
                    <div
                      key={city.id}
                      className={`p-3 border rounded-lg cursor-pointer transition-colors ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-300' 
                          : isInOtherZone
                          ? 'bg-yellow-50 border-yellow-200'
                          : 'bg-white border-gray-200 hover:bg-gray-50'
                      }`}
                      onClick={() => handleToggleCity(city.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center ${
                            isSelected ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                          }`}>
                            {isSelected && <Check className="w-3 h-3 text-white" />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{city.name}</p>
                            {city.state && (
                              <p className="text-xs text-gray-500">{city.state}</p>
                            )}
                            {isInOtherZone && (
                              <p className="text-xs text-yellow-600 mt-1">
                                Currently in another zone
                              </p>
                            )}
                          </div>
                        </div>
                        {isSelected && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">
                            Selected
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {allCities.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <Building2 className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                  <p>No cities found. Add cities first.</p>
                </div>
              )}
            </div>

            <div className="p-6 border-t border-gray-100 flex justify-between items-center">
              <div className="text-sm text-gray-600">
                <span className="font-medium">{selectedCityIds.length}</span> cities selected
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowCityModal(false)}
                  className="px-4 py-2 border rounded-lg hover:bg-gray-50"
                  disabled={citySubmitting}
                >
                  Cancel
                </button>
                <button
                  onClick={handleSaveCityMapping}
                  disabled={citySubmitting}
                  className="px-4 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 disabled:opacity-50 flex items-center gap-2"
                >
                  {citySubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      Saving...
                    </>
                  ) : (
                    <>
                      <Check className="w-4 h-4" />
                      Save Mapping
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
