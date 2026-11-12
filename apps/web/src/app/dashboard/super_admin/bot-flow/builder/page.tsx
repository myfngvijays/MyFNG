'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import {
  addEdge,
  Background,
  Controls,
  ReactFlow,
  ReactFlowProvider,
  type Connection,
  type Edge,
  type Node,
  type OnConnect,
  type ReactFlowInstance,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import {
  Bot,
  Edit3,
  Flag,
  GitBranch,
  HelpCircle,
  MessageSquare,
  PlugZap,
  Search,
  Tag,
  Target,
  Timer,
  Trash2,
  UserRoundCheck,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import FlowCardNode from '@/components/shared/bot-flow/FlowCardNode';
import RemovableEdge from '@/components/shared/bot-flow/RemovableEdge';
import PropertiesPanel from '@/components/shared/bot-flow/PropertiesPanel';
import ValidationPanel from '@/components/shared/bot-flow/ValidationPanel';
import { createDefaultBotFlowGraph, validateBotFlowGraph } from '@/lib/whatsappBotFlow/validation';

type BotFlow = {
  id: string;
  name: string;
  status: string;
};

type BotFlowVersion = {
  id: string;
  version_no: number;
  status: string;
  graph_json: { nodes: Node[]; edges: Edge[]; viewport?: { x?: number; y?: number; zoom?: number } };
};

type TemplateOption = {
  id: string;
  template_name: string;
  display_name: string | null;
  language_code: string;
  variable_keys: string[];
  body_text?: string | null;
  is_active: boolean;
  meta?: { status?: string; raw?: { components?: Array<{ type?: string; buttons?: Array<{ type?: string; text?: string }> }> } } | null;
};

const flowNodeTypes = { flowCard: FlowCardNode };
const flowEdgeTypes = { removable: RemovableEdge };
const CARD_NODE_TYPES = new Set([
  'template',
  'buttons',
  'message',
  'ask',
  'update_lead',
  'apply_tags',
  'api_request',
  'end',
  'delay',
  'condition',
  'handoff',
  'assign_telecaller',
  'media',
]);

type PaletteItem = {
  type: string;
  label: string;
  icon: any;
  bucket: 'triggers' | 'actions';
  preset?: Record<string, unknown>;
};

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'trigger', label: 'New message', icon: Flag, bucket: 'triggers', preset: { triggerEvent: 'whatsapp_incoming' } },
  { type: 'trigger', label: 'Hot keyword', icon: Flag, bucket: 'triggers', preset: { triggerEvent: 'hot_keyword', keyword: 'INTERESTED' } },
  { type: 'trigger', label: 'Template button', icon: Flag, bucket: 'triggers', preset: { triggerEvent: 'template_replied', buttonText: 'Interested' } },
  { type: 'trigger', label: 'Missed call', icon: Flag, bucket: 'triggers', preset: { triggerEvent: 'missed_call' } },
  { type: 'trigger', label: 'Payment received', icon: Flag, bucket: 'triggers', preset: { triggerEvent: 'payment_completed' } },
  { type: 'message', label: 'Send text', icon: MessageSquare, bucket: 'actions' },
  { type: 'buttons', label: 'Text with buttons', icon: MessageSquare, bucket: 'actions', preset: { messageBody: 'Please choose one option.', buttons: ['Yes', 'No'] } },
  { type: 'ask', label: 'Ask question', icon: HelpCircle, bucket: 'actions', preset: { messageBody: 'Please reply with your answer.' } },
  { type: 'template', label: 'Template message', icon: Bot, bucket: 'actions' },
  { type: 'media', label: 'Image message', icon: Bot, bucket: 'actions', preset: { mediaType: 'image' } },
  { type: 'media', label: 'Video message', icon: Bot, bucket: 'actions', preset: { mediaType: 'video' } },
  { type: 'media', label: 'Document message', icon: Bot, bucket: 'actions', preset: { mediaType: 'document' } },
  { type: 'media', label: 'Audio message', icon: Bot, bucket: 'actions', preset: { mediaType: 'audio' } },
  { type: 'condition', label: 'If / Else', icon: GitBranch, bucket: 'actions' },
  { type: 'delay', label: 'Smart wait', icon: Timer, bucket: 'actions' },
  { type: 'handoff', label: 'Assign to agent', icon: UserRoundCheck, bucket: 'actions' },
  { type: 'assign_telecaller', label: 'Assign telecaller', icon: UserRoundCheck, bucket: 'actions' },
  { type: 'update_lead', label: 'Update lead status', icon: Edit3, bucket: 'actions', preset: { crmDisposition: 'FRESH', label: 'Update lead status' } },
  { type: 'apply_tags', label: 'Lead tag', icon: Tag, bucket: 'actions', preset: { label: 'Lead tag', tagNames: [], tagMode: 'add' } },
  { type: 'api_request', label: 'Call API', icon: PlugZap, bucket: 'actions', preset: { apiPreset: 'telecrm', label: 'External API', apiMethod: 'POST', apiAuthType: 'bearer', apiBodyType: 'json' } },
  { type: 'end', label: 'End', icon: Target, bucket: 'actions' },
];

