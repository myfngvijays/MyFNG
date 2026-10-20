'use client';

import { useCallback, useEffect, useState } from 'react';
import Navbar from '@/components/landing/Navbar';
import Footer from '@/components/landing/Footer';

type PublicStatus = 'operational' | 'degraded' | 'partial_outage' | 'major_outage' | 'maintenance';
type UpdateState = 'investigating' | 'identified' | 'monitoring' | 'resolved' | 'update';

type Update = { id: string; state: UpdateState; body: string; createdAt: string };
type Incident = {
  id: string;
  title: string;
  impact: PublicStatus;
  state: string;
  componentKeys?: string[];
  updates: Update[];
};
type Maintenance = {
  id: string;
  title: string;
  body: string;
  state: string;
  componentKeys?: string[];
  startsAt: string;
  endsAt: string;
};
type HistoryItem = {
  id: string;
  kind: 'incident' | 'maintenance';
  title: string;
  endedAt: string;
  updates: Update[];
};
type ComponentRow = {
  key: string;
  group: string;
  name: string;
  description: string;
  status: PublicStatus;
  label: string;
  message: string;
  detail: string;
};
type Payload = {
  overall: PublicStatus;
  headline: string;
  summary?: string;
  updatedAt: string;
  components: ComponentRow[];
  incidents: Incident[];
  maintenances: Maintenance[];
  history: HistoryItem[];
};

const BANNER: Record<PublicStatus, string> = {
  operational: 'bg-emerald-600',
  degraded: 'bg-amber-500',
  partial_outage: 'bg-orange-600',
  major_outage: 'bg-red-600',
  maintenance: 'bg-blue-700',
};

const DOT: Record<PublicStatus, string> = {
  operational: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  partial_outage: 'bg-orange-500',
  major_outage: 'bg-red-500',
  maintenance: 'bg-blue-600',
};

function affectedLabel(keys: string[] | undefined, components: ComponentRow[]) {
  if (!keys?.length) return 'All services';
  const names = new Map(components.map((item) => [item.key, item.name]));
  return keys.map((key) => names.get(key) || key).join(', ');
}

function groupComponents(components: ComponentRow[]) {
  const groups: Array<{ name: string; items: ComponentRow[] }> = [];
  for (const item of components) {
    const last = groups[groups.length - 1];
    if (!last || last.name !== item.group) groups.push({ name: item.group, items: [item] });
    else last.items.push(item);
  }
  return groups;
}

const LEGEND: Array<{ status: PublicStatus; label: string; hint: string }> = [
  { status: 'operational', label: 'Operational', hint: 'Working as usual' },
  { status: 'degraded', label: 'Degraded', hint: 'Slow, still usable' },
  { status: 'partial_outage', label: 'Partial outage', hint: 'Some people affected' },
  { status: 'major_outage', label: 'Major outage', hint: 'Not available' },
  { status: 'maintenance', label: 'Maintenance', hint: 'Planned work' },
];

const STATE_LABEL: Record<string, string> = {
  investigating: 'Investigating',
  identified: 'Identified',
  monitoring: 'Monitoring',
  resolved: 'Resolved',
  update: 'Update',
  scheduled: 'Scheduled',
  in_progress: 'In progress',
  completed: 'Completed',
};

