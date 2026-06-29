'use client';

import { useEffect, useState } from 'react';
import { Loader2, Save, Shield, Smartphone, Apple, Globe } from 'lucide-react';
import toast from 'react-hot-toast';

type PlatformKey = 'android' | 'ios' | 'web';

type ConfigForm = {
  firebase: {
    project_name: string;
    project_id: string;
    android_app_id: string;
    ios_app_id: string;
    web_measurement_id: string;
    android_package: string;
    ios_bundle_id: string;
    console_url: string;
  };
  clarity: {
    project_id: string;
    dashboard_url: string;
  };
  web_tracking: {
    meta_pixel_id: string;
    gtm_container_id: string;
  };
  platforms: Record<
    PlatformKey,
    {
      firebase_analytics_enabled: boolean;
      clarity_enabled: boolean;
      gtag_enabled: boolean;
      meta_pixel_enabled: boolean;
    }
  >;
  mobile_build: {
    analytics_min_version_code_android: number;
    analytics_min_build_ios: number;
    current_version: string;
    current_build: number;
    notes: string;
  };
  admin_notes: string;
};

const EMPTY: ConfigForm = {
  firebase: {
    project_name: '',
    project_id: '',
    android_app_id: '',
    ios_app_id: '',
    web_measurement_id: '',
    android_package: '',
    ios_bundle_id: '',
    console_url: '',
  },
  clarity: { project_id: '', dashboard_url: '' },
  web_tracking: { meta_pixel_id: '', gtm_container_id: '' },
  platforms: {
    android: {
      firebase_analytics_enabled: true,
      clarity_enabled: true,
      gtag_enabled: false,
      meta_pixel_enabled: false,
    },
    ios: {
      firebase_analytics_enabled: true,
      clarity_enabled: true,
      gtag_enabled: false,
      meta_pixel_enabled: false,
    },
    web: {
      firebase_analytics_enabled: false,
      clarity_enabled: true,
      gtag_enabled: true,
      meta_pixel_enabled: true,
    },
  },
  mobile_build: {
    analytics_min_version_code_android: 27,
    analytics_min_build_ios: 27,
    current_version: '1.2.3',
    current_build: 28,
    notes: '',
  },
  admin_notes: '',
};

