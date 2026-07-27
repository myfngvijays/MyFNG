'use client';

import React, { useMemo, useState, useEffect } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { Users, Search, UserPlus, UserX, UserCheck, Filter, X, ArrowUpDown } from 'lucide-react';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';
import { formatDateDMY } from '@/lib/utils';

const ROLE_STYLES: Record<string, { badge: string; avatar: string }> = {
  SUPER_ADMIN: { badge: 'bg-red-100 text-red-800', avatar: 'bg-red-100 text-red-600' },
  SUB_ADMIN: { badge: 'bg-purple-100 text-purple-800', avatar: 'bg-purple-100 text-purple-600' },
  LEAD_MANAGER: { badge: 'bg-purple-100 text-purple-800', avatar: 'bg-purple-100 text-purple-600' },
  TELECALLER: { badge: 'bg-blue-100 text-blue-800', avatar: 'bg-blue-100 text-blue-600' },
  WORKSHOP_ADMIN: { badge: 'bg-orange-100 text-orange-800', avatar: 'bg-orange-100 text-orange-600' },
  WORKSHOP_SUPERVISOR: { badge: 'bg-indigo-100 text-indigo-800', avatar: 'bg-indigo-100 text-indigo-600' },
  WORKSHOP_MECHANIC: { badge: 'bg-teal-100 text-teal-800', avatar: 'bg-teal-100 text-teal-600' },
  PICKUP_BOY: { badge: 'bg-green-100 text-green-800', avatar: 'bg-green-100 text-green-600' },
  RSA_MANAGER: { badge: 'bg-rose-100 text-rose-800', avatar: 'bg-rose-100 text-rose-600' },
  AUDITOR: { badge: 'bg-indigo-100 text-indigo-800', avatar: 'bg-indigo-100 text-indigo-600' },
  DIGITAL_MARKETING: { badge: 'bg-pink-100 text-pink-800', avatar: 'bg-pink-100 text-pink-600' },
  DIGITAL_AUTHOR: { badge: 'bg-violet-100 text-violet-800', avatar: 'bg-violet-100 text-violet-600' },
  CUSTOMER: { badge: 'bg-gray-100 text-gray-800', avatar: 'bg-gray-100 text-gray-600' },
  CSE: { badge: 'bg-cyan-100 text-cyan-800', avatar: 'bg-cyan-100 text-cyan-600' },
};

const DEFAULT_ROLE_STYLE = { badge: 'bg-slate-100 text-slate-800', avatar: 'bg-slate-100 text-slate-600' };

function getRoleStyle(roleCode?: string) {
  return ROLE_STYLES[String(roleCode || '').toUpperCase()] || DEFAULT_ROLE_STYLE;
}

