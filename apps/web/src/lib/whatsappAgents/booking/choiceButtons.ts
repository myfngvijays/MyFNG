import { sendReplyButtonsMessage } from '@/lib/services/whatsappService';
import { archiveAgentOutboundMessage } from '../shared/outbound';
import { isGreetingMessage } from './intent';

export const MISA_TALK_BUTTON_ID = 'misa_talk';
export const MISA_HUMAN_BUTTON_ID = 'misa_human';
export const CUSTOMER_HUMAN_REQUEST_MARKER = '[CUSTOMER_HUMAN_REQUEST]';

export const MISA_CHOICE_BODY =
  "Hi! I'm MISA AI — MyFNG Instant Service Assistant.\n\nWant to book or ask about car service with MISA, or talk to a human agent?";

export function parseMisaChoice(message: string): 'misa' | 'human' | null {
  const t = String(message || '')
    .trim()
    .toLowerCase();
  if (!t) return null;
  if (
    t === MISA_TALK_BUTTON_ID ||
    t === 'talk to misa' ||
    t === 'talk to misa ai' ||
    t === 'misa se baat'
  ) {
    return 'misa';
  }
  if (
    t === MISA_HUMAN_BUTTON_ID ||
    t === 'human agent' ||
    t === 'assign a human agent' ||
    t === 'assign human agent'
  ) {
    return 'human';
  }
  return null;
}

export function wantsHumanHelp(message: string): boolean {
  const t = String(message || '')
    .trim()
    .toLowerCase();
  if (!t) return false;
  if (parseMisaChoice(t) === 'human') return true;
  const needles = [
    'callback',
    'call back',
    'call me',
    'arrange call',
    'talk to human',
    'speak to someone',
    'speak to a person',
    'customer care',
    'at service center',
    'at the service center',
    'in the service center',
    'at workshop',
    'at the workshop',
    'human agent',
    'connect me to',
    'need an agent',
    'need a person',
  ];
  return needles.some((n) => t.includes(n));
}

export function shouldOfferMisaOrHumanChoice(
  message: string,
  misaChoice: string | null | undefined,
): boolean {
  if (parseMisaChoice(message)) return false;
  if (wantsHumanHelp(message)) return true;
  if (misaChoice === 'misa') return false;
  return isGreetingMessage(message) || !misaChoice;
}

export async function sendMisaOrHumanChoiceButtons(phone: string): Promise<boolean> {
  const result = await sendReplyButtonsMessage({
    phoneNumber: phone,
    body: MISA_CHOICE_BODY,
    buttons: [
      { id: MISA_TALK_BUTTON_ID, title: 'Talk to MISA' },
      { id: MISA_HUMAN_BUTTON_ID, title: 'Human agent' },
    ],
    footer: 'Tap a button to continue',
  });
  await archiveAgentOutboundMessage({
    phone,
    text: MISA_CHOICE_BODY,
    sendResult: result,
    source: 'whatsapp_booking_agent',
    meta: { route: 'MISA_CHOICE_BUTTONS', interactive: 'buttons' },
  });
  return result.success;
}