function formatWhen(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(+date)) return '';
  return date.toLocaleString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function dayLabel(iso: string) {
  const date = new Date(iso);
  if (Number.isNaN(+date)) return '';
  return date.toLocaleDateString('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function groupHistory(items: HistoryItem[]) {
  const groups: Array<{ day: string; items: HistoryItem[] }> = [];
  for (const item of items) {
    const day = dayLabel(item.endedAt);
    const last = groups[groups.length - 1];
    if (!last || last.day !== day) groups.push({ day, items: [item] });
    else last.items.push(item);
  }
  return groups;
}

export default function StatusBoard() {
  const [data, setData] = useState<Payload | null>(null);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/status', { cache: 'no-store' });
      if (!response.ok) throw new Error('status');
      setData(await response.json());
      setError(false);
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 60_000);
    return () => clearInterval(timer);
  }, [load]);

  const overall = data?.overall;
  const history = groupHistory(data?.history || []);
  const groups = groupComponents(data?.components || []);
  const bannerClass = overall ? BANNER[overall] : 'bg-slate-500';

  return (
    <>
      <Navbar />
      <main className="min-h-screen bg-slate-50 px-4 pb-16 pt-40 text-slate-800">
        <div className="mx-auto max-w-2xl">
          <h1 className="text-2xl font-bold text-slate-900">System status</h1>
          <p className="mt-1 text-sm text-slate-500">
            What customers and workshops can use right now.
            {data?.updatedAt ? ` Checked ${formatWhen(data.updatedAt)} IST.` : ''}
          </p>

          <div className={`mt-4 rounded-lg px-4 py-3 text-white ${bannerClass}`}>
            <p className="font-semibold">{data?.headline || (error ? 'Status is temporarily unavailable' : 'Checking services…')}</p>
            {data?.summary ? <p className="mt-1 text-sm text-white/90">{data.summary}</p> : null}
          </div>

          {data?.incidents?.length ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Active incidents</h2>
              <div className="mt-3 space-y-4">
                {data.incidents.map((incident) => (
                  <article key={incident.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                    <h3 className="font-semibold text-slate-900">{incident.title}</h3>
                    <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">
                      {LEGEND.find((item) => item.status === incident.impact)?.label || incident.impact} · {affectedLabel(incident.componentKeys, data?.components || [])}
                    </p>
                    <ol className="mt-3 space-y-3">
                      {incident.updates.map((update) => (
                        <li key={update.id} className="border-l-2 border-slate-200 pl-3">
                          <p className="text-sm font-semibold text-slate-800">
                            {STATE_LABEL[update.state] || 'Update'}
                            <span className="ml-2 font-normal text-slate-500">{formatWhen(update.createdAt)} IST</span>
                          </p>
                          <p className="mt-1 whitespace-pre-wrap text-sm text-slate-700">{update.body}</p>
                        </li>
                      ))}
                    </ol>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6 space-y-5">
            {groups.map((group) => (
              <div key={group.name}>
                <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">{group.name}</h2>
                <div className="mt-2 space-y-2">
                  {group.items.map((component) => (
                    <article key={component.key} className="rounded-lg border border-slate-200 bg-white px-4 py-3">
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-semibold text-slate-900">{component.name}</h3>
                        <p className="flex shrink-0 items-center gap-2 text-sm text-slate-700">
                          <span className={`h-2 w-2 rounded-full ${DOT[component.status]}`} />
                          {component.label}
                        </p>
                      </div>
                      <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{component.detail}</p>
                    </article>
                  ))}
                </div>
              </div>
            ))}
            {!groups.length ? (
              <p className="text-sm text-slate-500">{error ? 'Could not load status. Refresh in a moment.' : 'Loading services…'}</p>
            ) : null}
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
              {LEGEND.map((item) => (
                <li key={item.status} className="flex items-center gap-2 text-xs text-slate-500">
                  <span className={`h-2 w-2 rounded-full ${DOT[item.status]}`} />
                  <span><span className="font-medium text-slate-700">{item.label}</span> · {item.hint}</span>
                </li>
              ))}
            </ul>
          </section>

          {data?.maintenances?.length ? (
            <section className="mt-8">
              <h2 className="text-lg font-semibold text-slate-900">Scheduled maintenance</h2>
              <div className="mt-3 space-y-3">
                {data.maintenances.map((item) => (
                  <article key={item.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <h3 className="font-semibold text-slate-900">{item.title}</h3>
                      <p className="text-sm text-slate-500">
                        {formatWhen(item.startsAt)} – {formatWhen(item.endsAt)} IST
                      </p>
                    </div>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-blue-700">
                      {STATE_LABEL[item.state] || item.state} · {affectedLabel(item.componentKeys, data?.components || [])}
                    </p>
                    <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">{item.body}</p>
                  </article>
                ))}
              </div>
            </section>
          ) : null}

          <section className="mt-6">
            <h2 className="text-sm font-semibold text-slate-900">Past incidents</h2>
            {history.length ? (
              <div className="mt-3 space-y-6">
                {history.map((group) => (
                  <div key={group.day}>
                    <h3 className="text-sm font-semibold text-slate-500">{group.day}</h3>
                    <div className="mt-2 space-y-3">
                      {group.items.map((item) => (
                        <article key={`${item.kind}-${item.id}`} className="rounded-xl border border-slate-200 bg-white p-4">
                          <h4 className="font-semibold text-slate-900">{item.title}</h4>
                          <ol className="mt-3 space-y-2">
                            {item.updates.slice(0, 4).map((update) => (
                              <li key={update.id}>
                                <p className="text-sm font-semibold text-slate-800">
                                  {STATE_LABEL[update.state] || 'Update'}
                                  <span className="ml-2 font-normal text-slate-500">{formatWhen(update.createdAt)} IST</span>
                                </p>
                                <p className="whitespace-pre-wrap text-sm text-slate-700">{update.body}</p>
                              </li>
                            ))}
                          </ol>
                        </article>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-slate-600">No incidents were reported in the last 30 days.</p>
            )}
          </section>
        </div>
      </main>
      <Footer />
    </>
  );
}
