'use client';

import React, { useCallback, useEffect, useState } from 'react';
import {
  Plus, Trash2, Pencil, X, Loader2, Smartphone, Monitor, Eye, EyeOff,
  Gift, Bell, Star, Zap, Heart, ShieldCheck, Megaphone, Tag,
  MessageSquare, type LucideIcon,
} from 'lucide-react';
import toast from 'react-hot-toast';
import AdminPageRefresh from '@/components/admin/AdminPageRefresh';

type Popup = {
  id: string;
  title: string;
  body: string | null;
  icon: string;
  image_url: string | null;
  primary_button_text: string;
  primary_button_action: string;
  secondary_button_text: string | null;
  target_screens: string[];
  display_rule: string;
  show_for: string;
  is_active: boolean;
  priority: number;
  starts_at: string | null;
  ends_at: string | null;
  created_at: string;
};

const ICON_OPTIONS: { value: string; label: string; Icon: LucideIcon }[] = [
  { value: 'gift', label: 'Gift', Icon: Gift },
  { value: 'bell', label: 'Bell', Icon: Bell },
  { value: 'star', label: 'Star', Icon: Star },
  { value: 'zap', label: 'Zap', Icon: Zap },
  { value: 'heart', label: 'Heart', Icon: Heart },
  { value: 'shield-check', label: 'Shield', Icon: ShieldCheck },
  { value: 'megaphone', label: 'Megaphone', Icon: Megaphone },
  { value: 'tag', label: 'Tag', Icon: Tag },
  { value: 'message-square', label: 'Message', Icon: MessageSquare },
];

const SCREEN_OPTIONS = [
  'HOME', 'BOOKING', 'WALLET', 'PROFILE', 'SERVICES', 'MEMBERSHIP', 'ALL',
] as const;

const DISPLAY_RULES = [
  { value: 'ONCE_EVER', label: 'Once ever (per device)' },
  { value: 'ONCE_PER_SESSION', label: 'Once per session' },
  { value: 'EVERY_TIME', label: 'Every time screen opens' },
] as const;

const SHOW_FOR_OPTIONS = [
  { value: 'ALL', label: 'All Users' },
  { value: 'GUEST_ONLY', label: 'Guest Only (Not Logged In)' },
  { value: 'LOGGED_IN_ONLY', label: 'Logged In Only' },
] as const;

const ACTION_PRESETS = [
  { value: 'DISMISS', label: 'Just close popup' },
  { value: 'LOGIN', label: 'Go to Login' },
  { value: 'SCREEN:CustomerWallet', label: 'Open Wallet' },
  { value: 'SCREEN:CustomerRefer', label: 'Open Refer & Earn' },
  { value: 'SCREEN:CustomerMembership', label: 'Open Membership' },
  { value: 'SCREEN:PublicBookServiceNow', label: 'Open Book Service' },
  { value: 'CUSTOM', label: 'Custom URL / Screen' },
] as const;

const EMPTY_FORM = {
  title: '',
  body: '',
  icon: 'gift',
  image_url: '',
  primary_button_text: 'OK',
  primary_button_action: 'DISMISS',
  secondary_button_text: '',
  target_screens: ['HOME'] as string[],
  display_rule: 'ONCE_PER_SESSION',
  show_for: 'ALL',
  is_active: true,
  priority: 0,
  starts_at: '',
  ends_at: '',
};

function iconForName(name: string) {
  const found = ICON_OPTIONS.find((o) => o.value === name);
  if (found) return <found.Icon className="w-5 h-5" />;
  return <Gift className="w-5 h-5" />;
}

