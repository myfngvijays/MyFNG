'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import { type CatchAllAssignees, type SourceAssignee } from '@/lib/enquiry/sourceRoutes';

type Telecaller = {
  id: string;
  full_name: string | null;
  email: string | null;
  phone: string | null;
  is_active: boolean;
};

function labelOf(person: Telecaller | undefined) {
  if (!person) return 'Telecaller';
  return person.full_name || person.email || person.phone || person.id.slice(0, 8);
}

export default function AnyLeadPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [route, setRoute] = useState<CatchAllAssignees>({ enabled: false, assignees: [] });
  const [showInactive, setShowInactive] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/admin/telecaller-distribution');
        const data = await res.json();
        if (!res.ok) throw new Error(data?.error || 'Failed to load');
        if (cancelled) return;
        setTelecallers(Array.isArray(data.telecallers) ? data.telecallers : []);
        const incoming = data.catch_all;
        setRoute({
          enabled: Boolean(incoming?.enabled),
          assignees: Array.isArray(incoming?.assignees) ? incoming.assignees : [],
        });
      } catch (err: any) {
        if (!cancelled) setError(err?.message || 'Failed to load');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const byId = useMemo(() => new Map(telecallers.map((person) => [person.id, person])), [telecallers]);
  const inactiveCount = telecallers.filter((person) => !person.is_active).length;
  const assignees = route.assignees;
  const total = assignees.reduce((sum, person) => sum + Number(person.percent || 0), 0);
  const many = assignees.length > 1;

  function setAssignees(next: SourceAssignee[]) {
    setSaved(false);
    setRoute((prev) => ({ ...prev, assignees: next }));
  }

  function addPerson() {
    const used = new Set(assignees.map((row) => row.telecaller_id));
    const nextPerson = telecallers.find((person) => person.is_active && !used.has(person.id));
    if (!nextPerson) return;
    const next = [...assignees, { telecaller_id: nextPerson.id, percent: 0 }];
    const share = Math.floor(100 / next.length);
    const extra = 100 - share * next.length;
    setAssignees(next.map((person, index) => ({ ...person, percent: share + (index < extra ? 1 : 0) })));
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const people = assignees.filter((person) => person.telecaller_id);
      if (people.length === 1) people[0] = { ...people[0], percent: 100 };
      if (route.enabled && people.length === 0) {
        throw new Error('Kam se kam ek telecaller chuno, ya option band karo.');
      }
      if (route.enabled && people.length > 1 && people.reduce((sum, person) => sum + Number(person.percent || 0), 0) !== 100) {
        throw new Error('Percentages 100 hone chahiye.');
      }
      const res = await fetch('/api/admin/telecaller-distribution', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ catch_all: { enabled: route.enabled, assignees: people } }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      if (data.catch_all) setRoute(data.catch_all);
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500 py-8">Loading…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="max-w-2xl text-sm text-gray-600">
          Message trigger pehle chalega, jaise Rupesh wale phrases. Yeh option on hai toh baaki har nayi lead
          sirf yahan chune hue logon ko jayegi. Source assign aur % allocation tab use nahi honge.
        </p>
        <div className="flex items-center gap-2">
          {inactiveCount > 0 ? (
            <button
              type="button"
              onClick={() => setShowInactive((value) => !value)}
              className="text-xs font-semibold text-red-600 underline"
            >
              {showInactive ? 'Hide inactive' : `Show inactive (${inactiveCount})`}
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {saved ? (
        <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
          Saved. Aage ki nayi leads isi list se jayengi.
        </div>
      ) : null}

      <div className="max-w-xl rounded-xl border bg-white p-4">
        <label className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <input
            type="checkbox"
            checked={route.enabled}
            onChange={(event) => {
              setSaved(false);
              setRoute((prev) => ({ ...prev, enabled: event.target.checked }));
            }}
            className="rounded border-slate-300"
          />
          Sirf in assignees ko bhejo
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Band hai toh purana source assign aur % allocation chalega.
        </p>

        <div className="mt-3 flex items-center justify-between">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-400">Assignees</div>
          <button
            type="button"
            onClick={addPerson}
            className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
          >
            <Plus className="h-3.5 w-3.5" />
            Add person
          </button>
        </div>

        {assignees.length === 0 ? (
          <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
            Abhi koi nahi. Add person se telecaller chuno.
          </div>
        ) : (
          <div className="mt-3 space-y-2">
            {assignees.map((person, index) => {
              const selected = byId.get(person.telecaller_id);
              const options = telecallers.filter(
                (item) => item.is_active || showInactive || item.id === person.telecaller_id,
              );
              return (
                <div key={`${person.telecaller_id}-${index}`} className="flex items-center gap-2">
                  <select
                    value={person.telecaller_id}
                    onChange={(event) => {
                      setAssignees(
                        assignees.map((row, i) =>
                          i === index ? { ...row, telecaller_id: event.target.value } : row,
                        ),
                      );
                    }}
                    className="min-w-0 flex-1 rounded-lg border px-2 py-1.5 text-sm"
                  >
                    {options.map((item) => (
                      <option key={item.id} value={item.id}>
                        {labelOf(item)}
                        {item.is_active ? '' : ' (inactive)'}
                      </option>
                    ))}
                    {selected && !options.some((item) => item.id === selected.id) ? (
                      <option value={selected.id}>{labelOf(selected)} (inactive)</option>
                    ) : null}
                  </select>
                  {many ? (
                    <label className="flex items-center gap-1 text-xs text-gray-500">
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={person.percent}
                        onChange={(event) => {
                          setAssignees(
                            assignees.map((row, i) =>
                              i === index ? { ...row, percent: Number(event.target.value || 0) } : row,
                            ),
                          );
                        }}
                        className="w-16 rounded-lg border px-2 py-1.5 text-sm"
                      />
                      %
                    </label>
                  ) : (
                    <span className="w-14 text-right text-xs font-semibold text-slate-500">100%</span>
                  )}
                  <button
                    type="button"
                    onClick={() => {
                      const next = assignees.filter((_, i) => i !== index);
                      if (next.length === 1) next[0] = { ...next[0], percent: 100 };
                      setAssignees(next);
                    }}
                    className="rounded-lg p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600"
                    aria-label="Remove"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              );
            })}
            <div className={`text-xs font-semibold ${many && total !== 100 ? 'text-red-600' : 'text-slate-500'}`}>
              {many ? `Total ${total}% — 100 hona chahiye` : 'Sirf ek assignee, saari nayi leads isko'}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
