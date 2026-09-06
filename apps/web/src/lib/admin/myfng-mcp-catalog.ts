/** Catalog for Super Admin “MyFNG MCP” page — mirrors packages/myfng-mcp tools. */

export type McpToolArea =
  | 'CRM'
  | 'Calls'
  | 'Reports'
  | 'People'
  | 'Bookings'
  | 'System'
  | 'Safety';

export type McpToolDef = {
  name: string;
  area: McpToolArea;
  description: string;
};

export const MYFNG_MCP_META = {
  name: 'myfng-readonly',
  version: '1.0.0',
  mode: 'read-only' as const,
  packagePath: 'packages/myfng-mcp',
  entryBuilt: 'packages/myfng-mcp/dist/index.js',
  entryDev: 'packages/myfng-mcp/scripts/run-with-env.mjs',
  notes: [
    'SELECT / head counts only — no insert, update, or delete tools.',
    'PII (phone/email) masked by default via MYFNG_MCP_MASK_PII=true.',
    'Row cap via MYFNG_MCP_MAX_ROWS (default 50, max 100).',
    'Bookings = real statuses (BOOKING_CONFIRMED / IN_SERVICE / SERVICE_DONE…), not every new lead.',
    'This package is standalone. Claude.ai uses the public HTTPS URL /api/mcp with OAuth — not a local file path.',
  ],
};

export const MYFNG_MCP_TOOLS: McpToolDef[] = [
  { name: 'search_leads', area: 'CRM', description: 'Search leads by phone, name, lead #, status, city, telecaller' },
  { name: 'get_lead', area: 'CRM', description: 'Fetch one lead by id or lead_number' },
  { name: 'get_lead_timeline', area: 'CRM', description: 'Lead + call history timeline' },
  { name: 'list_lead_statuses', area: 'CRM', description: 'CRM statuses or distinct lead statuses' },
  { name: 'list_duplicates', area: 'CRM', description: 'Duplicate phones sample groups' },
  { name: 'get_pipeline_summary', area: 'CRM', description: 'Funnel counts by status for a period' },

  { name: 'search_call_logs', area: 'Calls', description: 'Filter telecaller_call_logs' },
  { name: 'get_call', area: 'Calls', description: 'Single call log by id' },
  { name: 'get_recordings', area: 'Calls', description: 'Calls that have recording URLs' },
  { name: 'get_call_intelligence', area: 'Calls', description: 'telecaller_call_analyses rows including Call IQ SOP audit' },
  { name: 'get_dial_sessions', area: 'Calls', description: 'smartflo_dial_sessions list' },
  { name: 'get_telecaller_activity', area: 'Calls', description: 'Day summary for one telecaller' },

  { name: 'get_leaderboard', area: 'Reports', description: 'Live scoreboard from call logs' },
  { name: 'get_call_activity', area: 'Reports', description: 'Activity + hourly IST buckets' },
  { name: 'get_team_performance', area: 'Reports', description: 'Dialed vs idle telecallers' },
  { name: 'compare_periods', area: 'Reports', description: 'Current vs previous window deltas' },

  { name: 'list_telecallers', area: 'People', description: 'Active TELECALLER users' },
  { name: 'get_telecaller', area: 'People', description: 'One telecaller profile' },
  { name: 'get_assignments', area: 'People', description: 'Assigned leads sample' },
  { name: 'get_shift_summary', area: 'People', description: 'Today IST shift snapshot' },

  { name: 'search_bookings', area: 'Bookings', description: 'Booked/confirmed/done leads' },
  { name: 'get_booking', area: 'Bookings', description: 'One booking-like lead' },
  { name: 'list_workshops', area: 'Bookings', description: 'Workshop directory' },
  { name: 'get_job_status', area: 'Bookings', description: 'mechanic_jobs by id / lead' },

  { name: 'get_system_monitor', area: 'System', description: 'Critical table ping + counts' },
  { name: 'check_env_status', area: 'System', description: 'Which env keys are present (no secrets)' },
  { name: 'list_recent_errors', area: 'System', description: 'Failed/missed calls + open dial sessions' },

  { name: 'describe_schema', area: 'Safety', description: 'Allowlisted tables this MCP can read' },
  { name: 'run_readonly_query', area: 'Safety', description: 'Equality-filter SELECT on allowlisted tables only' },
];

export const MYFNG_MCP_AREAS = [
  'CRM',
  'Calls',
  'Reports',
  'People',
  'Bookings',
  'System',
  'Safety',
] as const satisfies readonly McpToolArea[];
