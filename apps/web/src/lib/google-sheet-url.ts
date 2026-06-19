export function googleSheetToCsvExportUrl(input: string): string | null {
  const url = String(input || '').trim();
  if (!url) return null;

  if (/^https:\/\/docs\.google\.com\/spreadsheets\/d\/[^/]+\/export\?format=csv/i.test(url)) {
    return url;
  }

  const idMatch = url.match(/\/spreadsheets\/d\/([a-zA-Z0-9-_]+)/);
  if (!idMatch?.[1]) return null;

  const gidMatch = url.match(/[?&#]gid=(\d+)/);
  const gid = gidMatch?.[1] || '0';
  return `https://docs.google.com/spreadsheets/d/${idMatch[1]}/export?format=csv&gid=${gid}`;
}

export function isGoogleSheetUrl(input: string): boolean {
  return Boolean(googleSheetToCsvExportUrl(input));
}
