/**
 * URL Shortener Service
 * Phase 1.2 - Invoice Sharing
 * Purpose: Generate short URLs for invoice links
 */

import { createClient } from '@/lib/supabase/server';
import { createClient as createSupabaseAdminClient } from '@supabase/supabase-js';

// Ensure short_urls table exists (will be created by migration)
// This is a fallback check

// Use a simple base62 encoding for short URLs
const BASE62 = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Generate short code from ID
 */
function generateShortCode(id: string): string {
  // Use last 8 characters of UUID hash
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    const char = id.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Convert to base62
  let code = '';
  let num = Math.abs(hash);
  if (num === 0) return '0';
  
  while (num > 0) {
    code = BASE62[num % 62] + code;
    num = Math.floor(num / 62);
  }
  
  return code.substring(0, 8).padStart(8, '0');
}

/**
 * Create short URL for invoice
 */
export async function createShortUrl(
  longUrl: string,
  entityType: 'invoice' | 'payment' | 'receipt',
  entityId: string
): Promise<{ shortUrl: string; shortCode: string }> {
  try {
    const supabase = await createClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ADMIN_KEY;
    const admin =
      supabaseUrl && serviceRoleKey
        ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
        : null;
    const db = admin || supabase;
    
    // Generate short code
    const shortCode = generateShortCode(entityId);
    
    // Check if short code already exists
    const { data: existing } = await db
      .from('short_urls')
      .select('*')
      .eq('short_code', shortCode)
      .single();
    
    let finalShortCode = shortCode;
    
    if (existing) {
      // If exists and same URL, return existing
      if (existing.long_url === longUrl) {
        return {
          shortUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/s/${finalShortCode}`,
          shortCode: finalShortCode,
        };
      }
      // Otherwise, append random char
      finalShortCode = shortCode + BASE62[Math.floor(Math.random() * 62)];
    }
    
    // Create short URL record
    const { data: shortUrl, error } = await db
      .from('short_urls')
      .insert({
        short_code: finalShortCode,
        long_url: longUrl,
        entity_type: entityType,
        entity_id: entityId,
        created_at: new Date().toISOString(),
      })
      .select()
      .single();
    
    if (error) {
      // If insert fails, try to get existing
      const { data: existingUrl } = await db
        .from('short_urls')
        .select('*')
        .eq('entity_id', entityId)
        .eq('entity_type', entityType)
        .single();
      
      if (existingUrl) {
        return {
          shortUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/s/${existingUrl.short_code}`,
          shortCode: existingUrl.short_code,
        };
      }
      
      throw error;
    }
    
    return {
      shortUrl: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/s/${finalShortCode}`,
      shortCode: finalShortCode,
    };
  } catch (error: any) {
    console.error('Error creating short URL:', error);
    // Fallback to long URL
    return {
      shortUrl: longUrl,
      shortCode: '',
    };
  }
}

/**
 * Get long URL from short code
 */
export async function getLongUrl(shortCode: string): Promise<string | null> {
  try {
    const supabase = await createClient();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
    const serviceRoleKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY ||
      process.env.SUPABASE_SERVICE_KEY ||
      process.env.SUPABASE_ADMIN_KEY;
    const admin =
      supabaseUrl && serviceRoleKey
        ? createSupabaseAdminClient(supabaseUrl, serviceRoleKey, { auth: { persistSession: false, autoRefreshToken: false } })
        : null;
    const db = admin || supabase;
    
    const { data: shortUrl, error } = await db
      .from('short_urls')
      .select('long_url, clicks')
      .eq('short_code', shortCode)
      .single();
    
    if (error || !shortUrl) {
      return null;
    }
    
    // Increment click count
    await db
      .from('short_urls')
      .update({
        clicks: (shortUrl.clicks || 0) + 1,
        last_clicked_at: new Date().toISOString(),
      })
      .eq('short_code', shortCode);
    
    return shortUrl.long_url;
  } catch (error) {
    console.error('Error getting long URL:', error);
    return null;
  }
}

