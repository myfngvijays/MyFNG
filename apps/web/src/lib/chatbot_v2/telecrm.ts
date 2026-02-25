const TELECRM_BASE_URL = 'https://api.telecrm.in/v1';
const TELECRM_API_KEY = process.env.TELECRM_API_KEY;

export async function createOrUpdateLead(name: string, phone: string, email?: string) {
  if (!TELECRM_API_KEY) {
    console.log('[Mock TeleCRM] Creating Lead:', { name, phone });
    return { id: 'mock_lead_123', status: 'success' };
  }

  const response = await fetch(`${TELECRM_BASE_URL}/leads`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TELECRM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ name, phone, email, source: 'Nexaura Chatbot' }),
  });

  if (!response.ok) {
    console.error('TeleCRM Error:', await response.text());
    return null;
  }
  return await response.json();
}

export async function logChatActivity(leadId: string, message: string, direction: 'user' | 'bot') {
  if (!TELECRM_API_KEY) {
    console.log(`[Mock TeleCRM] Logging ${direction} message for ${leadId}: ${message}`);
    return true;
  }

  const response = await fetch(`${TELECRM_BASE_URL}/leads/${leadId}/timeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TELECRM_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      type: 'note',
      text: `[${direction.toUpperCase()}] ${message}`,
      direction: direction === 'bot' ? 'outbound' : 'inbound',
    }),
  });

  return response.ok;
}
