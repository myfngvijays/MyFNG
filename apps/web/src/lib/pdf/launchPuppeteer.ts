import fs from 'node:fs/promises';
import path from 'node:path';

export function getPuppeteerCacheDir() {
  return process.env.PUPPETEER_CACHE_DIR || path.join(process.cwd(), '.puppeteer-cache');
}

async function existingChromePath(): Promise<string | undefined> {
  const fromEnv = String(process.env.PUPPETEER_EXECUTABLE_PATH || '').trim();
  if (fromEnv) {
    try {
      await fs.access(fromEnv);
      return fromEnv;
    } catch {
      /* ignore invalid env path */
    }
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const browsers = require('@puppeteer/browsers') as any;
    const cacheDir = getPuppeteerCacheDir();
    const platform = browsers.detectBrowserPlatform();
    const buildId = await browsers.resolveBuildId(
      browsers.Browser.CHROME,
      platform,
      browsers.BrowserTag.STABLE,
    );
    const executablePath = browsers.computeExecutablePath({
      cacheDir,
      browser: browsers.Browser.CHROME,
      buildId,
      platform,
    });
    await fs.access(executablePath);
    return executablePath;
  } catch {
    return undefined;
  }
}

export async function launchInvoiceBrowser() {
  process.env.PUPPETEER_CACHE_DIR = getPuppeteerCacheDir();
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const puppeteer = require('puppeteer') as any;
  const executablePath = await existingChromePath();
  return puppeteer.launch({
    headless: true,
    ...(executablePath ? { executablePath } : {}),
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });
}
