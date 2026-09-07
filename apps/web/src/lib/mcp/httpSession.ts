import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createMyfngMcpServer } from '@/lib/mcp/createMyfngMcpServer';
import { withCors } from '@/lib/mcp/httpAuth';

function withMcpAccept(req: Request): Request {
  const accept = req.headers.get('accept') || '';
  if (accept.includes('application/json') && accept.includes('text/event-stream')) return req;
  const headers = new Headers(req.headers);
  headers.set('Accept', 'application/json, text/event-stream');
  return new Request(req.url, { method: req.method, headers });
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

function keepaliveSse(): Response {
  const encoder = new TextEncoder();
  let timer: ReturnType<typeof setInterval> | undefined;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode(': connected\n\n'));
      timer = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': keepalive\n\n'));
        } catch {
          if (timer) clearInterval(timer);
        }
      }, 15000);
    },
    cancel() {
      if (timer) clearInterval(timer);
    },
  });
  return new Response(stream, {
    status: 200,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}

export async function handleAuthenticatedMcp(req: Request): Promise<Response> {
  if (req.method === 'GET') {
    return withCors(keepaliveSse());
  }

  if (req.method === 'DELETE') {
    return withCors(new Response(null, { status: 200 }));
  }

  const parsedBody = await readJsonBody(req);
  const server = await createMyfngMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  try {
    const res = await transport.handleRequest(withMcpAccept(req), { parsedBody });
    const body = await res.text();
    const headers = new Headers(res.headers);
    return withCors(new Response(body, { status: res.status, statusText: res.statusText, headers }));
  } finally {
    void transport.close().catch(() => undefined);
  }
}
