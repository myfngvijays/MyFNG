'use client';

import { useCallback, useEffect, useRef } from 'react';
import {
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  ReactFlow,
  addEdge,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type FinalConnectionState,
  type Node,
  type NodeTypes,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import type { CallIqCanvasKind, CallIqCanvasState } from '@/lib/telecaller/salesPlaybookDefaults';

const NAVY = '#1e3a8a';

const EDGE_STYLE = { stroke: NAVY, strokeWidth: 2.5 };

function typeOf(kind: CallIqCanvasKind) {
  if (kind === 'event') return 'iqEvent';
  if (kind === 'lead') return 'iqLead';
  if (kind === 'duration') return 'iqDuration';
  return 'iqAi';
}

function kindOf(type?: string): CallIqCanvasKind {
  if (type === 'iqEvent') return 'event';
  if (type === 'iqLead') return 'lead';
  if (type === 'duration' || type === 'iqDuration') return 'duration';
  return 'ai';
}

function styledEdge(source: string, target: string, id?: string): Edge {
  return {
    id: id || `e_${source}_${target}`,
    source,
    target,
    type: 'smoothstep',
    style: EDGE_STYLE,
    markerEnd: { type: MarkerType.ArrowClosed, color: NAVY, width: 16, height: 16 },
  };
}

function canvasToNodes(canvas: CallIqCanvasState, dataFor: (id: string) => Record<string, unknown>): Node[] {
  return canvas.nodes.map((n) => ({
    id: n.id,
    type: typeOf(n.kind),
    position: { x: n.x ?? 40, y: n.y ?? 160 },
    data: dataFor(n.id),
    connectable: true,
    draggable: true,
    style: { overflow: 'visible' },
  }));
}

function canvasToEdges(canvas: CallIqCanvasState): Edge[] {
  return (canvas.edges || []).map((e) => styledEdge(e.source, e.target, e.id));
}

function rfToCanvas(nodes: Node[], edges: Edge[]): CallIqCanvasState {
  return {
    nodes: nodes.map((n) => ({
      id: n.id,
      kind: kindOf(n.type),
      x: n.position.x,
      y: n.position.y,
    })),
    edges: edges.map((e) => ({
      id: String(e.id),
      source: String(e.source),
      target: String(e.target),
    })),
  };
}

function normalizePair(nodes: Node[], source: string, target: string) {
  if (source === target) return null;
  const src = nodes.find((n) => n.id === source);
  const tgt = nodes.find((n) => n.id === target);
  if (!src || !tgt) return null;
  let from = source;
  let to = target;
  if (tgt.type === 'iqEvent' && src.type !== 'iqEvent') {
    from = target;
    to = source;
  } else if (src.type === 'iqAi' && tgt.type !== 'iqAi') {
    from = target;
    to = source;
  }
  const dest = nodes.find((n) => n.id === to);
  const origin = nodes.find((n) => n.id === from);
  if (!dest || !origin || dest.type === 'iqEvent' || origin.type === 'iqAi') return null;
  return { source: from, target: to };
}

export default function CallIqFlowBoard({
  canvas,
  epoch,
  dataStamp,
  nodeTypes,
  dataFor,
  empty,
  onPersist,
  onStartEdit,
}: {
  canvas: CallIqCanvasState;
  epoch: number;
  dataStamp: string;
  nodeTypes: NodeTypes;
  dataFor: (id: string) => Record<string, unknown>;
  empty?: boolean;
  onPersist: (next: CallIqCanvasState) => void;
  onStartEdit: () => void;
}) {
  const dataRef = useRef(dataFor);
  dataRef.current = dataFor;
  const persistRef = useRef(onPersist);
  persistRef.current = onPersist;
  const canvasRef = useRef(canvas);
  canvasRef.current = canvas;
  const connecting = useRef(false);
  const { screenToFlowPosition, getNodes, fitView } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<Node>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const edgesRef = useRef(edges);
  edgesRef.current = edges;

  useEffect(() => {
    const snap = canvasRef.current;
    setNodes(canvasToNodes(snap, (id) => dataRef.current(id)));
    setEdges(canvasToEdges(snap));
    const t = window.setTimeout(() => fitView({ padding: 0.2, duration: 200 }), 50);
    return () => window.clearTimeout(t);
  }, [epoch, fitView, setNodes, setEdges]);

  useEffect(() => {
    if (connecting.current) return;
    setNodes((cur) => cur.map((n) => ({ ...n, data: dataRef.current(n.id) })));
  }, [dataStamp, setNodes]);

  const commit = useCallback((ns: Node[], es: Edge[]) => {
    persistRef.current(rfToCanvas(ns, es));
  }, []);

  const join = useCallback(
    (rawSource: string, rawTarget: string) => {
      const live = getNodes();
      const pair = normalizePair(live, rawSource, rawTarget);
      if (!pair) return;
      setEdges((cur) => {
        if (cur.some((e) => e.source === pair.source && e.target === pair.target)) return cur;
        const next = addEdge(styledEdge(pair.source, pair.target), cur);
        queueMicrotask(() => commit(getNodes(), next));
        return next;
      });
      onStartEdit();
    },
    [commit, getNodes, onStartEdit, setEdges],
  );

  const onConnect = useCallback(
    (connection: Connection) => {
      if (!connection.source || !connection.target) return;
      join(connection.source, connection.target);
    },
    [join],
  );

  const onConnectStart = useCallback(() => {
    connecting.current = true;
  }, []);

  const onConnectEnd = useCallback(
    (event: MouseEvent | TouchEvent, state: FinalConnectionState) => {
      connecting.current = false;
      const fromId = state.fromNode?.id;
      if (!fromId) return;
      if (state.toNode?.id && state.toNode.id !== fromId) {
        join(fromId, state.toNode.id);
        return;
      }
      const point = 'changedTouches' in event ? event.changedTouches[0] : event;
      const pos = screenToFlowPosition({ x: point.clientX, y: point.clientY });
      const hit = getNodes().find((n) => {
        if (n.id === fromId) return false;
        const w = n.measured?.width || 270;
        const h = n.measured?.height || 160;
        return pos.x >= n.position.x && pos.x <= n.position.x + w && pos.y >= n.position.y && pos.y <= n.position.y + h;
      });
      if (hit) join(fromId, hit.id);
    },
    [getNodes, join, screenToFlowPosition],
  );

  return (
    <div className="absolute inset-0">
      <style>{`
        .calliq-flow .react-flow__handle {
          width: 22px !important;
          height: 22px !important;
          min-width: 22px !important;
          min-height: 22px !important;
          background: ${NAVY} !important;
          border: 3px solid #fff !important;
          z-index: 50 !important;
          pointer-events: all !important;
        }
        .calliq-flow .react-flow__handle::after {
          content: '';
          position: absolute;
          inset: -20px;
          border-radius: 999px;
        }
        .calliq-flow .react-flow__node {
          overflow: visible !important;
        }
      `}</style>
      {empty ? (
        <div className="pointer-events-none absolute inset-0 z-[5] flex items-center justify-center">
          <p className="max-w-sm rounded-2xl bg-white/90 px-5 py-4 text-center text-sm text-slate-500 shadow-sm">
            Left se Trigger / Check / SOP add karo. Navy dot se drag karke doosre card pe chhod do.
          </p>
        </div>
      ) : null}
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        nodesConnectable
        elementsSelectable
        nodesDraggable
        connectionMode={ConnectionMode.Loose}
        connectionRadius={100}
        isValidConnection={(c) => Boolean(c.source && c.target && c.source !== c.target)}
        connectionLineStyle={EDGE_STYLE}
        onConnect={onConnect}
        onConnectStart={onConnectStart}
        onConnectEnd={onConnectEnd}
        onNodeDragStop={() => commit(getNodes(), edgesRef.current)}
        onEdgesDelete={(deleted) => {
          const ids = new Set(deleted.map((e) => e.id));
          commit(
            getNodes(),
            edgesRef.current.filter((e) => !ids.has(e.id)),
          );
        }}
        panOnDrag
        zoomOnScroll
        fitView
        fitViewOptions={{ padding: 0.2 }}
        proOptions={{ hideAttribution: true }}
        className="calliq-flow h-full w-full"
        defaultEdgeOptions={{
          type: 'smoothstep',
          style: EDGE_STYLE,
          markerEnd: { type: MarkerType.ArrowClosed, color: NAVY, width: 16, height: 16 },
        }}
      >
        <Background gap={22} size={1} color="#D7DCE5" />
        <Controls showInteractive={false} className="!overflow-hidden !rounded-xl !border !border-slate-200 !bg-white !shadow-sm" />
      </ReactFlow>
    </div>
  );
}
