/**
 * Patches Node HTTP responses to emit indented HTML for page routes.
 * Loaded via NODE_OPTIONS=-r ./scripts/html-pretty-patch.js
 *
 * Disable with PRETTY_HTML=0
 */
const http = require('http');
const https = require('https');
const zlib = require('zlib');
const { formatHtml } = require('./format-html');

function isPrettyHtmlEnabled() {
  if (process.env.PRETTY_HTML === '0') return false;
  // `--require` runs before standalone sets NODE_ENV=production, so never
  // gate on production here — only skip explicit development.
  return process.env.NODE_ENV !== 'development';
}

function isPageRoute(pathname) {
  const path = (pathname || '/').split('?')[0];
  if (!path || path.startsWith('/_next') || path.startsWith('/api')) return false;
  if (/\.[a-z0-9]+$/i.test(path)) return false;
  return true;
}

function patchResponse(req, res) {
  const pathname = (req.url || '/').split('?')[0];
  if (!isPageRoute(pathname)) return;

  const chunks = [];
  let passThrough = false;

  const origWrite = res.write.bind(res);
  const origEnd = res.end.bind(res);

  const flushBuffered = (chunk, encoding, callback) => {
    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    }
    if (typeof encoding === 'function') {
      callback = encoding;
      encoding = undefined;
    }

    try {
      const raw = Buffer.concat(chunks);
      const encodingHeader = String(res.getHeader('content-encoding') || '').toLowerCase();
      let gzipped =
        encodingHeader.includes('gzip') ||
        (raw.length > 2 && raw[0] === 0x1f && raw[1] === 0x8b);
      let body;
      if (gzipped) {
        try {
          body = zlib.gunzipSync(raw).toString('utf8');
        } catch {
          gzipped = false;
          body = raw.toString('utf8');
        }
      } else {
        body = raw.toString('utf8');
      }

      if (/<!DOCTYPE html|<html[\s>]/i.test(body)) {
        body = formatHtml(body);
      }

      let out = Buffer.from(body, 'utf8');
      if (gzipped) out = zlib.gzipSync(out);
      if (!res.headersSent) {
        res.setHeader('Content-Length', out.length);
        res.removeHeader('Transfer-Encoding');
      }
      origEnd(out, undefined, callback);
    } catch {
      origEnd(Buffer.concat(chunks), encoding, callback);
    }
  };

  res.write = function write(chunk, encoding, callback) {
    if (passThrough) return origWrite(chunk, encoding, callback);

    const contentType = String(res.getHeader('content-type') || '');
    if (contentType && !contentType.includes('text/html')) {
      passThrough = true;
      if (chunks.length) origWrite(Buffer.concat(chunks));
      return origWrite(chunk, encoding, callback);
    }

    if (chunk) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk, encoding));
    }
    if (typeof encoding === 'function') callback = encoding;
    if (callback) callback();
    return true;
  };

  res.end = function end(chunk, encoding, callback) {
    if (passThrough) return origEnd(chunk, encoding, callback);

    const contentType = String(res.getHeader('content-type') || '');
    if (contentType && !contentType.includes('text/html')) {
      passThrough = true;
      if (chunks.length) origWrite(Buffer.concat(chunks));
      return origEnd(chunk, encoding, callback);
    }

    return flushBuffered(chunk, encoding, callback);
  };
}

function patchServerEmit(Server) {
  const originalEmit = Server.prototype.emit;
  if (originalEmit.__myfngPrettyHtml) return;
  function emit(type, ...args) {
    if (type === 'request') {
      const [req, res] = args;
      patchResponse(req, res);
    }
    return originalEmit.call(this, type, ...args);
  }
  emit.__myfngPrettyHtml = true;
  Server.prototype.emit = emit;
}

if (isPrettyHtmlEnabled()) {
  patchServerEmit(http.Server);
  patchServerEmit(https.Server);
}
