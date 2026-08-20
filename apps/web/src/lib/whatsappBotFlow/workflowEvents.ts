/** TeleCRM-style workflow trigger / action catalog (admin WhatsApp bot builder). */

export type WorkflowEventDef = {
  key: string;
  label: string;
  group: string;
  description: string;
  published?: boolean;
};

export const WORKFLOW_TRIGGER_EVENTS: WorkflowEventDef[] = [
  {
    key: 'whatsapp_incoming',
    label: 'Incoming WhatsApp',
    group: 'WhatsApp',
    description: 'Customer sends a WhatsApp message to 6161',
    published: true,
  },
  {
    key: 'template_replied',
    label: 'On Template Replied',
    group: 'WhatsApp',
    description: 'Customer replies after an outbound template',
    published: true,
  },
  {
    key: 'interactive_replied',
    label: 'On Interactive Replied',
    group: 'WhatsApp',
    description: 'Customer taps a list / button reply',
    published: true,
  },
  {
    key: 'lead_assigned',
    label: 'On Lead Assignment Change',
    group: 'CRM Actions',
    description: 'service_leads assigned_telecaller_id changes',
    published: true,
  },
  {
    key: 'lead_status_change',
    label: 'On Lead Status Change',
    group: 'CRM Actions',
    description: 'Lead status / stage updates',
    published: true,
  },
  {
    key: 'lead_field_change',
    label: 'On Lead Field Change',
    group: 'CRM Actions',
    description: 'Watched lead fields change',
  },
  {
    key: 'manual_lead',
    label: 'On Manual Lead',
    group: 'CRM Actions',
    description: 'Lead created manually in CRM',
  },
  {
    key: 'system_note',
    label: 'On User / System Note',
    group: 'CRM Actions',
    description: 'Note added on a lead',
  },
  {
    key: 'missed_call',
    label: 'On Missed Call',
    group: 'Calls',
    description: 'WhatsApp / IVR missed call logged',
  },
  {
    key: 'payment_completed',
    label: 'Payment Completed',
    group: 'Payments',
    description: 'Payment marked completed',
  },
];

export const WORKFLOW_ACTION_NODES = [
  { type: 'message', label: 'Send Message', group: 'Communication' },
  { type: 'template', label: 'Send Template', group: 'Communication' },
  { type: 'condition', label: 'If / Else', group: 'Logic' },
  { type: 'delay', label: 'Time Delay', group: 'Logic' },
  { type: 'update_lead', label: 'Update Lead / Fresh', group: 'Lead' },
  { type: 'apply_tags', label: 'Apply Lead Tags', group: 'Lead' },
  { type: 'assign_telecaller', label: 'Assign Telecaller', group: 'Lead' },
  { type: 'handoff', label: 'Assign Agent / Handoff', group: 'Lead' },
  { type: 'api_request', label: 'Call API', group: 'Integrations' },
  { type: 'end', label: 'End Flow', group: 'Logic' },
] as const;

export function labelForTriggerEvent(key: string): string {
  return WORKFLOW_TRIGGER_EVENTS.find((e) => e.key === key)?.label || key || 'Incoming WhatsApp';
}

export function createGraphForTriggerEvent(triggerEvent: string) {
  const label = labelForTriggerEvent(triggerEvent);
  return {
    nodes: [
      {
        id: 'trigger_1',
        type: 'trigger',
        position: { x: 140, y: 60 },
        data: {
          label,
          nodeType: 'trigger',
          triggerEvent,
        },
      },
      {
        id: 'message_1',
        type: 'message',
        position: { x: 140, y: 220 },
        data: {
          label: 'Send Message',
          nodeType: 'message',
          messageBody: 'Hi {{profile_name}}, thanks for messaging MyFNG. How can we help?',
        },
      },
      {
        id: 'end_1',
        type: 'end',
        position: { x: 140, y: 380 },
        data: { label: 'End', nodeType: 'end', messageBody: '' },
      },
    ],
    edges: [
      { id: 'e1', source: 'trigger_1', target: 'message_1' },
      { id: 'e2', source: 'message_1', target: 'end_1' },
    ],
    viewport: { x: 0, y: 0, zoom: 1 },
  };
}
