'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Save, DollarSign, Package, Plus } from 'lucide-react';

interface ServiceType {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
}

interface ServiceAddon {
  id: string;
  name: string;
  description: string | null;
  price: number;
  is_active: boolean;
}

interface WorkshopPricing {
  service_type_id: string;
  custom_price: number | null;
  is_active: boolean;
}

interface AddonPricing {
  service_addon_id: string;
  custom_price: number | null;
  is_active: boolean;
}

export default function WorkshopRatesPage() {
  const router = useRouter();
  const params = useParams();
  const workshopId = params.id as string;
  const supabase = createClientComponentClient();

  const [workshop, setWorkshop] = useState<any>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [serviceAddons, setServiceAddons] = useState<ServiceAddon[]>([]);
  const [serviceTypePricing, setServiceTypePricing] = useState<Record<string, WorkshopPricing>>({});
  const [addonPricing, setAddonPricing] = useState<Record<string, AddonPricing>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (workshopId) {
      fetchData();
    }
  }, [workshopId]);

  const fetchData = async () => {
    try {
      setLoading(true);

      // Fetch workshop details
      const { data: workshopData, error: workshopError } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', workshopId)
        .single();

      if (workshopError) throw workshopError;
      setWorkshop(workshopData);

      // Fetch all service types
      const { data: typesData, error: typesError } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (typesError) throw typesError;
      setServiceTypes(typesData || []);

      // Fetch all service addons
      const { data: addonsData, error: addonsError } = await supabase
        .from('service_addons')
        .select('*')
        .eq('is_active', true)
        .order('name');

      if (addonsError) throw addonsError;
      setServiceAddons(addonsData || []);

      // Fetch existing workshop service type pricing
      const { data: pricingData, error: pricingError } = await supabase
        .from('workshop_service_pricing')
        .select('*')
        .eq('workshop_id', workshopId);

      if (pricingError) throw pricingError;
      
      const pricingMap: Record<string, WorkshopPricing> = {};
      (pricingData || []).forEach((p: any) => {
        pricingMap[p.service_type_id] = {
          service_type_id: p.service_type_id,
          custom_price: p.custom_price,
          is_active: p.is_active,
        };
      });
      setServiceTypePricing(pricingMap);

      // Fetch existing workshop addon pricing
      const { data: addonPricingData, error: addonPricingError } = await supabase
        .from('workshop_service_addons_pricing')
        .select('*')
        .eq('workshop_id', workshopId);

      if (addonPricingError) throw addonPricingError;
      
      const addonPricingMap: Record<string, AddonPricing> = {};
      (addonPricingData || []).forEach((p: any) => {
        addonPricingMap[p.service_addon_id] = {
          service_addon_id: p.service_addon_id,
          custom_price: p.custom_price,
          is_active: p.is_active,
        };
      });
      setAddonPricing(addonPricingMap);

    } catch (error) {
      console.error('Error fetching data:', error);
      alert('Failed to load data');
    } finally {
      setLoading(false);
    }
  };

  const handleServiceTypePriceChange = (serviceTypeId: string, value: string) => {
    const price = value === '' ? null : (parseFloat(value) || null);
    setServiceTypePricing((prev) => ({
      ...prev,
      [serviceTypeId]: {
        service_type_id: serviceTypeId,
        custom_price: price,
        is_active: prev[serviceTypeId]?.is_active ?? true,
      },
    }));
  };

  const handleAddonPriceChange = (addonId: string, value: string) => {
    const price = value === '' ? null : (parseFloat(value) || null);
    setAddonPricing((prev) => ({
      ...prev,
      [addonId]: {
        service_addon_id: addonId,
        custom_price: price,
        is_active: prev[addonId]?.is_active ?? true,
      },
    }));
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      // Save service type pricing (only if price is set)
      for (const [serviceTypeId, pricing] of Object.entries(serviceTypePricing)) {
        // If price is null or 0, delete the entry instead of saving
        if (pricing.custom_price === null || pricing.custom_price === 0) {
          const { error } = await supabase
            .from('workshop_service_pricing')
            .delete()
            .eq('workshop_id', workshopId)
            .eq('service_type_id', serviceTypeId);
          
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('workshop_service_pricing')
            .upsert({
              workshop_id: workshopId,
              service_type_id: serviceTypeId,
              custom_price: pricing.custom_price,
              is_active: pricing.is_active,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'workshop_id,service_type_id',
            });

          if (error) throw error;
        }
      }

      // Save addon pricing (only if price is set)
      for (const [addonId, pricing] of Object.entries(addonPricing)) {
        // If price is null or 0, delete the entry instead of saving
        if (pricing.custom_price === null || pricing.custom_price === 0) {
          const { error } = await supabase
            .from('workshop_service_addons_pricing')
            .delete()
            .eq('workshop_id', workshopId)
            .eq('service_addon_id', addonId);
          
          if (error) throw error;
        } else {
          const { error } = await supabase
            .from('workshop_service_addons_pricing')
            .upsert({
              workshop_id: workshopId,
              service_addon_id: addonId,
              custom_price: pricing.custom_price,
              is_active: pricing.is_active,
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'workshop_id,service_addon_id',
            });

          if (error) throw error;
        }
      }

      alert('Rates saved successfully!');
      fetchData();
    } catch (error) {
      console.error('Error saving rates:', error);
      alert('Failed to save rates');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading rates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.back()}
                className="p-2 hover:bg-gray-100 rounded-lg"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div>
                <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <DollarSign className="w-6 h-6" />
                  Manage Rates - {workshop?.name || 'Workshop'}
                </h1>
                <p className="text-sm text-gray-600 mt-1">
                  Set custom pricing for service types and addons
                </p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="w-4 h-4" />
              {saving ? 'Saving...' : 'Save All Changes'}
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Service Types Pricing */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Package className="w-5 h-5" />
              Service Types Pricing
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Set custom prices for each service type for this workshop
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {serviceTypes.map((serviceType) => {
                const pricing = serviceTypePricing[serviceType.id];
                const price = pricing?.custom_price ?? null;
                const displayValue = price === null ? '' : price.toString();
                
                return (
                  <div
                    key={serviceType.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <h3 className="font-medium text-gray-900">{serviceType.name}</h3>
                      {serviceType.description && (
                        <p className="text-sm text-gray-500 mt-1">{serviceType.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={displayValue}
                          onChange={(e) =>
                            handleServiceTypePriceChange(
                              serviceType.id,
                              e.target.value
                            )
                          }
                          className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter price"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {serviceTypes.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No service types found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Service Addons Pricing */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Plus className="w-5 h-5" />
              Service Addons Pricing
            </h2>
            <p className="text-sm text-gray-600 mt-1">
              Set custom prices for each service addon for this workshop
            </p>
          </div>
          <div className="p-6">
            <div className="space-y-4">
              {serviceAddons.map((addon) => {
                const pricing = addonPricing[addon.id];
                const defaultPrice = addon.price || 0;
                const customPrice = pricing?.custom_price ?? null;
                const displayValue = customPrice === null ? '' : customPrice.toString();
                
                return (
                  <div
                    key={addon.id}
                    className="flex items-center justify-between p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium text-gray-900">{addon.name}</h3>
                        <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded">
                          Default: ₹{defaultPrice.toFixed(2)}
                        </span>
                      </div>
                      {addon.description && (
                        <p className="text-sm text-gray-500 mt-1">{addon.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">₹</span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={displayValue}
                          onChange={(e) =>
                            handleAddonPriceChange(
                              addon.id,
                              e.target.value
                            )
                          }
                          className="w-32 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter price"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {serviceAddons.length === 0 && (
                <div className="text-center py-12 text-gray-500">
                  No service addons found
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

