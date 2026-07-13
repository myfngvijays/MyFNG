'use client';

import AgentConfigPanel from './AgentConfigPanel';

export default function BookingAgentPanel() {
  return (
    <AgentConfigPanel
      agentType="BOOKING"
      title="Booking Bot"
      subtitle="Handles inbound WhatsApp conversations to complete service bookings. Uses MISA tools for pricing and booking."
      showTools
    />
  );
}
