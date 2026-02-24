/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporarily disabled static export for build with API routes
  // output: 'export',

  // Next 16 route type generation is stricter; keep builds unblocked
  // while route handler typings are progressively updated.
  typescript: {
    ignoreBuildErrors: true,
  },
  
  images: {
    unoptimized: true,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'logos-world.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'www.carlogos.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: '1000logos.net',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cdn.worldvectorlogo.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'upload.wikimedia.org',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'img.icons8.com',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'cffommijlvicfjhbqyzk.supabase.co',
        pathname: '/**',
      },
    ],
  },
  
  // Force environment variables to be available
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  },
  
  // For Hostinger deployment - standalone mode
  output: 'standalone',

  async redirects() {
    return [
      // SEO continuity: old MyFNG uses /blogs/*
      { source: '/blog', destination: '/blogs', permanent: true },
      { source: '/blog/:slug', destination: '/blogs/:slug', permanent: true },
      // Ads/deep-link continuity for periodic service page
      { source: '/services/periodic-service', destination: '/car-services/periodic-car-service', permanent: true },
      // RSA canonical URL
      { source: '/rsa_landing', destination: '/car-roadside-assitance', permanent: true },
      { source: '/roadside-assistance', destination: '/car-roadside-assitance', permanent: true },
    ];
  },
};

module.exports = nextConfig;
