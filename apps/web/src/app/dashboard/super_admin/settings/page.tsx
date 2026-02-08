'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { getBrowserClient } from '@/lib/supabase/browserClient';
import { Settings, Save, AlertTriangle, RefreshCw } from 'lucide-react';
import { toast } from 'react-hot-toast';

const SLA_KEYS = [
  'sla_lead_assignment_minutes',
  'sla_workshop_acceptance_minutes',
  'sla_pickup_arrival_minutes',
  'sla_service_completion_minutes',
];
const SLA_MIN = 1;
const SLA_MAX = 99999;

export default function SystemSettingsPage() {
  const supabase = getBrowserClient();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [settings, setSettings] = useState<Record<string, any>>({});

  const fetchSettings = useCallback(async () => {
    setError(null);
    setLoading(true);
    try {
      const { data, error: err } = await supabase
        .from('system_settings')
        .select('*')
        .order('category', { ascending: true });

      if (err) throw err;

      const settingsMap: Record<string, any> = {};
      (data || []).forEach((setting: any) => {
        settingsMap[setting.setting_key] = {
          ...setting,
          value: setting.setting_type === 'BOOLEAN'
            ? setting.setting_value === 'true'
            : setting.setting_value,
        };
      });
      setSettings(settingsMap);
    } catch (e: any) {
      console.error('Error fetching settings:', e);
      const msg = e?.message || 'Failed to load settings';
      setError(msg);
      toast.error(msg);
      setSettings({});
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleToggle = (key: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        value: !prev[key]?.value,
      },
    }));
    setError(null);
  };

  const handleChange = (key: string, value: string) => {
    setSettings((prev) => ({
      ...prev,
      [key]: {
        ...prev[key],
        value,
      },
    }));
    setError(null);
  };

  const validateSla = (): boolean => {
    for (const key of SLA_KEYS) {
      const v = settings[key]?.value;
      if (v === undefined || v === '') continue;
      const n = parseInt(String(v), 10);
      if (Number.isNaN(n) || n < SLA_MIN || n > SLA_MAX) {
        toast.error(`${key.replace(/_/g, ' ')} must be between ${SLA_MIN} and ${SLA_MAX}`);
        return false;
      }
    }
    return true;
  };

  const handleSave = async () => {
    if (Object.keys(settings).length === 0) {
      toast.error('No settings to save');
      return;
    }
    if (!validateSla()) return;

    setSaving(true);
    setError(null);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const updatedAt = new Date().toISOString();
      const updates = Object.entries(settings).map(([key, data]) => ({
        setting_key: key,
        setting_value: String(data.value),
        updated_at: updatedAt,
        updated_by: user?.id ?? null,
      }));

      for (const update of updates) {
        const { error: updateErr } = await supabase
          .from('system_settings')
          .update({
            setting_value: update.setting_value,
            updated_at: update.updated_at,
            ...(update.updated_by && { updated_by: update.updated_by }),
          })
          .eq('setting_key', update.setting_key);

        if (updateErr) throw updateErr;
      }

      toast.success('Settings saved successfully');
      fetchSettings();
    } catch (e: any) {
      const msg = e?.message || 'Failed to save settings';
      setError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  if (loading && Object.keys(settings).length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-10 w-10 sm:h-11 sm:w-11 md:h-12 md:w-12 border-b-2 border-blue-600 mx-auto mb-3 sm:mb-4" />
          <p className="text-gray-600 text-xs sm:text-sm md:text-base">Loading settings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b sticky top-0 z-10">
        <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="min-w-0 flex-1">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-1.5 sm:gap-2">
                <Settings className="w-5 h-5 sm:w-6 sm:h-6 flex-shrink-0" />
                <span className="truncate">System Settings</span>
              </h1>
              <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">
                Configure global system parameters and rules
              </p>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => fetchSettings()}
                disabled={loading}
                className="btn-secondary flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm w-full sm:w-auto justify-center"
                title="Refresh settings"
              >
                <RefreshCw className={`w-3.5 h-3.5 sm:w-4 sm:h-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loading || Object.keys(settings).length === 0}
                className="btn-primary flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm w-full sm:w-auto justify-center disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />
                <span className="hidden sm:inline">{saving ? 'Saving...' : 'Save All Changes'}</span>
                <span className="sm:hidden">{saving ? 'Saving...' : 'Save'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {error && (
        <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 pt-3 sm:pt-4">
          <div className="bg-red-50 border border-red-200 text-red-800 rounded-lg px-4 py-3 flex flex-wrap items-center gap-2">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <span className="text-sm flex-1 min-w-0">{error}</span>
            <button
              type="button"
              onClick={() => fetchSettings()}
              disabled={loading}
              className="text-sm font-medium text-red-700 hover:text-red-900 underline"
            >
              Retry
            </button>
            <button
              type="button"
              onClick={() => setError(null)}
              className="text-sm font-medium text-red-600 hover:text-red-800"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}

      <div className="max-w-5xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-5 md:py-6 space-y-4 sm:space-y-5 md:space-y-6">
        {/* System Status */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b px-4 sm:px-5 md:px-6 py-3 sm:py-4">
            <h2 className="font-semibold text-base sm:text-lg">🚀 System Status</h2>
          </div>
          <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm sm:text-base">Maintenance Mode</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">System accessible only to Super Admins</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.maintenance_mode?.value || false}
                  onChange={() => handleToggle('maintenance_mode')}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm sm:text-base">Auto Lead Assignment</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Automatically assign leads to workshops</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.auto_lead_assignment?.value || false}
                  onChange={() => handleToggle('auto_lead_assignment')}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Notifications */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b px-4 sm:px-5 md:px-6 py-3 sm:py-4">
            <h2 className="font-semibold text-base sm:text-lg">🔔 Notifications</h2>
          </div>
          <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <h3 className="font-medium text-sm sm:text-base">SMS Notifications</h3>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.sms_notifications_enabled?.value || false}
                  onChange={() => handleToggle('sms_notifications_enabled')}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <h3 className="font-medium text-sm sm:text-base">Email Notifications</h3>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.email_notifications_enabled?.value || false}
                  onChange={() => handleToggle('email_notifications_enabled')}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <h3 className="font-medium text-sm sm:text-base">Push Notifications</h3>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.push_notifications_enabled?.value || false}
                  onChange={() => handleToggle('push_notifications_enabled')}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* SLA Rules */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b px-4 sm:px-5 md:px-6 py-3 sm:py-4">
            <h2 className="font-semibold text-base sm:text-lg">⏱️ SLA Rules (minutes)</h2>
          </div>
          <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Lead Assignment to Manager (minutes)
                </label>
                <input
                  type="number"
                  min={SLA_MIN}
                  max={SLA_MAX}
                  value={settings.sla_lead_assignment_minutes?.value ?? '15'}
                  onChange={(e) => handleChange('sla_lead_assignment_minutes', e.target.value)}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Workshop Acceptance (minutes)
                </label>
                <input
                  type="number"
                  min={SLA_MIN}
                  max={SLA_MAX}
                  value={settings.sla_workshop_acceptance_minutes?.value ?? '30'}
                  onChange={(e) => handleChange('sla_workshop_acceptance_minutes', e.target.value)}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Pickup Boy Arrival (minutes)
                </label>
                <input
                  type="number"
                  min={SLA_MIN}
                  max={SLA_MAX}
                  value={settings.sla_pickup_arrival_minutes?.value ?? '60'}
                  onChange={(e) => handleChange('sla_pickup_arrival_minutes', e.target.value)}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-1.5 sm:mb-2">
                  Service Completion (minutes)
                </label>
                <input
                  type="number"
                  min={SLA_MIN}
                  max={SLA_MAX}
                  value={settings.sla_service_completion_minutes?.value ?? '240'}
                  onChange={(e) => handleChange('sla_service_completion_minutes', e.target.value)}
                  className="w-full px-3 sm:px-4 py-1.5 sm:py-2 text-xs sm:text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Security */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b px-4 sm:px-5 md:px-6 py-3 sm:py-4">
            <h2 className="font-semibold text-base sm:text-lg">🔐 Security</h2>
          </div>
          <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm sm:text-base">Two-Factor Authentication</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Require 2FA for all admin accounts</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.two_factor_auth_required?.value || false}
                  onChange={() => handleToggle('two_factor_auth_required')}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm sm:text-base">API Access</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Enable external API access</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.api_access_enabled?.value || false}
                  onChange={() => handleToggle('api_access_enabled')}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Data & Backup */}
        <div className="bg-white rounded-lg shadow">
          <div className="border-b px-4 sm:px-5 md:px-6 py-3 sm:py-4">
            <h2 className="font-semibold text-base sm:text-lg">💾 Data & Backup</h2>
          </div>
          <div className="p-4 sm:p-5 md:p-6 space-y-3 sm:space-y-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-0">
              <div className="min-w-0 flex-1">
                <h3 className="font-medium text-sm sm:text-base">Automatic Backup</h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-0.5 sm:mt-1">Daily backup at 2:00 AM</p>
              </div>
              <label className="relative inline-flex items-center cursor-pointer flex-shrink-0">
                <input
                  type="checkbox"
                  checked={settings.auto_backup_enabled?.value || false}
                  onChange={() => handleToggle('auto_backup_enabled')}
                  className="sr-only peer"
                />
                <div className="w-10 h-5 sm:w-11 sm:h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 sm:after:h-5 sm:after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
              </label>
            </div>
          </div>
        </div>

        {/* Save Button */}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || loading || Object.keys(settings).length === 0}
            className="btn-primary flex items-center gap-1.5 sm:gap-2 px-4 sm:px-6 md:px-8 py-1.5 sm:py-2 text-xs sm:text-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4 md:w-5 md:h-5" />
            <span className="hidden sm:inline">{saving ? 'Saving Changes...' : 'Save All Changes'}</span>
            <span className="sm:hidden">{saving ? 'Saving...' : 'Save'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
