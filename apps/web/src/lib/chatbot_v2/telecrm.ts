const TELECRM_BASE_URL = 'https://api.telecrm.in/v1';
const TELECRM_API_KEY = process.env.TELECRM_API_KEY;

export async function logChatActivity(leadId: string, message: string, direction: 'user' | 'bot') {
  if (!TELECRM_API_KEY) return true;

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
