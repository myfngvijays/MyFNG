'use client';

import { useEffect, useMemo, useState } from 'react';
import DashboardLayout from '@/components/DashboardLayout';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { formatDateDMY, formatDateTimeISTAssumeUTC } from '@/lib/utils';
import {
  Bell,
  CheckCircle2,
  Clock3,
  KeyRound,
  RefreshCw,
  Save,
  Settings,
  ShieldCheck,
  Smartphone,
  UserCog,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

type Preferences = {
  notifyNewComplaints: boolean;
  notifyStatusUpdates: boolean;
  notifyMechanicAssignment: boolean;
  soundAlerts: boolean;
  compactCards: boolean;
  autoRefreshSeconds: number;
};

const PREFS_KEY = 'rsa_manager_settings_v1';
const DEFAULT_PREFS: Preferences = {
  notifyNewComplaints: true,
  notifyStatusUpdates: true,
  notifyMechanicAssignment: true,
  soundAlerts: false,
  compactCards: false,
  autoRefreshSeconds: 30,
};

function normalizePhone(value: string): string {
  const digits = String(value || '').replace(/\D/g, '');
  if (!digits) return '';
  return digits.length > 10 ? digits.slice(-10) : digits;
}

export default function RSAManagerSettingsPage() {
  const supabase = getBrowserClient();
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [error, setError] = useState('');
  const [okMsg, setOkMsg] = useState('');

  const [profile, setProfile] = useState<{
    id: string;
    email: string;
    full_name: string;
    phone: string;
    created_at?: string | null;
    last_login?: string | null;
  } | null>(null);

  const [form, setForm] = useState({
    full_name: '',
    phone: '',
  });

  const [prefs, setPrefs] = useState<Preferences>(DEFAULT_PREFS);

  useEffect(() => {
    let mounted = true;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!user?.id) throw new Error('Please login again.');

        const { data, error: dbErr } = await supabase
          .from('users_login')
          .select('id, email, full_name, phone, created_at, last_login')
          .eq('id', user.id)
          .single();
        if (dbErr) throw dbErr;

        const nextProfile = {
          id: String(data?.id || user.id),
          email: String(data?.email || user.email || ''),
          full_name: String(data?.full_name || ''),
          phone: String(data?.phone || ''),
          created_at: data?.created_at || null,
          last_login: data?.last_login || null,
        };
        if (!mounted) return;
        setProfile(nextProfile);
        setForm({
          full_name: nextProfile.full_name,
          phone: nextProfile.phone,
        });

        const raw = localStorage.getItem(PREFS_KEY);
        if (raw) {
          try {
            const parsed = JSON.parse(raw);
            setPrefs({
              ...DEFAULT_PREFS,
              ...parsed,
              autoRefreshSeconds: Number(parsed?.autoRefreshSeconds || DEFAULT_PREFS.autoRefreshSeconds),
            });
          } catch {
            setPrefs(DEFAULT_PREFS);
          }
        } else {
          setPrefs(DEFAULT_PREFS);
        }
      } catch (e: any) {
        if (!mounted) return;
        setError(e?.message || 'Failed to load settings');
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, [supabase]);

  const isProfileChanged = useMemo(() => {
    if (!profile) return false;
    return (
      form.full_name.trim() !== String(profile.full_name || '').trim() ||
      normalizePhone(form.phone) !== normalizePhone(profile.phone)
    );
  }, [form.full_name, form.phone, profile]);

  const saveProfile = async () => {
    if (!profile?.id) return;
    setSavingProfile(true);
    setError('');
    setOkMsg('');
    try {
      const payload = {
        full_name: form.full_name.trim(),
        phone: normalizePhone(form.phone),
      };
      const { error: updateErr } = await supabase
        .from('users_login')
        .update(payload)
        .eq('id', profile.id);
      if (updateErr) throw updateErr;

      setProfile((prev) =>
        prev
          ? {
              ...prev,
              full_name: payload.full_name,
              phone: payload.phone,
            }
          : prev
      );
      setForm((prev) => ({ ...prev, full_name: payload.full_name, phone: payload.phone }));
      setOkMsg('Profile settings saved successfully.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save profile settings');
    } finally {
      setSavingProfile(false);
    }
  };

  const savePreferences = async () => {
    setSavingPrefs(true);
    setError('');
    setOkMsg('');
    try {
      const bounded = {
        ...prefs,
        autoRefreshSeconds: Math.min(300, Math.max(10, Number(prefs.autoRefreshSeconds || 30))),
      };
      setPrefs(bounded);
      localStorage.setItem(PREFS_KEY, JSON.stringify(bounded));
      setOkMsg('Preferences saved on this device.');
    } catch (e: any) {
      setError(e?.message || 'Failed to save preferences');
    } finally {
      setSavingPrefs(false);
    }
  };

  const resetPreferences = () => {
    setPrefs(DEFAULT_PREFS);
    localStorage.setItem(PREFS_KEY, JSON.stringify(DEFAULT_PREFS));
    setOkMsg('Preferences reset to default.');
  };

  return (
    <DashboardLayout role="rsa_manager">
      <div className="w-full min-w-0 max-w-6xl mx-auto space-y-4 sm:space-y-5 md:space-y-6">
        <div className="bg-gradient-to-r from-slate-700 to-slate-600 text-white p-4 sm:p-5 md:p-6 rounded-lg shadow-lg -mx-3 sm:-mx-4 md:-mx-6 -mt-3 sm:-mt-4 md:-mt-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">Settings</h1>
              <p className="text-white/90 text-xs sm:text-sm mt-1">Manage profile, alerts and dashboard preferences</p>
            </div>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="btn btn-outline bg-white/10 border-white/40 text-white hover:bg-white/20 text-xs sm:text-sm"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {loading ? (
          <div className="bg-white rounded-lg shadow p-6 text-sm text-gray-600">Loading settings...</div>
        ) : null}
        {error ? <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">{error}</div> : null}
        {okMsg ? (
          <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 rounded-lg p-3 text-sm flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            {okMsg}
          </div>
        ) : null}

        {!loading ? (
          <>
            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <UserCog className="w-5 h-5 text-slate-700" />
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Profile Settings</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">Full Name</label>
                  <input
                    type="text"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={form.full_name}
                    onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                    placeholder="Enter your name"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                  <input
                    type="tel"
                    className="w-full border rounded-md px-3 py-2 text-sm"
                    value={form.phone}
                    onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                    placeholder="10-digit mobile number"
                  />
                </div>
                <div>
                  <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5">Email</label>
                  <input
                    type="text"
                    disabled
                    className="w-full border rounded-md px-3 py-2 text-sm bg-gray-50 text-gray-600"
                    value={profile?.email || ''}
                  />
                </div>
                <div className="text-xs text-gray-500 space-y-1">
                  <div>
                    Member since:{' '}
                    <span className="text-gray-700">
                      {profile?.created_at ? formatDateDMY(profile.created_at) : '—'}
                    </span>
                  </div>
                  <div>
                    Last login:{' '}
                    <span className="text-gray-700">
                      {profile?.last_login ? formatDateTimeISTAssumeUTC(profile.last_login) : '—'}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex justify-end mt-4">
                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={!isProfileChanged || savingProfile}
                  className="btn btn-primary text-xs sm:text-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingProfile ? 'Saving...' : 'Save Profile'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-slate-700" />
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Notifications & Alerts</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <label className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                  <span>New complaint alerts</span>
                  <input
                    type="checkbox"
                    checked={prefs.notifyNewComplaints}
                    onChange={(e) => setPrefs((p) => ({ ...p, notifyNewComplaints: e.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                  <span>Status update alerts</span>
                  <input
                    type="checkbox"
                    checked={prefs.notifyStatusUpdates}
                    onChange={(e) => setPrefs((p) => ({ ...p, notifyStatusUpdates: e.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                  <span>Mechanic assignment alerts</span>
                  <input
                    type="checkbox"
                    checked={prefs.notifyMechanicAssignment}
                    onChange={(e) => setPrefs((p) => ({ ...p, notifyMechanicAssignment: e.target.checked }))}
                  />
                </label>
                <label className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                  <span>Sound alerts</span>
                  <input
                    type="checkbox"
                    checked={prefs.soundAlerts}
                    onChange={(e) => setPrefs((p) => ({ ...p, soundAlerts: e.target.checked }))}
                  />
                </label>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Smartphone className="w-5 h-5 text-slate-700" />
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Dashboard Preferences</h2>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <label className="flex items-center justify-between border rounded-md px-3 py-2 text-sm">
                  <span>Compact complaint cards</span>
                  <input
                    type="checkbox"
                    checked={prefs.compactCards}
                    onChange={(e) => setPrefs((p) => ({ ...p, compactCards: e.target.checked }))}
                  />
                </label>
                <div className="border rounded-md px-3 py-2">
                  <label className="text-sm text-gray-700 block mb-1">Auto-refresh interval</label>
                  <div className="flex items-center gap-2">
                    <Clock3 className="w-4 h-4 text-gray-500" />
                    <input
                      type="number"
                      min={10}
                      max={300}
                      className="w-28 border rounded-md px-2 py-1 text-sm"
                      value={prefs.autoRefreshSeconds}
                      onChange={(e) =>
                        setPrefs((p) => ({
                          ...p,
                          autoRefreshSeconds: Number(e.target.value || 30),
                        }))
                      }
                    />
                    <span className="text-xs text-gray-500">seconds</span>
                  </div>
                </div>
                <div className="border rounded-md px-3 py-2 text-sm text-gray-700">
                  <div className="font-medium mb-1">Display timezone</div>
                  <div>Asia/Kolkata (IST)</div>
                </div>
                <div className="border rounded-md px-3 py-2 text-sm text-gray-700">
                  <div className="font-medium mb-1">Default route</div>
                  <div>Dashboard overview</div>
                </div>
              </div>

              <div className="flex flex-wrap justify-end gap-2 mt-4">
                <button type="button" onClick={resetPreferences} className="btn btn-outline text-xs sm:text-sm">
                  Reset Defaults
                </button>
                <button
                  type="button"
                  onClick={savePreferences}
                  disabled={savingPrefs}
                  className="btn btn-primary text-xs sm:text-sm disabled:opacity-50"
                >
                  <Save className="w-4 h-4" />
                  {savingPrefs ? 'Saving...' : 'Save Preferences'}
                </button>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-4 sm:p-5 md:p-6">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="w-5 h-5 text-slate-700" />
                <h2 className="text-base sm:text-lg font-bold text-gray-900">Security & Account</h2>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <a
                  href="/forgot-password"
                  className="border rounded-md px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <KeyRound className="w-4 h-4 text-gray-600" />
                  Change password
                </a>
                <a
                  href="/dashboard/notifications"
                  className="border rounded-md px-3 py-2 text-sm hover:bg-gray-50 flex items-center gap-2"
                >
                  <Bell className="w-4 h-4 text-gray-600" />
                  Open notification center
                </a>
              </div>
            </div>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

