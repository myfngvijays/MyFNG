import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';

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

export default function WorkshopRatesScreen({ route, navigation }: any) {
  const { workshopId, workshopName } = route.params || {};
  const [workshop, setWorkshop] = useState<any>(null);
  const [serviceTypes, setServiceTypes] = useState<ServiceType[]>([]);
  const [serviceAddons, setServiceAddons] = useState<ServiceAddon[]>([]);
  const [serviceTypePricing, setServiceTypePricing] = useState<Record<string, WorkshopPricing>>({});
  const [addonPricing, setAddonPricing] = useState<Record<string, AddonPricing>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

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
      Alert.alert('Error', 'Failed to load data');
    } finally {
      setLoading(false);
      setRefreshing(false);
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

      Alert.alert('Success', 'Rates saved successfully!');
      fetchData();
    } catch (error) {
      console.error('Error saving rates:', error);
      Alert.alert('Error', 'Failed to save rates');
    } finally {
      setSaving(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchData();
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading rates...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Manage Rates</Text>
        <TouchableOpacity onPress={onRefresh}>
          <Icon name="refresh" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {/* Workshop Info */}
        <View style={styles.workshopInfo}>
          <Text style={styles.workshopName}>{workshopName || workshop?.name || 'Workshop'}</Text>
          <Text style={styles.workshopSubtitle}>Set custom pricing for service types and addons</Text>
        </View>

        {/* Service Types Pricing */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="package-variant" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Service Types Pricing</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Set custom prices for each service type</Text>

          {serviceTypes.map((serviceType) => {
            const pricing = serviceTypePricing[serviceType.id];
            const price = pricing?.custom_price ?? null;
            const displayValue = price === null ? '' : price.toString();
            
            return (
              <View key={serviceType.id} style={styles.priceRow}>
                <View style={styles.priceRowLeft}>
                  <Text style={styles.priceRowName}>{serviceType.name}</Text>
                  {serviceType.description && (
                    <Text style={styles.priceRowDesc}>{serviceType.description}</Text>
                  )}
                </View>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={displayValue}
                    onChangeText={(value) => handleServiceTypePriceChange(serviceType.id, value)}
                    placeholder="Enter price"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            );
          })}
          {serviceTypes.length === 0 && (
            <Text style={styles.emptyText}>No service types found</Text>
          )}
        </View>

        {/* Service Addons Pricing */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Icon name="plus-circle" size={20} color={COLORS.primary} />
            <Text style={styles.sectionTitle}>Service Addons Pricing</Text>
          </View>
          <Text style={styles.sectionSubtitle}>Set custom prices for each service addon</Text>

          {serviceAddons.map((addon) => {
            const pricing = addonPricing[addon.id];
            const defaultPrice = addon.price || 0;
            const customPrice = pricing?.custom_price ?? null;
            const displayValue = customPrice === null ? '' : customPrice.toString();
            
            return (
              <View key={addon.id} style={styles.priceRow}>
                <View style={styles.priceRowLeft}>
                  <View style={styles.addonHeader}>
                    <Text style={styles.priceRowName}>{addon.name}</Text>
                    <View style={styles.defaultBadge}>
                      <Text style={styles.defaultBadgeText}>Default: ₹{defaultPrice.toFixed(2)}</Text>
                    </View>
                  </View>
                  {addon.description && (
                    <Text style={styles.priceRowDesc}>{addon.description}</Text>
                  )}
                </View>
                <View style={styles.priceInputContainer}>
                  <Text style={styles.currencySymbol}>₹</Text>
                  <TextInput
                    style={styles.priceInput}
                    value={displayValue}
                    onChangeText={(value) => handleAddonPriceChange(addon.id, value)}
                    placeholder="Enter price"
                    placeholderTextColor={COLORS.textSecondary}
                    keyboardType="numeric"
                  />
                </View>
              </View>
            );
          })}
          {serviceAddons.length === 0 && (
            <Text style={styles.emptyText}>No service addons found</Text>
          )}
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Save Button */}
      <View style={styles.saveButtonContainer}>
        <TouchableOpacity
          style={[styles.saveButton, saving && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Icon name="content-save" size={20} color="#fff" />
              <Text style={styles.saveButtonText}>Save All Changes</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: COLORS.background,
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
    fontSize: 16,
  },
  header: {
    backgroundColor: COLORS.primary,
    paddingTop: 50,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#fff',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: SPACING.md,
  },
  scrollView: {
    flex: 1,
  },
  workshopInfo: {
    backgroundColor: '#fff',
    padding: SPACING.lg,
    marginBottom: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  workshopName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  workshopSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  section: {
    backgroundColor: '#fff',
    marginBottom: SPACING.md,
    padding: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.text,
    marginLeft: SPACING.sm,
  },
  sectionSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: SPACING.md,
  },
  priceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  priceRowLeft: {
    flex: 1,
    marginRight: SPACING.md,
  },
  addonHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    marginBottom: SPACING.xs,
  },
  priceRowName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
    marginBottom: SPACING.xs,
  },
  priceRowDesc: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  defaultBadge: {
    backgroundColor: COLORS.border,
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
    marginLeft: SPACING.xs,
  },
  defaultBadgeText: {
    fontSize: 10,
    color: COLORS.textSecondary,
  },
  priceInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.sm,
    minWidth: 120,
  },
  currencySymbol: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginRight: SPACING.xs,
  },
  priceInput: {
    flex: 1,
    fontSize: 16,
    color: COLORS.text,
    paddingVertical: SPACING.sm,
    minWidth: 80,
  },
  emptyText: {
    textAlign: 'center',
    color: COLORS.textSecondary,
    paddingVertical: SPACING.lg,
  },
  saveButtonContainer: {
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.border,
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.md,
    borderRadius: 8,
    gap: SPACING.sm,
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

