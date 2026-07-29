import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  createHealthAlertTemplate,
  getHealthAlertTemplateStatus,
  sendHealthAlertMessage,
  syncHealthAlertTemplate,
  SYSTEM_HEALTH_ALERT_TEMPLATE,
} from '@/lib/services/systemHealthAlertTemplate';
import { probeOpenAiAdminBillingAccess } from '@/lib/chatbot_v2/openAiOrgUsage';
import { getMisaAiUsdInrRate } from '@/lib/chatbot_v2/misaAiBilling';
import { getOpenAiCreditBalanceStatus } from '@/lib/chatbot_v2/openAiCreditBalance';
import { checkFcmCredentials } from '@/lib/push/fcmHealthCheck';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const ADMIN_WHATSAPP_NUMBERS = (process.env.SYSTEM_ALERT_WHATSAPP_NUMBERS || '').split(',').filter(Boolean);

type ServiceStatus = 'healthy' | 'degraded' | 'down';

interface HealthCheck {
  name: string;
  category: string;
  status: ServiceStatus;
  responseTime: number;
  message: string;
  reason: string;
  lastChecked: string;
  quickFix?: { label: string; action: string; actionPayload?: Record<string, unknown> } | null;
  details?: Record<string, unknown>;
}

async function assertSuperAdmin(supabase: any) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) return { ok: false, status: 401, error: 'Unauthorized' };

  const { data: userData, error: roleError } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .single();
  if (roleError || !userData) return { ok: false, status: 403, error: 'Forbidden' };

  const roleCode = (userData as any).roles?.role_code;
  if (!['SUPER_ADMIN', 'SUB_ADMIN'].includes(roleCode)) {
    return { ok: false, status: 403, error: 'Forbidden - Not super admin' };
  }
  return { ok: true, status: 200, error: null, userProfile: userData };
}

async function checkWithTimeout<T>(fn: () => Promise<T>, timeoutMs = 10000): Promise<T> {
  return Promise.race([
    fn(),
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('Request timed out after ' + timeoutMs + 'ms')), timeoutMs)),
  ]);
}

function getAdminClient() {
  const { supabaseAdmin, error } = getSupabaseAdmin();
  if (error || !supabaseAdmin) {
    return { client: null, configError: error || 'Supabase Admin client not initialized' };
  }
  return { client: supabaseAdmin, configError: null };
}

