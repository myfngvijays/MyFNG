import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  BackHandler
} from 'react-native';
import CustomPicker from '../../../components/CustomPicker';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';

export default function InventoryServicePricingScreen({ navigation }: any) {
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [filteredWorkshops, setFilteredWorkshops] = useState<any[]>([]);
  const [selectedWorkshop, setSelectedWorkshop] = useState<string>('');
  const [zones, setZones] = useState<any[]>([]);
  const [selectedZone, setSelectedZone] = useState<string>('');
  const [selectedClass, setSelectedClass] = useState<string>('DEFAULT');
  const [serviceTypes, setServiceTypes] = useState<any[]>([]);
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  const availableClasses = ['DEFAULT', 'Hatchback', 'Sedan', 'SUV', 'Luxury', 'MUV'];

  useEffect(() => {
    fetchWorkshops();
    fetchZones();
  }, []);

  // Android back button handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [navigation]);

  useEffect(() => {
    if (selectedZone) {
      const filtered = workshops.filter(w => w.zone_id === selectedZone);
      setFilteredWorkshops(filtered);
      setSelectedWorkshop('');
      setServiceTypes([]);
      setPrices({});
    } else {
      setFilteredWorkshops([]);
      setSelectedWorkshop('');
      setServiceTypes([]);
      setPrices({});
    }
  }, [selectedZone, workshops]);

  useEffect(() => {
    if (selectedClass) {
      setSelectedWorkshop('');
      setServiceTypes([]);
      setPrices({});
    }
  }, [selectedClass]);

  useEffect(() => {
    if (selectedWorkshop && selectedWorkshop !== 'ALL' && selectedZone && selectedClass) {
      fetchPricingData(selectedWorkshop, selectedClass, selectedZone);
    } else if (selectedWorkshop === 'ALL' && selectedZone && selectedClass) {
      fetchServiceTypesForBulkMode();
    } else {
      setServiceTypes([]);
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

  const fetchServiceTypesForBulkMode = async () => {
    setLoading(true);
    try {
      const { data: allServiceTypes } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name');
      setServiceTypes(allServiceTypes || []);
      setPrices({});
    } catch (error) {
      console.error('Error fetching service types:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchPricingData = async (workshopId: string, vehicleClass: string, zoneId: string) => {
    setLoading(true);
    try {
      const { data: allServiceTypes } = await supabase
        .from('service_types')
        .select('*')
        .eq('is_active', true)
        .order('name');

      let query = supabase
        .from('workshop_service_pricing')
        .select('service_type_id, custom_price')
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

      const priceMap: Record<string, string> = {};
      existingPrices?.forEach((p: any) => {
        priceMap[p.service_type_id] = p.custom_price.toString();
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
      [serviceTypeId]: price
    }));
  };

  const handleSave = async () => {
    if (!selectedWorkshop || selectedWorkshop === 'ALL') {
      Alert.alert('Error', 'Please select a workshop');
      return;
    }

    setSaving(true);
    try {
      const upsertData = Object.entries(prices)
        .filter(([_, price]) => price && parseFloat(price) > 0)
        .map(([serviceTypeId, price]) => ({
          workshop_id: selectedWorkshop,
          service_type_id: serviceTypeId,
          custom_price: parseFloat(price),
          class: selectedClass === 'DEFAULT' ? null : selectedClass,
          zone_id: selectedZone || null
        }));

      if (upsertData.length === 0) {
        Alert.alert('Info', 'No prices to save');
        setSaving(false);
        return;
      }

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

      if (selectedZone) {
        delQuery = delQuery.eq('zone_id', selectedZone);
      } else {
        delQuery = delQuery.is('zone_id', null);
      }

      await delQuery;
      const { error: insertError } = await supabase.from('workshop_service_pricing').insert(upsertData);
      if (insertError) throw insertError;

      Alert.alert('Success', 'Pricing updated successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update pricing');
    } finally {
      setSaving(false);
    }
  };

  const handleBulkSave = async () => {
    if (selectedWorkshop !== 'ALL' || !selectedZone || !selectedClass) {
      Alert.alert('Error', 'Please select zone, class and "All Workshops" for bulk update');
      return;
    }

    setSaving(true);
    try {
      const zoneWorkshops = workshops.filter(w => w.zone_id === selectedZone);
      const upsertData: any[] = [];

      zoneWorkshops.forEach(workshop => {
        Object.entries(prices)
          .filter(([_, price]) => price && parseFloat(price) > 0)
          .forEach(([serviceTypeId, price]) => {
            upsertData.push({
              workshop_id: workshop.id,
              service_type_id: serviceTypeId,
              custom_price: parseFloat(price),
              class: selectedClass === 'DEFAULT' ? null : selectedClass,
              zone_id: selectedZone
            });
          });
      });

      if (upsertData.length === 0) {
        Alert.alert('Info', 'No prices to save');
        setSaving(false);
        return;
      }

      const serviceTypeIds = [...new Set(upsertData.map(d => d.service_type_id))];
      for (const workshop of zoneWorkshops) {
        let delQuery = supabase.from('workshop_service_pricing')
          .delete()
          .eq('workshop_id', workshop.id)
          .in('service_type_id', serviceTypeIds);

        if (selectedClass === 'DEFAULT') {
          delQuery = delQuery.is('class', null);
        } else {
          delQuery = delQuery.eq('class', selectedClass);
        }
        delQuery = delQuery.eq('zone_id', selectedZone);
        await delQuery;
      }

      const { error: insertError } = await supabase.from('workshop_service_pricing').insert(upsertData);
      if (insertError) throw insertError;

      Alert.alert('Success', `Pricing updated for ${zoneWorkshops.length} workshops!`);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update pricing');
    } finally {
      setSaving(false);
    }
  };

  const filteredServices = serviceTypes.filter(s =>
    s.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderService = ({ item }: { item: any }) => (
    <View style={styles.serviceRow}>
      <View style={styles.serviceInfo}>
        <Text style={styles.serviceName}>{item.name}</Text>
        {item.description && (
          <Text style={styles.serviceDescription} numberOfLines={2}>
            {item.description}
          </Text>
        )}
      </View>
      <TextInput
        style={styles.priceInput}
        placeholder="Price"
        value={prices[item.id] || ''}
        onChangeText={(text) => handlePriceChange(item.id, text)}
        keyboardType="numeric"
      />
    </View>
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        {navigation?.goBack && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Service Pricing</Text>
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Zone Selection */}
        <View style={styles.section}>
          <Text style={styles.label}>Select Zone *</Text>
          <CustomPicker
            selectedValue={selectedZone}
            onValueChange={(value) => {
              setSelectedZone(value as string);
              setSelectedWorkshop('');
              setSelectedClass('DEFAULT');
            }}
            items={[
              { label: 'Select Zone', value: '' },
              ...zones.map(zone => ({ label: zone.name, value: zone.id }))
            ]}
            placeholder="Select Zone"
          />
        </View>

        {/* Car Class Selection */}
        {selectedZone && (
          <View style={styles.section}>
            <Text style={styles.label}>Car Class *</Text>
            <CustomPicker
              selectedValue={selectedClass}
              onValueChange={(value) => setSelectedClass(value as string)}
              items={availableClasses.map(cls => ({ label: cls, value: cls }))}
              placeholder="Select Car Class"
            />
          </View>
        )}

        {/* Workshop Selection */}
        {selectedZone && selectedClass && (
          <View style={styles.section}>
            <Text style={styles.label}>Workshop</Text>
            <CustomPicker
              selectedValue={selectedWorkshop}
              onValueChange={(value) => setSelectedWorkshop(value as string)}
              items={[
                { label: 'Select Workshop', value: '' },
                { label: 'All Workshops in Zone', value: 'ALL' },
                ...filteredWorkshops.map(ws => ({ label: ws.name, value: ws.id }))
              ]}
              placeholder="Select Workshop"
            />
          </View>
        )}

        {/* Services List */}
        {selectedWorkshop && selectedZone && selectedClass && (
          <>
            <TextInput
              style={styles.searchInput}
              placeholder="Search services..."
              value={searchTerm}
              onChangeText={setSearchTerm}
            />

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator size="large" color={COLORS.primary} />
              </View>
            ) : (
              <>
                <FlatList
                  data={filteredServices}
                  renderItem={renderService}
                  keyExtractor={(item) => item.id}
                  scrollEnabled={false}
                  ListEmptyComponent={
                    <View style={styles.center}>
                      <Text style={styles.emptyText}>No services found</Text>
                    </View>
                  }
                />

                <TouchableOpacity
                  style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                  onPress={selectedWorkshop === 'ALL' ? handleBulkSave : handleSave}
                  disabled={saving}
                >
                  {saving ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.saveButtonText}>
                      {selectedWorkshop === 'ALL' ? 'Save to All Workshops' : 'Save Pricing'}
                    </Text>
                  )}
                </TouchableOpacity>
              </>
            )}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    padding: 8,
    marginRight: 8,
  },
  backButtonText: {
    fontSize: 24,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    padding: SPACING.md,
    backgroundColor: '#FFF',
    marginBottom: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: SPACING.xs,
  },
  searchInput: {
    margin: SPACING.md,
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  serviceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  serviceInfo: {
    flex: 1,
    marginRight: SPACING.sm,
  },
  serviceName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  serviceDescription: {
    fontSize: 12,
    color: '#6B7280',
  },
  priceInput: {
    width: 100,
    padding: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 6,
    backgroundColor: '#F9FAFB',
    textAlign: 'right',
  },
  saveButton: {
    margin: SPACING.md,
    padding: SPACING.md,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    alignItems: 'center',
  },
  saveButtonDisabled: {
    opacity: 0.6,
  },
  saveButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
  center: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
  },
});

