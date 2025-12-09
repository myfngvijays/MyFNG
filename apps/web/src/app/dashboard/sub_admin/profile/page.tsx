'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { User, Mail, Phone, Edit2, Save, X, Loader2, Building2 } from 'lucide-react';
import toast from 'react-hot-toast';

export default function SubAdminProfilePage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    email: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data: profileData, error } = await supabase
        .from('users_login')
        .select('*, roles!inner(role_code, role_name)')
        .eq('id', user.id)
        .single();

      if (error) throw error;

      setProfile(profileData);
      setFormData({
        full_name: profileData.full_name || '',
        phone: profileData.phone || '',
        email: profileData.email || user.email || '',
      });
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('users_login')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
      setIsEditing(false);
      fetchProfile();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const getDepartmentTitle = () => {
    switch (profile?.department) {
      case 'CSE':
        return 'Customer Service Manager';
      case 'TELECALLER':
        return 'Telecalling Manager';
      case 'AUDITOR':
        return 'Audit Manager';
      default:
        return 'Sub Admin';
    }
  };

  if (loading) {
    return (
      <DashboardLayout role="sub_admin">
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="sub_admin">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
            <User className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
            <span>My Profile</span>
          </h1>
        </div>

        <div className="bg-white p-4 sm:p-5 md:p-6 rounded-lg shadow">
          {isEditing ? (
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Full Name</label>
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Phone</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">Email</label>
                <input
                  type="email"
                  value={formData.email}
                  disabled
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg bg-gray-100"
                />
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Email cannot be changed</p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 pt-2">
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" /> : <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                  Save
                </button>
                <button
                  onClick={() => {
                    setIsEditing(false);
                    fetchProfile();
                  }}
                  className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 text-gray-700 text-xs sm:text-sm rounded-lg hover:bg-gray-300"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4 sm:space-y-5 md:space-y-6">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 bg-indigo-600 rounded-full flex items-center justify-center flex-shrink-0">
                  <span className="text-xl sm:text-2xl font-bold text-white">
                    {profile?.full_name?.charAt(0).toUpperCase() || 'U'}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900 truncate">{profile?.full_name || 'N/A'}</h2>
                  <p className="text-sm sm:text-base text-gray-600">{(profile?.roles as any)?.role_name || 'Sub Admin'}</p>
                  {profile?.department && (
                    <p className="text-indigo-600 font-semibold text-xs sm:text-sm mt-0.5 sm:mt-1">{getDepartmentTitle()}</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-5 md:gap-6 mt-4 sm:mt-5 md:mt-6">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                    <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    Email
                  </label>
                  <p className="text-sm sm:text-base md:text-lg break-words">{profile?.email || 'N/A'}</p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                    <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    Phone
                  </label>
                  <p className="text-sm sm:text-base md:text-lg">{profile?.phone || 'Not provided'}</p>
                </div>
                {profile?.department && (
                  <div>
                    <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                      <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      Department
                    </label>
                    <p className="text-sm sm:text-base md:text-lg">{profile.department}</p>
                  </div>
                )}
              </div>

              <button
                onClick={() => setIsEditing(true)}
                className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white text-xs sm:text-sm rounded-lg hover:bg-indigo-700 w-full sm:w-auto"
              >
                <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Edit Profile
              </button>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}

