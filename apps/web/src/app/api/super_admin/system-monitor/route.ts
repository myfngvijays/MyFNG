import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getSupabaseAdmin } from '@/lib/push/supabaseAdmin';
import {
  getClickToCallConfig,
} from '@/lib/telecaller/clickToCallConfig';
import { evaluateAutoDialWindow } from '@/lib/telecaller/clickToCallHours';
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
import { getMcpHttpToken, MCP_PUBLIC_ORIGIN } from '@/lib/mcp/httpAuth';

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
    const [{ count, error }, overrideSetting, autoCouponSetting, overrideUsageSetting] =
      await Promise.all([
      client.from('wallet_transactions').select('id', { count: 'exact', head: true }),
      client
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'wallet_welcome_bonus_phone_overrides')
        .maybeSingle(),
      client
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'wallet_welcome_bonus_auto_coupon_id')
        .maybeSingle(),
      client
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'wallet_welcome_bonus_override_usage')
        .maybeSingle(),
    ]);
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

    let phoneOverrides = 0;
    try {
      const parsed = JSON.parse(String(overrideSetting.data?.setting_value || '[]'));
      phoneOverrides = Array.isArray(parsed) ? parsed.length : 0;
    } catch {
      phoneOverrides = 0;
    }

    const autoCouponId = String(autoCouponSetting.data?.setting_value || '').trim();
    let autoCouponOk = !autoCouponId;
    let autoCouponLabel = 'no auto coupon';
    if (autoCouponId) {
      const { data: couponRow, error: couponErr } = await client
        .from('coupons')
        .select('id, code, is_active')
        .eq('id', autoCouponId)
        .maybeSingle();
      if (couponErr || !couponRow?.id) {
        autoCouponOk = false;
        autoCouponLabel = 'auto coupon missing';
      } else if (couponRow.is_active === false) {
        autoCouponOk = false;
        autoCouponLabel = `${couponRow.code || 'coupon'} inactive`;
      } else {
        autoCouponOk = true;
        autoCouponLabel = `auto ${couponRow.code || 'coupon'}`;
      }
    }

    let overrideUsageEnabled = false;
    try {
      const parsed = JSON.parse(String(overrideUsageSetting.data?.setting_value || '{}'));
      overrideUsageEnabled = Boolean(parsed?.enabled);
    } catch {
      overrideUsageEnabled = false;
    }

    const status =
      phoneOverrides > 0 && autoCouponId && !autoCouponOk ? 'degraded' : 'healthy';

    return {
      name: 'Wallet System',
      category: 'Commerce',
      status,
      responseTime,
      message: `${(count || 0).toLocaleString('en-IN')} txns · ${phoneOverrides} welcome phone overrides · ${autoCouponLabel}${overrideUsageEnabled ? ' · special usage ON' : ''}`,
      reason:
        status === 'degraded'
          ? 'Welcome override auto-coupon is configured but missing/inactive — My Coupons assign will fail for listed phones.'
          : 'Wallet ledger is accessible for credits, debits, referral rewards, and expiry push cron.',
      quickFix: {
        label: 'Open Wallet Logic',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/wallet-logic' },
      },
      lastChecked: new Date().toISOString(),
      details: {
        transactions: count || 0,
        welcomePhoneOverrides: phoneOverrides,
        welcomeAutoCouponId: autoCouponId || null,
        welcomeAutoCouponOk: autoCouponOk,
        welcomeOverrideUsageEnabled: overrideUsageEnabled,
      },
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
    const [all, active, installWallet] = await Promise.all([
      client.from('coupons').select('id', { count: 'exact', head: true }),
      client.from('coupons').select('id', { count: 'exact', head: true }).eq('is_active', true),
      client
        .from('coupons')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .in('coupon_type_slug', ['festival', 'society', 'cashback', 'welcome', 'corporate', 'loyalty', 'flat'])
        .eq('discount_mode', 'AMOUNT'),
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
      message: `${active.count || 0} active / ${all.count || 0} total · ${installWallet.error ? 0 : installWallet.count || 0} first-login wallet coupons`,
      reason: 'Coupon catalog is readable for Advance Coupons, bookings, first-login wallet codes, and push targeting.',
      lastChecked: new Date().toISOString(),
      details: {
        total: all.count || 0,
        active: active.count || 0,
        installWallet: installWallet.error ? 0 : installWallet.count || 0,
      },
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

async function checkLinkManager(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'Link Manager',
      category: 'Commerce',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'DB unavailable',
      reason: `Cannot verify managed_short_links table: ${configError}`,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const [links, clicks, advancedCol, apiKeySetting] = await Promise.all([
      client.from('managed_short_links').select('id', { count: 'exact', head: true }),
      client.from('managed_short_link_clicks').select('id', { count: 'exact', head: true }),
      client.from('managed_short_links').select('id, enable_landing, password_hash').limit(1),
      client
        .from('system_settings')
        .select('setting_value')
        .eq('setting_key', 'link_manager_api_key')
        .maybeSingle(),
    ]);
    const responseTime = Date.now() - start;
    if (links.error) {
      return {
        name: 'Link Manager',
        category: 'Commerce',
        status: 'down',
        responseTime,
        message: links.error.message,
        reason: 'managed_short_links table missing. Run migration 303_managed_short_links.sql.',
        quickFix: {
          label: 'Open Link Manager',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/link-manager' },
        },
        lastChecked: new Date().toISOString(),
      };
    }
    if (clicks.error) {
      return {
        name: 'Link Manager',
        category: 'Commerce',
        status: 'degraded',
        responseTime,
        message: 'Links OK, click events table issue',
        reason: clicks.error.message,
        quickFix: {
          label: 'Open Link Manager',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/link-manager' },
        },
        lastChecked: new Date().toISOString(),
      };
    }
    const advancedReady = !advancedCol.error;
    const apiKeyConfigured = Boolean(String(apiKeySetting.data?.setting_value || '').trim());
    const status = advancedReady ? 'healthy' : 'degraded';
    return {
      name: 'Link Manager',
      category: 'Commerce',
      status,
      responseTime,
      message: `${links.count || 0} links · ${clicks.count || 0} clicks · advanced ${advancedReady ? 'ON' : 'needs 312'} · API key ${apiKeyConfigured ? 'set' : 'off'}`,
      reason: advancedReady
        ? 'Advanced short links: device/geo/AB, password, landing, OG, webhooks, /s/{code} + /l/{code}.'
        : 'Base Link Manager OK. Run database/312_managed_short_links_advanced.sql for advanced fields.',
      quickFix: {
        label: 'Open Link Manager',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/link-manager' },
      },
      lastChecked: new Date().toISOString(),
      details: {
        links: links.count || 0,
        clicks: clicks.count || 0,
        advancedReady,
        apiKeyConfigured,
      },
    };
  } catch (e: any) {
    return {
      name: 'Link Manager',
      category: 'Commerce',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Check failed',
      reason: `Link Manager health check failed: ${e.message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkSmartTools(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'Smart Tools',
      category: 'Operations',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'DB unavailable',
      reason: `Cannot verify smart_tools table: ${configError}`,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { data, error, count } = await client
      .from('smart_tools')
      .select('tool_id, allowed_phones', { count: 'exact' })
      .limit(20);
    const responseTime = Date.now() - start;

    if (error) {
      const msg = String(error.message || '');
      const missingPhones = /allowed_phones/i.test(msg);
      const missingTable = /does not exist|42P01|PGRST205/i.test(msg);
      return {
        name: 'Smart Tools',
        category: 'Operations',
        status: 'down',
        responseTime,
        message: msg || 'smart_tools query failed',
        reason: missingPhones
          ? 'allowed_phones column missing. Run migration 306_smart_tools_allowed_phones.sql.'
          : missingTable
            ? 'smart_tools table missing. Run migration 235_smart_tools_handler.sql (+ 236, 306).'
            : msg,
        quickFix: {
          label: 'Open Smart Tools',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/smart-tools' },
        },
        lastChecked: new Date().toISOString(),
      };
    }

    const phoneUnlocks = (data || []).reduce((sum: number, row: any) => {
      const phones = Array.isArray(row?.allowed_phones) ? row.allowed_phones.length : 0;
      return sum + phones;
    }, 0);

    return {
      name: 'Smart Tools',
      category: 'Operations',
      status: 'healthy',
      responseTime,
      message: `${count || 0} tools · ${phoneUnlocks} phone unlocks`,
      reason: 'Mobile Smart Tools config with membership + manual phone unlock.',
      quickFix: {
        label: 'Open Smart Tools',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/smart-tools' },
      },
      lastChecked: new Date().toISOString(),
      details: { tools: count || 0, phoneUnlocks },
    };
  } catch (e: any) {
    return {
      name: 'Smart Tools',
      category: 'Operations',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Check failed',
      reason: `Smart Tools health check failed: ${e.message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkUniversalLink(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'Universal Link',
      category: 'Commerce',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'DB unavailable',
      reason: `Cannot verify app download tracking: ${configError}`,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const [tableCheck, recentEvents] = await Promise.all([
      client.from('customer_analytics_events').select('id', { count: 'exact', head: true }),
      client
        .from('customer_analytics_events')
        .select('id', { count: 'exact', head: true })
        .eq('event_name', 'app_download_link_click')
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
    ]);
    const responseTime = Date.now() - start;

    if (tableCheck.error) {
      return {
        name: 'Universal Link',
        category: 'Commerce',
        status: 'down',
        responseTime,
        message: tableCheck.error.message,
        reason: 'customer_analytics_events table missing. Run migration 141_customer_profile_modules.sql.',
        quickFix: {
          label: 'Open Universal Link',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/universal-link' },
        },
        lastChecked: new Date().toISOString(),
      };
    }

    if (recentEvents.error) {
      return {
        name: 'Universal Link',
        category: 'Commerce',
        status: 'degraded',
        responseTime,
        message: 'Analytics table OK, event query issue',
        reason: recentEvents.error.message,
        quickFix: {
          label: 'Open Universal Link',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/universal-link' },
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      name: 'Universal Link',
      category: 'Commerce',
      status: 'healthy',
      responseTime,
      message: `${recentEvents.count || 0} app download opens in last 30 days`,
      reason: '/go/myfngapp smart redirect with iOS/Android tracking via customer_analytics_events.',
      quickFix: {
        label: 'Open Universal Link',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/universal-link' },
      },
      lastChecked: new Date().toISOString(),
      details: { events_30d: recentEvents.count || 0 },
    };
  } catch (e: any) {
    return {
      name: 'Universal Link',
      category: 'Commerce',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Check failed',
      reason: `Universal Link health check failed: ${e.message}`,
      lastChecked: new Date().toISOString(),
    };
  }
}

/** iOS AASA + Android assetlinks for Refer & Rise /refer/* deep links. */
async function checkAppAssociationFiles(): Promise<HealthCheck> {
  const start = Date.now();
  const origin = (process.env.NEXT_PUBLIC_SITE_URL || 'https://myfng.in').replace(/\/$/, '');
  const aasaUrl = `${origin}/.well-known/apple-app-site-association`;
  const assetlinksUrl = `${origin}/.well-known/assetlinks.json`;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const [aasaRes, assetsRes] = await Promise.all([
      fetch(aasaUrl, { signal: controller.signal, cache: 'no-store' }),
      fetch(assetlinksUrl, { signal: controller.signal, cache: 'no-store' }),
    ]);
    clearTimeout(timer);

    const aasaText = aasaRes.ok ? await aasaRes.text() : '';
    const assetsJson = assetsRes.ok ? await assetsRes.json().catch(() => null) : null;
    const hasRefer =
      aasaText.includes('/refer/*') || aasaText.includes('"/refer');
    const hasAppId = aasaText.includes('JUN6TX4JD3.com.myfng.app');
    const fingerprints = Array.isArray(assetsJson)
      ? (assetsJson[0]?.target?.sha256_cert_fingerprints as string[] | undefined) || []
      : [];

    if (!aasaRes.ok || !hasRefer || !hasAppId) {
      return {
        name: 'App Deep Links (AASA)',
        category: 'Operations',
        status: 'down',
        responseTime: Date.now() - start,
        message: !aasaRes.ok ? `AASA HTTP ${aasaRes.status}` : 'AASA missing /refer or appID',
        reason: `Host AASA at ${aasaUrl} with appID JUN6TX4JD3.com.myfng.app and path /refer/*.`,
        quickFix: {
          label: 'Refer Deep Links admin',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/refer-and-rise' },
        },
        lastChecked: new Date().toISOString(),
        details: { aasaUrl, status: aasaRes.status },
      };
    }

    if (!assetsRes.ok) {
      return {
        name: 'App Deep Links (AASA)',
        category: 'Operations',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'iOS AASA OK · Android assetlinks missing',
        reason: `Serve ${assetlinksUrl} and set ANDROID_APP_LINK_SHA256 for App Links verification.`,
        lastChecked: new Date().toISOString(),
      };
    }

    if (!fingerprints.length) {
      return {
        name: 'App Deep Links (AASA)',
        category: 'Operations',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'iOS AASA OK · Android fingerprints not set',
        reason:
          'Set env ANDROID_APP_LINK_SHA256 (Play App Signing SHA-256) so Android App Links auto-verify.',
        lastChecked: new Date().toISOString(),
        details: { aasaUrl, assetlinksUrl },
      };
    }

    return {
      name: 'App Deep Links (AASA)',
      category: 'Operations',
      status: 'healthy',
      responseTime: Date.now() - start,
      message: 'AASA + assetlinks OK (/refer/*)',
      reason: 'iOS Universal Links and Android App Links association files are reachable.',
      lastChecked: new Date().toISOString(),
      details: { aasaUrl, assetlinksUrl, fingerprints: fingerprints.length },
    };
  } catch (e: any) {
    return {
      name: 'App Deep Links (AASA)',
      category: 'Operations',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: e?.message || 'AASA check failed',
      reason: 'Could not fetch association files (timeout or network).',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkTelecallerLeadWhatsApp(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const {
      getTelecallerNewLeadWhatsAppSettings,
      getTelecallerNewLeadTemplateStatus,
      TELECALLER_NEW_LEAD_TEMPLATE,
    } = await import('@/lib/services/telecallerNewLeadWhatsApp');

    const [settings, templateStatus] = await Promise.all([
      getTelecallerNewLeadWhatsAppSettings(),
      getTelecallerNewLeadTemplateStatus(),
    ]);

    if (!settings.enabled) {
      return {
        name: 'Telecaller Lead WhatsApp',
        category: 'Notifications',
        status: 'healthy',
        responseTime: Date.now() - start,
        message: 'WhatsApp new-lead alerts disabled',
        reason: 'Enable under Telecaller Distribution → WhatsApp Alerts when ready.',
        quickFix: {
          label: 'Open WhatsApp Alerts',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/telecaller-distribution' },
        },
        lastChecked: new Date().toISOString(),
        details: { enabled: false, template: TELECALLER_NEW_LEAD_TEMPLATE.template_name },
      };
    }

    if (!templateStatus.canSendTemplate) {
      const categoryNote =
        templateStatus.metaCategory && templateStatus.metaCategory !== 'UTILITY'
          ? ` Meta category is ${templateStatus.metaCategory} (need UTILITY).`
          : '';
      return {
        name: 'Telecaller Lead WhatsApp',
        category: 'Notifications',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: `Enabled but template ${templateStatus.metaStatus || 'missing'}`,
        reason: `Create/approve Meta UTILITY template ${TELECALLER_NEW_LEAD_TEMPLATE.template_name} before live alerts.${categoryNote}`,
        quickFix: {
          label: 'Fix WhatsApp Alerts',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/telecaller-distribution' },
        },
        lastChecked: new Date().toISOString(),
        details: { enabled: true, templateStatus },
      };
    }

    return {
      name: 'Telecaller Lead WhatsApp',
      category: 'Notifications',
      status: 'healthy',
      responseTime: Date.now() - start,
      message: 'New-lead WhatsApp alerts ready',
      reason: 'Toggle ON and Meta template approved — sends with app push on assign.',
      quickFix: {
        label: 'WhatsApp Alerts',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/telecaller-distribution' },
      },
      lastChecked: new Date().toISOString(),
      details: { enabled: true, template: TELECALLER_NEW_LEAD_TEMPLATE.template_name },
    };
  } catch (e: any) {
    return {
      name: 'Telecaller Lead WhatsApp',
      category: 'Notifications',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: e?.message || 'Check failed',
      reason: 'Could not verify telecaller WhatsApp lead alert settings.',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkTelecallerCrmPermissions(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'Telecaller CRM Permissions',
      category: 'Operations',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'DB unavailable',
      reason: `Cannot verify telecaller_permission_templates: ${configError}`,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const [templates, columnProbe] = await Promise.all([
      client
        .from('telecaller_permission_templates')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true),
      client.from('users_login').select('crm_permission_template_id').limit(1),
    ]);
    const responseTime = Date.now() - start;
    const err = templates.error || columnProbe.error;
    if (err) {
      const missing =
        err.code === '42P01' ||
        String(err.message || '').includes('does not exist') ||
        String(err.message || '').includes('crm_permission_template');
      return {
        name: 'Telecaller CRM Permissions',
        category: 'Operations',
        status: 'down',
        responseTime,
        message: missing ? 'Migration not applied' : err.message,
        reason: missing
          ? 'Run database/313_telecaller_crm_permissions.sql — Lead Manager cannot assign caller access templates.'
          : `Permission templates inaccessible: ${err.message}`,
        quickFix: {
          label: 'Open LM Team',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/lead_manager/team' },
        },
        lastChecked: new Date().toISOString(),
      };
    }

    const count = templates.count || 0;
    return {
      name: 'Telecaller CRM Permissions',
      category: 'Operations',
      status: count > 0 ? 'healthy' : 'degraded',
      responseTime,
      message:
        count > 0
          ? `${count} active permission template(s)`
          : 'Table OK but no templates seeded',
      reason:
        count > 0
          ? 'TeleCRM-style caller access templates ready for Lead Manager Team page.'
          : 'Re-run 313 seed or create a Default Caller template on Team → Permission templates.',
      quickFix: {
        label: 'Manage templates',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/lead_manager/team' },
      },
      lastChecked: new Date().toISOString(),
      details: { templates: count },
    };
  } catch (e: any) {
    return {
      name: 'Telecaller CRM Permissions',
      category: 'Operations',
      status: 'down',
      responseTime: Date.now() - start,
      message: e.message || 'Check failed',
      reason: `CRM permissions health check failed: ${e.message}`,
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
    '/api/cron/telecaller-leads-shift-summary',
    '/api/cron/telecrm-push',
    '/api/cron/notifications?task=followup_reminder',
    '/api/cron/smartflo-recordings',
    '/api/cron/auto-dial-fresh-hours',
    '/api/cron/crm-ml-dl',
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

async function checkSmartfloClickToCall(): Promise<HealthCheck> {
  const start = Date.now();
  const cfg = await getClickToCallConfig();
  const gateway = cfg.gateway_url;
  const did = cfg.did;
  const provider = cfg.provider;

  if (!cfg.enabled) {
    return {
      name: 'Smartflo Click-to-Call',
      category: 'Third Party',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Click-to-call disabled in admin settings',
      reason: 'Enable under Super Admin → Click to Call.',
      lastChecked: new Date().toISOString(),
      quickFix: {
        label: 'Open Click to Call setup',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/click-to-call' },
      },
      details: { enabled: false, gateway, did, provider },
    };
  }

  try {
    // Probe host only — do not initiate a real call
    const u = new URL(gateway);
    const probe = await checkWithTimeout(() =>
      fetch(`${u.origin}/functions/v1`, { method: 'GET' }).catch(() =>
        fetch(u.origin, { method: 'HEAD' }),
      ),
    );
    const responseTime = Date.now() - start;
    const ok = Boolean(probe);
    return {
      name: 'Smartflo Click-to-Call',
      category: 'Third Party',
      status: ok ? (responseTime > 5000 ? 'degraded' : 'healthy') : 'degraded',
      responseTime,
      message: ok ? 'Click-to-call gateway host reachable' : 'Gateway probe inconclusive',
      reason: `Hits gateway URL with ?from=&to=&did=. Assigned DIDs are exclusive. Fresh auto-dial respects IST calling hours (${cfg.auto_dial_start || '10:00'}–${cfg.auto_dial_end || '19:00'}); off-hours catch-up via /api/cron/auto-dial-fresh-hours.`,
      lastChecked: new Date().toISOString(),
      quickFix: {
        label: 'Open Click to Call setup',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/click-to-call' },
      },
      details: {
        gateway,
        did,
        provider,
        enabled: true,
        exclusive_did_assignments: (cfg.did_assignments || []).filter((a) => a.telecaller_id)
          .length,
        unassigned_dids: (cfg.did_assignments || []).filter((a) => a.did && !a.telecaller_id)
          .length,
        auto_dial_on_fresh_assign: Boolean(cfg.auto_dial_on_fresh_assign),
        auto_dial_hours_enabled: Boolean(cfg.auto_dial_hours_enabled),
        auto_dial_window: `${cfg.auto_dial_start || '10:00'}–${cfg.auto_dial_end || '19:00'} IST`,
        auto_dial_days: cfg.auto_dial_days,
        auto_dial_open_now: evaluateAutoDialWindow(cfg, null).allowed,
        catchup_cron: '/api/cron/auto-dial-fresh-hours',
        has_gateway_key: Boolean(cfg.gateway_key),
        has_smartflo_api_token: Boolean(cfg.smartflo_api_token),
        env: {
          CLICK_TO_CALL_GATEWAY_URL: Boolean(process.env.CLICK_TO_CALL_GATEWAY_URL),
          CLICK_TO_CALL_DID: Boolean(process.env.CLICK_TO_CALL_DID),
          CLICK_TO_CALL_PROVIDER: Boolean(process.env.CLICK_TO_CALL_PROVIDER),
          CLICK_TO_CALL_GATEWAY_KEY: Boolean(
            process.env.CLICK_TO_CALL_GATEWAY_KEY || process.env.CLICK_TO_CALL_ANON_KEY,
          ),
          SMARTFLO_API_TOKEN: Boolean(process.env.SMARTFLO_API_TOKEN),
        },
      },
    };
  } catch (e: any) {
    return {
      name: 'Smartflo Click-to-Call',
      category: 'Third Party',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Click-to-call gateway unreachable',
      reason: `${e.message}. Check gateway URL on Click to Call setup.`,
      lastChecked: new Date().toISOString(),
      quickFix: {
        label: 'Open Click to Call setup',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/click-to-call' },
      },
      details: { gateway, did, provider },
    };
  }
}

async function checkSmartfloRecordings(): Promise<HealthCheck> {
  const start = Date.now();
  const cfg = await getClickToCallConfig();
  const hasToken = Boolean(cfg.smartflo_api_token || process.env.SMARTFLO_API_TOKEN);

  if (!hasToken) {
    return {
      name: 'Smartflo Call Recordings',
      category: 'Third Party',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Smartflo API token (c2c) missing',
      reason:
        'Save the c2c token under Super Admin → Click to Call to pull CDR recording_url into CRM.',
      lastChecked: new Date().toISOString(),
      quickFix: {
        label: 'Open Click to Call setup',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/click-to-call' },
      },
      details: {
        has_token: false,
        cron: '/api/cron/smartflo-recordings',
        webhook: '/api/webhooks/smartflo',
      },
    };
  }

  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return {
        name: 'Smartflo Call Recordings',
        category: 'Third Party',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'Admin DB client unavailable',
        reason: 'Cannot verify smartflo_call_recordings table.',
        lastChecked: new Date().toISOString(),
      };
    }

    const { error: tableErr } = await supabaseAdmin
      .from('smartflo_call_recordings')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (tableErr) {
      const missing =
        /does not exist|schema cache|relation/i.test(tableErr.message || '') ||
        tableErr.code === '42P01' ||
        tableErr.code === 'PGRST205';
      return {
        name: 'Smartflo Call Recordings',
        category: 'Third Party',
        status: missing ? 'degraded' : 'healthy',
        responseTime: Date.now() - start,
        message: missing
          ? 'Migration pending: smartflo_call_recordings'
          : 'Token saved; table probe inconclusive',
        reason: missing
          ? 'Run database/337_smartflo_call_recordings.sql on Supabase, then Sync recordings.'
          : tableErr.message,
        lastChecked: new Date().toISOString(),
        quickFix: {
          label: 'Open Click to Call setup',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/click-to-call' },
        },
        details: { table_error: tableErr.message, has_token: true },
      };
    }

    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const { count: withRec } = await supabaseAdmin
      .from('smartflo_call_recordings')
      .select('id', { count: 'exact', head: true })
      .not('recording_url', 'is', null)
      .gte('created_at', since);

    let cronEnabled = true;
    let cronInterval = 15;
    try {
      const { getSmartfloRecordingsCronSettings } = await import(
        '@/lib/telecaller/smartfloRecordingsCronSettings'
      );
      const cron = await getSmartfloRecordingsCronSettings();
      cronEnabled = cron.enabled;
      cronInterval = cron.interval_minutes;
    } catch {
      /* ignore */
    }

    return {
      name: 'Smartflo Call Recordings',
      category: 'Third Party',
      status: cronEnabled ? 'healthy' : 'degraded',
      responseTime: Date.now() - start,
      message: cronEnabled
        ? `CDR sync ready · every ${cronInterval}m`
        : 'CDR cron is OFF in admin',
      reason: cronEnabled
        ? `${withRec || 0} recording URL(s) ingested in last 48h. Cron /api/cron/smartflo-recordings every ${cronInterval}m (admin); webhook /api/webhooks/smartflo optional.`
        : 'Enable Smartflo recordings cron on WhatsApp Cron Jobs page to resume auto-sync.',
      lastChecked: new Date().toISOString(),
      quickFix: {
        label: 'Open recordings cron controls',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/whatsapp-cron' },
      },
      details: {
        has_token: true,
        recordings_48h: withRec || 0,
        cron_enabled: cronEnabled,
        cron_interval_minutes: cronInterval,
        cron: '/api/cron/smartflo-recordings',
        webhook: '/api/webhooks/smartflo',
        SMARTFLO_WEBHOOK_SECRET: Boolean(process.env.SMARTFLO_WEBHOOK_SECRET),
      },
    };
  } catch (e: any) {
    return {
      name: 'Smartflo Call Recordings',
      category: 'Third Party',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Recordings check failed',
      reason: e?.message || String(e),
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkSmartfloDialSessions(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return {
        name: 'Smartflo Live Dial UI',
        category: 'Third Party',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'Admin DB client unavailable',
        reason: 'Cannot verify smartflo_dial_sessions.',
        lastChecked: new Date().toISOString(),
      };
    }

    const { error } = await supabaseAdmin
      .from('smartflo_dial_sessions')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      const missing =
        /does not exist|schema cache|relation/i.test(error.message || '') ||
        error.code === '42P01' ||
        error.code === 'PGRST205';
      return {
        name: 'Smartflo Live Dial UI',
        category: 'Third Party',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: missing
          ? 'Migration pending: smartflo_dial_sessions'
          : 'Dial sessions probe inconclusive',
        reason: missing
          ? 'Run database/338_smartflo_dial_sessions.sql. Dialer waits for Smartflo answer webhook before showing duration.'
          : error.message,
        lastChecked: new Date().toISOString(),
        quickFix: {
          label: 'Open Click to Call setup',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/click-to-call' },
        },
        details: {
          migration: 'database/338_smartflo_dial_sessions.sql',
          webhook: '/api/webhooks/smartflo',
          trigger: 'Call answered by Customer (Click to call)',
        },
      };
    }

    return {
      name: 'Smartflo Live Dial UI',
      category: 'Third Party',
      status: 'healthy',
      responseTime: Date.now() - start,
      message: 'Dial sessions table ready',
      reason:
        'Live duration only after Smartflo webhook “Call answered by Customer (Click to call)” → /api/webhooks/smartflo.',
      lastChecked: new Date().toISOString(),
      details: {
        table: 'smartflo_dial_sessions',
        webhook: '/api/webhooks/smartflo',
        poll: '/api/telecaller/crm/dial-session',
      },
    };
  } catch (e: any) {
    return {
      name: 'Smartflo Live Dial UI',
      category: 'Third Party',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Dial sessions check failed',
      reason: e?.message || String(e),
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkCallIntelligence(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return {
        name: 'Call Intelligence',
        category: 'Database',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'Admin DB client unavailable',
        reason: 'Cannot verify telecaller_call_analyses.',
        lastChecked: new Date().toISOString(),
      };
    }

    const { count, error } = await supabaseAdmin
      .from('telecaller_call_analyses')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    const playbookProbe = await supabaseAdmin
      .from('ai_sales_playbook')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    const leadIqProbe = await supabaseAdmin
      .from('telecaller_lead_iq')
      .select('id', { count: 'exact', head: true })
      .limit(1);
    const agentsProbe = await supabaseAdmin
      .from('call_iq_agents')
      .select('id', { count: 'exact', head: true })
      .limit(1);

    if (error) {
      const missing =
        /does not exist|schema cache|relation/i.test(error.message || '') ||
        error.code === '42P01' ||
        error.code === 'PGRST205';
      return {
        name: 'Call Intelligence',
        category: 'Database',
        status: missing ? 'degraded' : 'healthy',
        responseTime: Date.now() - start,
        message: missing
          ? 'Migration pending: telecaller_call_analyses'
          : 'Analyses table probe inconclusive',
        reason: missing
          ? 'Run database/339_telecaller_call_analyses.sql so free quality/sentiment scores persist.'
          : error.message,
        lastChecked: new Date().toISOString(),
        quickFix: {
          label: 'Open Call Intelligence',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/call-intelligence' },
        },
        details: {
          migration: 'database/339_telecaller_call_analyses.sql',
          engine: 'free_heuristics_v1',
          paid_ai: false,
        },
      };
    }

    const playbookMissing =
      playbookProbe.error &&
      (/does not exist|schema cache|relation/i.test(playbookProbe.error.message || '') ||
        playbookProbe.error.code === '42P01' ||
        playbookProbe.error.code === 'PGRST205');
    const leadIqMissing =
      leadIqProbe.error &&
      (/does not exist|schema cache|relation/i.test(leadIqProbe.error.message || '') ||
        leadIqProbe.error.code === '42P01' ||
        leadIqProbe.error.code === 'PGRST205');

    if (playbookMissing || leadIqMissing) {
      return {
        name: 'Call Intelligence',
        category: 'Database',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'AI Suite migration pending',
        reason: 'Run database/348_ai_suite_call_lead_iq.sql for Sales Playbook, SOP audit, and Lead IQ.',
        lastChecked: new Date().toISOString(),
        quickFix: {
          label: 'Open AI Suite',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/ai-suite' },
        },
        details: {
          migration: 'database/348_ai_suite_call_lead_iq.sql',
          playbook: playbookMissing ? 'missing' : 'ok',
          lead_iq: leadIqMissing ? 'missing' : 'ok',
        },
      };
    }

    return {
      name: 'Call Intelligence',
      category: 'Database',
      status: 'healthy',
      responseTime: Date.now() - start,
      message: 'Call IQ + Lead IQ tables ready',
      reason: `${typeof count === 'number' ? count : 0} call analyses. SOP + playbook + Lead IQ ready. Recording-complete workflow (duration ≥90s) auto-runs Call Audit SOP.`,
      lastChecked: new Date().toISOString(),
      quickFix: {
        label: 'Open AI Suite',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/ai-suite' },
      },
      details: {
        table: 'telecaller_call_analyses',
        playbook_table: 'ai_sales_playbook',
        lead_iq_table: 'telecaller_lead_iq',
        page: '/dashboard/super_admin/ai-suite',
        agents_migration: 'database/351_call_iq_agents.sql',
        call_iq_agents:
          agentsProbe.error &&
          (/does not exist|schema cache|relation/i.test(agentsProbe.error.message || '') ||
            agentsProbe.error.code === '42P01' ||
            agentsProbe.error.code === 'PGRST205')
            ? 'missing'
            : 'ok',
      },
    };
  } catch (e: any) {
    return {
      name: 'Call Intelligence',
      category: 'Database',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Call Intelligence check failed',
      reason: e?.message || String(e),
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkCrmMlDl(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return {
        name: 'CRM ML + DL',
        category: 'AI',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'Admin DB client unavailable',
        reason: 'Cannot verify telecaller_lead_scores / telecaller_call_dl.',
        lastChecked: new Date().toISOString(),
      };
    }

    const scoresProbe = await supabaseAdmin
      .from('telecaller_lead_scores')
      .select('lead_id', { count: 'exact', head: true })
      .limit(1);
    const dlProbe = await supabaseAdmin
      .from('telecaller_call_dl')
      .select('call_log_id', { count: 'exact', head: true })
      .limit(1);
    const embedProbe = await supabaseAdmin
      .from('telecaller_lead_embeddings')
      .select('lead_id', { count: 'exact', head: true })
      .limit(1);

    const missingRel = (err: { message?: string; code?: string } | null) =>
      Boolean(
        err &&
          (/does not exist|schema cache|relation/i.test(err.message || '') ||
            err.code === '42P01' ||
            err.code === 'PGRST205'),
      );

    if (missingRel(scoresProbe.error) || missingRel(dlProbe.error) || missingRel(embedProbe.error)) {
      return {
        name: 'CRM ML + DL',
        category: 'AI',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'Migration pending: CRM ML + DL tables',
        reason: 'Run database/354_crm_ml_dl_insights.sql so lead scores, voice transcripts, and similar-lead embeddings persist.',
        lastChecked: new Date().toISOString(),
        quickFix: {
          label: 'Open telecaller leads',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/telecaller/leads' },
        },
        details: {
          migration: 'database/354_crm_ml_dl_insights.sql',
          scores: missingRel(scoresProbe.error) ? 'missing' : 'ok',
          call_dl: missingRel(dlProbe.error) ? 'missing' : 'ok',
          embeddings: missingRel(embedProbe.error) ? 'missing' : 'ok',
        },
      };
    }

    const openAiReady = Boolean(process.env.OPENAI_API_KEY?.trim());
    const autoOn = String(process.env.CRM_DL_AUTO_TRANSCRIBE || '1').trim() !== '0';
    const since = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString();
    const recents = await supabaseAdmin
      .from('telecaller_call_logs')
      .select('id', { count: 'exact', head: true })
      .not('call_recording_url', 'is', null)
      .gte('call_duration', 20)
      .not('lead_id', 'is', null)
      .gte('created_at', since);

    const dlRecent = await supabaseAdmin
      .from('telecaller_call_dl')
      .select('call_log_id', { count: 'exact', head: true })
      .gte('processed_at', since)
      .not('transcript', 'is', null);

    const recordings48h = typeof recents.count === 'number' ? recents.count : 0;
    const transcribed48h = typeof dlRecent.count === 'number' ? dlRecent.count : 0;
    const overdue = Math.max(0, recordings48h - transcribed48h);

    let status: 'healthy' | 'degraded' | 'down' = 'healthy';
    let message = 'ML scores + DL voice pipeline ready';
    let reason = `${typeof scoresProbe.count === 'number' ? scoresProbe.count : 0} lead scores. Cron /api/cron/crm-ml-dl every 10m.`;
    if (!openAiReady) {
      status = 'degraded';
      message = 'ML scores work; DL voice needs OpenAI';
      reason = 'OPENAI_API_KEY missing — conversion score still runs, Whisper/emotion/similar leads will not.';
    } else if (autoOn && overdue >= 12) {
      status = 'degraded';
      message = 'DL transcripts falling behind';
      reason = `${overdue} recordings (last 48h, ≥20s) without a stored transcript. Check cron /api/cron/crm-ml-dl and OpenAI quota.`;
    }

    return {
      name: 'CRM ML + DL',
      category: 'AI',
      status,
      responseTime: Date.now() - start,
      message,
      reason,
      lastChecked: new Date().toISOString(),
      quickFix: {
        label: 'Open telecaller leads',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/telecaller/leads' },
      },
      details: {
        migration: 'database/354_crm_ml_dl_insights.sql',
        cron: '/api/cron/crm-ml-dl',
        openai: openAiReady,
        auto_transcribe: autoOn,
        scores: scoresProbe.count ?? 0,
        transcripts_48h: transcribed48h,
        recordings_48h: recordings48h,
      },
    };
  } catch (e: any) {
    return {
      name: 'CRM ML + DL',
      category: 'AI',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'CRM ML + DL check failed',
      reason: e?.message || String(e),
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

async function checkCrmManagerOpsTables(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const { getSupabaseAdmin } = await import('@/lib/push/supabaseAdmin');
    const { supabaseAdmin } = getSupabaseAdmin();
    if (!supabaseAdmin) {
      return {
        name: 'CRM Manager Ops Tables',
        category: 'Operations',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'Admin client unavailable',
        reason: 'Cannot verify crm_lead_tags / statuses / saved views / WA DND',
        lastChecked: new Date().toISOString(),
      };
    }

    const tables = ['crm_lead_tags', 'crm_lead_statuses', 'crm_lost_reasons', 'crm_saved_views', 'whatsapp_dnd_numbers'] as const;
    const missing: string[] = [];
    for (const table of tables) {
      const { error } = await supabaseAdmin.from(table).select('id').limit(1);
      if (error && /does not exist|relation|Could not find/i.test(String(error.message || ''))) {
        missing.push(table);
      }
    }

    const { error: loginGeoErr } = await supabaseAdmin
      .from('user_login_history')
      .select('id, ip_address, latitude, device_label')
      .limit(1);
    if (
      loginGeoErr &&
      /does not exist|relation|Could not find|column|ip_address|latitude|device_label/i.test(
        String(loginGeoErr.message || ''),
      )
    ) {
      missing.push('user_login_history.geo (330)');
    }

    if (missing.length) {
      return {
        name: 'CRM Manager Ops Tables',
        category: 'Operations',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: `Missing: ${missing.join(', ')}`,
        reason: 'Run CRM SQL migrations incl. database/330_user_login_history_geo.sql',
        quickFix: {
          label: 'Open SQL migrations',
          action: 'external-link',
          actionPayload: { url: '/dashboard/super_admin/system-monitor' },
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      name: 'CRM Manager Ops Tables',
      category: 'Operations',
      status: 'healthy',
      responseTime: Date.now() - start,
      message: 'Tags, saved views, WA DND, login geo OK',
      lastChecked: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      name: 'CRM Manager Ops Tables',
      category: 'Operations',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: e?.message || 'Check failed',
      reason: String(e?.message || e),
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
    Compliance: 5,
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

async function checkWhatsAppWorkflows(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'WhatsApp Workflow Builder',
      category: 'WhatsApp',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'Cannot check (DB unavailable)',
      reason: configError || 'No admin client',
      quickFix: {
        label: 'Open Workflow Builder',
        action: 'external-link',
        actionPayload: { url: '/dashboard/super_admin/whatsapp-workflows' },
      },
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { error: flowsErr } = await checkWithTimeout(() =>
      client.from('bot_flows').select('id', { count: 'exact', head: true }),
    );
    if (flowsErr) {
      return {
        name: 'WhatsApp Workflow Builder',
        category: 'WhatsApp',
        status: 'down',
        responseTime: Date.now() - start,
        message: 'bot_flows table missing/unreadable',
        reason: flowsErr.message,
        quickFix: {
          label: 'Open Bot Flow',
          action: 'external-link',
          actionPayload: { url: '/dashboard/super_admin/bot-flow' },
        },
        lastChecked: new Date().toISOString(),
      };
    }

    const { error: runsErr } = await checkWithTimeout(() =>
      client.from('bot_flow_runs').select('id', { count: 'exact', head: true }),
    );
    const responseTime = Date.now() - start;
    if (runsErr && (/does not exist|42P01/i.test(String(runsErr.message || '')) || runsErr.code === '42P01')) {
      return {
        name: 'WhatsApp Workflow Builder',
        category: 'WhatsApp',
        status: 'degraded',
        responseTime,
        message: 'Flows OK — run migration 315 for executions',
        reason: 'bot_flow_runs table missing. Apply database/315_whatsapp_workflow_builder.sql',
        quickFix: {
          label: 'Open Workflow Builder',
          action: 'external-link',
          actionPayload: { url: '/dashboard/super_admin/whatsapp-workflows' },
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      name: 'WhatsApp Workflow Builder',
      category: 'WhatsApp',
      status: 'healthy',
      responseTime,
      message: 'Bot flows + execution log ready',
      reason: 'Synced with admin Workflow Builder / Bot Flow canvas and inbound WhatsApp executor',
      quickFix: {
        label: 'Open Workflow Builder',
        action: 'external-link',
        actionPayload: { url: '/dashboard/super_admin/whatsapp-workflows' },
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      name: 'WhatsApp Workflow Builder',
      category: 'WhatsApp',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Workflow check failed',
      reason: e?.message || 'Unknown error',
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkTelecallerCallbackReminders(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'Telecaller Callback Reminders',
      category: 'Operations',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'Cannot check (DB unavailable)',
      reason: configError || 'No admin client',
      quickFix: {
        label: 'Open Reminders',
        action: 'external-link',
        actionPayload: { url: '/dashboard/telecaller/followups' },
      },
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const nowIso = new Date().toISOString();
    const { count, error } = await checkWithTimeout(() =>
      client
        .from('telecaller_follow_ups')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'PENDING')
        .lt('scheduled_time', nowIso)
        .eq('reminder_sent', false),
    );

    if (error) {
      const msg = String(error.message || '');
      if (/relation|does not exist|telecaller_follow_ups/i.test(msg)) {
        return {
          name: 'Telecaller Callback Reminders',
          category: 'Operations',
          status: 'degraded',
          responseTime: Date.now() - start,
          message: 'Follow-ups table missing',
          reason: msg,
          lastChecked: new Date().toISOString(),
        };
      }
      return {
        name: 'Telecaller Callback Reminders',
        category: 'Operations',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'Could not query overdue reminders',
        reason: msg,
        lastChecked: new Date().toISOString(),
      };
    }

    const overdue = Number(count || 0);
    const cronOk = Boolean(process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET);
    if (!cronOk) {
      return {
        name: 'Telecaller Callback Reminders',
        category: 'Operations',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'CRON_SECRET missing — reminder cron cannot auth',
        reason: 'Set CRON_SECRET for /api/cron/notifications?task=followup_reminder',
        quickFix: {
          label: 'Open Reminders',
          action: 'external-link',
          actionPayload: { url: '/dashboard/telecaller/followups' },
        },
        lastChecked: new Date().toISOString(),
      };
    }

    return {
      name: 'Telecaller Callback Reminders',
      category: 'Operations',
      status: overdue > 25 ? 'degraded' : 'healthy',
      responseTime: Date.now() - start,
      message:
        overdue > 0
          ? `${overdue} overdue callback(s) without reminder_sent`
          : 'Callback reminder cron wired (every 5 min)',
      reason: overdue > 25 ? 'Many overdue unsent reminders — check cron logs' : undefined,
      quickFix: {
        label: 'Open Reminders',
        action: 'external-link',
        actionPayload: { url: '/dashboard/telecaller/followups' },
      },
      lastChecked: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      name: 'Telecaller Callback Reminders',
      category: 'Operations',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'Reminder check failed',
      reason: e?.message || String(e),
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkWhatsAppChatReads(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'WhatsApp Inbox Read State',
      category: 'WhatsApp',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'Cannot check (DB unavailable)',
      reason: configError || 'No admin client',
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { error } = await checkWithTimeout(() =>
      client.from('whatsapp_chat_reads').select('phone', { count: 'exact', head: true }),
    );
    const responseTime = Date.now() - start;
    if (error && (/does not exist|42P01/i.test(String(error.message || '')) || error.code === '42P01')) {
      return {
        name: 'WhatsApp Inbox Read State',
        category: 'WhatsApp',
        status: 'degraded',
        responseTime,
        message: 'Read receipts table missing',
        reason: 'whatsapp_chat_reads missing. Apply database/318_whatsapp_chat_reads.sql so unread badges clear after opening a chat.',
        quickFix: {
          label: 'Open WhatsApp Inbox',
          action: 'external-link',
          actionPayload: { url: '/dashboard/lead_manager' },
        },
        lastChecked: new Date().toISOString(),
      };
    }
    if (error) {
      return {
        name: 'WhatsApp Inbox Read State',
        category: 'WhatsApp',
        status: 'degraded',
        responseTime,
        message: 'Read table unreadable',
        reason: error.message,
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      name: 'WhatsApp Inbox Read State',
      category: 'WhatsApp',
      status: 'healthy',
      responseTime,
      message: 'Unread clear-on-open ready',
      reason: 'whatsapp_chat_reads table is available for per-user inbox read receipts.',
      lastChecked: new Date().toISOString(),
    };
  } catch (e: any) {
    return {
      name: 'WhatsApp Inbox Read State',
      category: 'WhatsApp',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: e?.message || 'Check failed',
      reason: e?.message || String(e),
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkTelecallerLeadsShiftSummary(): Promise<HealthCheck> {
  const start = Date.now();
  const cronSecret = Boolean(process.env.CRON_SECRET || process.env.NOTIFICATION_CRON_SECRET);
  const { client } = getAdminClient();

  if (!cronSecret) {
    return {
      name: 'Telecaller Leads Shift WA',
      category: 'WhatsApp',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'CRON_SECRET missing',
      reason: 'Shift summary cron at 7pm IST needs CRON_SECRET to run /api/cron/telecaller-leads-shift-summary.',
      lastChecked: new Date().toISOString(),
    };
  }

  if (!client) {
    return {
      name: 'Telecaller Leads Shift WA',
      category: 'WhatsApp',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: 'DB unavailable for telecaller check',
      reason: 'Cannot verify TELECALLER role / users for shift lead summary.',
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const { data: roleRow, error: roleErr } = await checkWithTimeout(() =>
      client.from('roles').select('id').eq('role_code', 'TELECALLER').maybeSingle(),
    );
    if (roleErr || !roleRow?.id) {
      return {
        name: 'Telecaller Leads Shift WA',
        category: 'WhatsApp',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'TELECALLER role missing',
        reason: roleErr?.message || 'roles.role_code=TELECALLER not found',
        lastChecked: new Date().toISOString(),
      };
    }
    const { count, error } = await checkWithTimeout(() =>
      client
        .from('users_login')
        .select('id', { count: 'exact', head: true })
        .eq('role_id', roleRow.id),
    );
    if (error) {
      return {
        name: 'Telecaller Leads Shift WA',
        category: 'WhatsApp',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'Cannot count telecallers',
        reason: error.message,
        lastChecked: new Date().toISOString(),
      };
    }
    return {
      name: 'Telecaller Leads Shift WA',
      category: 'WhatsApp',
      status: 'healthy',
      responseTime: Date.now() - start,
      message: `Ready · ${(count || 0)} telecallers · 7pm IST shift`,
      reason:
        'Daily WhatsApp at 7:00 PM IST lists each TC lead count for previous 7pm→today 7pm. Recipients = system alert WhatsApp numbers. Schedule job wa-telecaller-leads-shift-summary in Supabase cron.',
      quickFix: {
        label: 'WhatsApp Cron',
        action: 'external-link',
        actionPayload: { url: '/dashboard/super_admin/whatsapp-cron' },
      },
      lastChecked: new Date().toISOString(),
      details: { telecallerCount: count || 0, cronPath: '/api/cron/telecaller-leads-shift-summary' },
    };
  } catch (e: any) {
    return {
      name: 'Telecaller Leads Shift WA',
      category: 'WhatsApp',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: e?.message || 'Check failed',
      reason: e?.message || String(e),
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkDltSms(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'DLT SMS (TRAI)',
      category: 'Notifications',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'DB unavailable',
      reason: `Cannot verify DLT SMS tables: ${configError}`,
      lastChecked: new Date().toISOString(),
    };
  }

  try {
    const [entityRes, headersRes, templatesRes, tmRes] = await Promise.all([
      client.from('dlt_sms_entity').select('pe_id, entity_status').eq('config_key', 'default').maybeSingle(),
      client.from('dlt_sms_headers').select('id, status', { count: 'exact' }),
      client.from('dlt_sms_templates').select('id, kind, status, dlt_template_id, provider_template_id'),
      client.from('dlt_sms_telemarketers').select('id, is_primary, is_active, api_key'),
    ]);
    const responseTime = Date.now() - start;
    const err = entityRes.error || headersRes.error || templatesRes.error || tmRes.error;
    if (err) {
      const missing = /does not exist|relation|42P01|PGRST205/i.test(err.message);
      return {
        name: 'DLT SMS (TRAI)',
        category: 'Notifications',
        status: 'down',
        responseTime,
        message: missing ? 'Migration not applied' : `Query failed: ${err.message}`,
        reason: missing
          ? 'Tables dlt_sms_* missing. Run database/352_dlt_sms.sql'
          : err.message,
        quickFix: {
          label: 'Open DLT SMS',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/dlt-sms' },
        },
        lastChecked: new Date().toISOString(),
      };
    }

    const entity = entityRes.data as { pe_id?: string; entity_status?: string } | null;
    const headers = headersRes.data || [];
    const templates = templatesRes.data || [];
    const tms = tmRes.data || [];
    const approvedHeaders = headers.filter((h: any) => h.status === 'APPROVED').length;
    const approvedContent = templates.filter(
      (t: any) =>
        t.kind === 'CONTENT' &&
        t.status === 'APPROVED' &&
        String(t.dlt_template_id || t.provider_template_id || '').trim(),
    ).length;
    const primaryTm = tms.some(
      (t: any) => t.is_primary && t.is_active && String(t.api_url || t.api_key || '').trim(),
    );
    const peOk = Boolean(entity?.pe_id) && entity?.entity_status === 'APPROVED';

    let status: ServiceStatus = 'healthy';
    let message = 'DLT registry ready to send';
    let reason = 'PE, approved header, content template, and primary gateway are configured.';
    if (!peOk || approvedHeaders === 0 || approvedContent === 0 || !primaryTm) {
      status = 'degraded';
      const missingBits = [
        !peOk ? 'approved PE ID' : '',
        approvedHeaders === 0 ? 'approved header' : '',
        approvedContent === 0 ? 'approved content template + DLT ID' : '',
        !primaryTm ? 'own operator HTTP pipe' : '',
      ].filter(Boolean);
      message = `Setup incomplete: ${missingBits.join(', ')}`;
      reason =
        'Finish Jio TrueConnect header/template approval, paste DLT IDs, and connect your own operator HTTP URL (no MSG91).';
    }

    return {
      name: 'DLT SMS (TRAI)',
      category: 'Notifications',
      status,
      responseTime,
      message,
      reason,
      quickFix: {
        label: 'Open DLT SMS',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/dlt-sms' },
      },
      lastChecked: new Date().toISOString(),
      details: {
        peId: entity?.pe_id || '',
        entityStatus: entity?.entity_status || 'NOT_REGISTERED',
        approvedHeaders,
        approvedContent,
        telemarketers: tms.length,
        hasPrimaryGateway: primaryTm,
      },
    };
  } catch (e: any) {
    return {
      name: 'DLT SMS (TRAI)',
      category: 'Notifications',
      status: 'down',
      responseTime: Date.now() - start,
      message: e?.message || 'Check failed',
      reason: String(e?.message || e),
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkMcpRemote(): Promise<HealthCheck> {
  const start = Date.now();
  try {
    const token = await getMcpHttpToken();
    const url = `${MCP_PUBLIC_ORIGIN}/api/mcp`;
    if (!token) {
      return {
        name: 'MyFNG MCP (Claude)',
        category: 'AI',
        status: 'degraded',
        responseTime: Date.now() - start,
        message: 'Remote MCP URL is live but token is missing',
        reason: 'Generate a bearer token on Super Admin → MyFNG MCP, then paste https://myfng.in/api/mcp into Claude Connectors.',
        quickFix: {
          label: 'Open MyFNG MCP',
          action: 'internal-link',
          actionPayload: { url: '/dashboard/super_admin/myfng-mcp' },
        },
        lastChecked: new Date().toISOString(),
        details: { url },
      };
    }
    return {
      name: 'MyFNG MCP (Claude)',
      category: 'AI',
      status: 'healthy',
      responseTime: Date.now() - start,
      message: `Claude connector ${url}`,
      reason: 'Bearer token is set. Add this HTTPS URL in Claude → Connectors (not a local file path).',
      quickFix: {
        label: 'Open MyFNG MCP',
        action: 'internal-link',
        actionPayload: { url: '/dashboard/super_admin/myfng-mcp' },
      },
      lastChecked: new Date().toISOString(),
      details: { url, hasToken: true },
    };
  } catch (e: any) {
    return {
      name: 'MyFNG MCP (Claude)',
      category: 'AI',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: e?.message || 'Check failed',
      reason: String(e?.message || e),
      lastChecked: new Date().toISOString(),
    };
  }
}

async function checkDpdpCompliance(): Promise<HealthCheck> {
  const start = Date.now();
  const { client, configError } = getAdminClient();
  if (!client) {
    return {
      name: 'DPDP consent & rights',
      category: 'Compliance',
      status: 'down',
      responseTime: Date.now() - start,
      message: 'DB unavailable',
      reason: configError || 'Cannot verify DPDP tables',
      lastChecked: new Date().toISOString(),
    };
  }
  try {
    const [consents, rights] = await Promise.all([
      client.from('dpdp_consent_records').select('id', { count: 'exact', head: true }),
      client.from('data_rights_requests').select('id', { count: 'exact', head: true }),
    ]);
    const responseTime = Date.now() - start;
    if (consents.error || rights.error) {
      return {
        name: 'DPDP consent & rights',
        category: 'Compliance',
        status: 'down',
        responseTime,
        message: consents.error?.message || rights.error?.message || 'Tables missing',
        reason: 'Run database/356_dpdp_consent_and_rights.sql so consent and data-rights requests persist.',
        lastChecked: new Date().toISOString(),
        quickFix: { label: 'Open Privacy Notice', action: 'internal-link', actionPayload: { href: '/privacy-notice' } },
      };
    }
    return {
      name: 'DPDP consent & rights',
      category: 'Compliance',
      status: 'healthy',
      responseTime,
      message: `Consent log ${consents.count || 0} · rights requests ${rights.count || 0}`,
      reason: 'dpdp_consent_records and data_rights_requests are available.',
      lastChecked: new Date().toISOString(),
      details: { consents: consents.count || 0, rights: rights.count || 0 },
    };
  } catch (e: any) {
    return {
      name: 'DPDP consent & rights',
      category: 'Compliance',
      status: 'degraded',
      responseTime: Date.now() - start,
      message: e?.message || 'Check failed',
      reason: e?.message || String(e),
      lastChecked: new Date().toISOString(),
    };
  }
}

/** Shared by System Monitor UI and cron WhatsApp health alerts. */
export async function runSystemMonitorChecks(): Promise<HealthCheck[]> {
  return Promise.all([
    checkDatabase(),
    checkSupabaseAuth(),
    checkSupabaseStorage(),
    checkWhatsAppAPI(),
    checkRazorpay(),
    checkFirebase(),
    checkPushCampaigns(),
    checkPushDevices(),
    checkDltSms(),
    checkMcpRemote(),
    checkEmailService(),
    checkWalletSystem(),
    checkAdvanceCoupons(),
    checkLinkManager(),
    checkSmartTools(),
    checkUniversalLink(),
    checkAppAssociationFiles(),
    checkTelecallerLeadWhatsApp(),
    checkTelecallerCrmPermissions(),
    checkTelecallerCallbackReminders(),
    checkCrmManagerOpsTables(),
    checkTelecallerLeadsShiftSummary(),
    checkRsaLeads(),
    checkOpenAI(),
    checkMisaAiMonitoring(),
    checkWhatsAppAgents(),
    checkWhatsAppWorkflows(),
    checkWhatsAppChatReads(),
    checkGoogleMaps(),
    checkCronJobs(),
    checkFeatureCrons(),
    checkSSL(),
    checkSARVTelephony(),
    checkSmartfloClickToCall(),
    checkSmartfloRecordings(),
    checkSmartfloDialSessions(),
    checkCallIntelligence(),
    checkCrmMlDl(),
    checkDpdpCompliance(),
  ]);
}

export async function GET() {
  try {
    const supabase = await createClient();
    const auth = await assertSuperAdmin(supabase);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.error }, { status: auth.status });
    }

    const checks = await runSystemMonitorChecks();

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
      ANDROID_APP_LINK_SHA256: !!String(process.env.ANDROID_APP_LINK_SHA256 || '').trim(),
      CLICK_TO_CALL_GATEWAY_URL: !!String(process.env.CLICK_TO_CALL_GATEWAY_URL || '').trim(),
      CLICK_TO_CALL_DID: !!String(process.env.CLICK_TO_CALL_DID || '').trim(),
      SMARTFLO_API_TOKEN: !!String(process.env.SMARTFLO_API_TOKEN || '').trim(),
      SMARTFLO_WEBHOOK_SECRET: !!String(process.env.SMARTFLO_WEBHOOK_SECRET || '').trim(),
      DLT_SMS_ADMIN: true,
      MYFNG_MCP_TOKEN: !!(process.env.MYFNG_MCP_TOKEN || '').trim(),
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
      const checks = await runSystemMonitorChecks();
      const downServices = checks.filter((c) => c.status === 'down');
      const degradedServices = checks.filter((c) => c.status === 'degraded');
      const healthyServices = checks.filter((c) => c.status === 'healthy');
      const summary = {
        timestamp,
        total: checks.length,
        healthy: healthyServices.length,
        degraded: degradedServices.length,
        down: downServices.length,
        services: checks.map((service) => ({
          name: service.name,
          status: service.status,
          message: service.message,
        })),
        downServices: downServices.map((service) => ({ name: service.name, message: service.message })),
        degradedServices: degradedServices.map((service) => ({ name: service.name })),
      };
      
      const results = [];
      for (const number of targetNumbers) {
        const result = await sendHealthAlertMessage(number.trim(), summary, {
          test: true,
          // Until v2 template is approved, send full lined report as plain text
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
    console.error('System monitor POST error:', error);
    const message = String(error?.message || 'Internal server error');
    return NextResponse.json({ error: message, message }, { status: 500 });
  }
}
