/**
 * Short URL Redirect Route
 * Phase 1.2 - Invoice Sharing
 * Purpose: Redirect short URLs to actual invoice/payment pages
 */

import { NextRequest, NextResponse } from 'next/server';
import { getLongUrl } from '@/lib/services/urlShortener';

export async function GET(
  request: NextRequest,
  { params }: { params: { shortCode: string } }
) {
  try {
    const shortCode = params.shortCode;
    
    if (!shortCode || shortCode.length < 4) {
      return NextResponse.redirect(new URL('/', request.url));
    }

    const longUrl = await getLongUrl(shortCode);

    if (!longUrl) {
      // Short URL not found, redirect to home
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Redirect to long URL
    return NextResponse.redirect(new URL(longUrl, request.url));
  } catch (error) {
    console.error('Error in short URL redirect:', error);
    // On error, redirect to home
    return NextResponse.redirect(new URL('/', request.url));
  }
}

