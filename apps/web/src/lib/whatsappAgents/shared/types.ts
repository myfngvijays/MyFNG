export type AgentType = 'BOOKING' | 'FOLLOWUP' | 'CHASE';

export type AgentStatus = 'ACTIVE' | 'WAITING' | 'PAUSED' | 'ESCALATED' | 'ENDED';

export type AgentActionType =
  | 'SEND_MESSAGE'
  | 'WAIT'
  | 'UPDATE_CRM'
  | 'ASSIGN_TO_HUMAN'
  | 'BOOK_APPOINTMENT'
  | 'END_CONVERSATION'
  | 'ACTIVATE_BOOKING_BOT';

export type AgentEventType =
  | 'NEW_LEAD'
  | 'CUSTOMER_REPLY'
  | 'SCHEDULED_WAKEUP'
  | 'CRM_UPDATE'
  | 'MANUAL_TRIGGER'
  | 'ACTIVATE_BOOKING_BOT'
  | 'FOLLOWUP_TRIGGER';

export type ExecutionStatus = 'EXECUTED' | 'BLOCKED' | 'FAILED' | 'SKIPPED';

export type BuyingIntent = 'HIGH' | 'MEDIUM' | 'LOW' | 'NONE';
export type Sentiment = 'POSITIVE' | 'NEUTRAL' | 'NEGATIVE' | 'ANGRY';

export type BusinessHours = {
  start: string;
  end: string;
  timezone: string;
};

export type AgentRules = {
  max_follow_ups: number;
  min_wait_hours: number;
  max_daily_messages: number;
  business_hours: BusinessHours;
  allowed_languages: string[];
  confidence_threshold: number;
  blocked_words: string[];
  dnd_hours: { start: string; end: string };
  escalation_keywords: string[];
  skip_assigned_chats: boolean;
};

export type AgentTools = {
  pricing: boolean;
  workshops: boolean;
  service_details: boolean;
  booking: boolean;
};

export type TelecrmSyncConfig = {
  on_booking?: { disposition: string; disposition_category: string };
  on_escalation?: { disposition: string; disposition_category: string };
  on_end_max_attempts?: { disposition: string; disposition_category: string };
};

export type TelecrmDispositionRule = {
  id: string;
  disposition: string;
  enabled?: boolean;
  match_mode?: 'exact' | 'contains';
  trigger_on?: 'new_lead' | 'disposition_change' | 'both';
  bot?: 'CHASE' | 'FOLLOWUP' | 'NONE';
  message_mode?: 'ai' | 'fixed' | 'template' | 'skip';
  message?: string;
  template_name?: string;
  template_language?: string;
  ai_prompt_addon?: string;
  end_active_bots?: boolean;
};

export type AgentConfig = {
  agent_type: AgentType;
  enabled: boolean;
  model: 'gpt-4o' | 'gpt-4o-mini';
  goal_prompt: string;
  system_prompt_addon: string;
  fallback_message: string;
  rules_json: AgentRules;
  triggers_json: Record<string, unknown>;
  tools_json: AgentTools;
  telecrm_sync_json: TelecrmSyncConfig;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type AgentDecision = {
  action: AgentActionType;
  message?: string;
  wait_hours?: number;
  wait_days?: number;
  crm_fields?: Record<string, string>;
  assign_reason?: string;
  booking_details?: Record<string, unknown>;
  end_reason?: string;
  confidence: number;
  reason: string;
};

export type RuleValidationResult = {
  passed: boolean;
  checks: string[];
  block_reason?: string;
};

export type AgentInstance = {
  id: string;
  agent_type: AgentType;
  phone: string;
  lead_id: string | null;
  telecrm_id: string | null;
  status: AgentStatus;
  goal: string | null;
  follow_up_count: number;
  last_action_at: string | null;
  last_customer_reply_at: string | null;
  next_wakeup_at: string | null;
  escalated_at: string | null;
  escalated_to: string | null;
  ended_at: string | null;
  end_reason: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type AgentMemory = {
  instance_id: string;
  lead_details: Record<string, unknown>;
  conversation_summary: string;
  buying_intent: BuyingIntent;
  sentiment: Sentiment;
  customer_preferences: Record<string, unknown>;
  sent_messages: unknown[];
  crm_snapshot: Record<string, unknown>;
  extra: Record<string, unknown>;
  updated_at: string;
};

export type AgentRuntime = {
  openai_configured: boolean;
  whatsapp_configured: boolean;
  active_instances: number;
};

export type AgentRunInput = {
  agentType: AgentType;
  phone: string;
  eventType: AgentEventType;
  instanceId?: string;
  leadId?: string | null;
  telecrmId?: string | null;
  customerMessage?: string;
  dryRun?: boolean;
  mockMemory?: Partial<AgentMemory>;
  mockCrm?: Record<string, unknown>;
  force?: boolean;
};

export type AgentRunResult = {
  handled: boolean;
  skippedReason?: string;
  decision?: AgentDecision;
  validation?: RuleValidationResult;
  wouldExecute?: boolean;
  executionStatus?: ExecutionStatus;
  sendError?: string;
  messageSent?: boolean;
  instanceId?: string;
  latencyMs?: number;
};
