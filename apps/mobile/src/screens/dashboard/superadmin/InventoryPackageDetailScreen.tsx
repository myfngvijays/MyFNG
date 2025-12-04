import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  FlatList,
  RefreshControl,
  BackHandler
} from 'react-native';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';

export default function InventoryPackageDetailScreen({ route, navigation }: any) {
  const { packageId } = route.params;

  const [pkg, setPkg] = useState<any>(null);
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Add Item State
  const [showAddItem, setShowAddItem] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemQty, setItemQty] = useState('1');
  const [itemSearchTerm, setItemSearchTerm] = useState('');

  useEffect(() => {
    fetchPackageDetails();
  }, []);

  useEffect(() => {
    if (showAddItem) {
      searchItems('');
    }
  }, [showAddItem]);

  // Android back button handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showAddItem) {
        setShowAddItem(false);
        return true;
      }
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [showAddItem, navigation]);

  const fetchPackageDetails = async () => {
    setLoading(true);
    try {
      // Fetch package/service type
      const { data: pkgData, error: pkgError } = await supabase
        .from('service_types')
        .select('*')
        .eq('id', packageId)
        .single();

      if (pkgError) throw pkgError;
      setPkg(pkgData);

      // Fetch package items
      const { data: itemsData, error: itemsError } = await supabase
        .from('service_package_items')
        .select(`
          *,
          product:master_products(id, name, type, default_price, unit)
        `)
        .eq('service_type_id', packageId)
        .order('created_at', { ascending: false });

      if (itemsError) throw itemsError;
      setItems(itemsData || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to load package details');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleUpdatePackage = async () => {
    if (!pkg || !pkg.name) {
      Alert.alert('Error', 'Package name is required');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('service_types')
        .update({
          name: pkg.name,
          description: pkg.description,
          hsn_sac_code: pkg.hsn_sac_code,
          default_tax_rate: parseFloat(pkg.default_tax_rate) || 18.00,
          is_active: pkg.is_active
        })
        .eq('id', packageId);

      if (error) throw error;
      Alert.alert('Success', 'Package updated successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to update package');
    } finally {
      setSaving(false);
    }
  };

  const searchItems = async (term: string) => {
    setSearchLoading(true);
    try {
      let query = supabase
        .from('master_products')
        .select('id, name, type, default_price, part_number, unit')
        .limit(20);

      if (term) {
        query = query.ilike('name', `%${term}%`);
      }

      const { data: products, error } = await query;
      if (error) throw error;
      setSearchResults(products || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to search products');
    } finally {
      setSearchLoading(false);
    }
  };

  const handleAddItem = async () => {
    if (!selectedItem) {
      Alert.alert('Error', 'Please select a product');
      return;
    }

    const quantity = parseInt(itemQty) || 1;
    if (quantity < 1) {
      Alert.alert('Error', 'Quantity must be at least 1');
      return;
    }

    try {
      const { error } = await supabase
        .from('service_package_items')
        .insert([{
          service_type_id: packageId,
          product_id: selectedItem.id,
          quantity: quantity
        }]);

      if (error) throw error;

      fetchPackageDetails();
      setShowAddItem(false);
      setSelectedItem(null);
      setItemQty('1');
      setItemSearchTerm('');
      Alert.alert('Success', 'Item added successfully');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add item');
    }
  };

  const handleRemoveItem = async (itemId: string) => {
    Alert.alert(
      'Remove Item',
      'Are you sure you want to remove this item?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('service_package_items')
                .delete()
                .eq('id', itemId);

              if (error) throw error;
              fetchPackageDetails();
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to remove item');
            }
          }
        }
      ]
    );
  };

  const renderItem = ({ item }: { item: any }) => (
    <View style={styles.itemCard}>
      <View style={styles.itemInfo}>
        <Text style={styles.itemName}>{item.product?.name || 'Unknown Product'}</Text>
        <Text style={styles.itemDetails}>
          {item.product?.type} • Qty: {item.quantity} {item.product?.unit || 'pc'}
        </Text>
        {item.product?.default_price && (
          <Text style={styles.itemPrice}>₹{item.product.default_price} each</Text>
        )}
      </View>
      <TouchableOpacity
        style={styles.removeButton}
        onPress={() => handleRemoveItem(item.id)}
      >
        <Text style={styles.removeButtonText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color={COLORS.primary} />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Package Details</Text>
        <View style={{ width: 60 }} />
      </View>

      <ScrollView style={styles.scrollView}>
        {/* Package Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Package Information</Text>

          <TextInput
            style={styles.input}
            placeholder="Package Name *"
            value={pkg?.name || ''}
            onChangeText={(text) => setPkg({ ...pkg, name: text })}
          />

          <TextInput
            style={[styles.input, styles.textArea]}
            placeholder="Description"
            value={pkg?.description || ''}
            onChangeText={(text) => setPkg({ ...pkg, description: text })}
            multiline
            numberOfLines={3}
          />

          <View style={styles.row}>
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="HSN/SAC Code"
              value={pkg?.hsn_sac_code || ''}
              onChangeText={(text) => setPkg({ ...pkg, hsn_sac_code: text })}
            />
            <TextInput
              style={[styles.input, styles.halfInput]}
              placeholder="Tax Rate (%)"
              value={pkg?.default_tax_rate?.toString() || ''}
              onChangeText={(text) => setPkg({ ...pkg, default_tax_rate: text })}
              keyboardType="numeric"
            />
          </View>

          <TouchableOpacity
            style={styles.saveButton}
            onPress={handleUpdatePackage}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <Text style={styles.saveButtonText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Package Items */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Package Items ({items.length})</Text>
            <TouchableOpacity
              style={styles.addItemButton}
              onPress={() => setShowAddItem(true)}
            >
              <Text style={styles.addItemButtonText}>+ Add Item</Text>
            </TouchableOpacity>
          </View>

          {items.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyText}>No items in this package</Text>
              <Text style={styles.emptySubtext}>Add products to create a service package</Text>
            </View>
          ) : (
            <FlatList
              data={items}
              renderItem={renderItem}
              keyExtractor={(item) => item.id}
              scrollEnabled={false}
              refreshControl={
                <RefreshControl refreshing={refreshing} onRefresh={fetchPackageDetails} />
              }
            />
          )}
        </View>
      </ScrollView>

      {/* Add Item Modal */}
      <Modal
        visible={showAddItem}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddItem(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add Item to Package</Text>

              <TextInput
                style={styles.input}
                placeholder="Search products..."
                value={itemSearchTerm}
                onChangeText={(text) => {
                  setItemSearchTerm(text);
                  searchItems(text);
                }}
              />

              {searchLoading ? (
                <View style={styles.center}>
                  <ActivityIndicator size="small" color={COLORS.primary} />
                </View>
              ) : (
                <FlatList
                  data={searchResults}
                  keyExtractor={(item) => item.id}
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={[
                        styles.searchResultItem,
                        selectedItem?.id === item.id && styles.searchResultItemSelected
                      ]}
                      onPress={() => setSelectedItem(item)}
                    >
                      <View>
                        <Text style={styles.searchResultName}>{item.name}</Text>
                        <Text style={styles.searchResultDetails}>
                          {item.type} • ₹{item.default_price} • {item.unit || 'pc'}
                        </Text>
                      </View>
                      {selectedItem?.id === item.id && (
                        <Text style={styles.checkmark}>✓</Text>
                      )}
                    </TouchableOpacity>
                  )}
                  scrollEnabled={false}
                />
              )}

              {selectedItem && (
                <>
                  <Text style={styles.label}>Quantity</Text>
                  <TextInput
                    style={styles.input}
                    placeholder="Quantity"
                    value={itemQty}
                    onChangeText={setItemQty}
                    keyboardType="numeric"
                  />
                </>
              )}

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => {
                    setShowAddItem(false);
                    setSelectedItem(null);
                    setItemQty('1');
                    setItemSearchTerm('');
                  }}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleAddItem}
                  disabled={!selectedItem}
                >
                  <Text style={styles.submitButtonText}>Add Item</Text>
                </TouchableOpacity>
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    fontSize: 16,
    color: COLORS.primary,
    fontWeight: '600',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#111827',
  },
  scrollView: {
    flex: 1,
  },
  section: {
    backgroundColor: '#FFF',
    margin: SPACING.md,
    padding: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.md,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
    marginBottom: SPACING.md,
  },
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: SPACING.sm,
    backgroundColor: '#F9FAFB',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  halfInput: {
    width: '48%',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: SPACING.sm,
  },
  saveButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  addItemButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  addItemButtonText: {
    color: '#FFF',
    fontWeight: '600',
    fontSize: 14,
  },
  itemCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  itemInfo: {
    flex: 1,
  },
  itemName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  itemDetails: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: 2,
  },
  itemPrice: {
    fontSize: 12,
    color: '#9CA3AF',
  },
  removeButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: '#FEE2E2',
    borderRadius: 6,
  },
  removeButtonText: {
    color: '#DC2626',
    fontWeight: '600',
    fontSize: 12,
  },
  emptyState: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
    marginBottom: 4,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#D1D5DB',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: SPACING.lg,
    width: '90%',
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: SPACING.md,
    color: '#111827',
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
    marginTop: SPACING.sm,
  },
  searchResultItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#F9FAFB',
    borderRadius: 8,
    marginBottom: SPACING.sm,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  searchResultItemSelected: {
    borderColor: COLORS.primary,
    backgroundColor: '#EFF6FF',
  },
  searchResultName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 4,
  },
  searchResultDetails: {
    fontSize: 14,
    color: '#6B7280',
  },
  checkmark: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: 'bold',
  },
  modalButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: SPACING.md,
  },
  modalButton: {
    flex: 1,
    padding: 12,
    borderRadius: 8,
    alignItems: 'center',
    marginHorizontal: 4,
  },
  cancelButton: {
    backgroundColor: '#F3F4F6',
  },
  cancelButtonText: {
    color: '#6B7280',
    fontWeight: '600',
  },
  submitButton: {
    backgroundColor: COLORS.primary,
  },
  submitButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  center: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
});

