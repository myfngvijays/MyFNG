'use client';

import { useEffect, useState } from 'react';
import { User, Mail, Phone, Building, Calendar, Edit2, Save, X, Camera, Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import Image from 'next/image';

interface UserProfile {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  profile_image: string | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  role: {
    role_name: string;
    role_code: string;
  };
  workshop: {
    name: string;
    address: string;
    city: string;
  } | null;
}

export default function TelecallerProfilePage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    profile_image: '',
    department: '',
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const response = await fetch('/api/profile');
      const data = await response.json();

      if (response.ok && data.profile) {
        setProfile(data.profile);
        setFormData({
          full_name: data.profile.full_name || '',
          phone: data.profile.phone || '',
          profile_image: data.profile.profile_image || '',
          department: data.profile.department || '',
        });
      } else {
        toast.error('Failed to load profile');
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const response = await fetch('/api/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        setProfile(data.profile);
        setIsEditing(false);
        toast.success('Profile updated successfully!');
      } else {
        toast.error(data.error || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('An error occurred');
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
        department: profile.department || '',
      });
    }
    setIsEditing(false);
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // In production, upload to storage and get URL
      // For now, using a placeholder
      const reader = new FileReader();
      reader.onloadend = () => {
        setFormData({ ...formData, profile_image: reader.result as string });
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-48 sm:h-64">
        <Loader2 className="h-7 w-7 sm:h-8 sm:w-8 animate-spin text-brand-primary" />
        <p className="ml-2 sm:ml-3 text-text-body text-xs sm:text-sm">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-8 sm:py-10 md:py-12 text-text-body">
        <p className="text-sm sm:text-base">Profile not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5 md:space-y-6 p-3 sm:p-4 md:p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">My Profile</h1>
            <p className="text-white font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">Manage your personal information</p>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-white text-brand-primary rounded-lg hover:bg-gray-100 transition-colors font-medium text-xs sm:text-sm w-full sm:w-auto"
            >
              <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              <span className="hidden sm:inline">Edit Profile</span>
              <span className="sm:hidden">Edit</span>
            </button>
          ) : (
            <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed text-xs sm:text-sm"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    <span className="hidden sm:inline">Save Changes</span>
                    <span className="sm:hidden">Save</span>
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50 text-xs sm:text-sm"
              >
                <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className="card p-4 sm:p-5 md:p-6">
        <div className="flex flex-col md:flex-row gap-4 sm:gap-5 md:gap-6">
          {/* Profile Image */}
          <div className="flex flex-col items-center space-y-3 sm:space-y-4">
            <div className="relative">
              <div className="w-20 h-20 sm:w-24 sm:h-24 md:w-28 md:h-28 lg:w-32 lg:h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {formData.profile_image ? (
                  <Image
                    src={formData.profile_image}
                    alt={formData.full_name}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400" />
                )}
              </div>
              {isEditing && (
                <label className="absolute bottom-0 right-0 p-1.5 sm:p-2 bg-brand-primary text-white rounded-full cursor-pointer hover:bg-brand-secondary transition-colors">
                  <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                  />
                </label>
              )}
            </div>
            <div className="text-center">
              <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-medium ${
                profile.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {profile.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Profile Details */}
          <div className="flex-1 space-y-3 sm:space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
                Full Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="form-input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  placeholder="Enter your full name"
                />
              ) : (
                <p className="text-base sm:text-lg font-semibold text-text-heading">{profile.full_name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
                Email Address
              </label>
              <p className="text-sm sm:text-base text-text-body">{profile.email}</p>
              <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Email cannot be changed</p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
                Phone Number
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="form-input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  placeholder="Enter your phone number"
                />
              ) : (
                <p className="text-sm sm:text-base text-text-body">{profile.phone || 'Not provided'}</p>
              )}
            </div>

            {/* Department */}
            <div>
              <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1">
                <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1" />
                Department
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="form-input w-full text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  placeholder="Enter your department"
                />
              ) : (
                <p className="text-sm sm:text-base text-text-body">{profile.department || 'Not specified'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="card p-4 sm:p-5 md:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-text-heading mb-3 sm:mb-4">Account Information</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
          <div>
            <p className="text-xs sm:text-sm font-medium text-gray-700">Role</p>
            <p className="text-sm sm:text-base text-text-body font-semibold mt-0.5 sm:mt-1">
              {profile.role?.role_name || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-gray-700">Role Code</p>
            <p className="text-sm sm:text-base text-text-body font-semibold mt-0.5 sm:mt-1">
              {profile.role?.role_code || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Member Since
            </p>
            <p className="text-sm sm:text-base text-text-body mt-0.5 sm:mt-1">
              {new Date(profile.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          {profile.last_login && (
            <div>
              <p className="text-xs sm:text-sm font-medium text-gray-700">Last Login</p>
              <p className="text-sm sm:text-base text-text-body mt-0.5 sm:mt-1">
                {new Date(profile.last_login).toLocaleString('en-US', {
                  year: 'numeric',
                  month: 'short',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          )}
        </div>

        {profile.workshop && (
          <div className="mt-3 sm:mt-4 pt-3 sm:pt-4 border-t border-gray-200">
            <p className="text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2 flex items-center gap-1">
              <Building className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
              Workshop Assignment
            </p>
            <div className="bg-gray-50 p-2.5 sm:p-3 rounded-lg">
              <p className="font-semibold text-sm sm:text-base text-text-heading">{profile.workshop.name}</p>
              <p className="text-xs sm:text-sm text-text-body mt-0.5 sm:mt-1">{profile.workshop.address}</p>
              <p className="text-xs sm:text-sm text-text-body">{profile.workshop.city}</p>
            </div>
          </div>
        )}
      </div>

      {/* Performance Stats (Optional) */}
      <div className="card p-4 sm:p-5 md:p-6">
        <h2 className="text-lg sm:text-xl font-bold text-text-heading mb-3 sm:mb-4">Quick Stats</h2>
        <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-blue-50 rounded-lg">
            <p className="text-2xl sm:text-3xl font-bold text-brand-primary">--</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Total Calls</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-green-50 rounded-lg">
            <p className="text-2xl sm:text-3xl font-bold text-green-600">--</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Leads Created</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-yellow-50 rounded-lg">
            <p className="text-2xl sm:text-3xl font-bold text-yellow-600">--</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Follow-ups</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-purple-50 rounded-lg">
            <p className="text-2xl sm:text-3xl font-bold text-purple-600">--</p>
            <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Conversion Rate</p>
          </div>
        </div>
        <p className="text-[10px] sm:text-xs text-gray-500 text-center mt-2 sm:mt-3">
          Stats will be available once performance metrics are implemented
        </p>
      </div>
    </div>
  );
}

