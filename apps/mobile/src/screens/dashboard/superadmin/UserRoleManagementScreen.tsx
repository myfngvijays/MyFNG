import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  TextInput,
  Modal,
  Alert,
  ScrollView
} from 'react-native';
// import { MaterialCommunityIcons } from '@expo/vector-icons'; // Removed - using emojis
import { Icon } from '../../../components/Icon';
import { supabase } from '../../../lib/supabase';
import { COLORS, SPACING } from '../../../constants/theme';

const AVAILABLE_ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', icon: 'shield-crown', color: COLORS.red },
  { code: 'LEAD_MANAGER', name: 'Lead Manager', icon: 'account-tie', color: COLORS.purple },
  { code: 'TELECALLER', name: 'Telecaller', icon: 'phone', color: COLORS.blue },
  { code: 'WORKSHOP_ADMIN', name: 'Workshop Owner', icon: 'store', color: COLORS.orange },
  { code: 'WORKSHOP_SUPERVISOR', name: 'Workshop Adviser', icon: 'account-supervisor', color: COLORS.indigo },
  { code: 'WORKSHOP_MECHANIC', name: 'Workshop Mechanic', icon: 'wrench', color: COLORS.teal },
  { code: 'PICKUP_BOY', name: 'Pickupboy/Driver', icon: 'car-pickup', color: COLORS.green },
  { code: 'RSA_MANAGER', name: 'RSA Manager', icon: 'car-emergency', color: COLORS.red },
  { code: 'AUDITOR', name: 'Quality Auditor', icon: 'shield-check', color: COLORS.indigo },
  { code: 'CUSTOMER', name: 'Customer', icon: 'account', color: COLORS.gray },
];