function toCanvasNodes(rawNodes: Node[] | undefined) {
  return (Array.isArray(rawNodes) ? rawNodes : []).map((node) => {
    const nodeType = String((node as any).data?.nodeType || (node as any).type || 'message');
    const label = String((node.data as any)?.label || nodeType);
    const isCard = CARD_NODE_TYPES.has(nodeType);
    const isTrigger = nodeType === 'trigger';
    const isEnd = nodeType === 'end' || nodeType === 'handoff';
    const isLogic = nodeType === 'condition' || nodeType === 'delay';
    return {
      ...node,
      type: isCard ? 'flowCard' : 'default',
      style: isCard
        ? { width: 260, padding: 0, border: 'none', background: 'transparent', boxShadow: 'none' }
        : {
        width: 220,
        minWidth: 220,
        maxWidth: 220,
        borderRadius: 12,
        border: isTrigger
          ? '1px solid #c4b5fd'
          : isEnd
            ? '1px solid #86efac'
            : isLogic
              ? '1px solid #93c5fd'
              : '1px solid #e2e8f0',
        background: isTrigger ? '#f5f3ff' : isEnd ? '#ecfdf5' : isLogic ? '#eff6ff' : '#ffffff',
        padding: '10px 12px',
        fontSize: 12,
        fontWeight: 600,
        color: '#0f172a',
        textAlign: 'left' as const,
        boxShadow: '0 1px 2px rgba(15,23,42,0.06)',
        overflow: 'hidden',
        whiteSpace: 'nowrap' as const,
        textOverflow: 'ellipsis',
      },
      data: {
        ...(node.data || {}),
        nodeType,
        label,
      },
    };
  });
}

function BotFlowBuilderPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [reactFlow, setReactFlow] = useState<ReactFlowInstance<Node, Edge> | null>(null);
  const [flows, setFlows] = useState<BotFlow[]>([]);
  const [versions, setVersions] = useState<BotFlowVersion[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [locked, setLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<'triggers' | 'actions'>('actions');
  const [searchText, setSearchText] = useState('');
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);
  const [showHelp, setShowHelp] = useState(true);
  const [deletingFlow, setDeletingFlow] = useState(false);

  function normalizedGraph() {
    return {
      nodes: nodes.map((node) => ({
        ...node,
        type: String((node.data as any)?.nodeType || node.type || 'message'),
      })),
      edges,
      viewport: reactFlow?.getViewport() || { x: 0, y: 0, zoom: 1 },
    };
  }

  const selectedNode = useMemo(
    () => nodes.find((node) => node.id === selectedNodeId) || null,
    [nodes, selectedNodeId]
  );
  const validation = useMemo(() => validateBotFlowGraph(normalizedGraph()), [nodes, edges]);
  const currentFlow = useMemo(
    () => flows.find((flow) => flow.id === selectedFlowId) || null,
    [flows, selectedFlowId]
  );
  const filteredPalette = useMemo(() => {
    const q = searchText.trim().toLowerCase();
    return PALETTE_ITEMS.filter((item) => {
      if (item.bucket !== activeTab) return false;
      if (!q) return true;
      return item.label.toLowerCase().includes(q);
    });
  }, [activeTab, searchText]);

  const nodesRef = useRef(nodes);
  nodesRef.current = nodes;
  const lockedRef = useRef(locked);
  lockedRef.current = locked;

  useEffect(() => {
    const onRemoveEdge = (event: Event) => {
      const id = String((event as CustomEvent).detail?.id || '');
      if (!id || lockedRef.current) return;
      setEdges((prev) => prev.filter((edge) => edge.id !== id));
      setSelectedEdgeId('');
      setDirty(true);
    };
    const onDeleteNode = (event: Event) => {
      const id = String((event as CustomEvent).detail?.id || '');
      if (!id || lockedRef.current) return;
      const node = nodesRef.current.find((item) => item.id === id);
      const nodeType = String((node?.data as { nodeType?: string })?.nodeType || '');
      if (nodeType === 'trigger') {
        toast.error('Trigger node delete mat karo — flow start ke liye zaroori hai.');
        return;
      }
      setNodes((prev) => prev.filter((item) => item.id !== id));
      setEdges((prev) => prev.filter((edge) => edge.source !== id && edge.target !== id));
      setSelectedNodeId('');
      setDirty(true);
    };
    const onCloneNode = (event: Event) => {
      const id = String((event as CustomEvent).detail?.id || '');
      if (!id || lockedRef.current) return;
      const node = nodesRef.current.find((item) => item.id === id);
      if (!node) return;
      const nodeType = String((node.data as { nodeType?: string })?.nodeType || 'message');
      if (nodeType === 'trigger') {
        toast.error('Trigger ek hi rehna chahiye.');
        return;
      }
      const copyId = `${nodeType}_${Date.now()}`;
      const copy = toCanvasNodes([
        {
          ...node,
          id: copyId,
          position: { x: node.position.x + 40, y: node.position.y + 40 },
          selected: false,
          data: { ...(node.data || {}) },
        },
      ])[0];
      setNodes((prev) => [...prev, copy]);
      setSelectedNodeId(copyId);
      setDirty(true);
    };
    window.addEventListener('bot-flow-remove-edge', onRemoveEdge);
    window.addEventListener('bot-flow-delete-node', onDeleteNode);
    window.addEventListener('bot-flow-clone-node', onCloneNode);
    return () => {
      window.removeEventListener('bot-flow-remove-edge', onRemoveEdge);
      window.removeEventListener('bot-flow-delete-node', onDeleteNode);
      window.removeEventListener('bot-flow-clone-node', onCloneNode);
    };
  }, []);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirty) return;
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [dirty]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (locked) return;
      const target = event.target as HTMLElement | null;
      const tag = String(target?.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select' || target?.isContentEditable) return;
      if (event.key !== 'Backspace' && event.key !== 'Delete') return;
      if (selectedEdgeId) {
        event.preventDefault();
        setEdges((prev) => prev.filter((edge) => edge.id !== selectedEdgeId));
        setSelectedEdgeId('');
        setDirty(true);
        return;
      }
      if (!selectedNodeId) return;
      event.preventDefault();
      const node = nodes.find((n) => n.id === selectedNodeId);
      const nodeType = String((node?.data as any)?.nodeType || node?.type || '');
      if (nodeType === 'trigger') {
        toast.error('Trigger node delete mat karo — flow start ke liye zaroori hai.');
        return;
      }
      setNodes((prev) => prev.filter((n) => n.id !== selectedNodeId));
      setEdges((prev) =>
        prev.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
      );
      setSelectedNodeId('');
      setDirty(true);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [locked, selectedNodeId, selectedEdgeId, nodes]);

  useEffect(() => {
    setNodes((prev) => {
      let changed = false;
      const next = prev.map((node) => {
        const nodeType = String((node.data as any)?.nodeType || node.type || '');
        if (!CARD_NODE_TYPES.has(nodeType) || node.type === 'flowCard') return node;
        changed = true;
        return toCanvasNodes([node])[0];
      });
      return changed ? next : prev;
    });
  }, [nodes]);

  useEffect(() => {
    loadFlowList();
    loadTemplates();
  }, [searchParams]);

  useEffect(() => {
    if (!selectedFlowId) return;
    loadFlowDetail(selectedFlowId);
  }, [selectedFlowId]);

  const loadFlowList = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/whatsapp/bot-flow');
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load flows');
      const list = Array.isArray(json.flows) ? json.flows : [];
      setFlows(list);

      const requestedId = searchParams.get('flowId');
      const requestedExists = requestedId ? list.some((item: BotFlow) => item.id === requestedId) : false;

      if (list.length === 0) {
        const created = await fetch('/api/whatsapp/bot-flow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Default WhatsApp Bot Flow', graph_json: createDefaultBotFlowGraph() }),
        });
        const createdJson = await created.json();
        if (!created.ok || !createdJson?.success) {
          throw new Error(createdJson?.error || 'Failed to create default flow');
        }
        setSelectedFlowId(createdJson.flow.id);
        setFlows([createdJson.flow]);
      } else if (requestedExists) {
        setSelectedFlowId(requestedId as string);
      } else if (!selectedFlowId) {
        setSelectedFlowId(list[0].id);
      }
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load flow list');
    } finally {
      setLoading(false);
    }
  };

  const loadTemplates = async () => {
    try {
      const res = await fetch('/api/whatsapp/templates');
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load templates');
      setTemplateOptions(Array.isArray(json.templates) ? json.templates : []);
    } catch {
      setTemplateOptions([]);
    }
  };

  const loadFlowDetail = async (flowId: string) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/whatsapp/bot-flow/${flowId}`);
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to load flow detail');

      const loadedVersions = Array.isArray(json.versions) ? json.versions : [];
      setVersions(loadedVersions);
      const preferred = loadedVersions.find((v: BotFlowVersion) => v.status === 'DRAFT') || loadedVersions[0];
      if (!preferred) {
        const fallback = createDefaultBotFlowGraph();
        setNodes(toCanvasNodes(fallback.nodes as Node[]));
        setEdges(fallback.edges as Edge[]);
        setSelectedVersionId('');
        setDirty(false);
        return;
      }

      setSelectedVersionId(preferred.id);
      const graph = preferred.graph_json || createDefaultBotFlowGraph();
      setNodes(toCanvasNodes(graph.nodes as Node[]));
      setEdges(
        (Array.isArray(graph.edges) ? graph.edges : []).map((edge) => ({
          ...edge,
          sourceHandle: (edge as Edge).sourceHandle || (edge as Edge).label || undefined,
        })),
      );
      setDirty(false);
      setSelectedNodeId('');
      setTimeout(() => reactFlow?.fitView({ padding: 0.2 }), 50);
    } catch (error: any) {
      toast.error(error?.message || 'Failed to load flow detail');
    } finally {
      setLoading(false);
    }
  };

  const onConnect: OnConnect = (connection: Connection) => {
    if (locked) return;
    const sourceNode = nodes.find((node) => node.id === connection.source);
    const sourceType = String((sourceNode?.data as any)?.nodeType || sourceNode?.type || '');
    const fromButton = String(connection.sourceHandle || '').trim();
    const edgeLabel = fromButton
      || (sourceType === 'condition' ? window.prompt('Enter branch label (yes / no):', '') || '' : '');
    setEdges((eds) =>
      addEdge(
        {
          ...connection,
          label: edgeLabel || undefined,
          sourceHandle: fromButton || connection.sourceHandle,
        },
        eds
      )
    );
    setDirty(true);
  };

  const addNode = (type: string, label?: string, preset?: Record<string, unknown>) => {
    if (locked) return;
    const id = `${type}_${Date.now()}`;
    const center = reactFlow?.screenToFlowPosition({ x: 420, y: 260 }) || { x: 260, y: 220 };
    const defaults: Record<string, unknown> = {
      label: label || `${type.replace(/_/g, ' ')} node`,
      nodeType: type,
      ...(preset || {}),
    };
    if (type === 'trigger' && !defaults.triggerEvent) defaults.triggerEvent = 'whatsapp_incoming';
    if (type === 'delay') defaults.delaySeconds = 60;
    if (type === 'message') defaults.messageBody = 'Hi {{name}}, ';
    const styled = toCanvasNodes([
      {
        id,
        type: 'default',
        position: center,
        data: defaults,
      } as Node,
    ])[0];
    setNodes((prev) => [...prev, styled]);
    setSelectedNodeId(id);
    setDirty(true);
  };

  const patchNodeData = (patch: Record<string, unknown>) => {
    if (!selectedNodeId) return;
    setNodes((prev) =>
      prev.map((node) =>
        node.id === selectedNodeId
          ? {
              ...node,
              data: { ...(node.data || {}), ...patch },
            }
          : node
      )
    );
    setDirty(true);
  };

  const deleteSelectedNode = () => {
    if (locked || !selectedNodeId) return;
    const nodeType = String((selectedNode?.data as any)?.nodeType || selectedNode?.type || '');
    if (nodeType === 'trigger') {
      toast.error('Trigger node delete mat karo — flow ko start karne ke liye zaroori hai.');
      return;
    }
    setNodes((prev) => prev.filter((node) => node.id !== selectedNodeId));
    setEdges((prev) =>
      prev.filter((edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId),
    );
    setSelectedNodeId('');
    setDirty(true);
    toast.success('Node deleted');
  };

  const handleDeleteFlow = async () => {
    if (!selectedFlowId) return;
    const name = currentFlow?.name || 'this workflow';
    const ok = window.confirm(`Delete workflow “${name}”?\n\nPermanently delete ho jayega.`);
    if (!ok) return;
    setDeletingFlow(true);
    try {
      const res = await fetch(`/api/whatsapp/bot-flow/${selectedFlowId}`, { method: 'DELETE' });
      const json = await res.json().catch(() => ({}));
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Delete failed');
      toast.success('Workflow deleted');
      router.push('/dashboard/super_admin/whatsapp-workflows');
    } catch (error: any) {
      toast.error(error?.message || 'Delete failed');
    } finally {
      setDeletingFlow(false);
    }
  };

  const handleSaveDraft = async () => {
    if (!selectedFlowId) return;
    try {
      const res = await fetch(`/api/whatsapp/bot-flow/${selectedFlowId}/save-draft`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ graph_json: normalizedGraph() }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to save draft');
      toast.success('Draft saved');
      setDirty(false);
      await loadFlowDetail(selectedFlowId);
    } catch (error: any) {
      toast.error(error?.message || 'Save draft failed');
    }
  };

  const handlePublish = async () => {
    if (!selectedFlowId) return;
    if (!validation.isValid) {
      toast.error('Fix validation errors before publishing.');
      return;
    }
    try {
      await handleSaveDraft();
      const res = await fetch(`/api/whatsapp/bot-flow/${selectedFlowId}/publish`, { method: 'POST' });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Failed to publish flow');
      toast.success('Flow published');
      setDirty(false);
      await loadFlowDetail(selectedFlowId);
    } catch (error: any) {
      toast.error(error?.message || 'Publish failed');
    }
  };

  const handleClone = async () => {
    if (!selectedFlowId) return;
    const currentFlow = flows.find((flow) => flow.id === selectedFlowId);
    const name = window.prompt('Clone flow name:', `Copy of ${currentFlow?.name || 'Bot Flow'}`);
    if (!name) return;
    try {
      const res = await fetch(`/api/whatsapp/bot-flow/${selectedFlowId}/clone`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, source_name: currentFlow?.name || 'Bot Flow' }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Clone failed');
      toast.success('Flow cloned');
      await loadFlowList();
      setSelectedFlowId(json.flow.id);
    } catch (error: any) {
      toast.error(error?.message || 'Clone failed');
    }
  };

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] flex-col overflow-hidden bg-[#f1f5f9] lg:h-[100dvh]">
      <header className="flex shrink-0 flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-2.5">
        <Link
          href="/dashboard/super_admin/whatsapp-workflows"
          className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100"
        >
          ← Workflows
        </Link>
        <div className="h-5 w-px bg-slate-200" />
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{currentFlow?.name || 'Workflow'}</p>
          <p className="text-[11px] text-slate-500">
            {loading ? 'Loading…' : dirty ? 'Unsaved changes' : 'Saved'} · {locked ? 'Read-only' : 'Editing'}
          </p>
        </div>

        <select
          className="ml-2 max-w-[200px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
          value={selectedFlowId}
          onChange={(e) => setSelectedFlowId(e.target.value)}
        >
          {flows.map((flow) => (
            <option key={flow.id} value={flow.id}>
              {flow.name}
            </option>
          ))}
        </select>
        <select
          className="max-w-[160px] rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
          value={selectedVersionId}
          onChange={(e) => {
            const version = versions.find((item) => item.id === e.target.value);
            setSelectedVersionId(e.target.value);
            if (!version) return;
            const graph = version.graph_json || createDefaultBotFlowGraph();
            setNodes(toCanvasNodes(graph.nodes as Node[]));
            setEdges(Array.isArray(graph.edges) ? graph.edges : []);
            setDirty(false);
          }}
        >
          {versions.map((version) => (
            <option key={version.id} value={version.id}>
              v{version.version_no} · {version.status}
            </option>
          ))}
        </select>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setLocked((v) => !v)}
            className={`rounded-lg px-2.5 py-1.5 text-xs font-semibold ${
              locked ? 'bg-slate-100 text-slate-600' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {locked ? 'Locked' : 'Editable'}
          </button>
          <button
            type="button"
            onClick={handleSaveDraft}
            disabled={loading || locked}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Save draft
          </button>
          <button
            type="button"
            onClick={handleClone}
            disabled={loading}
            className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
          >
            Clone
          </button>
          <button
            type="button"
            onClick={() => void handleDeleteFlow()}
            disabled={loading || deletingFlow}
            className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5" />
            {deletingFlow ? 'Deleting…' : 'Delete'}
          </button>
          <button
            type="button"
            onClick={handlePublish}
            disabled={loading || locked}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-bold text-white hover:bg-violet-700 disabled:opacity-50"
          >
            Publish
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        {/* Left palette */}
        <aside className="hidden w-[220px] shrink-0 flex-col border-r border-slate-200 bg-white lg:flex xl:w-[260px]">
          <div className="flex gap-1 border-b border-slate-100 p-2">
            <button
              type="button"
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                activeTab === 'triggers' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setActiveTab('triggers')}
            >
              Events
            </button>
            <button
              type="button"
              className={`flex-1 rounded-lg px-2 py-1.5 text-xs font-semibold ${
                activeTab === 'actions' ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
              onClick={() => setActiveTab('actions')}
            >
              Actions
            </button>
          </div>
          <div className="border-b border-slate-100 p-2">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search…"
                className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pl-8 pr-2 text-xs outline-none focus:border-violet-300 focus:bg-white"
              />
            </div>
          </div>
          <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto p-2">
            {filteredPalette.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={`${item.bucket}-${item.type}-${item.label}`}
                  type="button"
                  onClick={() => addNode(item.type, item.label, item.preset)}
                  disabled={locked}
                  className="flex w-full items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left text-xs font-medium text-slate-700 shadow-sm transition hover:border-violet-300 hover:bg-violet-50 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
                    <Icon className="h-3.5 w-3.5" />
                  </span>
                  {item.label}
                </button>
              );
            })}
            {filteredPalette.length === 0 ? (
              <p className="px-2 py-6 text-center text-xs text-slate-400">No matching items</p>
            ) : null}
          </div>
          <div className="border-t border-slate-100 p-2">
            <Link
              href="/dashboard/super_admin/whatsapp-templates"
              className="block rounded-lg px-2 py-1.5 text-center text-[11px] font-semibold text-violet-600 hover:bg-violet-50"
            >
              Manage templates →
            </Link>
          </div>
        </aside>

        {/* Canvas */}
        <div className="relative min-w-0 flex-1 bg-[#eef2f7]">
          {showHelp ? (
            <div className="absolute left-3 right-3 top-3 z-10 mx-auto max-w-lg rounded-xl border border-violet-200 bg-white/95 p-3 shadow-sm backdrop-blur">
              <div className="flex items-start gap-2">
                <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold text-slate-900">Flow kaise banaye</p>
                  <ol className="mt-1 list-decimal space-y-0.5 pl-3 text-[11px] leading-snug text-slate-600">
                    <li>Left se Action click karo → canvas pe naya block add hota hai</li>
                    <li>Block ke edge pe circle se drag karke dusre block se line jodo</li>
                    <li>
                      <strong>Send Message</strong> pe click karo → right panel me{' '}
                      <strong>Message Body</strong> me text likho
                    </li>
                    <li>Wire hatane ke liye beech ka × dabao, ya wire select karke Delete</li>
                    <li>Save draft → Publish (tabhi WhatsApp pe live)</li>
                  </ol>
                </div>
                <button
                  type="button"
                  onClick={() => setShowHelp(false)}
                  className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  aria-label="Dismiss help"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => setShowHelp(true)}
              className="absolute left-3 top-3 z-10 inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11px] font-semibold text-slate-600 shadow-sm hover:bg-slate-50"
            >
              <HelpCircle className="h-3.5 w-3.5" />
              How to
            </button>
          )}
          <ReactFlow
            nodes={nodes}
            edges={edges.map((edge) => ({ ...edge, type: 'removable', selected: edge.id === selectedEdgeId }))}
            onNodesChange={(changes) => {
              setNodes((prev) => {
                const next = [...prev];
                for (const change of changes) {
                  if (change.type === 'position' && change.position) {
                    const idx = next.findIndex((node) => node.id === change.id);
                    if (idx >= 0) next[idx] = { ...next[idx], position: change.position };
                  }
                  if (change.type === 'remove') {
                    const idx = next.findIndex((node) => node.id === change.id);
                    if (idx >= 0) next.splice(idx, 1);
                  }
                  if (change.type === 'select' && change.selected) {
                    setSelectedNodeId(change.id);
                  }
                }
                return next;
              });
              setDirty(true);
            }}
            onEdgesChange={(changes) => {
              setEdges((prev) => {
                const next = [...prev];
                for (const change of changes) {
                  if (change.type === 'remove') {
                    const idx = next.findIndex((edge) => edge.id === change.id);
                    if (idx >= 0) next.splice(idx, 1);
                  }
                }
                return next;
              });
              setDirty(true);
            }}
            onConnect={onConnect}
            onInit={setReactFlow}
            nodeTypes={flowNodeTypes}
            edgeTypes={flowEdgeTypes}
            onNodeClick={(_, node) => {
              setSelectedNodeId(node.id);
              setSelectedEdgeId('');
            }}
            onEdgeClick={(_, edge) => {
              setSelectedEdgeId(edge.id);
              setSelectedNodeId('');
            }}
            onPaneClick={() => {
              setSelectedNodeId('');
              setSelectedEdgeId('');
            }}
            nodesConnectable={!locked}
            nodesDraggable={!locked}
            elementsSelectable={!locked}
            deleteKeyCode={null}
            fitView
            proOptions={{ hideAttribution: true }}
            defaultEdgeOptions={{
              type: 'removable',
              style: { stroke: '#94a3b8', strokeWidth: 1.5 },
            }}
          >
            <Controls
              showInteractive={false}
              className="!overflow-hidden !rounded-xl !border !border-slate-200 !bg-white !shadow-sm"
            />
            <Background gap={18} size={1} color="#cbd5e1" />
          </ReactFlow>
        </div>

        {/* Right properties — always visible so Message Body / template editing is findable */}
        <aside className="flex w-[min(320px,38vw)] shrink-0 flex-col overflow-hidden border-l border-slate-200 bg-white sm:w-[300px]">
          <div className="border-b border-slate-100 px-4 py-3">
            <p className="text-sm font-bold text-slate-900">Node settings</p>
            <p className="text-[11px] text-slate-500">
              Send Message select karo → yahan <span className="font-semibold">Message Body</span> likho
            </p>
          </div>
          <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
            {selectedEdgeId && !selectedNode ? (
              <button
                type="button"
                onClick={() => {
                  setEdges((prev) => prev.filter((edge) => edge.id !== selectedEdgeId));
                  setSelectedEdgeId('');
                  setDirty(true);
                }}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100"
              >
                Remove this wire
              </button>
            ) : null}
            <PropertiesPanel
              selectedNode={selectedNode}
              templateOptions={templateOptions}
              onPatchNodeData={patchNodeData}
            />
            {selectedNode ? (
              <button
                type="button"
                onClick={deleteSelectedNode}
                disabled={locked}
                className="inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-100 disabled:opacity-50"
              >
                <Trash2 className="h-3.5 w-3.5" />
                Delete this node
              </button>
            ) : null}
            <ValidationPanel errors={validation.errors} warnings={validation.warnings} />
          </div>
        </aside>
      </div>
    </div>
  );
}

export default function SuperAdminBotFlowBuilderPage() {
  return (
    <ReactFlowProvider>
      <Suspense fallback={<div className="p-4 text-sm text-gray-500">Loading bot flow builder...</div>}>
        <BotFlowBuilderPage />
      </Suspense>
    </ReactFlowProvider>
  );
}
