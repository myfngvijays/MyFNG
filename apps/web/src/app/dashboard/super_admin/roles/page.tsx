'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, Search, Users, ChevronDown, ChevronUp, Eye, Loader2,
  Pencil, Plus, X, Save, Trash2,
} from 'lucide-react';

type RoleGroup = 'admin_roles' | 'manager_roles' | 'internal_staff' | 'workshop_staff' | 'company_field_staff' | 'customers';

const ROLE_HIERARCHY: Record<RoleGroup, string[]> = {
  admin_roles: ['SUPER_ADMIN', 'SUB_ADMIN'],
  manager_roles: ['LEAD_MANAGER', 'RSA_MANAGER', 'HOME_SERVICE_MANAGER'],
  internal_staff: ['TELECALLER', 'CUSTOMER_SERVICE_EXECUTIVE', 'AUDITOR', 'ACCOUNTS_TEAM', 'DIGITAL_MARKETING', 'DIGITAL_AUTHOR', 'APP_OPERATIONS'],
  workshop_staff: ['WORKSHOP_ADMIN', 'WORKSHOP_SUPERVISOR', 'WORKSHOP_MECHANIC', 'WORKSHOP_PICKUP_BOY'],
  company_field_staff: ['COMPANY_MECHANIC_RSA', 'COMPANY_VAN_TECHNICIAN', 'COMPANY_VAN_DRIVER'],
  customers: ['CUSTOMER'],
};

