'use client';

import AgentConfigPanel from './AgentConfigPanel';

export default function BookingAgentPanel() {
  return (
    <AgentConfigPanel
      agentType="BOOKING"
      title="MISA AI"
      subtitle="MyFNG Instant Service Assistant — handles inbound WhatsApp conversations to complete service bookings."
      showTools
    />
  );
}
