'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import DashboardLayout from '@/components/DashboardLayout';
import { formatDateDMY, formatDateTime } from '@/lib/utils';
import {
  User, Mail, Phone, Building2, Calendar, 
  Award, TrendingUp, Clock, Save, Camera,
  Edit2, CheckCircle, X, Loader2
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
        <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" /> Loading…
        </div>
      </DashboardLayout>
    );
  }

  if (!profile) {
    return (
      <DashboardLayout role="workshop_mechanic">
        <div className="text-center py-8 sm:py-10 md:py-12">
          <p className="text-slate-500 text-sm">Profile not found</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout role="workshop_mechanic">
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-wider text-[#004AAD]/70">Workshop Mechanic</p>
            <h1 className="text-2xl font-extrabold text-[#023D95]">My Profile</h1>
            <p className="text-sm text-slate-500">Manage your profile and view performance</p>
          </div>
          {!editing ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[#004AAD] px-3.5 py-2 text-sm font-bold text-white"
            >
              <Edit2 className="h-4 w-4" /> Edit
            </button>
          ) : (
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                type="button"
                onClick={handleCancel}
                disabled={saving}
                className="inline-flex items-center gap-1.5 rounded-xl bg-slate-200 px-3.5 py-2 text-sm font-bold text-slate-700"
              >
                <X className="h-4 w-4" /> Cancel
              </button>
            </div>
          )}
        </div>

        <section className="overflow-hidden rounded-2xl border border-[#004AAD]/25 shadow-lg shadow-[#004AAD]/15">
          <div className="bg-gradient-to-br from-[#023D95] via-[#004AAD] to-[#0369A1] px-4 py-5 text-white sm:px-5 sm:py-6">
            <div className="flex flex-col gap-4 sm:flex-row">
              <div className="flex shrink-0 flex-col items-center gap-2">
                <div className="relative">
                  <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-full border-[3px] border-white/40 bg-white text-2xl font-bold text-[#004AAD]">
                    {profile.profile_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={profile.profile_image}
                        alt={profile.full_name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      profile.full_name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <button
                    type="button"
                    className="absolute bottom-0 right-0 rounded-full bg-white p-1.5 text-[#004AAD] shadow"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>
                <span className="rounded-full bg-emerald-400/25 px-2.5 py-0.5 text-xs font-bold text-emerald-100 ring-1 ring-emerald-300/40">
                  Workshop Mechanic
                </span>
              </div>

              <div className="min-w-0 flex-1 space-y-3">
                <div>
                  <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                    <User className="h-3.5 w-3.5" /> Full Name
                  </label>
                  {editing ? (
                    <input
                      type="text"
                      className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm font-semibold text-white placeholder:text-blue-100/50 focus:outline-none focus:ring-2 focus:ring-white/40"
                      value={formData.full_name}
                      onChange={(e) => setFormData({ ...formData, full_name: e.target.value })}
                    />
                  ) : (
                    <p className="mt-0.5 text-base font-extrabold text-white">{profile.full_name || '—'}</p>
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
                        className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-white/40"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="Enter phone number"
                      />
                    ) : (
                      <p className="mt-0.5 text-sm font-semibold text-white">{profile.phone || 'Not provided'}</p>
                    )}
                  </div>
                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                      <Building2 className="h-3.5 w-3.5" /> Workshop
                    </label>
                    <p className="mt-0.5 text-sm font-semibold text-white">{profile.workshop_name || 'Not assigned'}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 border-t border-[#004AAD]/10 bg-[#F0F7FF] px-4 py-4 text-sm sm:px-5">
            <div>
              <p className="text-xs font-bold text-[#004AAD]/70">Role</p>
              <p className="font-bold text-[#023D95]">Workshop Mechanic</p>
            </div>
            <div>
              <p className="text-xs font-bold text-[#004AAD]/70">Rating</p>
              <p className="font-bold text-[#023D95]">{metrics.customer_rating.toFixed(1)}/5</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs font-bold text-[#004AAD]/70">
                <Calendar className="h-3.5 w-3.5" /> Member Since
              </p>
              <p className="font-semibold text-[#023D95]">{formatDateDMY(profile.created_at)}</p>
            </div>
            <div>
              <p className="flex items-center gap-1 text-xs font-bold text-[#004AAD]/70">
                <Calendar className="h-3.5 w-3.5" /> Last Login
              </p>
              <p className="font-semibold text-[#023D95]">
                {profile.last_login ? formatDateTime(profile.last_login) : 'Never'}
              </p>
            </div>
          </div>
        </section>

        <div>
          <h3 className="mb-3 text-base font-bold text-[#023D95]">Performance Overview</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="rounded-2xl bg-blue-50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <CheckCircle className="h-4 w-4 text-blue-600" />
                <span className="text-xs text-slate-600">This Month</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{metrics.jobs_this_month}</p>
            </div>
            <div className="rounded-2xl bg-green-50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-xs text-slate-600">Efficiency</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{metrics.avg_efficiency}%</p>
            </div>
            <div className="rounded-2xl bg-purple-50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-purple-600" />
                <span className="text-xs text-slate-600">On-Time</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{metrics.on_time_completion}%</p>
            </div>
            <div className="rounded-2xl bg-orange-50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-orange-600" />
                <span className="text-xs text-slate-600">Total Jobs</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{metrics.total_jobs_completed}</p>
            </div>
            <div className="rounded-2xl bg-indigo-50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <Clock className="h-4 w-4 text-indigo-600" />
                <span className="text-xs text-slate-600">Work Hours</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{metrics.total_work_hours}h</p>
            </div>
            <div className="rounded-2xl bg-pink-50 p-3 sm:p-4">
              <div className="mb-1 flex items-center gap-1.5">
                <Award className="h-4 w-4 text-pink-600" />
                <span className="text-xs text-slate-600">Rating</span>
              </div>
              <p className="text-xl font-bold text-slate-900">{metrics.customer_rating.toFixed(1)}/5</p>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

