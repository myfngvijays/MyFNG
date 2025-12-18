'use client';

import { useEffect, useState } from 'react';
import { User, Mail, Phone, Calendar, Edit2, Save, X, Camera, Loader2, Shield } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { formatDateDMY, formatDateTime } from "@/lib/utils";

interface UserProfile {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  profile_image: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  role: {
    role_name: string;
    role_code: string;
  };
}

export default function AuditorProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    profile_image: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Not authenticated');
        setLoading(false);
        return;
      }

      const { data: profileData, error } = await supabase
        .from('users_login')
        .select(`
          id,
          email,
          phone,
          full_name,
          profile_image,
          is_active,
          created_at,
          last_login,
          roles:role_id(role_name, role_code)
        `)
        .eq('id', user.id)
        .single();

      if (error) throw error;

      if (profileData) {
        const formattedProfile = {
          ...profileData,
          role: Array.isArray(profileData.roles) ? profileData.roles[0] : profileData.roles,
        };
        setProfile(formattedProfile as UserProfile);
        setFormData({
          full_name: formattedProfile.full_name || '',
          phone: formattedProfile.phone || '',
          profile_image: formattedProfile.profile_image || '',
        });
      }
    } catch (error: any) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        toast.error('Not authenticated');
        setSaving(false);
        return;
      }

      const { data, error } = await supabase
        .from('users_login')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          profile_image: formData.profile_image,
          updated_at: new Date().toISOString(),
        })
        .eq('id', user.id)
        .select(`
          id,
          email,
          phone,
          full_name,
          profile_image,
          is_active,
          created_at,
          last_login,
          roles:role_id(role_name, role_code)
        `)
        .single();

      if (error) throw error;

      if (data) {
        const formattedProfile = {
          ...data,
          role: Array.isArray(data.roles) ? data.roles[0] : data.roles,
        };
        setProfile(formattedProfile as UserProfile);
        setIsEditing(false);
        toast.success('Profile updated successfully!');
      }
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) {
      setFormData({
        full_name: profile.full_name || '',
        phone: profile.phone || '',
        profile_image: profile.profile_image || '',
      });
    }
    setIsEditing(false);
  };

  if (loading) {
    return (
      <DashboardLayout role="auditor">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <Loader2 className="w-7 w-7 sm:w-8 sm:w-8 animate-spin text-indigo-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout role="auditor">
        <div className="text-center py-8 sm:py-10 md:py-12">
          <p className="text-gray-600 text-sm sm:text-base">Profile not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="auditor">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-gray-900 flex items-center gap-2 sm:gap-3">
              <User className="w-6 h-6 sm:w-7 sm:h-7 md:w-8 md:h-8 text-indigo-600 flex-shrink-0" />
              <span>My Profile</span>
            </h1>
            <p className="text-gray-600 text-xs sm:text-sm mt-0.5 sm:mt-1">Manage your profile information</p>
          </div>
          {!isEditing && (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-xs sm:text-sm w-full sm:w-auto"
            >
              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Edit Profile
            </button>
          )}
        </div>

        {/* Profile Card */}
        <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
          <div className="flex flex-col md:flex-row gap-4 sm:gap-5 md:gap-6">
            {/* Profile Image */}
            <div className="flex-shrink-0 flex justify-center md:justify-start">
              <div className="relative w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full overflow-hidden bg-gray-200">
                {formData.profile_image ? (
                  <Image
                    src={formData.profile_image}
                    alt={profile.full_name}
                    fill
                    className="object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-indigo-100">
                    <User className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-indigo-600" />
                  </div>
                )}
                {isEditing && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <Camera className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                  </div>
                )}
              </div>
            </div>

            {/* Profile Info */}
            <div className="flex-1 space-y-3 sm:space-y-4">
              {/* Full Name */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                  Full Name
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={formData.full_name}
                    onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                ) : (
                  <p className="text-base sm:text-lg font-semibold text-gray-900">{profile.full_name}</p>
                )}
              </div>

              {/* Email */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                  <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  Email
                </label>
                <p className="text-sm sm:text-base text-gray-900">{profile.email}</p>
                <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Email cannot be changed</p>
              </div>

              {/* Phone */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="Enter phone number"
                  />
                ) : (
                  <p className="text-sm sm:text-base text-gray-900">{profile.phone || 'Not provided'}</p>
                )}
              </div>

              {/* Role */}
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                  <Shield className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  Role
                </label>
                <p className="text-sm sm:text-base text-gray-900">{profile.role?.role_name || 'Auditor'}</p>
              </div>

              {/* Account Info */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-3 sm:pt-4 border-t border-gray-200">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1 flex items-center gap-1.5 sm:gap-2">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                    Member Since
                  </label>
                  <p className="text-sm sm:text-base text-gray-900">
                    {formatDateDMY(profile.created_at)}
                  </p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Last Login
                  </label>
                  <p className="text-sm sm:text-base text-gray-900">
                    {profile.last_login
                      ? formatDateTime(profile.last_login)
                      : 'Never'}
                  </p>
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                    Account Status
                  </label>
                  <span
                    className={`inline-flex px-2 py-0.5 sm:py-1 text-[10px] sm:text-xs font-semibold rounded-full ${
                      profile.is_active
                        ? 'bg-green-100 text-green-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {profile.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>

              {/* Action Buttons */}
              {isEditing && (
                <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4">
                  <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-xs sm:text-sm"
                  >
                    {saving ? (
                      <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    ) : (
                      <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    )}
                    <span className="hidden sm:inline">Save Changes</span>
                    <span className="sm:hidden">Save</span>
                  </button>
                  <button
                    onClick={handleCancel}
                    disabled={saving}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 disabled:opacity-50 text-xs sm:text-sm"
                  >
                    <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Cancel
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

