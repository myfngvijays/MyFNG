'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Search,
  RefreshCcw,
  CheckCircle2,
  XCircle,
  PlusCircle,
  Save,
  MessageSquare,
  Bot,
  User,
  Phone,
  Car,
  MapPin,
  Wrench,
  Loader2,
  Clock,
} from 'lucide-react';
import { renderChatMessageLine } from '@/lib/chatbot_v2/renderChatMessage';

// ── KB Inbox types (unchanged logic) ──

type Status = 'new' | 'triaged' | 'answered' | 'added_to_kb' | 'ignored';

type KbQuestionEvent = {
  id: string;
  conversation_id?: string | null;
  user_message: string;
  assistant_message?: string | null;
  intent?: any;
  context?: any;
  status: Status;
  triage_notes?: string | null;
  resolved_answer?: string | null;
  created_at: string;
  updated_at: string;
};

// ── Chat Session types ──

type ChatMessage = { role: string; content: string };

type ChatSession = {
  session_id: string;
  expires_at: string;
  message_count: number;
  first_user_message: string;
  last_message_role: string | null;
  last_message_preview: string;
  has_booking: boolean;
  customer_name: string | null;
  phone_number: string | null;
  car_model: string | null;
  city: string | null;
  service: string | null;
  history: ChatMessage[];
};

const SESSION_TTL_MS = 24 * 60 * 60 * 1000;

function getSessionActivityTime(expiresAt: string) {
  const expiresMs = new Date(expiresAt).getTime();
  if (!Number.isFinite(expiresMs)) return null;
  return new Date(expiresMs - SESSION_TTL_MS);
}

