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

export default function ManageUsersScreen({ onBack }: { onBack?: () => void }) {
  const [users, setUsers] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any | null>(null);
  const [saving, setSaving] = useState(false);
  
  // Form data
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
    workshop_id: '',
    department: '',
    is_active: true
  });
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (searchQuery) {
      const filtered = users.filter(user => 
        user.full_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        user.role?.role_name?.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredUsers(filtered);
    } else {
      setFilteredUsers(users);
    }
  }, [searchQuery, users]);

  const fetchData = async () => {
    try {
      // Fetch users
      const { data: usersData } = await supabase
        .from('users_login')
        .select(`
          *,
          role:roles!role_id(id, role_name, role_code),
          workshop:workshops!workshop_id(id, name)
        `)
        .order('created_at', { ascending: false });

      // Fetch roles (exclude workshop staff roles for super admin)
      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .eq('is_active', true)
        .order('role_name');

      // Fetch workshops
      const { data: workshopsData } = await supabase
        .from('workshops')
        .select('id, name, city')
        .order('name');

      setUsers(usersData || []);
      setFilteredUsers(usersData || []);
      setRoles(rolesData || []);
      setWorkshops(workshopsData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      Alert.alert('Error', 'Failed to load users');
    } finally {
      setLoading(false);
    }
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const toggleUserStatus = async (userId: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('users_login')
        .update({ 
          is_active: !currentStatus, 
          updated_at: new Date().toISOString() 
        })
        .eq('id', userId);

      if (error) throw error;
      
      Alert.alert('Success', `User ${!currentStatus ? 'activated' : 'deactivated'} successfully`);
      fetchData();
    } catch (error) {
      console.error('Error toggling user status:', error);
      Alert.alert('Error', 'Failed to update user status');
    }
  };

  const handleOpenCreate = () => {
    setSelectedUser(null);
    setFormData({
      full_name: '',
      email: '',
      phone: '',
      password: '',
      role_id: '',
      workshop_id: '',
      department: '',
      is_active: true
    });
    setShowCreateModal(true);
  };

  const handleOpenEdit = (user: any) => {
    setSelectedUser(user);
    setFormData({
      full_name: user.full_name || '',
      email: user.email || '',
      phone: user.phone || '',
      password: '',
      role_id: user.role?.id || '',
      workshop_id: user.workshop?.id || '',
      department: user.department || '',
      is_active: user.is_active
    });
    setShowEditModal(true);
  };

  const handleSaveUser = async () => {
    // Validation
    if (!formData.full_name || !formData.email || !formData.role_id) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    if (!selectedUser && !formData.password) {
      Alert.alert('Error', 'Password is required for new users');
      return;
    }

    setSaving(true);

    try {
      if (selectedUser) {
        // Update existing user
        const updateData: any = {
          full_name: formData.full_name,
          email: formData.email,
          phone: formData.phone,
          role_id: formData.role_id,
          workshop_id: formData.workshop_id || null,
          department: formData.department,
          is_active: formData.is_active,
          updated_at: new Date().toISOString()
        };

        const { error } = await supabase
          .from('users_login')
          .update(updateData)
          .eq('id', selectedUser.id);

        if (error) throw error;

        // Update password if provided
        if (formData.password) {
          const { error: authError } = await supabase.auth.admin.updateUserById(
            selectedUser.id,
            { password: formData.password }
          );
          if (authError) console.error('Password update error:', authError);
        }

        Alert.alert('Success', 'User updated successfully');
      } else {
        // Create new user
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
              workshop_id: formData.workshop_id || null,
              department: formData.department,
              is_active: formData.is_active,
            });

          if (profileError) throw profileError;
        }

        Alert.alert('Success', 'User created successfully');
      }

      setShowCreateModal(false);
      setShowEditModal(false);
      fetchData();
    } catch (error: any) {
      console.error('Error saving user:', error);
      Alert.alert('Error', error.message || 'Failed to save user');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteUser = (user: any) => {
    Alert.alert(
      'Delete User',
      `Are you sure you want to delete ${user.full_name}?`,
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
                .eq('id', user.id);

              if (error) throw error;

              Alert.alert('Success', 'User deleted successfully');
              fetchData();
            } catch (error) {
              console.error('Error deleting user:', error);
              Alert.alert('Error', 'Failed to delete user');
            }
          }
        }
      ]
    );
  };

  const handleResetPassword = (user: any) => {
    setSelectedUser(user);
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
        selectedUser.id,
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

  const renderUser = ({ item }: { item: any }) => (
    <View style={styles.userCard}>
      <View style={styles.userHeader}>
        <View style={styles.userAvatar}>
          <Text style={styles.avatarText}>
            {item.full_name?.charAt(0) || 'U'}
          </Text>
        </View>
        <View style={styles.userInfo}>
          <Text style={styles.userName}>{item.full_name}</Text>
          <Text style={styles.userEmail}>{item.email}</Text>
          {item.phone && <Text style={styles.userPhone}>📞 {item.phone}</Text>}
          <View style={styles.roleBadge}>
            <Text style={styles.roleText}>{item.role?.role_name || 'User'}</Text>
          </View>
        </View>
      </View>
      
      <View style={styles.userFooter}>
        <View style={[styles.statusBadge, { backgroundColor: item.is_active ? COLORS.success : COLORS.danger }]}>
          <Text style={styles.statusText}>{item.is_active ? 'Active' : 'Inactive'}</Text>
        </View>
      </View>

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
          onPress={() => toggleUserStatus(item.id, item.is_active)}
        >
          <Text style={styles.actionButtonText}>
            {item.is_active ? '⏸️ Deactivate' : '▶️ Activate'}
          </Text>
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.actionButton, { backgroundColor: COLORS.danger }]}
          onPress={() => handleDeleteUser(item)}
        >
          <Text style={styles.actionButtonText}>🗑️ Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  const renderUserModal = (isEdit: boolean) => (
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
              {isEdit ? 'Edit User' : 'Create New User'}
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
                    {role.role_name}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={styles.label}>Workshop (Optional)</Text>
            <View style={styles.pickerContainer}>
              <TouchableOpacity
                style={[
                  styles.pickerOption,
                  !formData.workshop_id && styles.pickerOptionSelected
                ]}
                onPress={() => setFormData({...formData, workshop_id: ''})}
              >
                <Text style={[
                  styles.pickerOptionText,
                  !formData.workshop_id && styles.pickerOptionTextSelected
                ]}>
                  None
                </Text>
              </TouchableOpacity>
              {workshops.map((workshop) => (
                <TouchableOpacity
                  key={workshop.id}
                  style={[
                    styles.pickerOption,
                    formData.workshop_id === workshop.id && styles.pickerOptionSelected
                  ]}
                  onPress={() => setFormData({...formData, workshop_id: workshop.id})}
                >
                  <Text style={[
                    styles.pickerOptionText,
                    formData.workshop_id === workshop.id && styles.pickerOptionTextSelected
                  ]}>
                    {workshop.name}
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
              onPress={handleSaveUser}
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
        <Text style={styles.loadingText}>Loading users...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Manage Users</Text>
        <Text style={styles.subtitle}>View and manage all system users</Text>
      </View>

      <View style={styles.searchContainer}>
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchQuery}
          onChangeText={setSearchQuery}
          placeholderTextColor={COLORS.gray[400]}
        />
        <TouchableOpacity 
          style={styles.createButton}
          onPress={handleOpenCreate}
        >
          <Text style={styles.createButtonText}>➕ Add User</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{users.length}</Text>
          <Text style={styles.statLabel}>Total Users</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{users.filter(u => u.is_active).length}</Text>
          <Text style={styles.statLabel}>Active</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={styles.statValue}>{users.filter(u => !u.is_active).length}</Text>
          <Text style={styles.statLabel}>Inactive</Text>
        </View>
      </View>

      <FlatList
        data={filteredUsers}
        renderItem={renderUser}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {searchQuery ? 'No users found' : 'No users yet'}
            </Text>
          </View>
        }
      />

      {/* Create/Edit Modal */}
      {renderUserModal(false)}
      {renderUserModal(true)}

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
  userCard: {
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
  userHeader: {
    flexDirection: 'row',
    marginBottom: SPACING.sm,
  },
  userAvatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: SPACING.md,
  },
  avatarText: {
    fontSize: FONT_SIZES.xl,
    fontWeight: 'bold',
    color: COLORS.white,
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: FONT_SIZES.md,
    fontWeight: 'bold',
    color: COLORS.heading,
  },
  userEmail: {
    fontSize: FONT_SIZES.sm,
    color: COLORS.bodyText,
    marginTop: 2,
  },
  userPhone: {
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
  userFooter: {
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
  // Modal Styles
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
