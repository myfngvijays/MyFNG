import { CHATBOT_TOOLS } from '@/lib/chatbot_v2/chatbot-tools';
import type { AgentTools } from '../shared/types';

const TOOL_GROUPS: Record<keyof AgentTools, string[]> = {
  pricing: ['get_service_pricing', 'validate_pincode'],
  workshops: ['search_workshops'],
  service_details: ['get_service_details'],
  booking: ['send_booking_otp', 'verify_booking_otp', 'create_booking'],
};

export function filterBookingTools(toolsConfig: AgentTools) {
  const allowed = new Set<string>();
  (Object.keys(TOOL_GROUPS) as Array<keyof AgentTools>).forEach((key) => {
    if (!toolsConfig[key]) return;
    TOOL_GROUPS[key].forEach((toolName) => allowed.add(toolName));
  });
  return CHATBOT_TOOLS.filter((tool) => allowed.has(tool.function.name));
}
