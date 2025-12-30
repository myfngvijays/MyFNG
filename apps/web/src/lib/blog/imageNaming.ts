const ALLOWED_EXTS = new Set(['webp']);

function extractFilenameParts(url: string): { base: string | null; ext: string | null } {
  const clean = String(url || '').split('?')[0]?.split('#')[0] ?? '';
  const last = clean.split('/').filter(Boolean).pop() ?? '';
  const idx = last.lastIndexOf('.');
  if (idx <= 0) return { base: null, ext: null };
  const base = last.slice(0, idx);
  const ext = last.slice(idx + 1).toLowerCase();
  return { base, ext };
}

function shouldEnforceBlogImageName(url: string): boolean {
  if (!url) return false;
  // Relative URLs are assumed to be our assets → enforce.
  if (url.startsWith('/')) return true;
  // If not an absolute http(s) URL, enforce as well.
  if (!/^https?:\/\//i.test(url)) return true;
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    // Enforce for our domains and common storage hosts used by us.
    return host.endsWith('myfng.in') || host.endsWith('myfng.cloud') || host.includes('supabase.co');
  } catch {
    return true;
  }
}

function escapeRegExp(s: string) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Enforces: slug.webp OR slug-<n>.webp for our hosted images.
 */
export function validateBlogImageName(url: string, slug: string): string | null {
  if (!url || !slug) return null;
  if (!shouldEnforceBlogImageName(url)) return null;

  const { base, ext } = extractFilenameParts(url);
  if (!base || !ext || !ALLOWED_EXTS.has(ext)) {
    return `Blog image must be a .webp and renamed from the title (e.g. "${slug}.webp" or "${slug}-1.webp").`;
  }
  const pattern = new RegExp(`^${escapeRegExp(slug)}(?:-\\d+)?$`);
  if (!pattern.test(base)) {
    return `Blog image file name must start with the slug (expected "${slug}.webp" or "${slug}-1.webp", got "${base}.${ext}").`;
  }
  return null;
}


