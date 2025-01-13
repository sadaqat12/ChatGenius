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
    // Comment this out if you want to catch type errors during build
    // ignoreBuildErrors: true,
  },
  eslint: {
    // Comment this out if you want to catch lint errors during build
    // ignoreDuringBuilds: true,
  },
}

module.exports = nextConfig 