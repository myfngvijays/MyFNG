'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  CheckSquare,
  Flag,
  GitMerge,
  ListFilter,
  MessageCircle,
  Phone,
  Plus,
  Search,
  StickyNote,
  Users,
  Webhook,
  X,
} from 'lucide-react';
import {
  ACTIVITY_BY_KEY,
  ACTIVITY_DEFS,
  CALL_STATUS_OPTIONS,
  DATE_PRESETS,
  FIELD_BY_KEY,
  FIELD_DEFS,
  TASK_STATUS_OPTIONS,
  newConditionId,
  opsForField,
  presetLabel,
  type ActivityDef,
  type FieldDef,
  type LeadCondition,
  type OptionSource,
} from '@/lib/crm/leadConditions';

type Opt = { value: string; label: string };
type Options = Partial<Record<OptionSource, Opt[]>>;

let optionsCache: Options | null = null;
let optionsPromise: Promise<Options> | null = null;

function loadOptions(): Promise<Options> {
  if (optionsCache) return Promise.resolve(optionsCache);
  if (!optionsPromise) {
    optionsPromise = fetch('/api/crm/lead-condition-options', { cache: 'no-store' })
      .then((r) => r.json())
      .then((j) => {
        optionsCache = (j?.options || {}) as Options;
        return optionsCache;
      })
      .catch(() => {
        optionsPromise = null;
        return {};
      });
  }
  return optionsPromise;
}

const ICONS: Record<ActivityDef['icon'], React.ComponentType<{ className?: string }>> = {
  call: Phone,
  whatsapp: MessageCircle,
  note: StickyNote,
  task: CheckSquare,
  assignee: Users,
  status: Flag,
  merge: GitMerge,
  api: Webhook,
};

const inputCls =
  'h-9 w-full rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-semibold text-slate-800 focus:border-[#004AAD] focus:outline-none focus:ring-2 focus:ring-blue-100';
const labelCls = 'mb-1 block text-[11px] font-bold uppercase tracking-wide text-slate-500';

function optionsFor(def: FieldDef, options: Options): Opt[] {
  if (def.staticOptions) return def.staticOptions;
  return (def.options && options[def.options]) || [];
}

