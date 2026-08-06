export type ApiServiceTier = 'free' | 'paid' | 'platform';

export type ApiServiceEntry = {
  id: string;
  name: string;
  tier: ApiServiceTier;
  category: string;
  description: string;
  billingModel: string;
  adminMenus: string[];
  envKeys?: string[];
  hasCostDashboard?: boolean;
  dashboardHref?: string;
  docsUrl?: string;
};

export const API_SERVICE_TIER_LABELS: Record<ApiServiceTier, string> = {
  free: 'Free / Self-hosted',
  paid: 'Paid / Metered',
  platform: 'Platform subscription',
};

export const API_SERVICES_CATALOG: ApiServiceEntry[] = [
  {
    id: 'supabase',
    name: 'Supabase',
    tier: 'platform',
    category: 'Database & Auth',
    description: 'Primary database, auth, storage, and RLS for almost all admin CRUD.',
    billingModel: 'Monthly Supabase plan (not per admin click)',
    adminMenus: ['Dashboard', 'Workshops', 'Bookings', 'Inventory', 'Customers', 'Users', 'Wallet', 'Coupons', 'Link Manager', 'Most admin pages'],
    envKeys: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'],
  },
  {
    id: 'link-manager',
    name: 'Link Manager (self-hosted)',
    tier: 'free',
    category: 'Marketing',
    description: 'Bitly-style short links, QR codes, and click tracking — stored in your DB.',
    billingModel: 'No third-party API charges',
    adminMenus: ['Link Manager', 'Universal Link'],
  },
  {
    id: 'vercel',
    name: 'Vercel Hosting',
    tier: 'platform',
    category: 'Infrastructure',
    description: 'Next.js app hosting and cron execution.',
    billingModel: 'Vercel plan + bandwidth',
    adminMenus: ['All admin (runtime)'],
  },
  {
    id: 'openai',
    name: 'OpenAI',
    tier: 'paid',
    category: 'AI',
    description: 'MISA chatbot, Admin AI Chat, WhatsApp bot brain, and content AI.',
    billingModel: 'Per token / model usage',
    adminMenus: ['MISA AI Dashboard', 'Admin AI Chat', 'Bot Flow', 'KB Manager'],
    envKeys: ['OPENAI_API_KEY', 'OPENAI_ADMIN_API_KEY', 'OPENAI_MODEL'],
    hasCostDashboard: true,
    dashboardHref: '/dashboard/super_admin/misa-ai',
    docsUrl: 'https://platform.openai.com/usage',
  },
  {
    id: 'whatsapp',
    name: 'WhatsApp Business (Meta)',
    tier: 'paid',
    category: 'Messaging',
    description: 'Outbound messages, templates, automation, calling, and system alerts.',
    billingModel: 'Per conversation / template (Meta pricing)',
    adminMenus: ['WhatsApp Dashboard', 'WhatsApp Settings', 'Message Logs', 'WhatsApp Chat', 'Templates', 'Automation', 'WhatsApp Cron', 'Bot Flow'],
    envKeys: ['WHATSAPP_ACCESS_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_BUSINESS_ACCOUNT_ID'],
    docsUrl: 'https://business.facebook.com/wa/manage/home/',
  },
  {
    id: 'firebase-fcm',
    name: 'Firebase Cloud Messaging',
    tier: 'free',
    category: 'Push',
    description: 'Mobile push notifications from Advance Notifications and crons.',
    billingModel: 'Free at normal volume (Firebase project limits)',
    adminMenus: ['Push Dashboard', 'Send Push', 'Advanced Send', 'Campaigns', 'Firebase Settings'],
    envKeys: ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL', 'FIREBASE_PRIVATE_KEY'],
  },
  {
    id: 'google-maps',
    name: 'Google Maps / Places / GBP',
    tier: 'paid',
    category: 'Maps',
    description: 'Workshop maps, GMB sync, customer reviews sync, geocoding when Places path is used.',
    billingModel: 'Per-request when Places API is used; GBP OAuth path preferred',
    adminMenus: ['Customer Reviews (GMB Sync)', 'Workshops → Public Pages', 'RSA maps embed'],
    envKeys: ['GOOGLE_MAPS_API_KEY', 'NEXT_PUBLIC_GOOGLE_MAPS_API_KEY', 'GOOGLE_OAUTH_CLIENT_ID'],
    docsUrl: 'https://console.cloud.google.com/google/maps-apis',
  },
  {
    id: 'ga4',
    name: 'Google Analytics 4 Data API',
    tier: 'paid',
    category: 'Analytics',
    description: 'Live analytics data in Analytics Hub (quota-based API).',
    billingModel: 'GA4 API quotas (usually within free tier)',
    adminMenus: ['Analytics Hub → Live Data'],
    envKeys: ['FIREBASE_PROJECT_ID', 'FIREBASE_CLIENT_EMAIL'],
    dashboardHref: '/dashboard/super_admin/analytics-hub',
  },
  {
    id: 'razorpay',
    name: 'Razorpay',
    tier: 'paid',
    category: 'Payments',
    description: 'App & website payment collection. Admin Finance reads settlement data from DB.',
    billingModel: 'Transaction fees per payment (not API billing dashboard)',
    adminMenus: ['Finance', 'Manual Invoice (indirect)', 'App checkout'],
    envKeys: ['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'],
    docsUrl: 'https://dashboard.razorpay.com/',
  },
  {
    id: 'smtp',
    name: 'Email (SMTP)',
    tier: 'paid',
    category: 'Messaging',
    description: 'Invoice and notification emails when SMTP is configured.',
    billingModel: 'Email provider plan or per-email',
    adminMenus: ['Manual Invoice send', 'System alerts (email fallback)'],
    envKeys: ['SMTP_HOST', 'SMTP_USER', 'SMTP_PASS'],
  },
  {
    id: 'telephony',
    name: 'SARV / Deepcall Telephony',
    tier: 'paid',
    category: 'Telephony',
    description: 'Telecaller and RSA call streaming, audit, and distribution.',
    billingModel: 'Per call / minute (telecom partner)',
    adminMenus: ['Telecaller Distribution', 'RSA', 'Telecaller dashboards'],
    envKeys: ['DEEPCALL_API_BASE', 'DEEPCALL_USER_ID', 'SARV_API_KEY'],
  },
  {
    id: 'telecrm',
    name: 'TeleCRM',
    tier: 'paid',
    category: 'CRM',
    description: 'Lead sync and webhook push from bookings pipeline.',
    billingModel: 'Partner CRM subscription / API plan',
    adminMenus: ['Bookings & Leads (sync)', 'Bot Flow env'],
    envKeys: ['TELECRM_WEBHOOK_SECRET', 'TELECRM_API_KEY'],
  },
  {
    id: 'isanction',
    name: 'iSanction (Car loan CRM)',
    tier: 'paid',
    category: 'CRM',
    description: 'Car loan lead sync via scheduled cron (not a sidebar menu).',
    billingModel: 'Partner API plan',
    adminMenus: ['Cron: car-loan-isanction-sync'],
    envKeys: ['ISANCTION_API_KEY', 'ISANCTION_API_URL'],
  },
  {
    id: 'twilio',
    name: 'Twilio SMS',
    tier: 'paid',
    category: 'Messaging',
    description: 'Optional SMS for invoices — wired in code, not a super-admin menu.',
    billingModel: 'Per SMS if TWILIO_* env is set',
    adminMenus: ['Invoice send API (background)'],
    envKeys: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN'],
  },
  {
    id: 'clarity',
    name: 'Microsoft Clarity',
    tier: 'free',
    category: 'Analytics',
    description: 'Session replay / heatmaps — config only in Analytics Hub.',
    billingModel: 'Free tier',
    adminMenus: ['Analytics Hub → Clarity'],
  },
  {
    id: 'qr-external',
    name: 'QR Server (legacy fallback)',
    tier: 'free',
    category: 'Marketing',
    description: 'Old qrserver.com image URLs only — Link Manager now generates QR locally.',
    billingModel: 'Free public API (legacy stored URLs only)',
    adminMenus: ['Link Manager (legacy QR images)'],
  },
];