function fmt(dt: string) {
  try {
    return new Date(dt).toLocaleString('en-IN', {
      day: '2-digit',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dt;
  }
}

function timeAgo(dt: string) {
  try {
    const diff = Date.now() - new Date(dt).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'just now';
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    return `${days}d ago`;
  } catch {
    return '';
  }
}

function sessionLastActiveAgo(expiresAt: string) {
  const activityAt = getSessionActivityTime(expiresAt);
  if (!activityAt) return '';
  return timeAgo(activityAt.toISOString());
}

function sessionLastActiveLabel(expiresAt: string) {
  const activityAt = getSessionActivityTime(expiresAt);
  if (!activityAt) return '';
  return fmt(activityAt.toISOString());
}

// ──────────────────────────────────────
// Chat Conversations Tab
// ──────────────────────────────────────

function ChatConversationsTab() {
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const selected = useMemo(() => sessions.find((s) => s.session_id === selectedId) || null, [sessions, selectedId]);

  const fetchSessions = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      params.set('limit', '200');
      const res = await fetch(`/api/super_admin/chat-sessions?${params.toString()}`);
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json?.error || 'Failed to load');
      const list: ChatSession[] = Array.isArray(json?.sessions) ? json.sessions : [];
      setSessions(list);
      if (list.length && !selectedId) setSelectedId(list[0].session_id);
    } catch {
      setSessions([]);
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    const t = setTimeout(() => fetchSessions(), 200);
    return () => clearTimeout(t);
  }, [fetchSessions]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-0 lg:gap-0 h-[calc(100vh-220px)] min-h-[400px] bg-white border border-gray-200 rounded-2xl shadow-sm" style={{ overflow: 'hidden' }}>
      {/* Session list */}
      <div className="lg:col-span-4 border-r border-gray-200 flex flex-col overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/80">
          <div className="flex items-center gap-2 mb-2">
            <h3 className="text-sm font-bold text-gray-900">
              Conversations
              <span className="ml-1.5 text-xs font-normal text-gray-500">({sessions.length})</span>
            </h3>
            <button
              type="button"
              onClick={() => fetchSessions()}
              disabled={loading}
              className="ml-auto p-1.5 rounded-lg hover:bg-gray-200 text-gray-500 disabled:opacity-50"
            >
              <RefreshCcw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
            <input
              id="chat-sessions-search"
              name="chat-sessions-search"
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search conversations..."
              className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-xs bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto">
          {loading && sessions.length === 0 ? (
            <div className="p-6 flex flex-col items-center text-gray-500">
              <Loader2 className="w-5 h-5 animate-spin" />
              <p className="text-xs mt-2">Loading...</p>
            </div>
          ) : sessions.length === 0 ? (
            <div className="p-6 text-center text-sm text-gray-500">No conversations found</div>
          ) : (
            sessions.map((s) => {
              const active = s.session_id === selectedId;
              return (
                <button
                  type="button"
                  key={s.session_id}
                  onClick={() => setSelectedId(s.session_id)}
                  className={`w-full text-left px-4 py-3 border-b border-gray-100 transition-colors ${
                    active ? 'bg-blue-50 border-l-[3px] border-l-blue-600' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5">
                        {s.has_booking && (
                          <span className="inline-flex px-1.5 py-0.5 rounded bg-green-100 text-green-700 text-[10px] font-bold">
                            BOOKED
                          </span>
                        )}
                        <span className="text-xs font-semibold text-gray-900 truncate">
                          {s.customer_name || s.session_id.slice(0, 18)}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-600 mt-0.5 line-clamp-2">
                        {s.first_user_message || '(empty)'}
                      </p>
                    </div>
                    <div className="flex flex-col items-end shrink-0">
                      <span className="text-[10px] text-gray-400">{sessionLastActiveAgo(s.expires_at)}</span>
                      <span className="mt-1 inline-flex items-center gap-1 text-[10px] text-gray-500">
                        <MessageSquare className="w-3 h-3" />
                        {s.message_count}
                      </span>
                    </div>
                  </div>
                  {(s.phone_number || s.city) && (
                    <div className="mt-1 flex items-center gap-2 text-[10px] text-gray-400">
                      {s.phone_number && <span>{s.phone_number}</span>}
                      {s.city && (
                        <>
                          <span>·</span>
                          <span>{s.city}</span>
                        </>
                      )}
                    </div>
                  )}
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Conversation viewer */}
      <div className="lg:col-span-8 flex flex-col overflow-hidden">
        {!selected ? (
          <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
            <MessageSquare className="w-10 h-10 mb-3" />
            <p className="text-sm font-medium">Select a conversation</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="px-5 py-3 border-b border-gray-200 bg-gray-50/80 flex items-center gap-3">
              <div className="w-9 h-9 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-sm">
                {(selected.customer_name || 'U')[0].toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold text-gray-900 truncate">
                  {selected.customer_name || 'Anonymous'}
                </p>
                <div className="flex items-center gap-3 text-[11px] text-gray-500 flex-wrap">
                  {selected.phone_number && (
                    <span className="flex items-center gap-1">
                      <Phone className="w-3 h-3" />
                      {selected.phone_number}
                    </span>
                  )}
                  {selected.car_model && (
                    <span className="flex items-center gap-1">
                      <Car className="w-3 h-3" />
                      {selected.car_model}
                    </span>
                  )}
                  {selected.city && (
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {selected.city}
                    </span>
                  )}
                  {selected.service && (
                    <span className="flex items-center gap-1">
                      <Wrench className="w-3 h-3" />
                      {selected.service}
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-[10px] text-gray-400 flex items-center gap-1">
                  <Clock className="w-3 h-3" />
                  {sessionLastActiveLabel(selected.expires_at)}
                </span>
                <p className="text-[10px] text-gray-500 mt-0.5">{selected.message_count} messages</p>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4 space-y-3 bg-[#f0f2f5]">
              {selected.history.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-8">No messages in this session</p>
              ) : (
                selected.history.map((msg, i) => {
                  const isUser = msg.role === 'user';
                  return (
                    <div key={i} className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 shadow-sm ${
                          isUser
                            ? 'bg-blue-600 text-white rounded-br-md'
                            : 'bg-white text-gray-900 rounded-bl-md border border-gray-100'
                        }`}
                      >
                        <div className="flex items-center gap-1.5 mb-1">
                          {isUser ? (
                            <User className="w-3 h-3 text-blue-200" />
                          ) : (
                            <Bot className="w-3 h-3 text-blue-500" />
                          )}
                          <span
                            className={`text-[10px] font-semibold ${isUser ? 'text-blue-200' : 'text-gray-500'}`}
                          >
                            {isUser ? 'Customer' : 'AI Bot'}
                          </span>
                        </div>
                        <div className="text-sm whitespace-pre-wrap leading-relaxed">
                          {msg.content.split('\n').map((line, lineIdx) => renderChatMessageLine(line, isUser, lineIdx))}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ──────────────────────────────────────
// Main Page
// ──────────────────────────────────────

export default function KbQuestionsAdminPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200">
        <div className="px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 flex items-center gap-2">
                <MessageSquare className="w-6 h-6 text-brand-primary" />
                AI Learning Inbox
              </h1>
              <p className="text-sm text-gray-600 mt-0.5">
                Monitor chatbot conversations and manage knowledge base learning.
              </p>
            </div>
          </div>

          <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-blue-200 bg-blue-50 text-sm font-semibold text-blue-700">
            <MessageSquare className="w-4 h-4" />
            Chat Conversations
          </div>
        </div>
      </div>

      <div className="px-4 sm:px-6 lg:px-8 py-5">
        <ChatConversationsTab />
      </div>
    </div>
  );
}
