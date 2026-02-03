'use client';

import React, { useState, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
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
  const supabase = getBrowserClient();

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
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-blue-600 mx-auto mb-3 sm:mb-4"></div>
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">Loading rates...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-2 sm:gap-3 md:gap-4 min-w-0 flex-1">
              <button
                onClick={() => router.back()}
                className="p-1.5 sm:p-2 hover:bg-gray-100 rounded-lg flex-shrink-0"
              >
                <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5" />
              </button>
              <div className="min-w-0 flex-1">
                <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                  <DollarSign className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                  <span className="truncate">Manage Rates - {workshop?.name || 'Workshop'}</span>
                </h1>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                  Set custom pricing for service types and addons
                </p>
              </div>
            </div>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 sm:gap-2 disabled:opacity-50 text-xs sm:text-sm w-full sm:w-auto justify-center"
            >
              <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save All Changes'}</span>
              <span className="sm:hidden">{saving ? 'Saving...' : 'Save'}</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Service Types Pricing */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 sm:px-5 md:px-6 py-3 sm:py-4 border-b">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-1.5 sm:gap-2">
              <Package className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span>Service Types Pricing</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
              Set custom prices for each service type for this workshop
            </p>
          </div>
          <div className="p-4 sm:p-5 md:p-6">
            <div className="space-y-3 sm:space-y-4">
              {serviceTypes.map((serviceType) => {
                const pricing = serviceTypePricing[serviceType.id];
                const price = pricing?.custom_price ?? null;
                const displayValue = price === null ? '' : price.toString();
                
                return (
                  <div
                    key={serviceType.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 p-3 sm:p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <h3 className="font-medium text-sm sm:text-base text-gray-900">{serviceType.name}</h3>
                      {serviceType.description && (
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">{serviceType.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none">
                        <span className="text-xs sm:text-sm text-gray-600">₹</span>
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
                          className="w-full sm:w-28 md:w-32 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter price"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {serviceTypes.length === 0 && (
                <div className="text-center py-8 sm:py-10 md:py-12 text-gray-500 text-sm sm:text-base">
                  No service types found
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Service Addons Pricing */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-4 sm:px-5 md:px-6 py-3 sm:py-4 border-b">
            <h2 className="text-lg sm:text-xl font-semibold text-gray-900 flex items-center gap-1.5 sm:gap-2">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0" />
              <span>Service Addons Pricing</span>
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
              Set custom prices for each service addon for this workshop
            </p>
          </div>
          <div className="p-4 sm:p-5 md:p-6">
            <div className="space-y-3 sm:space-y-4">
              {serviceAddons.map((addon) => {
                const pricing = addonPricing[addon.id];
                const defaultPrice = addon.price || 0;
                const customPrice = pricing?.custom_price ?? null;
                const displayValue = customPrice === null ? '' : customPrice.toString();
                
                return (
                  <div
                    key={addon.id}
                    className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0 p-3 sm:p-4 border rounded-lg hover:bg-gray-50"
                  >
                    <div className="flex-1 min-w-0 w-full sm:w-auto">
                      <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 mb-1 sm:mb-0">
                        <h3 className="font-medium text-sm sm:text-base text-gray-900">{addon.name}</h3>
                        <span className="text-[10px] sm:text-xs text-gray-500 bg-gray-100 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded">
                          Default: ₹{defaultPrice.toFixed(2)}
                        </span>
                      </div>
                      {addon.description && (
                        <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">{addon.description}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto">
                      <div className="flex items-center gap-1.5 sm:gap-2 flex-1 sm:flex-none">
                        <span className="text-xs sm:text-sm text-gray-600">₹</span>
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
                          className="w-full sm:w-28 md:w-32 px-2 sm:px-3 py-1.5 sm:py-2 text-xs sm:text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          placeholder="Enter price"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              {serviceAddons.length === 0 && (
                <div className="text-center py-8 sm:py-10 md:py-12 text-gray-500 text-sm sm:text-base">
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

