'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { BookOpen, Loader2, Save } from 'lucide-react';
import PageHelpIcon from '@/components/PageHelpIcon';
import type { SalesPlaybook } from '@/lib/telecaller/salesPlaybookDefaults';

const SECTIONS: Array<{
  key: keyof SalesPlaybook;
  label: string;
  hint: string;
  rows?: number;
}> = [
  { key: 'voice_style', label: 'Voice & Style', hint: 'Tone, language, consultative vs pushy.', rows: 5 },
  { key: 'icp', label: 'Who we sell to', hint: 'ICP + buying signals. Grounds Risk / Buyer type.', rows: 12 },
  { key: 'product_features', label: 'Product features', hint: 'USPs Call IQ pitch checklist ke against.', rows: 12 },
  { key: 'pricing', label: 'Pricing', hint: 'Tiers, what to collect before quote, no-discount rule.', rows: 10 },
  { key: 'objection_handling', label: 'Objection handling', hint: 'Top objections + proven responses.', rows: 12 },
  { key: 'competitors', label: 'Competitors', hint: 'Position MY FNG without attacking others.', rows: 10 },
  { key: 'call_iq_prompt', label: 'Call IQ prompt', hint: 'Sales SOP auditor — structured fields isi se nikalte hain.', rows: 16 },
  { key: 'lead_iq_prompt', label: 'Lead IQ prompt', hint: 'Strategist brief for one lead.', rows: 12 },
];

export default function SalesPlaybookPanel({
  helpHref,
  suiteHref,
}: {
  helpHref: string;
  suiteHref: string;
}) {
  const [tab, setTab] = useState<(typeof SECTIONS)[number]['key']>('voice_style');
  const [book, setBook] = useState<SalesPlaybook | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/super_admin/ai-suite/playbook', { credentials: 'include', cache: 'no-store' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load playbook');
      setBook(json.playbook);
    } catch (e: any) {
      setError(e?.message || 'Failed');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    if (!book) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const res = await fetch('/api/super_admin/ai-suite/playbook', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(book),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Save failed');
      setBook(json.playbook);
      setSaved(true);
    } catch (e: any) {
      setError(e?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  const section = SECTIONS.find((s) => s.key === tab)!;

  return (
    <div className="p-4 sm:p-6 space-y-4 max-w-[1100px]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 flex items-center gap-2">
            <BookOpen className="h-7 w-7 text-violet-700" />
            Sales Playbook
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Call IQ aur Lead IQ isi playbook se score / brief banate hain.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <PageHelpIcon href={helpHref} label="Sales Playbook" />
          <Link href={suiteHref} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium">
            AI Suite
          </Link>
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || !book}
            className="inline-flex items-center gap-1.5 rounded-lg bg-violet-700 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-900">{error}</div>
      ) : null}
      {saved ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          Playbook saved.
        </div>
      ) : null}

      {loading || !book ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-violet-700" />
        </div>
      ) : (
        <div className="grid lg:grid-cols-[220px_1fr] gap-4">
          <nav className="flex lg:flex-col gap-1 overflow-x-auto">
            {SECTIONS.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setTab(s.key)}
                className={`whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm font-medium ${
                  tab === s.key ? 'bg-violet-700 text-white' : 'bg-white border border-slate-200 text-slate-700'
                }`}
              >
                {s.label}
              </button>
            ))}
          </nav>
          <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
            <div className="flex flex-wrap gap-3">
              <label className="text-xs font-semibold text-slate-500">
                Depth
                <select
                  className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  value={book.detail_depth}
                  onChange={(e) =>
                    setBook({ ...book, detail_depth: e.target.value as SalesPlaybook['detail_depth'] })
                  }
                >
                  <option value="concise">Concise</option>
                  <option value="standard">Standard</option>
                  <option value="detailed">Detailed</option>
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-500">
                Language
                <input
                  className="mt-1 block rounded-lg border border-slate-200 px-2 py-1.5 text-sm"
                  value={book.language}
                  onChange={(e) => setBook({ ...book, language: e.target.value })}
                />
              </label>
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-900">{section.label}</h2>
              <p className="text-xs text-slate-500">{section.hint}</p>
            </div>
            <textarea
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm leading-relaxed min-h-[280px]"
              rows={section.rows || 12}
              value={String(book[section.key] ?? '')}
              onChange={(e) => setBook({ ...book, [section.key]: e.target.value })}
            />
          </div>
        </div>
      )}
    </div>
  );
}
