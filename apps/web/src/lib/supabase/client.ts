import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

export const getBrowserClient = () => {
  if (browserClient) return browserClient;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`Missing Supabase environment variables. Please check your .env.local file.
    URL: ${supabaseUrl ? '✓ Found' : '✗ Missing'}
    KEY: ${supabaseKey ? '✓ Found' : '✗ Missing'}
    
    Make sure .env.local is in: /Users/roadserve/Downloads/MyFNG/apps/web/.env.local`);
  }

  browserClient = createBrowserClient<Database>(supabaseUrl, supabaseKey);
  return browserClient;
};

// Backward-compatible export
export const createClient = getBrowserClient;

