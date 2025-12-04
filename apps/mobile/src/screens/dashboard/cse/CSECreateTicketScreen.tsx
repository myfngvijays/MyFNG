/**
 * CSE Create Ticket Screen
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  BackHandler,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { supabase } from '../../../lib/supabase';
import { Ionicons } from '@expo/vector-icons';
import { ENV } from '../../../config/environment';

export default function CSECreateTicketScreen({ navigation, route }: any) {
  const leadId = route?.params?.lead_id;
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    issue_category: 'OTHER',
    severity: 'MEDIUM',
    title: '',
    description: '',
    customer_expected_resolution: '',
  });

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

  const handleSubmit = async () => {
    if (!formData.title || !formData.description) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    if (!leadId) {
      Alert.alert('Error', 'Lead ID is required');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(
        `${ENV.API_URL}/api/cse/tickets`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token}`,
          },
          body: JSON.stringify({
            lead_id: leadId,
            ...formData,
          }),
        }
      );

      const data = await response.json();
      if (data.success) {
        Alert.alert('Success', 'Ticket created successfully!', [
          { text: 'OK', onPress: () => navigation.navigate('CSETickets') },
        ]);
      } else {
        Alert.alert('Error', data.error || 'Failed to create ticket');
      }
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create ticket');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Create Ticket</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.formGroup}>
          <Text style={styles.label}>Issue Category *</Text>
          <View style={styles.selectContainer}>
            <Text style={styles.selectText}>{formData.issue_category.replace(/_/g, ' ')}</Text>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Severity *</Text>
          <View style={styles.selectContainer}>
            <Text style={styles.selectText}>{formData.severity}</Text>
            <Ionicons name="chevron-down" size={20} color="#6B7280" />
          </View>
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Title *</Text>
          <TextInput
            style={styles.input}
            value={formData.title}
            onChangeText={(text) => setFormData({ ...formData, title: text })}
            placeholder="Brief title for the ticket"
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Description *</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.description}
            onChangeText={(text) => setFormData({ ...formData, description: text })}
            placeholder="Detailed description of the issue..."
            multiline
            numberOfLines={6}
          />
        </View>

        <View style={styles.formGroup}>
          <Text style={styles.label}>Customer Expected Resolution</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={formData.customer_expected_resolution}
            onChangeText={(text) => setFormData({ ...formData, customer_expected_resolution: text })}
            placeholder="What does the customer expect as resolution?"
            multiline
            numberOfLines={3}
          />
        </View>

        <TouchableOpacity
          style={styles.submitButton}
          onPress={handleSubmit}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#FFF" />
          ) : (
            <>
              <Ionicons name="checkmark-circle" size={20} color="#FFF" />
              <Text style={styles.submitButtonText}>Create Ticket</Text>
            </>
          )}
        </TouchableOpacity>
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
  content: {
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#111827',
  },
  textArea: {
    minHeight: 100,
    textAlignVertical: 'top',
  },
  selectContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 8,
    padding: 12,
  },
  selectText: {
    fontSize: 16,
    color: '#111827',
  },
  submitButton: {
    backgroundColor: '#3B82F6',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 8,
  },
  submitButtonText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '600',
  },
});

