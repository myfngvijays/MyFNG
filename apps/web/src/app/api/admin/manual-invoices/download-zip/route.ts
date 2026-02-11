import { NextRequest, NextResponse } from 'next/server';
import { createClientFromRequest } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import { renderManualInvoiceHtml } from '@/lib/manualInvoices/renderManualInvoiceHtml';
import { PassThrough, Readable } from 'node:stream';
import path from 'node:path';
import fs from 'node:fs/promises';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

async function requireSuperAdmin(request: NextRequest) {
  const supabase = await createClientFromRequest(request);
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return { ok: false as const, status: 401, error: 'Unauthorized' };

  const { data: userProfile, error: profileError } = await supabase
    .from('users_login')
    .select('role:roles!role_id(role_code)')
    .eq('id', user.id)
    .single();

  const roleCode = (userProfile?.role as any)?.role_code;
  if (profileError || roleCode !== 'SUPER_ADMIN') {
    return { ok: false as const, status: 403, error: 'Forbidden' };
  }

  return { ok: true as const, userId: user.id };
}

function sanitizeFileComponent(s: string) {
  return String(s || '')
    .trim()
    .replace(/[/\\?%*:|"<>]/g, '-') // reserved
    .replace(/\s+/g, ' ')
    .slice(0, 80);
}

function isMissingChromeError(e: any) {
  const msg = String(e?.message || e || '');
  return msg.includes('Could not find Chrome') || msg.includes('Could not find Chromium');
}

function getPuppeteerCacheDir() {
  // Standardize on a project-local cache so runtime can always find the browser.
  return (
    process.env.PUPPETEER_CACHE_DIR ||
    path.join(process.cwd(), '.puppeteer-cache')
  );
}

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

async function ensurePuppeteerChromeExecutable(puppeteer: any) {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const browsers = require('@puppeteer/browsers') as any;

  const cacheDir = getPuppeteerCacheDir();
  process.env.PUPPETEER_CACHE_DIR = cacheDir; // must be set before (re)requiring puppeteer in dev
  await fs.mkdir(cacheDir, { recursive: true });

  const platform = browsers.detectBrowserPlatform();
  const buildId = await browsers.resolveBuildId(
    browsers.Browser.CHROME,
    platform,
    browsers.BrowserTag.STABLE
  );

  const computePath = () =>
    browsers.computeExecutablePath({
      cacheDir,
      browser: browsers.Browser.CHROME,
      buildId,
      platform,
    });

  let executablePath = computePath();

  try {
    await fs.access(executablePath);
    return executablePath;
  } catch {
    // install then retry
  }

  await browsers.install({
    browser: browsers.Browser.CHROME,
    buildId,
    platform,
    cacheDir,
  });

  executablePath = computePath();
  await fs.access(executablePath);
  return executablePath;
}

async function parseInvoiceIds(request: NextRequest) {
  const contentType = (request.headers.get('content-type') || '').toLowerCase();

  if (contentType.includes('application/json')) {
    const body = await request.json().catch(() => ({}));
    const ids = Array.isArray(body?.ids) ? body.ids : [];
    return ids.map((x: any) => String(x || '').trim()).filter(Boolean);
  }

  if (
    contentType.includes('application/x-www-form-urlencoded') ||
    contentType.includes('multipart/form-data')
  ) {
    const formData = await request.formData();
    const raw = String(formData.get('ids') || '');
    if (!raw) return [];
    try {
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return [];
      return parsed.map((x: any) => String(x || '').trim()).filter(Boolean);
    } catch {
      return [];
    }
  }

  const body = await request.json().catch(() => ({}));
  const ids = Array.isArray(body?.ids) ? body.ids : [];
  return ids.map((x: any) => String(x || '').trim()).filter(Boolean);
}

export async function POST(request: NextRequest) {
  try {
    const gate = await requireSuperAdmin(request);
    if (!gate.ok) return NextResponse.json({ error: gate.error }, { status: gate.status });

    const ids = await parseInvoiceIds(request);

    if (ids.length === 0) {
      return NextResponse.json({ error: 'No invoice IDs provided' }, { status: 400 });
    }

    if (ids.length > 200) {
      return NextResponse.json({ error: 'Maximum 200 invoices can be downloaded at once' }, { status: 400 });
    }

    const { supabaseAdmin, error: adminErr } = getSupabaseAdmin();
    if (!supabaseAdmin) return NextResponse.json({ error: adminErr }, { status: 500 });

    const { data: invoices, error } = await supabaseAdmin
      .from('manual_create_invoice')
      .select('*')
      .in('id', ids);

    if (error) throw error;

    const invoiceById = new Map<string, any>();
    for (const inv of invoices || []) invoiceById.set(String((inv as any)?.id || ''), inv);

    const originForHtml = request.nextUrl.origin.replace('://localhost', '://127.0.0.1');

    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const archiver = require('archiver') as any;
    const out = new PassThrough();
    // PDFs are already compressed; low zip level drastically reduces CPU time.
    const archive = archiver('zip', { zlib: { level: 1 } });
    archive.pipe(out);
    archive.on('error', (err: Error) => out.destroy(err));

    const missing = ids.filter((id) => !invoiceById.has(id));
    if (missing.length > 0) {
      archive.append(
        `Missing invoices:\n${missing.join('\n')}\n`,
        { name: 'missing.txt' }
      );
    }

    // NOTE: We use require to avoid TS type dependency.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    process.env.PUPPETEER_CACHE_DIR = getPuppeteerCacheDir();
    // In dev server, module cache can keep old config; force reload so env is honored.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    delete require.cache[require.resolve('puppeteer')];
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const puppeteer = require('puppeteer') as any;

    const executablePath = await ensurePuppeteerChromeExecutable(puppeteer);

    const browser = await puppeteer.launch({
      headless: true,
      executablePath,
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const invoiceJobs = ids
      .map((id) => {
        const invoice = invoiceById.get(id);
        if (!invoice) return null;
        const invoiceNo = sanitizeFileComponent(String(invoice.invoice_number || id));
        const customerName = sanitizeFileComponent(String(invoice.customer_name || 'Customer'));
        const filename = `${invoiceNo} - ${customerName}.pdf`;
        const html = renderManualInvoiceHtml(invoice, { autoPrint: false, appUrl: originForHtml });
        return { filename, html };
      })
      .filter(Boolean) as Array<{ filename: string; html: string }>;

    const renderConcurrency = clamp(
      Number(process.env.MANUAL_INVOICE_ZIP_CONCURRENCY || 3),
      1,
      6
    );

    // Start rendering/archiving in background so download can begin streaming immediately.
    void (async () => {
      try {
        let nextIndex = 0;

        const worker = async () => {
          const page = await browser.newPage();
          page.setDefaultNavigationTimeout(120_000);
          page.setDefaultTimeout(120_000);
          await page.setViewport({ width: 1240, height: 1754 });

          try {
            while (true) {
              const idx = nextIndex++;
              if (idx >= invoiceJobs.length) break;
              const job = invoiceJobs[idx];

              // load is enough for this static HTML and is faster than networkidle strategies.
              await page.setContent(job.html, { waitUntil: 'load', timeout: 120_000 });
              const pdfBytes = await page.pdf({
                format: 'A4',
                printBackground: true,
                margin: { top: '10mm', right: '10mm', bottom: '10mm', left: '10mm' },
              });
              const pdfBuffer = Buffer.isBuffer(pdfBytes) ? pdfBytes : Buffer.from(pdfBytes);
              archive.append(pdfBuffer, { name: job.filename });
            }
          } finally {
            await page.close();
          }
        };

        const workers = Array.from(
          { length: Math.min(renderConcurrency, Math.max(invoiceJobs.length, 1)) },
          () => worker()
        );
        await Promise.all(workers);
        await browser.close();
        await archive.finalize();
      } catch (err) {
        try {
          await browser.close();
        } catch {
          // ignore close errors
        }
        out.destroy(err as Error);
      }
    })();

    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const d = String(now.getDate()).padStart(2, '0');
    const zipName = `manual-invoices-${y}-${m}-${d}.zip`;

    return new NextResponse(Readable.toWeb(out) as any, {
      headers: {
        'Content-Type': 'application/zip',
        'Content-Disposition': `attachment; filename="${zipName}"`,
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Internal server error' }, { status: 500 });
  }
}

