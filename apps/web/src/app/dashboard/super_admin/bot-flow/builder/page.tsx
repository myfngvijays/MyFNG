'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useMemo, useState } from 'react';
import {
  addEdge,
  Background,
  Controls,
  MiniMap,
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
  ListTree,
  MessageSquare,
  PhoneForwarded,
  PlugZap,
  Search,
  Target,
  UserRoundCheck,
  Workflow,
} from 'lucide-react';
import toast from 'react-hot-toast';
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
  is_active: boolean;
};

type PaletteItem = {
  type: string;
  label: string;
  icon: any;
  bucket: 'triggers' | 'actions';
};

const PALETTE_ITEMS: PaletteItem[] = [
  { type: 'trigger', label: 'Conversation Trigger', icon: Flag, bucket: 'triggers' },
  { type: 'message', label: 'Send Message', icon: MessageSquare, bucket: 'actions' },
  { type: 'template', label: 'Send Template', icon: Bot, bucket: 'actions' },
  { type: 'condition', label: 'Condition', icon: GitBranch, bucket: 'actions' },
  { type: 'api_request', label: 'Call API', icon: PlugZap, bucket: 'actions' },
  { type: 'handoff', label: 'Assign Agent / Handoff', icon: UserRoundCheck, bucket: 'actions' },
  { type: 'end', label: 'Close Conversation', icon: Target, bucket: 'actions' },
];

function toCanvasNodes(rawNodes: Node[] | undefined) {
  return (Array.isArray(rawNodes) ? rawNodes : []).map((node) => ({
    ...node,
    type: 'default',
    data: {
      ...(node.data || {}),
      nodeType: String((node as any).type || (node.data as any)?.nodeType || 'message'),
      label: (node.data as any)?.label || String((node as any).type || 'Node'),
    },
  }));
}

