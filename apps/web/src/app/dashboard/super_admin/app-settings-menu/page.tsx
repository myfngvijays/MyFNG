'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Smartphone, Save, RefreshCw, Loader2, GripVertical,
  User, MapPin, Trophy, Wallet, Receipt, ShoppingCart, Tag, Gift, Bell,
  ShieldCheck, FileText, HelpCircle, Trash2, Eye, EyeOff,
} from 'lucide-react';

type MenuItem = {
  id: string;
  menu_id: string;
  label: string;
  icon: string;
  section: string;
  enabled: boolean;
  display_order: number;
  requires_login: boolean;
};

const ICON_MAP: Record<string, any> = {
  person: User, location: MapPin, trophy: Trophy, wallet: Wallet,
  receipt: Receipt, cart: ShoppingCart, pricetag: Tag, gift: Gift,
  notifications: Bell, 'shield-checkmark': ShieldCheck, 'document-text': FileText,
  'help-circle': HelpCircle, trash: Trash2,
};

export default function AppSettingsMenuPage() {
  const [items, setItems] = useState<MenuItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/app-settings-menu');
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      setItems(json?.items || []);
      setHasChanges(false);
    } catch (err: any) {
      setError(err?.message || 'Failed to load menu config');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const toggleItem = (menuId: string) => {
    setItems((prev) => prev.map((item) =>
      item.menu_id === menuId ? { ...item, enabled: !item.enabled } : item
    ));
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const payload = items.map((item) => ({
        menu_id: item.menu_id,
        enabled: item.enabled,
        label: item.label,
        display_order: item.display_order,
      }));
      const res = await fetch('/api/admin/app-settings-menu', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ items: payload }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || 'Failed to save');
      setItems(json?.items || []);
      setHasChanges(false);
      setSuccess('Settings saved successfully! Changes will reflect in the app.');
      setTimeout(() => setSuccess(null), 4000);
    } catch (err: any) {
      setError(err?.message || 'Failed to save');
    } finally {
      setSaving(false);
    }
  };

  const mainItems = items.filter((i) => i.section === 'main');
  const legalItems = items.filter((i) => i.section === 'legal');
  const enabledCount = items.filter((i) => i.enabled).length;
  const disabledCount = items.filter((i) => !i.enabled).length;

  if (loading) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-4 md:p-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Smartphone className="w-7 h-7 text-brand-primary" />
            App Settings Menu
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            Control which menu items are visible on the mobile app Settings screen
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            className="px-3 py-2 border rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 flex items-center gap-2"
            onClick={fetchItems}
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            className="px-5 py-2 bg-brand-primary text-white rounded-lg text-sm font-bold hover:opacity-90 flex items-center gap-2 disabled:opacity-50"
            onClick={handleSave}
            disabled={saving || !hasChanges}
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-sm">{error}</div>}
      {success && <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-xl text-sm">{success}</div>}

      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Total Items</div>
          <div className="text-2xl font-bold mt-1">{items.length}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Visible</div>
          <div className="text-2xl font-bold mt-1 text-green-600">{enabledCount}</div>
        </div>
        <div className="bg-white rounded-xl border p-4">
          <div className="text-xs text-gray-500 uppercase tracking-wider">Hidden</div>
          <div className="text-2xl font-bold mt-1 text-red-600">{disabledCount}</div>
        </div>
      </div>

      {hasChanges && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 px-4 py-3 rounded-xl text-sm flex items-center justify-between">
          <span>You have unsaved changes</span>
          <button className="font-bold underline" onClick={handleSave}>Save Now</button>
        </div>
      )}

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Main Menu</h2>
          <p className="text-xs text-gray-500 mt-0.5">My Profile, Addresses, Membership, Wallet, Orders etc.</p>
        </div>
        <div className="divide-y">
          {mainItems.map((item) => {
            const IconComp = ICON_MAP[item.icon] || Smartphone;
            return (
              <div key={item.menu_id} className={`flex items-center justify-between px-5 py-4 transition-colors ${item.enabled ? 'bg-white' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.enabled ? 'bg-brand-primary/10' : 'bg-gray-200'}`}>
                    <IconComp className={`w-5 h-5 ${item.enabled ? 'text-brand-primary' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className={`font-semibold text-sm ${item.enabled ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                      {item.label}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                      <span className="font-mono">{item.menu_id}</span>
                      {item.requires_login && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-semibold">Login Required</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {item.enabled ? (
                    <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Visible</span>
                  ) : (
                    <span className="text-xs text-red-500 font-semibold flex items-center gap-1"><EyeOff className="w-3.5 h-3.5" /> Hidden</span>
                  )}
                  <button
                    type="button"
                    className={`relative w-12 h-6 rounded-full transition-colors ${item.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    onClick={() => toggleItem(item.menu_id)}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
                      style={{ left: item.enabled ? '26px' : '4px' }}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="p-4 border-b">
          <h2 className="font-bold text-lg">Legal & Support</h2>
          <p className="text-xs text-gray-500 mt-0.5">Privacy Policy, Terms, Support, Delete Account</p>
        </div>
        <div className="divide-y">
          {legalItems.map((item) => {
            const IconComp = ICON_MAP[item.icon] || Smartphone;
            return (
              <div key={item.menu_id} className={`flex items-center justify-between px-5 py-4 transition-colors ${item.enabled ? 'bg-white' : 'bg-gray-50'}`}>
                <div className="flex items-center gap-4">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${item.enabled ? 'bg-brand-primary/10' : 'bg-gray-200'}`}>
                    <IconComp className={`w-5 h-5 ${item.enabled ? 'text-brand-primary' : 'text-gray-400'}`} />
                  </div>
                  <div>
                    <div className={`font-semibold text-sm ${item.enabled ? 'text-gray-800' : 'text-gray-400 line-through'}`}>
                      {item.label}
                    </div>
                    <div className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-2">
                      <span className="font-mono">{item.menu_id}</span>
                      {item.requires_login && <span className="px-1.5 py-0.5 bg-blue-50 text-blue-600 rounded text-[10px] font-semibold">Login Required</span>}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {item.enabled ? (
                    <span className="text-xs text-green-600 font-semibold flex items-center gap-1"><Eye className="w-3.5 h-3.5" /> Visible</span>
                  ) : (
                    <span className="text-xs text-red-500 font-semibold flex items-center gap-1"><EyeOff className="w-3.5 h-3.5" /> Hidden</span>
                  )}
                  <button
                    type="button"
                    className={`relative w-12 h-6 rounded-full transition-colors ${item.enabled ? 'bg-green-500' : 'bg-gray-300'}`}
                    onClick={() => toggleItem(item.menu_id)}
                  >
                    <span
                      className="absolute top-1 w-4 h-4 rounded-full bg-white shadow transition-transform"
                      style={{ left: item.enabled ? '26px' : '4px' }}
                    />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-sm text-blue-700">
        <strong>How it works:</strong> Toggle items on/off to show or hide them in the mobile app Settings screen.
        Changes take effect within ~60 seconds after saving (app caches the config briefly).
      </div>
    </div>
  );
}
