'use client';

import React, { useState, useEffect } from 'react';
import { Plus, MapPin, Loader2 } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export default function ZoneManagerPage() {
  const [zones, setZones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newZone, setNewZone] = useState({ name: '', description: '' });
  const [submitting, setSubmitting] = useState(false);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    fetchZones();
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

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Zone Management</h1>
          <p className="text-gray-500">Manage geographic pricing zones for workshops</p>
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
          {zones.map((zone) => (
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
            </div>
          ))}
        </div>
      )}

      {/* Add Modal */}
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
    </div>
  );
}

