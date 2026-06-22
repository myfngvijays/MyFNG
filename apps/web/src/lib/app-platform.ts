import type { NextRequest } from 'next/server';

export type AppPlatform = 'ANDROID' | 'IOS';

export function normalizeAppPlatform(raw: unknown): AppPlatform | null {
  const value = String(raw || '').trim().toLowerCase();
  if (value === 'android') return 'ANDROID';
  if (value === 'ios') return 'IOS';
  const upper = value.toUpperCase();
  if (upper === 'ANDROID' || upper === 'IOS') return upper as AppPlatform;
  return null;
}

export function inferPlatformFromUserAgent(userAgent: unknown): AppPlatform | null {
  const ua = String(userAgent || '').toLowerCase();
  if (!ua) return null;

  // React Native Android default fetch UA is often just "okhttp/x.x.x"
  if (
    ua.includes('android') ||
    ua.includes('okhttp') ||
    ua.includes('dalvik')
  ) {
    return 'ANDROID';
  }

  if (
    ua.includes('iphone') ||
    ua.includes('ipad') ||
    ua.includes('ipod') ||
    ua.includes('cfnetwork') ||
    ua.includes('cpu iphone os')
  ) {
    return 'IOS';
  }

  return null;
}

export function resolveAppPlatform(
  stored: unknown,
  userAgent?: unknown,
  sessionPlatform?: unknown,
): AppPlatform | null {
  return (
    normalizeAppPlatform(stored) ||
    normalizeAppPlatform(sessionPlatform) ||
    inferPlatformFromUserAgent(userAgent)
  );
}

export function appPlatformLabel(platform: AppPlatform | null | undefined) {
  if (platform === 'ANDROID') return 'Android';
  if (platform === 'IOS') return 'iOS';
  return 'Unknown';
}

export function appPlatformBadgeClass(platform: AppPlatform | null | undefined) {
  if (platform === 'ANDROID') return 'bg-green-100 text-green-800';
  if (platform === 'IOS') return 'bg-slate-100 text-slate-800';
  return 'bg-gray-100 text-gray-600';
}

export function resolveAppPlatformFromRequest(
  request: NextRequest,
  bodyPlatform?: unknown,
): AppPlatform | null {
  return (
    normalizeAppPlatform(bodyPlatform) ||
    normalizeAppPlatform(request.headers.get('x-app-platform')) ||
    inferPlatformFromUserAgent(request.headers.get('user-agent'))
  );
}

export async function persistCustomerAppPlatform(
  supabaseAdmin: any,
  customerId: string,
  platform: AppPlatform | null,
) {
  if (!platform || !customerId) return;
  await supabaseAdmin
    .from('customers')
    .update({
      app_platform: platform,
      updated_at: new Date().toISOString(),
    })
    .eq('id', customerId);
}
