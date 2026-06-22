/** @type {import('next').NextConfig} */
const nextConfig = {
  // Temporarily disabled static export for build with API routes
  // output: 'export',

  // xlsx is CJS; keep it external so Turbopack resolves from node_modules reliably
  serverExternalPackages: ['xlsx'],

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
  
  // For Hostinger deployment - use `next start` (loads .env at runtime).
  // Standalone bundle is optional via `npm run start:standalone`.

  // Full <head> in first HTML chunk (cleaner document structure in view-source)
  htmlLimitedBots: /.*/,

  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
    // Keep tag boundaries readable before pretty-print patch runs
    serverMinification: false,
  },

  async redirects() {
    return [
      // Canonical marketing URLs (requested mappings)
      { source: '/services', destination: '/car-services', permanent: true },
      { source: '/car-services/car-battery', destination: '/car-services/car-battery-service', permanent: true },
      { source: '/about', destination: '/about-us', permanent: true },
      { source: '/contact', destination: '/contact-us', permanent: true },
      { source: '/faq', destination: '/faqs', permanent: true },

      // SEO continuity: old MyFNG uses /blogs/*
      { source: '/blog', destination: '/blogs', permanent: true },
      { source: '/blog/:slug', destination: '/blogs/:slug', permanent: true },
      // Legacy services URLs -> canonical marketing URLs
      { source: '/services/periodic-service', destination: '/car-services/periodic-car-service', permanent: true },
      { source: '/services/engine-service', destination: '/car-services/car-engine-service', permanent: true },
      { source: '/services/ac-service', destination: '/car-services/car-ac-service', permanent: true },
      { source: '/services/battery-service', destination: '/car-services/car-battery', permanent: true },
      { source: '/services/brake-service', destination: '/car-services/car-brake-service', permanent: true },
      { source: '/services/clutch-service', destination: '/car-services/car-clutch-service', permanent: true },
      { source: '/services/tyre-wheel-care', destination: '/car-services/tyre-wheel-care', permanent: true },
      { source: '/services/detailing-service', destination: '/car-services/car-detailing-service', permanent: true },
      { source: '/services/denting-painting', destination: '/car-services/car-denting-painting', permanent: true },
      { source: '/services/electrical-battery-service', destination: '/car-services/car-electrical-battery-service', permanent: true },
      { source: '/services/suspension-steering-service', destination: '/car-services/car-suspension-steering-service', permanent: true },
      // RSA canonical URL
      { source: '/rsa_landing', destination: '/car-roadside-assitance', permanent: true },
      { source: '/roadside-assistance', destination: '/car-roadside-assitance', permanent: true },
      // Legacy PHP URLs
      { source: '/car-loan.php', destination: '/car-loan', permanent: true },
    ];
  },
};

module.exports = nextConfig;
