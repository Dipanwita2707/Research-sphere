const apiProxyTarget = process.env.API_PROXY_TARGET || 'http://localhost:5001';

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: false, // Disabled: StrictMode double-invokes effects in dev, causing duplicate API calls
  swcMinify: true,
  
  // Disable ESLint during production builds (for Render deployment)
  eslint: {
    ignoreDuringBuilds: true,
  },
  
  // Configure for containerized environments
  experimental: {
  },
  
  // Proxy API requests to backend
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${apiProxyTarget}/api/:path*`,
      },
      {
        source: '/uploads/:path*',
        destination: `${apiProxyTarget}/uploads/:path*`,
      },
    ];
  },
  
  // Security headers
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ];
  },
  
  // Compress images
  images: {
    formats: ['image/webp'],
    minimumCacheTTL: 300,
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'picsum.photos',
        pathname: '/**',
      },
    ],
  },
}

module.exports = nextConfig
