'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Gift,
  Save,
  RefreshCw,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  IndianRupee,
  Plus,
  Trash2,
} from 'lucide-react';

type ReferralConfig = {
  referral_first_reward: number;
  referral_repeat_reward: number;
  referral_friend_bonus: number;
  referral_expiry_days: number;
  referral_tnc: string[];
};

type ReferralStats = {
  total_referrals: number;
  rewarded: number;
  pending: number;
  rejected: number;
  total_rewards_paid: number;
};

type ReferralEvent = {
  id: string;
  referral_code: string;
  status: string;
  created_at: string;
  referrer?: { full_name?: string; phone?: string };
  referee?: { full_name?: string; phone?: string };
};

function StatCard({ label, value, icon, accent }: { label: string; value: string | number; icon: React.ReactNode; accent: string }) {
  return (
    <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">{label}</p>
          <p className="text-2xl font-black text-gray-900 mt-1">{value}</p>
        </div>
        <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${accent}`}>{icon}</div>
      </div>
    </div>
  );
}

function MoneyField({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-800">{label}</span>
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
      <div className="mt-2 flex items-center gap-2">
        <div className="relative flex-1">
          <IndianRupee className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(Number(e.target.value) || 0)}
            className="w-full rounded-xl border border-gray-200 bg-white pl-9 pr-3 py-2.5 text-sm font-semibold"
          />
        </div>
        <span className="text-xs font-bold text-gray-400 shrink-0">INR</span>
      </div>
    </label>
  );
}

function DaysField({ label, hint, value, onChange }: { label: string; hint?: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm font-semibold text-gray-800">{label}</span>
      {hint && <span className="mt-1 block text-xs text-gray-500">{hint}</span>}
      <div className="mt-2 flex items-center gap-2">
        <Clock className="h-4 w-4 text-gray-400 shrink-0" />
        <input
          type="number"
          min={1}
          max={3650}
          value={value}
          onChange={(e) => onChange(Number(e.target.value) || 90)}
          className="w-full rounded-xl border border-gray-200 bg-white px-3 py-2.5 text-sm font-semibold"
        />
        <span className="text-xs font-bold text-gray-400 shrink-0">days</span>
      </div>
    </label>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { bg: string; text: string }> = {
    PENDING: { bg: 'bg-amber-100', text: 'text-amber-700' },
    REWARDED: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
    REJECTED: { bg: 'bg-red-100', text: 'text-red-700' },
  };
  const s = map[status] || { bg: 'bg-gray-100', text: 'text-gray-600' };
  return <span className={`px-2 py-0.5 rounded-lg text-xs font-bold ${s.bg} ${s.text}`}>{status}</span>;
}

const DEFAULT_TNC = [
  'First successful referral gives you \u20b9500 reward.',
  'Every next referral gives you \u20b9250 reward.',
  'Your referral reward unlocks when your friend books their first service.',
  'Your friend gets \u20b91,500 wallet balance (\u20b91,000 welcome + \u20b9500 referral bonus) instantly on signup.',
  'Wallet balance expires in 90 days.',
  'Maximum wallet usage: 10% of service booking amount.',
  'Rewards cannot be converted to cash.',
  'Self-referral and fraudulent referrals will be rejected.',
];

export default function ReferralApp() {
  const [config, setConfig] = useState<ReferralConfig | null>(null);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [events, setEvents] = useState<ReferralEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [editConfig, setEditConfig] = useState<ReferralConfig | null>(null);
  const [rewardingId, setRewardingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/referral');
      const json = await res.json();
      if (json.success) {
        const cfg: ReferralConfig = {
          ...json.config,
          referral_tnc: json.config.referral_tnc || DEFAULT_TNC,
        };
        setConfig(cfg);
        setEditConfig({ ...cfg });
        setStats(json.stats);
        setEvents(json.recent_events || []);
      } else {
        setError(json.error || 'Failed to load');
      }
    } catch {
      setError('Failed to load referral data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  useEffect(() => {
    if (message || error) {
      const timer = setTimeout(() => { setMessage(null); setError(null); }, 4000);
      return () => clearTimeout(timer);
    }
  }, [message, error]);

  const handleSave = async () => {
    if (!editConfig) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    try {
      const res = await fetch('/api/super_admin/referral', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editConfig),
      });
      const json = await res.json();
      if (json.success) {
        const cfg: ReferralConfig = {
          ...json.config,
          referral_tnc: json.config.referral_tnc || editConfig.referral_tnc,
        };
        setConfig(cfg);
        setEditConfig({ ...cfg });
        setMessage('Referral settings saved successfully!');
        setDirty(false);
      } else {
        setError(json.error || 'Save failed');
      }
    } catch {
      setError('Network error');
    } finally {
      setSaving(false);
    }
  };

  const patchConfig = (key: keyof ReferralConfig, value: any) => {
    if (!editConfig) return;
    setEditConfig({ ...editConfig, [key]: value });
    setDirty(true);
  };

  const addTncItem = () => {
    if (!editConfig) return;
    patchConfig('referral_tnc', [...editConfig.referral_tnc, '']);
  };

  const updateTncItem = (idx: number, value: string) => {
    if (!editConfig) return;
    const updated = [...editConfig.referral_tnc];
    updated[idx] = value;
    patchConfig('referral_tnc', updated);
  };

  const removeTncItem = (idx: number) => {
    if (!editConfig) return;
    patchConfig('referral_tnc', editConfig.referral_tnc.filter((_, i) => i !== idx));
  };

  const handleManualReward = async (eventId: string) => {
    if (!window.confirm('Mark this referral as completed and credit wallet to referrer?')) return;
    setRewardingId(eventId);
    try {
      const res = await fetch('/api/super_admin/referral/manual-reward', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId }),
      });
      const json = await res.json();
      if (res.ok && json.success) {
        setMessage(`Rewarded! ₹${json.amount} credited to referrer's wallet.`);
        fetchData();
      } else {
        setError(json.error || 'Failed to reward');
      }
    } catch {
      setError('Network error');
    } finally {
      setRewardingId(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f4f6fb] flex items-center justify-center">
        <div className="animate-pulse text-lg text-gray-400">Loading referral settings...</div>
      </div>
    );
  }

  return (
    <div className="min-h-full bg-[#f4f6fb]">
      {/* Toast */}
      {(message || error) && (
        <div className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-xl text-sm font-semibold shadow-lg ${message ? 'bg-emerald-500 text-white' : 'bg-red-500 text-white'}`}>
          {message || error}
        </div>
      )}

      {/* Hero */}
      <div className="relative overflow-hidden bg-gradient-to-br from-orange-600 via-amber-600 to-yellow-600 text-white">
        <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_top_right,_white_0,_transparent_45%)]" />
        <div className="relative px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <div className="max-w-6xl mx-auto flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold text-white backdrop-blur">
                <Gift className="h-3.5 w-3.5" />
                Referral Engine
              </div>
              <h1 className="text-2xl sm:text-3xl font-black mt-3 text-white">Refer &amp; Earn Management</h1>
              <p className="text-sm sm:text-base text-orange-100 mt-2 max-w-2xl">
                Referral rewards, friend bonus amounts, T&amp;C aur recent referral activity — sab yahan se manage karo.
              </p>
            </div>
            <div className="flex gap-2 shrink-0">
              <button onClick={fetchData} className="inline-flex items-center gap-2 rounded-xl bg-white/15 hover:bg-white/25 backdrop-blur px-4 py-2.5 text-sm font-bold transition">
                <RefreshCw className="h-4 w-4" /> Refresh
              </button>
              {dirty && (
                <button onClick={handleSave} disabled={saving} className="inline-flex items-center gap-2 rounded-xl bg-white text-orange-700 px-5 py-2.5 text-sm font-black shadow-lg hover:shadow-xl transition disabled:opacity-50">
                  <Save className="h-4 w-4" /> {saving ? 'Saving...' : 'Save Changes'}
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard label="Total Referrals" value={stats.total_referrals} icon={<Users className="h-5 w-5 text-blue-600" />} accent="bg-blue-100" />
            <StatCard label="Rewarded" value={stats.rewarded} icon={<CheckCircle2 className="h-5 w-5 text-emerald-600" />} accent="bg-emerald-100" />
            <StatCard label="Pending" value={stats.pending} icon={<Clock className="h-5 w-5 text-amber-600" />} accent="bg-amber-100" />
            <StatCard label="Rejected" value={stats.rejected} icon={<XCircle className="h-5 w-5 text-red-600" />} accent="bg-red-100" />
            <StatCard label="Total Paid" value={`\u20b9${stats.total_rewards_paid.toLocaleString('en-IN')}`} icon={<IndianRupee className="h-5 w-5 text-violet-600" />} accent="bg-violet-100" />
          </div>
        )}

        {/* Settings */}
        {editConfig && (
          <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm space-y-6">
            <h2 className="text-lg font-black text-gray-900 flex items-center gap-2">
              <Gift className="h-5 w-5 text-orange-500" />
              Referral Settings
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-5 p-4 rounded-xl bg-orange-50/50 border border-orange-100">
                <h3 className="text-xs font-bold text-orange-600 uppercase tracking-wider">Referrer Rewards</h3>
                <MoneyField
                  label="First Referral Reward"
                  hint="Referrer gets this when their first friend books a service"
                  value={editConfig.referral_first_reward}
                  onChange={(v) => patchConfig('referral_first_reward', v)}
                />
                <MoneyField
                  label="Repeat Referral Reward"
                  hint="Referrer gets this for every subsequent referral"
                  value={editConfig.referral_repeat_reward}
                  onChange={(v) => patchConfig('referral_repeat_reward', v)}
                />
              </div>
              <div className="space-y-5 p-4 rounded-xl bg-emerald-50/50 border border-emerald-100">
                <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-wider">Friend (New User) Bonus</h3>
                <MoneyField
                  label="Instant Friend Bonus"
                  hint="New user gets this instantly on signup with referral code"
                  value={editConfig.referral_friend_bonus}
                  onChange={(v) => patchConfig('referral_friend_bonus', v)}
                />
                <DaysField
                  label="Wallet Credit Expiry"
                  hint="Both referrer & friend credits expire after these many days"
                  value={editConfig.referral_expiry_days}
                  onChange={(v) => patchConfig('referral_expiry_days', v)}
                />
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
              <p className="text-xs font-bold text-gray-500 uppercase tracking-wider mb-2">How it works (summary)</p>
              <ul className="text-xs text-gray-600 space-y-1 list-disc list-inside">
                <li>New user applies referral code &rarr; gets &nbsp;<strong>&#8377;{editConfig.referral_friend_bonus}</strong> instantly + &#8377;1,000 welcome = <strong>&#8377;{editConfig.referral_friend_bonus + 1000}</strong> total</li>
                <li>When friend completes first booking &rarr; referrer gets <strong>&#8377;{editConfig.referral_first_reward}</strong> (first) or <strong>&#8377;{editConfig.referral_repeat_reward}</strong> (repeat)</li>
                <li>All credits expire in <strong>{editConfig.referral_expiry_days} days</strong></li>
                <li>Self-referral and same-device referrals are automatically rejected</li>
              </ul>
            </div>
          </div>
        )}

        {/* T&C Editor */}
        {editConfig && (
          <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-black text-gray-900">Terms &amp; Conditions</h2>
              <button onClick={addTncItem} className="inline-flex items-center gap-1 text-xs font-bold text-orange-600 hover:text-orange-700 transition">
                <Plus className="h-3.5 w-3.5" /> Add Item
              </button>
            </div>
            <p className="text-xs text-gray-500">These appear in the mobile app&apos;s Refer &amp; Earn section (shown in italic).</p>
            <div className="space-y-2">
              {editConfig.referral_tnc.map((item, idx) => (
                <div key={idx} className="flex items-start gap-2">
                  <span className="text-xs text-gray-400 font-bold mt-2.5 w-5 shrink-0">{idx + 1}.</span>
                  <input
                    type="text"
                    value={item}
                    onChange={(e) => updateTncItem(idx, e.target.value)}
                    className="flex-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-sm italic text-gray-700"
                    placeholder="Enter T&C point..."
                  />
                  <button onClick={() => removeTncItem(idx)} className="mt-1.5 text-gray-400 hover:text-red-500 transition">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Recent Events */}
        <div className="rounded-2xl border border-white/60 bg-white/90 backdrop-blur p-6 shadow-sm">
          <h2 className="text-lg font-black text-gray-900 mb-4">Recent Referral Activity</h2>
          {events.length === 0 ? (
            <p className="text-sm text-gray-400">No referral events yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-gray-100">
                    <th className="pb-3 pr-4">Date</th>
                    <th className="pb-3 pr-4">Referrer</th>
                    <th className="pb-3 pr-4">Friend</th>
                    <th className="pb-3 pr-4">Code</th>
                    <th className="pb-3 pr-4">Status</th>
                    <th className="pb-3">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev.id} className="border-b border-gray-50 hover:bg-gray-50/50 transition">
                      <td className="py-3 pr-4 text-gray-600">
                        {new Date(ev.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' })}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-semibold text-gray-800">{ev.referrer?.full_name || 'Unknown'}</span>
                        {ev.referrer?.phone && <span className="text-gray-400 text-xs ml-1">{ev.referrer.phone}</span>}
                      </td>
                      <td className="py-3 pr-4">
                        <span className="font-semibold text-gray-800">{ev.referee?.full_name || 'Unknown'}</span>
                        {ev.referee?.phone && <span className="text-gray-400 text-xs ml-1">{ev.referee.phone}</span>}
                      </td>
                      <td className="py-3 pr-4 font-mono text-xs font-bold text-gray-600">{ev.referral_code}</td>
                      <td className="py-3 pr-4"><StatusBadge status={ev.status} /></td>
                      <td className="py-3">
                        {ev.status === 'PENDING' && (
                          <button
                            onClick={() => handleManualReward(ev.id)}
                            disabled={rewardingId === ev.id}
                            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50 transition"
                          >
                            {rewardingId === ev.id ? 'Rewarding…' : 'Mark Rewarded'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
