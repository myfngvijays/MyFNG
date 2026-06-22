'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Crown, Plus, Save, Trash2, X } from 'lucide-react';
import MembershipCardFields from '@/components/admin/MembershipCardFields';
import MembershipCardPreview from '@/components/admin/MembershipCardPreview';
import {
  countEnabledCardPlacements,
  listEnabledPlacementLabels,
  parseCardPlacements,
  type CardPlacements,
} from '@/lib/membership-card-placements';
import { normalizeMembershipType, type MembershipType } from '@/lib/membership-placements';

type CardRow = {
  id: string;
  title: string;
  badge?: string | null;
  benefit_line_1?: string | null;
  benefit_line_2?: string | null;
  price: number;
  original_price?: number | null;
  period_label?: string | null;
  card_animated?: boolean;
  card_style?: string;
  placements?: CardPlacements;
  display_order?: number;
  active?: boolean;
};

const EMPTY_FORM = {
  title: '',
  badge: 'PRIME',
  benefit_line_1: '10% off on all services',
  benefit_line_2: '5% cashback to wallet',
  price: 699,
  original_price: 999,
  card_animated: true,
  card_style: 'SERVICE' as MembershipType,
  placements: {} as CardPlacements,
  display_order: 0,
  active: true,
};

function inr(n: number) {
  return `₹${Number(n || 0).toLocaleString('en-IN')}`;
}

function isCardLive(card: CardRow) {
  if (card.active === false) return false;
  return countEnabledCardPlacements(parseCardPlacements(card.placements)) > 0;
}

