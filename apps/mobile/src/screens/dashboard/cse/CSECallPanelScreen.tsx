/**
 * CSE Call Panel Screen - React Native
 * Search and handle customer calls
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';
import { Ionicons } from '@expo/vector-icons';
import { Linking } from 'react-native';
import { ENV } from '../../../config/environment';

export default function CSECallPanelScreen({ navigation }: any) {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [searchType, setSearchType] = useState<'phone' | 'lead_id' | 'vehicle' | 'customer'>('phone');
  const [loading, setLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedLead, setSelectedLead] = useState<any>(null);

  // Handle hardware back button
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

  const handleSearch = async () => {
    if (!searchQuery.trim()) {
      Alert.alert('Error', 'Please enter a search query');
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(
        `${ENV.API_URL}/api/cse/leads/search?query=${encodeURIComponent(searchQuery)}&type=${searchType}`,
        {
          headers: {
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
        }
      );

      if (!response.ok) throw new Error('Search failed');

      const data = await response.json();
      setSearchResults(data.leads || []);
    } catch (error: any) {
      console.error('Search error:', error);
      Alert.alert('Error', error.message || 'Search failed');
    } finally {
      setLoading(false);
    }
  };

  const handleCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const handleWhatsApp = (phone: string) => {
    Linking.openURL(`whatsapp://send?phone=${phone.replace(/[^0-9]/g, '')}`);
  };

  const renderLeadCard = (lead: any) => (
    <TouchableOpacity
      key={lead.id}
      style={styles.leadCard}
      onPress={() => {
        setSelectedLead(lead);
        navigation.navigate('CSELeadDetail', { leadId: lead.id });
      }}
    >
      <View style={styles.leadHeader}>
        <View>
          <Text style={styles.leadNumber}>{lead.lead_number}</Text>
          <Text style={styles.customerName}>{lead.customer_name}</Text>
        </View>
        <View style={styles.statusBadge}>
          <Text style={styles.statusText}>{lead.status}</Text>
        </View>
      </View>

      <View style={styles.leadInfo}>
        <View style={styles.infoRow}>
          <Ionicons name="call" size={16} color="#6B7280" />
          <Text style={styles.infoText}>{lead.customer_phone}</Text>
        </View>
        {lead.vehicle_number && (
          <View style={styles.infoRow}>
            <Ionicons name="car" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{lead.vehicle_number}</Text>
          </View>
        )}
        {lead.workshop?.name && (
          <View style={styles.infoRow}>
            <Ionicons name="business" size={16} color="#6B7280" />
            <Text style={styles.infoText}>{lead.workshop.name}</Text>
          </View>
        )}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.callButton}
          onPress={() => handleCall(lead.customer_phone)}
        >
          <Ionicons name="call" size={18} color="#FFF" />
          <Text style={styles.callButtonText}>Call</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.whatsappButton}
          onPress={() => handleWhatsApp(lead.customer_phone)}
        >
          <Ionicons name="logo-whatsapp" size={18} color="#FFF" />
          <Text style={styles.whatsappButtonText}>WhatsApp</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.viewButton}
          onPress={() => navigation.navigate('CSELeadDetail', { leadId: lead.id })}
        >
          <Ionicons name="eye" size={18} color="#3B82F6" />
          <Text style={styles.viewButtonText}>View</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Call Panel</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Search Section */}
      <View style={styles.searchSection}>
        <View style={styles.searchTypeSelector}>
          <TouchableOpacity
            style={[styles.searchTypeButton, searchType === 'phone' && styles.searchTypeButtonActive]}
            onPress={() => setSearchType('phone')}
          >
            <Text style={[styles.searchTypeText, searchType === 'phone' && styles.searchTypeTextActive]}>
              Phone
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchTypeButton, searchType === 'lead_id' && styles.searchTypeButtonActive]}
            onPress={() => setSearchType('lead_id')}
          >
            <Text style={[styles.searchTypeText, searchType === 'lead_id' && styles.searchTypeTextActive]}>
              Lead ID
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchTypeButton, searchType === 'vehicle' && styles.searchTypeButtonActive]}
            onPress={() => setSearchType('vehicle')}
          >
            <Text style={[styles.searchTypeText, searchType === 'vehicle' && styles.searchTypeTextActive]}>
              Vehicle
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.searchTypeButton, searchType === 'customer' && styles.searchTypeButtonActive]}
            onPress={() => setSearchType('customer')}
          >
            <Text style={[styles.searchTypeText, searchType === 'customer' && styles.searchTypeTextActive]}>
              Customer
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.searchInputContainer}>
          <Ionicons name="search" size={20} color="#6B7280" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder={`Search by ${searchType.replace('_', ' ')}...`}
            value={searchQuery}
            onChangeText={setSearchQuery}
            keyboardType={searchType === 'phone' ? 'phone-pad' : 'default'}
            autoCapitalize="none"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleSearch}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Ionicons name="search" size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </View>

      {/* Results */}
      <ScrollView style={styles.resultsContainer}>
        {searchResults.length === 0 && !loading && (
          <View style={styles.emptyContainer}>
            <Ionicons name="search-outline" size={64} color="#9CA3AF" />
            <Text style={styles.emptyText}>Search for a lead to get started</Text>
            <Text style={styles.emptySubtext}>
              Use phone number, Lead ID, vehicle number, or customer name
            </Text>
          </View>
        )}

        {searchResults.map((lead) => renderLeadCard(lead))}
      </ScrollView>
    </SafeAreaView>
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
    justifyContent: 'space-between',
    padding: 16,
    backgroundColor: '#FFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#111827',
  },
  searchSection: {
    backgroundColor: '#FFF',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  searchTypeSelector: {
    flexDirection: 'row',
    marginBottom: 12,
    gap: 8,
  },
  searchTypeButton: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
  },
  searchTypeButtonActive: {
    backgroundColor: '#3B82F6',
  },
  searchTypeText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  searchTypeTextActive: {
    color: '#FFF',
  },
  searchInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingHorizontal: 12,
  },
  searchIcon: {
    marginRight: 8,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 12,
    fontSize: 16,
    color: '#111827',
  },
  searchButton: {
    backgroundColor: '#3B82F6',
    padding: 8,
    borderRadius: 8,
  },
  resultsContainer: {
    flex: 1,
    padding: 16,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#111827',
    marginTop: 16,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 8,
    textAlign: 'center',
  },
  leadCard: {
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  leadHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  leadNumber: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#111827',
  },
  customerName: {
    fontSize: 14,
    color: '#6B7280',
    marginTop: 4,
  },
  statusBadge: {
    backgroundColor: '#DBEAFE',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  statusText: {
    fontSize: 12,
    color: '#1E40AF',
    fontWeight: '600',
  },
  leadInfo: {
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  infoText: {
    fontSize: 14,
    color: '#6B7280',
    marginLeft: 8,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 8,
  },
  callButton: {
    flex: 1,
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  callButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  whatsappButton: {
    flex: 1,
    backgroundColor: '#25D366',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  whatsappButtonText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '600',
  },
  viewButton: {
    flex: 1,
    backgroundColor: '#EFF6FF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  viewButtonText: {
    color: '#3B82F6',
    fontSize: 14,
    fontWeight: '600',
  },
});

