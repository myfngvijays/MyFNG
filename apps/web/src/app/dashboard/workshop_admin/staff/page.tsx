'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { Users, Plus, Edit, Mail, Phone, CheckCircle, XCircle, Trash2, Key, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { formatDateTime } from "@/lib/utils";
import {
  WorkshopPageHeader,
  WorkshopPageShell,
  WorkshopStatTile,
  WorkshopEmpty,
  WorkshopStatusPill,
} from '@/components/workshop/WorkshopUi';

export default function WorkshopStaffPage() {
  const [staff, setStaff] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [workshopInfo, setWorkshopInfo] = useState<any>(null);
  const [currentUserId, setCurrentUserId] = useState<string>('');
  const [availableRoles, setAvailableRoles] = useState<any[]>([]);
  const [showModal, setShowModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordResetUser, setPasswordResetUser] = useState<any>(null);
  const [newPassword, setNewPassword] = useState('');
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    phone: '',
    password: '',
    role_id: '',
    department: '',
    is_active: true
  });

  useEffect(() => {
    fetchStaff();
  }, []);

  async function fetchStaff() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      setCurrentUserId(user.id);

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('workshop_id')
        .eq('email', user.email)
        .single();

      const workshopId = userProfile?.workshop_id;
      if (!workshopId) {
        setLoading(false);
        return;
      }

      // Fetch workshop info
      const { data: workshop } = await supabase
        .from('workshops')
        .select('*')
        .eq('id', workshopId)
        .single();

      setWorkshopInfo(workshop);

      // Fetch manageable roles (exclude Workshop Admin and non-workshop roles)
      const { data: rolesData } = await supabase
        .from('roles')
        .select('*')
        .in('role_code', ['WORKSHOP_SUPERVISOR', 'WORKSHOP_MECHANIC', 'WORKSHOP_PICKUP_BOY'])
        .eq('is_active', true)
        .order('role_name');

      setAvailableRoles(rolesData || []);

      // Fetch all staff in this workshop (excluding current user for management)
      const { data: staffData } = await supabase
        .from('users_login')
        .select(`
          *,
          role_id:roles(id, role_name, role_code)
        `)
        .eq('workshop_id', workshopId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      setStaff(staffData || []);
      setLoading(false);
    } catch (error) {
      console.error('Error fetching staff:', error);
      setLoading(false);
    }
  }

  async function toggleStaffStatus(staffId: string, currentStatus: boolean) {
    // Prevent admin from managing themselves
    if (staffId === currentUserId) {
      alert('You cannot change your own status');
      return;
    }

    const supabase = createClient();
    
    const { error } = await supabase
      .from('users_login')
      .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
      .eq('id', staffId);

    if (!error) {
      fetchStaff();
    }
  }

  function handleOpenCreate() {
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
    setShowModal(true);
  }

  function handleOpenEdit(member: any) {
    // Prevent admin from editing themselves
    if (member.id === currentUserId) {
      alert('You cannot edit your own account from here');
      return;
    }

    // Prevent editing other workshop admins
    if (member.role_id?.role_code === 'WORKSHOP_ADMIN') {
      alert('You cannot manage other workshop admins');
      return;
    }

    setSelectedStaff(member);
    setFormData({
      full_name: member.full_name || '',
      email: member.email || '',
      phone: member.phone || '',
      password: '',
      role_id: member.role_id?.id || '',
      department: member.department || '',
      is_active: member.is_active
    });
    setShowModal(true);
  }

  async function handleSaveStaff() {
    setSaving(true);
    const supabase = createClient();

    try {
      // Validate required fields
      if (!formData.full_name || !formData.email || !formData.role_id) {
        alert('Please fill in all required fields (Name, Email, Role)');
        setSaving(false);
        return;
      }

      if (!selectedStaff && !formData.password) {
        alert('Password is required for new staff members');
        setSaving(false);
        return;
      }

      if (selectedStaff) {
        // Update existing staff
        const updateData: any = {
          full_name: formData.full_name,
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

        if (error) {
          console.error('Error updating staff:', error);
          alert('Error updating staff: ' + error.message);
          setSaving(false);
          return;
        }

        alert('Staff member updated successfully!');
      } else {
        // Create new staff
        const { data: authData, error: authError } = await supabase.auth.signUp({
          email: formData.email,
          password: formData.password,
          options: {
            data: {
              full_name: formData.full_name
            }
          }
        });

        if (authError) {
          console.error('Error creating auth user:', authError);
          alert('Error creating staff: ' + authError.message);
          setSaving(false);
          return;
        }

        if (!authData.user) {
          alert('Error: Staff creation failed');
          setSaving(false);
          return;
        }

        // Create user in users_login table
        const { error: dbError } = await supabase
          .from('users_login')
          .insert({
            id: authData.user.id,
            email: formData.email,
            full_name: formData.full_name,
            phone: formData.phone,
            role_id: formData.role_id,
            workshop_id: workshopInfo.id,
            department: formData.department,
            is_active: formData.is_active,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (dbError) {
          console.error('Error creating staff record:', dbError);
          alert('Error creating staff record: ' + dbError.message);
          setSaving(false);
          return;
        }

        alert('Staff member created successfully!');
      }

      // Refresh data and close modal
      fetchStaff();
      setShowModal(false);
      setSelectedStaff(null);
    } catch (error: any) {
      console.error('Error saving staff:', error);
      alert('Error saving staff: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  function handleCloseModal() {
    setShowModal(false);
    setSelectedStaff(null);
  }

  function handleOpenPasswordReset(member: any) {
    // Prevent admin from resetting their own password this way
    if (member.id === currentUserId) {
      alert('Use profile settings to change your own password');
      return;
    }

    // Prevent resetting other admins' passwords
    if (member.role_id?.role_code === 'WORKSHOP_ADMIN') {
      alert('You cannot reset passwords for other workshop admins');
      return;
    }

    setPasswordResetUser(member);
    setNewPassword('');
    setShowPasswordModal(true);
  }

  async function handleResetPassword() {
    if (!newPassword || newPassword.length < 6) {
      alert('Password must be at least 6 characters long');
      return;
    }

    setSaving(true);
    const supabase = createClient();

    try {
      // Note: In production, you'd use Supabase Admin API to reset passwords
      // For now, we'll show a workaround using auth.updateUser
      // This requires the user to be logged in, so in real scenario you'd need admin privileges
      
      alert('Password reset functionality requires Supabase Admin API. Please use the "Reset Password Email" feature or implement admin API access.');
      
      setShowPasswordModal(false);
      setPasswordResetUser(null);
      setNewPassword('');
    } catch (error: any) {
      console.error('Error resetting password:', error);
      alert('Error resetting password: ' + error.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteStaff(member: any) {
    // Prevent admin from deleting themselves
    if (member.id === currentUserId) {
      alert('You cannot delete your own account');
      return;
    }

    // Prevent deleting other admins
    if (member.role_id?.role_code === 'WORKSHOP_ADMIN') {
      alert('You cannot delete other workshop admins');
      return;
    }

    if (!confirm(`Are you sure you want to remove ${member.full_name} from your workshop? This will deactivate their account.`)) {
      return;
    }

    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('users_login')
        .update({ 
          is_active: false,
          updated_at: new Date().toISOString() 
        })
        .eq('id', member.id);

      if (error) {
        console.error('Error removing staff:', error);
        alert('Error removing staff: ' + error.message);
        return;
      }

      alert('Staff member removed successfully!');
      fetchStaff();
    } catch (error: any) {
      console.error('Error removing staff:', error);
      alert('Error removing staff: ' + error.message);
    }
  }

  // Helper function to check if user can be managed
  function canManageStaff(member: any): boolean {
    // Can't manage yourself
    if (member.id === currentUserId) return false;
    // Can't manage other workshop admins
    if (member.role_id?.role_code === 'WORKSHOP_ADMIN') return false;
    return true;
  }

  const staffByRole = staff.reduce((acc: any, member: any) => {
    const roleCode = member.role_id?.role_code || 'UNKNOWN';
    if (!acc[roleCode]) {
      acc[roleCode] = [];
    }
    acc[roleCode].push(member);
    return acc;
  }, {});

  if (loading) {
    return (
      <DashboardLayout role="workshop_admin">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_admin">
      <WorkshopPageShell>
        <WorkshopPageHeader
          eyebrow="Workshop Owner"
          title="Staff Management"
          subtitle={`${workshopInfo?.name || 'Workshop'} Team`}
          right={
            <button
              onClick={handleOpenCreate}
              className="inline-flex w-full min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#023D95] px-4 py-2 text-xs sm:text-sm font-bold text-white shadow-sm hover:bg-[#012f73] min-[900px]:w-auto"
            >
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              <span className="hidden sm:inline">Add Staff Member</span>
              <span className="sm:hidden">Add Staff</span>
            </button>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <WorkshopStatTile label="Total Staff" value={staff.length} icon={<Users className="w-6 h-6 text-blue-600" />} tone="from-blue-50 to-blue-100" />
          <WorkshopStatTile label="Active" value={staff.filter(s => s.is_active).length} icon={<CheckCircle className="w-6 h-6 text-green-600" />} tone="from-green-50 to-green-100" />
          <WorkshopStatTile label="Inactive" value={staff.filter(s => !s.is_active).length} icon={<XCircle className="w-6 h-6 text-red-600" />} tone="from-red-50 to-red-100" />
          <WorkshopStatTile label="Roles" value={Object.keys(staffByRole).length} icon={<Users className="w-6 h-6 text-purple-600" />} tone="from-purple-50 to-purple-100" />
        </div>

        {Object.entries(staffByRole).map(([roleCode, members]: [string, any]) => (
          <div key={roleCode} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
            <h2 className="text-lg sm:text-xl font-semibold mb-3 sm:mb-4 flex items-center gap-1.5 sm:gap-2">
              <Users className="w-5 h-5 sm:w-6 sm:h-6 text-[#004AAD] flex-shrink-0" />
              <span className="truncate">{members[0]?.role_id?.role_name || roleCode}</span>
              <span className="text-xs sm:text-sm font-normal text-gray-500">({members.length})</span>
            </h2>

            <div className="space-y-2 sm:space-y-3">
              {members.map((member: any) => (
                <div key={member.id} className="p-3 sm:p-4 border border-slate-200 rounded-xl hover:bg-slate-50 transition">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                    <div className="flex items-start gap-3 sm:gap-4 flex-1 min-w-0">
                      <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 rounded-full bg-[#004AAD] text-white flex items-center justify-center text-lg sm:text-xl font-bold flex-shrink-0">
                        {member.full_name?.charAt(0).toUpperCase()}
                      </div>
                      
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
                          <h3 className="font-semibold text-base sm:text-lg truncate">{member.full_name}</h3>
                          {member.id === currentUserId && (
                            <WorkshopStatusPill tone="blue">You</WorkshopStatusPill>
                          )}
                        </div>
                        <div className="flex flex-col gap-1 mt-1.5 sm:mt-2 text-xs sm:text-sm text-gray-600">
                          <div className="flex items-center gap-1.5 sm:gap-2 truncate">
                            <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                            <span className="truncate">{member.email}</span>
                          </div>
                          {member.phone && (
                            <div className="flex items-center gap-1.5 sm:gap-2">
                              <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                              <span className="truncate">{member.phone}</span>
                            </div>
                          )}
                          {member.department && (
                            <div className="text-[10px] sm:text-xs text-gray-500">
                              Department: {member.department}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-row sm:flex-col items-center sm:items-end gap-2 w-full sm:w-auto">
                      <button
                        onClick={() => toggleStaffStatus(member.id, member.is_active)}
                        disabled={!canManageStaff(member)}
                        className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-[10px] sm:text-xs font-semibold flex items-center gap-1 ${
                          member.is_active
                            ? 'bg-green-100 text-green-800 hover:bg-green-200'
                            : 'bg-red-100 text-red-800 hover:bg-red-200'
                        } ${!canManageStaff(member) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {member.is_active ? (
                          <>
                            <CheckCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            Active
                          </>
                        ) : (
                          <>
                            <XCircle className="w-2.5 h-2.5 sm:w-3 sm:h-3" />
                            Inactive
                          </>
                        )}
                      </button>

                      {canManageStaff(member) && (
                        <div className="flex gap-1.5 sm:gap-2">
                          <button 
                            onClick={() => handleOpenEdit(member)}
                            className="text-blue-600 hover:text-blue-800 text-xs sm:text-sm flex items-center gap-1"
                            title="Edit staff"
                          >
                            <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <button 
                            onClick={() => handleOpenPasswordReset(member)}
                            className="text-orange-600 hover:text-orange-800 text-xs sm:text-sm flex items-center gap-1"
                            title="Reset password"
                          >
                            <Key className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                          <button 
                            onClick={() => handleDeleteStaff(member)}
                            className="text-red-600 hover:text-red-800 text-xs sm:text-sm flex items-center gap-1"
                            title="Remove staff"
                          >
                            <Trash2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>

                  {member.last_login && (
                    <div className="mt-2 sm:mt-3 pt-2 sm:pt-3 border-t text-[10px] sm:text-xs text-gray-500">
                      Last login: {formatDateTime(member.last_login)}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}

        {staff.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 text-center">
            <WorkshopEmpty>No staff members found</WorkshopEmpty>
            <button onClick={handleOpenCreate} className="inline-flex min-h-11 items-center justify-center gap-1.5 rounded-xl bg-[#004AAD] px-4 py-2.5 text-xs sm:text-sm font-bold text-white hover:bg-[#023D95]">
              <Plus className="w-4 h-4 sm:w-5 sm:h-5" />
              Add Your First Staff Member
            </button>
          </div>
        )}
      </WorkshopPageShell>

      {/* Add/Edit Staff Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-5 md:mb-6">
              <h3 className="text-lg sm:text-xl md:text-2xl font-bold">
                {selectedStaff ? 'Edit Staff Member' : 'Add New Staff Member'}
              </h3>
              <button onClick={handleCloseModal} className="text-gray-500 hover:text-gray-700">
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="Enter full name"
                  required
                />
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Email <span className="text-red-500">*</span>
                </label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="user@example.com"
                  disabled={!!selectedStaff}
                  required
                />
                {selectedStaff && (
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Email cannot be changed after creation</p>
                )}
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Phone Number
                </label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="+91 1234567890"
                />
              </div>

              {/* Password - Only for new staff */}
              {!selectedStaff && (
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Password <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="password"
                    value={formData.password}
                    onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                    className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    placeholder="Enter password (min 6 characters)"
                    minLength={6}
                    required
                  />
                </div>
              )}

              {/* Role */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Role <span className="text-red-500">*</span>
                </label>
                <select
                  value={formData.role_id}
                  onChange={(e) => setFormData({ ...formData, role_id: e.target.value })}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  required
                >
                  <option value="">Select a role</option>
                  {availableRoles.map((role) => (
                    <option key={role.id} value={role.id}>
                      {role.role_name}
                    </option>
                  ))}
                </select>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Only workshop staff roles are available</p>
              </div>

              {/* Department */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Department
                </label>
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="e.g. Mechanical, Service"
                />
              </div>

              {/* Active Status */}
              <div className="flex items-center gap-2 sm:gap-3 p-3 sm:p-4 bg-gray-50 rounded-lg">
                <input
                  type="checkbox"
                  id="is_active"
                  checked={formData.is_active}
                  onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                  className="w-4 h-4 text-brand-primary focus:ring-brand-primary border-gray-300 rounded"
                />
                <label htmlFor="is_active" className="text-xs sm:text-sm font-medium text-gray-700 cursor-pointer">
                  Staff member is active (can login)
                </label>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6 pt-4 sm:pt-5 md:pt-6 border-t border-slate-200">
              <button
                onClick={handleCloseModal}
                disabled={saving}
                className="flex-1 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveStaff}
                disabled={saving}
                className="flex-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#004AAD] px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-[#023D95] disabled:opacity-50"
              >
                {saving ? 'Saving...' : (selectedStaff ? 'Update Staff' : 'Add Staff')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Reset Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 md:p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4 sm:mb-5 md:mb-6">
              <h3 className="text-lg sm:text-xl font-bold">Reset Password</h3>
              <button 
                onClick={() => setShowPasswordModal(false)} 
                className="text-gray-500 hover:text-gray-700"
              >
                <X className="w-5 h-5 sm:w-6 sm:h-6" />
              </button>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="p-3 sm:p-4 bg-blue-50 rounded-lg">
                <p className="text-xs sm:text-sm text-gray-700">
                  Reset password for: <strong>{passwordResetUser?.full_name}</strong>
                </p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">{passwordResetUser?.email}</p>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  New Password <span className="text-red-500">*</span>
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="Enter new password (min 6 characters)"
                  minLength={6}
                />
              </div>

              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2.5 sm:p-3">
                <p className="text-[10px] sm:text-xs text-yellow-800">
                  ⚠️ Note: Password reset requires Supabase Admin API. Currently showing demo functionality.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mt-4 sm:mt-5 md:mt-6 pt-4 sm:pt-5 md:pt-6 border-t border-slate-200">
              <button
                onClick={() => setShowPasswordModal(false)}
                disabled={saving}
                className="flex-1 inline-flex min-h-11 items-center justify-center rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs sm:text-sm font-bold text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                disabled={saving}
                className="flex-1 inline-flex min-h-11 items-center justify-center rounded-xl bg-[#004AAD] px-4 py-2 text-xs sm:text-sm font-bold text-white hover:bg-[#023D95] disabled:opacity-50"
              >
                {saving ? 'Resetting...' : 'Reset Password'}
              </button>
            </div>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}

