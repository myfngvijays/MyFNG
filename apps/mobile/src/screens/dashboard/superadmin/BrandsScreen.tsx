import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { supabase } from '../../../lib/supabase';
import DashboardHeader from '../../../components/DashboardHeader';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function BrandsScreen() {
  const navigation = useNavigation();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [brands, setBrands] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddForm, setShowAddForm] = useState(false);
  const [newBrandName, setNewBrandName] = useState('');

  useEffect(() => {
    fetchBrands();
  }, []);

  const fetchBrands = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('brands')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setBrands(data || []);
    } catch (error) {
      console.error('Error fetching brands:', error);
      Alert.alert('Error', 'Failed to fetch brands');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchBrands();
  };

  const handleAddBrand = async () => {
    if (!newBrandName.trim()) {
      Alert.alert('Error', 'Please enter a brand name');
      return;
    }

    try {
      const { error } = await supabase
        .from('brands')
        .insert([{ name: newBrandName.trim() }]);

      if (error) throw error;

      Alert.alert('Success', 'Brand added successfully');
      setNewBrandName('');
      setShowAddForm(false);
      fetchBrands();
    } catch (error: any) {
      console.error('Error adding brand:', error);
      Alert.alert('Error', error.message || 'Failed to add brand');
    }
  };

  const filteredBrands = brands.filter((brand) =>
    brand.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading brands...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <DashboardHeader title="Brands" onBack={() => navigation.goBack()} />
      
      {/* Search and Add */}
      <View style={styles.headerActions}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search brands..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.textSecondary}
        />
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddForm(!showAddForm)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Add Brand Form */}
      {showAddForm && (
        <View style={styles.addForm}>
          <TextInput
            style={styles.formInput}
            placeholder="Brand Name"
            value={newBrandName}
            onChangeText={setNewBrandName}
            placeholderTextColor={COLORS.textSecondary}
          />
          <View style={styles.formActions}>
            <TouchableOpacity
              style={[styles.formButton, styles.cancelButton]}
              onPress={() => {
                setShowAddForm(false);
                setNewBrandName('');
              }}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.formButton, styles.submitButton]}
              onPress={handleAddBrand}
            >
              <Text style={styles.submitButtonText}>Add Brand</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      <ScrollView
        style={styles.scrollView}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      >
        {filteredBrands.length === 0 ? (
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>No brands found</Text>
          </View>
        ) : (
          filteredBrands.map((brand, index) => (
            <View key={brand.id || index} style={styles.brandCard}>
              <View style={styles.brandInfo}>
                <Text style={styles.brandName}>{brand.name}</Text>
                {brand.logo_url && (
                  <Text style={styles.brandLogo}>Logo: {brand.logo_url}</Text>
                )}
              </View>
              <View style={styles.brandBadge}>
                <Text style={styles.brandBadgeText}>Active</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
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
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  headerActions: {
    flexDirection: 'row',
    padding: SPACING.md,
    backgroundColor: COLORS.white,
    gap: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  searchInput: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    fontSize: SIZES.sm,
    color: COLORS.text,
    backgroundColor: COLORS.white,
  },
  addButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: COLORS.primary,
    borderRadius: 8,
    justifyContent: 'center',
  },
  addButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  addForm: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  formInput: {
    height: 40,
    borderWidth: 1,
    borderColor: COLORS.border,
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    fontSize: SIZES.sm,
    color: COLORS.text,
    marginBottom: SPACING.sm,
  },
  formActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  formButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.gray[200],
  },
  submitButton: {
    backgroundColor: COLORS.primary,
  },
  cancelButtonText: {
    color: COLORS.text,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  submitButtonText: {
    color: COLORS.white,
    fontSize: SIZES.sm,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  emptyContainer: {
    padding: SPACING.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: SIZES.md,
    color: COLORS.textSecondary,
  },
  brandCard: {
    backgroundColor: COLORS.white,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    marginHorizontal: SPACING.md,
    borderRadius: 8,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  brandInfo: {
    flex: 1,
  },
  brandName: {
    fontSize: SIZES.md,
    fontWeight: '600',
    color: COLORS.textHeading,
    marginBottom: SPACING.xs,
  },
  brandLogo: {
    fontSize: SIZES.xs,
    color: COLORS.textSecondary,
  },
  brandBadge: {
    backgroundColor: COLORS.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  brandBadgeText: {
    color: COLORS.white,
    fontSize: SIZES.xs,
    fontWeight: '600',
  },
});