export default function UserManagementPage() {
  const supabase = getBrowserClient();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'name'>('newest');
  const [showAddModal, setShowAddModal] = useState(false);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
  const [showRoleModal, setShowRoleModal] = useState(false);
  const [roleUser, setRoleUser] = useState<any>(null);
  const [roleForm, setRoleForm] = useState({
    role_id: '',
    workshop_id: '',
    assigned_manager_id: '',
    department: ''
  });
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordUser, setPasswordUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [savingAction, setSavingAction] = useState(false);
  const [newUser, setNewUser] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
    workshop_id: '',
    assigned_manager_id: '',
    department: ''
  });

  useEffect(() => {
    fetchUsers();
    fetchWorkshops();
    fetchRoles();
    fetchManagers();
  }, []);

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users_login')
        .select('*, role:roles!role_id(role_name, role_code)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchWorkshops = async () => {
    try {
      const { data, error } = await supabase
        .from('workshops')
        .select('id, name, city')
        .eq('is_verified', true)
        .order('name');
      
      if (!error) {
        setWorkshops(data || []);
      }
    } catch (error) {
      console.error('Error fetching workshops:', error);
    }
  };

  const fetchRoles = async () => {
    try {
      const { data, error } = await supabase
        .from('roles')
        .select('id, role_name, role_code')
        .order('role_name');
      
      if (!error) {
        setRoles(data || []);
      }
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const fetchManagers = async () => {
    try {
      // Fetch users who can be team managers (LEAD_MANAGER, SUPER_ADMIN)
      const { data, error } = await supabase
        .from('users_login')
        .select('id, full_name, email, role:roles!role_id(role_name, role_code)')
        .in('role_id', (
          await supabase
            .from('roles')
            .select('id')
            .in('role_code', ['LEAD_MANAGER', 'SUPER_ADMIN'])
        ).data?.map(r => r.id) || [])
        .eq('is_active', true)
        .order('full_name');
      
      if (!error) {
        setManagers(data || []);
      }
    } catch (error) {
      console.error('Error fetching managers:', error);
    }
  };

  const openRoleModal = (user: any) => {
    setRoleUser(user);
    setRoleForm({
      role_id: user?.role_id || '',
      workshop_id: user?.workshop_id || '',
      assigned_manager_id: user?.assigned_manager_id || '',
      department: user?.department || ''
    });
    setShowRoleModal(true);
  };

  const handleChangeRole = async () => {
    if (!roleUser?.id) return;
    if (!roleForm.role_id) {
      alert('Please select a role');
      return;
    }

    const selectedRole = roles.find(r => r.id === roleForm.role_id);
    const roleCode = selectedRole?.role_code;

    const needsWorkshop = roleCode?.startsWith('WORKSHOP_') || roleCode === 'PICKUP_BOY';
    const needsManager = roleCode === 'TELECALLER';
    const needsDepartment = roleCode === 'SUB_ADMIN';

    if (needsWorkshop && !roleForm.workshop_id) {
      alert('Please select a workshop for this role');
      return;
    }
    if (needsManager && !roleForm.assigned_manager_id) {
      alert('Please select a team manager for this role');
      return;
    }
    if (needsDepartment && !roleForm.department) {
      alert('Please select a department for this role');
      return;
    }

    setSavingAction(true);
    try {
      const res = await fetch(`/api/admin/users/${roleUser.id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: roleForm.role_id,
          workshop_id: roleForm.workshop_id || null,
          assigned_manager_id: roleForm.assigned_manager_id || null,
          department: roleForm.department || null,
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        alert(`Error: ${json.error || 'Failed to change role'}`);
        return;
      }

      alert('Role updated successfully!');
      setShowRoleModal(false);
      setRoleUser(null);
      fetchUsers();
    } catch (e: any) {
      console.error('Error changing role:', e);
      alert(`Failed to change role: ${e.message || 'Unknown error'}`);
    } finally {
      setSavingAction(false);
    }
  };

  const openPasswordModal = (user: any) => {
    setPasswordUser(user);
    setNewPassword('');
    setShowPasswordModal(true);
  };

  const handleResetPassword = async () => {
    if (!passwordUser?.id) return;
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters');
      return;
    }

    setSavingAction(true);
    try {
      const res = await fetch(`/api/admin/users/${passwordUser.id}/reset-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: newPassword }),
      });
      const json = await res.json();
      if (!res.ok) {
        alert(`Error: ${json.error || 'Failed to reset password'}`);
        return;
      }

      alert('Password reset successfully!');
      setShowPasswordModal(false);
      setPasswordUser(null);
      setNewPassword('');
    } catch (e: any) {
      console.error('Error resetting password:', e);
      alert(`Failed to reset password: ${e.message || 'Unknown error'}`);
    } finally {
      setSavingAction(false);
    }
  };

  const handleAddUser = async () => {
    // Validate required fields
    if (!newUser.full_name || !newUser.email || !newUser.phone || !newUser.password || !newUser.role_id) {
      alert('Please fill all required fields');
      return;
    }

    // Get selected role to check if workshop or manager is needed
    const selectedRole = roles.find(r => r.id === newUser.role_id);
    const roleCode = selectedRole?.role_code;
    
    // Check if workshop is required for this role (only Workshop Admin)
    const workshopRequiredRoles = ['WORKSHOP_ADMIN'];
    if (workshopRequiredRoles.includes(roleCode) && !newUser.workshop_id) {
      alert('Please select a workshop for Workshop Admin');
      return;
    }

    // Check if team manager is required for this role
    const managerRequiredRoles = ['TELECALLER'];
    if (managerRequiredRoles.includes(roleCode) && !newUser.assigned_manager_id) {
      alert('Please select a team manager for Telecaller');
      return;
    }

    // Check if department is required for SUB_ADMIN
    if (roleCode === 'SUB_ADMIN' && !newUser.department) {
      alert('Please select a department for Sub Admin');
      return;
    }

    try {
      // Use server-side API route to create user (bypasses email confirmation)
      const response = await fetch('/api/admin/create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          full_name: newUser.full_name,
          email: newUser.email,
          phone: newUser.phone,
          password: newUser.password,
          role_id: newUser.role_id,
          workshop_id: newUser.workshop_id || null,
          assigned_manager_id: newUser.assigned_manager_id || null,
          department: newUser.department || null,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        alert(`Error: ${result.error || 'Failed to create user'}`);
        return;
      }

      alert('User created successfully! User can login immediately.');
      setShowAddModal(false);
      setNewUser({
        full_name: '',
        email: '',
        phone: '',
        password: '',
        role_id: '',
        workshop_id: '',
        assigned_manager_id: '',
        department: ''
      });
      fetchUsers();
    } catch (error: any) {
      console.error('Error creating user:', error);
      alert(`Failed to create user: ${error.message}`);
    }
  };

  const handleToggleStatus = async (userId: string, currentStatus: boolean) => {
    if (!confirm(`${currentStatus ? 'Disable' : 'Enable'} this user?`)) return;

    try {
      const { error } = await supabase
        .from('users_login')
        .update({ is_active: !currentStatus })
        .eq('id', userId);

      if (!error) {
        alert(`User ${currentStatus ? 'disabled' : 'enabled'} successfully!`);
        fetchUsers();
      }
    } catch (error) {
      alert('Failed to update user status');
    }
  };

  const roleStats = useMemo(() => {
    const map = new Map<string, { code: string; name: string; count: number; active: number }>();
    for (const u of users) {
      const code = u.role?.role_code || 'UNKNOWN';
      const name = u.role?.role_name || 'Unknown';
      const cur = map.get(code) || { code, name, count: 0, active: 0 };
      cur.count += 1;
      if (u.is_active) cur.active += 1;
      map.set(code, cur);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [users]);

  const summary = useMemo(() => {
    const active = users.filter((u) => u.is_active).length;
    return { total: users.length, active, inactive: users.length - active };
  }, [users]);

  const filteredUsers = useMemo(() => {
    let list = [...users];
    if (filterRole !== 'all') {
      list = list.filter((u) => u.role?.role_code === filterRole);
    }
    if (filterStatus === 'active') list = list.filter((u) => u.is_active);
    if (filterStatus === 'inactive') list = list.filter((u) => !u.is_active);
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase();
      list = list.filter(
        (u) =>
          u.full_name?.toLowerCase().includes(q) ||
          u.email?.toLowerCase().includes(q) ||
          String(u.phone || '').includes(searchTerm.trim()) ||
          u.role?.role_name?.toLowerCase().includes(q),
      );
    }
    list.sort((a, b) => {
      if (sortBy === 'name') return String(a.full_name || '').localeCompare(String(b.full_name || ''));
      const ta = new Date(a.created_at || 0).getTime();
      const tb = new Date(b.created_at || 0).getTime();
      return sortBy === 'oldest' ? ta - tb : tb - ta;
    });
    return list;
  }, [users, filterRole, filterStatus, searchTerm, sortBy]);

  const hasActiveFilters = filterRole !== 'all' || filterStatus !== 'all' || searchTerm.trim() !== '';

  const clearFilters = () => {
    setSearchTerm('');
    setFilterRole('all');
    setFilterStatus('all');
    setSortBy('newest');
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading users...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                <Users className="w-5 h-5 sm:w-5.5 sm:h-5.5 md:w-6 md:h-6 flex-shrink-0" />
                <span className="truncate">User & Role Management</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                Create users, assign roles, and manage access
              </p>
            </div>
            <div className="flex gap-2 sm:gap-3 w-full sm:w-auto">
              <AdminPageRefresh onClick={() => void fetchUsers()} loading={loading} />
              <button
                onClick={() => setShowAddModal(true)}
                className="px-3 sm:px-4 py-1.5 sm:py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base whitespace-nowrap w-full sm:w-auto justify-center"
              >
              <UserPlus className="w-4 h-4 flex-shrink-0" />
              <span className="hidden sm:inline">Create User</span>
              <span className="sm:hidden">Create</span>
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* Summary */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
            <p className="text-xs text-gray-500">Total Users</p>
            <p className="text-2xl font-bold text-gray-900">{summary.total}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-green-500">
            <p className="text-xs text-gray-500">Active</p>
            <p className="text-2xl font-bold text-green-600">{summary.active}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-red-500">
            <p className="text-xs text-gray-500">Inactive</p>
            <p className="text-2xl font-bold text-red-600">{summary.inactive}</p>
          </div>
          <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
            <p className="text-xs text-gray-500">Roles Used</p>
            <p className="text-2xl font-bold text-purple-600">{roleStats.length}</p>
          </div>
        </div>

        {/* Role breakdown */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <h2 className="text-sm font-semibold text-gray-900">Users by Role</h2>
            <span className="text-xs text-gray-500">Click a role to filter</span>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setFilterRole('all')}
              className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                filterRole === 'all' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100'
              }`}
            >
              All ({summary.total})
            </button>
            {roleStats.map((r) => {
              const style = getRoleStyle(r.code);
              const selected = filterRole === r.code;
              return (
                <button
                  key={r.code}
                  type="button"
                  onClick={() => setFilterRole(selected ? 'all' : r.code)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border transition ${
                    selected ? 'bg-blue-600 text-white border-blue-600' : `${style.badge} border-transparent hover:opacity-90`
                  }`}
                >
                  {r.name} · {r.count}
                  {!selected ? <span className="opacity-70"> ({r.active} active)</span> : null}
                </button>
              );
            })}
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="w-4 h-4 text-gray-500" />
            <h2 className="text-sm font-semibold text-gray-900">Filters</h2>
            {hasActiveFilters ? (
              <button type="button" onClick={clearFilters} className="ml-auto text-xs text-blue-600 hover:underline inline-flex items-center gap-1">
                <X className="w-3 h-3" /> Clear all
              </button>
            ) : null}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="sm:col-span-2 lg:col-span-1">
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Search</label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Name, email, phone, role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Role</label>
              <select
                value={filterRole}
                onChange={(e) => setFilterRole(e.target.value)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Roles ({summary.total})</option>
                {roles.map((role) => {
                  const stat = roleStats.find((r) => r.code === role.role_code);
                  return (
                    <option key={role.id} value={role.role_code}>
                      {role.role_name} {stat ? `(${stat.count})` : '(0)'}
                    </option>
                  );
                })}
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1">Status</label>
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as 'all' | 'active' | 'inactive')}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                <option value="active">Active only ({summary.active})</option>
                <option value="inactive">Inactive only ({summary.inactive})</option>
              </select>
            </div>
            <div>
              <label className="block text-[11px] font-medium text-gray-500 mb-1 inline-flex items-center gap-1">
                <ArrowUpDown className="w-3 h-3" /> Sort
              </label>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'newest' | 'oldest' | 'name')}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500"
              >
                <option value="newest">Newest first</option>
                <option value="oldest">Oldest first</option>
                <option value="name">Name A–Z</option>
              </select>
            </div>
          </div>

          <div className="mt-3 pt-3 border-t border-gray-100 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs sm:text-sm text-gray-600">
            <span>
              Showing <strong className="text-gray-900">{filteredUsers.length}</strong> of {summary.total} users
            </span>
            {filterRole !== 'all' ? (
              <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full">Role: {roles.find((r) => r.role_code === filterRole)?.role_name || filterRole}</span>
            ) : null}
            {filterStatus !== 'all' ? (
              <span className="px-2 py-0.5 bg-green-50 text-green-700 rounded-full">Status: {filterStatus}</span>
            ) : null}
            {searchTerm.trim() ? (
              <span className="px-2 py-0.5 bg-amber-50 text-amber-800 rounded-full">Search: &quot;{searchTerm.trim()}&quot;</span>
            ) : null}
          </div>
        </div>

        {/* Users Table - Desktop */}
        <div className="bg-white rounded-lg shadow overflow-hidden hidden lg:block">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    User
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Contact
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Role
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Joined
                  </th>
                  <th className="px-4 md:px-6 py-2 md:py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user) => {
                  const roleStyle = getRoleStyle(user.role?.role_code || user.role_code);
                  return (
                    <tr key={user.id} className="hover:bg-gray-50">
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 sm:w-9 sm:h-9 md:w-10 md:h-10 rounded-full flex items-center justify-center flex-shrink-0 ${roleStyle.avatar}`}>
                            <span className="font-bold text-sm sm:text-base md:text-lg">
                              {user.full_name?.charAt(0).toUpperCase() || '?'}
                            </span>
                          </div>
                          <div className="ml-3 sm:ml-4 min-w-0">
                            <div className="font-medium text-sm sm:text-base text-gray-900 truncate">{user.full_name}</div>
                            <div className="text-xs sm:text-sm text-gray-500 truncate">ID: {user.id.substring(0, 8)}...</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <div className="text-xs sm:text-sm">
                          <div className="text-gray-900 truncate max-w-[200px]">{user.email}</div>
                          <div className="text-gray-500 truncate">{user.phone || 'N/A'}</div>
                        </div>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <span className={`px-2 sm:px-3 py-0.5 sm:py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${roleStyle.badge}`}>
                          {user.role?.role_name || user.role?.role_code || user.role_code}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4">
                        <span
                          className={`px-2 py-0.5 sm:py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                            user.is_active
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {user.is_active ? 'Active' : 'Inactive'}
                        </span>
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-xs sm:text-sm text-gray-500">
                        {formatDateDMY(user.created_at)}
                      </td>
                      <td className="px-4 md:px-6 py-3 md:py-4 text-right text-xs sm:text-sm font-medium">
                        <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1 sm:gap-2">
                          <button
                            onClick={() => openRoleModal(user)}
                            className="text-blue-600 hover:text-blue-900 whitespace-nowrap"
                          >
                            Change Role
                          </button>
                          <button
                            onClick={() => openPasswordModal(user)}
                            className="text-orange-600 hover:text-orange-900 whitespace-nowrap"
                          >
                            Reset Password
                          </button>
                          {user.is_active ? (
                            <button
                              onClick={() => handleToggleStatus(user.id, user.is_active)}
                              className="text-red-600 hover:text-red-900 whitespace-nowrap"
                            >
                              Disable
                            </button>
                          ) : (
                            <button
                              onClick={() => handleToggleStatus(user.id, user.is_active)}
                              className="text-green-600 hover:text-green-900 whitespace-nowrap"
                            >
                              Enable
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 sm:py-10 md:py-12">
              <Users className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No users found</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">
                {searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your filters'}
              </p>
            </div>
          )}
        </div>

        {/* Users Cards - Mobile/Tablet */}
        <div className="lg:hidden space-y-3 sm:space-y-4">
          {filteredUsers.map((user) => {
            const roleStyle = getRoleStyle(user.role?.role_code || user.role_code);
            return (
              <div key={user.id} className="bg-white rounded-lg shadow p-3 sm:p-4 border border-gray-100">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center flex-shrink-0 ${roleStyle.avatar}`}>
                      <span className="font-bold text-base sm:text-lg">
                        {user.full_name?.charAt(0).toUpperCase() || '?'}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="font-medium text-sm sm:text-base text-gray-900 truncate">{user.full_name}</div>
                      <div className="text-xs text-gray-500 truncate">{user.email}</div>
                    </div>
                  </div>
                  <span
                    className={`px-2 py-1 inline-flex text-xs font-semibold rounded-full flex-shrink-0 ${
                      user.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {user.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                
                <div className="space-y-2 mb-3">
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-500">Phone:</span>
                    <span className="text-gray-900">{user.phone || 'N/A'}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-500">Role:</span>
                    <span className={`px-2 py-0.5 inline-flex text-xs font-semibold rounded-full ${roleStyle.badge}`}>
                      {user.role?.role_name || user.role?.role_code || user.role_code}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs sm:text-sm">
                    <span className="text-gray-500">Joined:</span>
                    <span className="text-gray-900">{formatDateDMY(user.created_at)}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2 pt-3 border-t border-gray-100">
                  <button
                    onClick={() => openRoleModal(user)}
                    className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-blue-600 hover:text-blue-900 border border-blue-200 rounded-lg hover:bg-blue-50"
                  >
                    Change Role
                  </button>
                  <button
                    onClick={() => openPasswordModal(user)}
                    className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-orange-600 hover:text-orange-900 border border-orange-200 rounded-lg hover:bg-orange-50"
                  >
                    Reset Password
                  </button>
                  {user.is_active ? (
                    <button
                      onClick={() => handleToggleStatus(user.id, user.is_active)}
                      className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-red-600 hover:text-red-900 border border-red-200 rounded-lg hover:bg-red-50"
                    >
                      Disable
                    </button>
                  ) : (
                    <button
                      onClick={() => handleToggleStatus(user.id, user.is_active)}
                      className="flex-1 sm:flex-none px-3 py-1.5 text-xs sm:text-sm text-green-600 hover:text-green-900 border border-green-200 rounded-lg hover:bg-green-50"
                    >
                      Enable
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {filteredUsers.length === 0 && (
            <div className="text-center py-8 sm:py-10 md:py-12 bg-white rounded-lg shadow">
              <Users className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
              <p className="text-gray-500 text-base sm:text-lg">No users found</p>
              <p className="text-gray-400 text-xs sm:text-sm mt-1 sm:mt-2">
                {searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your filters'}
              </p>
            </div>
          )}
        </div>

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Create New User</h3>
              
              <div className="space-y-3 sm:space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter full name"
                  />
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="user@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="10-digit phone"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Minimum 6 characters"
                  />
                  <p className="text-xs text-gray-500 mt-1">User will receive login credentials via email</p>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={newUser.role_id}
                    onChange={(e) => {
                    setNewUser({ 
                      ...newUser, 
                      role_id: e.target.value, 
                      workshop_id: '',
                      assigned_manager_id: '',
                      department: ''
                    });
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Workshop Selection - Conditional (Only for Workshop Admin) */}
                {newUser.role_id && (() => {
                  const selectedRole = roles.find(r => r.id === newUser.role_id);
                  const workshopRequiredRoles = ['WORKSHOP_ADMIN'];
                  const needsWorkshop = selectedRole && workshopRequiredRoles.includes(selectedRole.role_code);
                  
                  if (!needsWorkshop) return null;
                  
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Workshop Assignment *
                      </label>
                      <select
                        value={newUser.workshop_id}
                        onChange={(e) => setNewUser({ ...newUser, workshop_id: e.target.value })}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">Select Workshop</option>
                        {workshops.map((workshop) => (
                          <option key={workshop.id} value={workshop.id}>
                            {workshop.name} - {workshop.city}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-blue-600 mt-1">
                        ⚠️ Workshop Admin must be assigned to a workshop
                      </p>
                    </div>
                  );
                })()}

                {/* Department Selection - Conditional for SUB_ADMIN */}
                {newUser.role_id && (() => {
                  const selectedRole = roles.find(r => r.id === newUser.role_id);
                  const needsDepartment = selectedRole && selectedRole.role_code === 'SUB_ADMIN';
                  
                  if (!needsDepartment) return null;
                  
                  return (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Department *
                      </label>
                      <select
                        value={newUser.department}
                        onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                      >
                        <option value="">Select Department</option>
                        <option value="CSE">CSE - Customer Service Manager</option>
                        <option value="TELECALLER">TELECALLER - Telecalling Manager</option>
                        <option value="AUDITOR">AUDITOR - Audit Manager</option>
                      </select>
                      <p className="text-xs text-purple-600 mt-1">
                        ⚠️ Sub Admin must be assigned to a department
                      </p>
                    </div>
                  );
                })()}

                {/* Team Manager Selection - Conditional for Telecaller */}
                {newUser.role_id && (() => {
                  const selectedRole = roles.find(r => r.id === newUser.role_id);
                  const managerRequiredRoles = ['TELECALLER'];
                  const needsManager = selectedRole && managerRequiredRoles.includes(selectedRole.role_code);
                  
                  if (!needsManager) return null;
                  
                  return (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Team Manager Assignment *
                      </label>
                      <select
                        value={newUser.assigned_manager_id}
                        onChange={(e) => setNewUser({ ...newUser, assigned_manager_id: e.target.value })}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                      >
                        <option value="">Select Team Manager</option>
                        {managers.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.full_name} - {manager.role?.role_name}
                          </option>
                        ))}
                      </select>
                      <p className="text-xs text-green-600 mt-1">
                        ⚠️ Telecaller must be assigned to a Team Manager (Lead Manager or Super Admin)
                      </p>
                      {managers.length === 0 && (
                        <p className="text-xs text-red-600 mt-1">
                          ⚠️ No managers available. Please create a Lead Manager first.
                        </p>
                      )}
                    </div>
                  );
                })()}
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6">
                <button
                  onClick={() => {
                    setShowAddModal(false);
                    setNewUser({
                      full_name: '',
                      email: '',
                      phone: '',
                      password: '',
                      role_id: '',
                      workshop_id: '',
                      assigned_manager_id: '',
                      department: ''
                    });
                  }}
                  className="flex-1 px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddUser}
                  disabled={!newUser.full_name || !newUser.email || !newUser.phone || !newUser.password || !newUser.role_id || (() => {
                    const selectedRole = roles.find(r => r.id === newUser.role_id);
                    if (selectedRole?.role_code === 'SUB_ADMIN' && !newUser.department) return true;
                    if (selectedRole?.role_code === 'WORKSHOP_ADMIN' && !newUser.workshop_id) return true;
                    if (selectedRole?.role_code === 'TELECALLER' && !newUser.assigned_manager_id) return true;
                    return false;
                  })()}
                  className="flex-1 px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Create User
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Change Role Modal */}
        {showRoleModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 max-w-lg w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Change Role</h3>

              <div className="space-y-3 sm:space-y-4">
                <div className="bg-gray-50 border rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900">{roleUser?.full_name}</div>
                  <div className="text-xs text-gray-600">{roleUser?.email}</div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Role *
                  </label>
                  <select
                    value={roleForm.role_id}
                    onChange={(e) => {
                      const nextRoleId = e.target.value;
                      setRoleForm({
                        role_id: nextRoleId,
                        workshop_id: '',
                        assigned_manager_id: '',
                        department: ''
                      });
                    }}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select Role</option>
                    {roles.map((role) => (
                      <option key={role.id} value={role.id}>
                        {role.role_name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Workshop Selection - for workshop roles */}
                {(() => {
                  const selectedRole = roles.find(r => r.id === roleForm.role_id);
                  const roleCode = selectedRole?.role_code;
                  const needsWorkshop = roleCode?.startsWith('WORKSHOP_') || roleCode === 'PICKUP_BOY';
                  if (!needsWorkshop) return null;
                  return (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 sm:p-4">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Workshop *
                      </label>
                      <select
                        value={roleForm.workshop_id}
                        onChange={(e) => setRoleForm({ ...roleForm, workshop_id: e.target.value })}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
                      >
                        <option value="">Select Workshop</option>
                        {workshops.map((workshop) => (
                          <option key={workshop.id} value={workshop.id}>
                            {workshop.name} - {workshop.city}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}

                {/* Department Selection - for SUB_ADMIN */}
                {(() => {
                  const selectedRole = roles.find(r => r.id === roleForm.role_id);
                  const roleCode = selectedRole?.role_code;
                  if (roleCode !== 'SUB_ADMIN') return null;
                  return (
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-3 sm:p-4">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Department *
                      </label>
                      <select
                        value={roleForm.department}
                        onChange={(e) => setRoleForm({ ...roleForm, department: e.target.value })}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
                      >
                        <option value="">Select Department</option>
                        <option value="CSE">CSE - Customer Service Manager</option>
                        <option value="TELECALLER">TELECALLER - Telecalling Manager</option>
                        <option value="AUDITOR">AUDITOR - Audit Manager</option>
                      </select>
                    </div>
                  );
                })()}

                {/* Team Manager Selection - for TELECALLER */}
                {(() => {
                  const selectedRole = roles.find(r => r.id === roleForm.role_id);
                  const roleCode = selectedRole?.role_code;
                  if (roleCode !== 'TELECALLER') return null;
                  return (
                    <div className="bg-green-50 border border-green-200 rounded-lg p-3 sm:p-4">
                      <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                        Team Manager *
                      </label>
                      <select
                        value={roleForm.assigned_manager_id}
                        onChange={(e) => setRoleForm({ ...roleForm, assigned_manager_id: e.target.value })}
                        className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                      >
                        <option value="">Select Team Manager</option>
                        {managers.map((manager) => (
                          <option key={manager.id} value={manager.id}>
                            {manager.full_name} - {manager.role?.role_name}
                          </option>
                        ))}
                      </select>
                    </div>
                  );
                })()}
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6">
                <button
                  onClick={() => {
                    setShowRoleModal(false);
                    setRoleUser(null);
                  }}
                  disabled={savingAction}
                  className="flex-1 px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleChangeRole}
                  disabled={savingAction}
                  className="flex-1 px-4 py-2 text-sm sm:text-base bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {savingAction ? 'Updating...' : 'Update Role'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Reset Password Modal */}
        {showPasswordModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg p-4 sm:p-5 md:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4">Reset Password</h3>

              <div className="space-y-3 sm:space-y-4">
                <div className="bg-gray-50 border rounded-lg p-3">
                  <div className="text-sm font-medium text-gray-900">{passwordUser?.full_name}</div>
                  <div className="text-xs text-gray-600">{passwordUser?.email}</div>
                </div>

                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    New Password *
                  </label>
                  <input
                    type="password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-3 py-2 text-sm border rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                    placeholder="Minimum 6 characters"
                  />
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6">
                <button
                  onClick={() => {
                    setShowPasswordModal(false);
                    setPasswordUser(null);
                    setNewPassword('');
                  }}
                  disabled={savingAction}
                  className="flex-1 px-4 py-2 text-sm sm:text-base border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  onClick={handleResetPassword}
                  disabled={savingAction}
                  className="flex-1 px-4 py-2 text-sm sm:text-base bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  {savingAction ? 'Resetting...' : 'Reset Password'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
