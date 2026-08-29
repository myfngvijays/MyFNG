'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { createClient } from '@/lib/supabase/client';
import { useAdvisorSession } from '@/lib/dashboard/useAdvisorSession';
import { formatDateDMY } from '@/lib/utils';
import {
  User,
  Mail,
  Phone,
  Building,
  Calendar,
  Edit2,
  Save,
  X,
  Loader2,
  MapPin,
} from 'lucide-react';

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

export default function AdvisorProfilePage() {
  const { profile: sessionProfile, ready } = useAdvisorSession();
  const [profile, setProfile] = useState<any>(sessionProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState({
    first_name: splitFullName(sessionProfile?.full_name || '').first_name,
    last_name: splitFullName(sessionProfile?.full_name || '').last_name,
    phone: sessionProfile?.phone || '',
  });

  useEffect(() => {
    if (!sessionProfile) return;
    setProfile(sessionProfile);
    const parts = splitFullName(sessionProfile.full_name || '');
    setFormData({
      first_name: parts.first_name,
      last_name: parts.last_name,
      phone: sessionProfile.phone || '',
    });
  }, [sessionProfile]);

  async function handleSave() {
    if (!profile?.id) return;
    setSaving(true);
    const supabase = createClient();
    const fullName = joinName(formData.first_name, formData.last_name);
    const { error } = await supabase
      .from('users_login')
      .update({
        full_name: fullName,
        phone: formData.phone,
        updated_at: new Date().toISOString(),
      })
      .eq('id', profile.id);

    setSaving(false);
    if (error) {
      alert('Failed to update profile');
      return;
    }
    setProfile({ ...profile, full_name: fullName, phone: formData.phone });
    setIsEditing(false);
  }

  const workshop = profile?.workshop;
  const displayFirst = formData.first_name || splitFullName(profile?.full_name || '').first_name;
  const displayLast = formData.last_name || splitFullName(profile?.full_name || '').last_name;
  const workshopLine = [workshop?.address, workshop?.city, workshop?.state, workshop?.pincode]
    .filter(Boolean)
    .join(', ');

  return (
    <DashboardLayout role="workshop_supervisor">
      <div className="mx-auto w-full max-w-3xl min-w-0 space-y-4 pb-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-extrabold text-[#023D95]">My Profile</h1>
            <p className="text-sm text-slate-500">Name, phone, and workshop details</p>
          </div>
          {ready && profile ? (
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
                  onClick={() => void handleSave()}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-2 text-sm font-bold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                  Save
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const parts = splitFullName(profile?.full_name || '');
                    setFormData({
                      first_name: parts.first_name,
                      last_name: parts.last_name,
                      phone: profile?.phone || '',
                    });
                    setIsEditing(false);
                  }}
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-200 px-3.5 py-2 text-sm font-bold text-slate-700"
                >
                  <X className="h-4 w-4" /> Cancel
                </button>
              </div>
            )
          ) : null}
        </div>

        {!ready && !profile ? (
          <div className="flex items-center justify-center gap-2 py-20 text-slate-500">
            <Loader2 className="h-5 w-5 animate-spin" /> Loading…
          </div>
        ) : (
          <section className="overflow-hidden rounded-2xl border border-[#004AAD]/25 shadow-lg shadow-[#004AAD]/15">
            <div className="bg-gradient-to-br from-[#023D95] via-[#004AAD] to-[#0369A1] px-4 py-5 text-white sm:px-5 sm:py-6">
              <div className="flex flex-col gap-4 sm:flex-row">
                <div className="flex shrink-0 flex-col items-center gap-2">
                  <div className="relative">
                    <div className="flex h-[5.5rem] w-[5.5rem] items-center justify-center overflow-hidden rounded-full border-[3px] border-white/40 bg-white">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/profile-default.png" alt="MyFNG" className="h-full w-full object-cover" />
                    </div>
                  </div>
                  <span
                    className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${
                      profile?.is_active !== false
                        ? 'bg-emerald-400/25 text-emerald-100 ring-1 ring-emerald-300/40'
                        : 'bg-amber-400/25 text-amber-100 ring-1 ring-amber-300/40'
                    }`}
                  >
                    {profile?.is_active !== false ? 'Active' : 'Inactive'}
                  </span>
                  <p className="text-[10px] text-blue-100/80">MyFNG brand icon</p>
                </div>

                <div className="min-w-0 flex-1 space-y-3">
                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                        <User className="h-3.5 w-3.5" /> First Name
                      </label>
                      {isEditing ? (
                        <input
                          className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm font-semibold text-white placeholder:text-blue-100/50 focus:outline-none focus:ring-2 focus:ring-yellow-300/50"
                          value={formData.first_name}
                          onChange={(e) => setFormData((f) => ({ ...f, first_name: e.target.value }))}
                          placeholder="First name"
                        />
                      ) : (
                        <p className="mt-0.5 text-base font-extrabold text-white">{displayFirst || '—'}</p>
                      )}
                    </div>
                    <div>
                      <label className="text-xs font-bold text-blue-100/90">Last Name</label>
                      {isEditing ? (
                        <input
                          className="mt-1 w-full rounded-xl border border-white/25 bg-white/15 px-3 py-2 text-sm font-semibold text-white placeholder:text-blue-100/50 focus:outline-none focus:ring-2 focus:ring-yellow-300/50"
                          value={formData.last_name}
                          onChange={(e) => setFormData((f) => ({ ...f, last_name: e.target.value }))}
                          placeholder="Last name"
                        />
                      ) : (
                        <p className="mt-0.5 text-base font-extrabold text-white">{displayLast || '—'}</p>
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                      <Mail className="h-3.5 w-3.5" /> Email
                    </label>
                    <p className="mt-0.5 break-all text-sm font-semibold text-white">{profile?.email || '—'}</p>
                    <p className="text-[11px] text-blue-100/70">Email cannot be changed</p>
                  </div>

                  <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                    <div>
                      <label className="flex items-center gap-1 text-xs font-bold text-blue-100/90">
                        <Phone className="h-3.5 w-3.5" /> Phone
                      </label>
                      {isEditing ? (
                        <input
                          type="tel"
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
                        <Building className="h-3.5 w-3.5" /> Workshop
                      </label>
                      <p className="mt-0.5 text-sm font-semibold text-white">{workshop?.name || 'N/A'}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-[#004AAD]/10 bg-[#F0F7FF] px-4 py-4 text-sm sm:px-5">
              <div>
                <p className="text-xs font-bold text-[#004AAD]/70">Role</p>
                <p className="font-bold text-[#023D95]">{profile?.role?.role_name || 'Workshop Advisor'}</p>
              </div>
              <div>
                <p className="text-xs font-bold text-[#004AAD]/70">Role Code</p>
                <p className="font-bold text-[#023D95]">{profile?.role?.role_code || 'WORKSHOP_SUPERVISOR'}</p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-xs font-bold text-[#004AAD]/70">
                  <Calendar className="h-3.5 w-3.5" /> Member Since
                </p>
                <p className="font-semibold text-[#023D95]">
                  {profile?.created_at ? formatDateDMY(profile.created_at) : '—'}
                </p>
              </div>
              <div>
                <p className="flex items-center gap-1 text-xs font-bold text-[#004AAD]/70">
                  <MapPin className="h-3.5 w-3.5" /> Workshop address
                </p>
                <p className="font-semibold text-[#023D95]">{workshopLine || workshop?.phone || '—'}</p>
              </div>
            </div>
          </section>
        )}
      </div>
    </DashboardLayout>
  );
}
