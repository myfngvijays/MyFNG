'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';
import { formatDateDMY, formatDateTime } from '@/lib/utils';
import {
  Loader2,
  User,
  LogOut,
  Clock,
  CheckCircle,
  Edit2,
  Save,
  X,
  Mail,
  Phone,
  Building,
  Calendar,
  History,
  Camera,
} from 'lucide-react';

type Profile = {
  id: string;
  email: string;
  phone: string | null;
  full_name: string;
  profile_image: string | null;
  department: string | null;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
  role: { role_name: string; role_code: string } | null;
};

type LoginHistoryRow = {
  id: string;
  logged_in_at: string;
  platform?: string | null;
};

function splitFullName(full: string): { first_name: string; last_name: string } {
  const t = String(full || '').trim();
  if (!t) return { first_name: '', last_name: '' };
  const i = t.indexOf(' ');
  if (i < 0) return { first_name: t, last_name: '' };
  return { first_name: t.slice(0, i), last_name: t.slice(i + 1).trim() };
}

function joinName(first: string, last: string): string {
  return [first, last]
    .map((s) => String(s || '').trim())
    .filter(Boolean)
    .join(' ');
}

export default function TelecallerMyProfilePage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [punching, setPunching] = useState(false);
  const [attendance, setAttendance] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [loginTotal, setLoginTotal] = useState(0);
  const [loginRecent, setLoginRecent] = useState<LoginHistoryRow[]>([]);
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    phone: '',
    department: '',
    profile_image: '',
  });

  const loadAttendance = useCallback(async () => {
    try {
      const res = await fetch('/api/telecaller/crm/attendance');
      const json = await res.json();
      if (!res.ok) {
        setAttendance({ is_punched_in: false, history: [], warning: json?.error });
      } else {
        setAttendance(json);
      }
    } catch (e: any) {
      setAttendance({ is_punched_in: false, history: [], warning: e?.message });
    }
  }, []);

  const applyProfileToForm = useCallback((p: Profile) => {
    const parts = splitFullName(p.full_name || '');
    setFormData({
      first_name: parts.first_name,
      last_name: parts.last_name,
      phone: p.phone || '',
      department: p.department || '',
      profile_image: p.profile_image || '',
    });
  }, []);

  const loadProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/profile');
      const data = await res.json();
      if (res.ok && data.profile) {
        setProfile(data.profile);
        applyProfileToForm(data.profile);
      }
    } catch {
      setProfile(null);
    }
  }, [applyProfileToForm]);

  const loadLoginHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/profile/login-history');
      const data = await res.json();
      if (res.ok) {
        setLoginTotal(Number(data.total || 0));
        setLoginRecent(Array.isArray(data.recent) ? data.recent.slice(0, 5) : []);
      }
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([loadProfile(), loadAttendance(), loadLoginHistory()]);
      setLoading(false);
    })();
  }, [loadProfile, loadAttendance, loadLoginHistory]);

  const punch = async (action: 'punch_in' | 'punch_out') => {
    setPunching(true);
    try {
      const res = await fetch('/api/telecaller/crm/attendance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed');
      await loadAttendance();
    } catch (e: any) {
      alert(
        e?.message?.includes('telecaller_attendance') || e?.message?.includes('relation')
          ? 'Run database migration 282_telecaller_crm_advanced.sql first'
          : e?.message || 'Failed',
      );
    } finally {
      setPunching(false);
    }
  };

  const saveProfile = async (overrides?: Partial<typeof formData>) => {
    const next = { ...formData, ...overrides };
    const full_name = joinName(next.first_name, next.last_name);
    const res = await fetch('/api/profile', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        full_name,
        phone: next.phone,
        department: next.department,
        profile_image: next.profile_image || null,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.error || 'Failed to update');
    setProfile(data.profile);
    applyProfileToForm(data.profile);
    return data.profile as Profile;
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await saveProfile();
      setIsEditing(false);
      toast.success('Profile updated');
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    if (profile) applyProfileToForm(profile);
    setIsEditing(false);
  };

  const handleImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('Please choose an image');
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Image must be under 2MB');
      return;
    }
    const reader = new FileReader();
    reader.onloadend = async () => {
      const dataUrl = String(reader.result || '');
      setFormData((f) => ({ ...f, profile_image: dataUrl }));
      if (!isEditing) {
        setSaving(true);
        try {
          await saveProfile({ profile_image: dataUrl });
          toast.success('Photo updated');
        } catch (err: any) {
          toast.error(err?.message || 'Failed to upload photo');
        } finally {
          setSaving(false);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const logout = async () => {
    // Prefer shared punch-out helper (also covers header logout path)
    try {
      const { ensureTelecallerPunchOutOnLogout } = await import(
        '@/lib/telecaller/ensurePunchInOnLogin'
      );
      await ensureTelecallerPunchOutOnLogout();
    } catch {
      /* ignore */
    }
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push('/login');
  };

  const history = Array.isArray(attendance?.history) ? attendance.history : [];
  const displayFirst = formData.first_name || splitFullName(profile?.full_name || '').first_name;
  const displayLast = formData.last_name || splitFullName(profile?.full_name || '').last_name;
  const avatarSrc = formData.profile_image || profile?.profile_image || '';

  return (
    <DashboardLayout role="telecaller">
      <div className="mx-auto max-w-3xl space-y-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#023D95]">My Profile</h1>
            <p className="text-sm text-slate-500">Profile, attendance & account in one place</p>
          </div>
          {!loading && profile ? (
            !isEditing ? (
              <button
                type="button"
                onClick={() => setIsEditing(true)}
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
                  Save
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
            )
          ) : null}
        </div>

        {loading ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <>
            {/* Profile — MyFNG premium blue */}
            <section className="overflow-hidden rounded-2xl border border-[#004AAD]/25 shadow-lg shadow-[#004AAD]/15">
              <div className="bg-gradient-to-br from-[#023D95] via-[#004AAD] to-[#0369A1] px-4 py-5 sm:px-5 sm:py-6 text-white">
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex flex-col items-center gap-2 shrink-0">
                  <div className="relative">
                    <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-full border-[3px] border-white/40 bg-white text-3xl font-extrabold text-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={avatarSrc || '/profile-default.png'}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={saving}
                      className="absolute -bottom-0.5 -right-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-[#FACC15] text-[#023D95] shadow-md hover:bg-yellow-300 disabled:opacity-60"
                      title="Upload photo"
                      aria-label="Upload profile photo"
                    >
                      {saving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <Camera className="h-3.5 w-3.5" />
                      )}
                    </button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleImagePick}
                    />
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      attendance?.is_punched_in
                        ? 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/40'
                        : 'bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/40'
                    }`}
                  >
                    {attendance?.is_punched_in ? 'On Floor' : 'Off Duty'}
                  </span>
                  <p className="text-[10px] text-blue-100/80">Tap camera to upload DP</p>
                </div>

                <div className="flex-1 min-w-0 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                        <User className="h-3.5 w-3.5" /> First Name
                      </label>
                      {isEditing ? (
                        <input
                          className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm font-semibold text-white placeholder:text-blue-100/50 focus:outline-none focus:ring-2 focus:ring-yellow-300/50"
                          value={formData.first_name}
                          onChange={(e) =>
                            setFormData((f) => ({ ...f, first_name: e.target.value }))
                          }
                          placeholder="First name"
                        />
                      ) : (
                        <p className="mt-0.5 text-base font-extrabold text-white">
                          {displayFirst || '—'}
                        </p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-blue-100/90">Last Name</label>
                      {isEditing ? (
                        <input
                          className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm font-semibold text-white placeholder:text-blue-100/50 focus:outline-none focus:ring-2 focus:ring-yellow-300/50"
                          value={formData.last_name}
                          onChange={(e) =>
                            setFormData((f) => ({ ...f, last_name: e.target.value }))
                          }
                          placeholder="Last name"
                        />
                      ) : (
                        <p className="mt-0.5 text-base font-extrabold text-white">
                          {displayLast || '—'}
                        </p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </label>
                    <p className="mt-0.5 text-sm font-semibold text-white break-all">{profile?.email || '—'}</p>
                    <p className="text-[11px] text-blue-100/70">Email cannot be changed</p>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                        <Phone className="h-3.5 w-3.5" /> Phone
                      </label>
                      {isEditing ? (
                        <input
                          className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-yellow-300/50"
                          value={formData.phone}
                          onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                        />
                      ) : (
                        <p className="mt-0.5 text-sm font-semibold text-white">{profile?.phone || 'Not provided'}</p>
                      )}
                    </div>

                    <div>
                      <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                        <Building className="h-3.5 w-3.5" /> Department
                      </label>
                      {isEditing ? (
                        <input
                          className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm font-semibold text-white placeholder:text-blue-100/50 focus:outline-none focus:ring-2 focus:ring-yellow-300/50"
                          value={formData.department}
                          onChange={(e) => setFormData((f) => ({ ...f, department: e.target.value }))}
                          placeholder="Enter department"
                        />
                      ) : (
                        <p className="mt-0.5 text-sm font-semibold text-white">
                          {profile?.department || 'Not specified'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              </div>

              <div className="grid grid-cols-2 gap-3 bg-[#F0F7FF] px-4 py-4 sm:px-5 text-sm border-t border-[#004AAD]/10">
                <div>
                  <p className="text-xs font-bold text-[#004AAD]/70">Role</p>
                  <p className="font-bold text-[#023D95]">
                    {profile?.role?.role_name || 'Telecaller'}
                  </p>
                </div>
                <div>
                  <p className="text-xs font-bold text-[#004AAD]/70">Role Code</p>
                  <p className="font-bold text-[#023D95]">
                    {profile?.role?.role_code || 'TELECALLER'}
                  </p>
                </div>
                <div>
                  <p className="flex items-center gap-1 text-xs font-bold text-[#004AAD]/70">
                    <Calendar className="h-3.5 w-3.5" /> Member Since
                  </p>
                  <p className="font-semibold text-[#023D95]">
                    {profile?.created_at ? formatDateDMY(profile.created_at) : '—'}
                  </p>
                </div>
                {profile?.last_login ? (
                  <div>
                    <p className="text-xs font-bold text-[#004AAD]/70">Last Login</p>
                    <p className="font-semibold text-[#023D95]">{formatDateTime(profile.last_login)}</p>
                  </div>
                ) : null}
              </div>
            </section>

            {/* Attendance */}
            <section className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm space-y-3">
              <h2 className="text-base font-bold text-[#023D95]">Attendance</h2>
              <p className="text-sm text-slate-500">
                Punch in when you start calling. Punch out when you leave.
              </p>

              <div
                className={`flex items-center gap-3 rounded-xl border p-3.5 ${
                  attendance?.is_punched_in
                    ? 'border-emerald-200 bg-emerald-50/50'
                    : 'border-amber-200 bg-amber-50/50'
                }`}
              >
                {attendance?.is_punched_in ? (
                  <CheckCircle className="h-7 w-7 text-emerald-600 shrink-0" />
                ) : (
                  <Clock className="h-7 w-7 text-amber-600 shrink-0" />
                )}
                <div>
                  <p className="font-bold text-slate-900">
                    {attendance?.is_punched_in ? 'Currently On Floor' : 'Currently Off Duty'}
                  </p>
                  <p className="text-xs text-slate-500">
                    {attendance?.open_session?.punch_in_at
                      ? `In since ${new Date(attendance.open_session.punch_in_at).toLocaleString('en-IN')}`
                      : 'No open session'}
                  </p>
                </div>
              </div>

              {attendance?.warning ? (
                <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  {attendance.warning}
                </p>
              ) : null}

              <button
                type="button"
                disabled={punching}
                onClick={() => punch(attendance?.is_punched_in ? 'punch_out' : 'punch_in')}
                className={`w-full rounded-xl py-3 text-sm font-extrabold text-white disabled:opacity-60 ${
                  attendance?.is_punched_in ? 'bg-red-600' : 'bg-emerald-600'
                }`}
              >
                {punching ? 'Please wait…' : attendance?.is_punched_in ? 'Punch Out' : 'Punch In'}
              </button>

              <div>
                <h3 className="mb-2 text-sm font-bold text-slate-700">Recent Timings</h3>
                {history.length === 0 ? (
                  <p className="text-sm text-slate-500">No attendance records yet</p>
                ) : (
                  <div className="space-y-2">
                    {history.slice(0, 7).map((row: any) => (
                      <div
                        key={row.id}
                        className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2.5 text-sm"
                      >
                        <span className="font-bold text-slate-800">{row.work_date}</span>
                        <span className="text-slate-500">
                          In:{' '}
                          {row.punch_in_at
                            ? new Date(row.punch_in_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                        <span className="text-slate-500">
                          Out:{' '}
                          {row.punch_out_at
                            ? new Date(row.punch_out_at).toLocaleTimeString('en-IN', {
                                hour: '2-digit',
                                minute: '2-digit',
                              })
                            : '—'}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </section>

            {/* Login history (compact) */}
            <section className="rounded-2xl border border-slate-100 bg-white p-4 sm:p-5 shadow-sm">
              <div className="mb-3 flex items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-base font-bold text-[#023D95]">
                  <History className="h-4 w-4" /> Login History
                </h2>
                <span className="rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-bold text-[#004AAD]">
                  {loginTotal} total
                </span>
              </div>
              {loginRecent.length === 0 ? (
                <p className="text-sm text-slate-500">No login history yet</p>
              ) : (
                <ul className="space-y-2">
                  {loginRecent.map((row) => (
                    <li
                      key={row.id}
                      className="rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2 text-sm"
                    >
                      <p className="font-semibold text-slate-900">
                        {formatDateTime(row.logged_in_at)}
                      </p>
                      <p className="text-xs text-slate-500">
                        Platform: {String(row.platform || 'web').replace(/_/g, ' ')}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <button
              type="button"
              onClick={logout}
              className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-800 py-3 text-sm font-bold text-white"
            >
              <LogOut className="h-4 w-4" /> Logout
            </button>
          </>
        )}
      </div>
    </DashboardLayout>
  );
}