async function checkDatabase(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();

  if (!client) {
    return {
      name: 'PostgreSQL Database',
      category: 'Database',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'Configuration error',
      reason: `Supabase Admin client could not be created. Error: "${configError}". This means environment variables NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY are missing or invalid in your .env.local file.`,
      quickFix: { label: 'Check Environment Variables', action: 'check-env', actionPayload: { vars: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] } },
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await checkWithTimeout(() =>
      client.from('roles').select('id').limit(1)
    );
    const responseTime = Date.now() - start;
    if (error) {
      return {
        name: 'PostgreSQL Database',
        category: 'Database',
        status: 'down',
        responseTime,
        message: `Query failed: ${error.message}`,
        reason: error.code === 'PGRST301' ? 'JWT token expired or invalid. The SUPABASE_SERVICE_ROLE_KEY may be wrong.' :
          error.code === '42P01' ? 'Table "roles" does not exist in the database.' :
          error.code === '57P03' ? 'Database is in recovery mode or shutting down.' :
          `Database returned error code "${error.code || 'unknown'}": ${error.message}. Check if Supabase project is active and DB is not paused.`,
        quickFix: error.code === 'PGRST301' ? { label: 'Verify Service Role Key', action: 'check-env', actionPayload: { vars: ['SUPABASE_SERVICE_ROLE_KEY'] } } : null,
        lastChecked: new Date().toISOString(),
        details: { errorCode: error.code, hint: error.hint },
      };
    }
    return {
      name: 'PostgreSQL Database',
      category: 'Database',
      status: responseTime > 3000 ? 'degraded' : 'healthy',
      responseTime,
      message: responseTime > 3000 ? 'High latency detected' : 'Connected & responsive',
      reason: responseTime > 3000 ? `Response took ${responseTime}ms (threshold: 3000ms). Database may be under heavy load or Supabase project is on free tier with cold starts.` : 'Database query executed successfully within acceptable time.',
      lastChecked: new Date().toISOString(),
    };
  } catch (e: any) {
    const responseTime = Date.now() - start;
    return {
      name: 'PostgreSQL Database',
      category: 'Database',
      status: 'down',
      responseTime,
      message: e.message || 'Connection failed',
      reason: e.message?.includes('Timeout') ? `Database did not respond within 10 seconds. Possible causes: Supabase project paused (free tier auto-pause after 1 week), network issues, or database overloaded.` :
        e.message?.includes('fetch') ? 'Network error - cannot reach Supabase servers. Check your internet connection or if Supabase is experiencing an outage.' :
        `Unexpected error: ${e.message}. Check Supabase dashboard for project status.`,
      quickFix: e.message?.includes('Timeout') ? { label: 'Wake Up Database', action: 'wake-db' } : null,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkSupabaseAuth(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();

  if (!client) {
    return {
      name: 'Supabase Auth',
      category: 'Authentication',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'Configuration error',
      reason: `Admin client not available: "${configError}". Auth service requires SUPABASE_SERVICE_ROLE_KEY to access admin functions.`,
      quickFix: { label: 'Check Environment Variables', action: 'check-env', actionPayload: { vars: ['SUPABASE_SERVICE_ROLE_KEY'] } },
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await checkWithTimeout(() =>
      client.auth.admin.listUsers({ page: 1, perPage: 1 })
    );
    const responseTime = Date.now() - start;
    if (error) {
      return {
        name: 'Supabase Auth',
        category: 'Authentication',
        status: 'down',
        responseTime,
        message: `Auth error: ${error.message}`,
        reason: error.message?.includes('not authorized') ? 'Service role key does not have admin access. Verify SUPABASE_SERVICE_ROLE_KEY is the service_role key (not anon key).' :
          `Auth service returned: "${error.message}". The Supabase Auth service may be temporarily unavailable.`,
        quickFix: { label: 'Verify Service Role Key', action: 'check-env', actionPayload: { vars: ['SUPABASE_SERVICE_ROLE_KEY'] } },
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      name: 'Supabase Auth',
      category: 'Authentication',
      status: responseTime > 3000 ? 'degraded' : 'healthy',
      responseTime,
      message: 'Auth service operational',
      reason: responseTime > 3000 ? `Auth response took ${responseTime}ms. Service is slow but functional.` : 'Authentication service responded normally.',
      lastChecked: new Date().toISOString(),
      details: { usersFound: data?.users?.length || 0 },
    };
  } catch (e: any) {
    return {
      name: 'Supabase Auth',
      category: 'Authentication',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Auth check failed',
      reason: e.message?.includes('Timeout') ? 'Auth service did not respond in time. Supabase may be experiencing issues.' :
        `Error: ${e.message}. Check Supabase status page for Auth service availability.`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkSupabaseStorage(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();

  if (!client) {
    return {
      name: 'Supabase Storage',
      category: 'Storage',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'Configuration error',
      reason: `Admin client not available: "${configError}". Storage requires valid Supabase credentials.`,
      quickFix: { label: 'Check Environment Variables', action: 'check-env', actionPayload: { vars: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'] } },
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await checkWithTimeout(() =>
      client.storage.listBuckets()
    );
    const responseTime = Date.now() - start;
    if (error) {
      return {
        name: 'Supabase Storage',
        category: 'Storage',
        status: 'down',
        responseTime,
        message: `Storage error: ${(error as any).message || error}`,
        reason: `Storage service returned an error. This could be due to invalid credentials or Supabase Storage service being temporarily down.`,
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      name: 'Supabase Storage',
      category: 'Storage',
      status: responseTime > 3000 ? 'degraded' : 'healthy',
      responseTime,
      message: `${data?.length || 0} buckets accessible`,
      reason: 'Storage service is working correctly. All buckets are accessible.',
      lastChecked: new Date().toISOString(),
      details: { bucketCount: data?.length || 0, buckets: data?.map((b: any) => b.name) },
    };
  } catch (e: any) {
    return {
      name: 'Supabase Storage',
      category: 'Storage',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Storage check failed',
      reason: `Storage API call failed: ${e.message}. Check if Supabase project is active.`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkWhatsAppAPI(): Promise<HealthCheck> {
  const start = Date.now();
  const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const token = process.env.WHATSAPP_ACCESS_TOKEN;
  const apiUrl = process.env.WHATSAPP_API_URL || 'https://graph.facebook.com/v21.0';

  if (!phoneId || !token) {
    const missing = [];
    if (!phoneId) missing.push('WHATSAPP_PHONE_NUMBER_ID');
    if (!token) missing.push('WHATSAPP_ACCESS_TOKEN');
    return {
      name: 'WhatsApp Business API',
      category: 'Notifications',
      status: 'down',
      responseTime: 0,
      message: 'Configuration missing',
      reason: `Missing environment variables: ${missing.join(', ')}. These are required to connect to WhatsApp Business Cloud API.`,
      quickFix: { label: 'Check Environment Variables', action: 'check-env', actionPayload: { vars: missing } },
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const response = await checkWithTimeout(() =>
      fetch(`${apiUrl}/${phoneId}`, { headers: { Authorization: `Bearer ${token}` } })
    );
    const responseTime = Date.now() - start;
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const errMsg = (body as any)?.error?.message || `HTTP ${response.status}`;
      return {
        name: 'WhatsApp Business API',
        category: 'Notifications',
        status: 'down',
        responseTime,
        message: `API returned ${response.status}`,
        reason: response.status === 401 ? 'Access token expired or invalid. Generate a new token from Meta Business Suite > WhatsApp > API Setup.' :
          response.status === 400 ? `Bad request: ${errMsg}. Phone Number ID may be incorrect.` :
          response.status === 403 ? 'Permission denied. App may not have WhatsApp messaging permission or phone number is not verified.' :
          `WhatsApp API error: ${errMsg}`,
        quickFix: response.status === 401 ? { label: 'Regenerate Token', action: 'external-link', actionPayload: { url: 'https://business.facebook.com/settings/whatsapp-business-accounts' } } : null,
        lastChecked: new Date().toISOString(),
        details: { httpStatus: response.status, apiError: errMsg },
      };
    }
    return {
      name: 'WhatsApp Business API',
      category: 'Notifications',
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      responseTime,
      message: 'WhatsApp API reachable',
      reason: 'WhatsApp Business Cloud API is responding correctly. Messages can be sent.',
      lastChecked: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      name: 'WhatsApp Business API',
      category: 'Notifications',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'API unreachable',
      reason: e.message?.includes('Timeout') ? 'WhatsApp API did not respond within 10s. Meta servers might be slow or experiencing an outage.' :
        `Network error reaching WhatsApp API: ${e.message}. Check internet connectivity.`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkRazorpay(): Promise<HealthCheck> {
  const start = Date.now();
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;

  if (!keyId || !keySecret) {
    const missing = [];
    if (!keyId) missing.push('RAZORPAY_KEY_ID');
    if (!keySecret) missing.push('RAZORPAY_KEY_SECRET');
    return {
      name: 'Razorpay Payment Gateway',
      category: 'Payments',
      status: 'down',
      responseTime: 0,
      message: 'Configuration missing',
      reason: `Missing: ${missing.join(', ')}. Get these from Razorpay Dashboard > Settings > API Keys.`,
      quickFix: { label: 'Open Razorpay Dashboard', action: 'external-link', actionPayload: { url: 'https://dashboard.razorpay.com/app/keys' } },
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const auth = Buffer.from(`${keyId}:${keySecret}`).toString('base64');
    const response = await checkWithTimeout(() =>
      fetch('https://api.razorpay.com/v1/payments?count=1', {
        headers: { Authorization: `Basic ${auth}` },
      })
    );
    const responseTime = Date.now() - start;
    if (!response.ok && response.status !== 401) {
      return {
        name: 'Razorpay Payment Gateway',
        category: 'Payments',
        status: response.status === 401 ? 'down' : 'down',
        responseTime,
        message: `API returned ${response.status}`,
        reason: response.status === 401 ? 'Invalid API credentials. Key ID or Key Secret is incorrect. Regenerate from Razorpay Dashboard.' :
          response.status === 429 ? 'Rate limited by Razorpay. Too many requests. Wait a few minutes.' :
          `Razorpay returned HTTP ${response.status}. Check Razorpay status page.`,
        quickFix: response.status === 401 ? { label: 'Open Razorpay Keys', action: 'external-link', actionPayload: { url: 'https://dashboard.razorpay.com/app/keys' } } : null,
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      name: 'Razorpay Payment Gateway',
      category: 'Payments',
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      responseTime,
      message: 'Payment gateway accessible',
      reason: 'Razorpay API is responding correctly. Payment processing is functional.',
      lastChecked: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      name: 'Razorpay Payment Gateway',
      category: 'Payments',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Gateway unreachable',
      reason: e.message?.includes('Timeout') ? 'Razorpay API timeout. Their servers might be slow. Check https://status.razorpay.com' :
        `Cannot reach Razorpay: ${e.message}`,
      quickFix: { label: 'Check Razorpay Status', action: 'external-link', actionPayload: { url: 'https://status.razorpay.com' } },
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkFirebase(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const result = await checkWithTimeout(() => checkFcmCredentials(), 15000);
    const responseTime = Date.now() - start;
    if (!result.ok) {
      return {
        name: 'Firebase / FCM Admin',
        category: 'Notifications',
        status: 'down',
        responseTime,
        message: result.error || 'FCM credentials invalid',
        reason:
          result.error ||
          'Firebase Admin credentials missing or invalid. Advance Push / scheduled campaigns will fail.',
        quickFix: {
          label: 'Open Firebase Settings',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/advance-notifications?section=firebase' },
        },
        lastChecked: new Date().toISOString(),
        details: {
          projectId: result.projectId,
          credentialsSource: result.credentialsSource,
          clientEmailMasked: result.clientEmailMasked,
        },
      };
    }
    return {
      name: 'Firebase / FCM Admin',
      category: 'Notifications',
      status: responseTime > 8000 ? 'degraded' : 'healthy',
      responseTime,
      message: result.message || 'FCM Admin credentials valid',
      reason: `Push credentials OK via ${result.credentialsSource}. Project: ${result.projectId || 'n/a'}.`,
      lastChecked: new Date().toISOString(),
      details: {
        projectId: result.projectId,
        credentialsSource: result.credentialsSource,
        clientEmailMasked: result.clientEmailMasked,
      },
    };
  } catch (e: any) {
    return {
      name: 'Firebase / FCM Admin',
      category: 'Notifications',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'FCM check failed',
      reason: `Could not verify FCM Admin credentials: ${e.message}`,
      quickFix: {
        label: 'Open Firebase Settings',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/advance-notifications?section=firebase' },
      },
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkPushCampaigns(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'Push Campaigns & Segments',
      category: 'Notifications',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'DB unavailable',
      reason: `Cannot verify push campaign tables: ${configError}`,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const [segments, campaigns, dueStuck] = await Promise.all([
      client.from('push_saved_segments').select('id', { count: 'exact', head: true }),
      client.from('push_scheduled_campaigns').select('id', { count: 'exact', head: true }),
      client
        .from('push_scheduled_campaigns')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'scheduled')
        .lt('scheduled_at', new Date(Date.now() - 30 * 60 * 1000).toISOString()),
    ]);
    const responseTime = Date.now() - start;

    if (segments.error || campaigns.error) {
      const msg = segments.error?.message || campaigns.error?.message || 'Missing tables';
      const missing = /does not exist|relation|42P01|PGRST205/i.test(msg);
      return {
        name: 'Push Campaigns & Segments',
        category: 'Notifications',
        status: 'down',
        responseTime,
        message: missing ? 'Migration not applied' : `Query failed: ${msg}`,
        reason: missing
          ? 'Tables push_saved_segments / push_scheduled_campaigns missing. Run database/294_push_campaigns_segments_schedule.sql'
          : msg,
        quickFix: {
          label: 'Open Campaigns',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/advance-notifications?section=campaigns' },
        },
        lastChecked: new Date().toISOString(),
      };
    }

    const stuck = dueStuck.count || 0;
    return {
      name: 'Push Campaigns & Segments',
      category: 'Notifications',
      status: stuck > 0 ? 'degraded' : 'healthy',
      responseTime,
      message:
        stuck > 0
          ? `${stuck} scheduled campaign(s) overdue`
          : `${campaigns.count || 0} campaigns · ${segments.count || 0} segments`,
      reason:
        stuck > 0
          ? `${stuck} campaign(s) are still "scheduled" more than 30 minutes past due. Check /api/cron/scheduled-push and CRON_SECRET.`
          : 'Push campaign + segment tables are available.',
      quickFix:
        stuck > 0
          ? {
              label: 'Open Campaigns',
              action: 'internal-link',
              actionPayload: { url: '/dashboard/super_admin/advance-notifications?section=campaigns' },
            }
          : null,
      lastChecked: new Date().toISOString(),
      details: {
        campaigns: campaigns.count || 0,
        segments: segments.count || 0,
        overdueScheduled: stuck,
      },
    };
  } catch (e: any) {
    return {
      name: 'Push Campaigns & Segments',
      category: 'Notifications',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Check failed',
      reason: `Push campaigns health check failed: ${e.message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkPushDevices(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'Push Device Registry',
      category: 'Notifications',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'DB unavailable',
      reason: `Cannot verify notification_devices: ${configError}`,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { count, error } = await client
      .from('notification_devices')
      .select('id', { count: 'exact', head: true });
    const responseTime = Date.now() - start;
    if (error) {
      return {
        name: 'Push Device Registry',
        category: 'Notifications',
        status: 'down',
        responseTime,
        message: error.message,
        reason: 'notification_devices table missing or inaccessible. Mobile push targeting will fail.',
        lastChecked: new Date().toISOString(),
      };
    }
    const devices = count || 0;
    return {
      name: 'Push Device Registry',
      category: 'Notifications',
      status: devices === 0 ? 'degraded' : 'healthy',
      responseTime,
      message: devices === 0 ? 'No registered devices' : `${devices.toLocaleString('en-IN')} devices registered`,
      reason:
        devices === 0
          ? 'No rows in notification_devices. App installs may not be registering FCM tokens.'
          : 'Device registry is readable for Advance Push targeting.',
      lastChecked: new Date().toISOString(),
      details: { devices },
    };
  } catch (e: any) {
    return {
      name: 'Push Device Registry',
      category: 'Notifications',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Check failed',
      reason: `Push devices check failed: ${e.message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkWalletSystem(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'Wallet System',
      category: 'Commerce',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'DB unavailable',
      reason: `Cannot verify wallet tables: ${configError}`,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { count, error } = await client
      .from('wallet_transactions')
      .select('id', { count: 'exact', head: true });
    const responseTime = Date.now() - start;
    if (error) {
      return {
        name: 'Wallet System',
        category: 'Commerce',
        status: 'down',
        responseTime,
        message: error.message,
        reason: 'wallet_transactions table missing or inaccessible. Wallet credit/debit & welcome bonus will fail.',
        quickFix: {
          label: 'Open Wallet Credits',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/wallet-credits?section=history' },
        },
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      name: 'Wallet System',
      category: 'Commerce',
      status: 'healthy',
      responseTime,
      message: `${(count || 0).toLocaleString('en-IN')} wallet transactions`,
      reason: 'Wallet ledger is accessible for credits, debits, referral rewards, and expiry push cron.',
      lastChecked: new Date().toISOString(),
      details: { transactions: count || 0 },
    };
  } catch (e: any) {
    return {
      name: 'Wallet System',
      category: 'Commerce',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Check failed',
      reason: `Wallet health check failed: ${e.message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkAdvanceCoupons(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'Advance Coupons',
      category: 'Commerce',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'DB unavailable',
      reason: `Cannot verify coupons table: ${configError}`,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const [all, active] = await Promise.all([
      client.from('coupons').select('id', { count: 'exact', head: true }),
      client.from('coupons').select('id', { count: 'exact', head: true }).eq('is_active', true),
    ]);
    const responseTime = Date.now() - start;
    if (all.error) {
      return {
        name: 'Advance Coupons',
        category: 'Commerce',
        status: 'down',
        responseTime,
        message: all.error.message,
        reason: 'coupons table missing or inaccessible. Advance Coupon Management will fail.',
        quickFix: {
          label: 'Open Coupons',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/advance-coupons' },
        },
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      name: 'Advance Coupons',
      category: 'Commerce',
      status: 'healthy',
      responseTime,
      message: `${active.count || 0} active / ${all.count || 0} total coupons`,
      reason: 'Coupon catalog is readable for Advance Coupons, bookings, and push targeting.',
      lastChecked: new Date().toISOString(),
      details: { total: all.count || 0, active: active.count || 0 },
    };
  } catch (e: any) {
    return {
      name: 'Advance Coupons',
      category: 'Commerce',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Check failed',
      reason: `Coupons health check failed: ${e.message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkRsaLeads(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'RSA Leads',
      category: 'Operations',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'DB unavailable',
      reason: `Cannot verify rsa_leads: ${configError}`,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const [active, recentErr] = await Promise.all([
      client
        .from('rsa_leads')
        .select('id', { count: 'exact', head: true })
        .eq('delete_status', false)
        .not('lead_status', 'in', '(completed,cancelled,closed)'),
      client.from('rsa_leads').select('id', { count: 'exact', head: true }).limit(1),
    ]);
    const responseTime = Date.now() - start;
    const err = active.error || recentErr.error;
    if (err) {
      return {
        name: 'RSA Leads',
        category: 'Operations',
        status: 'down',
        responseTime,
        message: err.message,
        reason: 'rsa_leads table missing or inaccessible. RSA dashboard / roadside ops will fail.',
        quickFix: {
          label: 'Open RSA',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/rsa' },
        },
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      name: 'RSA Leads',
      category: 'Operations',
      status: 'healthy',
      responseTime,
      message: `${active.count || 0} active RSA leads`,
      reason: 'RSA leads table is accessible for Super Admin RSA module.',
      lastChecked: new Date().toISOString(),
      details: { active: active.count || 0 },
    };
  } catch (e: any) {
    return {
      name: 'RSA Leads',
      category: 'Operations',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Check failed',
      reason: `RSA health check failed: ${e.message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkFeatureCrons(): Promise<HealthCheck> {
  const start = Date.now();
  const cronSecret = Boolean(process.env.CRON_SECRET || process.env.CRON_SECRET_TOKEN);
  const knownCrons = [
    '/api/cron/scheduled-push',
    '/api/cron/wallet-welcome-expiry-push',
    '/api/cron/whatsapp-agents',
    '/api/cron/whatsapp-automation',
    '/api/cron/telecrm-push',
  ];

  if (!cronSecret) {
    return {
      name: 'Feature Cron Secrets',
      category: 'Background Jobs',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'CRON_SECRET not set',
      reason:
        'CRON_SECRET missing. Vercel crons for scheduled-push, wallet expiry push, WhatsApp agents may be rejected or insecure.',
      quickFix: {
        label: 'Check Environment Variables',
        action: 'check-env',
        actionPayload: { vars: ['CRON_SECRET'] },
      },
      lastChecked: new Date().toISOString(),
      details: { crons: knownCrons },
    };
  }

  return {
    name: 'Feature Cron Secrets',
    category: 'Background Jobs',
    status: 'healthy',
    responseTime: Date.now() - start,
    message: 'CRON_SECRET configured',
    reason: `Cron auth present for feature jobs including scheduled-push and wallet-welcome-expiry-push (${knownCrons.length} tracked paths).`,
    lastChecked: new Date().toISOString(),
    details: { crons: knownCrons },
  };
}


async function checkEmailService(): Promise<HealthCheck> {
  const start = Date.now();
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  if (!smtpHost) {
    return {
      name: 'Email (SMTP)',
      category: 'Notifications',
      status: 'down',
      responseTime: 0,
      message: 'SMTP not configured',
      reason: 'SMTP_HOST or EMAIL_HOST not found in environment. Emails cannot be sent.',
      quickFix: { label: 'Check Environment Variables', action: 'check-env', actionPayload: { vars: ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASS'] } },
      lastChecked: new Date().toISOString(),
    };
  }
  return {
    name: 'Email (SMTP)',
    category: 'Notifications',
    status: 'healthy',
    responseTime: Date.now() - start,
    message: `SMTP host: ${smtpHost}`,
    reason: `Email configured with SMTP host "${smtpHost}". Service should be functional.`,
    lastChecked: new Date().toISOString(),
  };
}

async function checkOpenAI(): Promise<HealthCheck> {
  const start = Date.now();
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return {
      name: 'OpenAI / AI Services',
      category: 'AI',
      status: 'down',
      responseTime: 0,
      message: 'API key missing',
      reason: 'OPENAI_API_KEY is not set in environment. AI features (chatbot, content generation) will not work.',
      quickFix: { label: 'Check Environment Variables', action: 'check-env', actionPayload: { vars: ['OPENAI_API_KEY'] } },
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const response = await checkWithTimeout(() =>
      fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey}` },
      })
    );
    const responseTime = Date.now() - start;
    if (!response.ok) {
      return {
        name: 'OpenAI / AI Services',
        category: 'AI',
        status: 'down',
        responseTime,
        message: `API returned ${response.status}`,
        reason: response.status === 401 ? 'OpenAI API key is invalid or expired. Generate a new key from platform.openai.com.' :
          response.status === 429 ? 'Rate limited or quota exceeded. Check your OpenAI billing and usage limits.' :
          `OpenAI returned HTTP ${response.status}. Check https://status.openai.com`,
        quickFix: response.status === 401 ? { label: 'OpenAI API Keys', action: 'external-link', actionPayload: { url: 'https://platform.openai.com/api-keys' } } :
          response.status === 429 ? { label: 'Check OpenAI Usage', action: 'external-link', actionPayload: { url: 'https://platform.openai.com/usage' } } : null,
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      name: 'OpenAI / AI Services',
      category: 'AI',
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      responseTime,
      message: 'AI service operational',
      reason: 'OpenAI API is responding. All AI features are functional.',
      lastChecked: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      name: 'OpenAI / AI Services',
      category: 'AI',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'AI service unreachable',
      reason: `Cannot reach OpenAI: ${e.message}. Check https://status.openai.com`,
      quickFix: { label: 'Check OpenAI Status', action: 'external-link', actionPayload: { url: 'https://status.openai.com' } },
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkMisaAiMonitoring(): Promise<HealthCheck> {
  const start = Date.now();
  const openAiApiKey = Boolean(process.env.OPENAI_API_KEY?.trim());
  const openAiAdminKey = Boolean(
    process.env.OPENAI_ADMIN_API_KEY?.trim() || process.env.OPENAI_ADMIN_KEY?.trim(),
  );
  const misaModel = process.env.OPENAI_MODEL || 'gpt-4o';

  if (!openAiApiKey) {
    return {
      name: 'MISA AI Monitoring',
      category: 'AI',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'OPENAI_API_KEY missing',
      reason: 'MISA chat, booking AI, and WhatsApp brain need OPENAI_API_KEY. Billing dashboard also needs OPENAI_ADMIN_API_KEY.',
      quickFix: {
        label: 'Open MISA Dashboard',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/misa-ai' },
      },
      lastChecked: new Date().toISOString(),
      details: { openai_api_key: false, openai_admin_key: openAiAdminKey, model: misaModel },
    };
  }

  const { client } = getAdminClient();
  let usageTableReady = false;
  let usageLogs7d = 0;
  let trackedSpend7dUsd = 0;

  if (client) {
    const since7d = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: usageRows, error } = await client
      .from('misa_ai_usage_logs')
      .select('estimated_cost_usd')
      .gte('created_at', since7d)
      .limit(5000);

    if (!error) {
      usageTableReady = true;
      usageLogs7d = (usageRows || []).length;
      trackedSpend7dUsd = (usageRows || []).reduce(
        (sum, row) => sum + Number((row as { estimated_cost_usd?: number }).estimated_cost_usd || 0),
        0,
      );
    }
  }

  let adminBillingOk: boolean | null = null;
  let adminBillingError: string | undefined;
  if (openAiAdminKey) {
    const probe = await probeOpenAiAdminBillingAccess();
    adminBillingOk = probe.ok;
    adminBillingError = probe.error;
  }

  const usdInr = getMisaAiUsdInrRate();
  let status: ServiceStatus = 'healthy';
  let message = 'MISA AI stack ready';
  let reason = `Model ${misaModel}. Chat API key OK.`;

  if (!openAiAdminKey) {
    status = 'degraded';
    message = 'Live OpenAI billing not configured';
    reason =
      'OPENAI_ADMIN_API_KEY missing — MISA Dashboard cannot show realtime org usage/billing from platform.openai.com. Add Admin key from OpenAI → Settings → Admin keys.';
  } else if (adminBillingOk === false) {
    status = 'degraded';
    message = 'Admin billing API failed';
    reason = adminBillingError || 'OPENAI_ADMIN_API_KEY is set but OpenAI org costs API rejected the request.';
  } else if (!usageTableReady) {
    status = 'degraded';
    message = 'Usage logs table missing';
    reason =
      'Run database/278_misa_ai_usage_logs.sql on Supabase to enable per-request MISA token/cost logs in admin dashboard.';
  } else {
    const spendNote =
      trackedSpend7dUsd > 0
        ? ` Internal logs (7d): $${trackedSpend7dUsd.toFixed(2)} (≈₹${Math.round(trackedSpend7dUsd * usdInr)}), ${usageLogs7d} requests.`
        : usageLogs7d > 0
          ? ` ${usageLogs7d} MISA requests logged in last 7 days.`
          : ' No MISA usage logs yet — chat activity will populate after migration + new chats.';
    reason += spendNote;
    if (adminBillingOk) {
      reason += ' Live OpenAI org billing API connected.';
    }
  }

  let balanceStatus: Awaited<ReturnType<typeof getOpenAiCreditBalanceStatus>> | null = null;
  try {
    balanceStatus = await getOpenAiCreditBalanceStatus();
    if (balanceStatus.configured && balanceStatus.is_low) {
      status = 'degraded';
      message = 'OpenAI prepaid balance low';
      const pending = balanceStatus.pending_milestones_usd || [];
      reason =
        `Estimated remaining credit $${(balanceStatus.estimated_remaining_usd ?? 0).toFixed(2)}. ` +
        (pending.length > 0
          ? `Pending milestone alerts: $${pending.join(', $')}.`
          : `Milestones already alerted ($${balanceStatus.settings.alert_milestones_sent.join(', $') || 'none'}).`) +
        ' Top up and update baseline in MISA AI dashboard.';
    } else if (balanceStatus.configured && balanceStatus.estimated_remaining_usd !== null) {
      reason += ` Estimated OpenAI credit left: $${balanceStatus.estimated_remaining_usd.toFixed(2)}.`;
    } else if (!balanceStatus.configured && openAiAdminKey) {
      reason += ' Set OpenAI credit baseline in MISA AI dashboard for low-balance WhatsApp alerts.';
    }
  } catch {
    // non-blocking
  }

  return {
    name: 'MISA AI Monitoring',
    category: 'AI',
    status,
    responseTime: Date.now() - start,
    message,
    reason,
    quickFix: {
      label: 'Open MISA Dashboard',
      action: 'internal-link',
      actionPayload: { url: '/dashboard/super_admin/misa-ai' },
    },
    lastChecked: new Date().toISOString(),
    details: {
      openai_api_key: openAiApiKey,
      openai_admin_key: openAiAdminKey,
      admin_billing_api: adminBillingOk,
      usage_logs_table: usageTableReady,
      usage_logs_7d: usageLogs7d,
      tracked_spend_7d_usd: Number(trackedSpend7dUsd.toFixed(4)),
      tracked_spend_7d_inr: Math.round(trackedSpend7dUsd * usdInr),
      model: misaModel,
      dashboard_path: '/dashboard/super_admin/misa-ai',
      openai_estimated_remaining_usd: balanceStatus?.estimated_remaining_usd ?? null,
      openai_balance_low: balanceStatus?.is_low ?? false,
      openai_balance_alert_enabled: balanceStatus?.settings.alert_enabled ?? false,
    },
  };
}

async function checkGoogleMaps(): Promise<HealthCheck> {
  const start = Date.now();
  const apiKey = process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  if (!apiKey) {
    return {
      name: 'Google Maps',
      category: 'Third Party',
      status: 'down',
      responseTime: 0,
      message: 'API key missing',
      reason: 'GOOGLE_MAPS_API_KEY / NEXT_PUBLIC_GOOGLE_MAPS_API_KEY not set. Maps and geocoding features won\'t work.',
      quickFix: { label: 'Check Environment Variables', action: 'check-env', actionPayload: { vars: ['GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY'] } },
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const response = await checkWithTimeout(() =>
      fetch('https://maps.googleapis.com', { method: 'HEAD' })
    );
    const responseTime = Date.now() - start;
    return {
      name: 'Google Maps',
      category: 'Third Party',
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      responseTime,
      message: 'Maps API key configured & servers reachable',
      reason: 'Google Maps API key is set and Google servers are responding. Maps will work correctly in the browser.',
      lastChecked: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      name: 'Google Maps',
      category: 'Third Party',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Google Maps unreachable',
      reason: `Cannot reach Google Maps servers: ${e.message}. Check internet connectivity.`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkCronJobs(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();

  if (!client) {
    return {
      name: 'Scheduled Jobs (Cron)',
      category: 'Background Jobs',
      status: 'healthy',
      responseTime: Date.now() - start,
      message: 'Cannot check (DB unavailable)',
      reason: `Cron check skipped because database admin client is not available: ${configError}`,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { data, error } = await client
      .from('cron_job_logs')
      .select('id, job_name, status, executed_at')
      .order('executed_at', { ascending: false })
      .limit(5);
    const responseTime = Date.now() - start;

    if (error) {
      return {
        name: 'Scheduled Jobs (Cron)',
        category: 'Background Jobs',
        status: 'healthy',
        responseTime,
        message: 'No cron log table found',
        reason: 'Table "cron_job_logs" does not exist. This is OK if cron logging is not configured yet.',
        lastChecked: new Date().toISOString(),
      };
    }

    const failedJobs = (data || []).filter((j: any) => j.status === 'failed');
    return {
      name: 'Scheduled Jobs (Cron)',
      category: 'Background Jobs',
      status: failedJobs.length > 2 ? 'degraded' : 'healthy',
      responseTime,
      message: failedJobs.length > 0 ? `${failedJobs.length} recent failures` : 'All jobs running normally',
      reason: failedJobs.length > 0 ? `${failedJobs.length} of last 5 cron jobs failed. Check job logs for details.` : 'All recent scheduled jobs completed successfully.',
      lastChecked: new Date().toISOString(),
      details: { recentJobs: data?.length || 0, failedJobs: failedJobs.length },
    };
  } catch (e: any) {
    return {
      name: 'Scheduled Jobs (Cron)',
      category: 'Background Jobs',
      status: 'healthy',
      responseTime: Date.now() - start,
      message: 'Cron monitoring not configured',
      reason: 'Could not check cron status. This feature is optional.',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkSSL(): Promise<HealthCheck> {
  const start = Date.now();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXTAUTH_URL || '';
  if (!siteUrl) {
    return {
      name: 'SSL Certificate',
      category: 'Security',
      status: 'healthy',
      responseTime: 0,
      message: 'Site URL not configured',
      reason: 'NEXT_PUBLIC_SITE_URL not set, so SSL verification is skipped. Set it for automated SSL monitoring.',
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const response = await checkWithTimeout(() => fetch(siteUrl, { method: 'HEAD' }));
    const responseTime = Date.now() - start;
    return {
      name: 'SSL Certificate',
      category: 'Security',
      status: 'healthy',
      responseTime,
      message: 'SSL certificate valid',
      reason: `Site ${siteUrl} is reachable via HTTPS. SSL is working.`,
      lastChecked: new Date().toISOString(),
      details: { siteUrl },
    };
  } catch (e: any) {
    return {
      name: 'SSL Certificate',
      category: 'Security',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: e.message || 'SSL check failed',
      reason: e.message?.includes('certificate') ? `SSL certificate issue: ${e.message}. Certificate may be expired or misconfigured.` :
        `Could not reach ${siteUrl}: ${e.message}`,
      quickFix: e.message?.includes('certificate') ? { label: 'Check SSL Certificate', action: 'external-link', actionPayload: { url: `https://www.ssllabs.com/ssltest/analyze.html?d=${new URL(siteUrl).hostname}` } } : null,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkSARVTelephony(): Promise<HealthCheck> {
  const start = Date.now();
  const deepcallUserId = process.env.DEEPCALL_USER_ID || '11965974';
  const apiBase = process.env.DEEPCALL_API_BASE || 'https://v4-api.deepcall.com';

  try {
    const response = await checkWithTimeout(() =>
      fetch(apiBase, { method: 'HEAD' })
    );
    const responseTime = Date.now() - start;
    return {
      name: 'SARV / Deepcall Telephony',
      category: 'Third Party',
      status: responseTime > 5000 ? 'degraded' : 'healthy',
      responseTime,
      message: 'Deepcall API reachable',
      reason: 'SARV/Deepcall telephony service is configured and server is reachable.',
      lastChecked: new Date().toISOString(),
      details: { userId: deepcallUserId, apiBase },
    };
  } catch (e: any) {
    return {
      name: 'SARV / Deepcall Telephony',
      category: 'Third Party',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'Deepcall API unreachable',
      reason: `Cannot reach Deepcall server at ${apiBase}: ${e.message}. Telecaller dialer may not work.`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function countActiveInstances(
  client: any,
  agentType: string,
): Promise<number | null> {
  const { count, error } = await client
    .from('whatsapp_agent_instances')
    .select('id', { count: 'exact', head: true })
    .eq('agent_type', agentType)
    .in('status', ['ACTIVE', 'WAITING']);

  if (error) return null;
  return count ?? 0;
}

async function checkWhatsAppAgents(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();

  if (!client) {
    return {
      name: 'WhatsApp AI Agents',
      category: 'AI',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'Cannot check (DB unavailable)',
      reason: `WhatsApp agent tables could not be queried: ${configError}`,
      quickFix: { label: 'Open Bot Flow', action: 'external-link', actionPayload: { url: '/dashboard/super_admin/bot-flow' } },
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { data: configs, error: cfgError } = await checkWithTimeout(() =>
      client.from('whatsapp_agent_configs').select('agent_type, enabled, model'),
    );
    const responseTime = Date.now() - start;

    if (cfgError) {
      const migrationMissing = cfgError.code === '42P01' || cfgError.message?.includes('does not exist');
      return {
        name: 'WhatsApp AI Agents',
        category: 'AI',
        status: 'down',
        responseTime,
        message: migrationMissing ? 'Migration not applied' : 'Config query failed',
        reason: migrationMissing
          ? 'Tables whatsapp_agent_configs/instances not found. Run database/260_whatsapp_agents.sql (and 267 for phase 4 indexes).'
          : `Agent config query failed: ${cfgError.message}`,
        quickFix: migrationMissing
          ? { label: 'Open Bot Flow', action: 'external-link', actionPayload: { url: '/dashboard/super_admin/bot-flow' } }
          : null,
        lastChecked: new Date().toISOString(),
        details: { errorCode: cfgError.code },
      };
    }

    const rows = (configs || []) as Array<{ agent_type: string; enabled: boolean; model?: string }>;
    const enabledAgents = rows.filter((r) => r.enabled).map((r) => r.agent_type);
    const [bookingActive, followupActive, chaseActive] = await Promise.all([
      countActiveInstances(client, 'BOOKING'),
      countActiveInstances(client, 'FOLLOWUP'),
      countActiveInstances(client, 'CHASE'),
    ]);

    const { count: pendingWakeups } = await client
      .from('whatsapp_agent_scheduled_wakeups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PENDING');

    const { count: stuckWakeups } = await client
      .from('whatsapp_agent_scheduled_wakeups')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'PROCESSING');

    const openAiReady = Boolean(process.env.OPENAI_API_KEY);
    const whatsappReady = Boolean(process.env.WHATSAPP_ACCESS_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID);

    let status: ServiceStatus = 'healthy';
    let message = `${enabledAgents.length} agent(s) enabled`;
    let reason = 'MISA AI, Follow-up Bot, and Chase Bot configs are readable. Pause/Escalate, CRM_UPDATE poll, and instance dashboards are deployed in Bot Flow.';

    if (enabledAgents.length > 0 && (!openAiReady || !whatsappReady)) {
      status = 'degraded';
      const missing = [];
      if (!openAiReady) missing.push('OPENAI_API_KEY');
      if (!whatsappReady) missing.push('WHATSAPP_ACCESS_TOKEN / WHATSAPP_PHONE_NUMBER_ID');
      message = `Agents enabled but missing: ${missing.join(', ')}`;
      reason = 'One or more WhatsApp agents are enabled in Bot Flow but required env vars are missing, so live sends may fail.';
    } else if ((stuckWakeups ?? 0) > 0) {
      status = 'degraded';
      message = `${stuckWakeups} wakeup(s) stuck in PROCESSING`;
      reason = 'Scheduled agent wakeups are stuck. Cron recoverStuckWakeups should clear them on next /api/cron/whatsapp-agents run.';
    } else if (enabledAgents.length === 0) {
      message = 'All agents disabled (Bot Flow)';
      reason = 'WhatsApp agent tables are OK. Enable MISA AI / Follow-up / Chase from Bot Flow when ready.';
    }

    return {
      name: 'WhatsApp AI Agents',
      category: 'AI',
      status,
      responseTime,
      message,
      reason,
      quickFix: { label: 'Open Bot Flow', action: 'external-link', actionPayload: { url: '/dashboard/super_admin/bot-flow' } },
      lastChecked: new Date().toISOString(),
      details: {
        enabled_agents: enabledAgents,
        active_instances: {
          BOOKING: bookingActive,
          FOLLOWUP: followupActive,
          CHASE: chaseActive,
        },
        pending_wakeups: pendingWakeups ?? 0,
        stuck_wakeups: stuckWakeups ?? 0,
        capabilities: [
          'pause_escalate_apis',
          'active_instances_dashboard',
          'crm_update_auto_rerun',
          'manual_followup_trigger',
          'message_variety',
        ],
      },
    };
  } catch (e: any) {
    return {
      name: 'WhatsApp AI Agents',
      category: 'AI',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Agent health check failed',
      reason: `Could not verify WhatsApp agent stack: ${e.message}`,
      quickFix: { label: 'Open Bot Flow', action: 'external-link', actionPayload: { url: '/dashboard/super_admin/bot-flow' } },
      lastChecked: new Date().toISOString(),
    };
  }
}

function calculateHealthScore(checks: HealthCheck[]): number {
  if (checks.length === 0) return 100;
  const weights: Record<string, number> = {
    Database: 22,
    Authentication: 18,
    Payments: 12,
    Notifications: 12,
    Commerce: 10,
    AI: 8,
    Operations: 6,
    Storage: 5,
    'Third Party': 4,
    'Background Jobs': 4,
    Security: 3,
  };

  let totalWeight = 0;
  let weightedScore = 0;

  for (const check of checks) {
    const weight = weights[check.category] || 5;
    totalWeight += weight;
    if (check.status === 'healthy') weightedScore += weight;
    else if (check.status === 'degraded') weightedScore += weight * 0.5;
  }

  return totalWeight > 0 ? Math.round((weightedScore / totalWeight) * 100) : 100;
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const checks = await Promise.all([
      checkDatabase(),
      checkSupabaseAuth(),
      checkSupabaseStorage(),
      checkWhatsAppAPI(),
      checkRazorpay(),
      checkFirebase(),
      checkPushCampaigns(),
      checkPushDevices(),
      checkEmailService(),
      checkWalletSystem(),
      checkAdvanceCoupons(),
      checkRsaLeads(),
      checkOpenAI(),
      checkMisaAiMonitoring(),
      checkWhatsAppAgents(),
      checkGoogleMaps(),
      checkCronJobs(),
      checkFeatureCrons(),
      checkSSL(),
      checkSARVTelephony(),
    ]);

    const healthScore = calculateHealthScore(checks);
    const downServices = checks.filter(c => c.status === 'down');
    const degradedServices = checks.filter(c => c.status === 'degraded');
    const healthyServices = checks.filter(c => c.status === 'healthy');

    const categories = [...new Set(checks.map(c => c.category))];
    const categoryStats = categories.map(cat => {
      const catChecks = checks.filter(c => c.category === cat);
      const status: ServiceStatus = catChecks.some(c => c.status === 'down')
        ? 'down'
        : catChecks.some(c => c.status === 'degraded')
          ? 'degraded'
          : 'healthy';
      return { category: cat, status, total: catChecks.length, healthy: catChecks.filter(c => c.status === 'healthy').length };
    });

    // Check environment variable status for quick-fix panel
    const envStatus = {
      NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
      WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
      WHATSAPP_ACCESS_TOKEN: !!process.env.WHATSAPP_ACCESS_TOKEN,
      RAZORPAY_KEY_ID: !!process.env.RAZORPAY_KEY_ID,
      RAZORPAY_KEY_SECRET: !!process.env.RAZORPAY_KEY_SECRET,
      FIREBASE_PROJECT_ID: !!(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
      CRON_SECRET: !!(process.env.CRON_SECRET || process.env.CRON_SECRET_TOKEN),
      OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
      OPENAI_ADMIN_API_KEY: !!(process.env.OPENAI_ADMIN_API_KEY || process.env.OPENAI_ADMIN_KEY),
      GOOGLE_MAPS_API_KEY: !!(process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
      SMTP_HOST: !!(process.env.SMTP_HOST || process.env.EMAIL_HOST),
      SYSTEM_ALERT_WHATSAPP_NUMBERS: ADMIN_WHATSAPP_NUMBERS.length > 0,
    };

    const healthAlertTemplate = await getHealthAlertTemplateStatus();

    return NextResponse.json({
      healthScore,
      overallStatus: downServices.length > 0 ? 'critical' : degradedServices.length > 0 ? 'warning' : 'operational',
      summary: {
        total: checks.length,
        healthy: healthyServices.length,
        degraded: degradedServices.length,
        down: downServices.length,
      },
      categories: categoryStats,
      checks,
      envStatus,
      healthAlertTemplate,
      templatePreview: SYSTEM_HEALTH_ALERT_TEMPLATE,
      lastChecked: new Date().toISOString(),
      alertsSent: false,
    });
  } catch (error: any) {
    console.error('System monitor error:', error);
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const body = await request.json();
    const { action } = body;

    if (action === 'create-health-template') {
      const result = await createHealthAlertTemplate(auth.userProfile?.id);
      const healthAlertTemplate = await getHealthAlertTemplateStatus();
      return NextResponse.json({
        success: true,
        ...result,
        healthAlertTemplate,
      });
    }

    if (action === 'sync-health-template') {
      const result = await syncHealthAlertTemplate(auth.userProfile?.id);
      const healthAlertTemplate = await getHealthAlertTemplateStatus();
      return NextResponse.json({
        success: true,
        ...result,
        healthAlertTemplate,
      });
    }

    if (action === 'test-alert') {
      const targetNumbers = body.phoneNumber 
        ? [body.phoneNumber] 
        : ADMIN_WHATSAPP_NUMBERS;
      
      if (targetNumbers.length === 0) {
        return NextResponse.json({ error: 'No WhatsApp numbers configured. Set SYSTEM_ALERT_WHATSAPP_NUMBERS env variable or provide phoneNumber in request.' }, { status: 400 });
      }

      const templateStatus = await getHealthAlertTemplateStatus();
      const timestamp = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      const useTemplate = Boolean(body.useTemplate) && templateStatus.canSendTemplate;
      const summary = {
        timestamp,
        total: 10,
        healthy: 10,
        degraded: 0,
        down: 0,
        downServices: [],
        degradedServices: [],
      };
      
      const results = [];
      for (const number of targetNumbers) {
        const result = await sendHealthAlertMessage(number.trim(), summary, {
          test: !useTemplate,
          forceText: !useTemplate,
        });
        results.push({ number: number.trim(), deliveryMode: useTemplate ? 'template' : 'text', ...result });
      }
      const allSuccess = results.every(r => r.success);
      return NextResponse.json({ 
        success: allSuccess, 
        results,
        deliveryMode: useTemplate ? 'template' : 'text',
        templateStatus,
        message: allSuccess
          ? useTemplate
            ? 'Template alert sent successfully'
            : 'Text alert sent successfully (requires 24-hour WhatsApp window unless template is approved)'
          : 'Some messages failed - check results for details',
      });
    }

    if (action === 'wake-db') {
      const { client, configError } = getAdminClient();
      if (!client) {
        return NextResponse.json({ error: `Cannot wake DB: ${configError}` }, { status: 400 });
      }
      try {
        await client.from('roles').select('id').limit(1);
        return NextResponse.json({ success: true, message: 'Database pinged successfully. It should wake up shortly.' });
      } catch (e: any) {
        return NextResponse.json({ error: `Wake DB failed: ${e.message}` }, { status: 500 });
      }
    }

    return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error', message: error.message }, { status: 500 });
  }
}
