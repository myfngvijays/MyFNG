import { NextRequest, NextResponse } from 'next/server';
import { logChatActivity } from '@/lib/chatbot_v2/telecrm';
import { handleChatError, logError } from '@/lib/chatbot_v2/error-handler';
import { runMisaAgent } from '@/lib/chatbot_v2/runAgent';
import { SYSTEM_PROMPT } from '@/lib/chatbot_v2/chatbot-system-prompt';
import { buildSessionContextPatch, getVerifiedPhoneFromSession, applyTrustedCustomerToSession } from '@/lib/chatbot_v2/verificationSession';
import { getSession, saveSession } from '@/lib/chatbot_v2/session';
import { getCustomerFromSession } from '@/lib/customer-session';
import { isPhoneVerifiedInSession } from '@/lib/chatbot_v2/bookingOtp';
import { buildLanguageStyleHint, detectUserLanguageStyle } from '@/lib/chatbot_v2/userLanguageStyle';
import { normalizeUtmParams } from '@/lib/utm';

export const dynamic = 'force-dynamic';

type V2Request = {
  message?: string;
  context?: Record<string, any>;
  session_id?: string;
};

function getSessionId(body: V2Request) {
  const fromBody = String(body?.session_id || '').trim();
  if (fromBody) return fromBody;

  const fromContext = String(body?.context?.conversationId || '').trim();
  if (fromContext) return fromContext;

  return `chat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => null)) as V2Request | null;
  const message = String(body?.message || '').trim();
  const sessionId = getSessionId(body || {});

  if (!sessionId || !message) {
    return NextResponse.json(
      {
        type: 'answer',
        intent: 'llm_managed',
        conversationId: sessionId,
        session_id: sessionId,
        response: 'Message missing hai.',
        message: 'Message missing hai.',
        assistantMessage: 'Message missing hai.',
        cta: 'Aapko kis cheez me help chahiye?',
        contextPatch: { conversationId: sessionId },
        data: { conversationId: sessionId, contextPatch: { conversationId: sessionId } },
      },
      { status: 400 }
    );
  }

  try {
    const isMobileClient = req.headers.get('x-mobile-client') === 'true';
    let sessionData = (await getSession(sessionId)) || { history: [], bookingState: {} };
    let loggedInCustomer: { phone: string; full_name?: string | null; id?: string } | null = null;

    const utmFromContext = normalizeUtmParams(body?.context?.utm || body?.context?.utmParams);
    if (Object.keys(utmFromContext).length > 0) {
      sessionData.bookingState = {
        ...(sessionData.bookingState || {}),
        trackingUtm: {
          ...(sessionData.bookingState?.trackingUtm || {}),
          ...utmFromContext,
        },
      };
      await saveSession(sessionId, sessionData);
    }

    if (isMobileClient) {
      const { customer } = await getCustomerFromSession();
      if (customer?.phone) {
        loggedInCustomer = {
          phone: customer.phone,
          full_name: customer.full_name,
          id: customer.id,
        };
        if (!isPhoneVerifiedInSession(sessionData, customer.phone)) {
          applyTrustedCustomerToSession(sessionData, loggedInCustomer);
          await saveSession(sessionId, sessionData);
        }
      }
    }

    const verifiedPhone = getVerifiedPhoneFromSession(sessionData);
    const sessionHintParts: string[] = [];
    if (verifiedPhone) {
      sessionHintParts.push(
        `[SESSION STATE: Mobile OTP already verified for ${verifiedPhone}. Do NOT ask for mobile number again. Proceed to get_service_pricing when service, car model, and PIN code are available.]`,
      );
    }
    if (loggedInCustomer) {
      const name = String(loggedInCustomer.full_name || '').trim();
      const ctxAddresses = Array.isArray(body?.context?.customerAddresses) ? body.context.customerAddresses : [];
      const savedPin = String(body?.context?.savedAddressPincode || ctxAddresses[0]?.pincode || '').trim();
      sessionHintParts.push(
        `[APP LOGGED-IN CUSTOMER: Phone ${loggedInCustomer.phone} is already verified via app login.${name ? ` Name: ${name}.` : ''} Do NOT ask for mobile number or OTP. Do NOT ask for customer name — use profile name.${savedPin ? ` Default PIN: ${savedPin}.` : ''}${ctxAddresses.length ? ' Customer has saved addresses in app — use them instead of asking PIN/address again unless they choose a new one.' : ''}]`,
      );
    }
    const sessionHint = sessionHintParts.length ? `\n\n${sessionHintParts.join('\n')}` : '';
    const languageHint = `\n\n${buildLanguageStyleHint(detectUserLanguageStyle(message))}`;

    const agent = await runMisaAgent({
      sessionId,
      message,
      systemPrompt: SYSTEM_PROMPT + sessionHint + languageHint,
      model: 'gpt-4o',
      bookingChannel: isMobileClient ? 'APP' : 'WEBSITE',
    });
    const finalResponse = agent.response;
    const contextPatch = buildSessionContextPatch(agent.sessionData, sessionId, {
      customerName: loggedInCustomer?.full_name || sessionData.bookingState?.customerName,
      isLoggedInCustomer: Boolean(loggedInCustomer),
      skipNamePrompt: Boolean(loggedInCustomer?.full_name),
      skipMobilePrompt: Boolean(loggedInCustomer),
    });

    void logChatActivity(sessionId, message, 'user').catch((err) => {
      logError('TeleCRM user message logging', err, { sessionId });
    });
    void logChatActivity(sessionId, finalResponse, 'bot').catch((err) => {
      logError('TeleCRM bot message logging', err, { sessionId });
    });

    return NextResponse.json({
      type: 'answer',
      conversationId: sessionId,
      session_id: sessionId,
      response: finalResponse,
      message: finalResponse,
      assistantMessage: finalResponse,
      cta: '',
      contextPatch,
      data: {
        conversationId: sessionId,
        contextPatch,
      },
      sources: [],
      intent: 'llm_managed',
      pricing: agent.pricing || [],
      ui: agent.workshops || undefined,
      workshops: agent.workshops?.items || [],
    });
  } catch (error) {
    return handleChatError(error, sessionId);
  }
}
