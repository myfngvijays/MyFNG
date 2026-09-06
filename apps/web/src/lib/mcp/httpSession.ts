import { randomUUID } from 'node:crypto';
import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMyfngMcpServer } from '@/lib/mcp/createMyfngMcpServer';
import { mcpCorsHeaders, withCors } from '@/lib/mcp/httpAuth';

type SessionEntry = {
  transport: WebStandardStreamableHTTPServerTransport;
  createdAt: number;
};

const SESSION_TTL_MS = 30 * 60 * 1000;

function sessionStore(): Map<string, SessionEntry> {
  const g = globalThis as unknown as { __myfngMcpSessions?: Map<string, SessionEntry> };
  if (!g.__myfngMcpSessions) g.__myfngMcpSessions = new Map();
  return g.__myfngMcpSessions;
}

function pruneSessions() {
  const now = Date.now();
  for (const [id, entry] of sessionStore()) {
    if (now - entry.createdAt > SESSION_TTL_MS) {
      sessionStore().delete(id);
      void entry.transport.close().catch(() => undefined);
    }
  }
}

function isInitializePayload(body: unknown): boolean {
  if (!body || typeof body !== 'object') return false;
  const messages = Array.isArray(body) ? body : [body];
  return messages.some((item) => item && typeof item === 'object' && (item as any).method === 'initialize');
}

async function readJsonBody(req: Request): Promise<unknown> {
  const ct = req.headers.get('content-type') || '';
  if (!ct.includes('json')) return undefined;
  try {
    return await req.json();
  } catch {
    return undefined;
  }
}

function withMcpAccept(req: Request): Request {
  const accept = req.headers.get('accept') || '';
  if (accept.includes('application/json') && accept.includes('text/event-stream')) return req;
  const headers = new Headers(req.headers);
  headers.set('Accept', 'application/json, text/event-stream');
  return new Request(req.url, { method: req.method, headers });
}

async function connectTransport(transport: WebStandardStreamableHTTPServerTransport) {
  const server = await createMyfngMcpServer();
  await server.connect(transport);
  return transport;
}

async function createSession(): Promise<SessionEntry> {
  const sessionId = randomUUID();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: () => sessionId,
    enableJsonResponse: true,
    onsessioninitialized: (id) => {
      const current = sessionStore().get(sessionId);
      if (current) sessionStore().set(id, current);
    },
    onsessionclosed: (id) => {
      sessionStore().delete(id);
    },
  });
  await connectTransport(transport);
  const entry = { transport, createdAt: Date.now() };
  sessionStore().set(sessionId, entry);
  return entry;
}

async function createStatelessTransport() {
  return connectTransport(
    new WebStandardStreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true,
    }),
  );
}

export async function handleAuthenticatedMcp(req: Request): Promise<Response> {
  pruneSessions();
  const sessionId = (req.headers.get('mcp-session-id') || req.headers.get('Mcp-Session-Id') || '').trim();
  const existing = sessionId ? sessionStore().get(sessionId) : undefined;

  if (req.method === 'GET') {
    if (existing) {
      return withCors(await existing.transport.handleRequest(withMcpAccept(req)));
    }
    return withCors(
      new Response(':\n\n', {
        status: 200,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache, no-transform',
          Connection: 'keep-alive',
        },
      }),
    );
  }

  if (req.method === 'DELETE') {
    if (existing) {
      sessionStore().delete(sessionId);
      return withCors(await existing.transport.handleRequest(withMcpAccept(req)));
    }
    return withCors(new Response(null, { status: 200 }));
  }

  const parsedBody = await readJsonBody(req);
  const init = isInitializePayload(parsedBody);
  const normalized = withMcpAccept(req);

  if (existing) {
    return withCors(await existing.transport.handleRequest(normalized, { parsedBody }));
  }

  if (init) {
    const entry = await createSession();
    return withCors(await entry.transport.handleRequest(normalized, { parsedBody }));
  }

  const stateless = await createStatelessTransport();
  return withCors(await stateless.handleRequest(normalized, { parsedBody }));
}
