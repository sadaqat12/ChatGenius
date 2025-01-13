/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'fvonaaujmtynnqtufkeb.supabase.co',
        pathname: '/storage/v1/object/**',
      },
    ],
  },
  typescript: {
    // Enable type checking during build
    ignoreBuildErrors: false,
  },
  eslint: {
    // Enable ESLint checking during build
    ignoreDuringBuilds: false,
  },
}

module.exports = nextConfig 