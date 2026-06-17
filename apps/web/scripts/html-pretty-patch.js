/**
 * Patches Node HTTP responses to emit indented HTML for page routes.
 * Loaded via NODE_OPTIONS=-r ./scripts/html-pretty-patch.js
 *
 * Disable with PRETTY_HTML=0
 */
const http = require('http');
const { formatHtml } = require('./format-html');

const ENABLED = process.env.PRETTY_HTML !== '0';

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
      let body = Buffer.concat(chunks).toString('utf8');
      if (/<!DOCTYPE html|<html[\s>]/i.test(body)) {
        body = formatHtml(body);
      }
      const out = Buffer.from(body, 'utf8');
      if (!res.headersSent) {
        res.setHeader('Content-Length', out.length);
        res.removeHeader('Transfer-Encoding');
      }
      origEnd(out, 'utf8', callback);
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

if (ENABLED) {
  const originalEmit = http.Server.prototype.emit;
  http.Server.prototype.emit = function emit(type, ...args) {
    if (type === 'request') {
      const [req, res] = args;
      patchResponse(req, res);
    }
    return originalEmit.call(this, type, ...args);
  };
}
