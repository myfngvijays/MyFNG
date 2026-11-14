import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { emailOtpReady, loadOtpChannelConfig, saveOtpChannelConfig } from '@/lib/otp/channelConfig';
import { sendSmtpMail } from '@/lib/otp/smtpSend';
import { normalizeOtpEmail } from '@/lib/otp/issueEmailOtp';

const ALLOWED_ROLES = ['SUPER_ADMIN', 'SUB_ADMIN'];

async function assertAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, status: 401, error: 'Unauthorized', userId: '' };
  const { data: profile } = await supabase
    .from('users_login')
    .select('id, roles!inner(role_code)')
    .eq('id', user.id)
    .maybeSingle();
  const role = String((profile as { roles?: { role_code?: string } } | null)?.roles?.role_code || '').toUpperCase();
  if (!profile || !ALLOWED_ROLES.includes(role)) {
    return { ok: false as const, status: 403, error: 'Forbidden', userId: '' };
  }
  return { ok: true as const, status: 200, error: '', userId: user.id };
}

function publicConfig(config: Awaited<ReturnType<typeof loadOtpChannelConfig>>) {
  return {
    sms_dlt: config.sms_dlt,
    firebase: config.firebase,
    whatsapp: config.whatsapp,
    email: config.email,
    email_ready: emailOtpReady(config),
    email_host: config.email_host,
    email_port: config.email_port,
    email_user: config.email_user,
    email_secure: config.email_secure,
    email_from: config.email_from,
    email_from_name: config.email_from_name,
    password_set: Boolean(config.email_pass),
  };
}

export async function GET() {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const config = await loadOtpChannelConfig();
  return NextResponse.json({ config: publicConfig(config) });
}

export async function POST(request: NextRequest) {
  const auth = await assertAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => ({}));

  if (body?.action === 'test') {
    const config = await loadOtpChannelConfig();
    const to = normalizeOtpEmail(body?.to);
    if (!to) return NextResponse.json({ error: 'Enter a valid email address for the test.' }, { status: 400 });
    if (!config.email_host || !config.email_user || !config.email_pass || !config.email_from) {
      return NextResponse.json({ error: 'Save the mailbox host, username, password, and from address first.' }, { status: 400 });
    }
    try {
      await sendSmtpMail(
        {
          host: config.email_host,
          port: config.email_port,
          user: config.email_user,
          pass: config.email_pass,
          secure: config.email_secure,
          from: config.email_from,
          fromName: config.email_from_name || 'MyFNG',
        },
        {
          to,
          subject: 'MyFNG email test',
          text: 'MyFNG can send mail from this mailbox. OTP email is connected.',
        },
      );
    } catch (error: any) {
      return NextResponse.json({ error: String(error?.message || 'Mailbox rejected the test email') }, { status: 502 });
    }
    return NextResponse.json({ success: true, message: `Test email sent to ${to}` });
  }

  try {
    const saved = await saveOtpChannelConfig(
      {
        sms_dlt: Boolean(body?.sms_dlt),
        firebase: Boolean(body?.firebase),
        whatsapp: Boolean(body?.whatsapp),
        email: Boolean(body?.email),
        email_host: String(body?.email_host || ''),
        email_port: Number(body?.email_port || 587),
        email_user: String(body?.email_user || ''),
        email_pass: String(body?.email_pass || ''),
        email_secure: body?.email_secure === 'ssl' ? 'ssl' : 'tls',
        email_from: String(body?.email_from || ''),
        email_from_name: String(body?.email_from_name || ''),
      },
      auth.userId,
    );
    return NextResponse.json({ success: true, config: publicConfig(saved) });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || 'Could not save OTP settings' }, { status: 500 });
  }
}
