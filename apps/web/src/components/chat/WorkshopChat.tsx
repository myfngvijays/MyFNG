'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

type ChatButton = {
  id: string;
  label: string;
  variant?: 'primary' | 'secondary' | 'danger';
  action: { type: string; payload?: any };
};

type ChatMessage = {
  id: string;
  from: 'system' | 'user';
  text: string;
};

type ChatSession = {
  activeLeadId?: string | null;
  step?: string;
  draft?: Record<string, any>;
};

type ChatResponse = {
  ok: boolean;
  roleCode?: string;
  tookMs?: number;
  session?: ChatSession;
  messages?: ChatMessage[];
  buttons?: ChatButton[];
  error?: string;
  details?: string;
};

const STORAGE_KEY = 'myfng:workshopChatSession';

function btnClass(variant?: string) {
  if (variant === 'primary') return 'bg-blue-600 text-white hover:bg-blue-700';
  if (variant === 'danger') return 'bg-red-600 text-white hover:bg-red-700';
  return 'bg-white text-gray-800 hover:bg-gray-50 border border-gray-200';
}

export default function WorkshopChat() {
  const [session, setSession] = useState<ChatSession>({ activeLeadId: null, step: 'idle', draft: {} });
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [buttons, setButtons] = useState<ChatButton[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);

  const canSend = useMemo(() => !loading, [loading]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === 'object') setSession(parsed);
      }
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    } catch {
      // ignore
    }
  }, [session]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, buttons, loading]);

  const callChat = useCallback(
    async (payload: { input?: string; action?: { type: string; payload?: any } }) => {
      setLoading(true);
      try {
        const res = await fetch('/api/workshop/chat', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ ...payload, session }),
        });
        const data = (await res.json().catch(() => ({}))) as ChatResponse;
        if (!res.ok || data?.ok === false) {
          setMessages((prev) => [
            ...prev,
            { id: `err_${Date.now()}`, from: 'system', text: data?.error || 'Something went wrong.' },
          ]);
          return;
        }

        if (data.session) setSession(data.session);
        if (Array.isArray(data.messages) && data.messages.length) {
          setMessages((prev) => [...prev, ...data.messages!]);
        }
        setButtons(Array.isArray(data.buttons) ? data.buttons! : []);
      } finally {
        setLoading(false);
      }
    },
    [session]
  );

  useEffect(() => {
    // Initial bootstrap
    if (!messages.length) {
      callChat({});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onSend = async () => {
    const text = input.trim();
    if (!text || !canSend) return;
    setInput('');
    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, from: 'user', text }]);
    await callChat({ input: text });
  };

  const onButton = async (b: ChatButton) => {
    if (!canSend) return;
    // Echo selection in chat
    setMessages((prev) => [...prev, { id: `u_${Date.now()}`, from: 'user', text: b.label }]);
    await callChat({ action: b.action });
  };

  const onReset = () => {
    setSession({ activeLeadId: null, step: 'idle', draft: {} });
    setMessages([]);
    setButtons([]);
    setInput('');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore
    }
    setTimeout(() => callChat({}), 0);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-4">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Workshop Chat</h1>
          <p className="text-sm text-gray-600">
            Guided steps + buttons. Active lead: <span className="font-medium">{session.activeLeadId || '—'}</span>
          </p>
        </div>
        <button
          onClick={onReset}
          className="px-3 py-2 rounded-lg text-sm bg-gray-100 hover:bg-gray-200 text-gray-800"
          type="button"
        >
          Reset
        </button>
      </div>

      <div className="bg-white border border-gray-200 rounded-xl shadow-sm">
        <div className="h-[520px] overflow-y-auto p-4 space-y-3">
          {messages.map((m) => (
            <div key={m.id} className={m.from === 'user' ? 'flex justify-end' : 'flex justify-start'}>
              <div
                className={[
                  'max-w-[85%] whitespace-pre-wrap rounded-2xl px-4 py-2 text-sm',
                  m.from === 'user'
                    ? 'bg-blue-600 text-white rounded-br-md'
                    : 'bg-gray-100 text-gray-900 rounded-bl-md',
                ].join(' ')}
              >
                {m.text}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="bg-gray-100 text-gray-700 rounded-2xl rounded-bl-md px-4 py-2 text-sm">
                Typing...
              </div>
            </div>
          )}
          <div ref={endRef} />
        </div>

        {buttons.length > 0 && (
          <div className="border-t border-gray-200 p-3 flex flex-wrap gap-2">
            {buttons.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => onButton(b)}
                className={`px-3 py-2 rounded-lg text-sm transition ${btnClass(b.variant)}`}
              >
                {b.label}
              </button>
            ))}
          </div>
        )}

        <div className="border-t border-gray-200 p-3 flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSend();
            }}
            placeholder="Type here (reason/notes/search)..."
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-200"
            disabled={loading}
          />
          <button
            onClick={onSend}
            disabled={loading}
            className="px-4 py-2 rounded-lg text-sm bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-60"
            type="button"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  );
}

