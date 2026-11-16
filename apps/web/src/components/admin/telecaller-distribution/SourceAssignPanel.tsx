'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Save, Trash2 } from 'lucide-react';
import {
  SOURCE_ASSIGN_OPTIONS,
  type SourceAssignee,
  type SourceRoute,
} from '@/lib/enquiry/sourceRoutes';

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

export default function SourceAssignPanel() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [telecallers, setTelecallers] = useState<Telecaller[]>([]);
  const [routes, setRoutes] = useState<SourceRoute[]>([]);
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
        setRoutes(Array.isArray(data.source_routes) ? data.source_routes : []);
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

  function routeFor(source: string) {
    return routes.find((row) => row.source === source);
  }

  function setAssignees(source: SourceRoute['source'], assignees: SourceAssignee[]) {
    setSaved(false);
    setRoutes((prev) => {
      const next = prev.filter((row) => row.source !== source);
      if (assignees.length) next.push({ source, assignees });
      return next;
    });
  }

  function addPerson(source: SourceRoute['source']) {
    const current = routeFor(source)?.assignees || [];
    const used = new Set(current.map((row) => row.telecaller_id));
    const nextPerson = telecallers.find((person) => person.is_active && !used.has(person.id));
    if (!nextPerson) return;
    const assignees = [...current, { telecaller_id: nextPerson.id, percent: 0 }];
    const share = Math.floor(100 / assignees.length);
    const extra = 100 - share * assignees.length;
    setAssignees(
      source,
      assignees.map((person, index) => ({ ...person, percent: share + (index < extra ? 1 : 0) })),
    );
  }

  async function save() {
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const payload = routes
        .map((row) => {
          const assignees = row.assignees.filter((person) => person.telecaller_id);
          if (assignees.length === 1) assignees[0] = { ...assignees[0], percent: 100 };
          return { source: row.source, assignees };
        })
        .filter((row) => row.assignees.length > 0);
      const bad = payload.find((row) => {
        const total = row.assignees.reduce((sum, person) => sum + Number(person.percent || 0), 0);
        return row.assignees.length > 1 && total !== 100;
      });
      if (bad) {
        const total = bad.assignees.reduce((sum, person) => sum + Number(person.percent || 0), 0);
        const name = SOURCE_ASSIGN_OPTIONS.find((item) => item.id === bad.source)?.label || bad.source;
        throw new Error(`${name}: percentages add up to ${total}. They need to be 100.`);
      }
      const res = await fetch('/api/admin/telecaller-distribution', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source_routes: payload }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data?.error || 'Save failed');
      setRoutes(Array.isArray(data.source_routes) ? data.source_routes : payload);
      setSaved(true);
    } catch (err: any) {
      setError(err?.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-sm text-gray-500 py-8">Loading source assignment…</div>;
  }

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600 max-w-2xl">
          Har source pe ek telecaller, ya do-zyada log percentage ke saath. Ek insaan = 100%.
          Jo source khali hai, woh purani % allocation se jaati hai. Message trigger pehle match hota hai.
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
            onClick={save}
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            <Save className="h-4 w-4" />
            {saving ? 'Saving…' : 'Save source assign'}
          </button>
        </div>
      </div>
      {error ? <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div> : null}
      {saved ? <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Saved. Nayi leads isi split se jayengi.</div> : null}

      <div className="grid gap-3 lg:grid-cols-2">
        {SOURCE_ASSIGN_OPTIONS.map((source) => {
          const assignees = routeFor(source.id)?.assignees || [];
          const total = assignees.reduce((sum, person) => sum + Number(person.percent || 0), 0);
          const many = assignees.length > 1;
          return (
            <div key={source.id} className="rounded-xl border bg-white p-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold text-slate-900">{source.label}</div>
                  <div className="text-xs text-gray-500">{source.hint}</div>
                </div>
                <button
                  type="button"
                  onClick={() => addPerson(source.id)}
                  className="inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add person
                </button>
              </div>

              {assignees.length === 0 ? (
                <div className="mt-3 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  Not set. Is source ki nayi leads purani allocation se jayengi.
                </div>
              ) : (
                <div className="mt-3 space-y-2">
                  {assignees.map((person, index) => {
                    const selected = byId.get(person.telecaller_id);
                    const options = telecallers.filter(
                      (item) =>
                        item.is_active ||
                        showInactive ||
                        item.id === person.telecaller_id,
                    );
                    return (
                      <div key={`${source.id}-${index}`} className="flex items-center gap-2">
                        <select
                          value={person.telecaller_id}
                          onChange={(event) => {
                            const next = assignees.map((row, i) =>
                              i === index ? { ...row, telecaller_id: event.target.value } : row,
                            );
                            setAssignees(source.id, next);
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
                                const next = assignees.map((row, i) =>
                                  i === index ? { ...row, percent: Number(event.target.value || 0) } : row,
                                );
                                setAssignees(source.id, next);
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
                            setAssignees(source.id, next);
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
                    {many ? `Total ${total}% — 100 hona chahiye` : 'Sirf ek assignee, saari leads isko'}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
