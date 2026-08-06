import { NextRequest, NextResponse } from 'next/server';
import { handleManagedShortLinkRequest } from '@/lib/link-manager/redirect';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shortCode: string }> },
) {
  const { shortCode } = await params;
  return handleManagedShortLinkRequest(request, shortCode, { isQrScan: true });
}
