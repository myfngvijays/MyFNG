'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import {
  Handle,
  Position,
  ReactFlowProvider,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import CallIqFlowBoard from '@/components/admin/CallIqFlowBoard';
import {
  ArrowLeft,
  Clock,
  Copy,
  Filter,
  Loader2,
  MessageSquare,
  MoreHorizontal,
  Phone,
  PhoneIncoming,
  PhoneMissed,
  Pencil,
  PhoneOutgoing,
  Sparkles,
  Trash2,
} from 'lucide-react';
import type {
  CallIqCanvasEdge,
  CallIqCanvasKind,
  CallIqCanvasState,
  CallIqNamedWorkflow,
} from '@/lib/telecaller/salesPlaybookDefaults';
import { resolveCallIqCanvas } from '@/lib/telecaller/salesPlaybookDefaults';

const NAVY = '#1e3a8a';

function wireEdge(sourceId: string, targetId: string): CallIqCanvasEdge {
  return {
    id: `e_${sourceId}_${targetId}`,
    source: sourceId,
    target: targetId,
  };
}

const CHAIN: CallIqCanvasKind[] = ['event', 'lead', 'duration', 'ai'];

function ensureChain(canvas: CallIqCanvasState): CallIqCanvasEdge[] {
  const byKind = new Map(canvas.nodes.map((n) => [n.kind, n]));
  const seen = new Set(canvas.edges.map((e) => `${e.source}->${e.target}`));
  const edges = canvas.edges.filter((e) => {
    const src = canvas.nodes.find((n) => n.id === e.source);
    const tgt = canvas.nodes.find((n) => n.id === e.target);
    return Boolean(src && tgt && src.kind !== 'ai' && tgt.kind !== 'event');
  });
  for (let i = 0; i < CHAIN.length - 1; i += 1) {
    const from = byKind.get(CHAIN[i]);
    if (!from) continue;
    for (let j = i + 1; j < CHAIN.length; j += 1) {
      const to = byKind.get(CHAIN[j]);
      if (!to) continue;
      const key = `${from.id}->${to.id}`;
      if (!seen.has(key) && !edges.some((e) => e.source === from.id)) {
        edges.push(wireEdge(from.id, to.id));
        seen.add(key);
      }
      break;
    }
  }
  return edges;
}

type EditorTab = 'editor' | 'executions';

type SharedNodeData = {
  editing: boolean;
  nodeId: string;
  menuOpen?: boolean;
  linking?: boolean;
  onMenu?: (id: string) => void;
  onEdit?: () => void;
  onClone?: (id: string) => void;
  onDelete?: (id: string) => void;
  onPort?: (id: string) => void;
};

type LeadNodeData = SharedNodeData & {
  statuses: string[];
  allStatuses: string[];
  onToggle?: (name: string) => void;
};

type DurationNodeData = SharedNodeData & {
  seconds: number;
  onSeconds?: (n: number) => void;
};

type AiNodeData = SharedNodeData & {
  agentName: string;
};

