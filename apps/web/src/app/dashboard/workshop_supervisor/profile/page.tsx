'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { User, Mail, Phone, Briefcase, Calendar, Edit2, Save } from 'lucide-react';

export default function SupervisorProfilePage() {
  const [profile, setProfile] = useState<any>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    email: ''
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  async function fetchProfile() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select(`
          *,
          role:roles(role_name, role_code),
          workshop:workshops(name, address, city, state, pincode, phone)
        `)
        .eq('email', user.email)
        .single();

      if (userProfile) {
        setProfile(userProfile);
        setFormData({
          name: userProfile.full_name || '',
          phone: userProfile.phone || '',
          email: userProfile.email
        });
      }

      setLoading(false);
    } catch (error) {
      console.error('Error fetching profile:', error);
      setLoading(false);
    }
  }

  async function handleSave() {
    const supabase = createClient();

    const { error } = await supabase
      .from('users_login')
      .update({
        full_name: formData.name,
        phone: formData.phone,
        updated_at: new Date().toISOString()
      })
      .eq('id', profile.id);

    if (!error) {
      setIsEditing(false);
      fetchProfile();
    } else {
      console.error('Error updating profile:', error);
      alert('Failed to update profile');
    }
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_supervisor">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-text-heading">My Profile</h1>
            <p className="text-text-body mt-2">View and manage your profile information</p>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="btn bg-brand-primary text-white hover:bg-brand-primary-hover"
            >
              <Edit2 className="w-5 h-5 mr-2" />
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                className="btn bg-green-500 text-white hover:bg-green-600"
              >
                <Save className="w-5 h-5 mr-2" />
                Save
              </button>
              <button
                onClick={() => {
                  setIsEditing(false);
                  setFormData({
                    name: profile.full_name || '',
                    phone: profile.phone || '',
                    email: profile.email
                  });
                }}
                className="btn btn-outline"
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="card text-center">
              <div className="w-24 h-24 bg-brand-primary rounded-full flex items-center justify-center text-white text-4xl font-bold mx-auto mb-4">
                {profile?.full_name?.charAt(0).toUpperCase() || 'S'}
              </div>
              <h2 className="text-2xl font-bold mb-2">{profile?.full_name}</h2>
              <p className="text-gray-600 mb-4">{profile?.role?.role_name}</p>
              <div className="pt-4 border-t space-y-2 text-sm text-gray-600">
                <div className="flex items-center justify-center gap-2">
                  <Mail className="w-4 h-4" />
                  <span>{profile?.email}</span>
                </div>
                {profile?.phone && (
                  <div className="flex items-center justify-center gap-2">
                    <Phone className="w-4 h-4" />
                    <span>{profile.phone}</span>
                  </div>
                )}
                <div className="flex items-center justify-center gap-2">
                  <Calendar className="w-4 h-4" />
                  <span>Joined {new Date(profile?.created_at).toLocaleDateString()}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Details Cards */}
          <div className="lg:col-span-2 space-y-6">
            {/* Personal Information */}
            <div className="card">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <User className="w-5 h-5" />
                Personal Information
              </h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Full Name
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{profile?.full_name}</p>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Email Address
                  </label>
                  <p className="text-gray-900">{profile?.email}</p>
                  <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone Number
                  </label>
                  {isEditing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900">{profile?.phone || 'Not provided'}</p>
                  )}
                </div>
              </div>
            </div>

            {/* Workshop Information */}
            <div className="card">
              <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                <Briefcase className="w-5 h-5" />
                Workshop Information
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Workshop Name
                  </label>
                  <p className="text-gray-900">{profile?.workshop?.name || 'N/A'}</p>
                </div>

                {profile?.workshop?.address && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Address
                    </label>
                    <p className="text-gray-900">
                      {profile.workshop.address}
                      {profile.workshop.city && `, ${profile.workshop.city}`}
                      {profile.workshop.state && `, ${profile.workshop.state}`}
                      {profile.workshop.pincode && ` - ${profile.workshop.pincode}`}
                    </p>
                  </div>
                )}

                {profile?.workshop?.phone && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Workshop Phone
                    </label>
                    <p className="text-gray-900">{profile.workshop.phone}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Role Information */}
            <div className="card bg-blue-50">
              <h3 className="text-lg font-bold mb-4">Role & Permissions</h3>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Role:</span>
                  <span className="font-semibold text-brand-primary">{profile?.role?.role_name}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Role Code:</span>
                  <span className="font-mono text-sm">{profile?.role?.role_code}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-700">Status:</span>
                  <span className={`px-2 py-1 rounded text-sm font-semibold ${
                    profile?.is_active ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                  }`}>
                    {profile?.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

