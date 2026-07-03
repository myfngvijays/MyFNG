'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
  Shield, Search, Users, ChevronDown, ChevronUp, Eye, Loader2,
  Building2, FileText, Phone, Wrench, Truck, Home, MessageSquare,
  Star, Settings, User, Tag, Globe, Clock, BarChart3,
  AlertTriangle, CheckCircle, ClipboardList, DollarSign, Megaphone, Car,
} from 'lucide-react';

type RoleGroup = 'admin_roles' | 'manager_roles' | 'internal_staff' | 'workshop_staff' | 'company_field_staff' | 'customers';

const ROLE_HIERARCHY: Record<RoleGroup, string[]> = {
  admin_roles: ['SUPER_ADMIN', 'SUB_ADMIN'],
  manager_roles: ['LEAD_MANAGER', 'RSA_MANAGER', 'HOME_SERVICE_MANAGER'],
  internal_staff: ['TELECALLER', 'CUSTOMER_SERVICE_EXECUTIVE', 'AUDITOR', 'ACCOUNTS_TEAM', 'DIGITAL_MARKETING', 'DIGITAL_AUTHOR'],
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

const ROLE_PERMISSIONS_MAP: Record<string, string[]> = {
  SUPER_ADMIN: ['Full system access (all permissions)'],
  SUB_ADMIN: ['Manage users', 'View reports', 'Manage leads', 'Manage workshops'],
  LEAD_MANAGER: ['View leads', 'Assign leads', 'Manage normal leads'],
  RSA_MANAGER: ['View leads', 'Assign leads', 'Manage RSA leads'],
  HOME_SERVICE_MANAGER: ['View leads', 'Assign leads', 'Manage home service leads'],
  TELECALLER: ['View leads', 'Call customers', 'Update lead status'],
  CUSTOMER_SERVICE_EXECUTIVE: ['View customers', 'Handle support', 'Manage escalations'],
  AUDITOR: ['View workshops', 'Audit workshops', 'Update audit scores'],
  ACCOUNTS_TEAM: ['View invoices', 'Manage payments', 'Generate reports'],
  WORKSHOP_ADMIN: ['View workshop leads', 'Accept/reject leads', 'Manage workshop staff'],
  WORKSHOP_SUPERVISOR: ['Assign jobs', 'View workshop tasks', 'Manage mechanics'],
  WORKSHOP_MECHANIC: ['View assigned jobs', 'Update job status', 'Upload photos'],
  WORKSHOP_PICKUP_BOY: ['View pickup tasks', 'Update pickup status', 'Upload photos'],
  COMPANY_MECHANIC_RSA: ['View RSA tasks', 'Update job status', 'Upload photos'],
  COMPANY_VAN_TECHNICIAN: ['View home service tasks', 'Update job status', 'Upload photos'],
  COMPANY_VAN_DRIVER: ['View home service tasks', 'Update delivery status'],
  DIGITAL_MARKETING: ['Manage campaigns', 'View analytics', 'Manage promotions', 'Edit/approve/publish blogs', 'Manage categories & tags'],
  DIGITAL_AUTHOR: ['Create blogs', 'Save drafts', 'Edit own blogs'],
  CUSTOMER: ['Create booking', 'View my bookings', 'Track service'],
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
  CUSTOMER: 'bg-gray-100 text-gray-800 border-gray-200',
};

export default function RolesPermissionsPage() {
  const [roles, setRoles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedRole, setExpandedRole] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
  const [groupFilter, setGroupFilter] = useState<RoleGroup | 'all'>('all');

  useEffect(() => {
    fetchRoles();
  }, []);

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

  const filteredRoles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return roles.filter((r) => {
      if (groupFilter !== 'all') {
        const groupCodes = ROLE_HIERARCHY[groupFilter] || [];
        if (!groupCodes.includes(r.role_code)) return false;
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
          <p className="text-sm text-gray-500 mt-1">View all roles, their permissions, and menu access</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>
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
                    const permissions = ROLE_PERMISSIONS_MAP[role.role_code] || [];
                    const menuItems = ROLE_MENU_ITEMS[role.role_code] || [];
                    const colorClass = ROLE_COLORS[role.role_code] || 'bg-gray-100 text-gray-800';
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
                              <div className="text-right">
                                <div className="text-lg font-bold">{role.user_count}</div>
                                <div className="text-[10px] text-gray-400 uppercase">Users</div>
                              </div>
                              {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                            </div>
                          </div>
                          <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
                            <span className="flex items-center gap-1"><Shield className="w-3 h-3" /> {permissions.length} permissions</span>
                            <span className="flex items-center gap-1"><Eye className="w-3 h-3" /> {menuItems.length} menu items</span>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="border-t bg-gray-50/50 p-4 space-y-4">
                            <div>
                              <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2 flex items-center gap-1">
                                <Shield className="w-3.5 h-3.5" /> Permissions
                              </h4>
                              <div className="flex flex-wrap gap-1.5">
                                {permissions.map((p, i) => (
                                  <span key={i} className="px-2 py-1 bg-white border rounded-md text-xs text-gray-700">{p}</span>
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

                            {role.permissions && typeof role.permissions === 'object' && Object.keys(role.permissions).length > 0 && (
                              <div>
                                <h4 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-2">DB Permission Flags</h4>
                                <div className="flex flex-wrap gap-1.5">
                                  {Object.entries(role.permissions).map(([key, val]) => (
                                    <span
                                      key={key}
                                      className={`px-2 py-1 rounded-md text-xs border ${val ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-600 line-through'}`}
                                    >
                                      {key}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
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
              </tr>
            </thead>
            <tbody>
              {filteredRoles.length === 0 ? (
                <tr><td colSpan={8} className="px-4 py-8 text-center text-gray-500">No roles found.</td></tr>
              ) : null}
              {filteredRoles.map((role, idx) => {
                const group = getGroupForRole(role.role_code);
                const meta = group ? GROUP_LABELS[group] : null;
                const permissions = ROLE_PERMISSIONS_MAP[role.role_code] || [];
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
                        {permissions.slice(0, 3).map((p, i) => (
                          <span key={i} className="px-1.5 py-0.5 bg-gray-100 rounded text-[10px] text-gray-600">{p}</span>
                        ))}
                        {permissions.length > 3 && (
                          <span className="px-1.5 py-0.5 bg-gray-200 rounded text-[10px] text-gray-600 font-medium">+{permissions.length - 3} more</span>
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
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
