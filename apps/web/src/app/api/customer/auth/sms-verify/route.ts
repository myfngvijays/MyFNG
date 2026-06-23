import { NextRequest } from 'next/server';
import { POST as verifyWhatsAppOtp } from '@/app/api/customer/auth/whatsapp-verify/route';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const wrapped = new NextRequest(request.url, {
    method: 'POST',
    headers: request.headers,
    body: JSON.stringify({
      ...(typeof body === 'object' && body ? body : {}),
      channel: 'SMS',
    }),
  });
  return verifyWhatsAppOtp(wrapped);
}