export const ADMIN_MENU_API_SUMMARY: Array<{
  menu: string;
  href: string;
  tier: ApiServiceTier;
  services: string[];
}> = [
  { menu: 'Dashboard', href: '/dashboard/super_admin', tier: 'free', services: ['Supabase'] },
  { menu: 'Workshops', href: '/dashboard/super_admin/workshops', tier: 'free', services: ['Supabase'] },
  { menu: 'Bookings & Leads', href: '/dashboard/super_admin/bookings', tier: 'platform', services: ['Supabase', 'TeleCRM (sync)'] },
  { menu: 'RSA', href: '/dashboard/super_admin/rsa', tier: 'paid', services: ['Supabase', 'SARV Telephony'] },
  { menu: 'Telecaller Distribution', href: '/dashboard/super_admin/telecaller-distribution', tier: 'platform', services: ['Supabase', 'WhatsApp triggers'] },
  { menu: 'Manual Invoice', href: '/dashboard/super_admin/manual-invoices', tier: 'platform', services: ['Supabase', 'Email/SMS optional'] },
  { menu: 'Link Manager', href: '/dashboard/super_admin/link-manager', tier: 'free', services: ['Self-hosted / Supabase'] },
  { menu: 'Universal Link', href: '/dashboard/super_admin/universal-link', tier: 'free', services: ['Supabase'] },
  { menu: 'Push Notifications', href: '/dashboard/super_admin/advance-notifications', tier: 'free', services: ['Supabase', 'FCM on send'] },
  { menu: 'Analytics Hub', href: '/dashboard/super_admin/analytics-hub', tier: 'paid', services: ['Supabase', 'GA4 API', 'Clarity config'] },
  { menu: 'MISA AI Dashboard', href: '/dashboard/super_admin/misa-ai', tier: 'paid', services: ['OpenAI', 'Supabase usage logs'] },
  { menu: 'Admin AI Chat', href: '/dashboard/super_admin/admin-ai-chat', tier: 'paid', services: ['OpenAI'] },
  { menu: 'WhatsApp (all)', href: '/dashboard/super_admin/whatsapp-dashboard', tier: 'paid', services: ['Meta WhatsApp API', 'OpenAI (bot)'] },
  { menu: 'Customer Reviews', href: '/dashboard/super_admin/website-images/customer-reviews', tier: 'paid', services: ['Google GBP / Places'] },
  { menu: 'Finance', href: '/dashboard/super_admin/finance', tier: 'free', services: ['Supabase (Razorpay records)'] },
  { menu: 'System Monitor', href: '/dashboard/super_admin/system-monitor', tier: 'platform', services: ['Probes all configured APIs'] },
];