function formatDate(d: string | null) {
  if (!d) return '-';
  return new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export default function AppPopupsPage() {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [customAction, setCustomAction] = useState('');
  const [previewOpen, setPreviewOpen] = useState(false);

  const fetchPopups = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/app-popups');
      const json = await res.json();
      if (res.ok) setPopups(json.popups || []);
    } catch {
      toast.error('Failed to load popups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchPopups(); }, [fetchPopups]);

  const openCreate = () => {
    setEditId(null);
    setForm({ ...EMPTY_FORM });
    setCustomAction('');
    setFormOpen(true);
  };

  const openEdit = (popup: Popup) => {
    setEditId(popup.id);
    const isPreset = ACTION_PRESETS.some((p) => p.value === popup.primary_button_action);
    setForm({
      title: popup.title,
      body: popup.body || '',
      icon: popup.icon || 'gift',
      image_url: popup.image_url || '',
      primary_button_text: popup.primary_button_text || 'OK',
      primary_button_action: isPreset ? popup.primary_button_action : 'CUSTOM',
      secondary_button_text: popup.secondary_button_text || '',
      target_screens: popup.target_screens || ['HOME'],
      display_rule: popup.display_rule || 'ONCE_PER_SESSION',
      show_for: popup.show_for || 'ALL',
      is_active: popup.is_active,
      priority: popup.priority || 0,
      starts_at: popup.starts_at ? popup.starts_at.slice(0, 16) : '',
      ends_at: popup.ends_at ? popup.ends_at.slice(0, 16) : '',
    });
    setCustomAction(isPreset ? '' : popup.primary_button_action);
    setFormOpen(true);
  };

  const savePopup = async () => {
    if (!form.title.trim()) { toast.error('Title is required'); return; }
    setSaving(true);
    const payload = {
      ...form,
      primary_button_action: form.primary_button_action === 'CUSTOM' ? customAction : form.primary_button_action,
      image_url: form.image_url || null,
      secondary_button_text: form.secondary_button_text || null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
    };
    try {
      const url = editId ? `/api/super_admin/app-popups/${editId}` : '/api/super_admin/app-popups';
      const method = editId ? 'PATCH' : 'POST';
      const res = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      toast.success(editId ? 'Popup updated' : 'Popup created');
      setFormOpen(false);
      fetchPopups();
    } catch (err: any) {
      toast.error(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (popup: Popup) => {
    try {
      const res = await fetch(`/api/super_admin/app-popups/${popup.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: !popup.is_active }),
      });
      if (!res.ok) throw new Error();
      setPopups((prev) => prev.map((p) => p.id === popup.id ? { ...p, is_active: !p.is_active } : p));
      toast.success(popup.is_active ? 'Popup disabled' : 'Popup enabled');
    } catch {
      toast.error('Toggle failed');
    }
  };

  const deletePopup = async (popup: Popup) => {
    if (!confirm(`Delete popup "${popup.title}"?`)) return;
    try {
      const res = await fetch(`/api/super_admin/app-popups/${popup.id}`, { method: 'DELETE' });
      if (!res.ok) throw new Error();
      setPopups((prev) => prev.filter((p) => p.id !== popup.id));
      toast.success('Popup deleted');
    } catch {
      toast.error('Delete failed');
    }
  };

  const toggleScreen = (screen: string) => {
    setForm((f) => {
      if (screen === 'ALL') return { ...f, target_screens: ['ALL'] };
      const without = f.target_screens.filter((s) => s !== 'ALL');
      return {
        ...f,
        target_screens: without.includes(screen)
          ? without.filter((s) => s !== screen)
          : [...without, screen],
      };
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 px-4 sm:px-6 lg:px-8 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 flex items-center gap-2">
              <Megaphone className="w-6 h-6 text-brand-primary" />
              App Popups
            </h1>
            <p className="text-sm text-gray-600 mt-0.5">Create & manage popups shown in the mobile app</p>
          </div>
        <div className="flex items-center gap-2">
          <AdminPageRefresh onClick={() => void fetchPopups()} loading={loading} />
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-bold rounded-xl hover:bg-blue-700 transition"
          >
            <Plus className="w-4 h-4" /> New Popup
          </button>
        </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-6">
        {loading ? (
          <div className="bg-white rounded-2xl border p-10 flex flex-col items-center">
            <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
            <p className="text-sm text-gray-500 mt-3">Loading popups...</p>
          </div>
        ) : popups.length === 0 ? (
          <div className="bg-white rounded-2xl border p-10 text-center">
            <Megaphone className="w-10 h-10 text-gray-300 mx-auto" />
            <p className="text-gray-700 font-semibold mt-3">No popups yet</p>
            <p className="text-sm text-gray-500 mt-1">Create your first popup to show in the mobile app</p>
            <button type="button" onClick={openCreate} className="mt-4 px-4 py-2 bg-blue-600 text-white text-sm font-bold rounded-lg">
              <Plus className="w-4 h-4 inline mr-1" /> Create Popup
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {popups.map((popup) => (
              <div
                key={popup.id}
                className={`bg-white rounded-2xl border-2 p-5 transition ${popup.is_active ? 'border-emerald-200' : 'border-gray-200 opacity-60'}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${popup.is_active ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                      {iconForName(popup.icon)}
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">{popup.title}</h3>
                      {popup.body ? <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{popup.body}</p> : null}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleActive(popup)}
                    title={popup.is_active ? 'Disable' : 'Enable'}
                    className="p-1.5 rounded-lg hover:bg-gray-100"
                  >
                    {popup.is_active ? <Eye className="w-4 h-4 text-emerald-600" /> : <EyeOff className="w-4 h-4 text-gray-400" />}
                  </button>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {popup.target_screens.map((s) => (
                    <span key={s} className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700">{s}</span>
                  ))}
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${popup.show_for === 'GUEST_ONLY' ? 'bg-amber-50 text-amber-700' : popup.show_for === 'LOGGED_IN_ONLY' ? 'bg-purple-50 text-purple-700' : 'bg-gray-100 text-gray-600'}`}>
                    {popup.show_for === 'GUEST_ONLY' ? 'Guest' : popup.show_for === 'LOGGED_IN_ONLY' ? 'Logged In' : 'All Users'}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-600">
                    {popup.display_rule === 'ONCE_EVER' ? 'Once' : popup.display_rule === 'EVERY_TIME' ? 'Every Time' : '1x/Session'}
                  </span>
                </div>

                <div className="mt-3 flex items-center gap-2 text-xs text-gray-500">
                  <Smartphone className="w-3 h-3" />
                  <span>Button: "{popup.primary_button_text}" → {popup.primary_button_action}</span>
                </div>

                {popup.starts_at || popup.ends_at ? (
                  <div className="mt-1.5 text-xs text-gray-400">
                    {popup.starts_at ? `From ${formatDate(popup.starts_at)}` : ''} {popup.ends_at ? `Until ${formatDate(popup.ends_at)}` : ''}
                  </div>
                ) : null}

                <div className="mt-4 pt-3 border-t border-gray-100 flex gap-2">
                  <button type="button" onClick={() => openEdit(popup)} className="flex-1 py-2 text-xs font-bold text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100">
                    <Pencil className="w-3.5 h-3.5 inline mr-1" /> Edit
                  </button>
                  <button type="button" onClick={() => deletePopup(popup)} className="py-2 px-3 text-xs font-bold text-rose-700 bg-rose-50 rounded-lg hover:bg-rose-100">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create / Edit Modal */}
      {formOpen ? (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-start justify-center p-4 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-xl my-8">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h3 className="text-lg font-bold text-gray-900">{editId ? 'Edit Popup' : 'Create New Popup'}</h3>
              <div className="flex items-center gap-2">
                <button type="button" onClick={() => setPreviewOpen(!previewOpen)} className="px-3 py-1.5 text-xs font-bold rounded-lg border border-gray-300 hover:bg-gray-50">
                  <Monitor className="w-3.5 h-3.5 inline mr-1" /> {previewOpen ? 'Hide' : 'Show'} Preview
                </button>
                <button type="button" onClick={() => setFormOpen(false)} className="p-2 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
              </div>
            </div>

            <div className="p-6 space-y-5 max-h-[75vh] overflow-y-auto">
              {previewOpen ? (
                <div className="bg-gray-900/10 rounded-2xl p-6 flex items-center justify-center">
                  <div className="w-[320px] bg-white rounded-3xl shadow-xl p-6 text-center">
                    <div className="w-16 h-16 rounded-full bg-amber-100 mx-auto flex items-center justify-center mb-4">
                      <span className="text-amber-500">{iconForName(form.icon)}</span>
                    </div>
                    <h4 className="text-lg font-black text-gray-900">{form.title || 'Popup Title'}</h4>
                    {form.body ? <p className="text-sm text-gray-500 mt-2">{form.body}</p> : null}
                    <button type="button" className="mt-5 w-full py-3 bg-blue-600 text-white rounded-xl text-sm font-bold">{form.primary_button_text || 'OK'}</button>
                    {form.secondary_button_text ? (
                      <p className="mt-3 text-sm font-bold text-blue-600">{form.secondary_button_text}</p>
                    ) : null}
                  </div>
                </div>
              ) : null}

              {/* Title & Body */}
              <div className="grid grid-cols-1 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase">Title *</label>
                  <input className="w-full mt-1 px-3 py-2.5 border rounded-lg text-sm font-semibold" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} placeholder="e.g. Login to get ₹1000 Bonus" />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase">Body Text</label>
                  <textarea className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" rows={3} value={form.body} onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))} placeholder="Optional description text" />
                </div>
              </div>

              {/* Icon */}
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase">Icon</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {ICON_OPTIONS.map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setForm((f) => ({ ...f, icon: opt.value }))}
                      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg border text-xs font-bold transition ${form.icon === opt.value ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      <opt.Icon className="w-4 h-4" /> {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Buttons */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase">Primary Button Text</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.primary_button_text} onChange={(e) => setForm((f) => ({ ...f, primary_button_text: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase">Secondary Button (optional)</label>
                  <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.secondary_button_text} onChange={(e) => setForm((f) => ({ ...f, secondary_button_text: e.target.value }))} placeholder="e.g. Maybe later" />
                </div>
              </div>

              {/* Button Action */}
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase">Button Action</label>
                <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.primary_button_action} onChange={(e) => setForm((f) => ({ ...f, primary_button_action: e.target.value }))}>
                  {ACTION_PRESETS.map((a) => <option key={a.value} value={a.value}>{a.label}</option>)}
                </select>
                {form.primary_button_action === 'CUSTOM' ? (
                  <input className="w-full mt-2 px-3 py-2 border rounded-lg text-sm" value={customAction} onChange={(e) => setCustomAction(e.target.value)} placeholder="SCREEN:ScreenName or LINK:https://..." />
                ) : null}
              </div>

              {/* Target Screens */}
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase">Show on Screens</label>
                <div className="mt-1 flex flex-wrap gap-2">
                  {SCREEN_OPTIONS.map((screen) => (
                    <button
                      key={screen}
                      type="button"
                      onClick={() => toggleScreen(screen)}
                      className={`px-3 py-2 rounded-lg border text-xs font-bold transition ${form.target_screens.includes(screen) ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                    >
                      {screen}
                    </button>
                  ))}
                </div>
              </div>

              {/* Display Rule & Show For */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase">Display Rule</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.display_rule} onChange={(e) => setForm((f) => ({ ...f, display_rule: e.target.value }))}>
                    {DISPLAY_RULES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase">Show For</label>
                  <select className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.show_for} onChange={(e) => setForm((f) => ({ ...f, show_for: e.target.value }))}>
                    {SHOW_FOR_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Priority & Schedule */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase">Priority</label>
                  <input type="number" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.priority} onChange={(e) => setForm((f) => ({ ...f, priority: Number(e.target.value) }))} />
                  <p className="text-[10px] text-gray-400 mt-1">Higher = shows first</p>
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase">Starts At</label>
                  <input type="datetime-local" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.starts_at} onChange={(e) => setForm((f) => ({ ...f, starts_at: e.target.value }))} />
                </div>
                <div>
                  <label className="text-xs font-bold text-gray-600 uppercase">Ends At</label>
                  <input type="datetime-local" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.ends_at} onChange={(e) => setForm((f) => ({ ...f, ends_at: e.target.value }))} />
                </div>
              </div>

              {/* Image URL */}
              <div>
                <label className="text-xs font-bold text-gray-600 uppercase">Image URL (optional)</label>
                <input className="w-full mt-1 px-3 py-2 border rounded-lg text-sm" value={form.image_url} onChange={(e) => setForm((f) => ({ ...f, image_url: e.target.value }))} placeholder="https://..." />
              </div>

              {/* Active Toggle */}
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, is_active: !f.is_active }))}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${form.is_active ? 'bg-emerald-500' : 'bg-gray-300'}`}
                >
                  <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${form.is_active ? 'translate-x-6' : 'translate-x-1'}`} />
                </button>
                <span className="text-sm font-bold text-gray-700">{form.is_active ? 'Active' : 'Inactive'}</span>
              </div>
            </div>

            <div className="px-6 py-4 border-t flex justify-end gap-2">
              <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-lg border text-sm font-semibold">Cancel</button>
              <button
                type="button"
                disabled={saving}
                onClick={savePopup}
                className="px-5 py-2 rounded-lg bg-blue-600 text-white text-sm font-bold disabled:opacity-50"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin inline mr-1" /> : null}
                {editId ? 'Save Changes' : 'Create Popup'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
