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
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-brand-primary" />
        <p className="ml-3 text-text-body">Loading profile...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="text-center py-12 text-text-body">
        <p>Profile not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-6 rounded-lg shadow-lg">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-yellow-300 drop-shadow-lg">My Profile</h1>
            <p className="text-white font-medium mt-1">Manage your personal information</p>
          </div>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-white text-brand-primary rounded-lg hover:bg-gray-100 transition-colors font-medium"
            >
              <Edit2 className="w-4 h-4" />
              Edit Profile
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {saving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  <>
                    <Save className="w-4 h-4" />
                    Save Changes
                  </>
                )}
              </button>
              <button
                onClick={handleCancel}
                disabled={saving}
                className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors font-medium disabled:opacity-50"
              >
                <X className="w-4 h-4" />
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Profile Card */}
      <div className="card p-6">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Profile Image */}
          <div className="flex flex-col items-center space-y-4">
            <div className="relative">
              <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex items-center justify-center">
                {formData.profile_image ? (
                  <Image
                    src={formData.profile_image}
                    alt={formData.full_name}
                    width={128}
                    height={128}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="w-16 h-16 text-gray-400" />
                )}
              </div>
              {isEditing && (
                <label className="absolute bottom-0 right-0 p-2 bg-brand-primary text-white rounded-full cursor-pointer hover:bg-brand-secondary transition-colors">
                  <Camera className="w-4 h-4" />
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
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                profile.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-red-100 text-red-800'
              }`}>
                {profile.is_active ? 'Active' : 'Inactive'}
              </span>
            </div>
          </div>

          {/* Profile Details */}
          <div className="flex-1 space-y-4">
            {/* Full Name */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <User className="w-4 h-4 inline mr-1" />
                Full Name
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.full_name}
                  onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                  className="form-input w-full"
                  placeholder="Enter your full name"
                />
              ) : (
                <p className="text-lg font-semibold text-text-heading">{profile.full_name}</p>
              )}
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Mail className="w-4 h-4 inline mr-1" />
                Email Address
              </label>
              <p className="text-text-body">{profile.email}</p>
              <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
            </div>

            {/* Phone */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Phone className="w-4 h-4 inline mr-1" />
                Phone Number
              </label>
              {isEditing ? (
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="form-input w-full"
                  placeholder="Enter your phone number"
                />
              ) : (
                <p className="text-text-body">{profile.phone || 'Not provided'}</p>
              )}
            </div>

            {/* Department */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                <Building className="w-4 h-4 inline mr-1" />
                Department
              </label>
              {isEditing ? (
                <input
                  type="text"
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value })}
                  className="form-input w-full"
                  placeholder="Enter your department"
                />
              ) : (
                <p className="text-text-body">{profile.department || 'Not specified'}</p>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Additional Information */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-text-heading mb-4">Account Information</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-sm font-medium text-gray-700">Role</p>
            <p className="text-text-body font-semibold mt-1">
              {profile.role?.role_name || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">Role Code</p>
            <p className="text-text-body font-semibold mt-1">
              {profile.role?.role_code || 'N/A'}
            </p>
          </div>
          <div>
            <p className="text-sm font-medium text-gray-700">
              <Calendar className="w-4 h-4 inline mr-1" />
              Member Since
            </p>
            <p className="text-text-body mt-1">
              {new Date(profile.created_at).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric',
              })}
            </p>
          </div>
          {profile.last_login && (
            <div>
              <p className="text-sm font-medium text-gray-700">Last Login</p>
              <p className="text-text-body mt-1">
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
          <div className="mt-4 pt-4 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700 mb-2">
              <Building className="w-4 h-4 inline mr-1" />
              Workshop Assignment
            </p>
            <div className="bg-gray-50 p-3 rounded-lg">
              <p className="font-semibold text-text-heading">{profile.workshop.name}</p>
              <p className="text-sm text-text-body mt-1">{profile.workshop.address}</p>
              <p className="text-sm text-text-body">{profile.workshop.city}</p>
            </div>
          </div>
        )}
      </div>

      {/* Performance Stats (Optional) */}
      <div className="card p-6">
        <h2 className="text-xl font-bold text-text-heading mb-4">Quick Stats</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center p-4 bg-blue-50 rounded-lg">
            <p className="text-3xl font-bold text-brand-primary">--</p>
            <p className="text-sm text-gray-600 mt-1">Total Calls</p>
          </div>
          <div className="text-center p-4 bg-green-50 rounded-lg">
            <p className="text-3xl font-bold text-green-600">--</p>
            <p className="text-sm text-gray-600 mt-1">Leads Created</p>
          </div>
          <div className="text-center p-4 bg-yellow-50 rounded-lg">
            <p className="text-3xl font-bold text-yellow-600">--</p>
            <p className="text-sm text-gray-600 mt-1">Follow-ups</p>
          </div>
          <div className="text-center p-4 bg-purple-50 rounded-lg">
            <p className="text-3xl font-bold text-purple-600">--</p>
            <p className="text-sm text-gray-600 mt-1">Conversion Rate</p>
          </div>
        </div>
        <p className="text-xs text-gray-500 text-center mt-3">
          Stats will be available once performance metrics are implemented
        </p>
      </div>
    </div>
  );
}