export default function MembershipCardsPage() {
  const [rows, setRows] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<CardRow | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });

  const { activeRows, inactiveRows } = useMemo(() => {
    const active: CardRow[] = [];
    const inactive: CardRow[] = [];
    for (const card of rows) {
      if (isCardLive(card)) active.push(card);
      else inactive.push(card);
    }
    return { activeRows: active, inactiveRows: inactive };
  }, [rows]);

  async function fetchRows() {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch('/api/super_admin/membership-cards');
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([json?.hint, json?.details, json?.error].filter(Boolean).join(' — ') || 'Failed to load');
      setRows(json.data || []);
    } catch (e: any) {
      setFetchError(e?.message || 'Failed to load membership cards');
      setRows([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchRows();
  }, []);

  function openAdd() {
    setEditing(null);
    setForm({ ...EMPTY_FORM, display_order: rows.length + 1 });
    setModalOpen(true);
  }

  function openEdit(card: CardRow) {
    const style = normalizeMembershipType(card.card_style);
    setEditing(card);
    setForm({
      title: card.title,
      badge: card.badge || 'PRIME',
      benefit_line_1: card.benefit_line_1 || '10% off on all services',
      benefit_line_2: card.benefit_line_2 || '5% cashback to wallet',
      price: Number(card.price || 0),
      original_price: card.original_price != null ? Number(card.original_price) : 999,
      card_animated: card.card_animated !== false,
      card_style: style,
      placements: parseCardPlacements(card.placements, style),
      display_order: card.display_order || 0,
      active: card.active !== false,
    });
    setModalOpen(true);
  }

  async function saveCard(e: React.FormEvent) {
    e.preventDefault();
    if (!form.title.trim()) {
      alert('Card title is required');
      return;
    }
    setSaving(true);
    try {
      const url = editing ? `/api/super_admin/membership-cards/${editing.id}` : '/api/super_admin/membership-cards';
      const res = await fetch(url, {
        method: editing ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error([json?.hint, json?.details, json?.error].filter(Boolean).join('\n') || 'Save failed');
      setModalOpen(false);
      await fetchRows();
    } catch (err: any) {
      alert(err?.message || 'Could not save card');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCard(id: string) {
    if (!confirm('Delete this membership card?')) return;
    const res = await fetch(`/api/super_admin/membership-cards/${id}`, { method: 'DELETE' });
    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(json?.error || 'Delete failed');
      return;
    }
    await fetchRows();
  }

  const formLive = form.active && countEnabledCardPlacements(form.placements) > 0;

  function renderCard(card: CardRow) {
    const style = normalizeMembershipType(card.card_style);
    const live = isCardLive(card);
    const placements = parseCardPlacements(card.placements);
    const slots = countEnabledCardPlacements(placements);
    const placementLabels = listEnabledPlacementLabels(placements);
    return (
      <div key={card.id} className={`rounded-xl border bg-white p-4 shadow-sm space-y-3 ${live ? 'border-emerald-200' : 'border-gray-200'}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap gap-2">
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${style === 'RSA' ? 'bg-red-100 text-red-700' : 'bg-blue-100 text-blue-700'}`}>
                {style === 'RSA' ? 'RSA style' : 'Prime style'}
              </span>
              <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${live ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-100 text-gray-600'}`}>
                {live ? 'Active' : 'Inactive'}
              </span>
            </div>
            <div className="font-bold text-gray-900 mt-1">{card.title}</div>
            <div className="text-xs text-gray-500">{slots} placement{slots === 1 ? '' : 's'} · order {card.display_order ?? 0}</div>
            {placementLabels.length ? (
              <div className="mt-1.5 flex flex-wrap gap-1">
                {placementLabels.map((label) => (
                  <span key={label} className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-blue-50 text-blue-800 border border-blue-100">
                    {label}
                  </span>
                ))}
              </div>
            ) : (
              <div className="text-[11px] text-amber-700 mt-1">No placement selected</div>
            )}
          </div>
          <div className="flex gap-1 shrink-0">
            <button type="button" onClick={() => openEdit(card)} className="rounded-lg bg-amber-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-amber-700">
              Edit
            </button>
            <button type="button" onClick={() => deleteCard(card.id)} className="rounded-lg bg-red-50 text-red-600 p-1.5 hover:bg-red-100">
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
        <MembershipCardPreview
          planName={card.title}
          badge={card.badge || undefined}
          price={inr(Number(card.price || 0))}
          originalPrice={card.original_price ? inr(Number(card.original_price)) : undefined}
          benefitLine1={card.benefit_line_1 || '10% off on all services'}
          benefitLine2={card.benefit_line_2 || '5% cashback to wallet'}
          animated={card.card_animated !== false}
          membershipType={style}
        />
      </div>
    );
  }

  function renderColumn(title: string, subtitle: string, items: CardRow[], accent: 'green' | 'gray') {
    const border = accent === 'green' ? 'border-emerald-200 bg-emerald-50/30' : 'border-gray-200 bg-gray-50/50';
    return (
      <section className={`rounded-2xl border-2 ${border} p-4 space-y-3`}>
        <div>
          <h2 className="text-base font-black text-gray-900">{title}</h2>
          <p className="text-xs text-gray-600">{subtitle}</p>
          <p className="text-[11px] font-bold text-gray-500 mt-1">{items.length} card{items.length === 1 ? '' : 's'}</p>
        </div>
        {items.length === 0 ? (
          <div className="rounded-xl border border-dashed px-4 py-6 text-center text-sm text-gray-500">No cards</div>
        ) : (
          <div className="space-y-3">{items.map(renderCard)}</div>
        )}
      </section>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-amber-100 p-3">
            <Crown className="h-6 w-6 text-amber-700" />
          </div>
          <div>
            <h1 className="text-2xl font-black text-gray-900">Membership Cards</h1>
            <p className="text-sm text-gray-600">
              Alag promo cards — Membership Plans se linked nahi. Ek slot par kai cards = app mein slide carousel.
            </p>
          </div>
        </div>
        <button type="button" onClick={openAdd} className="inline-flex items-center gap-2 rounded-xl bg-amber-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-amber-700">
          <Plus className="h-4 w-4" /> Add Card
        </button>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
        Run <code className="bg-amber-100 px-1 rounded">database/156_membership_cards_table.sql</code> in Supabase.
        Active = card ON + kam se kam 1 placement. <strong>Carousel ke liye dono cards par SAME placement check karein</strong> (e.g. home · Before Reviews).
      </div>

      {fetchError ? <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">{fetchError}</div> : null}

      {loading ? (
        <div className="text-sm text-gray-500">Loading…</div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          {renderColumn('Active', 'App mein dikh rahe hain', activeRows, 'green')}
          {renderColumn('Inactive', 'Band hai ya koi placement nahi', inactiveRows, 'gray')}
        </div>
      )}

      {modalOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 p-4 overflow-y-auto">
          <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl my-4">
            <div className="flex items-center justify-between border-b px-5 py-4">
              <h2 className="text-lg font-bold">{editing ? 'Edit Card' : 'New Card'}</h2>
              <button onClick={() => setModalOpen(false)} className="rounded-lg p-2 hover:bg-gray-100">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-0 lg:divide-x divide-gray-200">
              <form onSubmit={saveCard} className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
                <div className={`rounded-lg border px-3 py-2 text-sm font-bold ${formLive ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-gray-200 bg-gray-50 text-gray-700'}`}>
                  {formLive ? 'Will show in app' : 'Will NOT show — turn Active on & pick placements'}
                </div>
                <MembershipCardFields
                  title={form.title}
                  badge={form.badge}
                  cardStyle={form.card_style}
                  price={form.price}
                  originalPrice={form.original_price}
                  cardBenefitLine1={form.benefit_line_1}
                  cardBenefitLine2={form.benefit_line_2}
                  cardAnimated={form.card_animated}
                  active={form.active}
                  placements={form.placements}
                  onChange={(patch) => setForm({ ...form, ...patch })}
                  onChangePlacements={(placements) => setForm({ ...form, placements })}
                />
                <p className="text-[11px] text-blue-800 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                  Slide carousel: jin cards ko ek saath swipe karna hai, un sab par <strong>same section checkbox</strong> tick karein.
                </p>
                <button type="submit" disabled={saving} className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-amber-600 py-3 text-white font-bold hover:bg-amber-700 disabled:opacity-60">
                  <Save className="h-4 w-4" /> {saving ? 'Saving…' : 'Save Card'}
                </button>
              </form>
              <div className="p-5 bg-gray-50 max-h-[80vh] overflow-y-auto">
                <div className="text-xs font-bold text-gray-500 uppercase mb-2">Preview</div>
                <MembershipCardPreview
                  planName={form.title || 'Card title'}
                  badge={form.badge}
                  price={inr(form.price)}
                  originalPrice={form.original_price > 0 ? inr(form.original_price) : undefined}
                  benefitLine1={form.benefit_line_1}
                  benefitLine2={form.benefit_line_2}
                  animated={form.card_animated}
                  membershipType={form.card_style}
                />
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