export function getEnvConfiguredKeys(): Record<string, boolean> {
  return {
    NEXT_PUBLIC_SUPABASE_URL: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    OPENAI_API_KEY: !!process.env.OPENAI_API_KEY,
    OPENAI_ADMIN_API_KEY: !!(process.env.OPENAI_ADMIN_API_KEY || process.env.OPENAI_ADMIN_KEY),
    OPENAI_MODEL: !!process.env.OPENAI_MODEL,
    WHATSAPP_ACCESS_TOKEN: !!process.env.WHATSAPP_ACCESS_TOKEN,
    WHATSAPP_PHONE_NUMBER_ID: !!process.env.WHATSAPP_PHONE_NUMBER_ID,
    WHATSAPP_BUSINESS_ACCOUNT_ID: !!process.env.WHATSAPP_BUSINESS_ACCOUNT_ID,
    GOOGLE_MAPS_API_KEY: !!(process.env.GOOGLE_MAPS_API_KEY || process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY),
    GOOGLE_OAUTH_CLIENT_ID: !!process.env.GOOGLE_OAUTH_CLIENT_ID,
    RAZORPAY_KEY_ID: !!process.env.RAZORPAY_KEY_ID,
    RAZORPAY_KEY_SECRET: !!process.env.RAZORPAY_KEY_SECRET,
    FIREBASE_PROJECT_ID: !!(process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID),
    FIREBASE_CLIENT_EMAIL: !!process.env.FIREBASE_CLIENT_EMAIL,
    FIREBASE_PRIVATE_KEY: !!process.env.FIREBASE_PRIVATE_KEY,
    SMTP_HOST: !!(process.env.SMTP_HOST || process.env.EMAIL_HOST),
    DEEPCALL_API_BASE: !!process.env.DEEPCALL_API_BASE,
    DEEPCALL_USER_ID: !!process.env.DEEPCALL_USER_ID,
    SARV_API_KEY: !!process.env.SARV_API_KEY,
    TELECRM_API_KEY: !!process.env.TELECRM_API_KEY,
    TELECRM_WEBHOOK_SECRET: !!process.env.TELECRM_WEBHOOK_SECRET,
    ISANCTION_API_KEY: !!process.env.ISANCTION_API_KEY,
    TWILIO_ACCOUNT_SID: !!process.env.TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN: !!process.env.TWILIO_AUTH_TOKEN,
  };
}

export function isServiceConfigured(entry: ApiServiceEntry, envStatus: Record<string, boolean>): boolean {
  if (!entry.envKeys?.length) return true;
  return entry.envKeys.some((key) => envStatus[key]);
}
