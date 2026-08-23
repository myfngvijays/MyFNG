import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { registerBookingsTools } from './bookings.js';
import { registerCallsTools } from './calls.js';
import { registerCrmTools } from './crm.js';
import { registerPeopleTools } from './people.js';
import { registerReportsTools } from './reports.js';
import { registerSafetyTools } from './safety.js';
import { registerSystemTools } from './system.js';

export function registerAllTools(server: McpServer) {
  registerCrmTools(server);
  registerCallsTools(server);
  registerReportsTools(server);
  registerPeopleTools(server);
  registerBookingsTools(server);
  registerSystemTools(server);
  registerSafetyTools(server);
}
