'use client';

import { useState, useEffect } from 'react';
import { X, Save, Loader2, AlertCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface ServiceType {
  id: string;
  name: string;
  description?: string;
}

interface ServiceAddon {
  id: string;
  name: string;
  price?: number;
  description?: string;
}

interface Props {
  leadId: string;
  currentServiceTypeIds: string[];
  currentSubserviceIds: string[];
  onClose: () => void;
  onUpdate: () => void;
}

export default function ServicePackageChangeModal({
  leadId,
  currentServiceTypeIds,
  currentSubserviceIds,
  onClose,
  onUpdate,
}: Props) {
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [serviceAddons, setServiceAddons] = useState<ServiceAddon[]>([]);
  const [selectedServiceTypes, setSelectedServiceTypes] = useState<string[]>(currentServiceTypeIds || []);
  const [selectedAddons, setSelectedAddons] = useState<string[]>(currentSubserviceIds || []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchServiceData();
  }, []);

  async function fetchServiceData() {
    try {
      setLoading(true);
      const supabase = createClient();

      // Fetch all service types
      const { data: serviceTypesData, error: stError } = await supabase
        .from('service_types')
        .select('id, name, description')
        .order('name');

      if (stError) throw stError;

      // Fetch all service addons
      const { data: addonsData, error: addonsError } = await supabase
        .from('service_addons')
        .select('id, name, price, description')
        .order('name');

      if (addonsError) throw addonsError;

      setServiceTypes(serviceTypesData || []);
      setServiceAddons(addonsData || []);
    } catch (error: any) {
      console.error('Error fetching service data:', error);
      toast.error('Failed to load service options');
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    if (selectedServiceTypes.length === 0) {
      toast.error('Please select at least one service type');
      return;
    }

    try {
      setSaving(true);
      const supabase = createClient();

      // Update service types and addons
      const { error } = await supabase
        .from('service_leads')
        .update({
          service_type_ids: JSON.stringify(selectedServiceTypes),
          subservice_ids: JSON.stringify(selectedAddons),
          updated_at: new Date().toISOString(),
        })
        .eq('id', leadId);

      if (error) throw error;

      // Log the change
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: userProfile } = await supabase
          .from('users_login')
          .select('id')
          .eq('id', user.id)
          .single();

        await supabase.from('lead_events').insert({
          lead_id: leadId,
          event_type: 'SERVICE_PACKAGE_CHANGED',
          event_description: `Service package changed by advisor`,
          event_data: {
            old_service_types: currentServiceTypeIds,
            new_service_types: selectedServiceTypes,
            old_addons: currentSubserviceIds,
            new_addons: selectedAddons,
          },
          created_by: userProfile?.id,
        });
      }

      toast.success('Service package updated successfully!');
      onUpdate();
      onClose();
    } catch (error: any) {
      console.error('Error updating service package:', error);
      toast.error(error.message || 'Failed to update service package');
    } finally {
      setSaving(false);
    }
  }

  function toggleServiceType(serviceTypeId: string) {
    setSelectedServiceTypes((prev) =>
      prev.includes(serviceTypeId)
        ? prev.filter((id) => id !== serviceTypeId)
        : [...prev, serviceTypeId]
    );
  }

  function toggleAddon(addonId: string) {
    setSelectedAddons((prev) =>
      prev.includes(addonId)
        ? prev.filter((id) => id !== addonId)
        : [...prev, addonId]
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-gray-200 p-6 flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Change Service Package</h2>
            <p className="text-sm text-gray-600 mt-1">
              Update service types and addons before mechanic starts work
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-brand-primary" />
            </div>
          ) : (
            <>
              {/* Service Types */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900">
                  Service Types <span className="text-red-500">*</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {serviceTypes.map((serviceType) => (
                    <label
                      key={serviceType.id}
                      className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition ${
                        selectedServiceTypes.includes(serviceType.id)
                          ? 'border-brand-primary bg-brand-primary/5'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedServiceTypes.includes(serviceType.id)}
                        onChange={() => toggleServiceType(serviceType.id)}
                        className="mt-1 w-5 h-5 text-brand-primary border-gray-300 rounded focus:ring-brand-primary"
                      />
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{serviceType.name}</p>
                        {serviceType.description && (
                          <p className="text-sm text-gray-600 mt-1">{serviceType.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Service Addons */}
              <div>
                <h3 className="text-lg font-semibold mb-3 text-gray-900">
                  Service Addons (Optional)
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {serviceAddons.map((addon) => (
                    <label
                      key={addon.id}
                      className={`flex items-start gap-3 p-4 border-2 rounded-lg cursor-pointer transition ${
                        selectedAddons.includes(addon.id)
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedAddons.includes(addon.id)}
                        onChange={() => toggleAddon(addon.id)}
                        className="mt-1 w-5 h-5 text-green-600 border-gray-300 rounded focus:ring-green-500"
                      />
                      <div className="flex-1">
                        <div className="flex items-center justify-between">
                          <p className="font-medium text-gray-900">{addon.name}</p>
                          {addon.price && (
                            <span className="text-sm font-semibold text-green-600">
                              ₹{addon.price.toLocaleString()}
                            </span>
                          )}
                        </div>
                        {addon.description && (
                          <p className="text-sm text-gray-600 mt-1">{addon.description}</p>
                        )}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Warning */}
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
                <div>
                  <p className="text-sm font-medium text-yellow-800">
                    Important: This change will update the service package for this job.
                  </p>
                  <p className="text-xs text-yellow-700 mt-1">
                    Make sure to inform the customer about the changes before proceeding.
                  </p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-white border-t border-gray-200 p-6 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
            disabled={saving}
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || selectedServiceTypes.length === 0}
            className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primary/90 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4" />
                Save Changes
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

