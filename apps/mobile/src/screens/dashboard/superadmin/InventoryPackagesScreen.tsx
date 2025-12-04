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
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';

interface Package {
  id: string;
  name: string;
  description?: string;
  hsn_sac_code?: string;
  default_tax_rate: number;
  is_active: boolean;
}

export default function InventoryPackagesScreen({ navigation }: any) {
  const [packages, setPackages] = useState<Package[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [newPackage, setNewPackage] = useState({
    name: '',
    description: '',
    hsn_sac_code: '',
    default_tax_rate: '18.00',
    is_active: true
  });

  useEffect(() => {
    fetchPackages();
  }, []);

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

  const fetchPackages = async () => {
    try {
      const { data, error } = await supabase
        .from('service_types')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setPackages(data || []);
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to fetch packages');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleCreatePackage = async () => {
    if (!newPackage.name) {
      Alert.alert('Error', 'Please enter package name');
      return;
    }

    setSubmitting(true);
    try {
      const { data, error } = await supabase
        .from('service_types')
        .insert([{
          ...newPackage,
          default_tax_rate: parseFloat(newPackage.default_tax_rate) || 18.00
        }])
        .select()
        .single();

      if (error) throw error;

      setShowAddModal(false);
      setNewPackage({
        name: '', description: '', hsn_sac_code: '',
        default_tax_rate: '18.00', is_active: true
      });
      fetchPackages();
      
      // Navigate to package detail screen
      if (navigation && navigation.navigate && data) {
        navigation.navigate('inventory-package-detail', { packageId: data.id });
      } else {
        Alert.alert('Success', 'Package created successfully!');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create package');
    } finally {
      setSubmitting(false);
    }
  };

  const filteredPackages = packages.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const renderPackage = ({ item }: { item: Package }) => (
    <TouchableOpacity
      style={styles.packageCard}
      onPress={() => {
        // Navigate to package detail to add items
        if (navigation && navigation.navigate) {
          navigation.navigate('inventory-package-detail', { packageId: item.id });
        }
      }}
    >
      <View style={styles.packageHeader}>
        <Text style={styles.packageName}>{item.name}</Text>
        <View style={[styles.badge, item.is_active ? styles.badgeActive : styles.badgeInactive]}>
          <Text style={styles.badgeText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>
      {item.description && (
        <Text style={styles.packageDescription}>{item.description}</Text>
      )}
      <View style={styles.packageDetails}>
        <Text style={styles.detailText}>HSN/SAC: {item.hsn_sac_code || 'N/A'}</Text>
        <Text style={styles.detailText}>Tax Rate: {item.default_tax_rate}%</Text>
      </View>
    </TouchableOpacity>
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
        <Text style={styles.title}>Service Packages</Text>
        <TouchableOpacity
          style={styles.addButton}
          onPress={() => setShowAddModal(true)}
        >
          <Text style={styles.addButtonText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      <TextInput
        style={styles.searchInput}
        placeholder="Search packages..."
        value={searchTerm}
        onChangeText={setSearchTerm}
      />

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredPackages}
          renderItem={renderPackage}
          keyExtractor={(item) => item.id}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={fetchPackages} />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Text style={styles.emptyText}>No packages found</Text>
            </View>
          }
        />
      )}

      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <ScrollView>
              <Text style={styles.modalTitle}>Create New Package</Text>

              <TextInput
                style={styles.input}
                placeholder="Package Name *"
                value={newPackage.name}
                onChangeText={(text) => setNewPackage({ ...newPackage, name: text })}
              />

              <TextInput
                style={[styles.input, styles.textArea]}
                placeholder="Description"
                value={newPackage.description}
                onChangeText={(text) => setNewPackage({ ...newPackage, description: text })}
                multiline
                numberOfLines={3}
              />

              <TextInput
                style={styles.input}
                placeholder="HSN/SAC Code"
                value={newPackage.hsn_sac_code}
                onChangeText={(text) => setNewPackage({ ...newPackage, hsn_sac_code: text })}
              />

              <TextInput
                style={styles.input}
                placeholder="Tax Rate (%)"
                value={newPackage.default_tax_rate}
                onChangeText={(text) => setNewPackage({ ...newPackage, default_tax_rate: text })}
                keyboardType="numeric"
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
                  onPress={handleCreatePackage}
                  disabled={submitting}
                >
                  {submitting ? (
                    <ActivityIndicator color="#FFF" />
                  ) : (
                    <Text style={styles.submitButtonText}>Create</Text>
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
  searchInput: {
    margin: SPACING.md,
    padding: 12,
    backgroundColor: '#FFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  packageCard: {
    backgroundColor: '#FFF',
    marginHorizontal: SPACING.md,
    marginVertical: SPACING.sm,
    padding: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  packageHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  packageName: {
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
  badgeActive: {
    backgroundColor: '#D1FAE5',
  },
  badgeInactive: {
    backgroundColor: '#FEE2E2',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#1F2937',
  },
  packageDescription: {
    fontSize: 14,
    color: '#6B7280',
    marginBottom: SPACING.sm,
  },
  packageDetails: {
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
  textArea: {
    height: 80,
    textAlignVertical: 'top',
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
});

