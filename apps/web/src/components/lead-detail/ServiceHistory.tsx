'use client';

/**
 * Service History Section
 * Display past service records for this customer/vehicle
 * Task: WA-501
 */

import { useState, useEffect } from 'react';
import { History, Car, User, Star, Calendar } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ServiceHistoryProps {
  lead: any;
}

interface PastLead {
  id: string;
  lead_number: string;
  service_type: string;
  status: string;
  created_at: string;
  completed_at?: string;
  final_amount?: number;
  customer_rating?: number;
  customer_feedback?: string;
}

export default function ServiceHistory({ lead }: ServiceHistoryProps) {
  const [customerHistory, setCustomerHistory] = useState<PastLead[]>([]);
  const [vehicleHistory, setVehicleHistory] = useState<PastLead[]>([]);
  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'customer' | 'vehicle'>('vehicle');

  useEffect(() => {
    fetchHistory();
  }, [lead.id]);

  async function fetchHistory() {
    setLoading(true);
    const supabase = createClient();

    try {
      // Fetch past leads for this customer (excluding current lead)
      if (lead.customer_phone) {
        const { data: customerData } = await supabase
          .from('service_leads')
          .select('*')
          .eq('customer_phone', lead.customer_phone)
          .neq('id', lead.id)
          .order('created_at', { ascending: false })
          .limit(10);

        setCustomerHistory(customerData || []);
      }

      // Fetch past leads for this vehicle (excluding current lead)
      if (lead.vehicle_number) {
        const { data: vehicleData } = await supabase
          .from('service_leads')
          .select('*')
          .eq('vehicle_number', lead.vehicle_number)
          .neq('id', lead.id)
          .order('created_at', { ascending: false })
          .limit(10);

        setVehicleHistory(vehicleData || []);
      }
    } catch (error) {
      console.error('Error fetching service history:', error);
    } finally {
      setLoading(false);
    }
  }

  function renderHistoryCard(pastLead: PastLead) {
    return (
      <div key={pastLead.id} className="p-4 bg-gray-50 rounded-lg border border-gray-200 hover:shadow-md transition-shadow">
        <div className="flex justify-between items-start mb-2">
          <div>
            <h3 className="font-semibold text-gray-800">{pastLead.lead_number}</h3>
            <p className="text-sm text-gray-600">{pastLead.service_type}</p>
          </div>
          <span
            className={`px-2 py-1 text-xs font-semibold rounded-full ${
              pastLead.status === 'CLOSED' || pastLead.status === 'COMPLETED'
                ? 'bg-green-100 text-green-800'
                : pastLead.status === 'REJECTED' || pastLead.status === 'CANCELLED'
                ? 'bg-red-100 text-red-800'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {pastLead.status}
          </span>
        </div>

        <div className="space-y-1 text-sm text-gray-600">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            <span>
              {new Date(pastLead.created_at).toLocaleDateString()}
            </span>
          </div>

          {pastLead.completed_at && (
            <div className="text-xs text-gray-500">
              Completed: {new Date(pastLead.completed_at).toLocaleDateString()}
            </div>
          )}

          {pastLead.final_amount && (
            <div className="font-semibold text-gray-800">
              Amount: ₹{pastLead.final_amount.toFixed(2)}
            </div>
          )}

          {pastLead.customer_rating && (
            <div className="flex items-center gap-1">
              <Star className="w-4 h-4 fill-yellow-400 text-yellow-400" />
              <span className="font-medium">{pastLead.customer_rating}/5</span>
            </div>
          )}

          {pastLead.customer_feedback && (
            <div className="mt-2 p-2 bg-white rounded text-xs italic">
              "{pastLead.customer_feedback}"
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
        <History className="w-5 h-5 text-brand-primary" />
        Service History
      </h2>

      {/* Tabs */}
      <div className="flex gap-2 mb-4 border-b border-gray-200">
        <button
          onClick={() => setActiveTab('vehicle')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'vehicle'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <Car className="w-4 h-4" />
            Vehicle History ({vehicleHistory.length})
          </div>
        </button>
        <button
          onClick={() => setActiveTab('customer')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'customer'
              ? 'text-brand-primary border-b-2 border-brand-primary'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          <div className="flex items-center gap-2">
            <User className="w-4 h-4" />
            Customer History ({customerHistory.length})
          </div>
        </button>
      </div>

      {/* Content */}
      {loading ? (
        <div className="text-center py-8 text-gray-500">Loading history...</div>
      ) : activeTab === 'vehicle' ? (
        vehicleHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <Car className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No previous service records for this vehicle</p>
            <p className="text-sm mt-1">This appears to be the first service</p>
          </div>
        ) : (
          <div className="space-y-3">
            {vehicleHistory.map(renderHistoryCard)}
          </div>
        )
      ) : (
        customerHistory.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <User className="w-12 h-12 mx-auto mb-2 text-gray-400" />
            <p>No previous service records for this customer</p>
            <p className="text-sm mt-1">This is a new customer</p>
          </div>
        ) : (
          <div className="space-y-3">
            {customerHistory.map(renderHistoryCard)}
          </div>
        )
      )}

      {/* Summary Stats */}
      {activeTab === 'customer' && customerHistory.length > 0 && (
        <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
          <h3 className="font-semibold mb-3 text-blue-900">Customer Summary</h3>
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Total Services</p>
              <p className="text-xl font-bold text-blue-900">{customerHistory.length + 1}</p>
            </div>
            <div>
              <p className="text-gray-600">Completed</p>
              <p className="text-xl font-bold text-blue-900">
                {customerHistory.filter(l => l.status === 'CLOSED' || l.status === 'COMPLETED').length}
              </p>
            </div>
            <div>
              <p className="text-gray-600">Total Spent</p>
              <p className="text-xl font-bold text-blue-900">
                ₹{customerHistory.reduce((sum, l) => sum + (l.final_amount || 0), 0).toFixed(0)}
              </p>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'vehicle' && vehicleHistory.length > 0 && (
        <div className="mt-6 p-4 bg-green-50 rounded-lg border border-green-200">
          <h3 className="font-semibold mb-3 text-green-900">Vehicle Summary</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600">Total Services</p>
              <p className="text-xl font-bold text-green-900">{vehicleHistory.length + 1}</p>
            </div>
            <div>
              <p className="text-gray-600">Last Service</p>
              <p className="text-sm font-bold text-green-900">
                {new Date(vehicleHistory[0].created_at).toLocaleDateString()}
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

