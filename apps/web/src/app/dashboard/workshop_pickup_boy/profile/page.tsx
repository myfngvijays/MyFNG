'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY } from '@/lib/utils';
import {
  User, Mail, Phone, MapPin, Calendar, Truck, CheckCircle, 
  Award, TrendingUp, Clock, Edit, Save, X, Camera
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
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <User className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-slate-700">Profile not found</h3>
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
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#004AAD]/70">Pickupboy / Driver</p>
            <h1 className="text-2xl font-extrabold text-[#023D95]">My Profile</h1>
            <p className="text-sm text-slate-500">View and manage your profile information</p>
          </div>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#004AAD] px-3.5 py-2 text-sm font-bold text-white"
            >
              <Edit className="h-4 w-4" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSaveProfile}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white"
              >
                <Save className="h-4 w-4" /> Save
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditing(false);
                  setEditedProfile({
                    full_name: profile.full_name,
                    phone: profile.phone
                  });
                }}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-200 px-3.5 py-2 text-sm font-bold text-slate-700"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          )}
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#004AAD]/25 shadow-lg shadow-[#004AAD]/15">
          <div className="bg-gradient-to-br from-[#023D95] via-[#004AAD] to-[#0369A1] px-4 py-5 text-white sm:px-5 sm:py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="relative flex-shrink-0">
                <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center rounded-full border-[3px] border-white/40 bg-white/15 text-2xl font-black">
                  {profile.full_name.charAt(0).toUpperCase()}
                </div>
                <button type="button" className="absolute bottom-0 right-0 rounded-full border-2 border-white/40 bg-white p-1.5 shadow-lg">
                  <Camera className="h-3.5 w-3.5 text-[#004AAD]" />
                </button>
              </div>
              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                    <User className="h-3.5 w-3.5" /> Full Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      value={editedProfile.full_name}
                      onChange={(e) => setEditedProfile({ ...editedProfile, full_name: e.target.value })}
                      className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm font-semibold text-white placeholder:text-blue-100/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                    />
                  ) : (
                    <p className="mt-0.5 text-base font-extrabold text-white">{profile.full_name}</p>
                  )}
                </div>
                <div>
                  <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                    <Mail className="h-3.5 w-3.5" /> Email
                  </label>
                  <p className="mt-0.5 break-all text-sm font-semibold text-white">{profile.email}</p>
                  <p className="text-[11px] text-blue-100/70">Email cannot be changed</p>
                </div>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                      <Phone className="h-3.5 w-3.5" /> Phone
                    </label>
                    {editing ? (
                      <input
                        type="tel"
                        value={editedProfile.phone}
                        onChange={(e) => setEditedProfile({ ...editedProfile, phone: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/40"
                      />
                    ) : (
                      <p className="mt-0.5 text-sm font-semibold text-white">{profile.phone || 'Not provided'}</p>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                      <Truck className="h-3.5 w-3.5" /> Workshop
                    </label>
                    <p className="mt-0.5 text-sm font-semibold text-white">{profile.workshop?.name || 'No workshop assigned'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3 border-t border-[#004AAD]/10 bg-[#F0F7FF] px-4 py-4 text-sm sm:px-5">
            <div>
              <p className="text-xs font-bold text-[#004AAD]/70">Role</p>
              <p className="font-bold text-[#023D95]">Pickupboy / Driver</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs font-bold text-[#004AAD]/70">
                <Calendar className="h-3.5 w-3.5" /> Member Since
              </p>
              <p className="font-semibold text-[#023D95]">{formatDateDMY(profile.created_at)}</p>
            </div>
            <div className="col-span-2">
              <p className="flex items-center gap-1 text-xs font-bold text-[#004AAD]/70">
                <MapPin className="h-3.5 w-3.5" /> Workshop address
              </p>
              <p className="font-semibold text-[#023D95]">
                {profile.workshop
                  ? [profile.workshop.address, profile.workshop.city].filter(Boolean).join(', ')
                  : '—'}
              </p>
            </div>
          </div>
        </section>

        {/* Performance Overview */}
        {metrics && (
          <>
            <div className="overflow-hidden rounded-2xl border border-[#004AAD]/20 bg-gradient-to-br from-[#023D95] via-[#004AAD] to-[#0369A1] p-4 text-white shadow-sm sm:p-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl font-bold mb-1.5 sm:mb-2 text-white">Overall Performance Score</h3>
                  <div className="flex flex-wrap items-baseline gap-2">
                    <p className="text-3xl sm:text-4xl md:text-5xl font-bold">{overallScore}%</p>
                    <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full text-xs sm:text-sm font-bold ${performanceRating.bg} ${performanceRating.color}`}>
                      {performanceRating.label}
                    </span>
                  </div>
                  <p className="text-blue-100/80 text-xs sm:text-sm mt-1.5 sm:mt-2">Based on last 30 days</p>
                </div>
                <Award className="w-16 h-16 sm:w-18 sm:h-18 md:w-20 md:h-20 text-white/40 flex-shrink-0" />
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <h3 className="text-lg sm:text-xl font-bold text-[#023D95] mb-4 sm:mb-5 md:mb-6 flex items-center gap-1.5 sm:gap-2">
                <TrendingUp className="w-5 h-5 sm:w-6 sm:h-6 text-[#004AAD] flex-shrink-0" />
                <span>Performance Metrics (Last 30 Days)</span>
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 mb-4 sm:mb-5 md:mb-6">
                <div className="rounded-2xl border border-white/60 bg-gradient-to-br from-blue-50 to-blue-100 p-3 shadow-sm sm:p-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <span className="text-xs sm:text-sm font-medium text-slate-600">Total Pickups</span>
                    <Truck className="w-4 h-4 sm:w-5 sm:h-5 text-blue-500 flex-shrink-0" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900">{metrics.total_pickups}</p>
                  <p className="text-xs sm:text-sm text-green-600 font-medium mt-0.5 sm:mt-1">
                    {metrics.completed_pickups} completed
                  </p>
                </div>

                <div className="rounded-2xl border border-white/60 bg-gradient-to-br from-purple-50 to-purple-100 p-3 shadow-sm sm:p-4">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <span className="text-xs sm:text-sm font-medium text-slate-600">Total Deliveries</span>
                    <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5 text-purple-500 flex-shrink-0" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900">{metrics.total_drops}</p>
                  <p className="text-xs sm:text-sm text-green-600 font-medium mt-0.5 sm:mt-1">
                    {metrics.completed_drops} completed
                  </p>
                </div>

                <div className="rounded-2xl border border-white/60 bg-gradient-to-br from-amber-50 to-amber-100 p-3 shadow-sm sm:p-4 sm:col-span-2 lg:col-span-1">
                  <div className="flex items-center justify-between mb-1.5 sm:mb-2">
                    <span className="text-xs sm:text-sm font-medium text-slate-600">Distance Traveled</span>
                    <MapPin className="w-4 h-4 sm:w-5 sm:h-5 text-orange-500 flex-shrink-0" />
                  </div>
                  <p className="text-2xl sm:text-3xl font-bold text-slate-900">
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
                    <span className="text-xs sm:text-sm font-bold text-[#004AAD]">
                      {metrics.punctuality_score.toFixed(1)}%
                    </span>
                  </div>
                  <div className="w-full bg-slate-200 rounded-full h-1.5 sm:h-2">
                    <div
                      className="bg-[#004AAD] h-1.5 sm:h-2 rounded-full transition-all"
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
                <div className="rounded-2xl bg-slate-50 p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-slate-600 mb-0.5 sm:mb-1">Avg. Pickup Time</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#023D95]">
                    {metrics.avg_pickup_time.toFixed(0)} mins
                  </p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-3 sm:p-4">
                  <p className="text-xs sm:text-sm text-slate-600 mb-0.5 sm:mb-1">Avg. Drop Time</p>
                  <p className="text-xl sm:text-2xl font-bold text-[#023D95]">
                    {metrics.avg_drop_time.toFixed(0)} mins
                  </p>
                </div>
              </div>

              {/* Customer Complaints */}
              {metrics.customer_complaints > 0 && (
                <div className="mt-3 sm:mt-4 p-3 sm:p-4 bg-red-50 border border-red-200 rounded-2xl">
                  <p className="text-xs sm:text-sm text-red-800">
                    <span className="font-bold">Customer Complaints:</span> {metrics.customer_complaints}
                  </p>
                  <p className="text-[10px] sm:text-xs text-red-600 mt-0.5 sm:mt-1">
                    Please maintain high service quality to avoid complaints
                  </p>
                </div>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
              <div className="flex items-center gap-3 sm:gap-4">
                <Award className="w-10 h-10 text-[#004AAD] flex-shrink-0" />
                <div className="min-w-0 flex-1">
                  <h3 className="text-lg sm:text-xl font-bold text-[#023D95] mb-0.5 sm:mb-1">
                    {performanceRating.label} Performance
                  </h3>
                  <p className="text-slate-600 text-xs sm:text-sm">
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

