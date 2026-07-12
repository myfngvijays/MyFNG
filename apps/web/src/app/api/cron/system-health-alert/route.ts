import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  buildHealthAlertContent,
  sendHealthAlertMessage,
} from '@/lib/services/systemHealthAlertTemplate';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_WHATSAPP_NUMBERS = (process.env.SYSTEM_ALERT_WHATSAPP_NUMBERS || '').split(',').filter(Boolean);

function assertCronAuth(req: NextRequest): string | null {
  const secret = process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET;
  if (!secret) return 'CRON secret is not configured on server';

  const auth = req.headers.get('authorization') || '';
  const token = auth.toLowerCase().startsWith('bearer ') ? auth.slice(7).trim() : '';
  if (!token || token !== secret) return 'Unauthorized';
  return null;
}

type ServiceStatus = 'healthy' | 'degraded' | 'down';

interface CheckResult {
  name: string;
  status: ServiceStatus;
  message: string;
}

async function checkWithTimeout<T>(fn: () => Promise<T>, timeoutMs = 10000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Timeout')), timeoutMs)),
  ]);
}

async function runAllChecks(): Promise<CheckResult[]> {
  const results: CheckResult[] = [];
  const { supabaseAdmin, error: adminError } = getSupabaseAdmin();

  // 1. Database
  if (!supabaseAdmin) {
    results.push({ name: 'PostgreSQL Database', status: 'down', message: adminError || 'Admin client not available' });
    results.push({ name: 'Supabase Auth', status: 'down', message: 'Admin client not available' });
    results.push({ name: 'Supabase Storage', status: 'down', message: 'Admin client not available' });
  } else {
    try {
      const { error } = await checkWithTimeout(() => supabaseAdmin.from('roles').select('id').limit(1));
      results.push({ name: 'PostgreSQL Database', status: error ? 'down' : 'healthy', message: error ? error.message : 'OK' });
    } catch (e: any) {
      results.push({ name: 'PostgreSQL Database', status: 'down', message: e.message });
    }

    try {
      const { error } = await checkWithTimeout(() => supabaseAdmin.auth.admin.listUsers({ page: 1, perPage: 1 }));
      results.push({ name: 'Supabase Auth', status: error ? 'down' : 'healthy', message: error ? error.message : 'OK' });
    } catch (e: any) {
      results.push({ name: 'Supabase Auth', status: 'down', message: e.message });
    }

    try {
      const { error } = await checkWithTimeout(() => supabaseAdmin.storage.listBuckets());
      results.push({ name: 'Supabase Storage', status: error ? 'down' : 'healthy', message: error ? String(error) : 'OK' });
    } catch (e: any) {
      results.push({ name: 'Supabase Storage', status: 'down', message: e.message });
    }
  }

  // 2. WhatsApp API
  const waPhoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const waToken = process.env.WHATSAPP_ACCESS_TOKEN;
  const waApiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v25.0';
  if (waPhoneId && waToken) {
    try {
      const res = await checkWithTimeout(() => fetch(`${waApiUrl}/${waPhoneId}`, { headers: { Authorization: `Bearer ${waToken}` } }));
      results.push({ name: 'WhatsApp API', status: res.ok ? 'healthy' : 'down', message: res.ok ? 'OK' : `HTTP ${res.status}` });
    } catch (e: any) {
      results.push({ name: 'WhatsApp API', status: 'down', message: e.message });
    }
  }

  // 3. Razorpay
  const rzpKey = process.env.RAZORPAY_KEY_ID;
  const rzpSecret = process.env.RAZORPAY_KEY_SECRET;
  if (rzpKey && rzpSecret) {
    try {
      const auth = Buffer.from(`${rzpKey}:${rzpSecret}`).toString('base64');
      const res = await checkWithTimeout(() => fetch('https://api.razorpay.com/v1/payments?count=1', { headers: { Authorization: `Basic ${auth}` } }));
      results.push({ name: 'Razorpay', status: (res.ok || res.status === 200) ? 'healthy' : 'down', message: res.ok ? 'OK' : `HTTP ${res.status}` });
    } catch (e: any) {
      results.push({ name: 'Razorpay', status: 'down', message: e.message });
    }
  }

  // 4. OpenAI
  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const res = await checkWithTimeout(() => fetch('https://api.openai.com/v1/models', { headers: { Authorization: `Bearer ${openaiKey}` } }));
      results.push({ name: 'OpenAI', status: res.ok ? 'healthy' : 'down', message: res.ok ? 'OK' : `HTTP ${res.status}` });
    } catch (e: any) {
      results.push({ name: 'OpenAI', status: 'down', message: e.message });
    }
  }

  // 5. Firebase
  const fbProjectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  if (fbProjectId) {
    try {
      await checkWithTimeout(() => fetch(`https://firebaseinstallations.googleapis.com/v1/projects/${fbProjectId}`));
      results.push({ name: 'Firebase', status: 'healthy', message: 'OK' });
    } catch (e: any) {
      results.push({ name: 'Firebase', status: 'down', message: e.message });
    }
  }

  // 6. Google Maps
  const mapsKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (mapsKey) {
    try {
      await checkWithTimeout(() => fetch('https://maps.googleapis.com', { method: 'HEAD' }));
      results.push({ name: 'Google Maps', status: 'healthy', message: 'OK' });
    } catch (e: any) {
      results.push({ name: 'Google Maps', status: 'down', message: e.message });
    }
  }

  // 7. Deepcall
  try {
    const apiBase = process.env.DEEPCALL_API_BASE || 'https://v4-api.deepcall.com';
    await checkWithTimeout(() => fetch(apiBase, { method: 'HEAD' }));
    results.push({ name: 'SARV/Deepcall', status: 'healthy', message: 'OK' });
  } catch (e: any) {
    results.push({ name: 'SARV/Deepcall', status: 'down', message: e.message });
  }

  return results;
}

export async function GET(request: NextRequest) {
  const authError = assertCronAuth(request);
  if (authError) {
    return NextResponse.json({ error: authError }, { status: 401 });
  }

  if (ADMIN_WHATSAPP_NUMBERS.length === 0) {
    return NextResponse.json({ error: 'SYSTEM_ALERT_WHATSAPP_NUMBERS not configured' }, { status: 400 });
  }

  const checks = await runAllChecks();
  const downServices = checks.filter(c => c.status === 'down');
  const degradedServices = checks.filter(c => c.status === 'degraded');
  const healthyServices = checks.filter(c => c.status === 'healthy');
  const total = checks.length;

  const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
  const summary = {
    timestamp,
    total,
    healthy: healthyServices.length,
    degraded: degradedServices.length,
    down: downServices.length,
    downServices: downServices.map((service) => ({ name: service.name, message: service.message })),
    degradedServices: degradedServices.map((service) => ({ name: service.name })),
  };
  const alertContent = buildHealthAlertContent(summary);

  const sendResults = [];
  for (const number of ADMIN_WHATSAPP_NUMBERS) {
    const result = await sendHealthAlertMessage(number.trim(), summary);
    sendResults.push({ number: number.trim(), ...result, preview: alertContent.statusLabel });
  }

  return NextResponse.json({
    success: true,
    timestamp,
    summary: { total, healthy: healthyServices.length, degraded: degradedServices.length, down: downServices.length },
    checks,
    alertsSent: sendResults,
  });
}