const GROUP_LABELS: Record<RoleGroup, { label: string; color: string; bg: string }> = {
  admin_roles: { label: 'Administrators', color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
  manager_roles: { label: 'Managers', color: 'text-purple-700', bg: 'bg-purple-50 border-purple-200' },
  internal_staff: { label: 'Internal Staff', color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  workshop_staff: { label: 'Workshop Staff', color: 'text-orange-700', bg: 'bg-orange-50 border-orange-200' },
  company_field_staff: { label: 'Company Field Staff', color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
  customers: { label: 'Customers', color: 'text-gray-700', bg: 'bg-gray-50 border-gray-200' },
};

const ROLE_MENU_ITEMS: Record<string, string[]> = {
  SUPER_ADMIN: ['Dashboard', 'User Management', 'Workshops', 'Bookings & Leads', 'RSA', 'Telecaller Distribution', 'Manual Invoices', 'Products & Inventory', 'Service Packages', 'Workshop Pricing', 'Service Pricing', 'Zones', 'App Customers', 'Membership Customers', 'Home Carousel', 'Promo Banners', 'Customer Reviews', 'Membership Plans', 'Advance Coupon Management', 'Notifications', 'WhatsApp Templates', 'WhatsApp Dashboard', 'Bot Flow', 'Blogs', 'All Leads', 'Lead History', 'KB Manager', 'Analytics', 'Reports', 'Finance', 'Audit Logs', 'System Settings', 'Roles & Permissions'],
  SUB_ADMIN: ['Dashboard', 'Team Management', 'WhatsApp Templates', 'Leads', 'Dialer Leads (CSE only)', 'Escalations', 'Performance', 'Profile'],
  LEAD_MANAGER: ['Dashboard', 'Manage Leads', 'Workshops', 'Reports'],
  RSA_MANAGER: ['Dashboard', 'View All Complaints', 'Create Complaint', 'Car Service Enquiry', 'View Registered', 'Active Aansh Sessions', 'Payment', 'Manage Mechanics', 'Service Partners', 'Membership Customer', 'Reports', 'Settings'],
  HOME_SERVICE_MANAGER: ['Dashboard', 'Leads', 'Service Vans', 'Technicians', 'Reports'],
  TELECALLER: ['Dashboard', 'Enquiry', 'My Leads', 'Create Lead', 'RSA', 'My Profile'],
  CUSTOMER_SERVICE_EXECUTIVE: ['Dashboard', 'Call Panel', 'Tickets', 'Callbacks', 'Ratings', 'Profile'],
  AUDITOR: ['Dashboard', 'My Audits', 'Workshops', 'Escalations', 'Performance', 'Profile'],
  ACCOUNTS_TEAM: ['Dashboard', 'Profile'],
  WORKSHOP_ADMIN: ['Dashboard', 'Chat', 'Pending Lead Approval', 'All Leads', 'Public Page', 'Staff Management', 'Active Jobs', 'Additional Jobs Master', 'Settings'],
  WORKSHOP_SUPERVISOR: ['Dashboard', 'Chat', 'Pending Lead Approval', 'Day Planning', 'Manage Jobs', 'QC Queue', 'Additional Jobs Approval', 'Pickup & Delivery', 'Additional Jobs Master', 'Team Overview', 'Daily Report', 'Analytics', 'Profile'],
  WORKSHOP_MECHANIC: ['Dashboard', 'Chat', 'My Jobs', 'Job History', 'Profile'],
  WORKSHOP_PICKUP_BOY: ['Dashboard', 'Chat', 'My Tasks', 'Task History', 'Profile'],
  COMPANY_MECHANIC_RSA: ['Dashboard', 'My Tasks', 'History', 'Profile'],
  COMPANY_VAN_TECHNICIAN: ['Dashboard', 'My Tasks', 'History', 'Profile'],
  COMPANY_VAN_DRIVER: ['Dashboard', 'My Trips', 'History', 'Profile'],
  DIGITAL_MARKETING: ['Dashboard', 'Blogs', 'Blog Categories', 'Campaigns', 'Analytics', 'Leads', 'Profile'],
  DIGITAL_AUTHOR: ['Dashboard', 'My Blogs', 'Profile'],
  APP_OPERATIONS: ['Dashboard', 'Bookings & Leads', 'App Customers', 'Membership Customers', 'Refer & Earn', 'Profile'],
  CUSTOMER: ['Dashboard', 'My Bookings', 'My Vehicles', 'Invoices', 'Support', 'Profile'],
};

const ROLE_COLORS: Record<string, string> = {
  SUPER_ADMIN: 'bg-red-100 text-red-800 border-red-200',
  SUB_ADMIN: 'bg-purple-100 text-purple-800 border-purple-200',
  LEAD_MANAGER: 'bg-purple-100 text-purple-800 border-purple-200',
  RSA_MANAGER: 'bg-red-100 text-red-800 border-red-200',
  HOME_SERVICE_MANAGER: 'bg-teal-100 text-teal-800 border-teal-200',
  TELECALLER: 'bg-blue-100 text-blue-800 border-blue-200',
  CUSTOMER_SERVICE_EXECUTIVE: 'bg-sky-100 text-sky-800 border-sky-200',
  AUDITOR: 'bg-indigo-100 text-indigo-800 border-indigo-200',
  ACCOUNTS_TEAM: 'bg-amber-100 text-amber-800 border-amber-200',
  WORKSHOP_ADMIN: 'bg-orange-100 text-orange-800 border-orange-200',
  WORKSHOP_SUPERVISOR: 'bg-orange-100 text-orange-800 border-orange-200',
  WORKSHOP_MECHANIC: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  WORKSHOP_PICKUP_BOY: 'bg-lime-100 text-lime-800 border-lime-200',
  COMPANY_MECHANIC_RSA: 'bg-emerald-100 text-emerald-800 border-emerald-200',
  COMPANY_VAN_TECHNICIAN: 'bg-green-100 text-green-800 border-green-200',
  COMPANY_VAN_DRIVER: 'bg-green-100 text-green-800 border-green-200',
  DIGITAL_MARKETING: 'bg-pink-100 text-pink-800 border-pink-200',
  DIGITAL_AUTHOR: 'bg-rose-100 text-rose-800 border-rose-200',
  APP_OPERATIONS: 'bg-cyan-100 text-cyan-800 border-cyan-200',
  CUSTOMER: 'bg-gray-100 text-gray-800 border-gray-200',
};

const ALL_KNOWN_PERMISSIONS = [
  'all',
  'manage_users', 'view_reports', 'manage_leads', 'manage_workshops',
  'view_leads', 'assign_leads', 'manage_normal_leads', 'manage_rsa_leads', 'manage_home_service_leads',
  'call_customers', 'update_lead_status',
  'view_customers', 'handle_support', 'manage_escalations', 'manage_referrals',
  'view_workshops', 'audit_workshops', 'update_audit_scores',
  'view_invoices', 'manage_payments', 'generate_reports',
  'view_workshop_leads', 'accept_reject_leads', 'manage_workshop_staff',
  'assign_jobs', 'view_workshop_tasks', 'manage_mechanics',
  'view_assigned_jobs', 'update_job_status', 'upload_photos',
  'view_pickup_tasks', 'update_pickup_status',
  'view_rsa_tasks', 'view_home_service_tasks', 'update_delivery_status',
  'manage_campaigns', 'view_analytics', 'manage_promotions', 'track_leads',
  'manage_content', 'edit_blogs', 'approve_blogs', 'publish_blogs', 'delete_blogs',
  'manage_categories', 'manage_tags', 'restore_versions',
  'create_blogs', 'save_drafts', 'edit_own_blogs',
  'create_booking', 'view_my_bookings', 'track_service',
];

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [groupFilter, setGroupFilter] = useState<RoleGroup | 'all'>('all');

  const [editRole, setEditRole] = useState<any | null>(null);
  const [editPermissions, setEditPermissions] = useState<Record<string, boolean>>({});
  const [editDescription, setEditDescription] = useState('');
  const [newPermKey, setNewPermKey] = useState('');
  const [saving, setSaving] = useState(false);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [createForm, setCreateForm] = useState({ role_code: '', role_name: '', description: '' });
  const [createPermissions, setCreatePermissions] = useState<Record<string, boolean>>({});
  const [createNewPermKey, setCreateNewPermKey] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => { fetchRoles(); }, []);

  const fetchRoles = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/roles');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load roles');
      setRoles(json?.roles || []);
    } catch (err: any) {
      setError(err?.message || 'Failed to load roles');
    } finally {
      setLoading(false);
    }
  };

  const openEditModal = (role: any) => {
    setEditRole(role);
    const perms = role.permissions && typeof role.permissions === 'object' ? { ...role.permissions } : {};
    setEditPermissions(perms);
    setEditDescription(role.description || '');
    setNewPermKey('');
    setError(null);
    setSuccess(null);
  };

  const closeEditModal = () => {
    setEditRole(null);
    setEditPermissions({});
    setEditDescription('');
    setNewPermKey('');
  };

  const togglePermission = (key: string) => {
    setEditPermissions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const removePermission = (key: string) => {
    setEditPermissions((prev) => {
      const next = { ...prev };
      delete next[key];
      return next;
    });
  };

  const addPermission = () => {
    const key = newPermKey.trim().toLowerCase().replace(/\s+/g, '_');
    if (!key) return;
    if (editPermissions[key] !== undefined) return;
    setEditPermissions((prev) => ({ ...prev, [key]: true }));
    setNewPermKey('');
  };

  const handleSave = async () => {
    if (!editRole) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_id: editRole.id,
          permissions: editPermissions,
          description: editDescription,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to update role');
      setSuccess(`${editRole.role_name} permissions updated successfully`);
      closeEditModal();
      fetchRoles();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const openCreateModal = () => {
    setShowCreateModal(true);
    setCreateForm({ role_code: '', role_name: '', description: '' });
    setCreatePermissions({});
    setCreateNewPermKey('');
    setError(null);
    setSuccess(null);
  };

  const closeCreateModal = () => {
    setShowCreateModal(false);
    setCreateForm({ role_code: '', role_name: '', description: '' });
    setCreatePermissions({});
    setCreateNewPermKey('');
  };

  const handleCreate = async () => {
    if (!createForm.role_code.trim() || !createForm.role_name.trim()) {
      setError('Role code and role name are required');
      return;
    }
    setCreating(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/roles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          role_code: createForm.role_code,
          role_name: createForm.role_name,
          description: createForm.description,
          permissions: createPermissions,
        }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to create role');
      setSuccess(`Role "${json.role.role_name}" created successfully`);
      closeCreateModal();
      fetchRoles();
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to create role');
    } finally {
      setCreating(false);
    }
  };

  const createSuggestedPerms = useMemo(() => {
    const existing = new Set(Object.keys(createPermissions));
    return ALL_KNOWN_PERMISSIONS.filter((p) => !existing.has(p));
  }, [createPermissions]);

  const filteredRoles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return roles.filter((r) => {
      if (groupFilter !== 'all') {
        if (!ROLE_HIERARCHY[groupFilter]?.includes(r.role_code)) return false;
      }
      if (!q) return true;
      return [r.role_code, r.role_name, r.description]
        .filter(Boolean)
        .some((v: string) => String(v).toLowerCase().includes(q));
    });
  }, [roles, searchTerm, groupFilter]);

  const totalUsers = roles.reduce((s, r) => s + (r.user_count || 0), 0);
  const activeRoles = roles.filter((r) => r.is_active).length;

  const getGroupForRole = (roleCode: string): RoleGroup | null => {
    for (const [group, codes] of Object.entries(ROLE_HIERARCHY)) {
      if (codes.includes(roleCode)) return group as RoleGroup;
    }
    return null;
  };

  const groupedRoles = useMemo(() => {
    const groups: Record<string, any[]> = {};
    for (const role of filteredRoles) {
      const group = getGroupForRole(role.role_code) || 'other';
      if (!groups[group]) groups[group] = [];
      groups[group].push(role);
    }
    return groups;
  }, [filteredRoles]);

  const suggestedPerms = useMemo(() => {
    const existing = new Set(Object.keys(editPermissions));
    return ALL_KNOWN_PERMISSIONS.filter((p) => !existing.has(p));
  }, [editPermissions]);

  const getPermissionCount = (role: any) => {
    if (!role.permissions || typeof role.permissions !== 'object') return 0;
    return Object.keys(role.permissions).length;
  };

  const getActivePermCount = (role: any) => {
    if (!role.permissions || typeof role.permissions !== 'object') return 0;
    return Object.values(role.permissions).filter(Boolean).length;
  };

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Shield className="w-7 h-7 text-brand-primary" />
            Roles & Permissions
          </h1>
          <p className="text-sm text-gray-500 mt-1">View and edit all roles, their permissions, and menu access</p>
        </div>
        <button
          className="px-4 py-2.5 bg-brand-primary text-white rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-2"
          onClick={openCreateModal}
        >
          <Plus className="w-4 h-4" /> Create Role
        </button>
      </div>

      {error && !editRole && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{success}</div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Total Roles</div>
          <div className="text-2xl font-bold mt-1">{roles.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Active Roles</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{activeRoles}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Total Users</div>
          <div className="text-2xl font-bold mt-1 text-blue-600">{totalUsers}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Role Groups</div>
          <div className="text-2xl font-bold mt-1 text-purple-600">{Object.keys(ROLE_HIERARCHY).length}</div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            className="w-full border rounded-lg pl-9 pr-3 py-2.5 text-sm"
            placeholder="Search roles..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <select
          className="border rounded-lg px-3 py-2.5 text-sm bg-white"
          value={groupFilter}
          onChange={(e) => setGroupFilter(e.target.value as any)}
        >
          <option value="all">All Groups</option>
          {Object.entries(GROUP_LABELS).map(([key, val]) => (
            <option key={key} value={key}>{val.label}</option>
          ))}
        </select>
        <div className="flex border rounded-lg overflow-hidden">
          <button
            className={`px-3 py-2 text-sm font-medium ${viewMode === 'cards' ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setViewMode('cards')}
          >
            Cards
          </button>
          <button
            className={`px-3 py-2 text-sm font-medium border-l ${viewMode === 'table' ? 'bg-brand-primary text-white' : 'bg-white text-gray-600 hover:bg-gray-50'}`}
            onClick={() => setViewMode('table')}
          >
            Table
          </button>
        </div>
      </div>

      {viewMode === 'cards' ? (
        <div className="space-y-6">
          {Object.entries(groupFilter === 'all' ? groupedRoles : { [groupFilter]: groupedRoles[groupFilter] || [] }).map(([group, groupRoles]) => {
            const meta = GROUP_LABELS[group as RoleGroup];
            if (!meta || !groupRoles.length) return null;
            return (
              <div key={group}>
                <h2 className={`text-sm font-bold uppercase tracking-wider mb-3 ${meta.color}`}>
                  {meta.label} ({groupRoles.length})
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {groupRoles.map((role: any) => {
                    const isExpanded = expandedRole === role.role_code;
                    const menuItems = ROLE_MENU_ITEMS[role.role_code] || [];
                    const colorClass = ROLE_COLORS[role.role_code] || 'bg-gray-100 text-gray-800';
                    const dbPerms = role.permissions && typeof role.permissions === 'object' ? role.permissions : {};
                    const activePerms = Object.entries(dbPerms).filter(([, v]) => v);
                    return (
                      <div key={role.id} className={`bg-white rounded-xl border overflow-hidden transition-shadow ${isExpanded ? 'shadow-lg ring-2 ring-brand-primary/20' : 'hover:shadow-md'}`}>
                        <div
                          className="p-4 cursor-pointer"
                          onClick={() => setExpandedRole(isExpanded ? null : role.role_code)}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
                                  {role.role_name}
                                </span>
                                {!role.is_active && (
                                  <span className="px-2 py-0.5 rounded-full text-xs bg-red-50 text-red-600 border border-red-200">Inactive</span>
                                )}
                              </div>
                              <p className="text-xs text-gray-500 mt-2">{role.description || '—'}</p>
                            </div>
                            <div className="flex items-center gap-3 shrink-0">
                              <button
                                className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500 hover:text-brand-primary transition-colors"
                                title="Edit permissions"
                                onClick={(e) => { e.stopPropagation(); openEditModal(role); }}
                              >
                                <Pencil className="w-4 h-4" />
                              </button>
                              <div className="text-right">
                                <div className="text-lg font-bold">{role.user_count}</div>
                                <div className="text-[10px] text-gray-400 uppercase">Users</div>
                              </div>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {getActivePermCount(role)}/{getPermissionCount(role)} permissions</span>
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {menuItems.length} menu items</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t bg-gray-50/50 p-4 space-y-4">
                            <div>
                              <div className="flex items-center justify-between mb-2">
                                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider flex items-center gap-1">
                                  <Shield className="w-3.5 h-3.5" /> Permissions ({activePerms.length} active)
                                </h4>
                                <button
                                  className="text-xs text-brand-primary font-semibold hover:underline flex items-center gap-1"
                                  onClick={(e) => { e.stopPropagation(); openEditModal(role); }}
                                >
                                  <Pencil className="w-3 h-3" /> Edit
                                </button>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {Object.entries(dbPerms).length === 0 && (
                                  <span className="text-xs text-gray-400 italic">No permissions set in database</span>
                                )}
                                {Object.entries(dbPerms).map(([key, val]) => (
                                  <span
                                    key={key}
                                    className={`px-2 py-1 rounded-md text-xs border ${val ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600 line-through'}`}
                                  >
                                    {key}
                                  </span>
                                ))}
                              </div>
                            </div>

                            <div>
                              <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Eye className="w-3.5 h-3.5" /> Menu / Dashboard Access
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {menuItems.map((item, i) => (
                                  <span key={i} className="px-2 py-1 bg-blue-50 border border-blue-200 rounded-md text-xs text-blue-700">{item}</span>
                                ))}
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="bg-white rounded-xl border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left">#</th>
                <th className="px-4 py-3 text-left">Role</th>
                <th className="px-4 py-3 text-left">Group</th>
                <th className="px-4 py-3 text-left">Description</th>
                <th className="px-4 py-3 text-center">Users</th>
                <th className="px-4 py-3 text-left">Permissions</th>
                <th className="px-4 py-3 text-left">Menu Access</th>
                <th className="px-4 py-3 text-center">Status</th>
                <th className="px-4 py-3 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRoles.length === 0 ? (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-500">No roles found.</td></tr>
              ) : null}
              {filteredRoles.map((role, idx) => {
                const group = getGroupForRole(role.role_code);
                const meta = group ? GROUP_LABELS[group] : null;
                const dbPerms = role.permissions && typeof role.permissions === 'object' ? role.permissions : {};
                const activePerms = Object.entries(dbPerms).filter(([, v]) => v);
                const menuItems = ROLE_MENU_ITEMS[role.role_code] || [];
                const colorClass = ROLE_COLORS[role.role_code] || 'bg-gray-100 text-gray-800';
                return (
                  <tr key={role.id} className="border-t hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-400 text-xs">{idx + 1}</td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-1 rounded-full text-xs font-bold border ${colorClass}`}>
                        {role.role_name}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      {meta && (
                        <span className={`px-2 py-1 rounded-md text-xs font-medium border ${meta.bg}`}>
                          {meta.label}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-[200px] truncate" title={role.description}>
                      {role.description || '—'}
                    </td>
                    <td className="px-4 py-3 text-center font-bold">{role.user_count}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[250px]">
                        {activePerms.slice(0, 3).map(([key]) => (
                          <span key={key} className="px-1.5 py-0.5 bg-green-50 border border-green-200 rounded text-[10px] text-green-700">{key}</span>
                        ))}
                        {activePerms.length > 3 && (
                          <span className="px-1.5 py-0.5 bg-green-100 rounded text-[10px] text-green-700 font-medium">+{activePerms.length - 3} more</span>
                        )}
                        {activePerms.length === 0 && (
                          <span className="text-[10px] text-gray-400 italic">Not set</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[250px]">
                        {menuItems.slice(0, 3).map((item, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-blue-50 border border-blue-200 rounded text-[10px] text-blue-700">{item}</span>
                        ))}
                        {menuItems.length > 3 && (
                          <span className="px-1.5 py-0.5 bg-blue-100 rounded text-[10px] text-blue-700 font-medium">+{menuItems.length - 3} more</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      {role.is_active ? (
                        <span className="px-2 py-1 bg-green-50 text-green-700 border border-green-200 rounded-full text-xs font-medium">Active</span>
                      ) : (
                        <span className="px-2 py-1 bg-red-50 text-red-600 border border-red-200 rounded-full text-xs font-medium">Inactive</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        className="px-3 py-1.5 bg-brand-primary text-white rounded-lg text-xs font-semibold hover:opacity-90 inline-flex items-center gap-1"
                        onClick={() => openEditModal(role)}
                      >
                        <Pencil className="w-3 h-3" /> Edit
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {(editRole || showCreateModal) && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => editRole ? closeEditModal() : closeCreateModal()}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="p-5 border-b flex items-center justify-between">
              <div>
                {editRole ? (
                  <>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Pencil className="w-5 h-5 text-brand-primary" />
                      Edit Permissions
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">
                      <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${ROLE_COLORS[editRole.role_code] || 'bg-gray-100'}`}>
                        {editRole.role_name}
                      </span>
                      <span className="ml-2">{editRole.role_code}</span>
                    </p>
                  </>
                ) : (
                  <>
                    <h2 className="text-lg font-bold flex items-center gap-2">
                      <Plus className="w-5 h-5 text-brand-primary" />
                      Create New Role
                    </h2>
                    <p className="text-sm text-gray-500 mt-0.5">Define a new user role with permissions</p>
                  </>
                )}
              </div>
              <button className="p-2 hover:bg-gray-100 rounded-lg" onClick={() => editRole ? closeEditModal() : closeCreateModal()}>
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-5">
              {error && (editRole || showCreateModal) && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded-lg text-sm">{error}</div>
              )}

              {showCreateModal && !editRole && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1">Role Name *</label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm"
                        placeholder="e.g. Finance Manager"
                        value={createForm.role_name}
                        onChange={(e) => {
                          const name = e.target.value;
                          setCreateForm((prev) => ({
                            ...prev,
                            role_name: name,
                            role_code: prev.role_code || name.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, ''),
                          }));
                        }}
                      />
                    </div>
                    <div>
                      <label className="text-sm font-semibold text-gray-700 block mb-1">Role Code *</label>
                      <input
                        className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                        placeholder="e.g. FINANCE_MANAGER"
                        value={createForm.role_code}
                        onChange={(e) => setCreateForm((prev) => ({ ...prev, role_code: e.target.value.toUpperCase().replace(/\s+/g, '_').replace(/[^A-Z0-9_]/g, '') }))}
                      />
                      <p className="text-[10px] text-gray-400 mt-1">Uppercase with underscores, no spaces</p>
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-semibold text-gray-700 block mb-1">Description</label>
                    <textarea
                      className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                      rows={2}
                      value={createForm.description}
                      onChange={(e) => setCreateForm((prev) => ({ ...prev, description: e.target.value }))}
                      placeholder="What does this role do?"
                    />
                  </div>
                </>
              )}

              {editRole && (
                <div>
                  <label className="text-sm font-semibold text-gray-700 block mb-1">Description</label>
                  <textarea
                    className="w-full border rounded-lg px-3 py-2 text-sm resize-none"
                    rows={2}
                    value={editDescription}
                    onChange={(e) => setEditDescription(e.target.value)}
                    placeholder="Role description..."
                  />
                </div>
              )}

              <div>
                <h3 className="text-sm font-bold text-gray-700 mb-3">
                  Permissions ({Object.keys(editRole ? editPermissions : createPermissions).length})
                </h3>
                {Object.keys(editRole ? editPermissions : createPermissions).length === 0 ? (
                  <p className="text-sm text-gray-400 italic">No permissions set. Add from below.</p>
                ) : (
                  <div className="space-y-1.5">
                    {Object.entries(editRole ? editPermissions : createPermissions).map(([key, val]) => (
                      <div key={key} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 border">
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            className={`relative w-10 h-5 rounded-full transition-colors ${val ? 'bg-green-500' : 'bg-gray-300'}`}
                            onClick={() => {
                              if (editRole) togglePermission(key);
                              else setCreatePermissions((prev) => ({ ...prev, [key]: !prev[key] }));
                            }}
                          >
                            <span className="absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                              style={{ left: val ? '22px' : '2px' }}
                            />
                          </button>
                          <span className={`text-sm font-medium ${val ? 'text-gray-800' : 'text-gray-400 line-through'}`}>{key}</span>
                        </div>
                        <button
                          className="p-1 hover:bg-red-50 rounded text-gray-400 hover:text-red-500 transition-colors"
                          onClick={() => {
                            if (editRole) removePermission(key);
                            else setCreatePermissions((prev) => { const n = { ...prev }; delete n[key]; return n; });
                          }}
                          title="Remove permission"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4">
                <h3 className="text-sm font-bold text-gray-700 mb-2">Add Permission</h3>
                <div className="flex gap-2 mb-3">
                  <input
                    className="flex-1 border rounded-lg px-3 py-2 text-sm"
                    placeholder="Permission key (e.g. manage_invoices)"
                    value={editRole ? newPermKey : createNewPermKey}
                    onChange={(e) => editRole ? setNewPermKey(e.target.value) : setCreateNewPermKey(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key !== 'Enter') return;
                      if (editRole) { addPermission(); }
                      else {
                        const key = createNewPermKey.trim().toLowerCase().replace(/\s+/g, '_');
                        if (key && createPermissions[key] === undefined) {
                          setCreatePermissions((prev) => ({ ...prev, [key]: true }));
                          setCreateNewPermKey('');
                        }
                      }
                    }}
                  />
                  <button
                    className="px-4 py-2 bg-brand-primary text-white rounded-lg text-sm font-semibold hover:opacity-90 flex items-center gap-1 disabled:opacity-50"
                    onClick={() => {
                      if (editRole) { addPermission(); }
                      else {
                        const key = createNewPermKey.trim().toLowerCase().replace(/\s+/g, '_');
                        if (key && createPermissions[key] === undefined) {
                          setCreatePermissions((prev) => ({ ...prev, [key]: true }));
                          setCreateNewPermKey('');
                        }
                      }
                    }}
                    disabled={!(editRole ? newPermKey : createNewPermKey).trim()}
                  >
                    <Plus className="w-4 h-4" /> Add
                  </button>
                </div>

                {(editRole ? suggestedPerms : createSuggestedPerms).length > 0 && (
                  <div>
                    <p className="text-xs text-gray-500 mb-2">Quick add (click to add):</p>
                    <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
                      {(editRole ? suggestedPerms : createSuggestedPerms).map((p) => (
                        <button
                          key={p}
                          className="px-2 py-1 bg-white border border-dashed border-gray-300 rounded-md text-xs text-gray-600 hover:border-brand-primary hover:text-brand-primary transition-colors"
                          onClick={() => {
                            if (editRole) setEditPermissions((prev) => ({ ...prev, [p]: true }));
                            else setCreatePermissions((prev) => ({ ...prev, [p]: true }));
                          }}
                        >
                          + {p}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 border-t flex items-center justify-between bg-gray-50">
              <button
                className="px-4 py-2.5 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-100"
                onClick={() => editRole ? closeEditModal() : closeCreateModal()}
              >
                Cancel
              </button>
              {editRole ? (
                <button
                  className="px-6 py-2.5 bg-brand-primary text-white rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              ) : (
                <button
                  className="px-6 py-2.5 bg-green-600 text-white rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
                  onClick={handleCreate}
                  disabled={creating || !createForm.role_code.trim() || !createForm.role_name.trim()}
                >
                  {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  {creating ? 'Creating...' : 'Create Role'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
