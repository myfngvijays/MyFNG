'use client';

import React, { useState, useEffect } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Users, Search, UserPlus, Shield, UserX, UserCheck } from 'lucide-react';

const AVAILABLE_ROLES = [
  { code: 'SUPER_ADMIN', name: 'Super Admin', color: 'red' },
  { code: 'SUB_ADMIN', name: 'Sub Admin', color: 'purple' },
  { code: 'LEAD_MANAGER', name: 'Lead Manager', color: 'purple' },
  { code: 'TELECALLER', name: 'Telecaller', color: 'blue' },
  { code: 'WORKSHOP_ADMIN', name: 'Workshop Owner', color: 'orange' },
  { code: 'WORKSHOP_SUPERVISOR', name: 'Workshop Adviser', color: 'indigo' },
  { code: 'WORKSHOP_MECHANIC', name: 'Workshop Mechanic', color: 'teal' },
  { code: 'PICKUP_BOY', name: 'Pickupboy/Driver', color: 'green' },
  { code: 'RSA_MANAGER', name: 'RSA Manager', color: 'red' },
  { code: 'AUDITOR', name: 'Quality Auditor', color: 'indigo' },
  { code: 'DIGITAL_MARKETING', name: 'Digital Marketing', color: 'pink' },
  { code: 'CUSTOMER', name: 'Customer', color: 'gray' },
];

export default function UserManagementPage() {
  const supabase = createClientComponentClient();
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [workshops, setWorkshops] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [managers, setManagers] = useState<any[]>([]);
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

      const { data, error } = await query;
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
      // First, create auth user in Supabase Auth
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: newUser.email,
        password: newUser.password,
        options: {
          data: {
            full_name: newUser.full_name,
            phone: newUser.phone
          }
        }
      });

      if (authError) {
        alert(`Auth error: ${authError.message}`);
        return;
      }

      // Then insert into users_login table
      const { error: insertError } = await supabase
        .from('users_login')
        .insert([{
          id: authData.user?.id,
          full_name: newUser.full_name,
          email: newUser.email,
          phone: newUser.phone,
          role_id: newUser.role_id,
          workshop_id: newUser.workshop_id || null,
          assigned_manager_id: newUser.assigned_manager_id || null,
          department: newUser.department || null,
          is_active: true
        }]);

      if (insertError) {
        alert(`Database error: ${insertError.message}`);
        return;
      }

      alert('User created successfully! Login credentials sent to email.');
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

  const filteredUsers = users.filter((u) =>
    searchTerm === '' ||
    u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    u.phone?.includes(searchTerm)
  );

  const getRoleColor = (roleCode: string) => {
    const role = AVAILABLE_ROLES.find((r) => r.code === roleCode);
    return role?.color || 'gray';
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
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                <Users className="w-6 h-6" />
                User & Role Management
              </h1>
              <p className="text-sm text-gray-600 mt-1">
                Create users, assign roles, and manage access
              </p>
            </div>
            <button 
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
            >
              <UserPlus className="w-4 h-4" />
              Create User
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Filters */}
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Search */}
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                <input
                  type="text"
                  placeholder="Search by name, email, or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>

            {/* Role Filter */}
            <select
              value={filterRole}
              onChange={(e) => setFilterRole(e.target.value)}
              className="px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">All Roles</option>
              {AVAILABLE_ROLES.map((role) => (
                <option key={role.code} value={role.code}>
                  {role.name}
                </option>
              ))}
            </select>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            Showing {filteredUsers.length} user(s)
          </div>
        </div>

        {/* Users Table */}
        <div className="bg-white rounded-lg shadow overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Role
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Joined
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => {
                const roleColor = getRoleColor(user.role_code);
                return (
                  <tr key={user.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className={`w-10 h-10 rounded-full bg-${roleColor}-100 flex items-center justify-center`}>
                          <span className={`text-${roleColor}-600 font-bold text-lg`}>
                            {user.full_name?.charAt(0).toUpperCase() || '?'}
                          </span>
                        </div>
                        <div className="ml-4">
                          <div className="font-medium text-gray-900">{user.full_name}</div>
                          <div className="text-sm text-gray-500">ID: {user.id.substring(0, 8)}...</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm">
                        <div className="text-gray-900">{user.email}</div>
                        <div className="text-gray-500">{user.phone || 'N/A'}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-${roleColor}-100 text-${roleColor}-800`}>
                        {user.role?.role_name || user.role_code}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span
                        className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                          user.is_active
                            ? 'bg-green-100 text-green-800'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {user.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {new Date(user.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium space-x-2">
                      <button className="text-blue-600 hover:text-blue-900">
                        Change Role
                      </button>
                      <button className="text-orange-600 hover:text-orange-900">
                        Reset Password
                      </button>
                      {user.is_active ? (
                        <button
                          onClick={() => handleToggleStatus(user.id, user.is_active)}
                          className="text-red-600 hover:text-red-900"
                        >
                          Disable
                        </button>
                      ) : (
                        <button
                          onClick={() => handleToggleStatus(user.id, user.is_active)}
                          className="text-green-600 hover:text-green-900"
                        >
                          Enable
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {filteredUsers.length === 0 && (
            <div className="text-center py-12">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-500 text-lg">No users found</p>
              <p className="text-gray-400 text-sm mt-2">
                {searchTerm ? `No results for "${searchTerm}"` : 'Try adjusting your filters'}
              </p>
            </div>
          )}
        </div>

        {/* Add User Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <h3 className="text-xl font-bold mb-4">Create New User</h3>
              
              <div className="space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    value={newUser.full_name}
                    onChange={(e) => setNewUser({ ...newUser, full_name: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Enter full name"
                  />
                </div>

                {/* Email & Phone */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Email *
                    </label>
                    <input
                      type="email"
                      value={newUser.email}
                      onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="user@example.com"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Phone *
                    </label>
                    <input
                      type="tel"
                      value={newUser.phone}
                      onChange={(e) => setNewUser({ ...newUser, phone: e.target.value })}
                      className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                      placeholder="10-digit phone"
                    />
                  </div>
                </div>

                {/* Password */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Password *
                  </label>
                  <input
                    type="password"
                    value={newUser.password}
                    onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="Minimum 6 characters"
                  />
                  <p className="text-xs text-gray-500 mt-1">User will receive login credentials via email</p>
                </div>

                {/* Role Selection */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
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
                    className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
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
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Workshop Assignment *
                      </label>
                      <select
                        value={newUser.workshop_id}
                        onChange={(e) => setNewUser({ ...newUser, workshop_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white"
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
                    <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Department *
                      </label>
                      <select
                        value={newUser.department}
                        onChange={(e) => setNewUser({ ...newUser, department: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white"
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
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Team Manager Assignment *
                      </label>
                      <select
                        value={newUser.assigned_manager_id}
                        onChange={(e) => setNewUser({ ...newUser, assigned_manager_id: e.target.value })}
                        className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
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
              <div className="flex gap-3 mt-6">
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
                  className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
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
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed"
                >
                  Create User
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
