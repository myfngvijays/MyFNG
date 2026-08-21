/** Best-effort browser geolocation for login audit (never blocks login). */
export async function getLoginGeoHint(timeoutMs = 4000): Promise<{
  latitude: number | null;
  longitude: number | null;
  location_label: string | null;
  city: string | null;
}> {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    return { latitude: null, longitude: null, location_label: null, city: null };
  }
  try {
    const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
      const t = setTimeout(() => reject(new Error('geo-timeout')), timeoutMs);
      navigator.geolocation.getCurrentPosition(
        (p) => {
          clearTimeout(t);
          resolve(p);
        },
        (e) => {
          clearTimeout(t);
          reject(e);
        },
        { enableHighAccuracy: false, maximumAge: 120000, timeout: timeoutMs },
      );
    });
    const latitude = pos.coords.latitude;
    const longitude = pos.coords.longitude;
    return {
      latitude,
      longitude,
      location_label: `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`,
      city: null,
    };
  } catch {
    return { latitude: null, longitude: null, location_label: null, city: null };
  }
}

/** POST /api/auth/record-login after successful auth. */
export async function postRecordLogin(opts: {
  platform: 'web' | 'mobile' | 'unknown';
  userAgent?: string | null;
  accessToken?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  location_label?: string | null;
  city?: string | null;
  device_label?: string | null;
}) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (opts.accessToken) headers.Authorization = `Bearer ${opts.accessToken}`;
  const res = await fetch('/api/auth/record-login', {
    method: 'POST',
    headers,
    credentials: 'include',
    body: JSON.stringify({
      platform: opts.platform,
      user_agent: opts.userAgent || null,
      latitude: opts.latitude ?? null,
      longitude: opts.longitude ?? null,
      location_label: opts.location_label ?? null,
      city: opts.city ?? null,
      device_label: opts.device_label ?? null,
    }),
  });
  return res.json().catch(() => ({}));
}
