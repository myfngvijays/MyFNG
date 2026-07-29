'use client';

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, Settings2 } from 'lucide-react';
import toast from 'react-hot-toast';

type CouponSettings = {
  default_channel: string;
  require_active_customer: boolean;
  allow_stacking: boolean;
  max_redemptions_per_user: number;
  auto_expire_notify: boolean;
  default_validity_days: number;
};

const DEFAULTS: CouponSettings = {
  default_channel: 'ALL',
  require_active_customer: true,
  allow_stacking: false,
  max_redemptions_per_user: 1,
  auto_expire_notify: true,
  default_validity_days: 30,
};

export default function PcmSettingsSection({
  onNavigate,
}: {
  onNavigate?: (section: string) => void;
}) {
  const [form, setForm] = useState<CouponSettings>(DEFAULTS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/coupon-settings');
      const json = await res.json();
      if (res.ok && json.settings) {
        setForm({ ...DEFAULTS, ...json.settings });
      }
    } catch {
      setForm(DEFAULTS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/super_admin/coupon-settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'Failed to save');
      toast.success('Coupon settings saved');
    } catch (e: unknown) {
      toast.error(e instanceof Error ? e.message : 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="pcm-card rounded-xl border p-8 flex items-center justify-center gap-2 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" /> Loading settings…
      </div>
    );
  }

  return (
    <div className="pcm-card rounded-xl border p-6 space-y-6 max-w-3xl">
      <div>
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <Settings2 className="w-5 h-5 text-blue-600" />
          Coupon Settings
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Defaults for new coupons and redemption behaviour.
        </p>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Default channel</span>
          <select
            className="w-full rounded-lg border px-3 py-2"
            value={form.default_channel}
            onChange={(e) => setForm((f) => ({ ...f, default_channel: e.target.value }))}
          >
            <option value="ALL">All channels</option>
            <option value="APP">App only</option>
            <option value="WEB">Web only</option>
            <option value="WHATSAPP">WhatsApp</option>
          </select>
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Default validity (days)</span>
          <input
            type="number"
            min={1}
            max={365}
            className="w-full rounded-lg border px-3 py-2"
            value={form.default_validity_days}
            onChange={(e) =>
              setForm((f) => ({ ...f, default_validity_days: Number(e.target.value) || 30 }))
            }
          />
        </label>

        <label className="space-y-1.5 text-sm">
          <span className="font-semibold text-gray-700">Max redemptions / user</span>
          <input
            type="number"
            min={1}
            max={100}
            className="w-full rounded-lg border px-3 py-2"
            value={form.max_redemptions_per_user}
            onChange={(e) =>
              setForm((f) => ({
                ...f,
                max_redemptions_per_user: Number(e.target.value) || 1,
              }))
            }
          />
        </label>
      </div>

      <div className="space-y-3">
        {(
          [
            ['require_active_customer', 'Require active customer account'],
            ['allow_stacking', 'Allow stacking with other coupons'],
            ['auto_expire_notify', 'Notify when coupon is about to expire'],
          ] as const
        ).map(([key, label]) => (
          <label key={key} className="flex items-center gap-2 text-sm font-medium text-gray-800">
            <input
              type="checkbox"
              checked={Boolean(form[key])}
              onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
            />
            {label}
          </label>
        ))}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t">
        <button
          type="button"
          onClick={() => void save()}
          disabled={saving}
          className="pcm-btn-primary inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold text-white disabled:opacity-50"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save settings
        </button>
        {onNavigate ? (
          <>
            <button
              type="button"
              className="px-3 py-2 rounded-lg border text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => onNavigate('coupons')}
            >
              Open coupons
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg border text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => onNavigate('automations')}
            >
              Automations
            </button>
            <button
              type="button"
              className="px-3 py-2 rounded-lg border text-sm font-semibold text-gray-700 hover:bg-gray-50"
              onClick={() => onNavigate('reports')}
            >
              Reports
            </button>
          </>
        ) : null}
      </div>
    </div>
  );
}
