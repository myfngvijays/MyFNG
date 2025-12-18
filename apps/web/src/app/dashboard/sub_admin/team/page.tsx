'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY } from '@/lib/utils';
import {
  Users,
  UserPlus,
  Search,
  Loader2,
  CheckCircle,
  XCircle,
  Mail,
  Phone,
  Clock,
  TrendingUp
} from 'lucide-react';
import Link from 'next/link';
import toast from 'react-hot-toast';

export default function SubAdminTeamPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [department, setDepartment] = useState<string | null>(null);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [availableMembers, setAvailableMembers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    fetchTeamData();
  }, []);

  const fetchTeamData = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profile } = await supabase
        .from('users_login')
        .select('department')
        .eq('id', user.id)
        .single();

      if (!profile?.department) {
        toast.error('Department not assigned');
        router.push('/dashboard/sub_admin');
        return;
      }

      setDepartment(profile.department);

      // Fetch team members
      const response = await fetch('/api/subadmin/team');
      
      // Check content-type before parsing JSON
      const contentType = response.headers.get('content-type');
      let data: any = null;
      
      if (contentType && contentType.includes('application/json')) {
        data = await response.json();
      } else {
        // If not JSON, get text response
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch team');
      }

      setTeamMembers(data.team_members || []);
      setLoading(false);
    } catch (error: any) {
      console.error('Error fetching team:', error);
      toast.error(error.message || 'Failed to load team');
      setLoading(false);
    }
  };

  const fetchAvailableMembers = async () => {
    try {
      const supabase = createClient();
      
      // Get role code for department
      const roleMap: Record<string, string> = {
        'CSE': 'CUSTOMER_SERVICE_EXECUTIVE',
        'TELECALLER': 'TELECALLER',
        'AUDITOR': 'AUDITOR',
      };

      const roleCode = roleMap[department || ''];
      if (!roleCode) return;

      const { data: role } = await supabase
        .from('roles')
        .select('id')
        .eq('role_code', roleCode)
        .single();

      if (!role) return;

      // Get all users with this role who are not already assigned
      const { data: members } = await supabase
        .from('users_login')
        .select('id, full_name, email, phone, is_active')
        .eq('role_id', role.id)
        .eq('is_active', true)
        .not('id', 'in', `(${teamMembers.map(t => t.member_id).join(',') || '00000000-0000-0000-0000-000000000000'})`);

      setAvailableMembers(members || []);
    } catch (error) {
      console.error('Error fetching available members:', error);
    }
  };

  const handleAssignMember = async (memberId: string) => {
    try {
      const response = await fetch('/api/subadmin/team/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ team_member_id: memberId }),
      });

      // Check content-type before parsing JSON
      const contentType = response.headers.get('content-type');
      let errorData: any = null;
      
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        // If not JSON, get text response
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(errorData.error || 'Failed to assign member');
      }

      toast.success('Team member assigned successfully');
      fetchTeamData();
      setShowAssignModal(false);
    } catch (error: any) {
      console.error('Error assigning member:', error);
      toast.error(error.message || 'Failed to assign member');
    }
  };

  const handleRemoveMember = async (assignmentId: string) => {
    if (!confirm('Are you sure you want to remove this team member?')) return;

    try {
      const response = await fetch('/api/subadmin/team/reassign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignment_id: assignmentId }),
      });

      // Check content-type before parsing JSON
      const contentType = response.headers.get('content-type');
      let errorData: any = null;
      
      if (contentType && contentType.includes('application/json')) {
        errorData = await response.json();
      } else {
        // If not JSON, get text response
        const text = await response.text();
        console.error('Non-JSON response:', text);
        throw new Error(`Server error: ${response.status} ${response.statusText}`);
      }

      if (!response.ok) {
        throw new Error(errorData.error || 'Failed to remove member');
      }

      toast.success('Team member removed successfully');
      fetchTeamData();
    } catch (error: any) {
      console.error('Error removing member:', error);
      toast.error(error.message || 'Failed to remove member');
    }
  };

  const filteredMembers = teamMembers.filter(member =>
    member.member?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    member.member?.email?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <DashboardLayout role="sub_admin">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Users className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                <span>Team Management</span>
              </h1>
              <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Manage your {department} team members</p>
            </div>
            <button
              onClick={() => {
                fetchAvailableMembers();
                setShowAssignModal(true);
              }}
              className="btn btn-primary flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 w-full sm:w-auto"
            >
              <UserPlus className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Add Team Member</span>
              <span className="sm:hidden">Add Member</span>
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="bg-white rounded-lg shadow p-3 sm:p-4">
          <div className="relative">
            <Search className="absolute left-2 sm:left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4 sm:w-5 sm:h-5" />
            <input
              type="text"
              placeholder="Search team members..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-8 sm:pl-10 pr-3 sm:pr-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {/* Team Members Grid */}
        {loading ? (
          <div className="flex items-center justify-center h-48 sm:h-64">
            <Loader2 className="w-7 h-7 sm:w-8 sm:h-8 animate-spin text-blue-600" />
          </div>
        ) : filteredMembers.length === 0 ? (
          <div className="bg-white rounded-lg shadow p-8 sm:p-10 md:p-12 text-center">
            <Users className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 text-gray-400 mx-auto mb-3 sm:mb-4" />
            <p className="text-gray-600 text-sm sm:text-base">No team members found</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            {filteredMembers.map((assignment) => (
              <div key={assignment.assignment_id} className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
                <div className="flex items-start justify-between gap-2 mb-3 sm:mb-4">
                  <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
                    <div className="w-10 h-10 sm:w-11 sm:h-11 md:w-12 md:h-12 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                      <Users className="w-5 h-5 sm:w-6 sm:h-6 text-blue-600" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm sm:text-base text-gray-900 truncate">
                        {assignment.member?.full_name || 'Unknown'}
                      </h3>
                      <p className="text-xs sm:text-sm text-gray-500 truncate">
                        {assignment.member?.role?.role_name || 'Team Member'}
                      </p>
                    </div>
                  </div>
                  {assignment.member?.is_active ? (
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-green-500 flex-shrink-0" />
                  ) : (
                    <XCircle className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 flex-shrink-0" />
                  )}
                </div>

                <div className="space-y-1.5 sm:space-y-2 mb-3 sm:mb-4">
                  {assignment.member?.email && (
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                      <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate">{assignment.member.email}</span>
                    </div>
                  )}
                  {assignment.member?.phone && (
                    <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                      <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      <span className="truncate">{assignment.member.phone}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-1.5 sm:gap-2 text-xs sm:text-sm text-gray-600">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    Assigned {formatDateDMY(assignment.assigned_at)}
                  </div>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                  <Link
                    href={`/dashboard/sub_admin/performance?member=${assignment.member_id}`}
                    className="flex-1 btn btn-outline btn-sm flex items-center justify-center gap-1.5 sm:gap-2 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  >
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Performance</span>
                    <span className="sm:hidden">Perf</span>
                  </Link>
                  <button
                    onClick={() => handleRemoveMember(assignment.assignment_id)}
                    className="btn btn-outline btn-sm text-red-600 hover:text-red-700 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Assign Member Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-3 sm:p-4">
            <div className="bg-white rounded-lg shadow-xl max-w-2xl w-full p-4 sm:p-5 md:p-6">
              <div className="flex items-center justify-between mb-3 sm:mb-4">
                <h2 className="text-lg sm:text-xl font-bold">Assign Team Member</h2>
                <button
                  onClick={() => setShowAssignModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  <XCircle className="w-5 h-5 sm:w-6 sm:h-6" />
                </button>
              </div>

              {availableMembers.length === 0 ? (
                <div className="text-center py-6 sm:py-8">
                  <p className="text-gray-600 text-sm sm:text-base">No available members to assign</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-80 sm:max-h-96 overflow-y-auto">
                  {availableMembers.map((member) => (
                    <div
                      key={member.id}
                      className="p-3 sm:p-4 border rounded-lg hover:bg-gray-50 cursor-pointer"
                      onClick={() => handleAssignMember(member.id)}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium text-sm sm:text-base truncate">{member.full_name}</p>
                          <p className="text-xs sm:text-sm text-gray-500 truncate">{member.email}</p>
                        </div>
                        <UserPlus className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}