function Toggle({
  checked,
  onChange,
  disabled,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-6 w-11 shrink-0 rounded-full transition ${
        checked ? 'bg-violet-600' : 'bg-gray-300'
      } ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition mt-0.5 ${
          checked ? 'translate-x-5' : 'translate-x-0.5'
        }`}
      />
    </button>
  );
}

export default function SettingsSection() {
  const [form, setForm] = useState<ConfigForm>(EMPTY);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/super_admin/analytics-hub/config');
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to load settings');
        return;
      }
      setForm({ ...EMPTY, ...json.config });
      setCanEdit(Boolean(json.can_edit));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const updateFirebase = <K extends keyof ConfigForm['firebase']>(key: K, value: ConfigForm['firebase'][K]) => {
    setForm((prev) => ({ ...prev, firebase: { ...prev.firebase, [key]: value } }));
  };

  const updateClarity = <K extends keyof ConfigForm['clarity']>(key: K, value: ConfigForm['clarity'][K]) => {
    setForm((prev) => ({ ...prev, clarity: { ...prev.clarity, [key]: value } }));
  };

  const updateWebTracking = <K extends keyof ConfigForm['web_tracking']>(key: K, value: ConfigForm['web_tracking'][K]) => {
    setForm((prev) => ({ ...prev, web_tracking: { ...prev.web_tracking, [key]: value } }));
  };

  const updatePlatform = (platform: PlatformKey, key: keyof ConfigForm['platforms'][PlatformKey], value: boolean) => {
    setForm((prev) => ({
      ...prev,
      platforms: {
        ...prev.platforms,
        [platform]: { ...prev.platforms[platform], [key]: value },
      },
    }));
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast.error('Only Super Admin can save analytics settings');
      return;
    }
    if (!form.firebase.project_id.trim()) {
      toast.error('Firebase Project ID is required');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/super_admin/analytics-hub/config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ config: form }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to save');
        return;
      }
      toast.success('Analytics settings saved');
      await load();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="analytics-card h-96 animate-pulse" />;
  }

  return (
    <div className="space-y-6">
      <div className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-3 text-sm text-violet-900">
        <p className="font-semibold">Admin-controlled tracking config</p>
        <p className="mt-1 text-violet-800">
          IDs aur enable flags yahan save hote hain. Mobile app future mein{' '}
          <code className="text-xs bg-white/70 px-1 rounded">/api/public/analytics-config</code> se read kar sakti hai.
          Native SDK changes ke liye app rebuild zaroori hai.
        </p>
      </div>

      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 flex items-start gap-2">
          <Shield className="w-4 h-4 shrink-0 mt-0.5" />
          Sub Admin can view settings but only <strong>Super Admin</strong> can edit.
        </div>
      ) : null}

      <div className="analytics-card p-6 space-y-8">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">Firebase Analytics</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="analytics-label">Project Name</label>
              <input
                className="analytics-input"
                value={form.firebase.project_name}
                onChange={(e) => updateFirebase('project_name', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="analytics-label">Project ID</label>
              <input
                className="analytics-input font-mono text-xs"
                value={form.firebase.project_id}
                onChange={(e) => updateFirebase('project_id', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="analytics-label">Android App ID</label>
              <input
                className="analytics-input font-mono text-xs"
                value={form.firebase.android_app_id}
                onChange={(e) => updateFirebase('android_app_id', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="analytics-label">iOS App ID</label>
              <input
                className="analytics-input font-mono text-xs"
                value={form.firebase.ios_app_id}
                onChange={(e) => updateFirebase('ios_app_id', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="analytics-label">Website GA4 Measurement ID</label>
              <input
                className="analytics-input font-mono text-xs"
                value={form.firebase.web_measurement_id}
                onChange={(e) => updateFirebase('web_measurement_id', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="analytics-label">Firebase Console URL</label>
              <input
                className="analytics-input text-xs"
                value={form.firebase.console_url}
                onChange={(e) => updateFirebase('console_url', e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">Microsoft Clarity</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="analytics-label">Clarity Project ID</label>
              <input
                className="analytics-input font-mono text-xs"
                value={form.clarity.project_id}
                onChange={(e) => updateClarity('project_id', e.target.value)}
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="analytics-label">Clarity Dashboard URL</label>
              <input
                className="analytics-input text-xs"
                value={form.clarity.dashboard_url}
                onChange={(e) => updateClarity('dashboard_url', e.target.value)}
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">Website Tracking (Meta Pixel &amp; GTM)</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="analytics-label">Meta Pixel ID</label>
              <input
                className="analytics-input font-mono text-xs"
                value={form.web_tracking.meta_pixel_id}
                onChange={(e) => updateWebTracking('meta_pixel_id', e.target.value)}
                placeholder="845395791020784"
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="analytics-label">GTM Container ID</label>
              <input
                className="analytics-input font-mono text-xs"
                value={form.web_tracking.gtm_container_id}
                onChange={(e) => updateWebTracking('gtm_container_id', e.target.value)}
                placeholder="GTM-N2N59TBR"
                disabled={!canEdit}
              />
            </div>
          </div>
          <p className="text-[11px] text-gray-500 mt-2">
            Website par Clarity GTM ke through load hoti hai. Meta Pixel aur GA4 layout file mein hardcoded hain — future mein yahan se dynamically read karwa sakte hain.
          </p>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">Platform Switches</p>
          <div className="grid lg:grid-cols-3 gap-4">
            {([
              { key: 'android' as const, label: 'Android', icon: Smartphone },
              { key: 'ios' as const, label: 'iOS', icon: Apple },
              { key: 'web' as const, label: 'Website', icon: Globe },
            ]).map(({ key, label, icon: Icon }) => (
              <div key={key} className="rounded-xl border border-gray-100 p-4 space-y-3">
                <div className="flex items-center gap-2 font-semibold text-gray-900">
                  <Icon className="w-4 h-4 text-violet-600" />
                  {label}
                </div>
                {(key === 'android' || key === 'ios') && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-700">Firebase Analytics</span>
                      <Toggle
                        checked={form.platforms[key].firebase_analytics_enabled}
                        disabled={!canEdit}
                        onChange={(v) => updatePlatform(key, 'firebase_analytics_enabled', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-700">Clarity</span>
                      <Toggle
                        checked={form.platforms[key].clarity_enabled}
                        disabled={!canEdit}
                        onChange={(v) => updatePlatform(key, 'clarity_enabled', v)}
                      />
                    </div>
                  </>
                )}
                {key === 'web' && (
                  <>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-700">GA4 (gtag)</span>
                      <Toggle
                        checked={form.platforms.web.gtag_enabled}
                        disabled={!canEdit}
                        onChange={(v) => updatePlatform('web', 'gtag_enabled', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-700">Meta Pixel</span>
                      <Toggle
                        checked={form.platforms.web.meta_pixel_enabled}
                        disabled={!canEdit}
                        onChange={(v) => updatePlatform('web', 'meta_pixel_enabled', v)}
                      />
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <span className="text-sm text-gray-700">Clarity</span>
                      <Toggle
                        checked={form.platforms.web.clarity_enabled}
                        disabled={!canEdit}
                        onChange={(v) => updatePlatform('web', 'clarity_enabled', v)}
                      />
                    </div>
                    <p className="text-[11px] text-gray-500">
                      Website par Clarity <code>GTM-N2N59TBR</code> se load hoti hai — project ID mobile jaisa hi (
                      {form.clarity.project_id || 'x0kwaiy8aa'}).
                    </p>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">Mobile Build Reference</p>
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="analytics-label">Current app version</label>
              <input
                className="analytics-input"
                value={form.mobile_build.current_version}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    mobile_build: { ...prev.mobile_build, current_version: e.target.value },
                  }))
                }
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="analytics-label">Current build number</label>
              <input
                className="analytics-input"
                type="number"
                value={form.mobile_build.current_build}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    mobile_build: { ...prev.mobile_build, current_build: Number(e.target.value) || 0 },
                  }))
                }
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="analytics-label">Min Android version code (analytics SDK)</label>
              <input
                className="analytics-input"
                type="number"
                value={form.mobile_build.analytics_min_version_code_android}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    mobile_build: {
                      ...prev.mobile_build,
                      analytics_min_version_code_android: Number(e.target.value) || 0,
                    },
                  }))
                }
                disabled={!canEdit}
              />
            </div>
            <div>
              <label className="analytics-label">Min iOS build (analytics SDK)</label>
              <input
                className="analytics-input"
                type="number"
                value={form.mobile_build.analytics_min_build_ios}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    mobile_build: { ...prev.mobile_build, analytics_min_build_ios: Number(e.target.value) || 0 },
                  }))
                }
                disabled={!canEdit}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="analytics-label">Admin notes (shown on overview)</label>
              <textarea
                className="analytics-input min-h-[90px]"
                value={form.mobile_build.notes}
                onChange={(e) =>
                  setForm((prev) => ({
                    ...prev,
                    mobile_build: { ...prev.mobile_build, notes: e.target.value },
                  }))
                }
                disabled={!canEdit}
              />
            </div>
            <div className="sm:col-span-2">
              <label className="analytics-label">Internal admin notes</label>
              <textarea
                className="analytics-input min-h-[70px]"
                value={form.admin_notes}
                onChange={(e) => setForm((prev) => ({ ...prev, admin_notes: e.target.value }))}
                disabled={!canEdit}
              />
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 pt-4 flex justify-end">
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving || !canEdit}
            className="analytics-btn-primary disabled:opacity-50"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Save Settings
          </button>
        </div>
      </div>
    </div>
  );
}