export default function UserRoleManagementScreen({ navigation }: any) {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<any>(null);

  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    phone: '',
    role_code: 'CUSTOMER',
    password: ''
  });

  useEffect(() => {
    fetchUsers();
  }, [filterRole]);

  const fetchUsers = async () => {
    try {
      let query = supabase
        .from('users_login')
        .select('*, role:roles!role_id(role_name, role_code)')
        .order('created_at', { ascending: false });

      if (filterRole !== 'all') {
        query = query.eq('role_code', filterRole);
      }

      if (searchTerm) {
        query = query.or(
          `full_name.ilike.%${searchTerm}%,` +
          `email.ilike.%${searchTerm}%,` +
          `phone.ilike.%${searchTerm}%`
        );
      }

      const { data, error } = await query;

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchUsers();
  };

  const handleCreateUser = async () => {
    if (!newUser.full_name || !newUser.email || !newUser.role_code) {
      Alert.alert('Error', 'Please fill all required fields');
      return;
    }

    try {
      // In production, use Supabase Auth to create user
      const { data, error } = await supabase
        .from('users_login')
        .insert([{
          full_name: newUser.full_name,
          email: newUser.email,
          phone: newUser.phone || null,
          role_code: newUser.role_code,
          is_active: true
        }])
        .select()
        .single();

      if (error) throw error;

      Alert.alert('Success', 'User created successfully!');
      setShowCreateModal(false);
      setNewUser({
        full_name: '',
        email: '',
        phone: '',
        role_code: 'CUSTOMER',
        password: ''
      });
      fetchUsers();
    } catch (error: any) {
      Alert.alert('Error', error.message || 'Failed to create user');
    }
  };

  const handleToggleUserStatus = async (userId: string, currentStatus: boolean) => {
    Alert.alert(
      currentStatus ? 'Disable User' : 'Enable User',
      currentStatus ? 'Disable this user account?' : 'Enable this user account?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: currentStatus ? 'Disable' : 'Enable',
          style: currentStatus ? 'destructive' : 'default',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('users_login')
                .update({ is_active: !currentStatus })
                .eq('id', userId);

              if (!error) {
                Alert.alert('Success', `User ${currentStatus ? 'disabled' : 'enabled'} successfully`);
                fetchUsers();
              }
            } catch (error) {
              Alert.alert('Error', 'Failed to update user status');
            }
          }
        }
      ]
    );
  };

  const handleChangeRole = async (userId: string, newRoleCode: string) => {
    try {
      const { error } = await supabase
        .from('users_login')
        .update({ role_code: newRoleCode })
        .eq('id', userId);

      if (!error) {
        Alert.alert('Success', 'User role updated successfully');
        setShowEditModal(false);
        fetchUsers();
      }
    } catch (error) {
      Alert.alert('Error', 'Failed to update user role');
    }
  };

  const handleResetPassword = async (userId: string, email: string) => {
    Alert.alert(
      'Reset Password',
      `Send password reset email to ${email}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Send',
          onPress: async () => {
            // In production, trigger Supabase password reset
            Alert.alert('Success', 'Password reset email sent!');
          }
        }
      ]
    );
  };

  const getRoleIcon = (roleCode: string) => {
    const role = AVAILABLE_ROLES.find(r => r.code === roleCode);
    return role?.icon || 'account';
  };

  const getRoleColor = (roleCode: string) => {
    const role = AVAILABLE_ROLES.find(r => r.code === roleCode);
    return role?.color || COLORS.gray;
  };

  const renderUserCard = ({ item }: { item: any }) => {
    const roleColor = getRoleColor(item.role_code);
    const roleIcon = getRoleIcon(item.role_code);

    return (
      <TouchableOpacity
        style={[
          styles.userCard,
          !item.is_active && styles.userCardInactive
        ]}
        onPress={() => {
          setSelectedUser(item);
          setShowEditModal(true);
        }}
      >
        {/* Avatar & Info */}
        <View style={styles.userHeader}>
          <View style={[styles.avatar, { backgroundColor: roleColor + '20' }]}>
            <Icon name={roleIcon} size={28} color={roleColor} />
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.userName}>{item.full_name}</Text>
            <Text style={styles.userEmail}>{item.email}</Text>
            {item.phone && (
              <Text style={styles.userPhone}>📞 {item.phone}</Text>
            )}
          </View>
          <View style={[
            styles.statusIndicator,
            { backgroundColor: item.is_active ? COLORS.green : COLORS.red }
          ]} />
        </View>

        {/* Role Badge */}
        <View style={[styles.roleBadge, { backgroundColor: roleColor + '15' }]}>
          <Icon name={roleIcon} size={16} color={roleColor} />
          <Text style={[styles.roleText, { color: roleColor }]}>
            {item.role?.role_name || item.role_code}
          </Text>
        </View>

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: COLORS.blue + '20' }]}
            onPress={() => handleChangeRole(item.id, item.role_code)}
          >
            <Icon name="account-convert" size={16} color={COLORS.blue} />
            <Text style={[styles.quickActionText, { color: COLORS.blue }]}>Change Role</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.quickActionBtn, { backgroundColor: COLORS.orange + '20' }]}
            onPress={() => handleResetPassword(item.id, item.email)}
          >
            <Icon name="lock-reset" size={16} color={COLORS.orange} />
            <Text style={[styles.quickActionText, { color: COLORS.orange }]}>Reset</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.quickActionBtn,
              { backgroundColor: item.is_active ? COLORS.red + '20' : COLORS.green + '20' }
            ]}
            onPress={() => handleToggleUserStatus(item.id, item.is_active)}
          >
            <Icon
              name={item.is_active ? 'account-off' : 'account-check'}
              size={16}
              color={item.is_active ? COLORS.red : COLORS.green}
            />
            <Text style={[
              styles.quickActionText,
              { color: item.is_active ? COLORS.red : COLORS.green }
            ]}>
              {item.is_active ? 'Disable' : 'Enable'}
            </Text>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    );
  };

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
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Icon name="arrow-left" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>User & Role Management</Text>
        <TouchableOpacity onPress={() => setShowCreateModal(true)}>
          <Icon name="account-plus" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Search */}
      <View style={styles.searchContainer}>
        <Icon name="magnify" size={20} color={COLORS.textSecondary} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search users..."
          value={searchTerm}
          onChangeText={setSearchTerm}
          placeholderTextColor={COLORS.textSecondary}
        />
      </View>

      {/* Role Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.filterScroll}
        contentContainerStyle={styles.filterContainer}
      >
        <TouchableOpacity
          style={[styles.filterChip, filterRole === 'all' && styles.filterChipActive]}
          onPress={() => setFilterRole('all')}
        >
          <Text style={[styles.filterChipText, filterRole === 'all' && styles.filterChipTextActive]}>
            All Roles
          </Text>
        </TouchableOpacity>

        {AVAILABLE_ROLES.map((role) => (
          <TouchableOpacity
            key={role.code}
            style={[styles.filterChip, filterRole === role.code && styles.filterChipActive]}
            onPress={() => setFilterRole(role.code)}
          >
            <Icon
              name={role.icon}
              size={16}
              color={filterRole === role.code ? '#fff' : role.color}
            />
            <Text style={[
              styles.filterChipText,
              filterRole === role.code && styles.filterChipTextActive
            ]}>
              {role.name}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Count */}
      <View style={styles.countBar}>
        <Text style={styles.countText}>{users.length} user(s) found</Text>
      </View>

      {/* Users List */}
      <FlatList
        data={users}
        renderItem={renderUserCard}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[COLORS.primary]} />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Icon name="account-off" size={64} color={COLORS.gray} />
            <Text style={styles.emptyTitle}>No Users Found</Text>
            <Text style={styles.emptyText}>
              {searchTerm ? `No users match "${searchTerm}"` : 'No users in this category'}
            </Text>
          </View>
        }
      />

      {/* Create User Modal */}
      <Modal
        visible={showCreateModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowCreateModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Create New User</Text>

            <ScrollView style={styles.modalForm}>
              <Text style={styles.fieldLabel}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={newUser.full_name}
                onChangeText={(text) => setNewUser({ ...newUser, full_name: text })}
                placeholder="John Doe"
                placeholderTextColor={COLORS.textSecondary}
              />

              <Text style={styles.fieldLabel}>Email *</Text>
              <TextInput
                style={styles.input}
                value={newUser.email}
                onChangeText={(text) => setNewUser({ ...newUser, email: text })}
                placeholder="john@example.com"
                keyboardType="email-address"
                autoCapitalize="none"
                placeholderTextColor={COLORS.textSecondary}
              />

              <Text style={styles.fieldLabel}>Phone</Text>
              <TextInput
                style={styles.input}
                value={newUser.phone}
                onChangeText={(text) => setNewUser({ ...newUser, phone: text })}
                placeholder="9876543210"
                keyboardType="phone-pad"
                placeholderTextColor={COLORS.textSecondary}
              />

              <Text style={styles.fieldLabel}>Role *</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleSelector}>
                {AVAILABLE_ROLES.map((role) => (
                  <TouchableOpacity
                    key={role.code}
                    style={[
                      styles.roleOption,
                      newUser.role_code === role.code && { backgroundColor: role.color }
                    ]}
                    onPress={() => setNewUser({ ...newUser, role_code: role.code })}
                  >
                    <Icon
                      name={role.icon}
                      size={20}
                      color={newUser.role_code === role.code ? '#fff' : role.color}
                    />
                    <Text style={[
                      styles.roleOptionText,
                      newUser.role_code === role.code && { color: '#fff' }
                    ]}>
                      {role.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </ScrollView>

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={styles.modalCancelBtn}
                onPress={() => setShowCreateModal(false)}
              >
                <Text style={styles.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.modalSaveBtn}
                onPress={handleCreateUser}
              >
                <Text style={styles.modalSaveText}>Create User</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Edit Role Modal */}
      <Modal
        visible={showEditModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowEditModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Change User Role</Text>
            <Text style={styles.modalSubtitle}>{selectedUser?.full_name}</Text>

            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.roleSelector}>
              {AVAILABLE_ROLES.map((role) => (
                <TouchableOpacity
                  key={role.code}
                  style={[
                    styles.roleOption,
                    selectedUser?.role_code === role.code && { backgroundColor: role.color }
                  ]}
                  onPress={() => handleChangeRole(selectedUser?.id, role.code)}
                >
                  <Icon
                    name={role.icon}
                    size={20}
                    color={selectedUser?.role_code === role.code ? '#fff' : role.color}
                  />
                  <Text style={[
                    styles.roleOptionText,
                    selectedUser?.role_code === role.code && { color: '#fff' }
                  ]}>
                    {role.name}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setShowEditModal(false)}
            >
              <Text style={styles.modalCancelText}>Close</Text>
            </TouchableOpacity>
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
    flex: 1,
    marginLeft: SPACING.md,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    margin: SPACING.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    elevation: 2,
    gap: SPACING.sm,
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  filterScroll: {
    maxHeight: 50,
  },
  filterContainer: {
    paddingHorizontal: SPACING.md,
    gap: SPACING.sm,
  },
  filterChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
    backgroundColor: COLORS.background,
    gap: 4,
  },
  filterChipActive: {
    backgroundColor: COLORS.primary,
  },
  filterChipText: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  filterChipTextActive: {
    color: '#fff',
    fontWeight: 'bold',
  },
  countBar: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    backgroundColor: '#fff',
    marginTop: SPACING.sm,
  },
  countText: {
    fontSize: 12,
    color: COLORS.textSecondary,
  },
  listContent: {
    padding: SPACING.md,
  },
  userCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: SPACING.md,
    marginBottom: SPACING.md,
    elevation: 2,
  },
  userCardInactive: {
    opacity: 0.6,
  },
  userHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.sm,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userInfo: {
    flex: 1,
    marginLeft: SPACING.md,
  },
  userName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
  },
  userEmail: {
    fontSize: 13,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  userPhone: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  statusIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  roleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
    marginBottom: SPACING.sm,
    gap: 4,
  },
  roleText: {
    fontSize: 12,
    fontWeight: '600',
  },
  quickActions: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  quickActionBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.sm,
    borderRadius: 8,
    gap: 4,
  },
  quickActionText: {
    fontSize: 11,
    fontWeight: '600',
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    marginTop: SPACING.lg,
  },
  emptyText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: SPACING.lg,
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 20,
    padding: SPACING.lg,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: COLORS.textPrimary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  modalSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  modalForm: {
    maxHeight: 400,
  },
  fieldLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: COLORS.textSecondary,
    marginTop: SPACING.sm,
    marginBottom: 4,
  },
  input: {
    backgroundColor: COLORS.background,
    borderWidth: 1,
    borderColor: COLORS.gray + '40',
    borderRadius: 8,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    fontSize: 14,
    color: COLORS.textPrimary,
  },
  roleSelector: {
    marginTop: SPACING.sm,
    marginBottom: SPACING.md,
  },
  roleOption: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 12,
    backgroundColor: COLORS.background,
    marginRight: SPACING.sm,
    gap: 4,
  },
  roleOptionText: {
    fontSize: 12,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  modalCancelBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.gray + '20',
    alignItems: 'center',
  },
  modalCancelText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.textPrimary,
  },
  modalSaveBtn: {
    flex: 1,
    padding: SPACING.md,
    borderRadius: 12,
    backgroundColor: COLORS.primary,
    alignItems: 'center',
  },
  modalSaveText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
});

