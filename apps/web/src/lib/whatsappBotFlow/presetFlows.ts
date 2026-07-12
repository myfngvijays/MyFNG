import { validateBotFlowGraph, type BotFlowGraph } from './validation';

export type PresetBotFlow = {
  key: string;
  name: string;
  description: string;
  recommendedMode: 'HYBRID' | 'FLOW_FIRST' | 'AI_FIRST';
  publishOnSeed: boolean;
  setActiveOnSeed: boolean;
  graph: BotFlowGraph;
};

export const WHATSAPP_ROUTER_V1_GRAPH: BotFlowGraph = {
  nodes: [
    {
      id: 'trigger_1',
      type: 'trigger',
      position: { x: 80, y: 80 },
      data: { label: 'Inbound WhatsApp' },
    },
    {
      id: 'condition_router',
      type: 'condition',
      position: { x: 80, y: 220 },
      data: { label: 'Route by intent / keywords' },
    },
    {
      id: 'handoff_human',
      type: 'handoff',
      position: { x: 360, y: 160 },
      data: {
        label: 'Human / RSA Handoff',
        handoffNote: 'Customer requested RSA, human agent, or live support on WhatsApp',
      },
    },
    {
      id: 'end_passthrough',
      type: 'end',
      position: { x: 360, y: 320 },
      data: { label: 'Pass to MISA AI', messageBody: '' },
    },
  ],
  edges: [
    { id: 'edge_trigger_condition', source: 'trigger_1', target: 'condition_router' },
    { id: 'edge_rsa_handoff', source: 'condition_router', target: 'handoff_human', label: 'RSA' },
    { id: 'edge_agent_handoff', source: 'condition_router', target: 'handoff_human', label: 'contains:agent' },
    { id: 'edge_human_handoff', source: 'condition_router', target: 'handoff_human', label: 'contains:human' },
    { id: 'edge_default_ai', source: 'condition_router', target: 'end_passthrough', label: 'default' },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

export const WHATSAPP_WELCOME_MENU_V1_GRAPH: BotFlowGraph = {
  nodes: [
    {
      id: 'trigger_1',
      type: 'trigger',
      position: { x: 80, y: 60 },
      data: { label: 'Inbound WhatsApp' },
    },
    {
      id: 'message_welcome',
      type: 'message',
      position: { x: 80, y: 180 },
      data: {
        label: 'Welcome',
        messageBody:
          'Hi! Main MISA hoon — MyFNG Instant Service Assistant.\n\nAapko kya chahiye?\n• Service pricing\n• Workshop location\n• Booking\n• RSA / roadside help\n\nCar model + pincode bhejiye, ya seedha apna sawal likhiye.',
      },
    },
    {
      id: 'condition_menu',
      type: 'condition',
      position: { x: 80, y: 340 },
      data: { label: 'Menu router' },
    },
    {
      id: 'message_pricing',
      type: 'message',
      position: { x: 320, y: 280 },
      data: {
        label: 'Pricing hint',
        messageBody: 'Pricing ke liye car model aur 6-digit pincode bhejiye.\nExample: Swift periodic service 400601',
      },
    },
    {
      id: 'message_booking',
      type: 'message',
      position: { x: 320, y: 360 },
      data: {
        label: 'Booking hint',
        messageBody:
          'Booking ke liye yeh details bhejiye:\n1. Car model\n2. Pincode\n3. Service type\n4. Preferred date',
      },
    },
    {
      id: 'message_workshop',
      type: 'message',
      position: { x: 320, y: 440 },
      data: {
        label: 'Workshop hint',
        messageBody: 'Nearby workshop ke liye apna 6-digit pincode bhejiye.\nExample: workshop near 400601',
      },
    },
    {
      id: 'handoff_rsa',
      type: 'handoff',
      position: { x: 320, y: 520 },
      data: {
        label: 'RSA Handoff',
        handoffNote: 'RSA / roadside assistance request from WhatsApp menu flow',
      },
    },
    {
      id: 'end_done',
      type: 'end',
      position: { x: 560, y: 380 },
      data: { label: 'Done', messageBody: '' },
    },
  ],
  edges: [
    { id: 'edge_trigger_welcome', source: 'trigger_1', target: 'message_welcome' },
    { id: 'edge_welcome_condition', source: 'message_welcome', target: 'condition_menu' },
    { id: 'edge_pricing', source: 'condition_menu', target: 'message_pricing', label: 'PRICING' },
    { id: 'edge_booking', source: 'condition_menu', target: 'message_booking', label: 'BOOKING' },
    { id: 'edge_workshop', source: 'condition_menu', target: 'message_workshop', label: 'WORKSHOP' },
    { id: 'edge_rsa', source: 'condition_menu', target: 'handoff_rsa', label: 'RSA' },
    { id: 'edge_default', source: 'condition_menu', target: 'end_done', label: 'default' },
    { id: 'edge_pricing_end', source: 'message_pricing', target: 'end_done' },
    { id: 'edge_booking_end', source: 'message_booking', target: 'end_done' },
    { id: 'edge_workshop_end', source: 'message_workshop', target: 'end_done' },
  ],
  viewport: { x: 0, y: 0, zoom: 1 },
};

export const PRESET_BOT_FLOWS: PresetBotFlow[] = [
  {
    key: 'whatsapp_router_v1',
    name: 'WhatsApp Router v1',
    description: 'HYBRID mode: RSA/human → handoff. Baaki sab MISA AI ko pass.',
    recommendedMode: 'HYBRID',
    publishOnSeed: true,
    setActiveOnSeed: true,
    graph: WHATSAPP_ROUTER_V1_GRAPH,
  },
  {
    key: 'whatsapp_welcome_menu_v1',
    name: 'WhatsApp Welcome Menu v1',
    description: 'FLOW_FIRST mode: welcome + menu hints. AI ke saath use mat karo.',
    recommendedMode: 'FLOW_FIRST',
    publishOnSeed: false,
    setActiveOnSeed: false,
    graph: WHATSAPP_WELCOME_MENU_V1_GRAPH,
  },
];

export function getPresetByKey(key: string): PresetBotFlow | undefined {
  return PRESET_BOT_FLOWS.find((preset) => preset.key === key);
}

export function validatePresetGraph(graph: BotFlowGraph) {
  return validateBotFlowGraph(graph);
}
