/**
 * Supervisor Profile Screen
 * Profile and settings for workshop supervisor
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { COLORS, SIZES, SPACING } from '../../../constants/theme';

export default function SupervisorProfileScreen() {
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [profile, setProfile] = useState({ full_name: '', phone: '', email: '' });

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const fetchUserProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profileData } = await supabase
        .from('users_login')
        .select(`
          *,
          role:role_id(role_name, role_code)
        `)
        .eq('email', user.email)
        .single();

      if (profileData) {
        setUserProfile(profileData);
        setProfile({
          full_name: profileData.full_name || '',
          phone: profileData.phone || '',
          email: profileData.email || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      if (!userProfile?.id) return;

      const { error } = await supabase
        .from('users_login')
        .update({
          full_name: profile.full_name,
          phone: profile.phone,
        })
        .eq('id', userProfile.id);

      if (error) {
        Alert.alert('Error', 'Failed to update profile');
        return;
      }

      Alert.alert('Success', 'Profile updated successfully');
      setEditing(false);
      fetchUserProfile(); // Refresh
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Failed to update profile');
    }
  };

  return (
    <ScrollView style={styles.container}>
      <View style={styles.header}>
        <View style={styles.avatar}>
          <Ionicons name="person" size={48} color={COLORS.white} />
        </View>
        <Text style={styles.name}>{userProfile?.full_name}</Text>
        <Text style={styles.role}>{userProfile?.role?.role_name}</Text>
      </View>

      <View style={styles.section}>
        <View style={styles.row}>
          <Text style={styles.label}>Name</Text>
          {editing ? <TextInput style={styles.input} value={profile.full_name} onChangeText={text => setProfile({ ...profile, full_name: text })} /> : <Text style={styles.value}>{profile.full_name}</Text>}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Phone</Text>
          {editing ? <TextInput style={styles.input} value={profile.phone} onChangeText={text => setProfile({ ...profile, phone: text })} /> : <Text style={styles.value}>{profile.phone}</Text>}
        </View>
        <View style={styles.row}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{profile.email}</Text>
        </View>
      </View>

      <View style={styles.actions}>
        {editing ? (
          <>
            <TouchableOpacity style={styles.btnSave} onPress={handleSave}><Text style={styles.btnText}>Save</Text></TouchableOpacity>
            <TouchableOpacity style={styles.btnCancel} onPress={() => setEditing(false)}><Text style={styles.btnText}>Cancel</Text></TouchableOpacity>
          </>
        ) : (
          <TouchableOpacity style={styles.btnEdit} onPress={() => setEditing(true)}><Text style={styles.btnText}>Edit Profile</Text></TouchableOpacity>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.gray[50] },
  header: { backgroundColor: COLORS.primary, padding: SPACING.xl, alignItems: 'center' },
  avatar: { width: 80, height: 80, borderRadius: 40, backgroundColor: COLORS.primary + 'AA', justifyContent: 'center', alignItems: 'center', marginBottom: SPACING.md },
  name: { fontSize: SIZES.xl, fontWeight: 'bold', color: COLORS.white },
  role: { fontSize: SIZES.sm, color: COLORS.white, opacity: 0.9, marginTop: SPACING.xs },
  section: { backgroundColor: COLORS.white, margin: SPACING.md, borderRadius: SIZES.sm, padding: SPACING.md },
  row: { paddingVertical: SPACING.md, borderBottomWidth: 1, borderBottomColor: COLORS.gray[100] },
  label: { fontSize: SIZES.sm, color: COLORS.gray[600], marginBottom: SPACING.xs },
  value: { fontSize: SIZES.md, color: COLORS.gray[900] },
  input: { fontSize: SIZES.md, borderWidth: 1, borderColor: COLORS.gray[300], borderRadius: SIZES.xs, padding: SPACING.sm },
  actions: { padding: SPACING.md, gap: SPACING.sm },
  btnEdit: { backgroundColor: COLORS.primary, padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center' },
  btnSave: { backgroundColor: COLORS.success, padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center' },
  btnCancel: { backgroundColor: COLORS.gray[400], padding: SPACING.md, borderRadius: SIZES.sm, alignItems: 'center' },
  btnText: { color: COLORS.white, fontSize: SIZES.md, fontWeight: '600' },
});

