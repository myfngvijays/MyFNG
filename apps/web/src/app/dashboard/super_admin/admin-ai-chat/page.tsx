'use client';

import { FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import { Bot, Loader2, MessageSquare, Plus, Search, SendHorizonal } from 'lucide-react';

type AdminChatRole = 'user' | 'assistant';
type AdminChatMessage = {
  id: string;
  conversationId: string;
  role: AdminChatRole;
  text: string;
  at: string;
};

function nowIso() {
  return new Date().toISOString();
}

type ConversationRow = {
  id: string;
  title: string;
  preview: string;
  lastMessageAt: string;
  messageCount: number;
};

type ModelOption = {
  id: string;
  label: string;
};

const FALLBACK_MODEL_OPTIONS: ModelOption[] = [
  { id: 'gpt-4o-mini', label: 'GPT-4o mini (default)' },
  { id: 'gpt-4o', label: 'GPT-4o' },
];

export default function SuperAdminAIChatPage() {
  const [conversations, setConversations] = useState<ConversationRow[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string>('');
  const [messages, setMessages] = useState<AdminChatMessage[]>([]);
  const [search, setSearch] = useState('');
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [input, setInput] = useState('');
  const [modelOptions, setModelOptions] = useState<ModelOption[]>(FALLBACK_MODEL_OPTIONS);
  const [selectedModel, setSelectedModel] = useState<string>('gpt-4o-mini');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [activeToolTrace, setActiveToolTrace] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const loadConversations = async (searchTerm: string) => {
    setLoadingConversations(true);
    try {
      const res = await fetch(
        `/api/super_admin/admin-ai-chat/conversations?search=${encodeURIComponent(searchTerm || '')}`
      );
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load conversations');
      const rows = Array.isArray(json?.conversations) ? json.conversations : [];
      setConversations(rows);
      if (!activeConversationId && rows[0]?.id) {
        setActiveConversationId(String(rows[0].id));
      }
    } catch (e: any) {
      setError(e?.message || 'Failed to load conversations');
    } finally {
      setLoadingConversations(false);
    }
  };

  const loadConversationMessages = async (conversationId: string) => {
    if (!conversationId) return;
    setLoadingMessages(true);
    setError('');
    try {
      const res = await fetch(`/api/super_admin/admin-ai-chat/conversations/${encodeURIComponent(conversationId)}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load messages');
      const rows = Array.isArray(json?.messages) ? json.messages : [];
      setMessages(
        rows.map((m: any) => ({
          id: String(m?.id || `${conversationId}_${Math.random().toString(36).slice(2, 7)}`),
          conversationId,
          role: m?.role === 'user' ? 'user' : 'assistant',
          text: String(m?.text || ''),
          at: String(m?.createdAt || nowIso()),
        }))
      );
    } catch (e: any) {
      setError(e?.message || 'Failed to load messages');
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadConversations('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const t = setTimeout(() => {
      loadConversations(search);
    }, 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  useEffect(() => {
    if (activeConversationId) {
      loadConversationMessages(activeConversationId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeConversationId]);

  useEffect(() => {
    const loadModels = async () => {
      try {
        const res = await fetch('/api/super_admin/admin-ai-chat/models');
        const json = await res.json().catch(() => ({}));
        if (!res.ok) return;
        const rows = Array.isArray(json?.models) ? json.models : [];
        const parsed = rows
          .map((row: any) => ({
            id: String(row?.id || '').trim(),
            label: String(row?.label || row?.id || '').trim(),
          }))
          .filter((row: ModelOption) => row.id);
        if (parsed.length > 0) {
          setModelOptions(parsed);
          setSelectedModel((prev) => (parsed.some((m: ModelOption) => m.id === prev) ? prev : parsed[0].id));
        }
      } catch {
        // keep fallback models
      }
    };
    loadModels();
  }, []);

  useEffect(() => {
    try {
      const saved = localStorage.getItem('myfng_admin_ai_selected_model');
      if (saved && modelOptions.some((m) => m.id === saved)) {
        setSelectedModel(saved);
      }
    } catch {
      // ignore
    }
  }, [modelOptions]);

  useEffect(() => {
    try {
      localStorage.setItem('myfng_admin_ai_selected_model', selectedModel);
    } catch {
      // ignore
    }
  }, [selectedModel]);

  const canSend = useMemo(() => input.trim().length > 0 && !sending, [input, sending]);

  const createNewChat = () => {
    setActiveConversationId('');
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        conversationId: '',
        role: 'assistant',
        text: 'New chat started. Ask anything about calls, leads, workshop ops, finance, users, or table/column meanings.',
        at: nowIso(),
      },
    ]);
    setInput('');
    setError('');
    setActiveToolTrace([]);
  };

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || sending) return;
    setError('');

    const currentConversationId = activeConversationId;
    const userMsg: AdminChatMessage = {
      id: `u_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
      conversationId: currentConversationId,
      role: 'user',
      text,
      at: nowIso(),
    };
    const nextMessages = [...messages.filter((m) => m.id !== 'welcome'), userMsg];
    setMessages(nextMessages);
    setInput('');
    setSending(true);

    try {
      const res = await fetch('/api/super_admin/admin-ai-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          conversationId: currentConversationId || undefined,
          model: selectedModel,
        }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to get AI response');
      const returnedConversationId = String(json?.conversationId || currentConversationId || '');
      if (returnedConversationId && returnedConversationId !== activeConversationId) {
        setActiveConversationId(returnedConversationId);
      }
      const assistantText = String(json?.reply || '').trim() || 'I could not generate a response.';
      const trace = Array.isArray(json?.toolTrace)
        ? json.toolTrace.map((t: any) => `${String(t?.tool || 'unknown')}${t?.ok ? '' : ' (error)'}`)
        : [];
      setActiveToolTrace(trace);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
          conversationId: returnedConversationId,
          role: 'assistant',
          text: assistantText,
          at: nowIso(),
        },
      ]);
      loadConversations(search);
    } catch (err: any) {
      const msg = err?.message || 'Failed to send message';
      setError(msg);
      setMessages((prev) => [
        ...prev,
        {
          id: `a_${Date.now()}_${Math.random().toString(16).slice(2, 7)}`,
          conversationId: currentConversationId,
          role: 'assistant',
          text: 'Error: response generate nahi ho paya. Please retry.',
          at: nowIso(),
        },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="p-4 sm:p-6 h-full min-h-screen bg-gray-50">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Admin AI Chat</h1>
          <p className="text-sm text-gray-600 mt-1">Independent assistant for Super Admin operations.</p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedModel}
            onChange={(e) => setSelectedModel(e.target.value)}
            className="rounded-lg border bg-white px-2.5 py-2 text-xs sm:text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
            title="Switch model"
          >
            {modelOptions.map((model) => (
              <option key={model.id} value={model.id}>
                {model.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={createNewChat}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg border bg-white hover:bg-gray-50 text-sm"
          >
            <Plus className="w-4 h-4" />
            New Chat
          </button>
        </div>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden h-[calc(100vh-160px)] min-h-0 grid grid-cols-1 md:grid-cols-[320px_1fr]">
        <aside className="border-r border-gray-200 bg-gray-50/60 h-full min-h-0 flex flex-col">
          <div className="p-3 border-b border-gray-200">
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chat history..."
                className="w-full rounded-lg border border-gray-200 bg-white pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain">
            {loadingConversations ? (
              <div className="p-3 text-xs text-gray-500 flex items-center gap-2">
                <Loader2 className="w-3 h-3 animate-spin" />
                Loading conversations...
              </div>
            ) : conversations.length === 0 ? (
              <div className="p-4 text-xs text-gray-500">No previous conversation found.</div>
            ) : (
              conversations.map((c) => {
                const isActive = c.id === activeConversationId;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setActiveConversationId(c.id)}
                    className={`w-full text-left px-3 py-2.5 border-b border-gray-100 hover:bg-white ${
                      isActive ? 'bg-white' : ''
                    }`}
                  >
                    <div className="text-sm font-semibold text-gray-900 truncate">{c.title || 'New chat'}</div>
                    <div className="text-xs text-gray-500 truncate mt-0.5">{c.preview || 'No preview'}</div>
                    <div className="text-[11px] text-gray-400 mt-1">{new Date(c.lastMessageAt).toLocaleString('en-IN')}</div>
                  </button>
                );
              })
            )}
          </div>
        </aside>

        <main className="h-full min-h-0 flex flex-col">
          <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-4 bg-gray-50">
            {loadingMessages ? (
              <div className="text-xs text-gray-500 flex items-center gap-2">
                <Loader2 className="w-4 h-4 animate-spin" />
                Loading messages...
              </div>
            ) : null}
            {messages.map((m) => (
              <div key={m.id} className={`mb-3 ${m.role === 'user' ? 'flex justify-end' : 'flex'}`}>
                {m.role === 'assistant' ? (
                  <div className="w-8 h-8 mr-2 rounded-full bg-brand-primary/10 flex items-center justify-center flex-shrink-0">
                    <Bot className="w-4 h-4 text-brand-primary" />
                  </div>
                ) : null}
                <div
                  className={
                    m.role === 'user'
                      ? 'max-w-[88%] rounded-2xl rounded-tr-none px-3 py-2 text-sm text-white bg-brand-primary'
                      : 'max-w-[88%] rounded-2xl rounded-tl-none px-3 py-2 text-sm text-gray-800 bg-white border border-gray-200'
                  }
                >
                  {m.text.split('\n').map((line, idx) => (
                    <div key={idx}>{line}</div>
                  ))}
                </div>
              </div>
            ))}
            {sending ? (
              <div className="flex items-center gap-2 text-xs text-gray-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                Generating response...
              </div>
            ) : null}
            {activeToolTrace.length > 0 ? (
              <div className="mt-2 inline-flex items-center gap-2 rounded-lg border border-gray-200 bg-white px-2.5 py-1 text-[11px] text-gray-600">
                <MessageSquare className="w-3 h-3" />
                Model: {selectedModel} | Tools: {activeToolTrace.join(', ')}
              </div>
            ) : null}
          </div>

          <form
            onSubmit={(e: FormEvent) => {
              e.preventDefault();
              void sendMessage();
            }}
            className="border-t p-3 bg-white"
          >
            {error ? <div className="mb-2 text-xs text-red-600">{error}</div> : null}
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask admin query (reports, RSA, users, finance...)"
                className="flex-1 border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-primary/30"
              />
              <button
                type="button"
                onClick={() => {
                  void sendMessage();
                }}
                disabled={!canSend}
                className="inline-flex items-center justify-center rounded-xl px-3 py-2 bg-brand-primary text-white disabled:opacity-50"
              >
                <SendHorizonal className="w-4 h-4" />
              </button>
            </div>
          </form>
        </main>
      </div>
    </div>
  );
}
