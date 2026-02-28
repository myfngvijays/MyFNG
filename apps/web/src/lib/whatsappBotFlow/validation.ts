export type BotFlowNodeType =
  | 'trigger'
  | 'message'
  | 'template'
  | 'condition'
  | 'api_request'
  | 'handoff'
  | 'end';

export type BotFlowNode = {
  id: string;
  type: BotFlowNodeType;
  position?: { x: number; y: number };
  data?: {
    label?: string;
    templateName?: string;
    templateVariableCount?: number;
    templateParamsMapping?: string[];
    mustTerminate?: boolean;
    [key: string]: unknown;
  };
};

export type BotFlowEdge = {
  id: string;
  source: string;
  target: string;
  label?: string;
};

export type BotFlowGraph = {
  nodes: BotFlowNode[];
  edges: BotFlowEdge[];
  viewport?: { x?: number; y?: number; zoom?: number };
};

export type FlowValidationResult = {
  errors: string[];
  warnings: string[];
  isValid: boolean;
};

export function createDefaultBotFlowGraph(): BotFlowGraph {
  return {
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        position: { x: 120, y: 80 },
        data: { label: 'Entry Trigger' },
      },
      {
        id: 'message_1',
        type: 'message',
        position: { x: 120, y: 240 },
        data: { label: 'Welcome Message' },
      },
    ],
    edges: [{ id: 'edge_trigger_1_message_1', source: 'trigger_1', target: 'message_1' }],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}

export function normalizeBotFlowGraph(input: unknown): BotFlowGraph {
  const graph = (input || {}) as Partial<BotFlowGraph>;
  const nodes = Array.isArray(graph.nodes) ? graph.nodes : [];
  const edges = Array.isArray(graph.edges) ? graph.edges : [];
  const viewport = graph.viewport && typeof graph.viewport === 'object' ? graph.viewport : { x: 0, y: 0, zoom: 1 };
  return { nodes, edges, viewport };
}

export function validateBotFlowGraph(input: unknown): FlowValidationResult {
  const graph = normalizeBotFlowGraph(input);
  const errors: string[] = [];
  const warnings: string[] = [];

  const triggerNodes = graph.nodes.filter((node) => node.type === 'trigger');
  if (triggerNodes.length !== 1) {
    errors.push('Flow must have exactly one trigger node.');
  }

  const nodeMap = new Map(graph.nodes.map((node) => [node.id, node]));
  const outgoingMap = new Map<string, BotFlowEdge[]>();
  for (const edge of graph.edges) {
    if (!outgoingMap.has(edge.source)) outgoingMap.set(edge.source, []);
    outgoingMap.get(edge.source)!.push(edge);

    if (!nodeMap.has(edge.source)) errors.push(`Edge "${edge.id}" has missing source node "${edge.source}".`);
    if (!nodeMap.has(edge.target)) errors.push(`Edge "${edge.id}" has missing target node "${edge.target}".`);
  }

  for (const node of graph.nodes) {
    const outgoing = outgoingMap.get(node.id) || [];
    const isTerminal = node.type === 'end' || node.type === 'handoff';
    if (!isTerminal && outgoing.length === 0) {
      errors.push(`Node "${node.data?.label || node.id}" has no outgoing path.`);
    }

    if (node.type === 'condition') {
      if (outgoing.length < 2) {
        errors.push(`Condition node "${node.data?.label || node.id}" must have at least two branches.`);
      }
      const unlabeled = outgoing.filter((edge) => !String(edge.label || '').trim());
      if (unlabeled.length > 0) {
        errors.push(`Condition node "${node.data?.label || node.id}" has unlabeled branches.`);
      }
    }

    if (node.type === 'template') {
      const templateName = String(node.data?.templateName || '').trim();
      if (!templateName) {
        errors.push(`Template node "${node.data?.label || node.id}" is missing template name.`);
      }
      const expectedVars = Number(node.data?.templateVariableCount || 0);
      const mappedVars = Array.isArray(node.data?.templateParamsMapping)
        ? node.data!.templateParamsMapping.filter((item) => String(item || '').trim()).length
        : 0;
      if (expectedVars > 0 && mappedVars !== expectedVars) {
        errors.push(
          `Template node "${node.data?.label || node.id}" requires ${expectedVars} mapped params, found ${mappedVars}.`
        );
      }
    }
  }

  const visited = new Set<string>();
  const stack = new Set<string>();
  const adjacency = (nodeId: string) => (outgoingMap.get(nodeId) || []).map((edge) => edge.target);
  let cycleFound = false;

  const dfs = (nodeId: string) => {
    if (stack.has(nodeId)) {
      cycleFound = true;
      return;
    }
    if (visited.has(nodeId)) return;
    visited.add(nodeId);
    stack.add(nodeId);
    for (const next of adjacency(nodeId)) dfs(next);
    stack.delete(nodeId);
  };

  const startNode = triggerNodes[0];
  if (startNode) dfs(startNode.id);
  if (cycleFound) {
    warnings.push('Cycle detected in flow graph. Ensure loops are intentional.');
  }

  const mustTerminateNodes = graph.nodes.filter((node) => node.data?.mustTerminate);
  if (mustTerminateNodes.length > 0 && cycleFound) {
    errors.push('Flow has cycles while some nodes are marked as must-terminate.');
  }

  return { errors, warnings, isValid: errors.length === 0 };
}