function BotFlowBuilderPage() {
  const searchParams = useSearchParams();
  const [reactFlow, setReactFlow] = useState<ReactFlowInstance<Node, Edge> | null>(null);
  const [flows, setFlows] = useState<BotFlow[]>([]);
  const [versions, setVersions] = useState<BotFlowVersion[]>([]);
  const [selectedFlowId, setSelectedFlowId] = useState<string>('');
  const [selectedVersionId, setSelectedVersionId] = useState<string>('');
  const [nodes, setNodes] = useState<Node[]>([]);
  const [edges, setEdges] = useState<Edge[]>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [locked, setLocked] = useState(false);
  const [activeTab, setActiveTab] = useState<'triggers' | 'actions'>('actions');
  const [searchText, setSearchText] = useState('');
  const [templateOptions, setTemplateOptions] = useState<TemplateOption[]>([]);

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
      const requestedExists = requestedId ? list.some((item) => item.id === requestedId) : false;

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
      setTemplateOptions(
        (Array.isArray(json.templates) ? json.templates : []).filter((item: any) => Boolean(item?.is_active))
      );
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
      setEdges(Array.isArray(graph.edges) ? graph.edges : []);
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
    const edgeLabel =
      sourceNode?.type === 'condition'
        ? window.prompt('Enter branch label for condition (e.g. yes / no):', '') || ''
        : '';
    setEdges((eds) =>
      addEdge(
        {
          ...connection,
          label: edgeLabel || undefined,
        },
        eds
      )
    );
    setDirty(true);
  };

  const addNode = (type: string) => {
    if (locked) return;
    const id = `${type}_${Date.now()}`;
    const center = reactFlow?.screenToFlowPosition({ x: 400, y: 240 }) || { x: 260, y: 220 };
    const newNode: Node = {
      id,
      type: 'default',
      position: center,
      data: { label: `${type.replace('_', ' ')} node`, nodeType: type },
    };
    setNodes((prev) => [...prev, newNode]);
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
    <div className="space-y-4 p-4 sm:p-6">
      <div className="rounded-xl border bg-white p-3 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <div className="inline-flex items-center gap-2 text-sm font-medium text-gray-700">
            <Workflow className="h-4 w-4 text-gray-500" />
            Flow
          </div>
          <select
            className="min-w-[220px] rounded-lg border px-3 py-1.5 text-sm"
            value={selectedFlowId}
            onChange={(e) => setSelectedFlowId(e.target.value)}
          >
            {flows.map((flow) => (
              <option key={flow.id} value={flow.id}>
                {flow.name} ({flow.status})
              </option>
            ))}
          </select>

          <select
            className="min-w-[220px] rounded-lg border px-3 py-1.5 text-sm"
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
                v{version.version_no} ({version.status})
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-xl border bg-white shadow-sm">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Bot Builder</h1>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Link
              href="/dashboard/super_admin/bot-flow"
              className="inline-flex items-center rounded-lg border px-2.5 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
            >
              <ListTree className="mr-1 h-3.5 w-3.5" />
              Flow List
            </Link>
            <Link
              href="/dashboard/super_admin/whatsapp-templates"
              className="inline-flex items-center rounded-lg border px-2.5 py-1.5 font-medium text-gray-700 hover:bg-gray-50"
            >
              <MessageSquare className="mr-1 h-3.5 w-3.5" />
              Templates
            </Link>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-b px-4 py-2.5">
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                activeTab === 'triggers' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('triggers')}
            >
              Triggers
            </button>
            <button
              type="button"
              className={`rounded-md px-3 py-1 text-sm font-medium ${
                activeTab === 'actions' ? 'bg-gray-100 text-gray-900' : 'text-gray-600 hover:bg-gray-50'
              }`}
              onClick={() => setActiveTab('actions')}
            >
              Actions
            </button>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-sm font-medium text-gray-800">
              {currentFlow?.name || 'Bot Flow'}
              <Edit3 className="h-3.5 w-3.5 text-gray-500" />
            </div>
            <label className="inline-flex items-center gap-2 text-sm text-gray-700">
              <button
                type="button"
                onClick={() => setLocked((v) => !v)}
                className={`h-5 w-9 rounded-full p-0.5 transition ${
                  locked ? 'bg-gray-300' : 'bg-emerald-500'
                }`}
                aria-label="Toggle edit enabled"
              >
                <span
                  className={`block h-4 w-4 rounded-full bg-white transition ${
                    locked ? 'translate-x-0' : 'translate-x-4'
                  }`}
                />
              </button>
              {locked ? 'Disabled' : 'Enabled'}
            </label>
            <button
              type="button"
              onClick={handleSaveDraft}
              disabled={loading}
              className="rounded-md border px-3 py-1 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              Save
            </button>
          </div>
        </div>

        <div className="flex h-[76vh] min-h-[620px]">
          <div className="w-[300px] border-r bg-gray-50 p-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-gray-400" />
              <input
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Search Action and Triggers"
                className="w-full rounded-md border bg-white py-2 pl-8 pr-2 text-xs"
              />
            </div>

            <div className="mt-3 space-y-2 overflow-y-auto pr-1">
              {filteredPalette.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.type}
                    type="button"
                    onClick={() => addNode(item.type)}
                    disabled={locked}
                    className="flex w-full items-center gap-2 rounded-md border bg-white px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <Icon className="h-4 w-4 text-gray-500" />
                    {item.label}
                  </button>
                );
              })}
              {filteredPalette.length === 0 ? (
                <div className="rounded-md border border-dashed bg-white px-3 py-4 text-center text-xs text-gray-500">
                  No matching items
                </div>
              ) : null}
            </div>

            <div className="mt-4 space-y-3 border-t pt-3">
              <PropertiesPanel
                selectedNode={selectedNode}
                templateOptions={templateOptions}
                onPatchNodeData={patchNodeData}
              />
              <ValidationPanel errors={validation.errors} warnings={validation.warnings} />
            </div>
          </div>

          <div className="flex-1 bg-gray-100">
            <div className="h-full">
              <ReactFlow
                nodes={nodes}
                edges={edges}
                onNodesChange={(changes) => {
                  setNodes((prev) => {
                    const next = [...prev];
                    for (const change of changes) {
                      if (change.type === 'position' && change.position && change.dragging === false) {
                        const idx = next.findIndex((node) => node.id === change.id);
                        if (idx >= 0) next[idx] = { ...next[idx], position: change.position };
                      }
                      if (change.type === 'remove') {
                        const idx = next.findIndex((node) => node.id === change.id);
                        if (idx >= 0) next.splice(idx, 1);
                      }
                      if (change.type === 'select') {
                        if (change.selected) setSelectedNodeId(change.id);
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
                nodesConnectable={!locked}
                nodesDraggable={!locked}
                elementsSelectable={!locked}
                fitView
              >
                <MiniMap pannable zoomable />
                <Controls />
                <Background />
              </ReactFlow>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between px-4 py-2 text-xs text-gray-500">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePublish}
              className="inline-flex items-center gap-1 rounded-md bg-emerald-600 px-2.5 py-1.5 font-semibold text-white hover:bg-emerald-700"
              disabled={loading}
            >
              <PhoneForwarded className="h-3.5 w-3.5" />
              Publish
            </button>
            <button
              type="button"
              onClick={handleClone}
              className="rounded-md border px-2.5 py-1.5 font-semibold text-gray-700 hover:bg-gray-50"
              disabled={loading}
            >
              Clone
            </button>
          </div>
          <span>{loading ? 'Working...' : dirty ? 'Unsaved changes' : 'All changes saved'}</span>
        </div>
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
