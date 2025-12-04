import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  Alert,
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  BackHandler
} from 'react-native';
import CustomPicker from '../../../components/CustomPicker';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';

interface Product {
  id: string;
  name: string;
  type: string;
  category: string;
  hsn_sac_code: string;
  default_price: number;
  tax_rate: number;
  unit: string;
  manufacturer?: string;
  part_number?: string;
  is_active: boolean;
}

export default function InventoryProductsScreen({ navigation }: any) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterType, setFilterType] = useState('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newProduct, setNewProduct] = useState({
    name: '',
    type: 'PART',
    category: '',
    hsn_sac_code: '',
    default_price: '',
    tax_rate: '18.00',
    unit: 'pc',
    manufacturer: '',
    part_number: ''
  });

  useEffect(() => {
    fetchProducts();
  }, [filterType]);

  // Android back button handler
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showAddModal) {
        setShowAddModal(false);
        return true;
      }
      if (navigation?.goBack) {
        navigation.goBack();
        return true;
      }
      return false;
    });

    return () => backHandler.remove();
  }, [showAddModal, navigation]);

  const fetchProducts = async () => {
    try {
      let query = supabase
        .from('master_products')
        .select('*')
        .order('created_at', { ascending: false });

      if (filterType !== 'ALL') {
        query = query.eq('type', filterType);
      }

      const { data, error } = await query;
      if (error) throw error;
      setProducts(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch products');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.name || !newProduct.default_price) {
      Alert.alert('Error', 'Please fill Product Name and Default Price');
      return;
    }

    setSubmitting(true);
    try {
      const { error } = await supabase
        .from('master_products')
        .insert([{
          ...newProduct,
          default_price: parseFloat(newProduct.default_price) || 0,
          tax_rate: parseFloat(newProduct.tax_rate) || 18.00
        }]);

      if (error) throw error;

      setShowAddModal(false);
      setNewProduct({
        name: '', type: 'PART', category: '', hsn_sac_code: '',
        default_price: '', tax_rate: '18.00', unit: 'pc',
        manufacturer: '', part_number: ''
      });
      fetchProducts();
      Alert.alert('Success', 'Product added successfully!');
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to add product');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.hsn_sac_code?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderProduct = ({ item }: { item: Product }) => (
    <TouchableOpacity style={styles.productCard}>
      <View style={styles.productHeader}>
        <Text style={styles.productName}>{item.name}</Text>
        <View style={[styles.badge, item.type === 'PART' ? styles.badgePart : styles.badgeLabour]}>
          <Text style={styles.badgeText}>{item.type}</Text>
        </View>
      </View>
      <View style={styles.productDetails}>
        <Text style={styles.detailText}>Category: {item.category}</Text>
        <Text style={styles.detailText}>HSN/SAC: {item.hsn_sac_code || 'N/A'}</Text>
        <Text style={styles.detailText}>Price: ₹{item.default_price}</Text>
        <Text style={styles.detailText}>Tax: {item.tax_rate}%</Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        {navigation?.goBack && (
          <TouchableOpacity
            onPress={() => navigation.goBack()}
            style={styles.backButton}
          >
            <Text style={styles.backButtonText}>←</Text>
          </TouchableOpacity>
        )}
        <Text style={styles.title}>Product Master</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Filters */}
      <View style={styles.filters}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {['ALL', 'PART', 'LABOUR', 'CONSUMABLE'].map((type) => (
            <TouchableOpacity
              key={type}
              style={[
                styles.filterButton,
                filterType === type && styles.filterButtonActive
              ]}
              onPress={() => setFilterType(type)}
            >
              <Text
                style={[
                  styles.filterButtonText,
                  filterType === type && styles.filterButtonTextActive
                ]}
              >
                {type}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
      </View>

      {/* Search */}
      <TextInput
        style={styles.searchInput}
        placeholder="Search products..."
        value={searchTerm}
        onChangeText={setSearchTerm}
      />

      {/* Products List */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredProducts}
          renderItem={renderProduct}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchProducts} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No products found</Text>
            </View>
          }
        />
      )}

      {/* Add Product Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Add New Product</Text>

              <TextInput
                style={styles.input}
                placeholder="Product Name *"
                value={newProduct.name}
                onChangeText={(text) => setNewProduct({ ...newProduct, name: text })}
              />

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Type *</Text>
                <CustomPicker
                  selectedValue={newProduct.type}
                  onValueChange={(value) => setNewProduct({ ...newProduct, type: value as string })}
                  items={[
                    { label: 'Part', value: 'PART' },
                    { label: 'Labour', value: 'LABOUR' },
                    { label: 'Consumable', value: 'CONSUMABLE' }
                  ]}
                  placeholder="Select Type"
                />
              </View>

              <TextInput
                style={styles.input}
                placeholder="Category *"
                value={newProduct.category}
                onChangeText={(text) => setNewProduct({ ...newProduct, category: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Default Price (₹) *"
                value={newProduct.default_price}
                onChangeText={(text) => setNewProduct({ ...newProduct, default_price: text })}
                keyboardType="numeric"
              />

              <View style={styles.inputContainer}>
                <Text style={styles.inputLabel}>Tax Rate (%) *</Text>
                <CustomPicker
                  selectedValue={newProduct.tax_rate}
                  onValueChange={(value) => setNewProduct({ ...newProduct, tax_rate: value as string })}
                  items={[
                    { label: '0% (Nil)', value: '0' },
                    { label: '5%', value: '5' },
                    { label: '12%', value: '12' },
                    { label: '18%', value: '18' },
                    { label: '28%', value: '28' }
                  ]}
                  placeholder="Select Tax Rate"
                />
              </View>

              <TextInput
                style={styles.input}
                placeholder="HSN/SAC Code"
                value={newProduct.hsn_sac_code}
                onChangeText={(text) => setNewProduct({ ...newProduct, hsn_sac_code: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Unit (pc, ltr, set)"
                value={newProduct.unit}
                onChangeText={(text) => setNewProduct({ ...newProduct, unit: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Manufacturer"
                value={newProduct.manufacturer}
                onChangeText={(text) => setNewProduct({ ...newProduct, manufacturer: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Part Number"
                value={newProduct.part_number}
                onChangeText={(text) => setNewProduct({ ...newProduct, part_number: text })}
              />

              <View style={styles.modalButtons}>
                <TouchableOpacity
                  style={[styles.modalButton, styles.cancelButton]}
                  onPress={() => setShowAddModal(false)}
                >
                  <Text style={styles.cancelButtonText}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalButton, styles.submitButton]}
                  onPress={handleAddProduct}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Add Product</Text>
                  )}
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
  addButton: {
    backgroundColor: COLORS.primary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addButtonText: {
    color: '#FFF',
    fontWeight: '600',
  },
  filters: {
    paddingVertical: SPACING.sm,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  filterButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    marginHorizontal: 4,
    borderRadius: 20,
    backgroundColor: '#F3F4F6',
  },
  filterButtonActive: {
    backgroundColor: COLORS.primary,
  },
  filterButtonText: {
    color: '#6B7280',
    fontWeight: '500',
  },
  filterButtonTextActive: {
    color: '#FFF',
  },
  searchInput: {
    margin: SPACING.md,
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  productCard: {
    backgroundColor: '#FFF',
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  productHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  productName: {
    fontSize: 16,
    fontWeight: '600',
    color: '#111827',
    flex: 1,
  },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  badgePart: {
    backgroundColor: '#DBEAFE',
  },
  badgeLabour: {
    backgroundColor: '#D1FAE5',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  productDetails: {
    marginTop: SPACING.xs,
  },
  detailText: {
    fontSize: 14,
    color: '#6B7280',
    marginVertical: 2,
  },
  center: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
  },
  emptyText: {
    fontSize: 16,
    color: '#9CA3AF',
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
  input: {
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    marginBottom: SPACING.sm,
    backgroundColor: '#F9FAFB',
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
  inputContainer: {
    marginBottom: SPACING.sm,
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
});

