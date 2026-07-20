'use client';

import { useEffect, useState } from 'react';
import {
  CheckCircle2,
  AlertCircle,
  Loader2,
  Flame,
  Save,
  KeyRound,
  Smartphone,
  Apple,
  Plug,
  Lock,
  Shield,
  MessageSquare,
  Bell,
  BarChart3,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { MYFNG_FIREBASE_DEFAULTS } from '@/lib/push/firebaseProjectDefaults';

type ConfigForm = {
  project_name: string;
  project_id: string;
  api_key: string;
  auth_domain: string;
  storage_bucket: string;
  messaging_sender_id: string;
  app_id: string;
  measurement_id: string;
  client_email: string;
  private_key: string;
  android_package: string;
  ios_bundle_id: string;
  android_default_channel: string;
  apns_environment: string;
  default_icon_url: string;
  push_enabled: boolean;
  android_enabled: boolean;
  ios_enabled: boolean;
  use_db_credentials: boolean;
  admin_notes: string;
  private_key_set?: boolean;
  private_key_masked?: string;
  credentials_source?: string;
  updated_at?: string | null;
};

type FirebaseFeatures = {
  sms_otp_enabled: boolean;
  firebase_analytics_android: boolean;
  firebase_analytics_ios: boolean;
};

type ApiResponse = {
  config: ConfigForm;
  features?: FirebaseFeatures;
  health: { ok: boolean; message: string | null; credentials_source: string };
  can_edit: boolean;
  protocol: string;
  version: string;
};

const DEFAULT_FEATURES: FirebaseFeatures = {
  sms_otp_enabled: false,
  firebase_analytics_android: true,
  firebase_analytics_ios: true,
};

const EMPTY: ConfigForm = {
  project_name: '',
  project_id: '',
  api_key: '',
  auth_domain: '',
  storage_bucket: '',
  messaging_sender_id: '',
  app_id: '',
  measurement_id: '',
  client_email: '',
  private_key: '',
  android_package: 'com.myfng.app',
  ios_bundle_id: 'com.myfng.app',
  android_default_channel: 'default',
  apns_environment: 'production',
  default_icon_url: '',
  push_enabled: true,
  android_enabled: true,
  ios_enabled: true,
  use_db_credentials: false,
  admin_notes: '',
};

type Tab = 'android' | 'ios';

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
        checked ? 'bg-blue-600' : 'bg-gray-300'
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

export default function PushFirebaseSettingsSection() {
  const [tab, setTab] = useState<Tab>('android');
  const [form, setForm] = useState<ConfigForm>(EMPTY);
  const [features, setFeatures] = useState<FirebaseFeatures>(DEFAULT_FEATURES);
  const [health, setHealth] = useState<ApiResponse['health'] | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [bootstrapping, setBootstrapping] = useState(false);
  const [showKeyModal, setShowKeyModal] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');

  const load = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/super_admin/notifications/firebase-settings');
      const json = (await res.json()) as ApiResponse & { error?: string };
      if (!res.ok) {
        toast.error(json.error || 'Failed to load Firebase settings');
        return;
      }
      setForm({ ...EMPTY, ...json.config, private_key: '' });
      setFeatures({ ...DEFAULT_FEATURES, ...(json.features || {}) });
      setHealth(json.health);
      setCanEdit(json.can_edit);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const update = <K extends keyof ConfigForm>(key: K, value: ConfigForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateFeature = <K extends keyof FirebaseFeatures>(key: K, value: FirebaseFeatures[K]) => {
    setFeatures((prev) => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    if (!canEdit) {
      toast.error('Only Super Admin can save Firebase settings');
      return;
    }
    if (!form.project_id.trim() || !form.messaging_sender_id.trim()) {
      toast.error('Project ID and Sender ID are required');
      return;
    }
    if (form.use_db_credentials && (!form.client_email.trim() || (!form.private_key.trim() && !form.private_key_set))) {
      toast.error('Client email and private key are required when using saved credentials');
      return;
    }

    try {
      setSaving(true);
      const res = await fetch('/api/super_admin/notifications/firebase-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, use_db_credentials: true, features }),
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Failed to save');
        return;
      }
      toast.success('Firebase settings saved');
      await load();
    } catch {
      toast.error('Network error');
    } finally {
      setSaving(false);
    }
  };

  const runBootstrap = async () => {
    if (!canEdit) {
      toast.error('Only Super Admin can auto-configure Firebase');
      return;
    }
    if (
      !confirm(
        'Auto-fill Firebase settings from server environment?\n\nThis saves project IDs, service account email, private key, and enables push delivery.',
      )
    ) {
      return;
    }

    try {
      setBootstrapping(true);
      const res = await fetch('/api/super_admin/notifications/firebase-settings/bootstrap', {
        method: 'POST',
      });
      const json = await res.json();
      if (!res.ok) {
        toast.error(json.error || 'Auto-setup failed');
        return;
      }
      toast.success(json.message || 'Firebase configured');
      await load();
    } catch {
      toast.error('Network error');
    } finally {
      setBootstrapping(false);
    }
  };

  const runTest = async () => {
    try {
      setTesting(true);
      const res = await fetch('/api/super_admin/notifications/firebase-settings', { method: 'POST' });
      const json = await res.json();
      if (json.ok) toast.success(json.message || 'Connection OK');
      else toast.error(json.message || json.error || 'Connection failed');
      await load();
    } catch {
      toast.error('Network error');
    } finally {
      setTesting(false);
    }
  };

  const applyPrivateKey = () => {
    update('private_key', keyDraft);
    setKeyDraft('');
    setShowKeyModal(false);
  };

  if (loading) {
    return <div className="h-96 push-card animate-pulse" />;
  }

  const healthy = health?.ok;

  return (
    <div className="w-full">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-xl font-bold text-gray-900">Firebase Settings</h2>
            <span className="push-badge-amber">Super Admin only</span>
          </div>
          <p className="text-sm text-gray-500 mt-1">
            Configure Firebase credentials and control live services: SMS OTP, FCM push, and Analytics.
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900 mb-5">
        <p className="font-semibold">Quick setup</p>
        <p className="mt-1 text-emerald-800">
          Click <strong>Auto-fill from server</strong> to save all Firebase credentials in one step (uses server
          <code className="mx-1 text-xs bg-white/70 px-1 rounded">.env</code> values). APNs
          <code className="mx-1 text-xs bg-white/70 px-1 rounded">.p8</code> still goes in Firebase Console only.
        </p>
        {canEdit ? (
          <button
            type="button"
            onClick={() => void runBootstrap()}
            disabled={bootstrapping}
            className="mt-3 push-btn-primary inline-flex items-center gap-2 text-sm disabled:opacity-50"
          >
            {bootstrapping ? <Loader2 className="w-4 h-4 animate-spin" /> : <Flame className="w-4 h-4" />}
            Auto-fill from server
          </button>
        ) : null}
      </div>

      <div className="rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900 flex items-start gap-3 mb-5">
        <Lock className="w-5 h-5 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold">Encrypted at rest</p>
          <p className="mt-0.5">
            Private keys are AES-256 encrypted and only editable by a Super Admin.
          </p>
        </div>
      </div>

      {!canEdit ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 mb-5 flex items-start gap-2">
          <Shield className="w-4 h-4 shrink-0 mt-0.5" />
          Sub Admin can view settings but only <strong>Super Admin</strong> can edit credentials.
        </div>
      ) : null}

      <div className="push-card p-6 mb-5">
        <div className="mb-4">
          <h3 className="text-base font-bold text-gray-900">Firebase Services — On / Off</h3>
          <p className="text-sm text-gray-500 mt-1">
            Live controls for Firebase features running in the Android &amp; iOS app. Changes apply within ~30 seconds.
          </p>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          <div className="flex items-center justify-between gap-4 rounded-xl border border-orange-100 bg-orange-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 inline-flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-orange-600" />
                SMS OTP Login
              </p>
              <p className="text-xs text-gray-600 mt-0.5">
                Firebase Phone Auth on app login &amp; booking. Off = WhatsApp OTP only.
              </p>
            </div>
            <Toggle
              checked={features.sms_otp_enabled}
              disabled={!canEdit}
              onChange={(v) => updateFeature('sms_otp_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-blue-100 bg-blue-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 inline-flex items-center gap-2">
                <Bell className="w-4 h-4 text-blue-600" />
                FCM Push (Global)
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Master switch — stops all push sends from server.</p>
            </div>
            <Toggle
              checked={form.push_enabled}
              disabled={!canEdit}
              onChange={(v) => update('push_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-green-100 bg-green-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 inline-flex items-center gap-2">
                <Smartphone className="w-4 h-4 text-green-600" />
                FCM Push — Android
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Pause Android push delivery only.</p>
            </div>
            <Toggle
              checked={form.android_enabled}
              disabled={!canEdit}
              onChange={(v) => update('android_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 inline-flex items-center gap-2">
                <Apple className="w-4 h-4 text-gray-700" />
                FCM Push — iOS
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Pause iOS push delivery only (via APNs).</p>
            </div>
            <Toggle
              checked={form.ios_enabled}
              disabled={!canEdit}
              onChange={(v) => update('ios_enabled', v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-purple-100 bg-purple-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 inline-flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                Firebase Analytics — Android
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Google Analytics for Firebase events on Android.</p>
            </div>
            <Toggle
              checked={features.firebase_analytics_android}
              disabled={!canEdit}
              onChange={(v) => updateFeature('firebase_analytics_android', v)}
            />
          </div>

          <div className="flex items-center justify-between gap-4 rounded-xl border border-purple-100 bg-purple-50/60 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-sm text-gray-900 inline-flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-purple-600" />
                Firebase Analytics — iOS
              </p>
              <p className="text-xs text-gray-600 mt-0.5">Google Analytics for Firebase events on iOS.</p>
            </div>
            <Toggle
              checked={features.firebase_analytics_ios}
              disabled={!canEdit}
              onChange={(v) => updateFeature('firebase_analytics_ios', v)}
            />
          </div>
        </div>

        {canEdit ? (
          <p className="text-xs text-gray-500 mt-4">
            Click <strong>Save Credentials</strong> below to apply service toggles and credential changes together.
          </p>
        ) : null}
      </div>

      <div className="push-card overflow-hidden">
        <div className="flex border-b border-gray-200 px-4">
          <button
            type="button"
            onClick={() => setTab('android')}
            className={`push-tab inline-flex items-center gap-2 ${tab === 'android' ? 'active' : ''}`}
          >
            <Smartphone className="w-4 h-4" />
            Android
          </button>
          <button
            type="button"
            onClick={() => setTab('ios')}
            className={`push-tab inline-flex items-center gap-2 ${tab === 'ios' ? 'active' : ''}`}
          >
            <Apple className="w-4 h-4" />
            iOS
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
                healthy ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {healthy ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
              {healthy ? 'Connected' : 'Pending'}
            </span>
            <span className="text-xs text-gray-500">
              Source: {form.credentials_source || 'none'}
              {healthy ? ` · ${health?.message || 'Credentials verified'}` : ' · Not tested yet'}
            </span>
          </div>

          <div className="grid xl:grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">Service Account</p>
              <div className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <div>
                    <label className="push-label">Firebase Project Name</label>
                    <input
                      className="push-input"
                      value={form.project_name}
                      onChange={(e) => update('project_name', e.target.value)}
                      placeholder="myfng-prod"
                      disabled={!canEdit}
                    />
                  </div>
                  <div>
                    <label className="push-label">Firebase Project ID</label>
                    <input
                      className="push-input"
                      value={form.project_id}
                      onChange={(e) => update('project_id', e.target.value)}
                      placeholder="myfng-prod-12345"
                      disabled={!canEdit}
                    />
                  </div>
                </div>
                <div>
                  <label className="push-label">Firebase Client Email</label>
                  <input
                    className="push-input font-mono text-xs"
                    value={form.client_email}
                    onChange={(e) => update('client_email', e.target.value)}
                    placeholder="firebase-adminsdk@myfng-prod.iam.gserviceaccount.com"
                    disabled={!canEdit}
                  />
                </div>
                <div>
                  <label className="push-label flex items-center gap-1.5">
                    <KeyRound className="w-4 h-4 text-gray-500" />
                    Firebase Private Key
                  </label>
                  <div className="flex items-center gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                    <div className="flex-1 text-sm text-gray-600 truncate">
                      {form.private_key_set || form.private_key.trim()
                        ? form.private_key_masked || 'Private key ready to save'
                        : 'No private key saved yet'}
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        onClick={() => setShowKeyModal(true)}
                        className="push-btn-secondary text-sm py-2 px-3 shrink-0"
                      >
                        Add key
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>

            <div>
              <p className="text-xs font-bold uppercase tracking-wide text-gray-400 mb-4">
                {tab === 'android' ? 'Android App Identifiers' : 'iOS App Identifiers'}
              </p>
              <div className="grid sm:grid-cols-2 gap-4">
                {tab === 'android' ? (
                  <>
                    <div>
                      <label className="push-label">Sender ID</label>
                      <input
                        className="push-input"
                        value={form.messaging_sender_id}
                        onChange={(e) => update('messaging_sender_id', e.target.value)}
                        placeholder="123456789012"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="push-label">Application ID</label>
                      <input
                        className="push-input font-mono text-xs"
                        value={form.app_id}
                        onChange={(e) => update('app_id', e.target.value)}
                        placeholder="1:123456789012:android:abcdef"
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="push-label">Package Name</label>
                      <input
                        className="push-input font-mono text-xs"
                        value={form.android_package}
                        onChange={(e) => update('android_package', e.target.value)}
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="push-label">Default Channel</label>
                      <input
                        className="push-input"
                        value={form.android_default_channel}
                        onChange={(e) => update('android_default_channel', e.target.value)}
                        disabled={!canEdit}
                      />
                    </div>
                    <div className="sm:col-span-2 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600">
                      <strong>Android App ID:</strong> 1:455279370834:android:ae9e7dcf4df27191e7b58b ·{' '}
                      <strong>Package:</strong> com.myfng.app
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="push-label">Bundle ID</label>
                      <input
                        className="push-input font-mono text-xs"
                        value={form.ios_bundle_id}
                        onChange={(e) => update('ios_bundle_id', e.target.value)}
                        disabled={!canEdit}
                      />
                    </div>
                    <div>
                      <label className="push-label">APNs Environment</label>
                      <select
                        className="push-input"
                        value={form.apns_environment}
                        onChange={(e) => update('apns_environment', e.target.value)}
                        disabled={!canEdit}
                      >
                        <option value="production">production</option>
                        <option value="development">development</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2 rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs text-gray-600 space-y-1">
                      <p>
                        <strong>APNs Key ID:</strong> {MYFNG_FIREBASE_DEFAULTS.apns_key_id} · upload{' '}
                        <strong>AuthKey_{MYFNG_FIREBASE_DEFAULTS.apns_key_id}.p8</strong> in Firebase Console → Cloud
                        Messaging → Apple app configuration (Production).
                      </p>
                      <p>
                        <strong>iOS App ID:</strong> 1:455279370834:ios:38d95771254f40a5e7b58b ·{' '}
                        <strong>Bundle:</strong> com.myfng.app
                      </p>
                    </div>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-gray-100 px-6 py-4 flex flex-wrap items-center justify-between gap-3 bg-gray-50/60">
          <p className="text-xs text-gray-500 inline-flex items-center gap-1.5">
            <Lock className="w-3.5 h-3.5" />
            Changes are encrypted at rest and recorded in the audit log.
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void runTest()}
              disabled={testing}
              className="push-btn-secondary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plug className="w-4 h-4" />}
              Test Connection
            </button>
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving || !canEdit}
              className="push-btn-primary inline-flex items-center gap-2 disabled:opacity-50"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </button>
          </div>
        </div>
      </div>

      {showKeyModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="push-card w-full max-w-lg p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Flame className="w-5 h-5 text-orange-500" />
              <h3 className="font-bold text-gray-900">Add Firebase Private Key</h3>
            </div>
            <textarea
              className="push-input font-mono text-[11px] min-h-[180px]"
              value={keyDraft}
              onChange={(e) => setKeyDraft(e.target.value)}
              placeholder="-----BEGIN PRIVATE KEY-----&#10;...&#10;-----END PRIVATE KEY-----"
            />
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowKeyModal(false)} className="push-btn-secondary">
                Cancel
              </button>
              <button type="button" onClick={applyPrivateKey} className="push-btn-primary">
                Save key
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
