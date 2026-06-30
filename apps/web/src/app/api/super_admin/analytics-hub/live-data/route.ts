import { assertPushAdmin } from '@/lib/push/admin-auth';
import { NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONVERSION_EVENT_NAMES = [
  'booking_submitted',
  'payment_success',
  'sign_up_completed',
  'otp_verified',
];

type Period = '7d' | '14d' | '28d';

function periodToDays(p: Period): number {
  switch (p) {
    case '7d': return 7;
    case '14d': return 14;
    case '28d': return 28;
  }
}

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function getAccessToken(credentials: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64url(
    JSON.stringify({
      iss: credentials.client_email,
      scope: 'https://www.googleapis.com/auth/analytics.readonly',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  );

  const signInput = `${header}.${payload}`;
  const sign = crypto.createSign('RSA-SHA256');
  sign.update(signInput);
  const signature = base64url(sign.sign(credentials.private_key));
  const jwt = `${signInput}.${signature}`;

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  });

  if (!res.ok) throw new Error(`Token exchange failed: ${res.status}`);
  const data = await res.json();
  return data.access_token;
}

async function runGA4Report(
  propertyId: string,
  accessToken: string,
  body: Record<string, unknown>,
) {
  const url = `https://analyticsdata.googleapis.com/v1beta/properties/${propertyId}:runReport`;
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GA4 API error ${res.status}: ${text}`);
  }
  return res.json();
}

export async function GET(request: NextRequest) {
  try {
    const auth = await assertPushAdmin();
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const { searchParams } = request.nextUrl;
    const period = (searchParams.get('period') || '7d') as Period;
    if (!['7d', '14d', '28d'].includes(period)) {
      return NextResponse.json({ error: 'Invalid period' }, { status: 400 });
    }

    const serviceAccountJson = process.env.GA4_SERVICE_ACCOUNT_JSON;
    const propertyId = process.env.GA4_PROPERTY_ID;

    if (!serviceAccountJson || !propertyId) {
      return NextResponse.json({
        configured: false,
        error: null,
        period,
        total_events: 0,
        total_users: 0,
        top_events: [],
        conversion_events: [],
      });
    }

    let credentials: { client_email: string; private_key: string };
    try {
      credentials = JSON.parse(serviceAccountJson);
      if (!credentials.client_email || !credentials.private_key) throw new Error('Missing fields');
    } catch {
      return NextResponse.json({
        configured: false,
        error: 'Invalid GA4_SERVICE_ACCOUNT_JSON — must contain client_email and private_key',
        period,
        total_events: 0,
        total_users: 0,
        top_events: [],
        conversion_events: [],
      });
    }

    const days = periodToDays(period);
    const accessToken = await getAccessToken(credentials);

    const [topEventsData, totalsData] = await Promise.all([
      runGA4Report(propertyId, accessToken, {
        dateRanges: [
          { startDate: `${days}daysAgo`, endDate: 'today' },
          { startDate: `${days * 2}daysAgo`, endDate: `${days}daysAgo` },
        ],
        dimensions: [{ name: 'eventName' }],
        metrics: [{ name: 'eventCount' }],
        orderBys: [{ metric: { metricName: 'eventCount' }, desc: true }],
        limit: 20,
      }),
      runGA4Report(propertyId, accessToken, {
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        metrics: [{ name: 'eventCount' }, { name: 'activeUsers' }],
      }),
    ]);

    const totalRow = totalsData.rows?.[0];
    const total_events = parseInt(totalRow?.metricValues?.[0]?.value ?? '0', 10);
    const total_users = parseInt(totalRow?.metricValues?.[1]?.value ?? '0', 10);

    type GA4Row = { dimensionValues: { value: string }[]; metricValues: { value: string }[] };

    const top_events = (topEventsData.rows ?? [] as GA4Row[]).map((row: GA4Row) => {
      const name = row.dimensionValues[0].value;
      const count = parseInt(row.metricValues[0].value, 10);
      const prevCount = row.metricValues.length > 1 ? parseInt(row.metricValues[1]?.value ?? '0', 10) : 0;
      const change = prevCount > 0 ? Math.round(((count - prevCount) / prevCount) * 100) : undefined;
      return { name, count, change };
    });

    const conversion_events = top_events.filter((e: { name: string }) => CONVERSION_EVENT_NAMES.includes(e.name));

    return NextResponse.json({
      configured: true,
      period,
      total_events,
      total_users,
      top_events: top_events.slice(0, 15),
      conversion_events,
    });
  } catch (err) {
    console.error('[analytics-hub/live-data]', err);
    return NextResponse.json(
      {
        configured: true,
        error: 'Failed to fetch GA4 data. Check service account permissions.',
        period: '7d',
        total_events: 0,
        total_users: 0,
        top_events: [],
        conversion_events: [],
      },
      { status: 500 },
    );
  }
}
