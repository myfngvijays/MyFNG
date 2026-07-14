'use client';

import { useMemo, useRef, useState } from 'react';
import { FlaskConical, RotateCcw, Send } from 'lucide-react';
import toast from 'react-hot-toast';

type ChatTurn = {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  meta?: string;
};

function testBookingSessionId(phone: string) {
  const digits = String(phone || '').replace(/\D/g, '').slice(-10);
  return `wa_booking_${digits}`;
}

function newTestSessionId(phone: string) {
  return `${testBookingSessionId(phone)}_test_${Date.now()}`;
}

export default function BookingAgentTestModal({
  title,
  onClose,
}: {
  title: string;
  onClose: () => void;
}) {
  const [testPhone, setTestPhone] = useState('9999999999');
  const [sessionId, setSessionId] = useState(() => newTestSessionId('9999999999'));
  const [input, setInput] = useState('');
  const [turns, setTurns] = useState<ChatTurn[]>([]);
  const [loading, setLoading] = useState(false);
  const [resetting, setResetting] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const canSend = useMemo(() => input.trim().length > 0 && !loading, [input, loading]);

  const scrollToBottom = () => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    });
  };

  const resetConversation = async () => {
    setResetting(true);
    try {
      const res = await fetch('/api/whatsapp/agents/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: 'BOOKING',
          phone: testPhone,
          session_id: sessionId,
          reset_session: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Reset failed');
      setTurns([]);
      setInput('');
      setSessionId(newTestSessionId(testPhone));
      toast.success('Conversation reset');
    } catch (error: any) {
      toast.error(error?.message || 'Reset failed');
    } finally {
      setResetting(false);
    }
  };

  const sendMessage = async () => {
    const message = input.trim();
    if (!message || loading) return;

    const userTurn: ChatTurn = {
      id: `u-${Date.now()}`,
      role: 'user',
      content: message,
    };
    setTurns((prev) => [...prev, userTurn]);
    setInput('');
    setLoading(true);
    scrollToBottom();

    try {
      const res = await fetch('/api/whatsapp/agents/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_type: 'BOOKING',
          phone: testPhone,
          session_id: sessionId,
          customer_message: message,
          persist_session: true,
        }),
      });
      const json = await res.json();
      if (!res.ok || !json?.success) throw new Error(json?.error || 'Test failed');

      const metaParts: string[] = [];
      if (json.booking_created) metaParts.push('Booking created');
      if (Array.isArray(json.pricing) && json.pricing.length > 0) {
        metaParts.push(`${json.pricing.length} pricing plans`);
      }
      if (json.latency_ms) metaParts.push(`${json.latency_ms}ms`);

      const botTurn: ChatTurn = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: String(json.reply || json.skipped_reason || 'No reply'),
        meta: metaParts.length > 0 ? metaParts.join(' · ') : undefined,
      };
      setTurns((prev) => [...prev, botTurn]);
      scrollToBottom();
    } catch (error: any) {
      toast.error(error?.message || 'Test failed');
      setTurns((prev) => [
        ...prev,
        {
          id: `e-${Date.now()}`,
          role: 'assistant',
          content: `Error: ${error?.message || 'Test failed'}`,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex h-[min(90vh,720px)] w-full max-w-2xl flex-col rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between border-b px-5 py-4">
          <div>
            <h3 className="text-lg font-bold text-gray-900">Test {title}</h3>
            <p className="text-xs text-gray-500 mt-0.5">
              MISA AI — multi-turn dry-run. Session persists until Reset. No WhatsApp send.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={resetConversation}
              disabled={resetting || loading}
              className="inline-flex items-center rounded-lg border px-2.5 py-1.5 text-xs font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-60"
            >
              <RotateCcw className={`mr-1 h-3.5 w-3.5 ${resetting ? 'animate-spin' : ''}`} />
              Reset
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-sm font-semibold text-gray-500 hover:text-gray-800"
            >
              Close
            </button>
          </div>
        </div>

        <div className="border-b px-5 py-3">
          <label className="mb-1 block text-xs font-semibold text-gray-500">Test phone</label>
          <input
            value={testPhone}
            onChange={(e) => setTestPhone(e.target.value.replace(/\D/g, '').slice(-10))}
            className="w-full rounded-lg border px-3 py-2 text-sm font-mono"
            placeholder="9999999999"
          />
          <p className="mt-1 text-[10px] text-gray-400 font-mono truncate">Session: {sessionId}</p>
        </div>

        <div ref={scrollRef} className="flex-1 overflow-y-auto bg-slate-50 px-4 py-4 space-y-3">
          {turns.length === 0 ? (
            <div className="rounded-lg border border-dashed bg-white p-4 text-sm text-gray-500">
              Start a booking conversation below. Try: &quot;Hi, Swift periodic service 400001&quot; then reply
              step by step. Dry-run OTP: use <span className="font-mono">000000</span> after send_booking_otp.
            </div>
          ) : (
            turns.map((turn) => (
              <div
                key={turn.id}
                className={`flex ${turn.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm whitespace-pre-wrap ${
                    turn.role === 'user'
                      ? 'bg-blue-600 text-white rounded-br-md'
                      : 'bg-white border text-gray-800 rounded-bl-md shadow-sm'
                  }`}
                >
                  {turn.content}
                  {turn.meta ? (
                    <p className={`mt-1 text-[10px] ${turn.role === 'user' ? 'text-blue-100' : 'text-gray-400'}`}>
                      {turn.meta}
                    </p>
                  ) : null}
                </div>
              </div>
            ))
          )}
          {loading ? (
            <div className="flex justify-start">
              <div className="rounded-2xl border bg-white px-3 py-2 text-sm text-gray-500 shadow-sm">
                MISA AI is typing...
              </div>
            </div>
          ) : null}
        </div>

        <div className="border-t px-4 py-3">
          <div className="flex gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  void sendMessage();
                }
              }}
              rows={2}
              placeholder="Type customer message... (Enter to send)"
              className="min-h-[44px] flex-1 resize-none rounded-lg border px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={sendMessage}
              disabled={!canSend}
              className="inline-flex h-[44px] items-center self-end rounded-lg bg-blue-600 px-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? (
                <FlaskConical className="h-4 w-4 animate-pulse" />
              ) : (
                <Send className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
