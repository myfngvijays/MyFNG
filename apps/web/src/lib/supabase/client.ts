import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/types/database';

export const createClient = () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

  console.log('Supabase URL:', supabaseUrl ? 'Found' : 'Missing');
  console.log('Supabase Key:', supabaseKey ? 'Found' : 'Missing');

  if (!supabaseUrl || !supabaseKey) {
    throw new Error(`Missing Supabase environment variables. Please check your .env.local file.
    URL: ${supabaseUrl ? '✓ Found' : '✗ Missing'}
    KEY: ${supabaseKey ? '✓ Found' : '✗ Missing'}
    
    Make sure .env.local is in: /Users/roadserve/Downloads/MyFNG/apps/web/.env.local`);
  }

  return createBrowserClient<Database>(supabaseUrl, supabaseKey);
};

