import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  BackHandler
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { apiFetch } from '../../../lib/api';
import { COLORS, SPACING } from '../../../constants/theme';

const PRIORITY_OPTIONS = ['LOW', 'MEDIUM', 'HIGH', 'URGENT', 'CRITICAL'] as const;

export default function LeadManagerAssignWorkshopScreen({ navigation, route }: any) {
  const { leadId, mode = 'assign' } = route.params;

  const [lead, setLead] = useState<any>(null);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [filteredWorkshops, setFilteredWorkshops] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [assigning, setAssigning] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedWorkshop, setSelectedWorkshop] = useState<any>(null);
  const [assignmentNote, setAssignmentNote] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT' | 'CRITICAL'>('MEDIUM');

  useEffect(() => {
    fetchData();
  }, []);

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

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchWorkshops(searchTerm);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchData = async () => {
    try {
      // Fetch lead
      const { data: leadData, error: leadError } = await supabase
        .from('service_leads')
        .select('*, city_info:city_id(name)')
        .eq('id', leadId)
        .single();

      if (leadError) throw leadError;
      setLead(leadData);

      await fetchWorkshops('', leadData);

    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load workshops');
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkshops = async (searchValue = '', leadOverride?: any) => {
    try {
      const leadSource = leadOverride || lead;
      const city = leadSource?.city_info?.name || leadSource?.city || '';
      const params: string[] = [];
      if (searchValue.trim()) {
        params.push(`search=${encodeURIComponent(searchValue.trim())}`);
      } else if (city) {
        params.push(`city=${encodeURIComponent(city)}`);
      }
      const query = params.length ? `?${params.join('&')}` : '';
      const data = await apiFetch<{ success: boolean; workshops: any[] }>(
        `/api/lead-manager/available-workshops${query}`
      );
      const list = data?.workshops || [];
      setWorkshops(list);
      setFilteredWorkshops(list);
    } catch (error) {
      console.error('Error fetching workshops:', error);
    }
  };

  const handleAssignWorkshop = async () => {
    if (!selectedWorkshop) {
      Alert.alert('Error', 'Please select a workshop');
      return;
    }

    Alert.alert(
      mode === 'reassign' ? 'Reassign Workshop?' : 'Assign Workshop?',
      `${mode === 'reassign' ? 'Reassign' : 'Assign'} this lead to ${selectedWorkshop.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: mode === 'reassign' ? 'Reassign' : 'Assign',
          onPress: async () => {
            try {
              setAssigning(true);

              await apiFetch('/api/lead-manager/assign-workshop', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  lead_id: leadId,
                  workshop_id: selectedWorkshop.id,
                  assignment_notes: assignmentNote,
                  priority
                })
              });

              Alert.alert('Success', 'Workshop assigned successfully');
              navigation.goBack();

            } catch (error) {
              console.error('Error assigning workshop:', error);
              Alert.alert('Error', 'Failed to assign workshop');
            } finally {
              setAssigning(false);
            }
          }
        }
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading workshops...</Text>
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
        <Text style={styles.headerTitle}>
          {mode === 'reassign' ? 'Reassign' : 'Assign'} Workshop
        </Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Lead Info */}
      <View style={styles.leadInfo}>
        <Text style={styles.leadName}>{lead?.customer_name}</Text>
        <Text style={styles.leadDetails}>
          {lead?.vehicle_model} • {lead?.city_info?.name || lead?.city}
        </Text>
        <Text style={styles.leadService}>Service: {lead?.service_type}</Text>
      </View>

      {/* Priority */}
      <View style={styles.prioritySection}>
        <Text style={styles.noteLabel}>Priority</Text>
        <View style={styles.priorityRow}>
          {PRIORITY_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option}
              style={[
                styles.priorityChip,
                priority === option && styles.priorityChipActive
              ]}
              onPress={() => setPriority(option)}
            >
              <Text style={[
                styles.priorityChipText,
                priority === option && styles.priorityChipTextActive
              ]}>
                {option}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search workshops..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Workshops List */}
      <ScrollView style={styles.workshopsList}>
        <Text style={styles.resultsText}>
          {filteredWorkshops.length} workshop{filteredWorkshops.length !== 1 ? 's' : ''} available
        </Text>
        
        {filteredWorkshops.map((workshop) => (
          <TouchableOpacity
            key={workshop.id}
            style={[
              styles.workshopCard,
              selectedWorkshop?.id === workshop.id && styles.workshopCardSelected
            ]}
            onPress={() => setSelectedWorkshop(workshop)}
          >
            <View style={styles.workshopHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.workshopName}>{workshop.name}</Text>
                <Text style={styles.workshopCity}>📍 {workshop.city}</Text>
                {workshop.phone && (
                  <Text style={styles.workshopPhone}>📞 {workshop.phone}</Text>
                )}
              </View>
              {selectedWorkshop?.id === workshop.id && (
                <Icon name="check-circle" size={28} color={COLORS.green} />
              )}
            </View>
          </TouchableOpacity>
        ))}

        {filteredWorkshops.length === 0 && (
          <View style={styles.emptyContainer}>
            <Icon name="store-off" size={64} color={COLORS.gray} />
            <Text style={styles.emptyText}>No workshops found</Text>
          </View>
        )}
      </ScrollView>

      {/* Assignment Note */}
      {selectedWorkshop && (
        <View style={styles.noteSection}>
          <Text style={styles.noteLabel}>Assignment Note (Optional)</Text>
          <TextInput
            style={styles.noteInput}
            placeholder="Add a note..."
            value={assignmentNote}
            onChangeText={setAssignmentNote}
            multiline
            numberOfLines={2}
            placeholderTextColor={COLORS.textSecondary}
          />
        </View>
      )}

      {/* Assign Button */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.assignButton,
            (!selectedWorkshop || assigning) && styles.assignButtonDisabled
          ]}
          onPress={handleAssignWorkshop}
          disabled={!selectedWorkshop || assigning}
        >
          {assigning ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <Icon name="check-circle" size={24} color="#fff" />
              <Text style={styles.assignButtonText}>
                {mode === 'reassign' ? 'Reassign Workshop' : 'Assign Workshop'}
              </Text>
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
  },
  loadingText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  header: {
    backgroundColor: COLORS.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: SPACING.md,
    paddingTop: SPACING.xl,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#fff',
  },
  leadInfo: {
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray + '30',
  },
  leadName: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  leadDetails: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  leadService: {
    fontSize: 13,
    color: COLORS.primary,
    marginTop: 4,
    fontWeight: '600',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  workshopsList: {
    flex: 1,
    paddingHorizontal: SPACING.md,
  },
  resultsText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginBottom: SPACING.sm,
  },
  workshopCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.sm,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  workshopCardSelected: {
    borderColor: COLORS.green,
    backgroundColor: COLORS.green + '05',
  },
  workshopHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  workshopName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  workshopCity: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 4,
  },
  workshopPhone: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
  },
  emptyText: {
    marginTop: SPACING.md,
    color: COLORS.textSecondary,
  },
  noteSection: {
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray + '30',
  },
  noteLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginBottom: SPACING.xs,
  },
  noteInput: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.gray + '40',
    borderRadius: 8,
    padding: SPACING.sm,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  prioritySection: {
    backgroundColor: '#fff',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray + '20',
  },
  priorityRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.xs,
  },
  priorityChip: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.gray + '30',
  },
  priorityChipActive: {
    backgroundColor: COLORS.primary,
    borderColor: COLORS.primary,
  },
  priorityChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '600',
  },
  priorityChipTextActive: {
    color: '#fff',
  },
  footer: {
    backgroundColor: '#fff',
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray + '30',
  },
  assignButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: COLORS.primary,
    padding: SPACING.md,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  assignButtonDisabled: {
    opacity: 0.5,
  },
  assignButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: 'bold',
  },
});

