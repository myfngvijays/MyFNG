'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  User, Mail, Phone, Building2, Calendar, 
  Award, TrendingUp, Clock, Save, Camera,
  Edit2, CheckCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface MechanicProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string | null;
  profile_image: string | null;
  workshop_id: string | null;
  workshop_name: string | null;
  created_at: string;
  last_login: string | null;
}

interface PerformanceMetrics {
  total_jobs_completed: number;
  jobs_this_month: number;
  avg_efficiency: number;
  on_time_completion: number;
  total_work_hours: number;
  customer_rating: number;
}

export default function ProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<MechanicProfile | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics>({
    total_jobs_completed: 0,
    jobs_this_month: 0,
    avg_efficiency: 0,
    on_time_completion: 0,
    total_work_hours: 0,
    customer_rating: 0
  });
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    full_name: '',
    phone: ''
  });

  useEffect(() => {
    fetchProfile();
    fetchMetrics();
  }, []);

  async function fetchProfile() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select(`
          id,
          full_name,
          email,
          phone,
          profile_image,
          workshop_id,
          created_at,
          last_login,
          workshops:workshop_id (
            name
          )
        `)
        .eq('email', user.email)
        .single();

      if (userProfile) {
        const profileData: MechanicProfile = {
          id: userProfile.id,
          full_name: userProfile.full_name,
          email: userProfile.email,
          phone: userProfile.phone,
          profile_image: userProfile.profile_image,
          workshop_id: userProfile.workshop_id,
          workshop_name: (userProfile.workshops as any)?.name || null,
          created_at: userProfile.created_at,
          last_login: userProfile.last_login
        };

        setProfile(profileData);
        setFormData({
          full_name: profileData.full_name,
          phone: profileData.phone || ''
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      toast.error('Failed to load profile');
    } finally {
      setLoading(false);
    }
  }

  async function fetchMetrics() {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data: userProfile } = await supabase
        .from('users_login')
        .select('id')
        .eq('email', user.email)
        .single();

      if (!userProfile) return;

      // Total completed jobs
      const { count: totalCompleted } = await supabase
        .from('mechanic_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('mechanic_id', userProfile.id)
        .eq('mechanic_status', 'COMPLETED');

      // Jobs this month
      const firstDayOfMonth = new Date();
      firstDayOfMonth.setDate(1);
      firstDayOfMonth.setHours(0, 0, 0, 0);

      const { count: thisMonthCount } = await supabase
        .from('mechanic_jobs')
        .select('*', { count: 'exact', head: true })
        .eq('mechanic_id', userProfile.id)
        .eq('mechanic_status', 'COMPLETED')
        .gte('completed_at', firstDayOfMonth.toISOString());

      // Performance data
      const { data: performanceData } = await supabase
        .from('mechanic_jobs')
        .select('efficiency_score, actual_work_duration')
        .eq('mechanic_id', userProfile.id)
        .eq('mechanic_status', 'COMPLETED');

      let avgEfficiency = 0;
      let totalHours = 0;
      if (performanceData && performanceData.length > 0) {
        const totalEfficiency = performanceData.reduce((sum, job) => sum + (job.efficiency_score || 0), 0);
        avgEfficiency = totalEfficiency / performanceData.length;
        
        const totalMinutes = performanceData.reduce((sum, job) => sum + (job.actual_work_duration || 0), 0);
        totalHours = Math.round(totalMinutes / 60);
      }

      const onTimeJobs = performanceData?.filter(j => (j.efficiency_score || 0) >= 80).length || 0;
      const onTimePercentage = performanceData && performanceData.length > 0 
        ? Math.round((onTimeJobs / performanceData.length) * 100) 
        : 0;

      setMetrics({
        total_jobs_completed: totalCompleted || 0,
        jobs_this_month: thisMonthCount || 0,
        avg_efficiency: Math.round(avgEfficiency),
        on_time_completion: onTimePercentage,
        total_work_hours: totalHours,
        customer_rating: 4.5 // This should come from customer feedback table
      });

    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }

  async function handleSave() {
    if (!profile) return;
    
    setSaving(true);
    const supabase = createClient();

    try {
      const { error } = await supabase
        .from('users_login')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Profile updated successfully!');
      setEditing(false);
      fetchProfile(); // Refresh data
    } catch (error) {
      console.error('Error updating profile:', error);
      toast.error('Failed to update profile');
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setFormData({
      full_name: profile?.full_name || '',
      phone: profile?.phone || ''
    });
    setEditing(false);
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="text-center py-8 sm:py-10 md:py-12">
          <p className="text-gray-500 text-sm sm:text-base">Profile not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_mechanic">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-brand-heading">My Profile</h1>
          <p className="text-brand-textSecondary text-xs sm:text-sm mt-0.5 sm:mt-1">Manage your profile and view performance</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-5 md:gap-6">
          {/* Profile Card */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 md:p-6 space-y-4 sm:space-y-5 md:space-y-6">
              {/* Profile Picture */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  <div className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full bg-brand-primary flex items-center justify-center text-white text-2xl sm:text-3xl md:text-4xl font-bold">
                    {profile.profile_image ? (
                      <img 
                        src={profile.profile_image} 
                        alt={profile.full_name}
                        className="w-24 h-24 sm:w-28 sm:h-28 md:w-32 md:h-32 rounded-full object-cover"
                      />
                    ) : (
                      profile.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <button className="absolute bottom-0 right-0 bg-brand-primary text-white p-1.5 sm:p-2 rounded-full hover:bg-brand-primaryHover">
                    <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  </button>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-brand-heading mt-3 sm:mt-4">{profile.full_name}</h2>
                <p className="text-brand-textSecondary text-xs sm:text-sm">Workshop Mechanic</p>
              </div>

              {/* Quick Stats */}
              <div className="border-t border-gray-200 pt-4 sm:pt-5 md:pt-6 space-y-3 sm:space-y-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-600">Member Since</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900">
                    {new Date(profile.created_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-600">Total Jobs</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900">{metrics.total_jobs_completed}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm text-gray-600">Rating</span>
                  <span className="text-xs sm:text-sm font-medium text-gray-900 flex items-center gap-1">
                    ⭐ {metrics.customer_rating.toFixed(1)}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-2 space-y-4 sm:space-y-5 md:space-y-6">
            {/* Performance Overview */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 md:p-6">
              <h3 className="text-base sm:text-lg font-semibold text-brand-heading mb-3 sm:mb-4">Performance Overview</h3>
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                <div className="bg-blue-50 p-3 sm:p-4 rounded-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-600">This Month</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-brand-heading">{metrics.jobs_this_month}</p>
                </div>

                <div className="bg-green-50 p-3 sm:p-4 rounded-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                    <TrendingUp className="w-4 h-4 sm:w-5 sm:h-5 text-green-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-600">Efficiency</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-brand-heading">{metrics.avg_efficiency}%</p>
                </div>

                <div className="bg-purple-50 p-3 sm:p-4 rounded-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-600">On-Time</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-brand-heading">{metrics.on_time_completion}%</p>
                </div>

                <div className="bg-orange-50 p-3 sm:p-4 rounded-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-orange-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-600">Total Jobs</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-brand-heading">{metrics.total_jobs_completed}</p>
                </div>

                <div className="bg-indigo-50 p-3 sm:p-4 rounded-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                    <Clock className="w-4 h-4 sm:w-5 sm:h-5 text-indigo-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-600">Work Hours</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-brand-heading">{metrics.total_work_hours}h</p>
                </div>

                <div className="bg-pink-50 p-3 sm:p-4 rounded-lg">
                  <div className="flex items-center gap-1.5 sm:gap-2 mb-1 sm:mb-2">
                    <Award className="w-4 h-4 sm:w-5 sm:h-5 text-pink-600 flex-shrink-0" />
                    <span className="text-xs sm:text-sm text-gray-600">Rating</span>
                  </div>
                  <p className="text-xl sm:text-2xl font-bold text-brand-heading">{metrics.customer_rating.toFixed(1)}/5</p>
                </div>
              </div>
            </div>

            {/* Profile Information */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 sm:p-5 md:p-6">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
                <h3 className="text-base sm:text-lg font-semibold text-brand-heading">Profile Information</h3>
                {!editing ? (
                  <button
                    onClick={() => setEditing(true)}
                    className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-brand-primary border border-brand-primary rounded-lg hover:bg-brand-primary hover:text-white transition-colors text-xs sm:text-sm w-full sm:w-auto"
                  >
                    <Edit2 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                    Edit
                  </button>
                ) : (
                  <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                    <button
                      onClick={handleCancel}
                      disabled={saving}
                      className="px-3 sm:px-4 py-1.5 sm:py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 text-xs sm:text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleSave}
                      disabled={saving}
                      className="flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 bg-brand-primary text-white rounded-lg hover:bg-brand-primaryHover disabled:opacity-50 text-xs sm:text-sm"
                    >
                      <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      {saving ? 'Saving...' : 'Save'}
                    </button>
                  </div>
                )}
              </div>

              <div className="space-y-3 sm:space-y-4">
                {/* Full Name */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2" />
                    Full Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                    />
                  ) : (
                    <p className="text-gray-900 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 rounded-lg">{profile.full_name}</p>
                  )}
                </div>

                {/* Email */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2" />
                    Email
                  </label>
                  <p className="text-gray-900 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 rounded-lg">{profile.email}</p>
                  <p className="text-[10px] sm:text-xs text-gray-500 mt-0.5 sm:mt-1">Email cannot be changed</p>
                </div>

                {/* Phone */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2" />
                    Phone Number
                  </label>
                  {editing ? (
                    <input
                      type="tel"
                      value={formData.phone}
                      onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                      className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                      placeholder="Enter phone number"
                    />
                  ) : (
                    <p className="text-gray-900 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 rounded-lg">{profile.phone || 'Not provided'}</p>
                  )}
                </div>

                {/* Workshop */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    <Building2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2" />
                    Workshop
                  </label>
                  <p className="text-gray-900 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 rounded-lg">{profile.workshop_name || 'Not assigned'}</p>
                </div>

                {/* Last Login */}
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 inline mr-1.5 sm:mr-2" />
                    Last Login
                  </label>
                  <p className="text-gray-900 text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 bg-gray-50 rounded-lg">
                    {profile.last_login 
                      ? new Date(profile.last_login).toLocaleString() 
                      : 'Never'
                    }
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

