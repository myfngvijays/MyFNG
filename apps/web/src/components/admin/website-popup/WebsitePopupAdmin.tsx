'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Copy, ImagePlus, Megaphone, Plus, Save, Trash2, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import WebsiteOfferPopupCard from '@/components/landing/WebsiteOfferPopupCard';
import {
  DEFAULT_WEBSITE_OFFER_POPUP,
  DEFAULT_WEBSITE_POPUP_COLORS,
  WEBSITE_POPUP_BUTTON_PAGES,
  WEBSITE_POPUP_IMAGE,
  WEBSITE_POPUP_PAGE_OPTIONS,
  type WebsiteOfferPopupConfig,
  type WebsitePopupColors,
} from '@/lib/website-offer-popup';

const COLOR_FIELDS: Array<{ key: keyof WebsitePopupColors; label: string }> = [
  { key: 'card', label: 'Card' },
  { key: 'ring', label: 'Border' },
  { key: 'headline', label: 'Headline' },
  { key: 'subtitle', label: 'Subtitle' },
  { key: 'code_bg', label: 'Coupon background' },
  { key: 'code_text', label: 'Coupon text' },
  { key: 'offer_bg', label: 'Offer background' },
  { key: 'offer_text', label: 'Offer text' },
  { key: 'badge_bg', label: 'Badge background' },
  { key: 'badge_text', label: 'Badge text' },
  { key: 'button_bg', label: 'Button background' },
  { key: 'button_text', label: 'Button text' },
];

function blankPopup(name = 'New popup'): WebsiteOfferPopupConfig {
  return {
    ...DEFAULT_WEBSITE_OFFER_POPUP,
    id: `popup-${Date.now().toString(36)}`,
    name,
    enabled: false,
    pages: [],
    colors: { ...DEFAULT_WEBSITE_POPUP_COLORS },
  };
}

