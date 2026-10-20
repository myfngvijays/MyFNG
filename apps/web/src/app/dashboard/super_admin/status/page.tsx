'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';

type CatalogItem = { key: string; name: string; description: string };
type Update = { id: string; state: string; body: string; createdAt: string };
type Incident = {
  id: string;
  title: string;
  impact: string;
  state: string;
  componentKeys: string[];
  updates: Update[];
};
type Maintenance = {
  id: string;
  title: string;
  body: string;
  state: string;
  componentKeys: string[];
  startsAt: string;
  endsAt: string;
};
type Payload = {
  tablesReady: boolean;
  catalog: CatalogItem[];
  headline: string;
  incidents: Incident[];
  maintenances: Maintenance[];
};

const IMPACTS = [
  { id: 'degraded', label: 'Degraded' },
  { id: 'partial_outage', label: 'Partial outage' },
  { id: 'major_outage', label: 'Major outage' },
  { id: 'maintenance', label: 'Maintenance' },
];

const UPDATE_STATES = [
  { id: 'investigating', label: 'Investigating' },
  { id: 'identified', label: 'Identified' },
  { id: 'monitoring', label: 'Monitoring' },
  { id: 'update', label: 'Update' },
  { id: 'resolved', label: 'Resolved' },
];

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(+date)) return '';
  return date.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function localInputValue(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export default function StatusAdminPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [incidentTitle, setIncidentTitle] = useState('');
  const [incidentImpact, setIncidentImpact] = useState('degraded');
  const [incidentBody, setIncidentBody] = useState('');
  const [incidentKeys, setIncidentKeys] = useState<string[]>([]);
  const [maintTitle, setMaintTitle] = useState('');
  const [maintBody, setMaintBody] = useState('');
  const [maintKeys, setMaintKeys] = useState<string[]>([]);
  const [maintStart, setMaintStart] = useState(() => localInputValue(new Date()));
  const [maintEnd, setMaintEnd] = useState(() => localInputValue(new Date(Date.now() + 60 * 60 * 1000)));
  const [drafts, setDrafts] = useState<Record<string, { state: string; body: string }>>({});

  const load = useCallback(async () => {
    const response = await fetch('/api/super_admin/status-page', { cache: 'no-store' });
    const json = await response.json().catch(() => ({}));
    if (!response.ok) {
      setError(json.error || 'Could not load status page');
      return;
    }
    setData(json);
    setError(null);
  }, []);

  useEffect(() => {
    void load().catch(() => setError('Could not load status page'));
  }, [load]);

  async function send(method: 'POST' | 'PATCH', body: Record<string, unknown>) {
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/super_admin/status-page', {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const json = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(json.error || 'Save failed');
      await load();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed');
      return false;
    } finally {
      setSaving(false);
    }
  }

  function toggle(list: string[], key: string, setList: (next: string[]) => void) {
    setList(list.includes(key) ? list.filter((item) => item !== key) : [...list, key]);
  }

  const openIncidents = (data?.incidents || []).filter((item) => item.state !== 'resolved');
  const catalog = data?.catalog || [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Public status</h1>
            <p className="mt-1 text-sm text-gray-600">
              Customers see this on <Link href="/status" className="font-semibold text-blue-700" target="_blank">/status</Link>.
              Live checks stay automatic. Write an incident when you want to explain an outage.
            </p>
          </div>
          <p className="rounded-full bg-white px-3 py-1 text-sm font-semibold text-gray-700 shadow-sm">{data?.headline || 'Loading…'}</p>
        </div>

        {error ? <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p> : null}
        {data && !data.tablesReady ? (
          <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
            Incident tables are not in the database yet. Run database/385_public_status_page.sql. The public page still shows live service checks.
          </p>
        ) : null}

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="font-semibold text-gray-900">Post an incident</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <input value={incidentTitle} onChange={(e) => setIncidentTitle(e.target.value)} placeholder="Short title" className="rounded-lg border border-gray-300 px-3 py-2 text-sm" />
            <select value={incidentImpact} onChange={(e) => setIncidentImpact(e.target.value)} className="rounded-lg border border-gray-300 px-3 py-2 text-sm">
              {IMPACTS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
            </select>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {catalog.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => toggle(incidentKeys, item.key, setIncidentKeys)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${incidentKeys.includes(item.key) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
              >
                {item.name}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-gray-500">Leave services unselected to mark every service.</p>
          <textarea value={incidentBody} onChange={(e) => setIncidentBody(e.target.value)} placeholder="What customers should know" rows={3} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              void send('POST', {
                kind: 'incident',
                title: incidentTitle,
                impact: incidentImpact,
                componentKeys: incidentKeys,
                body: incidentBody,
                state: 'investigating',
              }).then((ok) => {
                if (!ok) return;
                setIncidentTitle('');
                setIncidentBody('');
                setIncidentKeys([]);
              });
            }}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Publish incident
          </button>
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Open incidents</h2>
          {openIncidents.length === 0 ? <p className="text-sm text-gray-500">No open incidents.</p> : null}
          {openIncidents.map((incident) => {
            const draft = drafts[incident.id] || { state: 'monitoring', body: '' };
            return (
              <article key={incident.id} className="rounded-xl border border-gray-200 bg-white p-4">
                <h3 className="font-semibold text-gray-900">{incident.title}</h3>
                <p className="text-xs uppercase tracking-wide text-gray-500">{incident.state} · {incident.impact}</p>
                <ul className="mt-2 space-y-1">
                  {incident.updates.slice(0, 3).map((update) => (
                    <li key={update.id} className="text-sm text-gray-700">
                      <span className="font-semibold">{update.state}</span> · {formatWhen(update.createdAt)} — {update.body}
                    </li>
                  ))}
                </ul>
                <div className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto]">
                  <select
                    value={draft.state}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [incident.id]: { ...draft, state: e.target.value } }))}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {UPDATE_STATES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
                  </select>
                  <input
                    value={draft.body}
                    onChange={(e) => setDrafts((prev) => ({ ...prev, [incident.id]: { ...draft, body: e.target.value } }))}
                    placeholder="Update for customers"
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void send('PATCH', { kind: 'incident', id: incident.id, state: draft.state, body: draft.body })}
                    className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white disabled:opacity-60"
                  >
                    Post update
                  </button>
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-6 rounded-xl border border-gray-200 bg-white p-4">
          <h2 className="font-semibold text-gray-900">Schedule maintenance</h2>
          <input value={maintTitle} onChange={(e) => setMaintTitle(e.target.value)} placeholder="Maintenance title" className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-semibold text-gray-500">
              Starts
              <input type="datetime-local" value={maintStart} onChange={(e) => setMaintStart(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900" />
            </label>
            <label className="text-xs font-semibold text-gray-500">
              Ends
              <input type="datetime-local" value={maintEnd} onChange={(e) => setMaintEnd(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm font-normal text-gray-900" />
            </label>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {catalog.map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => toggle(maintKeys, item.key, setMaintKeys)}
                className={`rounded-full border px-3 py-1 text-xs font-semibold ${maintKeys.includes(item.key) ? 'border-blue-600 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-600'}`}
              >
                {item.name}
              </button>
            ))}
          </div>
          <textarea value={maintBody} onChange={(e) => setMaintBody(e.target.value)} placeholder="What to expect" rows={3} className="mt-3 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm" />
          <button
            type="button"
            disabled={saving}
            onClick={() => {
              void send('POST', {
                kind: 'maintenance',
                title: maintTitle,
                body: maintBody,
                componentKeys: maintKeys,
                startsAt: new Date(maintStart).toISOString(),
                endsAt: new Date(maintEnd).toISOString(),
              });
            }}
            className="mt-3 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            Schedule
          </button>
        </section>

        <section className="mt-6 space-y-3">
          <h2 className="font-semibold text-gray-900">Maintenance windows</h2>
          {(data?.maintenances || []).filter((item) => item.state !== 'completed').map((item) => (
            <article key={item.id} className="rounded-xl border border-gray-200 bg-white p-4">
              <h3 className="font-semibold text-gray-900">{item.title}</h3>
              <p className="text-sm text-gray-500">{formatWhen(item.startsAt)} – {formatWhen(item.endsAt)} IST · {item.state}</p>
              <p className="mt-2 whitespace-pre-wrap text-sm text-gray-700">{item.body}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.state !== 'in_progress' ? (
                  <button type="button" disabled={saving} onClick={() => void send('PATCH', { kind: 'maintenance', id: item.id, state: 'in_progress' })} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold">Mark in progress</button>
                ) : null}
                <button type="button" disabled={saving} onClick={() => void send('PATCH', { kind: 'maintenance', id: item.id, state: 'completed' })} className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold">Mark completed</button>
              </div>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