function labelsOf(values: string[] | undefined, opts: Opt[]) {
  const map = new Map(opts.map((o) => [o.value, o.label]));
  const names = (values || []).map((v) => map.get(v) || v);
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

/** One-line chip text for a condition. */
function summarize(c: LeadCondition, options: Options): { title: string; detail: string } {
  const field = FIELD_BY_KEY.get(c.key);
  if (field) {
    const op = opsForField(field.type).find((o) => o.value === c.op)?.label || c.op;
    let detail = op;
    if (field.type === 'select' && (c.op === 'any_of' || c.op === 'none_of')) {
      detail = `${op} ${labelsOf(c.values, optionsFor(field, options)) || '—'}`;
    } else if (field.type === 'text' && c.value) {
      detail = `${op} “${c.value}”`;
    } else if (field.type === 'number') {
      detail = c.op === 'between' ? `between ${c.value || '…'}–${c.extra?.to_value || '…'}` : c.value ? `${op} ${c.value}` : op;
    } else if (field.type === 'date' && c.op === 'in_range') {
      detail = presetLabel(c);
    }
    return { title: field.label, detail };
  }
  const act = ACTIVITY_BY_KEY.get(c.key);
  const x = c.extra || {};
  const bits: string[] = [];
  const not = c.op === 'has_not';
  const nameOf = (src: OptionSource, id?: string) => (id ? (options[src] || []).find((o) => o.value === id)?.label || 'someone' : '');
  switch (c.key) {
    case 'call':
      bits.push(not ? 'No call' : 'Has call');
      if (x.status) bits.push(CALL_STATUS_OPTIONS.find((o) => o.value === x.status)?.label || x.status);
      if (x.by) bits.push(`by ${nameOf('telecallers', x.by)}`);
      if (x.min_duration) bits.push(`≥ ${x.min_duration}s`);
      break;
    case 'whatsapp':
      bits.push(not ? 'No message from customer' : 'Customer messaged');
      break;
    case 'note':
      bits.push(not ? 'No note' : 'Has note');
      if (c.value) bits.push(`“${c.value}”`);
      break;
    case 'task':
      bits.push(not ? 'No task' : 'Has task');
      if (x.status) bits.push(TASK_STATUS_OPTIONS.find((o) => o.value === x.status)?.label || x.status);
      if (x.by) bits.push(`for ${nameOf('telecallers', x.by)}`);
      break;
    case 'assignee_change':
      bits.push(not ? 'Never transferred' : 'Transferred');
      if (x.to) bits.push(`to ${nameOf('telecallers', x.to)}`);
      break;
    case 'status_change':
      bits.push(not ? 'never' : 'was');
      bits.push(labelsOf(c.values, options.statuses || []) || '—');
      break;
    case 'lead_merged':
      bits.push(not ? 'No merge' : 'Has merged duplicates');
      break;
    case 'custom_api':
      bits.push(not ? 'Not sent' : 'Sent');
      if (x.template) bits.push(nameOf('api_templates', x.template));
      if (x.result) bits.push(x.result === 'ok' ? 'success' : 'failed');
      break;
  }
  if (['call', 'whatsapp', 'task', 'assignee_change', 'custom_api'].includes(c.key) && c.preset && c.preset !== 'any') {
    bits.push(presetLabel(c));
  }
  return { title: act?.label || c.key, detail: bits.filter(Boolean).join(' · ') };
}

function defaultCondition(key: string): LeadCondition {
  const field = FIELD_BY_KEY.get(key);
  if (field) {
    const op = opsForField(field.type)[0].value;
    return { id: newConditionId(), key, op, preset: field.type === 'date' ? 'last7' : undefined, values: [], extra: {} };
  }
  return { id: newConditionId(), key, op: 'has', preset: 'any', values: [], extra: {} };
}

export default function LeadConditionsBar({
  conditions,
  onChange,
}: {
  conditions: LeadCondition[];
  onChange: (next: LeadCondition[]) => void;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<LeadCondition | null>(null);
  const [options, setOptions] = useState<Options>(optionsCache || {});
  const boxRef = useRef<HTMLDivElement | null>(null);
  const searchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open && !conditions.length) return;
    let alive = true;
    void loadOptions().then((o) => alive && setOptions(o));
    return () => {
      alive = false;
    };
  }, [open, conditions.length]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (boxRef.current && !boxRef.current.contains(e.target as Node)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open && !editing) requestAnimationFrame(() => searchRef.current?.focus());
  }, [open, editing]);

  const close = () => {
    setOpen(false);
    setEditing(null);
    setSearch('');
  };

  const pick = (key: string) => {
    setEditing(defaultCondition(key));
    setOpen(true);
  };

  const apply = (c: LeadCondition) => {
    const exists = conditions.some((x) => x.id === c.id);
    onChange(exists ? conditions.map((x) => (x.id === c.id ? c : x)) : [...conditions, c]);
    close();
  };

  const s = search.trim().toLowerCase();
  const activities = ACTIVITY_DEFS.filter((a) => !s || a.label.toLowerCase().includes(s));
  const fields = FIELD_DEFS.filter((f) => !s || f.label.toLowerCase().includes(s));

  return (
    <div ref={boxRef} className="rounded-xl border border-slate-200 bg-white">
      <div className="flex flex-wrap items-center gap-1.5 px-2 py-1.5">
        <ListFilter className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        {conditions.map((c) => {
          const sm = summarize(c, options);
          return (
            <span
              key={c.id}
              className="inline-flex max-w-full items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 pl-2 text-xs text-violet-900"
            >
              <button
                type="button"
                onClick={() => {
                  setEditing({ ...c, values: c.values ? [...c.values] : [], extra: { ...(c.extra || {}) } });
                  setOpen(true);
                }}
                className="flex min-w-0 items-center gap-1 py-1 text-left"
                title="Edit condition"
              >
                <span className="shrink-0 font-bold">{sm.title}</span>
                <span className="truncate font-semibold text-violet-700">{sm.detail}</span>
              </button>
              <button
                type="button"
                aria-label={`Remove ${sm.title} condition`}
                onClick={() => onChange(conditions.filter((x) => x.id !== c.id))}
                className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-violet-500 hover:bg-violet-100 hover:text-violet-800"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          );
        })}
        <button
          type="button"
          onClick={() => {
            setEditing(null);
            setOpen((v) => !v);
          }}
          className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-bold text-[#004AAD] hover:bg-blue-50"
        >
          <Plus className="h-3.5 w-3.5" /> {conditions.length ? 'Add' : 'Add a condition'}
        </button>
        {conditions.length ? (
          <button
            type="button"
            onClick={() => onChange([])}
            className="ml-auto h-7 rounded-lg px-2 text-[11px] font-bold text-slate-500 hover:bg-slate-100"
          >
            Clear all
          </button>
        ) : null}
      </div>

      {open ? (
        <div className="border-t border-slate-100">
          {editing ? (
            <ConditionEditor
              condition={editing}
              options={options}
              onBack={() => setEditing(null)}
              onCancel={close}
              onApply={apply}
            />
          ) : (
            <div>
              <div className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5">
                <button
                  type="button"
                  onClick={close}
                  aria-label="Close"
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
                >
                  <ArrowLeft className="h-4 w-4" />
                </button>
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    ref={searchRef}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Add a new condition — search a field or activity"
                    className="h-8 w-full rounded-lg border border-slate-200 pl-8 pr-2 text-xs font-semibold focus:border-[#004AAD] focus:outline-none"
                  />
                </div>
              </div>
              {activities.length ? (
                <div className="flex flex-wrap gap-1.5 border-b border-slate-100 px-2 py-2">
                  {activities.map((a) => {
                    const Icon = ICONS[a.icon];
                    return (
                      <button
                        key={a.key}
                        type="button"
                        title={a.hint}
                        onClick={() => pick(a.key)}
                        className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2.5 text-xs font-semibold text-slate-700 hover:border-[#004AAD] hover:bg-blue-50 hover:text-[#023D95]"
                      >
                        <Icon className="h-3.5 w-3.5" />
                        {a.label}
                      </button>
                    );
                  })}
                </div>
              ) : null}
              <div className="max-h-72 overflow-y-auto px-2 py-1.5">
                <div className="px-1 pb-1 text-[11px] font-bold uppercase tracking-wide text-slate-400">Fields</div>
                {fields.length ? (
                  <div className="grid grid-cols-1 gap-0.5 sm:grid-cols-2 lg:grid-cols-3">
                    {fields.map((f) => (
                      <button
                        key={f.key}
                        type="button"
                        onClick={() => pick(f.key)}
                        className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-left text-xs font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <span className="truncate">{f.label}</span>
                        <span className="shrink-0 text-[10px] font-bold uppercase text-slate-300">{f.type}</span>
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="px-1 py-2 text-xs text-slate-400">No field matches “{search}”.</p>
                )}
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ConditionEditor({
  condition,
  options,
  onBack,
  onCancel,
  onApply,
}: {
  condition: LeadCondition;
  options: Options;
  onBack: () => void;
  onCancel: () => void;
  onApply: (c: LeadCondition) => void;
}) {
  const [c, setC] = useState<LeadCondition>(condition);
  const set = (patch: Partial<LeadCondition>) => setC((prev) => ({ ...prev, ...patch }));
  const setExtra = (k: string, v: string) =>
    setC((prev) => {
      const extra = { ...(prev.extra || {}) };
      if (v) extra[k] = v;
      else delete extra[k];
      return { ...prev, extra };
    });
  const field = FIELD_BY_KEY.get(c.key);
  const act = ACTIVITY_BY_KEY.get(c.key);
  const title = field?.label || act?.label || c.key;
  const telecallers = options.telecallers || [];

  const valid = useMemo(() => {
    if (field) {
      if (field.type === 'select' && (c.op === 'any_of' || c.op === 'none_of')) return Boolean(c.values?.length);
      if (field.type === 'text' && !['empty', 'not_empty'].includes(c.op)) return Boolean(c.value?.trim());
      if (field.type === 'number' && !['empty', 'not_empty'].includes(c.op)) {
        return c.op === 'between' ? Boolean(c.value || c.extra?.to_value) : c.value !== undefined && c.value !== '';
      }
      if (field.type === 'date' && c.op === 'in_range' && c.preset === 'custom') return Boolean(c.from || c.to);
      return true;
    }
    if (c.key === 'status_change') return Boolean(c.values?.length);
    if (c.preset === 'custom') return Boolean(c.from || c.to);
    return true;
  }, [c, field]);

  const hasNot = (yes: string, no: string) => (
    <div>
      <span className={labelCls}>Condition</span>
      <div className="inline-flex rounded-lg border border-slate-200 p-0.5">
        {[
          { v: 'has', l: yes },
          { v: 'has_not', l: no },
        ].map((o) => (
          <button
            key={o.v}
            type="button"
            onClick={() => set({ op: o.v })}
            className={`h-8 rounded-md px-3 text-xs font-bold ${c.op === o.v ? 'bg-[#004AAD] text-white' : 'text-slate-600 hover:bg-slate-50'}`}
          >
            {o.l}
          </button>
        ))}
      </div>
    </div>
  );

  const dateBlock = (label: string) => (
    <div className="space-y-2">
      <div>
        <span className={labelCls}>{label}</span>
        <select className={inputCls} value={c.preset || 'any'} onChange={(e) => set({ preset: e.target.value })}>
          {DATE_PRESETS.filter((d) => (field ? d.value !== 'any' : true)).map((d) => (
            <option key={d.value} value={d.value}>
              {d.label}
            </option>
          ))}
        </select>
      </div>
      {c.preset === 'custom' ? (
        <div className="grid grid-cols-2 gap-2">
          <input type="date" className={inputCls} value={c.from || ''} max={c.to || undefined} onChange={(e) => set({ from: e.target.value })} />
          <input type="date" className={inputCls} value={c.to || ''} min={c.from || undefined} onChange={(e) => set({ to: e.target.value })} />
        </div>
      ) : null}
    </div>
  );

  const selectExtra = (label: string, key: string, opts: Opt[], anyLabel: string) => (
    <div>
      <span className={labelCls}>{label}</span>
      <select className={inputCls} value={c.extra?.[key] || ''} onChange={(e) => setExtra(key, e.target.value)}>
        <option value="">{anyLabel}</option>
        {opts.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );

  let body: React.ReactNode = null;
  if (field) {
    const ops = opsForField(field.type);
    body = (
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
        <div>
          <span className={labelCls}>Operator</span>
          <select className={inputCls} value={c.op} onChange={(e) => set({ op: e.target.value })}>
            {ops.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
        <div className="min-w-0">
          {['empty', 'not_empty', 'yes', 'no'].includes(c.op) ? null : field.type === 'select' ? (
            <OptionChecklist
              options={optionsFor(field, options)}
              values={c.values || []}
              onChange={(values) => set({ values })}
            />
          ) : field.type === 'text' ? (
            <div>
              <span className={labelCls}>Value</span>
              <input className={inputCls} value={c.value || ''} onChange={(e) => set({ value: e.target.value })} autoFocus />
            </div>
          ) : field.type === 'number' ? (
            <div className="grid grid-cols-2 gap-2">
              <div>
                <span className={labelCls}>{c.op === 'between' ? 'From' : 'Value'}</span>
                <input type="number" className={inputCls} value={c.value || ''} onChange={(e) => set({ value: e.target.value })} />
              </div>
              {c.op === 'between' ? (
                <div>
                  <span className={labelCls}>To</span>
                  <input type="number" className={inputCls} value={c.extra?.to_value || ''} onChange={(e) => setExtra('to_value', e.target.value)} />
                </div>
              ) : null}
            </div>
          ) : field.type === 'date' ? (
            dateBlock('When')
          ) : null}
        </div>
      </div>
    );
  } else {
    switch (c.key) {
      case 'call':
        body = (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hasNot('Has call', 'No call')}
            {dateBlock('Call date')}
            {selectExtra('Result', 'status', CALL_STATUS_OPTIONS.filter((o) => o.value), 'Any result')}
            {selectExtra('Called by', 'by', telecallers, 'Anyone')}
            {c.op === 'has' ? (
              <div>
                <span className={labelCls}>Min duration (sec)</span>
                <input type="number" min={0} className={inputCls} value={c.extra?.min_duration || ''} onChange={(e) => setExtra('min_duration', e.target.value)} />
              </div>
            ) : null}
          </div>
        );
        break;
      case 'whatsapp':
        body = (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hasNot('Customer messaged', 'No message')}
            {dateBlock('Message date')}
          </div>
        );
        break;
      case 'note':
        body = (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {hasNot('Has note', 'No note')}
            <div>
              <span className={labelCls}>Note contains (optional)</span>
              <input className={inputCls} value={c.value || ''} onChange={(e) => set({ value: e.target.value })} placeholder="e.g. pickup" />
            </div>
          </div>
        );
        break;
      case 'task':
        body = (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hasNot('Has task', 'No task')}
            {dateBlock('Task created')}
            {selectExtra('Task status', 'status', TASK_STATUS_OPTIONS.filter((o) => o.value), 'Any task')}
            {selectExtra('Assigned to', 'by', telecallers, 'Anyone')}
          </div>
        );
        break;
      case 'assignee_change':
        body = (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            {hasNot('Transferred', 'Never transferred')}
            {selectExtra('Transferred to', 'to', telecallers, 'Anyone')}
            {dateBlock('Transfer date')}
          </div>
        );
        break;
      case 'status_change':
        body = (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
            {hasNot('Was ever in', 'Was never in')}
            <OptionChecklist options={options.statuses || []} values={c.values || []} onChange={(values) => set({ values })} />
          </div>
        );
        break;
      case 'lead_merged':
        body = hasNot('Has merged duplicates', 'No merge');
        break;
      case 'custom_api':
        body = (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {hasNot('Sent', 'Not sent')}
            {selectExtra('Template', 'template', options.api_templates || [], 'Any template')}
            {selectExtra(
              'Result',
              'result',
              [
                { value: 'ok', label: 'Success' },
                { value: 'failed', label: 'Failed' },
              ],
              'Any result',
            )}
            {dateBlock('Sent on')}
          </div>
        );
        break;
    }
  }

  return (
    <div className="space-y-3 p-3">
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to the list"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
        >
          <ArrowLeft className="h-4 w-4" />
        </button>
        <span className="text-sm font-extrabold text-slate-800">{title}</span>
        {act ? <span className="text-[11px] text-slate-400">{act.hint}</span> : null}
      </div>
      {body}
      <div className="flex justify-end gap-2 border-t border-slate-100 pt-2">
        <button type="button" onClick={onCancel} className="h-8 rounded-lg px-3 text-xs font-bold text-slate-600 hover:bg-slate-100">
          Cancel
        </button>
        <button
          type="button"
          disabled={!valid}
          onClick={() => onApply(c)}
          className="h-8 rounded-lg bg-[#004AAD] px-4 text-xs font-bold text-white disabled:opacity-40"
        >
          Apply
        </button>
      </div>
    </div>
  );
}

function OptionChecklist({
  options,
  values,
  onChange,
}: {
  options: Opt[];
  values: string[];
  onChange: (v: string[]) => void;
}) {
  const [q, setQ] = useState('');
  const picked = new Set(values);
  const shown = options.filter((o) => !q.trim() || o.label.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (v: string) => onChange(picked.has(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div className="min-w-0">
      <div className="mb-1 flex items-center justify-between">
        <span className={labelCls}>{values.length ? `${values.length} selected` : 'Pick one or more'}</span>
        {values.length ? (
          <button type="button" onClick={() => onChange([])} className="text-[11px] font-bold text-[#004AAD]">
            Clear
          </button>
        ) : null}
      </div>
      {options.length > 8 ? (
        <input className={`${inputCls} mb-1.5`} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search" />
      ) : null}
      <div className="max-h-48 overflow-y-auto rounded-lg border border-slate-200">
        {shown.length ? (
          shown.map((o) => (
            <label
              key={o.value}
              className="flex cursor-pointer items-center gap-2 px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              <input
                type="checkbox"
                checked={picked.has(o.value)}
                onChange={() => toggle(o.value)}
                className="h-4 w-4 shrink-0 accent-[#004AAD]"
              />
              <span className="truncate">{o.label}</span>
            </label>
          ))
        ) : (
          <p className="px-2.5 py-2 text-xs text-slate-400">{options.length ? 'No match' : 'Loading…'}</p>
        )}
      </div>
    </div>
  );
}