function NodeMenu({ data }: { data: SharedNodeData }) {
  const btnRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState({ top: 0, left: 0 });

  useEffect(() => {
    if (!data.menuOpen || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    setPos({ top: r.bottom + 6, left: Math.max(8, r.right - 148) });
  }, [data.menuOpen]);

  const item = (label: string, icon: ReactNode, onClick: () => void, danger = false) => (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      className={`flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-slate-50 ${
        danger ? 'text-rose-600' : 'text-slate-700'
      }`}
    >
      {icon}
      {label}
    </button>
  );

  return (
    <div className="nodrag nopan nowheel relative shrink-0">
      <button
        ref={btnRef}
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          data.onMenu?.(data.nodeId);
        }}
        className="rounded p-0.5 text-white/90 hover:bg-white/15"
        title="Node options"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>
      {data.menuOpen && typeof document !== 'undefined'
        ? createPortal(
            <div
              className="fixed z-[10000] w-36 overflow-hidden rounded-lg border border-slate-200 bg-white py-1 shadow-xl"
              style={{ top: pos.top, left: pos.left }}
              onMouseDown={(e) => e.stopPropagation()}
            >
              {item('Edit', <Pencil className="h-3.5 w-3.5" />, () => data.onEdit?.())}
              {item('Clone', <Copy className="h-3.5 w-3.5" />, () => data.onClone?.(data.nodeId))}
              {item('Delete', <Trash2 className="h-3.5 w-3.5" />, () => data.onDelete?.(data.nodeId), true)}
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

function Port({ type, position }: { type: 'source' | 'target'; position: Position }) {
  return (
    <Handle
      type={type}
      position={position}
      isConnectable
      style={{
        width: 22,
        height: 22,
        background: NAVY,
        border: '3px solid #fff',
        boxShadow: '0 0 0 2px #1e3a8a',
        zIndex: 50,
      }}
    />
  );
}

function NodeChrome({
  title,
  event,
  data,
  showTarget = true,
  showSource = true,
  children,
}: {
  title: string;
  event?: boolean;
  data: SharedNodeData;
  showTarget?: boolean;
  showSource?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className={`relative w-[270px] overflow-visible ${data.linking ? 'ring-2 ring-blue-500 ring-offset-2' : ''}`}>
      {showTarget ? <Port type="target" position={Position.Left} /> : null}
      <div className="rounded-[10px] bg-white shadow-[0_10px_28px_rgba(15,23,42,0.10)] ring-1 ring-slate-200">
        <div className="flex items-center justify-between px-3 py-2 text-white" style={{ background: NAVY }}>
          <div className="min-w-0 leading-tight">
            {event ? (
              <span className="mr-1.5 text-[9px] font-bold uppercase tracking-[0.14em] text-white/75">Event</span>
            ) : null}
            <span className="text-[13px] font-semibold">{title}</span>
          </div>
          <NodeMenu data={data} />
        </div>
        <div className="bg-white p-3">{children}</div>
      </div>
      {showSource ? <Port type="source" position={Position.Right} /> : null}
    </div>
  );
}

function EventNode({ data }: NodeProps) {
  const d = data as SharedNodeData;
  return (
    <NodeChrome title="Recording completed" event data={d}>
      <div className="flex items-center gap-2 rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-2">
        <Phone className="h-4 w-4 text-slate-600" />
        <span className="text-[13px] font-medium text-slate-800">Smartflo recording attached</span>
      </div>
    </NodeChrome>
  );
}

function LeadNode({ data }: NodeProps) {
  const d = data as LeadNodeData;
  const shown = d.statuses.slice(0, 3);
  const extra = Math.max(0, d.statuses.length - 3);
  return (
    <NodeChrome title="Lead status" data={d}>
      <div className="space-y-2">
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <div className="mb-1.5 flex items-center justify-between">
            <p className="text-[11px] font-semibold text-slate-500">Lead Status Is</p>
          </div>
          <div className="flex flex-wrap gap-1">
            {(d.editing ? d.allStatuses : shown).map((name) => {
              const on = d.statuses.some((s) => s.toLowerCase() === name.toLowerCase());
              if (!d.editing && !on) return null;
              return (
                <button
                  key={name}
                  type="button"
                  disabled={!d.editing}
                  onClick={() => d.onToggle?.(name)}
                  className={`nodrag rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                    on ? 'bg-violet-100 text-violet-800' : 'bg-slate-100 text-slate-500'
                  }`}
                >
                  {name}
                </button>
              );
            })}
            {!d.editing && extra ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                +{extra}
              </span>
            ) : null}
          </div>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2">
          <p className="mb-1 text-[11px] font-semibold text-slate-500">Created On Is</p>
          <div className="inline-flex items-center gap-1 rounded-md bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
            <Clock className="h-3 w-3" /> Any
          </div>
        </div>
      </div>
    </NodeChrome>
  );
}

function DurationNode({ data }: NodeProps) {
  const d = data as DurationNodeData;
  return (
    <NodeChrome title="Min duration" data={d}>
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-slate-600" />
          <span className="text-[13px] font-medium text-slate-800">Call length</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-[11px] font-medium text-slate-600">
            At least (seconds)
          </span>
          {d.editing ? (
            <input
              type="number"
              min={0}
              value={d.seconds}
              onChange={(e) => d.onSeconds?.(Number(e.target.value) || 0)}
              className="nodrag w-16 rounded-md border border-slate-200 px-2 py-1 text-[13px] font-semibold text-slate-900 outline-none focus:border-violet-400"
            />
          ) : (
            <span className="rounded-md border border-slate-200 px-2 py-1 text-[13px] font-semibold text-slate-900">
              {d.seconds}
            </span>
          )}
        </div>
      </div>
    </NodeChrome>
  );
}

function AiNode({ data }: NodeProps) {
  const d = data as AiNodeData;
  return (
    <NodeChrome title="Call Audit SOP" data={d} showSource={false}>
      <div className="flex items-center gap-2 rounded-lg border border-blue-100 bg-blue-50 px-2.5 py-2">
        <Sparkles className="h-4 w-4 text-blue-800" />
        <span className="text-[13px] font-semibold text-slate-900">{d.agentName}</span>
      </div>
    </NodeChrome>
  );
}

const nodeTypes = {
  iqEvent: EventNode,
  iqLead: LeadNode,
  iqDuration: DurationNode,
  iqAi: AiNode,
};

type PaletteItem = {
  id: string;
  label: string;
  icon: typeof Phone;
  tone?: 'ai' | 'muted';
  present?: boolean;
};

const TRIGGER_ITEMS: PaletteItem[] = [
  { id: 'recording', label: 'Recording completed', icon: Phone },
  { id: 'call_out', label: 'Outgoing call ended', icon: PhoneOutgoing },
  { id: 'call_in', label: 'Incoming call ended', icon: PhoneIncoming },
  { id: 'call_missed', label: 'Missed call', icon: PhoneMissed },
];

const CHECK_ITEMS: PaletteItem[] = [
  { id: 'lead_if', label: 'Lead status', icon: Filter },
  { id: 'delay', label: 'Min duration', icon: Clock },
];

const SOP_ITEMS: PaletteItem[] = [
  { id: 'ai', label: 'Call Audit SOP', icon: Sparkles, tone: 'ai' },
];

function PaletteIcon({ item }: { item: PaletteItem }) {
  const Icon = item.icon;
  return (
    <span
      className={`flex h-9 w-9 items-center justify-center rounded-lg ${
        item.tone === 'ai' ? 'bg-blue-900 text-white' : 'bg-slate-100 text-slate-600'
      }`}
    >
      <Icon className="h-4 w-4" />
    </span>
  );
}

function PaletteTile({
  item,
  onPick,
}: {
  item: PaletteItem;
  onPick: (item: PaletteItem) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onPick(item)}
      className="relative flex w-full items-center gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-left hover:border-blue-300 hover:bg-blue-50/40"
    >
      <PaletteIcon item={item} />
      <span className="text-[12px] font-semibold text-slate-700">{item.label}</span>
    </button>
  );
}

function SectionHead({ title, hint }: { title: string; hint: string }) {
  return (
    <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2.5 [&::-webkit-details-marker]:hidden">
      <span>
        <span className="block text-[13px] font-semibold text-slate-800">{title}</span>
        <span className="block text-[11px] text-slate-400">{hint}</span>
      </span>
      <span className="text-slate-400">⌃</span>
    </summary>
  );
}

function displayWorkflowTitle(name: string) {
  return name.replace(/\s*[—–]\s*/g, ' - ');
}

function EditorInner({
  draft,
  editing,
  saving,
  crmStatuses,
  agentName,
  onChange,
  onBack,
  onEdit,
  onPublish,
  onDelete,
  onToggleEnabled,
  onStartEdit,
}: {
  draft: CallIqNamedWorkflow;
  editing: boolean;
  saving: boolean;
  crmStatuses: string[];
  agentName: string;
  onChange: (next: CallIqNamedWorkflow) => void;
  onBack: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onStartEdit: () => void;
}) {
  const [tab, setTab] = useState<EditorTab>('editor');
  const [runs, setRuns] = useState<any[]>([]);
  const [runsLoading, setRunsLoading] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(true);
  const [paletteTip, setPaletteTip] = useState<string | null>(null);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null);
  const [boardEpoch, setBoardEpoch] = useState(0);
  const [chatOpen, setChatOpen] = useState(true);
  const [chatInput, setChatInput] = useState('');
  const [chatBusy, setChatBusy] = useState(false);
  const [chatLog, setChatLog] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([
    {
      role: 'assistant',
      content:
        'MY FNG Call IQ flow bolo — jaise “Fresh aur Interested pe 90 second ke baad SOP chalao”. Canvas yahin update hoga.',
    },
  ]);

  async function sendChat(text?: string) {
    const message = String(text || chatInput).trim();
    if (!message || chatBusy) return;
    setChatInput('');
    setChatLog((prev) => [...prev, { role: 'user', content: message }]);
    setChatBusy(true);
    try {
      const res = await fetch('/api/super_admin/call-iq-workflow-chat', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          workflow: draft,
          crm_statuses: crmStatuses,
          history: chatLog.slice(-8),
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'AI failed');
      if (json.workflow) {
        onStartEdit();
        onChange({
          ...draft,
          ...json.workflow,
          id: draft.id,
          trigger: 'recording_completed',
        });
        setBoardEpoch((n) => n + 1);
      }
      setChatLog((prev) => [
        ...prev,
        { role: 'assistant', content: String(json.reply || 'Flow update ho gaya.') },
      ]);
    } catch (e: any) {
      setChatLog((prev) => [...prev, { role: 'assistant', content: e?.message || 'AI failed' }]);
    } finally {
      setChatBusy(false);
    }
  }

  const canvas = resolveCallIqCanvas(draft);
  const draftRef = useRef(draft);
  draftRef.current = draft;
  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;

  function setCanvas(next: CallIqCanvasState, reload = false) {
    onChange({ ...draftRef.current, canvas: next });
    if (reload) setBoardEpoch((n) => n + 1);
  }

  function addKind(kind: CallIqCanvasKind) {
    const already = canvas.nodes.some((n) => n.kind === kind);
    if (already && (kind === 'event' || kind === 'duration')) {
      setPaletteTip('This block is already on the canvas');
      window.setTimeout(() => setPaletteTip(null), 1600);
      return;
    }
    const id = `${kind}_${Math.random().toString(36).slice(2, 7)}`;
    const i = canvas.nodes.length;
    const nodes = [...canvas.nodes, { id, kind, x: 40 + i * 320, y: 160 + (i % 2) * 40 }];
    setCanvas({ nodes, edges: ensureChain({ nodes, edges: canvas.edges }) }, true);
    onStartEdit();
  }

  function pickPalette(item: PaletteItem) {
    if (item.id === 'recording' || item.id === 'call_out' || item.id === 'call_in' || item.id === 'call_missed') {
      addKind('event');
      return;
    }
    if (item.id === 'delay') {
      addKind('duration');
      return;
    }
    if (item.id === 'ai' || item.id === 'lead_if') {
      addKind(item.id === 'ai' ? 'ai' : 'lead');
      return;
    }
    if (item.present) {
      setPaletteTip('Event already present');
      window.setTimeout(() => setPaletteTip(null), 1600);
      return;
    }
    setPaletteTip(`${item.label} — coming in next version`);
    window.setTimeout(() => setPaletteTip(null), 1600);
  }

  useEffect(() => {
    if (tab !== 'executions') return;
    setRunsLoading(true);
    void fetch('/api/super_admin/call-intelligence?preset=last_7_days&limit=100', {
      credentials: 'include',
      cache: 'no-store',
    })
      .then((r) => r.json())
      .then((json) => {
        const rows = Array.isArray(json?.recent) ? json.recent : Array.isArray(json?.calls) ? json.calls : [];
        setRuns(rows.filter((c: any) => c?.sop_audit || c?.quality_score != null).slice(0, 25));
      })
      .catch(() => setRuns([]))
      .finally(() => setRunsLoading(false));
  }, [tab]);

  const sharedMenu = {
    editing,
    menuOpen: false as boolean,
    onMenu: (id: string) => setMenuOpenId((cur) => (cur === id ? null : id)),
    onEdit: () => {
      setMenuOpenId(null);
      onStartEdit();
    },
    onClone: (id: string) => {
      const src = canvas.nodes.find((n) => n.id === id);
      if (!src) return;
      const copyId = `${src.kind}_${Math.random().toString(36).slice(2, 7)}`;
      setCanvas(
        {
          ...canvas,
          nodes: [...canvas.nodes, { ...src, id: copyId, x: (src.x || 40) + 36, y: (src.y || 160) + 36 }],
        },
        true,
      );
      setMenuOpenId(null);
    },
    onDelete: (id: string) => {
      onStartEdit();
      setCanvas(
        {
          nodes: canvas.nodes.filter((n) => n.id !== id),
          edges: canvas.edges.filter((e) => e.source !== id && e.target !== id),
        },
        true,
      );
      setMenuOpenId(null);
    },
  };

  const dataFor = useCallback(
    (id: string) => ({
      ...sharedMenu,
      nodeId: id,
      menuOpen: menuOpenId === id,
      linking: linkFrom === id,
      onPort: (portId: string) => {
        if (linkFrom && linkFrom !== portId) {
          setCanvas(
            {
              ...canvasRef.current,
              edges: [...canvasRef.current.edges, wireEdge(linkFrom, portId)],
            },
            true,
          );
          setLinkFrom(null);
          onStartEdit();
          return;
        }
        setLinkFrom(portId);
      },
      statuses: draft.lead_statuses,
      allStatuses: crmStatuses,
      seconds: draft.min_duration_sec,
      agentName,
      onToggle: (name: string) => {
        const has = draft.lead_statuses.some((s) => s.toLowerCase() === name.toLowerCase());
        onChange({
          ...draft,
          lead_statuses: has
            ? draft.lead_statuses.filter((s) => s.toLowerCase() !== name.toLowerCase())
            : [...draft.lead_statuses, name],
        });
      },
      onSeconds: (sec: number) => onChange({ ...draft, min_duration_sec: sec }),
    }),
    [agentName, canvas, crmStatuses, draft, editing, linkFrom, menuOpenId, onChange, onStartEdit],
  );

  const dataStamp = `${editing}|${menuOpenId}|${linkFrom}|${draft.lead_statuses.join(',')}|${draft.min_duration_sec}|${agentName}`;

  const title = displayWorkflowTitle(draft.name);

  return (
    <div className="flex h-[calc(100vh-4.5rem)] flex-col bg-white">
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
        <div className="flex min-w-0 items-start gap-3">
          <button
            type="button"
            onClick={onBack}
            className="mt-0.5 rounded-md p-1.5 text-slate-500 hover:bg-slate-100"
            title="Back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              {editing ? (
                <input
                  value={draft.name}
                  onChange={(e) => onChange({ ...draft, name: e.target.value })}
                  className="min-w-[220px] border-b border-transparent text-lg font-semibold text-slate-900 outline-none focus:border-violet-400"
                />
              ) : (
                <h1 className="text-lg font-semibold text-slate-900">{title}</h1>
              )}
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-500">
                {editing ? 'Unsaved' : 'Saved'}
              </span>
              <button
                type="button"
                onClick={() => onToggleEnabled(!draft.enabled)}
                className={`inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-bold ${
                  draft.enabled ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                }`}
              >
                <span
                  className={`h-3.5 w-6 rounded-full p-0.5 ${draft.enabled ? 'bg-emerald-500' : 'bg-slate-300'}`}
                >
                  <span
                    className={`block h-2.5 w-2.5 rounded-full bg-white transition ${
                      draft.enabled ? 'translate-x-2.5' : ''
                    }`}
                  />
                </span>
                {draft.enabled ? 'ON' : 'OFF'}
              </button>
            </div>
            <p className="mt-0.5 text-[12px] text-slate-400">Call IQ · recording → lead status → SOP</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setChatOpen((v) => !v)}
            className="inline-flex items-center gap-1.5 rounded-md border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-900"
          >
            <MessageSquare className="h-4 w-4" />
            AI Chat
          </button>
          {editing ? (
            <button
              type="button"
              disabled={saving}
              onClick={onPublish}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: NAVY }}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Save'}
            </button>
          ) : (
            <button
              type="button"
              onClick={onEdit}
              className="rounded-md px-4 py-2 text-sm font-semibold text-white"
              style={{ background: NAVY }}
            >
              Edit
            </button>
          )}
          <button
            type="button"
            onClick={onDelete}
            className="rounded-md border border-slate-200 p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-600"
            title="Delete"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </header>

      <div className="flex justify-center border-b border-slate-200 bg-white">
        {(['editor', 'executions'] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className={`px-6 py-2.5 text-sm font-semibold capitalize ${
              tab === id ? 'border-b-2 text-blue-900' : 'text-slate-400'
            }`}
            style={tab === id ? { borderColor: NAVY } : undefined}
          >
            {id === 'executions' ? 'Runs' : 'Editor'}
          </button>
        ))}
      </div>

      {tab === 'executions' ? (
        <div className="flex-1 overflow-auto bg-[#F4F5F8] p-6">
          {runsLoading ? (
            <div className="flex justify-center py-16">
              <Loader2 className="h-6 w-6 animate-spin text-violet-600" />
            </div>
          ) : runs.length ? (
            <div className="mx-auto max-w-3xl space-y-2">
              {runs.map((row: any) => (
                <div key={row.id} className="rounded-xl border border-slate-200 bg-white px-4 py-3">
                  <p className="text-sm font-semibold text-slate-900">
                    {row.lead?.customer_name || row.phone_number || 'Call'} · SOP {row.sop_audit?.overall_score ?? '—'}
                  </p>
                  <p className="text-xs text-slate-500">{row.created_at ? new Date(row.created_at).toLocaleString() : ''}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className="py-16 text-center text-sm text-slate-500">Is week koi SOP run nahi.</p>
          )}
        </div>
      ) : (
        <div className="flex min-h-0 flex-1">
          {editing && paletteOpen ? (
            <aside className="relative w-[300px] shrink-0 overflow-y-auto border-r border-slate-200 bg-white">
              {paletteTip ? (
                <div className="sticky top-2 z-10 mx-3 rounded-md bg-blue-900 px-3 py-1.5 text-center text-[11px] font-semibold text-white shadow-lg">
                  {paletteTip}
                </div>
              ) : null}
              <details open className="border-b border-slate-100">
                <SectionHead title="Triggers" hint="Call / recording" />
                <div className="space-y-1.5 px-3 pb-3">
                  {TRIGGER_ITEMS.map((item) => (
                    <PaletteTile key={item.id} item={item} onPick={pickPalette} />
                  ))}
                </div>
              </details>
              <details open className="border-b border-slate-100">
                <SectionHead title="Checks" hint="Lead + duration" />
                <div className="space-y-1.5 px-3 pb-3">
                  {CHECK_ITEMS.map((item) => (
                    <PaletteTile key={item.id} item={item} onPick={pickPalette} />
                  ))}
                </div>
              </details>
              <details open>
                <SectionHead title="SOP" hint="Call IQ audit" />
                <div className="space-y-1.5 px-3 pb-3">
                  {SOP_ITEMS.map((item) => (
                    <PaletteTile key={item.id} item={item} onPick={pickPalette} />
                  ))}
                </div>
              </details>
              <button
                type="button"
                onClick={() => setPaletteOpen(false)}
                className="absolute bottom-4 right-3 flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg"
                style={{ background: NAVY }}
                title="Hide palette"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            </aside>
          ) : null}

          <div className="relative h-full min-w-0 flex-1 bg-[#F4F5F8]">
            {editing && !paletteOpen ? (
              <button
                type="button"
                onClick={() => setPaletteOpen(true)}
                className="absolute bottom-4 left-3 z-10 flex h-10 w-10 items-center justify-center rounded-full text-white shadow-lg"
                style={{ background: NAVY }}
                title="Show palette"
              >
                <ArrowLeft className="h-4 w-4 rotate-180" />
              </button>
            ) : null}
            <CallIqFlowBoard
              canvas={canvas}
              epoch={boardEpoch}
              dataStamp={dataStamp}
              nodeTypes={nodeTypes}
              dataFor={dataFor}
              empty={canvas.nodes.length === 0}
              onPersist={(next) => setCanvas(next)}
              onStartEdit={onStartEdit}
            />
          </div>
          {chatOpen ? (
            <aside className="flex w-[340px] shrink-0 flex-col border-l border-slate-200 bg-white">
              <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
                <div>
                  <p className="text-sm font-semibold text-slate-900">AI Chat</p>
                  <p className="text-[11px] text-slate-400">MY FNG Call IQ — type karke flow banao</p>
                </div>
                <button
                  type="button"
                  onClick={() => setChatOpen(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100"
                >
                  ×
                </button>
              </div>
              <div className="min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-3">
                {chatLog.map((m, i) => (
                  <div
                    key={`${m.role}-${i}`}
                    className={`rounded-2xl px-3 py-2 text-[13px] leading-relaxed ${
                      m.role === 'user' ? 'ml-8 bg-violet-600 text-white' : 'mr-6 bg-slate-100 text-slate-800'
                    }`}
                  >
                    {m.content}
                  </div>
                ))}
                {chatBusy ? <p className="text-[11px] text-slate-400">AI soch raha hai…</p> : null}
              </div>
              <div className="border-t border-slate-100 p-3">
                <div className="mb-2 flex flex-wrap gap-1">
                  {[
                    'Fresh, Interested — 90s Deep AI ON',
                    'Sirf Follow-up, 60 second',
                    'Is flow ko ON karo',
                  ].map((hint) => (
                    <button
                      key={hint}
                      type="button"
                      onClick={() => void sendChat(hint)}
                      className="rounded-full bg-slate-50 px-2 py-1 text-[10px] font-semibold text-slate-600 ring-1 ring-slate-200"
                    >
                      {hint}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void sendChat();
                      }
                    }}
                    placeholder="Jaise: Fresh + Interested, 90s SOP"
                    className="flex-1 rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-400"
                  />
                  <button
                    type="button"
                    disabled={chatBusy || !chatInput.trim()}
                    onClick={() => void sendChat()}
                    className="rounded-lg px-3 py-2 text-sm font-semibold text-white disabled:opacity-50"
                    style={{ background: NAVY }}
                  >
                    Send
                  </button>
                </div>
              </div>
            </aside>
          ) : null}
        </div>
      )}
    </div>
  );
}

export default function CallIqTelecrmFlowEditor(props: {
  draft: CallIqNamedWorkflow;
  editing: boolean;
  saving: boolean;
  crmStatuses: string[];
  agentName: string;
  onChange: (next: CallIqNamedWorkflow) => void;
  onBack: () => void;
  onEdit: () => void;
  onPublish: () => void;
  onDelete: () => void;
  onToggleEnabled: (enabled: boolean) => void;
  onStartEdit: () => void;
}) {
  const onChange = useCallback(props.onChange, [props.onChange]);
  return (
    <ReactFlowProvider>
      <EditorInner {...props} onChange={onChange} />
    </ReactFlowProvider>
  );
}
