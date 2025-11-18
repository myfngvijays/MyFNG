import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  FlatList, 
  TouchableOpacity, 
  TextInput, 
  Alert, 
  RefreshControl,
  Modal,
  ScrollView,
  ActivityIndicator,
  Switch
} from 'react-native';
import { supabase } from '../../lib/supabase';
import { COLORS, SPACING, FONT_SIZES, BORDER_RADIUS } from '../../constants/theme';

export default function WorkshopStaffScreen({ workshopId }) {
  const [staff, setStaff] = useState([]);
  const [roles, setRoles] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUserId, setCurrentUserId] = useState('');
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [saving, setSaving] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
    department: '',
    is_active: true
  });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchCurrentUser();
    fetchData();
  }, [workshopId]);

  useEffect(() => {
    if (searchQuery) {
      const filtered = staff.filter(member => 
        member.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        member.role?.role_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredStaff(filtered);
    } else {
      setFilteredStaff(staff);
    }
  }, [searchQuery, staff]);

  const fetchCurrentUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) setCurrentUserId(user.id);
  };

  const fetchData = async () => {
    if (!workshopId) return;

    try {
      // Fetch workshop staff
      const { data: staffData } = await supabase
        .from('users_login')
        .select(`
          *,
          role:roles!role_id(id, role_name, role_code)
        `)
        .eq('workshop_id', workshopId)
        .order('created_at', { ascending: false });

      // Fetch workshop staff roles only
      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .in('role_code', ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_MECHANIC', 'WORKSHOP_PICKUP_BOY'])
        .eq('is_active', true)
        .order('role_name');

      setStaff(staffData || []);
      setFilteredStaff(staffData || []);
      setRoles(rolesData || []);
    } catch (error) {
      console.error('Error fetching staff:', error);
      Alert.alert('Error', 'Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const toggleStaffStatus = async (staffId: string, currentStatus: boolean) => {
    if (staffId === currentUserId) {
      Alert.alert('Error', 'You cannot change your own status');
      return;
    }

    try {
      const { error } = await supabase
        .from('users_login')
        .update({ 
          is_active: !currentStatus, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', staffId);

      if (error) throw error;
      
      Alert.alert('Success', `Staff member ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchData();
    } catch (error) {
      console.error('Error toggling staff status:', error);
      Alert.alert('Error', 'Failed to update staff status');
    }
  };

  const handleOpenCreate = () => {
    setSelectedStaff(null);
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role_id: '',
      department: '',
      is_active: true
    });
    setShowCreateModal(true);
  };

  const handleOpenEdit = (member: any) => {
    if (member.id === currentUserId) {
      Alert.alert('Error', 'You cannot edit your own account from here');
      return;
    }

    if (member.role?.role_code === 'WORKSHOP_ADMIN' && member.id !== currentUserId) {
      Alert.alert('Error', 'You cannot manage other workshop admins');
      return;
    }

    setSelectedStaff(member);
    setFormData({
      full_name: member.full_name || '',
      email: member.email || '',
      phone: member.phone || '',
      password: '',
      role_id: member.role?.id || '',
      department: member.department || '',
      is_active: member.is_active
    });
    setShowEditModal(true);
  };

  const handleSaveStaff = async () => {
    // Validation
    if (!formData.full_name || !formData.email || !formData.role_id) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!selectedStaff && !formData.password) {
      Alert.alert('Error', 'Password is required for new staff');
      return;
    }

    setSaving(true);

    try {
      if (selectedStaff) {
        // Update existing staff
        const updateData: any = {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          role_id: formData.role_id,
          department: formData.department,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('users_login')
          .update(updateData)
          .eq('id', selectedStaff.id);

        if (error) throw error;

        Alert.alert('Success', 'Staff member updated successfully');
      } else {
        // Create new staff
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
        });

        if (authError) throw authError;

        if (authData.user) {
          const { error: profileError } = await supabase
            .from('users_login')
            .insert({
              id: authData.user.id,
              full_name: formData.full_name,
              email: formData.email,
              phone: formData.phone,
              role_id: formData.role_id,
              workshop_id: workshopId,
              department: formData.department,
              is_active: formData.is_active,
            });

          if (profileError) throw profileError;
        }

        Alert.alert('Success', 'Staff member created successfully');
      }

      setShowCreateModal(false);
      setShowEditModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving staff:', error);
      Alert.alert('Error', error.message || 'Failed to save staff member');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteStaff = (member: any) => {
    if (member.id === currentUserId) {
      Alert.alert('Error', 'You cannot delete your own account');
      return;
    }

    Alert.alert(
      'Delete Staff Member',
      `Are you sure you want to delete ${member.full_name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('users_login')
                .delete()
                .eq('id', member.id);

              if (error) throw error;

              Alert.alert('Success', 'Staff member deleted successfully');
              fetchData();
            } catch (error) {
              console.error('Error deleting staff:', error);
              Alert.alert('Error', 'Failed to delete staff member');
            }
          }
        }
      ]
    );
  };

  const handleResetPassword = (member: any) => {
    setSelectedStaff(member);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleSavePassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      Alert.alert('Error', 'Password must be at least 6 characters');
      return;
    }

    setSaving(true);

    try {
      const { error } = await supabase.auth.admin.updateUserById(
        selectedStaff.id,
        { password: newPassword }
      );

      if (error) throw error;

      Alert.alert('Success', 'Password reset successfully');
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      Alert.alert('Error', error.message || 'Failed to reset password');
    } finally {
      setSaving(false);
    }
  };

  const getRoleIcon = (roleCode: string) => {
    switch (roleCode) {
      case 'WORKSHOP_ADMIN': return '👨‍💼';
      case 'WORKSHOP_SUPERVISOR': return '👷';
      case 'WORKSHOP_MECHANIC': return '🔧';
      case 'WORKSHOP_PICKUP_BOY': return '🚗';
      default: return '👤';
    }
  };

  const renderStaff = ({ item }) => (
    <View style={styles.staffCard}>
      <View style={styles.staffHeader}>
        <View style={styles.staffAvatar}>
          <Text style={styles.avatarText}>
            {getRoleIcon(item.role?.role_code)}
          </Text>
        </View>
        <View style={styles.staffInfo}>
          <Text style={styles.staffName}>{item.full_name}</Text>
          <Text style={styles.staffEmail}>{item.email}</Text>
          {item.phone && <Text style={styles.staffPhone}>📞 {item.phone}</Text>}
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{item.role?.role_name || 'Staff'}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.staffFooter}>
        <View style={[styles.statusBadge, { backgroundColor: item.is_active ? COLORS.success : COLORS.danger }]}>
          <Text style={styles.statusText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>

      {item.id !== currentUserId && (
        <View style={styles.actionButtons}>
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: COLORS.primary }]}
            onPress={() => handleOpenEdit(item)}
          >
            <Text style={styles.actionButtonText}>✏️ Edit</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: COLORS.secondary }]}
            onPress={() => handleResetPassword(item)}
          >
            <Text style={styles.actionButtonText}>🔑 Password</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: item.is_active ? COLORS.warning : COLORS.success }]}
            onPress={() => toggleStaffStatus(item.id, item.is_active)}
          >
            <Text style={styles.actionButtonText}>
              {item.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.actionButton, { backgroundColor: COLORS.danger }]}
            onPress={() => handleDeleteStaff(item)}
          >
            <Text style={styles.actionButtonText}>🗑️ Delete</Text>
          </TouchableOpacity>
        </View>
      )}
    </View>
  );

  const renderStaffModal = (isEdit: boolean) => (
    <Modal
      visible={isEdit ? showEditModal : showCreateModal}
      animationType="slide"
      transparent={true}
      onRequestClose={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>
              {isEdit ? 'Edit Staff Member' : 'Add New Staff'}
            </Text>
            <TouchableOpacity onPress={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)}>
              <Text style={styles.closeButton}>✕</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody}>
            <Text style={styles.label}>Full Name *</Text>
            <TextInput
              style={styles.input}
              value={formData.full_name}
              onChangeText={(text) => setFormData({...formData, full_name: text})}
              placeholder="Enter full name"
              placeholderTextColor={COLORS.gray[400]}
            />

            <Text style={styles.label}>Email *</Text>
            <TextInput
              style={styles.input}
              value={formData.email}
              onChangeText={(text) => setFormData({...formData, email: text})}
              placeholder="Enter email"
              keyboardType="email-address"
              autoCapitalize="none"
              placeholderTextColor={COLORS.gray[400]}
            />

            <Text style={styles.label}>Phone</Text>
            <TextInput
              style={styles.input}
              value={formData.phone}
              onChangeText={(text) => setFormData({...formData, phone: text})}
              placeholder="Enter phone number"
              keyboardType="phone-pad"
              placeholderTextColor={COLORS.gray[400]}
            />

            {!isEdit && (
              <>
                <Text style={styles.label}>Password *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.password}
                  onChangeText={(text) => setFormData({...formData, password: text})}
                  placeholder="Enter password"
                  secureTextEntry
                  placeholderTextColor={COLORS.gray[400]}
                />
              </>
            )}

            <Text style={styles.label}>Role *</Text>
            <View style={styles.pickerContainer}>
              {roles.map((role) => (
                <TouchableOpacity
                  key={role.id}
                  style={[
                    styles.pickerOption,
                    formData.role_id === role.id && styles.pickerOptionSelected
                  ]}
                  onPress={() => setFormData({...formData, role_id: role.id})}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    formData.role_id === role.id && styles.pickerOptionTextSelected
                  ]}>
                    {getRoleIcon(role.role_code)} {role.role_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Department</Text>
            <TextInput
              style={styles.input}
              value={formData.department}
              onChangeText={(text) => setFormData({...formData, department: text})}
              placeholder="Enter department"
              placeholderTextColor={COLORS.gray[400]}
            />

            <View style={styles.switchContainer}>
              <Text style={styles.label}>Active Status</Text>
              <Switch
                value={formData.is_active}
                onValueChange={(value) => setFormData({...formData, is_active: value})}
                trackColor={{ false: COLORS.gray[300], true: COLORS.primary }}
                thumbColor={COLORS.white}
              />
            </View>
          </ScrollView>

          <View style={styles.modalFooter}>
            <TouchableOpacity
              style={[styles.modalButton, styles.cancelButton]}
              onPress={() => isEdit ? setShowEditModal(false) : setShowCreateModal(false)}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalButton, styles.saveButton]}
              onPress={handleSaveStaff}
              disabled={saving}
            >
              {saving ? (
                <ActivityIndicator color={COLORS.white} />
              ) : (
                <Text style={styles.saveButtonText}>
                  {isEdit ? 'Update' : 'Create'}
                </Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={COLORS.primary} />
        <Text style={styles.loadingText}>Loading staff...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workshop Staff</Text>
        <Text style={styles.subtitle}>Manage your workshop team</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search staff..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.gray[400]}
        />
        <TouchableOpacity 
          style={styles.createButton}
          onPress={handleOpenCreate}
        >
          <Text style={styles.createButtonText}>➕ Add</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{staff.length}</Text>
          <Text style={styles.statLabel}>Total</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{staff.filter(s => s.is_active).length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{staff.filter(s => !s.is_active).length}</Text>
          <Text style={styles.statLabel}>Inactive</Text>
        </View>
      </View>

      <FlatList
        data={filteredStaff}
        renderItem={renderStaff}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No staff found' : 'No staff members yet'}
            </Text>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      {renderStaffModal(false)}
      {renderStaffModal(true)}

      {/* Password Reset Modal */}
      <Modal
        visible={showPasswordModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowPasswordModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContent, { maxHeight: 300 }]}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Reset Password</Text>
              <TouchableOpacity onPress={() => setShowPasswordModal(false)}>
                <Text style={styles.closeButton}>✕</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.modalBody}>
              <Text style={styles.label}>New Password</Text>
              <TextInput
                style={styles.input}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password (min 6 characters)"
                secureTextEntry
                placeholderTextColor={COLORS.gray[400]}
              />
            </View>

            <View style={styles.modalFooter}>
              <TouchableOpacity
                style={[styles.modalButton, styles.cancelButton]}
                onPress={() => setShowPasswordModal(false)}
              >
                <Text style={styles.cancelButtonText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.modalButton, styles.saveButton]}
                onPress={handleSavePassword}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color={COLORS.white} />
                ) : (
                  <Text style={styles.saveButtonText}>Reset</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[600],
  },
  header: {
    backgroundColor: COLORS.primary,
    padding: SPACING.lg,
    paddingTop: SPACING.xl,
  },
  title: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  subtitle: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.white,
    opacity: 0.9,
    marginTop: SPACING.xs,
  },
  searchContainer: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
  },
  createButton: {
    backgroundColor: COLORS.primary,
    borderRadius: BORDER_RADIUS.md,
    paddingHorizontal: SPACING.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  createButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  statBox: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    alignItems: 'center',
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
  },
  statValue: {
    fontSize: FONT_SIZES.xxl,
    fontWeight: 'bold',
    color: COLORS.primary,
  },
  statLabel: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.gray[600],
    marginTop: 4,
  },
  listContainer: {
    padding: SPACING.lg,
    paddingBottom: SPACING.xxl + SPACING.lg,
  },
  staffCard: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    shadowColor: COLORS.black,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  staffHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  staffAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary + '20',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: 28,
  },
  staffInfo: {
    flex: 1,
  },
  staffName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
  },
  staffEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginTop: 2,
  },
  staffPhone: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginTop: 2,
  },
  roleBadge: {
    backgroundColor: COLORS.secondary + '20',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  roleText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.secondary,
    fontWeight: '600',
  },
  staffFooter: {
    marginBottom: SPACING.sm,
  },
  statusBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: BORDER_RADIUS.sm,
    alignSelf: 'flex-start',
  },
  statusText: {
    fontSize: FONT_SIZES.xs,
    color: COLORS.white,
    fontWeight: '600',
  },
  actionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  actionButton: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: BORDER_RADIUS.sm,
    minWidth: '47%',
    alignItems: 'center',
  },
  actionButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.xs,
    fontWeight: '600',
  },
  emptyContainer: {
    padding: SPACING.xxl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: FONT_SIZES.md,
    color: COLORS.gray[500],
  },
  // Modal Styles (same as ManageUsersScreen)
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: COLORS.white,
    borderRadius: BORDER_RADIUS.lg,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.gray[200],
  },
  modalTitle: {
    fontSize: FONT_SIZES.lg,
    fontWeight: 'bold',
    color: COLORS.heading,
  },
  closeButton: {
    fontSize: FONT_SIZES.xxl,
    color: COLORS.gray[600],
  },
  modalBody: {
    padding: SPACING.lg,
  },
  label: {
    fontSize: FONT_SIZES.sm,
    fontWeight: '600',
    color: COLORS.heading,
    marginBottom: SPACING.xs,
    marginTop: SPACING.sm,
  },
  input: {
    backgroundColor: COLORS.white,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZES.md,
    color: COLORS.bodyText,
  },
  pickerContainer: {
    gap: SPACING.xs,
  },
  pickerOption: {
    backgroundColor: COLORS.gray[100],
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    borderWidth: 1,
    borderColor: COLORS.gray[300],
  },
  pickerOptionSelected: {
    backgroundColor: COLORS.primary + '20',
    borderColor: COLORS.primary,
  },
  pickerOptionText: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
  },
  pickerOptionTextSelected: {
    color: COLORS.primary,
    fontWeight: '600',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: SPACING.md,
  },
  modalFooter: {
    flexDirection: 'row',
    padding: SPACING.lg,
    gap: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: COLORS.gray[200],
  },
  modalButton: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: BORDER_RADIUS.md,
    alignItems: 'center',
  },
  cancelButton: {
    backgroundColor: COLORS.gray[200],
  },
  cancelButtonText: {
    color: COLORS.gray[700],
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
  saveButton: {
    backgroundColor: COLORS.primary,
  },
  saveButtonText: {
    color: COLORS.white,
    fontSize: FONT_SIZES.md,
    fontWeight: '600',
  },
});

