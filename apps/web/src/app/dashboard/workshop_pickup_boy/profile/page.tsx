'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { 
  User, Mail, Phone, MapPin, Calendar, Truck, CheckCircle, 
  Award, TrendingUp, Clock, Star, Edit, Save, X, Camera
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  profile_image: string;
  created_at: string;
  workshop_id: string;
  workshop?: {
    name: string;
    address: string;
    city: string;
  };
}

interface PerformanceMetrics {
  total_pickups: number;
  completed_pickups: number;
  failed_pickups: number;
  total_drops: number;
  completed_drops: number;
  failed_drops: number;
  avg_pickup_time: number;
  avg_drop_time: number;
  punctuality_score: number;
  otp_success_rate: number;
  photo_compliance_rate: number;
  customer_complaints: number;
  distance_traveled: number;
}

export default function PickupBoyProfilePage() {
  const router = useRouter();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [editedProfile, setEditedProfile] = useState({
    full_name: '',
    phone: ''
  });

  useEffect(() => {
    fetchProfile();
    fetchMetrics();
  }, []);

  async function fetchProfile() {
    const supabase = createClient();
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login');
        return;
      }

      const { data, error } = await supabase
        .from('users_login')
        .select(`
          *,
          workshop:workshop_id (
            name,
            address,
            city
          )
        `)
        .eq('email', user.email)
        .single();

      if (error) {
        console.error('Error fetching profile:', error);
        toast.error('Failed to fetch profile');
        return;
      }

      setProfile(data);
      setEditedProfile({
        full_name: data.full_name || '',
        phone: data.phone || ''
      });

    } catch (error) {
      console.error('Error:', error);
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

      // Get aggregated metrics from pickup_boy_metrics table
      const { data: metricsData } = await supabase
        .from('pickup_boy_metrics')
        .select('*')
        .eq('pickup_boy_id', userProfile.id)
        .order('date', { ascending: false })
        .limit(30); // Last 30 days

      if (metricsData && metricsData.length > 0) {
        // Aggregate metrics
        const aggregated = metricsData.reduce((acc, curr) => ({
          total_pickups: acc.total_pickups + (curr.total_pickups || 0),
          completed_pickups: acc.completed_pickups + (curr.completed_pickups || 0),
          failed_pickups: acc.failed_pickups + (curr.failed_pickups || 0),
          total_drops: acc.total_drops + (curr.total_drops || 0),
          completed_drops: acc.completed_drops + (curr.completed_drops || 0),
          failed_drops: acc.failed_drops + (curr.failed_drops || 0),
          avg_pickup_time: acc.avg_pickup_time + (curr.avg_pickup_time || 0),
          avg_drop_time: acc.avg_drop_time + (curr.avg_drop_time || 0),
          punctuality_score: acc.punctuality_score + (curr.punctuality_score || 0),
          otp_success_rate: acc.otp_success_rate + (curr.otp_success_rate || 0),
          photo_compliance_rate: acc.photo_compliance_rate + (curr.photo_compliance_rate || 0),
          customer_complaints: acc.customer_complaints + (curr.customer_complaints || 0),
          distance_traveled: acc.distance_traveled + (curr.distance_traveled || 0)
        }), {
          total_pickups: 0,
          completed_pickups: 0,
          failed_pickups: 0,
          total_drops: 0,
          completed_drops: 0,
          failed_drops: 0,
          avg_pickup_time: 0,
          avg_drop_time: 0,
          punctuality_score: 0,
          otp_success_rate: 0,
          photo_compliance_rate: 0,
          customer_complaints: 0,
          distance_traveled: 0
        });

        // Calculate averages
        const count = metricsData.length;
        aggregated.avg_pickup_time = aggregated.avg_pickup_time / count;
        aggregated.avg_drop_time = aggregated.avg_drop_time / count;
        aggregated.punctuality_score = aggregated.punctuality_score / count;
        aggregated.otp_success_rate = aggregated.otp_success_rate / count;
        aggregated.photo_compliance_rate = aggregated.photo_compliance_rate / count;

        setMetrics(aggregated);
      }

    } catch (error) {
      console.error('Error fetching metrics:', error);
    }
  }

  async function handleSaveProfile() {
    const supabase = createClient();

    try {
      if (!profile) return;

      const { error } = await supabase
        .from('users_login')
        .update({
          full_name: editedProfile.full_name,
          phone: editedProfile.phone,
          updated_at: new Date().toISOString()
        })
        .eq('id', profile.id);

      if (error) {
        console.error('Error updating profile:', error);
        toast.error('Failed to update profile');
        return;
      }

      toast.success('Profile updated successfully!');
      setEditing(false);
      fetchProfile();

    } catch (error) {
      console.error('Error:', error);
      toast.error('Failed to save changes');
    }
  }

  function getPerformanceRating(score: number) {
    if (score >= 90) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-100' };
    if (score >= 75) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-100' };
    if (score >= 60) return { label: 'Average', color: 'text-yellow-600', bg: 'bg-yellow-100' };
    return { label: 'Needs Improvement', color: 'text-red-600', bg: 'bg-red-100' };
  }

  if (loading) {
    return (
      <DashboardLayout role="workshop_pickup_boy">
        <div className="flex items-center justify-center h-48 sm:h-64">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-brand-primary"></div>
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout role="workshop_pickup_boy">
        <div className="card text-center py-8 sm:py-10 md:py-12">
          <User className="w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 text-gray-400 mx-auto mb-3 sm:mb-4" />
          <h3 className="text-lg sm:text-xl font-semibold text-gray-700">Profile not found</h3>
        </div>
      </DashboardLayout>
    );
  }

  const overallScore = metrics ? (
    (metrics.punctuality_score + metrics.otp_success_rate + metrics.photo_compliance_rate) / 3
  ).toFixed(1) : 0;

  const performanceRating = getPerformanceRating(Number(overallScore));

  return (
    <DashboardLayout role="workshop_pickup_boy">
      <div className="space-y-4 sm:space-y-5 md:space-y-6">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-secondary to-brand-primary text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg">
          <h1 className="text-xl sm:text-2xl md:text-3xl font-bold text-yellow-300 drop-shadow-lg">👤 My Profile</h1>
          <p className="text-white font-medium text-xs sm:text-sm md:text-base mt-0.5 sm:mt-1">View and manage your profile information</p>
        </div>

        {/* Profile Card */}
        <div className="card">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
            <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
              <div className="relative flex-shrink-0">
                <div className="w-20 h-20 sm:w-22 sm:h-22 md:w-24 md:h-24 rounded-full bg-gradient-to-br from-brand-primary to-brand-secondary flex items-center justify-center text-white text-2xl sm:text-3xl font-bold shadow-lg">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
                <button className="absolute bottom-0 right-0 bg-white rounded-full p-1.5 sm:p-2 shadow-lg border-2 border-gray-200 hover:bg-gray-50 transition">
                  <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600" />
                </button>
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-text-heading truncate">{profile.full_name}</h2>
                <p className="text-gray-600 font-medium text-xs sm:text-sm">Pickup Boy / Driver</p>
                <p className="text-xs sm:text-sm text-gray-500 mt-0.5 sm:mt-1">
                  Member since {new Date(profile.created_at).toLocaleDateString()}
                </p>
              </div>
            </div>
            {!editing ? (
              <button
                onClick={() => setEditing(true)}
                className="btn bg-brand-primary hover:bg-brand-secondary text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center gap-1.5 sm:gap-2 w-full sm:w-auto"
              >
                <Edit className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                Edit Profile
              </button>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                <button
                  onClick={handleSaveProfile}
                  className="btn bg-green-500 hover:bg-green-600 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Save
                </button>
                <button
                  onClick={() => {
                    setEditing(false);
                    setEditedProfile({
                      full_name: profile.full_name,
                      phone: profile.phone
                    });
                  }}
                  className="btn bg-gray-500 hover:bg-gray-600 text-white text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2 flex items-center justify-center gap-1.5 sm:gap-2"
                >
                  <X className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                  Cancel
                </button>
              </div>
            )}
          </div>

          {/* Profile Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-5 md:gap-6">
            {/* Basic Info */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-text-heading mb-3 sm:mb-4 border-b pb-1.5 sm:pb-2">
                Basic Information
              </h3>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5 sm:gap-2">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  Full Name
                </label>
                {editing ? (
                  <input
                    type="text"
                    value={editedProfile.full_name}
                    onChange={(e) => setEditedProfile({ ...editedProfile, full_name: e.target.value })}
                    className="input text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  />
                ) : (
                  <p className="text-text-heading font-semibold text-sm sm:text-base">{profile.full_name}</p>
                )}
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5 sm:gap-2">
                  <Mail className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  Email
                </label>
                <p className="text-text-heading font-semibold text-sm sm:text-base">{profile.email}</p>
                <p className="text-[10px] sm:text-xs text-gray-500">Email cannot be changed</p>
              </div>

              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5 sm:gap-2">
                  <Phone className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  Phone
                </label>
                {editing ? (
                  <input
                    type="tel"
                    value={editedProfile.phone}
                    onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                    className="input text-xs sm:text-sm px-3 sm:px-4 py-1.5 sm:py-2"
                  />
                ) : (
                  <p className="text-text-heading font-semibold text-sm sm:text-base">{profile.phone || 'Not provided'}</p>
                )}
              </div>
            </div>

            {/* Workshop Info */}
            <div className="space-y-3 sm:space-y-4">
              <h3 className="text-base sm:text-lg font-bold text-text-heading mb-3 sm:mb-4 border-b pb-1.5 sm:pb-2">
                Workshop Details
              </h3>

              {profile.workshop ? (
                <>
                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5 sm:gap-2">
                      <Truck className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      Workshop Name
                    </label>
                    <p className="text-text-heading font-semibold text-sm sm:text-base">{profile.workshop.name}</p>
                  </div>

                  <div className="space-y-1.5 sm:space-y-2">
                    <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5 sm:gap-2">
                      <MapPin className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                      Address
                    </label>
                    <p className="text-text-heading text-sm sm:text-base">
                      {profile.workshop.address}
                      <br />
                      {profile.workshop.city}
                    </p>
                  </div>
                </>
              ) : (
                <p className="text-gray-500 text-xs sm:text-sm">No workshop assigned</p>
              )}

              <div className="space-y-1.5 sm:space-y-2">
                <label className="text-xs sm:text-sm font-medium text-gray-700 flex items-center gap-1.5 sm:gap-2">
                  <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 flex-shrink-0" />
                  Joined Date
                </label>
                <p className="text-text-heading font-semibold text-sm sm:text-base">
                  {new Date(profile.created_at).toLocaleDateString('en-IN', {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                  })}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Performance Overview */}
        {metrics && (
          <>
            {/* Overall Score */}
            <div className="card bg-gradient-to-br from-brand-primary to-brand-secondary text-white">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2 text-yellow-300">Overall Performance Score</h3>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-3xl sm:text-4xl md:text-5xl font-bold">{overallScore}%</p>
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold ${performanceRating.bg} ${performanceRating.color}`}>
                      {performanceRating.label}
                    </span>
                  </div>
                  <p className="text-white/80 text-xs sm:text-sm mt-1.5 sm:mt-2">Based on last 30 days</p>
                </div>
                <Award className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 text-yellow-300 opacity-50 flex-shrink-0" />
              </div>
            </div>

            {/* Performance Metrics */}
            <div className="card">
              <h3 className="text-lg sm:text-xl font-bold text-text-heading mb-4 sm:mb-5 md:mb-6 flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-brand-primary flex-shrink-0" />
                <span>Performance Metrics (Last 30 Days)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
                <div className="p-3 sm:p-4 bg-blue-50 rounded-lg border-l-4 border-blue-500">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Total Pickups</span>
                    <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-blue-600">{metrics.total_pickups}</p>
                  <p className="text-xs sm:text-sm text-green-600 font-medium mt-0.5 sm:mt-1">
                    {metrics.completed_pickups} completed
                  </p>
                </div>

                <div className="p-3 sm:p-4 bg-purple-50 rounded-lg border-l-4 border-purple-500">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Total Deliveries</span>
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 flex-shrink-0" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-purple-600">{metrics.total_drops}</p>
                  <p className="text-xs sm:text-sm text-green-600 font-medium mt-0.5 sm:mt-1">
                    {metrics.completed_drops} completed
                  </p>
                </div>

                <div className="p-3 sm:p-4 bg-orange-50 rounded-lg border-l-4 border-orange-500 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <span className="text-xs sm:text-sm font-medium text-gray-700">Distance Traveled</span>
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 flex-shrink-0" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-orange-600">
                    {metrics.distance_traveled.toFixed(0)} km
                  </p>
                </div>
              </div>

              {/* Quality Metrics */}
              <div className="space-y-3 sm:space-y-4">
                <h4 className="font-bold text-gray-700 text-sm sm:text-base mb-2 sm:mb-3">Quality Metrics</h4>

                {/* Punctuality Score */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Punctuality Score</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-brand-primary">
                      {metrics.punctuality_score.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                    <div
                      className="bg-brand-primary h-1.5 sm:h-2 rounded-full transition-all"
                      style={{ width: `${metrics.punctuality_score}%` }}
                    ></div>
                  </div>
                </div>

                {/* OTP Success Rate */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-medium text-gray-700">OTP Success Rate</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-green-600">
                      {metrics.otp_success_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                    <div
                      className="bg-green-500 h-1.5 sm:h-2 rounded-full transition-all"
                      style={{ width: `${metrics.otp_success_rate}%` }}
                    ></div>
                  </div>
                </div>

                {/* Photo Compliance */}
                <div>
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <div className="flex items-center gap-1.5 sm:gap-2">
                      <Camera className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-gray-600 flex-shrink-0" />
                      <span className="text-xs sm:text-sm font-medium text-gray-700">Photo Compliance Rate</span>
                    </div>
                    <span className="text-xs sm:text-sm font-bold text-blue-600">
                      {metrics.photo_compliance_rate.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2">
                    <div
                      className="bg-blue-500 h-1.5 sm:h-2 rounded-full transition-all"
                      style={{ width: `${metrics.photo_compliance_rate}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              {/* Average Times */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mt-4 sm:mt-5 md:mt-6">
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Avg. Pickup Time</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-800">
                    {metrics.avg_pickup_time.toFixed(0)} mins
                  </p>
                </div>
                <div className="p-3 sm:p-4 bg-gray-50 rounded-lg">
                  <p className="text-xs sm:text-sm text-gray-600 mb-0.5 sm:mb-1">Avg. Drop Time</p>
                  <p className="text-xl sm:text-2xl font-bold text-gray-800">
                    {metrics.avg_drop_time.toFixed(0)} mins
                  </p>
                </div>
              </div>

              {/* Customer Complaints */}
              {metrics.customer_complaints > 0 && (
                <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-lg">
                  <p className="text-xs sm:text-sm text-red-800">
                    <span className="font-bold">Customer Complaints:</span> {metrics.customer_complaints}
                  </p>
                  <p className="text-[10px] sm:text-xs text-red-600 mt-0.5 sm:mt-1">
                    Please maintain high service quality to avoid complaints
                  </p>
                </div>
              )}
            </div>

            {/* Performance Badge */}
            <div className="card bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-300">
              <div className="flex items-center gap-3 sm:gap-4">
                <div className="text-4xl sm:text-5xl md:text-6xl flex-shrink-0">
                  {performanceRating.label === 'Excellent' && '🏆'}
                  {performanceRating.label === 'Good' && '⭐'}
                  {performanceRating.label === 'Average' && '👍'}
                  {performanceRating.label === 'Needs Improvement' && '📈'}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl font-bold text-gray-800 mb-0.5 sm:mb-1">
                    {performanceRating.label} Performance!
                  </h3>
                  <p className="text-gray-600 text-xs sm:text-sm">
                    {performanceRating.label === 'Excellent' && 'Outstanding work! Keep it up!'}
                    {performanceRating.label === 'Good' && 'You are doing great! Keep improving!'}
                    {performanceRating.label === 'Average' && 'Good work! Aim for higher scores!'}
                    {performanceRating.label === 'Needs Improvement' && 'Focus on improving your metrics.'}
                  </p>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}