export default function WebsitePopupAdmin() {
  const [popups, setPopups] = useState<WebsiteOfferPopupConfig[]>([DEFAULT_WEBSITE_OFFER_POPUP]);
  const [selectedId, setSelectedId] = useState(DEFAULT_WEBSITE_OFFER_POPUP.id);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [pagesOpen, setPagesOpen] = useState(false);
  const pagesMenuRef = useRef<HTMLDivElement>(null);

  const selected = popups.find((popup) => popup.id === selectedId) || popups[0];

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/super_admin/website-popup', { cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load popups');
      const next = Array.isArray(json.popups) && json.popups.length ? json.popups : [DEFAULT_WEBSITE_OFFER_POPUP];
      setPopups(next);
      setSelectedId(next[0].id);
    } catch (error: any) {
      toast.error(error?.message || 'Could not load popups');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    setPagesOpen(false);
  }, [selectedId]);

  useEffect(() => {
    if (!pagesOpen) return;
    function onPointerDown(event: MouseEvent) {
      if (!pagesMenuRef.current?.contains(event.target as Node)) setPagesOpen(false);
    }
    document.addEventListener('mousedown', onPointerDown);
    return () => document.removeEventListener('mousedown', onPointerDown);
  }, [pagesOpen]);

  const pageSummary = useMemo(() => {
    if (!selected) return '';
    if (!selected.pages.length) return 'No pages selected';
    return WEBSITE_POPUP_PAGE_OPTIONS.filter((page) => selected.pages.includes(page.id))
      .map((page) => page.label)
      .join(', ');
  }, [selected]);

  const patch = (partial: Partial<WebsiteOfferPopupConfig>) => {
    if (!selected) return;
    setPopups((prev) => prev.map((popup) => (popup.id === selected.id ? { ...popup, ...partial } : popup)));
  };

  const patchColor = (key: keyof WebsitePopupColors, value: string) => {
    if (!selected) return;
    patch({ colors: { ...selected.colors, [key]: value } });
  };

  const togglePage = (id: string) => {
    if (!selected) return;
    const pages = selected.pages.includes(id) ? selected.pages.filter((page) => page !== id) : [...selected.pages, id];
    patch({ pages });
  };

  const move = (direction: -1 | 1) => {
    if (!selected) return;
    setPopups((prev) => {
      const index = prev.findIndex((popup) => popup.id === selected.id);
      const nextIndex = index + direction;
      if (index < 0 || nextIndex < 0 || nextIndex >= prev.length) return prev;
      const next = [...prev];
      const [row] = next.splice(index, 1);
      next.splice(nextIndex, 0, row);
      return next;
    });
  };

  const addPopup = () => {
    const next = blankPopup();
    setPopups((prev) => [...prev, next]);
    setSelectedId(next.id);
  };

  const duplicate = () => {
    if (!selected) return;
    const next = {
      ...selected,
      id: `popup-${Date.now().toString(36)}`,
      name: `Copy of ${selected.name}`.slice(0, 60),
      enabled: false,
      colors: { ...selected.colors },
      pages: [...selected.pages],
    };
    setPopups((prev) => [...prev, next]);
    setSelectedId(next.id);
  };

  const remove = () => {
    if (!selected || popups.length < 2) {
      toast.error('Keep at least one popup');
      return;
    }
    if (!window.confirm(`Delete “${selected.name}”?`)) return;
    const remaining = popups.filter((popup) => popup.id !== selected.id);
    setPopups(remaining);
    setSelectedId(remaining[0]?.id || '');
  };

  const uploadImage = async (file: File) => {
    if (!selected) return;
    if (file.size > 8 * 1024 * 1024) {
      toast.error('Image must be under 8MB');
      return;
    }
    setUploading(true);
    try {
      const body = new FormData();
      body.append('file', file);
      const res = await fetch('/api/super_admin/website-popup/upload', { method: 'POST', body });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.url) throw new Error(json?.error || 'Upload failed');
      patch({ image_url: json.url });
      toast.success(
        json.cropped
          ? `Uploaded and cropped to ${WEBSITE_POPUP_IMAGE.label}`
          : `Uploaded ${WEBSITE_POPUP_IMAGE.label}`,
      );
    } catch (error: any) {
      toast.error(error?.message || 'Could not upload image');
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const res = await fetch('/api/super_admin/website-popup', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ popups }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      const next = Array.isArray(json.popups) ? json.popups : popups;
      setPopups(next);
      if (!next.some((popup: WebsiteOfferPopupConfig) => popup.id === selectedId)) {
        setSelectedId(next[0]?.id || '');
      }
      toast.success('Website popups saved');
    } catch (error: any) {
      toast.error(error?.message || 'Could not save popups');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="border-b bg-white">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-4 py-5 sm:px-6">
          <div>
            <div className="flex items-center gap-2 text-sm text-gray-500">
              <Megaphone className="h-4 w-4" />
              Website
            </div>
            <h1 className="mt-1 text-2xl font-bold text-gray-900">Website popups</h1>
            <p className="mt-1 text-sm text-gray-500">
              One popup for home, another for other pages. The higher one in the list wins if both match.
            </p>
          </div>
          <button
            type="button"
            onClick={save}
            disabled={loading || saving}
            className="inline-flex items-center gap-2 rounded-lg bg-[#6b1224] px-4 py-2 text-sm font-semibold text-[#ffe14a] disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl gap-6 px-4 py-6 lg:grid-cols-[240px_minmax(0,1fr)_340px] sm:px-6">
        <aside className="space-y-2">
          {popups.map((popup, index) => (
            <button
              key={popup.id}
              type="button"
              onClick={() => setSelectedId(popup.id)}
              className={`w-full rounded-xl border px-3 py-3 text-left ${
                popup.id === selected?.id ? 'border-[#6b1224] bg-[#fff7ea]' : 'border-gray-200 bg-white'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-sm font-semibold text-gray-900">{popup.name || `Popup ${index + 1}`}</span>
                <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${popup.enabled ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                  {popup.enabled ? 'ON' : 'OFF'}
                </span>
              </div>
              <p className="mt-1 truncate text-xs text-gray-500">{popup.headline}</p>
            </button>
          ))}
          <button
            type="button"
            onClick={addPopup}
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-gray-300 bg-white px-3 py-3 text-sm font-semibold text-gray-700"
          >
            <Plus className="h-4 w-4" />
            Add popup
          </button>
        </aside>

        {selected ? (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <button type="button" onClick={() => move(-1)} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                <ChevronUp className="h-3.5 w-3.5" /> Up
              </button>
              <button type="button" onClick={() => move(1)} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                <ChevronDown className="h-3.5 w-3.5" /> Down
              </button>
              <button type="button" onClick={duplicate} className="inline-flex items-center gap-1 rounded-lg border bg-white px-3 py-2 text-xs font-semibold text-gray-700">
                <Copy className="h-3.5 w-3.5" /> Duplicate
              </button>
              <button type="button" onClick={remove} className="inline-flex items-center gap-1 rounded-lg border border-red-200 bg-white px-3 py-2 text-xs font-semibold text-red-600">
                <Trash2 className="h-3.5 w-3.5" /> Delete
              </button>
            </div>

            <label className="flex items-center justify-between rounded-xl border bg-white px-4 py-3">
              <span className="text-sm font-semibold text-gray-900">Popup on</span>
              <input
                type="checkbox"
                checked={selected.enabled}
                onChange={(e) => patch({ enabled: e.target.checked })}
                className="h-5 w-5 accent-[#6b1224]"
              />
            </label>

            <label className="block rounded-xl border bg-white px-4 py-3">
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Name in admin</span>
              <input
                value={selected.name}
                onChange={(e) => patch({ name: e.target.value })}
                className="w-full rounded-lg border px-3 py-2 text-sm"
              />
            </label>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block rounded-xl border bg-white px-4 py-3">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Start</span>
                <input type="datetime-local" value={selected.starts_at} onChange={(e) => patch({ starts_at: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
              <label className="block rounded-xl border bg-white px-4 py-3">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Expiry</span>
                <input type="datetime-local" value={selected.ends_at} onChange={(e) => patch({ ends_at: e.target.value })} className="w-full rounded-lg border px-3 py-2 text-sm" />
              </label>
            </div>

            <div className={`rounded-xl border bg-white px-4 py-3 ${pagesOpen ? 'relative z-30' : ''}`}>
              <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Show on these pages</span>
              <div className="relative" ref={pagesMenuRef}>
                <button
                  type="button"
                  onClick={() => setPagesOpen((open) => !open)}
                  className="flex w-full items-center justify-between gap-2 rounded-lg border bg-white px-3 py-2 text-left text-sm"
                >
                  <span className="truncate text-gray-900">{pageSummary || 'Select pages'}</span>
                  <ChevronDown className={`h-4 w-4 shrink-0 text-gray-500 transition ${pagesOpen ? 'rotate-180' : ''}`} />
                </button>
                {pagesOpen ? (
                  <div className="absolute left-0 right-0 top-full z-30 mt-1 max-h-72 overflow-auto rounded-lg border bg-white py-1 shadow-lg">
                    {WEBSITE_POPUP_PAGE_OPTIONS.map((page) => (
                      <label key={page.id} className="flex cursor-pointer items-center gap-2 px-3 py-2 text-sm hover:bg-gray-50">
                        <input
                          type="checkbox"
                          checked={selected.pages.includes(page.id)}
                          onChange={() => togglePage(page.id)}
                          className="h-4 w-4 accent-[#6b1224]"
                        />
                        <span className="font-medium text-gray-900">{page.label}</span>
                      </label>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {(
                [
                  ['headline', 'Headline'],
                  ['subtitle', 'Line under headline'],
                  ['coupon_code', 'Coupon code'],
                  ['offer_label', 'Offer label'],
                  ['badge_text', 'Badge'],
                  ['button_text', 'Button text'],
                  ['utm_source', 'UTM source'],
                  ['utm_medium', 'UTM medium'],
                  ['utm_campaign', 'UTM campaign'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="block rounded-xl border bg-white px-4 py-3">
                  <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">{label}</span>
                  <input
                    value={String(selected[key] ?? '')}
                    onChange={(e) => patch({ [key]: e.target.value })}
                    className="w-full rounded-lg border px-3 py-2 text-sm"
                  />
                </label>
              ))}
              <label className="block rounded-xl border bg-white px-4 py-3">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Button page</span>
                <select
                  value={selected.button_href}
                  onChange={(e) => patch({ button_href: e.target.value })}
                  className="w-full rounded-lg border bg-white px-3 py-2 text-sm"
                >
                  {!WEBSITE_POPUP_BUTTON_PAGES.some((page) => page.href === selected.button_href) ? (
                    <option value={selected.button_href}>{selected.button_href}</option>
                  ) : null}
                  {WEBSITE_POPUP_BUTTON_PAGES.map((page) => (
                    <option key={page.href} value={page.href}>
                      {page.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block rounded-xl border bg-white px-4 py-3">
                <span className="mb-1 block text-xs font-bold uppercase tracking-wide text-gray-500">Show times per browser</span>
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={selected.max_views}
                  onChange={(e) => patch({ max_views: Number(e.target.value) })}
                  className="w-full rounded-lg border px-3 py-2 text-sm"
                />
              </label>
            </div>

            <div className="rounded-xl border bg-white px-4 py-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-bold uppercase tracking-wide text-gray-500">Banner image</div>
                  <p className="mt-1 text-sm font-semibold text-gray-900">
                    {WEBSITE_POPUP_IMAGE.label} · {WEBSITE_POPUP_IMAGE.ratio}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">
                    Wide photo. Other sizes are center-cropped to {WEBSITE_POPUP_IMAGE.width} × {WEBSITE_POPUP_IMAGE.height}.
                  </p>
                </div>
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg bg-[#6b1224] px-3 py-2 text-sm font-semibold text-[#ffe14a]">
                  <ImagePlus className="h-4 w-4" />
                  {uploading ? 'Uploading…' : 'Upload'}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) void uploadImage(file);
                    }}
                  />
                </label>
              </div>
              {selected.image_url ? (
                <div className="relative mt-3">
                  <img src={selected.image_url} alt="" className="aspect-[2/1] w-full rounded-lg object-cover" />
                  <button
                    type="button"
                    onClick={() => patch({ image_url: '' })}
                    className="absolute right-2 top-2 rounded-full bg-white p-1 text-gray-700 shadow"
                    aria-label="Remove image"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ) : (
                <p className="mt-3 text-sm text-gray-500">No banner. The popup will show text only.</p>
              )}
            </div>

            <div className="rounded-xl border bg-white px-4 py-3">
              <div className="mb-3 text-xs font-bold uppercase tracking-wide text-gray-500">Colors</div>
              <div className="grid gap-3 sm:grid-cols-2">
                {COLOR_FIELDS.map((field) => (
                  <label key={field.key} className="block">
                    <span className="mb-1 block text-xs font-semibold text-gray-600">{field.label}</span>
                    <span className="flex items-center gap-2">
                      <input
                        type="color"
                        value={
                          /^#[0-9a-fA-F]{6}$/.test(selected.colors?.[field.key] || '')
                            ? selected.colors[field.key]
                            : DEFAULT_WEBSITE_POPUP_COLORS[field.key]
                        }
                        onChange={(e) => patchColor(field.key, e.target.value)}
                        className="h-10 w-12 cursor-pointer rounded border bg-white p-1"
                      />
                      <input
                        value={selected.colors?.[field.key] || ''}
                        onChange={(e) => patchColor(field.key, e.target.value)}
                        className="w-full rounded-lg border px-3 py-2 font-mono text-sm uppercase"
                      />
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        ) : null}

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-gray-500">Preview</div>
          {selected ? (
            <div className="rounded-3xl bg-slate-900/80 p-4">
              <div className="relative">
                <div className="absolute right-2 top-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white text-gray-500 shadow">
                  <X className="h-4 w-4" />
                </div>
                <WebsiteOfferPopupCard popup={selected} preview />
              </div>
            </div>
          ) : (
            <div className="rounded-xl border bg-white p-4 text-sm text-gray-500">Add a popup to preview it.</div>
          )}
        </aside>
      </div>
    </div>
  );
}
