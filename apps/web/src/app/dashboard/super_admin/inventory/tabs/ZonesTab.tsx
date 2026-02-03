'use client';

import React, { useState, useEffect } from 'react';
import { Search, Plus, Map, Edit, Trash2, Loader2 } from 'lucide-react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { formatDateDMY } from "@/lib/utils";

export default function ZonesTab() {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({ name: '', description: '' });

  const supabase = getBrowserClient();

  useEffect(() => {
    fetchZones();
  }, []);

  const fetchZones = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('zones')
        .select('*')
        .order('name');
      
      if (error) throw error;
      setZones(data || []);
    } catch (err) {
      console.error('Error fetching zones:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const { error } = await supabase
        .from('zones')
        .insert([formData]);
      
      if (error) throw error;
      
      setShowModal(false);
      setFormData({ name: '', description: '' });
      fetchZones();
    } catch (err) {
      alert('Error creating zone');
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
            placeholder="Search zones..."
            className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 border rounded-lg text-xs sm:text-sm focus:ring-2 focus:ring-brand-primary/20 outline-none"
          />
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="btn btn-primary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
        >
          <Plus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
          <span className="hidden sm:inline">Add Zone</span>
          <span className="sm:hidden">Add</span>
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center p-8 sm:p-10 md:p-12">
          <Loader2 className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 animate-spin text-brand-primary" />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {zones.map((zone) => (
            <div key={zone.id} className="border rounded-lg sm:rounded-xl p-3 sm:p-4 hover:shadow-md transition-shadow bg-white">
              <div className="flex justify-between items-start mb-2 sm:mb-3">
                <div className="p-1.5 sm:p-2 bg-blue-50 rounded-lg">
                  <Map className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                </div>
                <div className="flex gap-2">
                  <button className="text-gray-400 hover:text-brand-primary">
                    <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
              </div>
              <h3 className="font-semibold text-sm sm:text-base text-gray-900 mb-1">{zone.name}</h3>
              <p className="text-xs sm:text-sm text-gray-500 mb-3 sm:mb-4 line-clamp-2">{zone.description || 'No description'}</p>
              
              <div className="flex justify-between items-center border-t pt-2 sm:pt-3">
                <span className={`text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 sm:py-1 rounded-full ${
                  zone.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                }`}>
                  {zone.is_active ? 'Active' : 'Inactive'}
                </span>
                <span className="text-[10px] sm:text-xs text-gray-400">
                  Added {formatDateDMY(zone.created_at)}
                </span>
              </div>
            </div>
          ))}
          
          {zones.length === 0 && (
            <div className="col-span-full py-8 sm:py-10 md:py-12 text-center text-gray-500 bg-gray-50 rounded-lg sm:rounded-xl border border-dashed">
              <Map className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 mx-auto text-gray-300 mb-2 sm:mb-3" />
              <p className="text-sm sm:text-base">No zones defined yet.</p>
              <button onClick={() => setShowModal(true)} className="text-brand-primary text-xs sm:text-sm font-medium mt-1.5 sm:mt-2 hover:underline">
                Add your first zone
              </button>
            </div>
          )}
        </div>
      )}

      {/* Add Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="bg-white rounded-lg sm:rounded-xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto p-4 sm:p-5 md:p-6">
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Add New Zone</h2>
            <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Zone Name</label>
                <input
                  required
                  value={formData.name}
                  onChange={e => setFormData({...formData, name: e.target.value})}
                  className="w-full border rounded-lg p-1.5 sm:p-2 text-xs sm:text-sm"
                  placeholder="e.g. North India Zone"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Description</label>
                <textarea
                  value={formData.description}
                  onChange={e => setFormData({...formData, description: e.target.value})}
                  className="w-full border rounded-lg p-1.5 sm:p-2 text-xs sm:text-sm h-24 resize-none"
                  placeholder="Regions covered..."
                />
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
                  Create Zone
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

