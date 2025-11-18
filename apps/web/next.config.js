/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporarily disabled static export for build with API routes
  // output: 'export',
  
  images: {
    unoptimized: true,
  },
  
  // Force environment variables to be available
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  
  // For Hostinger deployment - standalone mode
  output: 'standalone',
};

module.exports = nextConfig;
